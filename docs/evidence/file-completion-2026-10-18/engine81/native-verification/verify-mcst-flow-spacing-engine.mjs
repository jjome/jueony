import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,isAbsolute,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadReviewEngine,snapshot,compareSnapshots,hash} from './lib/hancom-review.mjs';
import {verifyPreservedExport} from '../src/adapters/rhwp/preservation.ts';

for(const k of ['JUEONY_ENGINE_PACKAGE','JUEONY_REPOSITORY','JUEONY_TEST_OUTPUT'])assert.ok(isAbsolute(process.env[k]??''),`${k} requires an absolute path`);
const root=resolve(process.env.JUEONY_REPOSITORY),out=resolve(process.env.JUEONY_TEST_OUTPUT);
await mkdir(out,{recursive:true});
const engine=await loadReviewEngine(process.env.JUEONY_ENGINE_PACKAGE),{HwpDocument}=engine;
const owned=join(root,'build/file-closure75-public-readonly');
const original=join(root,'build/hancom-final-file-review-20261017');
const results=[],failures=[],observations=[];
const j=x=>typeof x==='string'?JSON.parse(x):x;
async function scenario(name,run){try{await run();results.push(name);console.log('PASS',name);}catch(error){failures.push({name,error:String(error),stack:error.stack});console.error('FAIL',name,error.message);}}
function same(before,after){const d=compareSnapshots(before,after);assert.equal(d.status,'SAME_WITHIN_PUBLISHED_CONTRACT',JSON.stringify({semantic:d.semantic.count,geometry:d.geometry.count,first:d.geometry.differences.slice(0,4),issues:d.semantic.readIssues}));return{pages:d.pages,geometryDifferences:d.geometry.count,semanticDifferences:d.semantic.count};}
async function cycles(source,format,label,persist=true){
 const before=snapshot(source),values=JSON.stringify(before.semantic.values),items=[];let current=source;
 try{for(let index=1;index<=2;index++){
  const report=format==='hwpx'?current.exportHwpxWithReport():current.exportHwpWithReport();let reopened;
  try{const bytes=report.takeBytes(),loss=j(report.contentLoss());
   // Supply the unchanged native loss object to the actual production guard.
   const checked=verifyPreservedExport(current,bytes,format,loss,b=>new HwpDocument(b));
   assert.ok(checked);assert.equal(JSON.stringify(snapshot(source).semantic.values),values,'export mutated live semantics');
   reopened=new HwpDocument(bytes);const comparison=same(before,snapshot(reopened));same(before,snapshot(source));
   const artifact=persist?`${label}-${index}.${format}`:null;if(artifact)await writeFile(join(out,artifact),bytes);
   items.push({index,format,artifact,sha256:hash(bytes),...comparison,preservation:checked,loss});
   if(current!==source)current.free();current=reopened;reopened=undefined;
  }finally{reopened?.free();report.free();}
 }}finally{if(current!==source)current.free();}
 return items;
}
const actualPath=join(original,'mcst-bid-2026-hwpx-hancom.hwpx'),actualBytes=await readFile(actualPath);
assert.equal(hash(actualBytes),'20a3960b4315626c3f97d9c5d47746e3cfadd8fe50dde43a4a424aa3a2a76936','actual Hancom oracle is immutable');
await scenario('actual Hancom sixteen pages, retained p55/p56 physical boundary and strict HWPX two reopens',async()=>{
 const d=new HwpDocument(actualBytes);try{const s=snapshot(d);assert.equal(s.pages,16,'independent Hancom status screenshot oracle');
  const positions=s.layout.flatMap(p=>j(p.text).runs.filter(r=>[55,56,57].includes(r.paraIdx)&&r.parentParaIdx===undefined).map(r=>({displayPage:p.page+1,paragraph:r.paraIdx,charStart:r.charStart,y:r.y})));
  assert.ok(positions.some(p=>p.paragraph===55&&p.displayPage===5&&Math.abs(p.y-954)<0.2));
  assert.ok(positions.some(p=>p.paragraph===56&&p.displayPage===6&&Math.abs(p.y-117.4)<0.2));
  observations.push({kind:'supported-actual-hwpx',inputSHA:hash(actualBytes),positions,cycles:await cycles(d,'hwpx','actual',false)});
 }finally{d.free();}
});
await scenario('real API edit, snapshot undo redo and strict HWPX two reopens',async()=>{
 const d=new HwpDocument(actualBytes);try{const before=snapshot(d),undo=d.saveSnapshot();d.insertText(0,55,d.getParagraphLength(0,55),' CHECK');const edited=snapshot(d),redo=d.saveSnapshot();d.restoreSnapshot(undo);same(before,snapshot(d));d.restoreSnapshot(redo);same(edited,snapshot(d));observations.push({kind:'real-edit-history',cycles:await cycles(d,'hwpx','history',false)});}finally{d.free();}
});
const oracle=j(await readFile(join(owned,'independent-oracle68.json'),'utf8'));
for(const name of ['two','three','offset','plain','unicode','superscript','negative','column2','multiline-prepared','caption-prepared','positive-prepared'])await scenario(`actual ${name}: immutable source pair, every layout field and both formats twice`,async()=>{
 const file=name+'.hwp',sourcePath=join(owned,['negative','column2'].includes(name)?'support/'+file:name.endsWith('-prepared')?file.replace('-prepared.','-original-prepared.'):'final-inputs/'+file);
 const bytes=await readFile(sourcePath),referenceBytes=await readFile(join(owned,'hancom-current',file)),pin=oracle.observations.find(r=>r.name===file);
 assert.ok(pin);assert.equal(hash(bytes),pin.original.sha256);assert.equal(hash(referenceBytes),pin.hancom.sha256);
 const d=new HwpDocument(bytes),reference=new HwpDocument(referenceBytes);try{const current=snapshot(reference),frozen=structuredClone(current);frozen.layout=pin.afterLayout.map(({controls,runs},page)=>({page,controls:{controls},text:{runs}}));same(frozen,current);same(snapshot(d),current);const exports=[];for(const [label,doc]of[['source',d],['hancom',reference]])for(const format of['hwp','hwpx'])exports.push(...await cycles(doc,format,name+'-'+label));observations.push({kind:'actual-owned-control',name,sourceSHA:hash(bytes),hancomSHA:hash(referenceBytes),cycles:exports});}finally{d.free();reference.free();}
});
for(const [label,path]of[['actual',actualPath]])await scenario(`${label}: unsupported HWP crossing remains strictly rejected`,async()=>{
 const bytes=await readFile(path),d=new HwpDocument(bytes);let report,reopened;try{const before=snapshot(d);report=d.exportHwpWithReport();const saved=report.takeBytes(),loss=j(report.contentLoss());reopened=new HwpDocument(saved);const delta=compareSnapshots(before,snapshot(reopened));let blocked=false,reason;try{verifyPreservedExport(d,saved,'hwp',loss,b=>new HwpDocument(b));}catch(error){blocked=true;reason=String(error);}
  observations.push({kind:'unsupported-cross-format',label,inputSHA:hash(bytes),outputSHA:hash(saved),pages:delta.pages,geometryDifferences:delta.geometry.count,semanticDifferences:delta.semantic.count,blocked,reason,loss});assert.ok(delta.geometry.count>0,'do not waive real HWP geometry loss');assert.ok(blocked,'production guard must reject actual cross-format damage');same(before,snapshot(d));
 }finally{reopened?.free();report?.free();d.free();}
});
await scenario('historical-converted: explicit native HWP5 lineage survives both formats twice',async()=>{
 const path=join(original,'mcst-bid-2026-hwpx.hwpx'),bytes=await readFile(path);
 assert.equal(hash(bytes),'cef8a3b80d6732be5f850c28923b27a09e2f0ff9df9a2835bc3b84c512266452');
 const d=new HwpDocument(bytes);try{
  const before=snapshot(d),exports=[];assert.equal(before.pages,15);
  for(const format of['hwp','hwpx'])exports.push(...await cycles(d,format,'historical-native-lineage',false));
  same(before,snapshot(d));assert.equal(hash(await readFile(path)),hash(bytes));
  observations.push({kind:'supported-historical-lineage',inputSHA:hash(bytes),cycles:exports});
 }finally{d.free();}
});
await writeFile(join(out,'result.json'),JSON.stringify({engine:engine.metadata,verifierSha256:hash(await readFile(fileURLToPath(import.meta.url))),results,failures,observations,pageErrors:[],consoleErrors:[],externalRequests:[],scope:{supportedScenarios:14,guardedUnsupportedScenarios:1,fullGeometryReopens:96,geometryTolerance:0.2,allPublicFields:true,metadata5Unchanged:true},limitation:'This does not close N002 as a whole. Actual Hancom physical 16-page evidence and HWPX own strict preservation are supported. The actual-Hancom MCST HWP crossing and historical converted-vs-Hancom full-document differences remain open. Historical lineage preservation is a same-engine round-trip, not a claim that its fifteen pages equal the actual Hancom sixteen-page file.'},null,2));
if(failures.length)process.exitCode=1;
