import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {assertOverlapSaveLayout,OverlapSaveLayoutError} from '../src/adapters/rhwp/overlap-save-layout.ts';
import {capturePreservationEvidence,verifyPreservedExport} from '../src/adapters/rhwp/preservation.ts';
import {makeOverlapVisibleFixture} from './verify-overlap-visible-fixture.mjs';
import {withoutHwp5OriginMarker} from './verify-hwp5-origin-fixture.mjs';
for(const key of ['JUEONY_ENGINE_PACKAGE','JUEONY_OVERLAP_BASELINE_PACKAGE','JUEONY_TEST_OUTPUT'])assert.ok(isAbsolute(process.env[key]??''),key+' must be absolute');
const pkg=resolve(process.env.JUEONY_ENGINE_PACKAGE),baseline=resolve(process.env.JUEONY_OVERLAP_BASELINE_PACKAGE),out=resolve(process.env.JUEONY_TEST_OUTPUT),sha=b=>createHash('sha256').update(b).digest('hex');await mkdir(out,{recursive:true});
async function load(path){const metadata=JSON.parse(await readFile(path+'/jueony-engine-build.json','utf8'));for(const [file,key]of [['rhwp_bg.wasm','wasmSha256'],['rhwp.js','jsSha256']])assert.equal(sha(await readFile(path+'/'+file)),metadata[key]);const module=await import(pathToFileURL(path+'/rhwp.js'));await module.default({module_or_path:await readFile(path+'/rhwp_bg.wasm')});return {module,metadata};}
const {module:m,metadata:engine}=await load(pkg),{module:base,metadata:baselineEngine}=await load(baseline),results=[],failures=[],observations=[];
const layout=d=>Array.from({length:d.pageCount()},(_,page)=>({controls:JSON.parse(d.getPageControlLayout(page)).controls,runs:JSON.parse(d.getPageTextLayout(page)).runs}));
const info=d=>JSON.parse(d.getDocumentInfo());
function artifact(d,format){const a=format==='hwp'?d.exportHwpWithReport():d.exportHwpxWithReport();try{return {bytes:a.takeBytes(),loss:JSON.parse(a.contentLoss())};}finally{a.free();}}
async function scenario(name,run){try{await run();results.push(name);console.log('PASS',name);}catch(error){failures.push({name,error:String(error),stack:error.stack,...(error.report?{report:error.report}:{})});console.error('FAIL',name,error.message);}}
await scenario('query exposes exact false for ordinary HWPX and HWP, true only for HWP5-origin HWPX',()=>{
 const blank=m.HwpDocument.createEmpty();let ordinary,native,marked;
 try{blank.createBlankDocument();ordinary=new m.HwpDocument(withoutHwp5OriginMarker(blank.exportHwpx()));native=new m.HwpDocument(makeOverlapVisibleFixture(base.HwpDocument,'plain'));marked=new m.HwpDocument(native.exportHwpx());
  assert.equal(info(ordinary).hwp5OriginHwpx,false);assert.equal(info(native).hwp5OriginHwpx,false);assert.equal(info(marked).hwp5OriginHwpx,true);assert.equal(info(marked).hwp3Variant,false);
  assert.equal(assertOverlapSaveLayout(ordinary,ordinary.exportHwpx(),'hwpx',bytes=>new m.HwpDocument(bytes)).status,'not-applicable');
  observations.push({query:{ordinary:info(ordinary),native:info(native),marked:info(marked)}});
 }finally{blank.free();ordinary?.free();native?.free();marked?.free();}
});
for(const mode of ['plain','multiline','caption','mixed'])for(const sourceFormat of ['hwp','hwpx'])for(const outputFormat of ['hwp','hwpx'])await scenario(mode+' '+sourceFormat+' -> '+outputFormat+': full-layout guard and semantic export keep live state unchanged',async()=>{
 const seed=new m.HwpDocument(makeOverlapVisibleFixture(base.HwpDocument,mode));let d;
 try{
  seed.setCellProperties(0,1,0,0,'{"paddingBottom":1134,"applyInnerMargin":true}');d=sourceFormat==='hwp'?seed:new m.HwpDocument(seed.exportHwpx());
  if(sourceFormat==='hwpx')assert.equal(info(d).hwp5OriginHwpx,true);
  const before=layout(d),values=capturePreservationEvidence(d).values,current=artifact(d,sourceFormat),a=artifact(d,outputFormat);let writes=0;
  assert.equal(assertOverlapSaveLayout(d,a.bytes,outputFormat,bytes=>new m.HwpDocument(bytes)).status,'checked');
  const strict=verifyPreservedExport(d,a.bytes,outputFormat,a.loss,bytes=>new m.HwpDocument(bytes));assert.ok(strict.checked.includes('native-hwp-overlapping-table-layout'));
  await writeFile(out+'/'+mode+'-'+sourceFormat+'-to-'+outputFormat+'.'+outputFormat,a.bytes);writes++;
  assert.deepEqual(layout(d),before);assert.deepEqual(capturePreservationEvidence(d).values,values);assert.deepEqual(artifact(d,sourceFormat).bytes,current.bytes);assert.equal(d.canvasMetricsActive(),false);
  observations.push({mode,sourceFormat,outputFormat,writes,sha256:sha(a.bytes),provenance:info(d)});
 }finally{if(d&&d!==seed)d.free();seed.free();}
});
await scenario('real HWP to HWPX provenance-corrupted bytes fail only layout and open no writer',async()=>{
 const d=new m.HwpDocument(makeOverlapVisibleFixture(base.HwpDocument,'plain'));let bad;
 try{
  d.setCellProperties(0,1,0,0,'{"paddingBottom":1134,"applyInnerMargin":true}');const before=layout(d),values=capturePreservationEvidence(d).values,original=d.exportHwp(),a=artifact(d,'hwpx'),corrupted=withoutHwp5OriginMarker(a.bytes);bad=new m.HwpDocument(corrupted);
  assert.equal(info(bad).hwp5OriginHwpx,false);assert.deepEqual(capturePreservationEvidence(bad).values,values,'corruption must leave semantic reader values identical');
  let writes=0;assert.throws(()=>{verifyPreservedExport(d,corrupted,'hwpx',a.loss,bytes=>new m.HwpDocument(bytes));writes++;},error=>error.report?.issues.some(issue=>issue.path==='native-hwp-overlapping-table-layout'&&issue.code==='changed'));
  assert.equal(writes,0);assert.deepEqual(layout(d),before);assert.deepEqual(capturePreservationEvidence(d).values,values);assert.deepEqual(d.exportHwp(),original);assert.equal(d.canvasMetricsActive(),false);
  await writeFile(out+'/corrupted-provenance.hwpx',corrupted);observations.push({mode:'actual-hwp-to-hwpx-corruption',writes,semanticValuesEqual:true,layoutMismatchDetected:true,originalSha256:sha(original),corruptedSha256:sha(corrupted)});
 }finally{bad?.free();d.free();}
});
await writeFile(out+'/result.json',JSON.stringify({results,failures,observations,engine,baselineEngine,verifierSha256:sha(await readFile(new URL(import.meta.url))),guardSha256:sha(await readFile(new URL('../src/adapters/rhwp/overlap-save-layout.ts',import.meta.url))),fixtureSha256:sha(await readFile(new URL('./verify-hwp5-origin-fixture.mjs',import.meta.url))),note:'Real WASM, owned synthetic documents. Full geometry/0.2 and semantic reader unchanged. Native writer counter is complemented by real Edge OPFS open-zero verifier. No Hancom UI claim.'},null,2));if(failures.length)process.exitCode=1;
