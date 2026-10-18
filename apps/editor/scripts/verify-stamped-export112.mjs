// Own documents only. Exact typed metadata intent, immutable live source,
// one-shot WASM artifacts and actual disk readback/reopen on all four paths.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,isAbsolute} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {capturePreservationEvidence,verifyPreservedExport} from '../src/adapters/rhwp/preservation.ts';
const sha=b=>createHash('sha256').update(b).digest('hex');
for(const key of ['JUEONY_ENGINE_PACKAGE','JUEONY_TEST_OUTPUT'])assert.ok(isAbsolute(process.env[key]??''),key+' absolute path');
const pkg=resolve(process.env.JUEONY_ENGINE_PACKAGE),out=resolve(process.env.JUEONY_TEST_OUTPUT);
await mkdir(out,{recursive:true});
const wasm=await readFile(resolve(pkg,'rhwp_bg.wasm')),js=await readFile(resolve(pkg,'rhwp.js'));
const engine=JSON.parse(await readFile(resolve(pkg,'jueony-engine-build.json')));
assert.equal(sha(wasm),engine.wasmSha256);assert.equal(sha(js),engine.jsSha256);
const {default:init,HwpDocument}=await import(pathToFileURL(resolve(pkg,'rhwp.js')));
await init({module_or_path:wasm});
const parse=JSON.parse,stored=d=>parse(d.getDocumentStoredInformation()),edit=d=>parse(d.getDocumentStoredInformationEditState());
const values={modified:'133536420007654321',editingDuration:'123456789012345'};
const request=JSON.stringify({schemaVersion:1,values}),password='Own stamped112 password';
function snapshot(d){return{information:stored(d),state:edit(d),evidence:capturePreservationEvidence(d),text:d.getTextFileUnicode(),layout:Array.from({length:d.pageCount()},(_,p)=>({text:parse(d.getPageTextLayout(p)),controls:parse(d.getPageControlLayout(p))}))};}
const blank=HwpDocument.createEmpty();blank.createBlankDocument();blank.insertText(0,0,0,'Own stamped export source. 한글과 UTF-16 경계 🧭');
const inputs={hwp:blank.exportHwp(),hwpx:blank.exportHwpx()};blank.free();
const results=[],failures=[],observations=[];
async function run(name,action){try{const detail=await action();results.push({name,status:'PASS',detail});console.log('PASS',name);}catch(error){results.push({name,status:'FAIL'});failures.push({name,error:String(error),stack:error.stack});console.log('FAIL',name,String(error));}}
for(const initial of ['hwp','hwpx'])for(const format of ['hwp','hwpx'])for(const encrypted of [false,true])await run(`${initial} source / ${format} output / ${encrypted?'password':'plain'}`,async()=>{
 const d=new HwpDocument(inputs[initial]),expected=new HwpDocument(inputs[initial]);let artifact,reopened;
 try{
  const before=snapshot(d),state=edit(d),preview=parse(d.previewDocumentStoredInformation(state.fingerprint,request));
  const expectedResult=parse(expected.setDocumentStoredInformation(edit(expected).fingerprint,request));
  assert.deepEqual(expectedResult.information,preview.information);
  artifact=encrypted?d.exportStampedDocumentWithPasswordAndReport(format,state.fingerprint,request,new TextEncoder().encode(password)):d.exportStampedDocumentWithReport(format,state.fingerprint,request);
  const intent=parse(artifact.metadataIntent()),loss=parse(artifact.contentLoss());
  assert.deepEqual(Object.keys(intent).sort(),['schemaVersion','originalFingerprint','stampedFingerprint','changed','requestedValues','before','after'].sort());
  assert.equal(intent.schemaVersion,1);assert.equal(intent.originalFingerprint,state.fingerprint);assert.equal(intent.stampedFingerprint,edit(expected).fingerprint);
  assert.equal(intent.changed,true);assert.deepEqual(intent.requestedValues,values);assert.deepEqual(intent.before,before.information);assert.deepEqual(intent.after,preview.information);
  assert.equal(loss.count,0,JSON.stringify(loss));assert.equal(artifact.hasBytes(),true);
  const bytes=artifact.takeBytes();assert.equal(artifact.hasBytes(),false);assert.throws(()=>artifact.takeBytes());assert.deepEqual(parse(artifact.metadataIntent()),intent);
  assert.deepEqual(snapshot(d),before,'source/history queries changed during export');
  assert.equal(verifyPreservedExport(expected,bytes,format,loss,b=>encrypted?HwpDocument.openWithPassword(b,password):new HwpDocument(b)).status,'checked');
  const name=`own-${initial}-to-${format}-${encrypted?'password':'plain'}.${format}`;
  await writeFile(resolve(out,name),bytes);const disk=await readFile(resolve(out,name));assert.deepEqual(disk,Buffer.from(bytes));
  reopened=encrypted?HwpDocument.openWithPassword(disk,password):new HwpDocument(disk);
  const actual=stored(reopened);for(const key of ['created','modified','lastPrinted','editingDuration','issues'])assert.deepEqual(actual[key],intent.after[key],key);
  assert.deepEqual(snapshot(d),before);observations.push({name,sha256:sha(disk),bytes:disk.length,exactDiskReadback:true,originalUnchanged:true,allStoredFieldsCompared:true,intent});
  return{diskReadback:true,oneShot:true,mandatoryFullPreservationGuard:'checked'};
 }finally{reopened?.free();artifact?.free();expected.free();d.free();}
});
await run('Stale fingerprint never mutates source or issues an artifact',()=>{const d=new HwpDocument(inputs.hwp);try{const old=edit(d).fingerprint;d.setDocumentStoredInformation(old,request);const before=snapshot(d);assert.throws(()=>d.exportStampedDocumentWithReport('hwp',old,request));assert.deepEqual(snapshot(d),before);}finally{d.free();}});
await run('Malformed duplicate intent and invalid format retain exact source',()=>{const d=new HwpDocument(inputs.hwpx);try{const before=snapshot(d);for(const source of ['{}','{"schemaVersion":1,"values":{"modified":"1","modified":"2"}}','{"schemaVersion":1,"values":{"modified":"-1"}}'])assert.throws(()=>d.exportStampedDocumentWithReport('hwpx',edit(d).fingerprint,source));assert.throws(()=>d.exportStampedDocumentWithReport('txt',edit(d).fingerprint,request));assert.deepEqual(snapshot(d),before);}finally{d.free();}});
await run('No-op typed intent is truthful and preserves exact fingerprint',()=>{const d=new HwpDocument(inputs.hwp);let artifact;try{d.setDocumentStoredInformation(edit(d).fingerprint,request);const before=snapshot(d);artifact=d.exportStampedDocumentWithReport('hwp',edit(d).fingerprint,request);const intent=parse(artifact.metadataIntent());assert.equal(intent.changed,false);assert.equal(intent.originalFingerprint,intent.stampedFingerprint);assert.deepEqual(intent.before,intent.after);assert.deepEqual(snapshot(d),before);assert.equal(parse(artifact.contentLoss()).count,0);}finally{artifact?.free();d.free();}});
await run('Ordinary output stays original after discarded stamped artifact',()=>{const d=new HwpDocument(inputs.hwp);let artifact;try{const before=snapshot(d);artifact=d.exportStampedDocumentWithReport('hwpx',edit(d).fingerprint,request);artifact.free();artifact=undefined;for(const format of ['hwp','hwpx']){const a=d[format==='hwp'?'exportHwpWithReport':'exportHwpxWithReport']();try{assert.equal(verifyPreservedExport(d,a.takeBytes(),format,parse(a.contentLoss()),b=>new HwpDocument(b)).status,'checked');}finally{a.free();}}assert.deepEqual(snapshot(d),before);}finally{artifact?.free();d.free();}});
assert.equal(results.length,12);
const report={schemaVersion:1,engine,verifierSha256:sha(await readFile(fileURLToPath(import.meta.url))),scope:'Actual opaque stamped WASM API; own Native/XML inputs; all four plain/password report paths; exact source and all stored fields; mandatory preservation guard; actual disk readback. No automatic save acknowledgement, active-time ledger, GUI or Hancom equivalence claim.',results,observations,failures,passed:results.filter(r=>r.status==='PASS').length,total:results.length};
await writeFile(resolve(out,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,total:report.total,failures}));if(failures.length)process.exitCode=1;
