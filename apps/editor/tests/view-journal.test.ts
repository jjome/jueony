import test from 'node:test';
import assert from 'node:assert/strict';
import {createDocumentViewJournal,VIEW_JOURNAL_KEY,PreferenceStorageError} from '../src/modules/preferences/public/index.ts';
function fixture(){let raw:string|null=null;const storage={getItem:()=>raw,setItem:(_k:string,v:string)=>{raw=v;}};return {storage,journal:createDocumentViewJournal(storage),get:()=>raw,set:(v:string)=>{raw=v;}};}
const entry=(id='d1',time=2)=>({documentId:id,workspaceId:'w1',checkpointAt:1,recordedAt:time,view:{version:1 as const,zoom:1,fitMode:'none' as const,scrollX:0,scrollY:12}});
test('exit fallback is synchronous, scoped to exact document checkpoint and defensive on read',()=>{
 const f=fixture();f.journal.checkpoint([entry()]);assert.ok(f.get());assert.equal(VIEW_JOURNAL_KEY,'jueony-document-view-journal-v1');
 assert.equal(f.journal.read('d1','w2',1),undefined);assert.equal(f.journal.read('d2','w1',1),undefined);assert.equal(f.journal.read('d1','w1',2),undefined);
 const view=f.journal.read('d1','w1',1)!;view.scrollY=999;assert.equal(f.journal.read('d1','w1',1)!.scrollY,12);
 f.journal.remove('d1','w2');assert.ok(f.journal.read('d1','w1',1));f.journal.remove('d1','w1');assert.equal(f.journal.read('d1','w1',1),undefined);
 f.journal.checkpoint([{...entry(),checkpointAt:1.5}]);assert.ok(f.journal.read('d1','w1',1.5));
});
test('newer IndexedDB view wins over stale exit record; latest exit supersedes queued older view',()=>{
 const f=fixture();f.journal.checkpoint([entry('d1',5)]);assert.equal(f.journal.read('d1','w1',1,6),undefined);assert.ok(f.journal.read('d1','w1',1,4));
 assert.equal(f.journal.readRecord('d1','w1',1)!.recordedAt,5);
 f.journal.checkpoint([{...entry('d1',4),view:{...entry().view,scrollY:1}}]);assert.equal(f.journal.read('d1','w1',1)!.scrollY,12);
});
test('other workspaces and unloaded documents remain; journal bounds entries without document bytes',()=>{
 const f=fixture();f.journal.checkpoint([{...entry('other',0),workspaceId:'w2'}]);f.journal.checkpoint([entry()]);assert.ok(f.journal.read('other','w2',1));
 f.journal.checkpoint(Array.from({length:70},(_,i)=>entry('d'+i,i+10)));assert.equal(JSON.parse(f.get()!).entries.length,64);assert.equal(f.get()!.includes('"bytes"'),false);
});
test('corrupt and future journal data is preserved rather than overwritten',()=>{
 for(const raw of ['{','{"version":2,"entries":[]}','{"version":1,"entries":[{}]}']){
  const f=fixture();f.set(raw);assert.throws(()=>f.journal.checkpoint([entry()]),PreferenceStorageError);assert.equal(f.get(),raw);
 }
});
test('quota and blocked read failures are reported with preference errors',()=>{
 const f=fixture();f.storage.setItem=()=>{throw new Error('quota');};assert.throws(()=>f.journal.checkpoint([entry()]),e=>e instanceof PreferenceStorageError&&e.code==='write');
 f.storage.getItem=()=>{throw new Error('blocked');};assert.throws(()=>f.journal.read('d1','w1',1),e=>e instanceof PreferenceStorageError&&e.code==='read');
});
