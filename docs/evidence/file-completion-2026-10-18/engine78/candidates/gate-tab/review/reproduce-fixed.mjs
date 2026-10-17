import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {assertDocumentSaveLayout,DocumentSaveLayoutError} from '../../apps/editor/src/adapters/rhwp/document-save-layout.ts';
import {verifyPreservedExport,PreservationError} from '../../apps/editor/src/adapters/rhwp/preservation.ts';
import {loadReviewEngine,hash} from '../../apps/editor/scripts/lib/hancom-review.mjs';
const results=[], bytes=new Uint8Array([1]);
function response(){return{controls:{controls:[{type:'shape',x:1,y:2,w:3,h:4}]},text:{runs:[{text:'OWN',x:0,y:0,w:3,h:4,charX:[0,1,2,3]}]}};}
function reader(data){return{canvasMetricsActive:()=>false,pageCount:()=>1,free:()=>{},getPageControlLayout:()=>data.controls,getPageTextLayout:()=>data.text};}
{
 const data=response();let writes=0;
 assert.throws(()=>{assertDocumentSaveLayout(reader(data),bytes,'hwpx',()=>{data.controls.controls[0].x=101;return reader(data);});writes++;},e=>e instanceof DocumentSaveLayoutError&&e.code==='changed');
 assert.equal(writes,0);results.push({name:'shared object immutable snapshot',status:'PASS',writes});
}
{
 const a=response(),b=response();a.text.newPublishedMetadata={x:123};b.text.newPublishedMetadata={x:123.1};
 assert.throws(()=>assertDocumentSaveLayout(reader(a),bytes,'hwpx',()=>reader(b)),e=>e instanceof DocumentSaveLayoutError&&e.code==='changed');
 results.push({name:'arbitrary coordinate-named metadata is exact',status:'PASS'});
}
const engine=await loadReviewEngine(resolve('build/rhwp-engine/source-23d2545926a179a5/pkg'));
for(const kind of ['direct','borrowed']){
 const d=engine.HwpDocument.createEmpty();d.createBlankDocument();d.insertText(0,0,0,'OWN alias');
 const a=d.exportHwpxWithReport(),data=a.takeBytes(),loss=a.contentLoss();a.free();
 let frees=0;const free=d.free.bind(d);d.free=()=>{frees++;free();};
 try{
  assert.throws(()=>verifyPreservedExport(d,data,'hwpx',loss,()=>kind==='direct'?d:{borrowDocumentHandle:()=>d,free:()=>{frees++;free();}}),PreservationError);
  assert.equal(frees,0);assert.equal(d.getTextRange(0,0,0,d.getParagraphLength(0,0)).includes('OWN alias'),true);
  results.push({name:kind+' semantic source alias retains live handle',status:'PASS',sourceFreeCalls:frees});
 }finally{free();}
}
const out=resolve('build/save-gate-review76/fixed-review');await mkdir(out,{recursive:true});
await writeFile(out+'/result.json',JSON.stringify({engineSourceId:engine.metadata.sourceId,
  adapterSha256:hash(await readFile('apps/editor/src/adapters/rhwp/document-save-layout.ts')),
  preservationSha256:hash(await readFile('apps/editor/src/adapters/rhwp/preservation.ts')),
  sourceChangedByReviewer:false,results},null,2));
console.log('PASS',results.length,'independent fixed-boundary checks');
