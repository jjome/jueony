import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createDocumentHistory,historyScopeKey,assertHistorySnapshot} from '../src/modules/document-files/public/index.ts';
import type {HistoryRecords,HistoryScope} from '../src/modules/document-files/public/index.ts';

const digest=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const scope:HistoryScope={windowScope:'main',workspaceId:'work-a',documentId:'doc-a'};
const snapshot=(text='이력 😀',name='원문.hwp')=>({meta:{name,pageCount:1,sectionCount:1},paragraphs:[{section:0,paragraph:0,sectionPage:1,globalIndex:0,stableId:'stable-1',text,normalizedText:text,controlCount:0,signature:'sig',isAnchorCandidate:false}],controls:[]});
function setup(){
 const data=new Map<string,unknown>();let sequence=0, fail=false, beforeWrite:(()=>void)|undefined;
 const owner={instance:'instance-1',revision:'revision-1',available:true};
 const records:HistoryRecords={async read(key){return structuredClone(data.get(key)??null);},async exchange(key,expected,value,guard){beforeWrite?.();guard();if(fail)throw Error('own quota failure');if(JSON.stringify(data.get(key)??null)!==JSON.stringify(expected??null))throw Error('CAS conflict');if(value==null)data.delete(key);else data.set(key,structuredClone(value));}};
 const open=(target=scope)=>createDocumentHistory({scope:target,owner:()=>owner,records,digest,nextId:()=>`own-id-${++sequence}`,now:()=>sequence});
 return{data,owner,open,fail:(value:boolean)=>{fail=value;},beforeWrite:(fn:()=>void)=>{beforeWrite=fn;}};
}

test('history isolates document, workspace and window scopes with identical file names',async()=>{
 const x=setup(),a=x.open();await a.save('첫 이력','같은이름.hwp',snapshot('A'));
 for(const s of [{...scope,documentId:'doc-b'},{...scope,workspaceId:'work-b'},{...scope,windowScope:'window-b'}]){
  const other=x.open(s);assert.deepEqual(await other.list(),[]);await other.save('다른 이력','같은이름.hwp',snapshot('B'));
 }
 const rows=await a.list();assert.equal(rows.length,1);assert.equal((await a.get(rows[0].id)as any).paragraphs[0].text,'A');
});
test('history resumes stable document ID after restart and survives SaveAs renaming',async()=>{
 const x=setup(),a=x.open();await a.save('before','before.hwp',snapshot());x.owner.instance='restarted-instance';
 const reopened=x.open();assert.equal((await reopened.list()).length,1);await reopened.save('after','renamed.hwpx',snapshot('후속','renamed.hwpx'));
 assert.deepEqual((await reopened.list()).map(r=>r.sourceFileName),['renamed.hwpx','before.hwp']);
});
test('clear, individual delete and limit eviction never mutate another document catalog',async()=>{
 const x=setup(),other=x.open({...scope,workspaceId:'other'});await other.save('other','other.hwp',snapshot());const saved=JSON.stringify(x.data.get(historyScopeKey({...scope,workspaceId:'other'})));
 const a=x.open();for(let i=0;i<26;i++)await a.save(`v${i}`,'same.hwp',snapshot(String(i)));
 const rows=await a.list();assert.equal(rows.length,24);assert.ok(!rows.some(r=>r.label==='v0'||r.label==='v1'));
 await a.remove(rows[0].id);assert.equal((await a.list()).length,23);await a.clear();assert.deepEqual(await a.list(),[]);
 assert.equal(JSON.stringify(x.data.get(historyScopeKey({...scope,workspaceId:'other'}))),saved);
});
test('stale lists cannot delete newer history or clear concurrently added entries',async()=>{
 const x=setup(),a=x.open(),b=x.open();await a.save('first','file.hwp',snapshot());const old=await a.list();await b.save('second','file.hwp',snapshot());const bytes=JSON.stringify([...x.data]);
 await assert.rejects(a.clear(),/목록/);await assert.rejects(a.remove(old[0].id),/목록/);assert.equal(JSON.stringify([...x.data]),bytes);
 await a.list();await a.clear();assert.deepEqual(await b.list(),[]);
});
test('loaded document, revision, composition and host-lock changes invalidate an open history session',async()=>{
 for(const field of ['instance','revision','available']as const){const x=setup(),a=x.open();await a.save('before','file.hwp',snapshot());await a.list();
  if(field==='available')x.owner.available=false;else x.owner[field]+='changed';const before=JSON.stringify([...x.data]);
  await assert.rejects(a.list(),/문서나 이력/);await assert.rejects(a.save('late','file.hwp',snapshot()),/문서나 이력/);await assert.rejects(a.clear(),/문서나 이력/);assert.equal(JSON.stringify([...x.data]),before);
 }
});
test('document change at the actual write boundary aborts before catalog replacement',async()=>{
 const x=setup(),a=x.open();await a.save('first','file.hwp',snapshot());const before=JSON.stringify([...x.data]);x.beforeWrite(()=>{x.owner.instance='replacement';});
 await assert.rejects(a.save('stale','file.hwp',snapshot()),/文|문서/);assert.equal(JSON.stringify([...x.data]),before);
});
test('durability failure is reported and preserves the existing catalog without a memory success fallback',async()=>{
 const x=setup(),a=x.open();await a.save('first','file.hwp',snapshot());await a.list();const before=JSON.stringify([...x.data]);x.fail(true);
 await assert.rejects(a.save('lost','file.hwp',snapshot()),/quota/);await assert.rejects(a.clear(),/quota/);assert.equal(JSON.stringify([...x.data]),before);
});
test('tampered metadata, snapshot bytes and malformed catalogs refuse before destructive operations',async()=>{
 for(const mutation of [(r:any)=>{r.entries[0].meta.label='modified';},(r:any)=>{r.entries[0].snapshot.paragraphs[0].text='modified';},(r:any)=>{r.scope[1]='other-work';},(r:any)=>{r.entries.push(r.entries[0]);}]){
  const x=setup(),a=x.open();await a.save('first','file.hwp',snapshot());await a.list();const raw=structuredClone(x.data.get(historyScopeKey(scope)));mutation(raw);x.data.set(historyScopeKey(scope),raw);const before=JSON.stringify([...x.data]);
  await assert.rejects(a.list(),/무결성/);await assert.rejects(a.clear(),/무결성/);assert.equal(JSON.stringify([...x.data]),before);
 }
});
test('invalid scopes and unusable compare snapshots are rejected rather than silently stored',()=>{
 assert.throws(()=>historyScopeKey({...scope,workspaceId:''}),/무결성/);
 assert.notEqual(historyScopeKey({...scope,workspaceId:'a,b',documentId:'c'}),historyScopeKey({...scope,workspaceId:'a',documentId:'b,c'}));
 for(const v of [null,{meta:{name:'x',pageCount:0,sectionCount:0},paragraphs:[{}],controls:[]},snapshot('x'.repeat(9*1024*1024)),{...snapshot(),extra:NaN}])assert.throws(()=>assertHistorySnapshot(v));
});
test('payloads are independently cloned and UTF8 byte counts retain emoji exactly',async()=>{
 const x=setup(),a=x.open(),original=snapshot();const meta=await a.save('one','file.hwp',original);assert.equal(meta.byteLength,Buffer.byteLength(JSON.stringify(original)));
 original.paragraphs[0].text='source mutation';await a.list();const copy=await a.get(meta.id)as any;assert.equal(copy.paragraphs[0].text,'이력 😀');copy.paragraphs[0].text='read mutation';assert.equal((await a.get(meta.id)as any).paragraphs[0].text,'이력 😀');
});
