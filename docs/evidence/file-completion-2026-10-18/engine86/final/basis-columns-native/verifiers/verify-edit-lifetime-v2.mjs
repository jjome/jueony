import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,isAbsolute,join} from 'node:path';
import {loadReviewEngine,snapshot,compareSnapshots,hash} from '../../apps/editor/scripts/lib/hancom-review.mjs';
import {verifyPreservedExport,PreservationError} from '../../apps/editor/src/adapters/rhwp/preservation.ts';
for(const name of ['JUEONY_ENGINE_PACKAGE','JUEONY_REPOSITORY','JUEONY_TEST_OUTPUT'])assert.ok(isAbsolute(process.env[name]??''),name+' must be absolute');
const root=resolve(process.env.JUEONY_REPOSITORY),out=resolve(process.env.JUEONY_TEST_OUTPUT);await mkdir(out,{recursive:true});
const e=await loadReviewEngine(process.env.JUEONY_ENGINE_PACKAGE),j=x=>typeof x==='string'?JSON.parse(x):x;
const specs={actual:['mcst-bid-2026-hwpx-hancom.hwpx','20a3960b4315626c3f97d9c5d47746e3cfadd8fe50dde43a4a424aa3a2a76936'],native:['source-mcst-bid-2026.hwp','c61a13b249183a675d38d5badfa3af610edcf99a403622440fc81b7f52b348f2']};
const originals={};for(const[name,[file,pin]]of Object.entries(specs)){const path=join(root,'build/hancom-final-file-review-20261017',file),bytes=await readFile(path);assert.equal(hash(bytes),pin);originals[name]={bytes,path,pin};}
const source=()=>new e.HwpDocument(originals.actual.bytes),results=[];
function same(a,b){const d=compareSnapshots(a,b);assert.equal(d.status,'SAME_WITHIN_PUBLISHED_CONTRACT',JSON.stringify({geometry:d.geometry.count,semantic:d.semantic.count,first:d.geometry.differences.slice(0,3)}));return {pages:d.pages,geometry:d.geometry.count,semantic:d.semantic.count};}
function table(doc){for(let p=0;p<doc.pageCount();p++){const t=j(doc.getPageControlLayout(p)).controls.find(c=>c.secIdx===0&&c.paraIdx===44&&c.controlIdx===0&&c.type==='table');if(t)return{page:p,...t};}throw Error('Pinned source table missing');}
function firstTargetRun(doc){for(let p=0;p<doc.pageCount();p++){const r=j(doc.getPageTextLayout(p)).runs.find(r=>r.secIdx===0&&r.parentParaIdx===44&&r.cellIdx===0&&r.cellParaIdx===0&&r.charStart===0);if(r)return r;}throw Error('Pinned first cell text owner missing');}
function checked(doc,format){const a=format==='hwp'?doc.exportHwpWithReport():doc.exportHwpxWithReport();try{const loss=j(a.contentLoss()),bytes=a.takeBytes(),preservation=verifyPreservedExport(doc,bytes,format,loss,b=>new e.HwpDocument(b));assert.equal(preservation.status,'checked');assert.ok(preservation.checked.includes('whole-document-published-layout'));return{bytes,preservation};}finally{a.free();}}
async function scenario(name,fn){try{results.push({name,status:'PASS',...(await fn())});}catch(error){results.push({name,status:'FAIL',error:String(error),stack:error.stack});}}
await scenario('Pinned physical source table frame survives XML reconstruction',()=>{const n=new e.HwpDocument(originals.native.bytes),x=source();try{const a=table(n),b=table(x);assert.ok(Math.abs(a.y-b.y)<=0.2,JSON.stringify({native:a.y,actualXml:b.y}));const nr=firstTargetRun(n),xr=firstTargetRun(x);assert.equal(hash(nr.text),hash(xr.text));for(const key of ['x','y','w','h','fontSize'])assert.ok(Math.abs(nr[key]-xr[key])<=0.2,key+' physical first-cell text mismatch');assert.equal(nr.fontFamily,xr.fontFamily);return{sourceFirstCellTextY:nr.y,actualFirstCellTextY:xr.y,firstCellTextSHA:hash(nr.text),rawCharShapeIds:{source:nr.charShapeId,actual:xr.charShapeId},sourcePages:n.pageCount(),actualPages:x.pageCount(),sourceY:a.y,actualY:b.y,scope:'This frame only;15-vs16 whole original/actual page discrepancy remains independent.'};}finally{n.free();x.free();}});

const legacySpec={
 path:join(root,'build/file-closure83-native-handoff/mcst-final83-produced.hwp'),
 pin:'910a3629eb187692dc91533792c4d6341c8ab7071e53a147ae55b46e9774637b',
};
legacySpec.bytes=await readFile(legacySpec.path);assert.equal(hash(legacySpec.bytes),legacySpec.pin);

