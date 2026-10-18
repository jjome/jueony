// Independent official-WASM lifecycle checks; fixed inputs, no private model repair.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,isAbsolute,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadReviewEngine,hash,snapshot,compareSnapshots} from './lib/hancom-review.mjs';
import {verifyPreservedExport} from '../src/adapters/rhwp/preservation.ts';
for(const k of ['JUEONY_ENGINE_PACKAGE','JUEONY_TEST_OUTPUT'])assert.ok(isAbsolute(process.env[k]??''),k);
const root=resolve(fileURLToPath(new URL('../../..',import.meta.url))),out=resolve(process.env.JUEONY_TEST_OUTPUT),dir=join(root,'apps/editor/tests/fixtures/n001-general125-own'),manifestBytes=await readFile(join(dir,'manifest.json')),manifest=JSON.parse(manifestBytes),engine=await loadReviewEngine(process.env.JUEONY_ENGINE_PACKAGE),{HwpDocument}=engine;
await mkdir(out,{recursive:true});const results=[],failures=[],observations=[],inputs=[];let histories=0,passwordRefusals=0;
function take(d,format,password){const a=format==='hwp'?(password?d.exportHwpWithPasswordAndReport(password):d.exportHwpWithReport()):(password?d.exportHwpxWithPasswordAndReport(password):d.exportHwpxWithReport());try{return{bytes:Buffer.from(a.takeBytes()),loss:JSON.parse(a.contentLoss())};}finally{a.free();}}
for(const name of ['unequal-two','unequal-three'])for(const origin of ['native','xml']){
 const f=manifest.fixtures.find(f=>f.file===name+'.hwp');assert.ok(f);const file=origin==='native'?f.file:f.xmlFile,expected=origin==='native'?f.sha256:f.xmlSha256,input=await readFile(join(dir,file));assert.equal(hash(input),expected);inputs.push({file,sha256:expected});
 for(const format of ['hwp','hwpx'])for(const password of ['','Own144-unequal-test-password']){
  const id=`${name}-${origin}-${format}-${password?'encrypted':'plain'}`,open=b=>password?HwpDocument.openWithPassword(b,password):new HwpDocument(b);let d=new HwpDocument(input);
  try{
   const initial=snapshot(d),undo=d.saveSnapshot();d.insertText(0,0,d.getParagraphLength(0,0),'Retained current prefix editing causes line reflow. '.repeat(f.shortPage?15:7));const edited=snapshot(d),redo=d.saveSnapshot();d.restoreSnapshot(undo);assert.deepEqual(snapshot(d),initial);d.restoreSnapshot(redo);assert.deepEqual(snapshot(d),edited);histories++;
   for(let cycle=0;cycle<4;cycle++){
    if(cycle===3){const p=d.getParagraphCount(0)-1;d.insertText(0,p,d.getParagraphLength(0,p),' Follow-up own edit.');}
    const before=snapshot(d),events=d.getEventLog(),a=take(d,format,password);assert.equal(a.loss.count,0,JSON.stringify(a.loss));const guard=verifyPreservedExport(d,a.bytes,format,a.loss,open);assert.equal(guard.status,'checked');assert.deepEqual(snapshot(d),before);assert.equal(d.getEventLog(),events);
    const path=join(out,`${id}-${cycle}.${format}`);await writeFile(path,a.bytes);const disk=await readFile(path);assert.deepEqual(disk,a.bytes);const next=open(disk);try{const comparison=compareSnapshots(before,snapshot(next));observations.push({id,cycle,sha256:hash(disk),comparison});assert.equal(comparison.status,'SAME_WITHIN_PUBLISHED_CONTRACT');if(password){assert.throws(()=>HwpDocument.openWithPassword(disk,'wrong-own144-password'));passwordRefusals++;}}catch(e){next.free();throw e;}d.free();d=next;
   }
   assert.equal(hash(await readFile(join(dir,file))),expected);results.push({name:id,status:'PASS'});console.log('PASS',id);
  }catch(e){results.push({name:id,status:'FAIL'});failures.push({name:id,error:String(e),stack:e.stack,report:e.report});console.log('FAIL',id,String(e).slice(0,200));}finally{d.free();}
 }
}
await writeFile(join(out,'result.json'),JSON.stringify({engine:engine.metadata,results,failures,observations,inputs,manifestSha256:hash(manifestBytes),verifierSha256:hash(await readFile(fileURLToPath(import.meta.url))),histories,passwordRefusals,scope:'N001 fixed unequal2/3 Native/XML four inputs, both formats/plain-password, three successive save/reopens plus tail-edit fourth save, exact snapshot undo/redo, immutable production full semantic/geometry0.2 guard and content-loss0. No source/cache/lease repair, regenerated fixtures, GUI/Hancom, LLM or credentials.'},null,2));console.log(JSON.stringify({passed:results.filter(x=>x.status==='PASS').length,total:results.length,observations:observations.length,histories,passwordRefusals}));if(failures.length)process.exitCode=1;
