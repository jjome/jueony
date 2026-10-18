// Actual complete saves are required. A protection refusal is a failed case.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,isAbsolute,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadReviewEngine,snapshot,compareSnapshots,hash} from './lib/hancom-review.mjs';
import {verifyPreservedExport} from '../src/adapters/rhwp/preservation.ts';
for(const key of ['JUEONY_ENGINE_PACKAGE','JUEONY_BASELINE_ENGINE_PACKAGE','JUEONY_TEST_SOURCE','JUEONY_TEST_ORACLE','JUEONY_TEST_OUTPUT'])assert.ok(isAbsolute(process.env[key]??''),key+' absolute required');
const engine=await loadReviewEngine(process.env.JUEONY_ENGINE_PACKAGE),baseline=await loadReviewEngine(process.env.JUEONY_BASELINE_ENGINE_PACKAGE);
assert.equal(baseline.metadata.sourceId,'fc150ef856868d03');
assert.equal(baseline.metadata.wasmSha256,'569268eb2fed77851e7449cf19e37dadbee629f68a12f642bb76b49de06369bc');
const app=resolve(fileURLToPath(new URL('..',import.meta.url))),out=resolve(process.env.JUEONY_TEST_OUTPUT);
await mkdir(out,{recursive:true});
const source=await readFile(process.env.JUEONY_TEST_SOURCE),oracle=await readFile(process.env.JUEONY_TEST_ORACLE);
assert.equal(hash(source),'c11c90b48eb8b709cdeb91f5a2c7ecae1b89d0d1390dfc1db32865b902d0dd0f');
assert.equal(hash(oracle),'51e89075e288e36511df470ffc0fc63fa5ec38df350e606ff623b5e965704d52');
const guardPaths=['src/adapters/rhwp/preservation.ts','src/adapters/rhwp/document-save-layout.ts','src/adapters/rhwp/overlap-save-layout.ts'];
const fingerprints=()=>Promise.all(guardPaths.map(async path=>({path,sha256:hash(await readFile(join(app,path)))})));
const sourceHashes=await fingerprints(),results=[],failures=[],observations=[];
function same(a,b){const r=compareSnapshots(a,b);assert.equal(r.status,'SAME_WITHIN_PUBLISHED_CONTRACT',JSON.stringify({pages:r.pages,semantic:r.semantic.count,geometry:r.geometry.count,first:r.geometry.differences.slice(0,4),readIssues:r.semantic.readIssues}));}
async function saved(doc,format,name){
 const before=snapshot(doc),text=doc.getTextFileUnicode(),artifact=doc[format==='hwp'?'exportHwpWithReport':'exportHwpxWithReport']();
 try{
  const bytes=artifact.takeBytes(),loss=JSON.parse(artifact.contentLoss());assert.equal(loss.count,0);assert.equal(loss.outputFormat,format);
  assert.equal(verifyPreservedExport(doc,bytes,format,loss,b=>new engine.HwpDocument(b)).status,'checked','refusal is not successful storage');
  const path=join(out,name+'.'+format);await writeFile(path,bytes,{flag:'wx'});const disk=await readFile(path);assert.equal(hash(disk),hash(bytes));
  const reopened=new engine.HwpDocument(disk);try{same(before,snapshot(reopened));assert.equal(reopened.getTextFileUnicode(),text);}finally{reopened.free();}
  assert.deepEqual(snapshot(doc),before,'export preserves live state');
  return{bytes:disk,record:{format,sha256:hash(disk),bytes:disk.length,guard:'checked',losses:0,geometry:0,semantic:0}};
 }finally{artifact.free();}
}
function edit(doc,mode){
 if(mode==='original')return;
 const cell=mode.startsWith('cell'),retained=mode.endsWith('retained');
 const before=cell?doc.getCellParagraphLength(0,100,0,0,0):doc.getParagraphLength(0,60);
 if(cell)doc.insertTextInCell(0,100,0,0,0,0,'가');else doc.insertText(0,60,0,'가');
 assert.equal(cell?doc.getCellParagraphLength(0,100,0,0,0):doc.getParagraphLength(0,60),before+1);
 if(!retained){if(cell)doc.deleteTextInCell(0,100,0,0,0,0,1);else doc.deleteText(0,60,0,1);assert.equal(cell?doc.getCellParagraphLength(0,100,0,0,0):doc.getParagraphLength(0,60),before);}
}
// The clean original references stay fixed to official113; no initial geometry
// differences may be hidden by comparing only after the first export/reopen.
for(const[name,bytes]of[['native',oracle],['independent-xml',source]]){
 const a=new baseline.HwpDocument(bytes),b=new engine.HwpDocument(bytes);
 try{same(snapshot(a),snapshot(b));observations.push({name:name+' initial full baseline',status:'PASS'});}finally{a.free();b.free();}
}
const seed=new engine.HwpDocument(oracle);let xmlSeed;
try{const r=await saved(seed,'hwpx','clean-native-seed');xmlSeed=r.bytes;observations.push({name:'actual clean Native HWPX seed',...r.record});}finally{seed.free();}
async function report(){await writeFile(join(out,'result.json'),JSON.stringify({engine:engine.metadata,baseline:baseline.metadata,sourceHashes,verifierSha256:hash(await readFile(new URL(import.meta.url))),sourceSha256:hash(source),oracleSha256:hash(oracle),results,failures,observations,passed:results.filter(r=>r.status==='PASS').length,scope:'30 actual storage cases: Native, its generated HWPX and independent original HWPX; five edit modes and both formats. Each case requires three disk reopen cycles, a retained edit on that reopened instance, both output formats and both instance-local undo/redo. All original semantics/layout/text and full production guards remain strict. No Hancom GUI, user document writes or real LLM.'},null,2));}
for(const[input,bytes]of[['native',oracle],['regenerated-xml',xmlSeed],['independent-xml',source]])for(const mode of['original','body-reversible','cell-reversible','body-retained','cell-retained'])for(const format of['hwp','hwpx']){
 const name=input+'-'+mode+'-'+format,doc=new engine.HwpDocument(bytes),row={name,input,mode,format,status:'FAIL',exports:[]};let current=doc,undo,redo,before,live;
 try{
  before=snapshot(doc);undo=doc.saveSnapshot();edit(doc,mode);live=snapshot(doc);redo=doc.saveSnapshot();
  if(mode==='original'||mode.endsWith('reversible'))same(before,live);
  for(let cycle=1;cycle<=3;cycle++){
   const r=await saved(current,format,name+'-cycle'+cycle),next=new engine.HwpDocument(r.bytes);
   try{same(live,snapshot(next));}catch(e){next.free();throw e;}
   if(current!==doc)current.free();current=next;row.exports.push({stage:'cycle'+cycle,...r.record});
  }
  const followBefore=snapshot(current),followUndo=current.saveSnapshot();edit(current,mode.startsWith('cell')?'body-retained':'cell-retained');
  const followAfter=snapshot(current),followRedo=current.saveSnapshot();assert.notEqual(current.getTextFileUnicode(),doc.getTextFileUnicode());
  for(const output of['hwp','hwpx']){const r=await saved(current,output,name+'-followup');row.exports.push({stage:'reopened-followup',...r.record});}
  current.restoreSnapshot(followUndo);same(followBefore,snapshot(current));current.restoreSnapshot(followRedo);same(followAfter,snapshot(current));row.followupHistory='PASS';row.status='PASS';
 }catch(error){row.error=String(error);row.productionIssues=error.report?.issues;row.unexecutedExports=5-row.exports.length;failures.push({name,error:String(error)});}
 finally{
  if(undo!==undefined&&redo!==undefined){try{doc.restoreSnapshot(undo);same(before,snapshot(doc));doc.restoreSnapshot(redo);same(live,snapshot(doc));row.originalHistory='PASS';}catch(error){row.originalHistory='FAIL';row.status='FAIL';failures.push({name,error:String(error)});}}
  if(current!==doc)current.free();doc.free();
 }
 results.push(row);console.log(row.status,name,row.exports.length,row.error??'');await report();
}
assert.equal(hash(await readFile(process.env.JUEONY_TEST_SOURCE)),hash(source));assert.equal(hash(await readFile(process.env.JUEONY_TEST_ORACLE)),hash(oracle));assert.deepEqual(await fingerprints(),sourceHashes);
observations.push({name:'original files and strict guard source unchanged',status:'PASS'});await report();assert.equal(results.length,30);if(failures.length)process.exitCode=1;
