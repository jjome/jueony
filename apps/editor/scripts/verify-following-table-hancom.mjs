import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {loadReviewEngine,snapshot,compareSnapshots,hash,writeJSON,absolutePath} from './lib/hancom-review.mjs';
import {verifyPreservedExport} from '../src/adapters/rhwp/preservation.ts';
const engine=await loadReviewEngine(process.env.JUEONY_ENGINE_PACKAGE),fixtures=absolutePath(process.env.JUEONY_HANCOM_INPUT,'fixtures'),out=absolutePath(process.env.JUEONY_TEST_OUTPUT,'output');await mkdir(out,{recursive:true});const results=[],failures=[],observations=[];
for(const format of ['hwp','hwpx']){
 const proof=JSON.parse(await readFile(join(fixtures,'results/actual-hancom-'+format+'-compact.json'),'utf8'));
 const before=await readFile(join(fixtures,'artifacts/auto-zero.'+format)),after=await readFile(join(fixtures,'artifacts/auto-zero-hancom.'+format));
 assert.equal(hash(before),proof.inputSha256);assert.equal(hash(after),proof.outputSha256);
 const d=new engine.HwpDocument(before),golden=new engine.HwpDocument(after);
 try{
  const controls=JSON.parse(d.getControls()).filter(c=>c.list===0&&c.ctrlId==='tbl');assert.equal(controls.length,3);
  for(const c of controls){const p=JSON.parse(d.getTableProperties(0,c.para,c.controlIndex));assert.equal(p.allowOverlap,false);assert.equal(p.treatAsChar,false);}
  const live=snapshot(d),comparison=compareSnapshots(live,snapshot(golden));assert.equal(comparison.status,'SAME_WITHIN_PUBLISHED_CONTRACT',JSON.stringify(comparison));
  results.push(format+': three whole non-overlapping tables match actual Hancom SaveAs, every semantic and published geometry field');
  for(let round=0;round<2;round++){
   const artifact=d[format==='hwp'?'exportHwpWithReport':'exportHwpxWithReport']();try{const bytes=artifact.takeBytes();verifyPreservedExport(d,bytes,format,artifact.contentLoss(),b=>new engine.HwpDocument(b));const r=new engine.HwpDocument(bytes);try{assert.equal(compareSnapshots(live,snapshot(r)).status,'SAME_WITHIN_PUBLISHED_CONTRACT');}finally{r.free();}}finally{artifact.free();}
  }
  observations.push({format,sourceSha256:hash(before),actualHancomSha256:hash(after),tables:3,allowOverlap:false,pages:comparison.pages,semanticDifferences:comparison.semantic.count,fullGeometryDifferences:comparison.geometry.count,geometryTolerance:comparison.geometry.tolerance,readIssues:comparison.semantic.readIssues,actualUiEvidence:proof.actualUiScreenshots,repeatSaves:2});
  console.log('PASS',results.at(-1));
 }catch(e){failures.push({format,error:String(e),stack:e.stack});console.error('FAIL',format,e.message);}finally{d.free();golden.free();}
}
await writeJSON(join(out,'result.json'),{task:'G071',results,failures,observations,engine:engine.metadata,verifierSha256:hash(await readFile(new URL(import.meta.url))),scope:'Whole non-overlapping adjacent body tables only; actual Hancom2024 SaveAs files and screenshots were previously generated through visible UI. This rechecks those independently produced bytes with the formal65 engine. No fresh native UI run, pixel/print equivalence, overlap support or complex-document completion is claimed.'});if(failures.length)process.exitCode=1;
