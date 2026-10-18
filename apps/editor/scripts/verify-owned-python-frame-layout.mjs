import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,isAbsolute,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadReviewEngine,snapshot,compareSnapshots,differences,hash} from './lib/hancom-review.mjs';
import {verifyPreservedExport} from '../src/adapters/rhwp/preservation.ts';
for(const key of ['JUEONY_ENGINE_PACKAGE','JUEONY_FRAME_BASELINE_ENGINE_PACKAGE','JUEONY_TEST_SOURCE','JUEONY_TEST_ORACLE','JUEONY_TEST_OUTPUT'])assert.ok(isAbsolute(process.env[key]??''),key);
const out=resolve(process.env.JUEONY_TEST_OUTPUT);await mkdir(out,{recursive:true});
const source=await readFile(process.env.JUEONY_TEST_SOURCE),oracle=await readFile(process.env.JUEONY_TEST_ORACLE);
assert.equal(hash(source),'c11c90b48eb8b709cdeb91f5a2c7ecae1b89d0d1390dfc1db32865b902d0dd0f');
assert.equal(hash(oracle),'51e89075e288e36511df470ffc0fc63fa5ec38df350e606ff623b5e965704d52');
const baseline=await loadReviewEngine(process.env.JUEONY_FRAME_BASELINE_ENGINE_PACKAGE),candidate=await loadReviewEngine(process.env.JUEONY_ENGINE_PACKAGE);
assert.equal(baseline.metadata.sourceId,'3f07621d4728accf');assert.equal(baseline.metadata.wasmSha256,'e432ad3c3d4e324b4ad57d989532bb851c0f72246709a356d458578ad0613698');
const results=[],failures=[],observations=[];
const app=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const guardPaths=['src/adapters/rhwp/preservation.ts','src/adapters/rhwp/document-save-layout.ts','src/adapters/rhwp/overlap-save-layout.ts'];
const fingerprints=()=>Promise.all(guardPaths.map(async path=>({path,sha256:hash(await readFile(join(app,path)))})));
const guardsBefore=await fingerprints();
async function check(name,f){try{await f();results.push({name,status:'PASS'});}catch(error){const message=String(error.stack??error);results.push({name,status:'FAIL',message});failures.push(name);}}
// Pin the original frame proof to its original reference engine. A later fix
// to the Native reference must be proved separately, never hidden by rebasing
// the expected difference count or dropping fields from the comparison.
const oldDoc=new baseline.HwpDocument(source),doc=new candidate.HwpDocument(source),refDoc=new baseline.HwpDocument(oracle),currentRefDoc=new candidate.HwpDocument(oracle);
try{
const before=snapshot(oldDoc),after=snapshot(doc),reference=snapshot(refDoc),currentReference=snapshot(currentRefDoc);
await check('independent frame delta is 90 y fields, disjoint from repaired target cell',()=>{
 const delta=differences(before.layout,after.layout,.2);assert.equal(delta.length,90);assert.ok(delta.every(d=>d.path.endsWith('["y"]')));
 const targets=s=>s.layout.flatMap(p=>p.text.runs.filter(r=>r.parentParaIdx===100&&r.cellIdx===2&&r.paraIdx===0));assert.deepEqual(targets(before),targets(after));observations.push({delta});
});
await check('three known table origins match independent saved Hancom geometry',()=>{
 const tables=s=>s.layout[0].controls.controls.filter(c=>c.type==='table');
 const old=tables(before),current=tables(after),oracle=tables(reference);
 for(const [para,y] of [[0,409.1],[2,503.9],[4,864.2]]){
  const actual=current.find(t=>t.paraIdx===para&&Math.abs(t.y-y)<=.2);const expected=oracle.find(t=>t.paraIdx===para&&Math.abs(t.y-y)<=.2);assert.ok(actual&&expected,JSON.stringify({para,y}));assert.ok(old.every(t=>t.paraIdx!==para||Math.abs(t.y-y)>.2));
 }
 const a=compareSnapshots(before,reference),b=compareSnapshots(after,reference);assert.equal(a.geometry.count,680);assert.equal(b.geometry.count,590);assert.equal(before.pages,3);assert.equal(after.pages,3);observations.push({referenceEngine:baseline.metadata.sourceId,remainingGeometryWithFixedReference:b.geometry.count,pages:after.pages});
});
await check('Native reference empty-trailing correction is independently bounded to 92 y fields',()=>{
 const delta=differences(reference.layout,currentReference.layout,.2);
 assert.equal(delta.length,92);assert.ok(delta.every(d=>d.path.endsWith('["y"]')&&Math.abs(d.delta+8.8)<=.2));
 assert.equal(reference.pages,currentReference.pages);
 const oldComparison=compareSnapshots(before,currentReference),currentComparison=compareSnapshots(after,currentReference);
 assert.equal(oldComparison.geometry.count,588);assert.equal(currentComparison.geometry.count,498);
 observations.push({nativeReferenceDelta:delta,remainingGeometryWithCurrentReference:498,currentReferenceEngine:candidate.metadata.sourceId});
});
for(const format of ['hwp','hwpx'])await check('unchanged full storage guard and real disk reopen '+format,async()=>{
 const artifact=doc[format==='hwp'?'exportHwpWithReport':'exportHwpxWithReport']();try{
  const bytes=artifact.takeBytes(),loss=JSON.parse(artifact.contentLoss());assert.equal(loss.count,0);assert.equal(verifyPreservedExport(doc,bytes,format,loss,b=>new candidate.HwpDocument(b)).status,'checked');
  const path=resolve(out,'python-frame.'+format);await writeFile(path,bytes);const disk=await readFile(path);assert.equal(hash(disk),hash(bytes));const reopened=new candidate.HwpDocument(disk);try{assert.equal(compareSnapshots(after,snapshot(reopened)).status,'SAME_WITHIN_PUBLISHED_CONTRACT');}finally{reopened.free();}
 }finally{artifact.free();}
});
await check('original source and oracle bytes immutable',async()=>{assert.equal(hash(await readFile(process.env.JUEONY_TEST_SOURCE)),hash(source));assert.equal(hash(await readFile(process.env.JUEONY_TEST_ORACLE)),hash(oracle));});
}finally{oldDoc.free();doc.free();refDoc.free();currentRefDoc.free();}
assert.equal(results.length,6);assert.deepEqual(await fingerprints(),guardsBefore);const report={guardFingerprints:guardsBefore,sourceHashes:guardsBefore,scope:'Exact source-owned column frame and positive outer-bottom margin; original saved reference uses fixed baseline110. The current Native reference correction is independently checked as exactly 92 y fields (-8.8px) with full comparisons and unchanged full storage guard. No Hancom UI/COM invocation or complete parity claim.',engine:candidate.metadata,baseline:baseline.metadata,verifierSha256:hash(await readFile(new URL(import.meta.url))),sourceSha256:hash(source),oracleSha256:hash(oracle),results,failures,observations};await writeFile(resolve(out,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({total:results.length,failures}));if(failures.length)process.exitCode=1;
