import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {resolve,join,isAbsolute} from 'node:path';
import {loadReviewEngine,snapshot,compareSnapshots,hash} from './lib/hancom-review.mjs';
import {verifyPreservedExport} from '../src/adapters/rhwp/preservation.ts';
const root=resolve(import.meta.dirname,'../../..');
for(const key of ['JUEONY_ENGINE_PACKAGE','JUEONY_TEST_OUTPUT'])assert.ok(isAbsolute(process.env[key]??''),key+' must be absolute');
const out=resolve(process.env.JUEONY_TEST_OUTPUT);try{await access(join(out,'result.json'));throw Error('Fresh output required');}catch(e){if(e.code!=='ENOENT')throw e;}await mkdir(out,{recursive:true});
const engine=await loadReviewEngine(process.env.JUEONY_ENGINE_PACKAGE),{HwpDocument}=engine;
const fixtures=join(root,'apps/editor/tests/fixtures/n001-merged-generic176-own');
const manifestBytes=await readFile(join(fixtures,'manifest.json')),manifest=JSON.parse(manifestBytes);
assert.equal(hash(manifestBytes),'932de8abd7e79e744ef029f5fc357abb0f70fdbab87cb0d22094644340774355');assert.equal(manifest.fixtures.length,2);
const json=x=>typeof x==='string'?JSON.parse(x):x,scalars=x=>Array.from(x).length;
const results=[],failures=[];let exports=0,history=0,wrongPasswords=0;
function coverage(d){
 const runs=Array.from({length:d.pageCount()},(_,p)=>json(d.getPageTextLayout(p)).runs).flat(),stories=[];
 const check=(expected,owned,address)=>{let seen='',at=0;for(const r of runs.filter(owned)){assert.equal(r.charStart,at,'scalar source start');assert.equal(r.charX.length,scalars(r.text)+1,'scalar boundaries plus end');assert.ok(r.charX.every(Number.isFinite));seen+=r.text;at+=scalars(r.text);}assert.equal(seen,expected,'all story text exactly once');stories.push({...address,scalars:at,utf16:seen.length});};
 for(let s=0;s<d.getSectionCount();s++)for(let p=0;p<d.getParagraphCount(s);p++){const n=d.getParagraphLength(s,p);check(d.getTextRange(s,p,0,n),r=>r.secIdx===s&&r.paraIdx===p&&!Object.hasOwn(r,'parentParaIdx'),{section:s,paragraph:p});}
 const lists=json(d.getCursorModel()).lists;for(const l of lists){assert.ok(l.isCell,'own fixtures contain only body/cell stories');assert.equal(l.hostListId,0,'own fixtures have no nested table');for(let cp=0;cp<l.paraCount;cp++){const s=l.sectionIndex,p=l.hostPara,c=l.controlIndex,cell=l.cellIndex,n=d.getCellParagraphLength(s,p,c,cell,cp);check(d.getTextInCell(s,p,c,cell,cp,0,n),r=>r.secIdx===s&&r.parentParaIdx===p&&r.controlIdx===c&&r.cellIdx===cell&&r.cellParaIdx===cp,{section:s,paragraph:p,control:c,cell,cellParagraph:cp});}}
 return stories;
}
function artifact(d,format,password){const a=format==='hwp'?(password?d.exportHwpWithPasswordAndReport(password):d.exportHwpWithReport()):(password?d.exportHwpxWithPasswordAndReport(password):d.exportHwpxWithReport());try{return{bytes:Buffer.from(a.takeBytes()),loss:json(a.contentLoss())};}finally{a.free();}}
const open=(b,p)=>p?HwpDocument.openWithPassword(b,p):new HwpDocument(b);
for(const f of manifest.fixtures)for(const origin of ['hwp','hwpx'])for(const edit of ['none','body','cell'])for(const encrypted of [false,true]){
 const name=`${f.name}-${origin}-${edit}-${encrypted?'password':'plain'}`,password=encrypted?'Continuation160-own':'',result={name,exports:[],history:[]};let d,phase='input';
 try{
  const bytes=await readFile(join(fixtures,`${f.name}.${origin}`));assert.equal(hash(bytes),origin==='hwp'?f.nativeSha256:f.xmlSha256);d=new HwpDocument(bytes);assert.ok(d.pageCount()>1,'actual own continuation spans physical frames');coverage(d);
  const original=snapshot(d),undo=d.saveSnapshot();phase='public-edit';
  if(edit==='body'){const p=d.getParagraphCount(0)-1;d.insertText(0,p,d.getParagraphLength(0,p),' 후속 😀 𠮷 본문 편집');}
  else if(edit==='cell'){const l=json(d.getCursorModel()).lists.find(l=>l.isCell);assert.ok(l);d.insertTextInCell(l.sectionIndex,l.hostPara,l.controlIndex,l.cellIndex,0,3,'Actual 😀 ');}
  const edited=snapshot(d),redo=d.saveSnapshot();coverage(d);d.restoreSnapshot(undo);assert.deepEqual(snapshot(d),original);d.restoreSnapshot(redo);assert.deepEqual(snapshot(d),edited);if(edit!=='none')history+=2;result.history.push('undo','redo');
  for(const [cycle,format]of ['hwpx','hwp','hwpx','hwp','hwpx'].entries()){
   if(cycle===3){const old=snapshot(d),u=d.saveSnapshot(),tail=d.getParagraphCount(0)-1;d.insertText(0,tail,d.getParagraphLength(0,tail),' Merged followup 😀 ');const l=json(d.getCursorModel()).lists.find(l=>l.isCell);d.insertTextInCell(l.sectionIndex,l.hostPara,l.controlIndex,l.cellIndex,0,0,'검토 😀 ');const after=snapshot(d),v=d.saveSnapshot();coverage(d);d.restoreSnapshot(u);assert.deepEqual(snapshot(d),old);d.restoreSnapshot(v);assert.deepEqual(snapshot(d),after);history+=2;result.history.push('followup-undo','followup-redo');}

   phase=`cycle${cycle}-${format}`;const before=snapshot(d),events=d.getEventLog(),source=artifact(d,'hwp','').bytes,cov=coverage(d),a=artifact(d,format,password);assert.equal(a.loss.count,0);const guard=verifyPreservedExport(d,a.bytes,format,a.loss,b=>open(b,password));assert.equal(guard.status,'checked');
   const file=join(out,name+`-cycle${cycle}.${format}`);await writeFile(file,a.bytes);const disk=await readFile(file);assert.deepEqual(disk,a.bytes);
   if(password){assert.throws(()=>HwpDocument.openWithPassword(disk,'incorrect-own-password'));wrongPasswords++;}
   const next=open(disk,password);try{assert.equal(compareSnapshots(before,snapshot(next)).status,'SAME_WITHIN_PUBLISHED_CONTRACT');assert.deepEqual(coverage(next),cov);assert.deepEqual(snapshot(d),before);assert.equal(d.getEventLog(),events);assert.deepEqual(artifact(d,'hwp','').bytes,source);}catch(e){next.free();throw e;}
   exports++;result.exports.push({format,cycle,guard:guard.status,geometry:0,loss:0,coverage:cov,sourceUnchanged:true,eventsUnchanged:true,diskExact:true});d.free();d=next;
  }
  result.status='PASS';
 }catch(e){result.status='FAIL';result.phase=phase;result.error=String(e?.stack??e);failures.push({name,phase,error:result.error});}finally{d?.free();}results.push(result);
 await writeFile(join(out,'result.json'),JSON.stringify({engine:engine.metadata,verifierSha256:hash(await readFile(import.meta.filename)),fixtureManifestSha256:hash(manifestBytes),sourceHashes:await Promise.all([...manifest.fixtures.flatMap(f=>['hwp','hwpx'].map(ext=>join(fixtures,`${f.name}.${ext}`))),join(fixtures,'manifest.json'),join(fixtures,'README.md')].map(async path=>({path,sha256:hash(await readFile(path))}))),cases:results.length,exports,history,wrongPasswords,results,failures,scope:'Fixed own 3/4-column horizontally merged RowBreak inputs;Native/XML,initial/body/cell public edits,plain/password,5 mixed disk reopens including retained body+cell followup,exact history,all body+cell scalar/UTF16,unchanged full production0.2 semantics/layout guard;no source/lease repair. Vertical rowspan and nested/special stories separate.'},null,2));
}
assert.equal(failures.length,0,`${failures.length}/24 failed`);

assert.equal(results.length,24);assert.equal(exports,120);assert.equal(history,80);assert.equal(wrongPasswords,60);
