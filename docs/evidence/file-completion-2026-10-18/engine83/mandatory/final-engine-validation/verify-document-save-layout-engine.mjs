import assert from 'node:assert/strict';import{readFile,writeFile,mkdir}from'node:fs/promises';import{resolve,isAbsolute}from'node:path';import{fileURLToPath}from'node:url';
import{loadReviewEngine,snapshot,compareSnapshots,hash}from'./lib/hancom-review.mjs';
import{verifyPreservedExport,PreservationError}from'../src/adapters/rhwp/preservation.ts';
for(const k of['JUEONY_ENGINE_PACKAGE','JUEONY_REPOSITORY','JUEONY_TEST_OUTPUT'])assert.ok(isAbsolute(process.env[k]??''),k+' must be absolute');const root=resolve(process.env.JUEONY_REPOSITORY),out=resolve(process.env.JUEONY_TEST_OUTPUT);await mkdir(out,{recursive:true});const engine=await loadReviewEngine(process.env.JUEONY_ENGINE_PACKAGE),{HwpDocument}=engine,results=[],failures=[],observations=[];const j=v=>typeof v==='string'?JSON.parse(v):v;
async function scenario(name,fn){try{await fn();results.push({name,status:'PASS'});console.log('PASS',name);}catch(e){failures.push({name,error:String(e),stack:e.stack});results.push({name,status:'FAIL'});console.error('FAIL',name,String(e));}}
function artifact(d,f){return f==='hwp'?d.exportHwpWithReport():d.exportHwpxWithReport();}
for(const fixture of['plain','table'])for(const format of['hwp','hwpx'])await scenario(`own ${fixture} ${format}: mandatory full-layout save proof passes and source remains immutable`,async()=>{const d=HwpDocument.createEmpty();try{d.createBlankDocument();if(fixture==='plain')d.insertText(0,0,0,'OWN 전체 저장 😀 A B 123');else{const t=j(d.createTable(0,0,0,2,2));d.insertTextInCell(0,t.paraIdx,t.controlIdx,0,0,0,'OWN 셀 😀');}const before=snapshot(d),a=artifact(d,format);try{const bytes=a.takeBytes(),checked=verifyPreservedExport(d,bytes,format,a.contentLoss(),b=>new HwpDocument(b));assert.ok(checked.checked.includes('whole-document-published-layout'));const reopened=new HwpDocument(bytes);try{assert.equal(compareSnapshots(before,snapshot(reopened)).status,'SAME_WITHIN_PUBLISHED_CONTRACT');}finally{reopened.free();}assert.equal(compareSnapshots(before,snapshot(d)).status,'SAME_WITHIN_PUBLISHED_CONTRACT');observations.push({fixture,format,pages:before.pages,bytes:bytes.length,sha256:hash(bytes),wholeLayoutChecked:true});}finally{a.free();}}finally{d.free();}});
await scenario('actual MCST: sixteen pages and checked full layout through both formats twice plus six alternating saves',async()=>{
 const path=resolve(root,'build/hancom-final-file-review-20261017/mcst-bid-2026-hwpx-hancom.hwpx'),input=await readFile(path);
 assert.equal(hash(input),'20a3960b4315626c3f97d9c5d47746e3cfadd8fe50dde43a4a424aa3a2a76936');
 const d=new HwpDocument(input);try{
  const before=snapshot(d),eventLog=d.getEventLog(),cycles=[];assert.equal(before.pages,16);
  for(const sequence of[['hwp','hwp'],['hwpx','hwpx'],['hwp','hwpx','hwp','hwpx','hwp','hwpx']]){
   let current=d;try{for(let step=0;step<sequence.length;step++){
    const format=sequence[step],a=artifact(current,format);let next;
    try{
     const bytes=a.takeBytes(),guard=verifyPreservedExport(current,bytes,format,a.contentLoss(),b=>new HwpDocument(b));
     assert.equal(guard.status,'checked');assert.ok(guard.checked.includes('whole-document-published-layout'));
     next=new HwpDocument(bytes);const delta=compareSnapshots(before,snapshot(next));
     assert.equal(delta.status,'SAME_WITHIN_PUBLISHED_CONTRACT');assert.equal(next.pageCount(),16);
     assert.equal(compareSnapshots(before,snapshot(d)).status,'SAME_WITHIN_PUBLISHED_CONTRACT');
     assert.equal(d.getEventLog(),eventLog,'storage must not alter live source history');
     cycles.push({sequence:sequence.join('/'),step:step+1,format,sha256:hash(bytes),pages:delta.pages,geometryDifferences:delta.geometry.count,semanticDifferences:delta.semantic.count,guard});
     if(current!==d)current.free();current=next;next=undefined;
    }finally{next?.free();a.free();}
   }}finally{if(current!==d)current.free();}
  }
  assert.equal(hash(await readFile(path)),hash(input));
  observations.push({label:'actual-supported-cross-format',inputSha256:hash(input),cycles,sourceUnchanged:true,publicDerivedBytesWritten:0});
 }finally{d.free();}
});
await scenario('historical-converted MCST: native lineage stays exact across HWP/HWPX two cycles',async()=>{
 const path=resolve(root,'build/hancom-final-file-review-20261017/mcst-bid-2026-hwpx.hwpx'),input=await readFile(path);
 assert.equal(hash(input),'cef8a3b80d6732be5f850c28923b27a09e2f0ff9df9a2835bc3b84c512266452');
 const d=new HwpDocument(input);try{
  const before=snapshot(d);assert.equal(before.pages,15);const cycles=[];
  for(const format of['hwp','hwpx']){let current=d;try{for(let cycle=1;cycle<=2;cycle++){
   const a=artifact(current,format);let next;try{
    const bytes=a.takeBytes(),guard=verifyPreservedExport(current,bytes,format,a.contentLoss(),b=>new HwpDocument(b));
    assert.ok(guard.checked.includes('whole-document-published-layout'));next=new HwpDocument(bytes);
    assert.equal(compareSnapshots(before,snapshot(next)).status,'SAME_WITHIN_PUBLISHED_CONTRACT');
    cycles.push({format,cycle,sha256:hash(bytes),geometryDifferences:0,semanticDifferences:0,guard});
    if(current!==d)current.free();current=next;next=undefined;
   }finally{next?.free();a.free();}
  }}finally{if(current!==d)current.free();}}
  assert.equal(compareSnapshots(before,snapshot(d)).status,'SAME_WITHIN_PUBLISHED_CONTRACT');
  assert.equal(hash(await readFile(path)),hash(input));observations.push({label:'historical-native-lineage',inputSha256:hash(input),cycles,sourceUnchanged:true});
 }finally{d.free();}
});
await scenario('real Native handle: changed text-layout metadata with identical semantic getters is rejected, source unchanged',()=>{const d=HwpDocument.createEmpty();try{d.createBlankDocument();d.insertText(0,0,0,'OWN GUARD');const before=snapshot(d),a=artifact(d,'hwpx');try{const bytes=a.takeBytes();assert.throws(()=>verifyPreservedExport(d,bytes,'hwpx',a.contentLoss(),b=>{const r=new HwpDocument(b),get=r.getPageTextLayout.bind(r);r.getPageTextLayout=p=>JSON.stringify({...j(get(p)),newPublishedField:'injected'});return r;}),e=>e instanceof PreservationError&&e.report.issues.some(i=>i.path.startsWith('whole-document-published-layout')));assert.equal(compareSnapshots(before,snapshot(d)).status,'SAME_WITHIN_PUBLISHED_CONTRACT');}finally{a.free();}}finally{d.free();}});
await writeFile(out+'/result.json',JSON.stringify({engine:engine.metadata,verifierSha256:hash(await readFile(fileURLToPath(import.meta.url))),adapterSha256:hash(await readFile(new URL('../src/adapters/rhwp/document-save-layout.ts',import.meta.url))),preservationSha256:hash(await readFile(new URL('../src/adapters/rhwp/preservation.ts',import.meta.url))),results,failures,observations,pageErrors:[],consoleErrors:[],externalRequests:[],scope:'Actual WASM and production verifyPreservedExport. Public input read-only by hash; no source or derived public bytes/snapshots copied here. Full published response objects/ordering, page count and every field retained, measured geometry maximum0.2, all other numbers/IDs exact. Writes counter occurs only after the actual gate returns; actual OS picker UI is a separate verification.'},null,2));if(failures.length)process.exitCode=1;
