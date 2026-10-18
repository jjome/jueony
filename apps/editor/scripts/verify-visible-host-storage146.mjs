// Expanded same/mixed-format matrix. A failed guard remains a failed case.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,isAbsolute,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadReviewEngine,hash,snapshot,compareSnapshots} from './lib/hancom-review.mjs';
import {verifyPreservedExport} from '../src/adapters/rhwp/preservation.ts';
for(const k of ['JUEONY_ENGINE_PACKAGE','JUEONY_TEST_OUTPUT'])assert.ok(isAbsolute(process.env[k]??''),k);
const root=resolve(fileURLToPath(new URL('../../..',import.meta.url))),out=resolve(process.env.JUEONY_TEST_OUTPUT),engine=await loadReviewEngine(process.env.JUEONY_ENGINE_PACKAGE),{HwpDocument}=engine;
const input=await readFile(join(root,'docs/evidence/file-completion-2026-10-18/engine76/columns-native/fixtures/build/file-closure69-public/column2-candidate74/valid-negative-disk/baseline-single_column.hwp'));assert.equal(hash(input),'9778d66926e3138ce4bb51fadfd16173ee3d439aeec0a02a8f0af34b7fac0f3b');await mkdir(out,{recursive:true});
const results=[],failures=[],observations=[];
function take(d,format,password=''){const a=format==='hwp'?(password?d.exportHwpWithPasswordAndReport(password):d.exportHwpWithReport()):(password?d.exportHwpxWithPasswordAndReport(password):d.exportHwpxWithReport());try{return{bytes:Buffer.from(a.takeBytes()),loss:JSON.parse(a.contentLoss())};}finally{a.free();}}
const texts=[['short','후속 편집 '],['astral','후속😀 𠮷 '],['wrapped','현재 표 뒤 본문은 여러 글줄로 유지되어야 합니다. '.repeat(5)]];
for(const origin of ['hwp','hwpx'])for(const [kind,text]of texts)for(const format of ['hwp','hwpx'])for(const password of ['','Own146-visible-host-password']){
 const id=`${origin}-${kind}-${format}-${password?'encrypted':'plain'}`,open=b=>password?HwpDocument.openWithPassword(b,password):new HwpDocument(b);let d;
 try{
  const base=new HwpDocument(input);let starting;try{base.insertSectionBreak(0,3,0);base.insertText(0,0,base.getParagraphLength(0,0),'현재 문맥으로 복합 배치를 다시 조판하는 자체 시험 문장입니다. '.repeat(8));const a=take(base,origin);assert.equal(a.loss.count,0);assert.equal(verifyPreservedExport(base,a.bytes,origin,a.loss,b=>new HwpDocument(b)).status,'checked');starting=a.bytes;}finally{base.free();}
  d=new HwpDocument(starting);const before=snapshot(d),undo=d.saveSnapshot(),tail=d.getParagraphCount(0)-1;d.insertText(0,tail,0,text);const edited=snapshot(d),redo=d.saveSnapshot();d.restoreSnapshot(undo);assert.deepEqual(snapshot(d),before);d.restoreSnapshot(redo);assert.deepEqual(snapshot(d),edited);
  for(let cycle=0;cycle<3;cycle++){
   if(cycle===2)d.insertText(0,tail,d.getParagraphLength(0,tail),' 추가 본문 ');
   const live=snapshot(d),events=d.getEventLog(),a=take(d,format,password);assert.equal(a.loss.count,0);assert.deepEqual(snapshot(d),live);assert.equal(d.getEventLog(),events);
   const path=join(out,`${id}-${cycle}.${format}`);await writeFile(path,a.bytes);const disk=await readFile(path);assert.deepEqual(disk,a.bytes);const n=open(disk);let comparison;try{comparison=compareSnapshots(live,snapshot(n));observations.push({id,cycle,sha256:hash(disk),comparison});assert.equal(verifyPreservedExport(d,disk,format,a.loss,open).status,'checked');assert.equal(comparison.status,'SAME_WITHIN_PUBLISHED_CONTRACT');if(password)assert.throws(()=>HwpDocument.openWithPassword(disk,'wrong-own146-password'));}catch(e){n.free();throw e;}d.free();d=n;
  }
  results.push({name:id,status:'PASS'});console.log('PASS',id);
 }catch(e){results.push({name:id,status:'FAIL'});failures.push({name:id,error:String(e),stack:e.stack,report:e.report});console.log('FAIL',id,String(e).slice(0,200));}finally{d?.free();}
}
await writeFile(join(out,'result.json'),JSON.stringify({engine:engine.metadata,results,failures,observations,inputSha256:hash(input),verifierSha256:hash(await readFile(fileURLToPath(import.meta.url))),scope:'Expanded N001 visible table-host body: two serialized origins, short/astral/wrapped text, both output formats, plain/password, three disk reopen cycles and follow-up edit; exact undo/redo and source/events immutable, mandatory unchanged production semantic/geometry0.2 guard. Every unsupported/mixed failure remains FAIL. No private source/cache/lease repair, GUI/Hancom, LLM or credentials.'},null,2));console.log(JSON.stringify({passed:results.filter(x=>x.status==='PASS').length,total:results.length,failed:failures.length}));if(failures.length)process.exitCode=1;
