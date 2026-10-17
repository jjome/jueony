import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {assertDocumentSaveLayout} from '../../apps/editor/src/adapters/rhwp/document-save-layout.ts';
import {verifyPreservedExport} from '../../apps/editor/src/adapters/rhwp/preservation.ts';
import {loadReviewEngine, hash} from '../../apps/editor/scripts/lib/hancom-review.mjs';

const out = resolve('build/save-gate-review76');
await mkdir(out, {recursive:true});
const results=[];
function reader(shared) {
  return {canvasMetricsActive:()=>false, pageCount:()=>1, free:()=>{},
    getPageControlLayout:()=>shared.controls,
    getPageTextLayout:()=>shared.text};
}
function response() {
  return {controls:{controls:[{type:'shape',x:1,y:2,w:3,h:4}]},
    text:{runs:[{text:'OWN',x:0,y:0,w:3,h:4,charX:[0,1,2,3]}]}};
}

// This intentionally exercises the supported object-response branch, not a
// claim that the current WASM string getter shares a JS object.
{
  const shared=response(), source=reader(shared), reopened=reader(shared);
  let writes=0;
  const proof=assertDocumentSaveLayout(source,new Uint8Array([1]),'hwpx',()=>{
    shared.controls.controls[0].x=101;
    return reopened;
  });
  writes++;
  assert.equal(proof.pages,1);assert.equal(writes,1);
  results.push({name:'object-response shared mutable storage',finding:'FALSE_PASS',
    sourceXAtCapture:1,reopenedX:101,proof,writes,
    limitation:'Current official WASM getters return strings. This reproduces a hole in the explicitly supported object-response contract.'});
}
{
  const before=response(),after=response();
  before.text.newPublishedMetadata={x:123};after.text.newPublishedMetadata={x:123.1};
  const proof=assertDocumentSaveLayout(reader(before),new Uint8Array([1]),'hwpx',()=>reader(after));
  results.push({name:'unknown metadata coordinate-named number',finding:'UNKNOWN_FIELD_TOLERANCE',
    field:'text.newPublishedMetadata.x',before:123,after:123.1,proof,
    limitation:'This is not an existing engine field failure. The comparator promise that every future metadata number is exact is broader than its global key-name test.'});
}

const engine=await loadReviewEngine(resolve('build/rhwp-engine/source-23d2545926a179a5/pkg'));
{
  const d=engine.HwpDocument.createEmpty();d.createBlankDocument();d.insertText(0,0,0,'OWN alias');
  const a=d.exportHwpxWithReport(), bytes=a.takeBytes(), loss=a.contentLoss();a.free();
  let freed=0,exception;
  const originalFree=d.free.bind(d);
  d.free=()=>{freed++;originalFree();};
  try{verifyPreservedExport(d,bytes,'hwpx',loss,()=>d);}catch(error){exception=String(error);}
  assert.equal(freed,1,'source free is reached before whole-layout alias rejection');
  results.push({name:'semantic pre-gate source alias',finding:'SOURCE_HANDLE_FREED',
    actualEngineSource:engine.metadata.sourceId,sourceFreeCalls:freed,exception,
    limitation:'Injected invalid reopen callback. Production reopen constructors allocate new handles, but the entry contract currently destroys the source before the explicit downstream alias guard can protect it.'});
}
await writeFile(out+'/review-findings.json',JSON.stringify({engineSourceId:engine.metadata.sourceId,
  productionChanged:false,files:{adapter:hash(await readFile('apps/editor/src/adapters/rhwp/document-save-layout.ts')),
    preservation:hash(await readFile('apps/editor/src/adapters/rhwp/preservation.ts'))},results},null,2));
console.log(JSON.stringify(results,null,2));
