import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {loadReviewEngine,snapshot,differences,hash} from '../../apps/editor/scripts/lib/hancom-review.mjs';
const root=resolve('.'),folder=resolve('build/gulimche-admission-candidate81'),engine=await loadReviewEngine(resolve('build/rhwp-engine/source-ad6186043c15532f/pkg'));
const inputs=JSON.parse(await readFile(join(folder,'owned-exclusions-v5.json'),'utf8'));
const native=JSON.parse(await readFile(join(folder,'candidate-v5/owned-exclusions.json'),'utf8'));
const observations=[],failures=[];
for(const input of inputs){
 const bytes=await readFile(resolve(input.file));assert.equal(hash(bytes),input.sha256);assert.ok(input.edits.length>0);const expected=native.rows.find(r=>r.case===input.name);assert.ok(expected);assert.equal(expected.inputSHA256,input.sha256);
 const d=new engine.HwpDocument(bytes);
 try{const before=snapshot(d),geometry=differences(expected.liveLayout,before.layout,0.2),artifacts=[];
  for(const hwpx of [false,true]){const r=hwpx?d.exportHwpxWithReport():d.exportHwpWithReport();let reopened;
   try{const saved=r.takeBytes(),loss=r.contentLoss(),reference=expected.artifacts.find(a=>a.hwpx===hwpx);reopened=new engine.HwpDocument(saved);const next=snapshot(reopened),delta=differences(reference.layout,next.layout,0.2);artifacts.push({hwpx,bytesExact:reference.bytesSHA256===hash(saved),lossExact:reference.lossSHA256===hash(loss),geometryDifferences:delta.length,first:delta.slice(0,3)});}finally{reopened?.free();r.free();}
  }
  const pass=geometry.length===0&&artifacts.every(a=>a.bytesExact&&a.lossExact&&a.geometryDifferences===0);if(!pass)failures.push(input.name);
  observations.push({case:input.name,inputSHA256:input.sha256,actualFixtureEdits:input.edits.length,liveGeometryDifferences:geometry.length,first:geometry.slice(0,3),artifacts,pass});
  assert.equal(hash(await readFile(resolve(input.file))),input.sha256);
 }finally{d.free();}
}
await writeFile(join(folder,'negative-v5-vs-formal83-wasm.json'),JSON.stringify({baselineEngine:engine.metadata,candidate:'Native candidate-v5; exact official83 sources except the three sealed metric files',observations,failures,scope:{ownMutants:11,exportByteComparisons:22,allPublishedGeometry:true,tolerance:0.2,noLossReclassification:true,fixtureMutationsAsserted:true}},null,2));
console.log({pass:observations.length-failures.length,failures});if(failures.length)process.exitCode=1;