function hwpMustRejectExplicitDirection(doc){
 const before=snapshot(doc),events=doc.getEventLog(),a=doc.exportHwpWithReport();
 let loss,blocked=false,writeCallbacks=0;
 try{
  loss=j(a.contentLoss());assert.equal(loss.count,188,'Pinned actual XML has exactly188 explicit direction resources.');
  assert.equal(loss.losses.length,188);
  const paths=new Set();
  for(const item of loss.losses){
   assert.equal(item.code,'metadataReduced');assert.equal(item.subject,'paragraphProperties');
   assert.equal(item.reason,'serializerNotImplemented');assert.match(item.path,/^docInfo\/paraShape\/\d+\/textDir$/u);
   assert.ok(!paths.has(item.path));paths.add(item.path);
  }
  try{verifyPreservedExport(doc,a.takeBytes(),'hwp',loss,b=>new e.HwpDocument(b));writeCallbacks++;}
  catch(error){assert.ok(error instanceof PreservationError);assert.equal(error.report.status,'blocked');assert.ok(error.report.issues.some(x=>x.code==='content-loss'&&x.path==='serializer-report'));blocked=true;}
 }finally{a.free();}
 assert.ok(blocked,'Known unsupported binary direction must not save successfully');assert.equal(writeCallbacks,0);
 assert.deepEqual(snapshot(doc),before);assert.equal(doc.getEventLog(),events);
 return{status:'blocked-before-write',lossCount:loss.count,lossPaths:loss.losses.map(x=>x.path),writeCallbacks,reason:'Explicit XML LTR metadata has no proven HWP mapping. Successful old83 output is not an oracle for silently discarding it.'};
}
function actualEditAndHistory(d){
 const before=snapshot(d),beforeY=table(d).y,undo=d.saveSnapshot(),para=179,n=d.getParagraphLength(0,para);
 d.insertText(0,para,n,'Z');const edited=snapshot(d),afterY=table(d).y,redo=d.saveSnapshot();
 assert.ok(Math.abs(beforeY-afterY)<=0.2,JSON.stringify({beforeY,afterY}));
 assert.notEqual(JSON.stringify(before.semantic.values),JSON.stringify(edited.semantic.values));
 d.restoreSnapshot(undo);same(before,snapshot(d));d.restoreSnapshot(redo);same(edited,snapshot(d));
 d.discardSnapshot(undo);d.discardSnapshot(redo);
 return{beforeY,afterY,edited,paragraph:para,undo:'exact',redo:'exact'};
}
function repeated(d,formats,expected){
 const stages=[];
 for(const format of formats){let current=d;try{for(let cycle=1;cycle<=2;cycle++){
  const beforeExport=snapshot(current),events=current.getEventLog(),a=checked(current,format),reopened=new e.HwpDocument(a.bytes);
  same(beforeExport,snapshot(current));assert.equal(current.getEventLog(),events);
  const comparison=same(expected,snapshot(reopened));
  stages.push({format,cycle,outputSHA:hash(a.bytes),...comparison,preservation:a.preservation});
  if(current!==d)current.free();current=reopened;
 }}finally{if(current!==d)current.free();}}
 return stages;
}
await scenario('Actual explicit-LTR XML: remote edit Undo/Redo, strict HWPX twice, HWP direction loss rejected',()=>{
 const d=source();try{
  const originalDirectionGuard=hwpMustRejectExplicitDirection(d),h=actualEditAndHistory(d);
  const stages=repeated(d,['hwpx'],h.edited),editedDirectionGuard=hwpMustRejectExplicitDirection(d);
  return{sourceFormat:'actual-HWPX',paragraph:h.paragraph,beforeY:h.beforeY,afterY:h.afterY,undo:h.undo,redo:h.redo,originalDirectionGuard,editedDirectionGuard,stages};
 }finally{d.free();}
});
await scenario('Pinned83 produced native cache: remote edit Undo/Redo and strict both-codec repeated storage',()=>{
 const d=new e.HwpDocument(legacySpec.bytes);try{
  const h=actualEditAndHistory(d),stages=repeated(d,['hwp','hwpx'],h.edited);
  return{sourceFormat:'legacy83-produced-HWP',inputSHA:legacySpec.pin,paragraph:h.paragraph,beforeY:h.beforeY,afterY:h.afterY,undo:h.undo,redo:h.redo,stages,limitation:'This pinned old83 binary had already lost original explicit XML textDir before this run. It proves the187-difference edit-lifetime regression on that existing file, not preservation of metadata from the original actualXML.'};
 }finally{d.free();}
});
assert.equal(hash(await readFile(legacySpec.path)),legacySpec.pin);
for(const o of Object.values(originals))assert.equal(hash(await readFile(o.path)),o.pin);
const result={engine:e.metadata,legacyProduced83SHA:legacySpec.pin,verifierPolicyVersion:2,sourceHashes:Object.fromEntries(Object.entries(originals).map(([k,v])=>[k,v.pin])),passed:results.filter(r=>r.status==='PASS').length,failed:results.filter(r=>r.status==='FAIL').length,results,scope:'No public document bytes, text or snapshots written. Strict full semantic and published-layout comparisons; production preservation guard mandatory. ActualXML is HWPX-positive only; every explicit textDir HWP omission must be blocked. Legacy83 binary is a separately pinned existing file, with its old metadata loss explicitly retained as a limitation. Physical target success does not assert all-source-vs-Hancom geometry or15-to16 pagination parity.'};await writeFile(join(out,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({passed:result.passed,failed:result.failed}));if(result.failed)process.exitCode=1;
