// Fixed own documents, actual WASM public API, unchanged production save guard.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadReviewEngine,hash,snapshot,compareSnapshots} from './lib/hancom-review.mjs';
import {verifyPreservedExport} from '../src/adapters/rhwp/preservation.ts';
for(const key of ['JUEONY_ENGINE_PACKAGE','JUEONY_TEST_OUTPUT','JUEONY_TEST_FIXTURES','JUEONY_TEST_MANIFEST'])assert.ok(isAbsolute(process.env[key]??''),key);
const root=resolve(fileURLToPath(new URL('../../..',import.meta.url))),out=resolve(process.env.JUEONY_TEST_OUTPUT),fixtures=resolve(process.env.JUEONY_TEST_FIXTURES);
await mkdir(out,{recursive:true});
const engine=await loadReviewEngine(process.env.JUEONY_ENGINE_PACKAGE),{HwpDocument}=engine;
const manifestBytes=await readFile(process.env.JUEONY_TEST_MANIFEST);
assert.equal(hash(manifestBytes),'975542699e38cd3448ea32c91f7ffc7158a1e2c2497a567cd203724de0e5c6b6');
const manifest=JSON.parse(manifestBytes),selected=manifest.fixtures.filter(f=>/^[123]-(top|bottom)-tac\.hwp$/.test(f.file));assert.equal(selected.length,6);
const json=x=>typeof x==='string'?JSON.parse(x):x,points=x=>Array.from(x);
const observations=[],results=[],failures=[],inputs=[];let historyPairs=0,wrongPasswordRefusals=0;
function artifact(d,f,p=''){
 const a=f==='hwp'?(p?d.exportHwpWithPasswordAndReport(p):d.exportHwpWithReport()):(p?d.exportHwpxWithPasswordAndReport(p):d.exportHwpxWithReport());
 try{return{bytes:Buffer.from(a.takeBytes()),loss:json(a.contentLoss())};}finally{a.free();}
}
function coverage(d){
 const runs=Array.from({length:d.pageCount()},(_,i)=>json(d.getPageTextLayout(i)).runs).flat(),stories=[];
 const check=(expected,selected,story)=>{
  let at=0,seen='';for(const run of selected){assert.equal(run.charStart,at,story+' scalar ownership');const count=points(run.text).length;
   assert.equal(run.charX.length,count+1,story+' glyph boundaries');assert.ok(run.charX.every(Number.isFinite));seen+=run.text;at+=count;}
  assert.equal(seen,expected,story+' complete content, exactly once');stories.push({story,scalars:points(expected).length,utf16:expected.length});
 };
 for(let pi=0;pi<d.getParagraphCount(0);pi++)check(d.getTextRange(0,pi,0,d.getParagraphLength(0,pi)),runs.filter(r=>r.secIdx===0&&r.paraIdx===pi&&!Object.hasOwn(r,'parentParaIdx')&&!Object.hasOwn(r,'cellPath')),'body-'+pi);
 // These immutable fixtures contain exactly one two-cell table, one caption.
 for(const cell of [0,1,65534]){
  assert.equal(d.getCellParagraphCount(0,1,0,cell),1);
  const count=d.getCellParagraphLength(0,1,0,cell,0),expected=d.getTextInCell(0,1,0,cell,0,0,count);
  assert.equal(points(expected).length,count);
  check(expected,runs.filter(r=>r.secIdx===0&&r.parentParaIdx===1&&r.controlIdx===0&&r.cellIdx===cell&&r.cellParaIdx===0),'table-story-'+cell);
 }
 return stories;
}
async function save(d,format,password,label){
 const before=snapshot(d),beforeCoverage=coverage(d),events=d.getEventLog(),source=artifact(d,'hwp').bytes,a=artifact(d,format,password);
 assert.equal(a.loss.count,0,JSON.stringify(a.loss));const open=b=>password?HwpDocument.openWithPassword(b,password):new HwpDocument(b);
 const guard=verifyPreservedExport(d,a.bytes,format,a.loss,open);assert.equal(guard.status,'checked');
 const path=resolve(out,label+'.'+format);await writeFile(path,a.bytes);const bytes=await readFile(path);assert.deepEqual(bytes,a.bytes);
 if(password){assert.throws(()=>HwpDocument.openWithPassword(bytes,'wrong-own-caption'));wrongPasswordRefusals++;}
 const next=open(bytes);try{
  const comparison=compareSnapshots(before,snapshot(next));assert.equal(comparison.status,'SAME_WITHIN_PUBLISHED_CONTRACT',JSON.stringify(comparison));
  assert.deepEqual(coverage(next),beforeCoverage);assert.deepEqual(snapshot(d),before);assert.equal(d.getEventLog(),events);assert.deepEqual(artifact(d,'hwp').bytes,source);
  observations.push({label,format,encrypted:!!password,sha256:hash(bytes),comparison,coverage:beforeCoverage});return next;
 }catch(error){next.free();throw error;}
}
function editWithHistory(d,edit){const before=snapshot(d),oldCoverage=coverage(d),undo=d.saveSnapshot();edit();const after=snapshot(d),newCoverage=coverage(d),redo=d.saveSnapshot();assert.notDeepEqual(after,before);
 d.restoreSnapshot(undo);assert.deepEqual(snapshot(d),before);assert.deepEqual(coverage(d),oldCoverage);d.restoreSnapshot(redo);assert.deepEqual(snapshot(d),after);assert.deepEqual(coverage(d),newCoverage);historyPairs++;
}
for(const fixture of selected)for(const origin of ['native','xml'])for(const firstFormat of ['hwp','hwpx'])for(const password of ['','own-caption-157']){
 const filename=origin==='native'?fixture.file:fixture.xmlFile,bytes=await readFile(resolve(fixtures,filename));assert.equal(hash(bytes),fixture[origin==='native'?'sha256':'xmlSha256']);
 const name=filename.replace(/\./g,'-')+'-'+firstFormat+'-'+(password?'password':'plain');inputs.push({name,filename,sha256:hash(bytes)});let d=new HwpDocument(bytes);
 try{
  editWithHistory(d,()=>{const old=d.getTextRange(0,0,0,d.getParagraphLength(0,0)),prefix='Public prefix wrap 🪶. '.repeat(12);d.insertText(0,0,0,prefix);assert.equal(d.getTextRange(0,0,0,d.getParagraphLength(0,0)),prefix+old);
   const oldCaption=d.getTextInCell(0,1,0,65534,0,0,d.getCellParagraphLength(0,1,0,65534,0));d.insertTextInCell(0,1,0,65534,0,0,'Edited caption 🪶. ');assert.equal(d.getTextInCell(0,1,0,65534,0,0,d.getCellParagraphLength(0,1,0,65534,0)),'Edited caption 🪶. '+oldCaption);});
  const start=observations.length;let next=await save(d,firstFormat,password,name+'-initial');d.free();d=next;
  for(const [i,f]of ['hwpx','hwp','hwpx','hwpx','hwp'].entries()){next=await save(d,f,password,name+'-mixed'+i);d.free();d=next;}
  editWithHistory(d,()=>{const tail=d.getParagraphCount(0)-1;d.insertText(0,tail,d.getParagraphLength(0,tail),' Retained body 🪶.');d.insertTextInCell(0,1,0,65534,0,d.getCellParagraphLength(0,1,0,65534,0),' Retained caption 🪶.');});
  for(const f of ['hwp','hwpx']){next=await save(d,f,password,name+'-tail');next.free();}
  assert.equal(observations.length-start,8);results.push({name,status:'PASS',exports:8});console.log('PASS',name);
 }catch(error){results.push({name,status:'FAIL'});failures.push({name,error:String(error),stack:error.stack,report:error.report});console.log('FAIL',name,String(error));}finally{d.free();}
}
const sourcePaths=['scripts/lib/hancom-review.mjs','src/adapters/rhwp/preservation.ts','src/adapters/rhwp/document-stored-information.ts','src/adapters/rhwp/document-save-layout.ts','src/adapters/rhwp/overlap-save-layout.ts'];
const report={engine:engine.metadata,verifierSha256:hash(await readFile(fileURLToPath(import.meta.url))),manifestSha256:hash(manifestBytes),sourceHashes:await Promise.all(sourcePaths.map(async path=>({path,sha256:hash(await readFile(resolve(root,'apps/editor',path)))}))),inputs,results,failures,observations,historyPairs,wrongPasswordRefusals,scope:'Fixed current TAC top/bottom captions, configured1/2/3 columns, same Native lifecycle payload; actual report APIs, production whole save guard, every published layout field0.2, all body/cell/caption scalar/UTF16 coverage, source bytes/events invariant, disk reopens, exact Undo/Redo. Floating/multiple-used-frame captions and native Hancom comparison are separate.'};
await writeFile(resolve(out,'result.json'),JSON.stringify(report,null,2));
assert.equal(results.length,48);assert.deepEqual(failures,[]);assert.equal(observations.length,384);assert.equal(historyPairs,96);assert.equal(wrongPasswordRefusals,192);
