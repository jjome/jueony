import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {resolve,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadReviewEngine,hash,snapshot,compareSnapshots,differences} from './lib/hancom-review.mjs';
import {verifyPreservedExport} from '../src/adapters/rhwp/preservation.ts';

for(const name of ['JUEONY_ENGINE_PACKAGE','JUEONY_TEST_OUTPUT'])assert.ok(isAbsolute(process.env[name]??''),`${name} must be absolute`);
const repo=resolve(fileURLToPath(new URL('../../..',import.meta.url))),out=resolve(process.env.JUEONY_TEST_OUTPUT),verifier=fileURLToPath(import.meta.url);
const inputPath=resolve(repo,'docs/evidence/file-completion-2026-10-18/engine76/columns-native/fixtures/build/file-closure69-public/column2-candidate74/valid-negative-disk/baseline-single_column.hwp');
const input=await readFile(inputPath),inputSha256='9778d66926e3138ce4bb51fadfd16173ee3d439aeec0a02a8f0af34b7fac0f3b';assert.equal(hash(input),inputSha256);
try{await access(resolve(out,'result.json'));throw Error('Choose a fresh output directory; result.json already exists');}catch(e){if(e.code!=='ENOENT')throw e;}
await mkdir(out,{recursive:true});
const sourcePaths=['apps/editor/src/adapters/rhwp/preservation.ts','apps/editor/src/adapters/rhwp/document-stored-information.ts','apps/editor/src/adapters/rhwp/document-save-layout.ts','apps/editor/src/adapters/rhwp/overlap-save-layout.ts','apps/editor/scripts/lib/hancom-review.mjs'];
const sourceHashes=Object.fromEntries(await Promise.all(sourcePaths.map(async p=>[p,hash(await readFile(resolve(repo,p)))]))),verifierSha256=hash(await readFile(verifier));
const engine=await loadReviewEngine(process.env.JUEONY_ENGINE_PACKAGE),{HwpDocument}=engine;
const results=[],observations=[],failures=[],text='현재 문맥으로 복합 배치를 다시 조판하는 자체 시험 문장입니다. ',late='다시 열어 남기는 뒤 본문 ';
const payloads=[['short','후속 편집 '],['astral','계속 남는 🙂 𠮷 추가 본문 '],['wrapped','여러 줄에 걸쳐 실제로 남는 표 호스트 본문입니다. '.repeat(10)]];
function call(value){const v=typeof value==='string'?JSON.parse(value):value;assert.ok(v?.ok!==false,JSON.stringify(v));return v;}
function take(d,format,password){const a=format==='hwp'?(password?d.exportHwpWithPasswordAndReport(password):d.exportHwpWithReport()):(password?d.exportHwpxWithPasswordAndReport(password):d.exportHwpxWithReport());try{return{bytes:Buffer.from(a.takeBytes()),loss:JSON.parse(a.contentLoss())};}finally{a.free();}}
function readonly(d){return{snapshot:snapshot(d),events:d.getEventLog(),unicode:d.getTextFileUnicode(),metadata:d.getDocumentMetadata(),stored:d.getDocumentStoredInformation(),sourceFormat:d.getSourceFormat()};}
for(const origin of ['native','xml'])for(const[name,payload]of payloads)for(const mode of ['plain','password']){
 const id=`${origin}-${name}-${mode}`,dir=resolve(out,id),password=mode==='password'?'N001-profile145!Own':'',open=b=>password?HwpDocument.openWithPassword(b,password):new HwpDocument(b);await mkdir(dir,{recursive:true});
 let d=new HwpDocument(input),phase='create',caseObservations=[],firstPageComparison;
 async function checkedSave(doc,format,label){
  phase=label;const before=readonly(doc),a=take(doc,format,password);assert.equal(a.loss.count,0,JSON.stringify(a.loss));
  if(format==='hwp')assert.equal(a.bytes.subarray(0,8).toString('hex'),'d0cf11e0a1b11ae1','actual CFB output');
  const path=resolve(dir,`${label}.${format}`);await writeFile(path,a.bytes);const disk=await readFile(path);assert.deepEqual(disk,a.bytes,'actual disk readback exact');
  const guard=verifyPreservedExport(doc,disk,format,a.loss,open);assert.equal(guard.status,'checked',JSON.stringify(guard));
  let n;try{n=open(disk);assert.equal(n.getSourceFormat(),format);const comparison=compareSnapshots(before.snapshot,snapshot(n));assert.equal(comparison.status,'SAME_WITHIN_PUBLISHED_CONTRACT',JSON.stringify(comparison));assert.equal(n.getTextFileUnicode(),before.unicode);assert.deepEqual(readonly(doc),before,'all public source evidence and event log unchanged by export/guard/readback');
   if(password)assert.throws(()=>HwpDocument.openWithPassword(disk,'N001-profile145!Wrong'));
   const fact={case:id,phase:label,format,mode,sourceFormatBefore:before.sourceFormat,sourceFormatAfter:n.getSourceFormat(),bytes:disk.length,sha256:hash(disk),geometry:comparison.geometry.count,semantic:comparison.semantic.count,lossCount:a.loss.count,guard:'checked',diskExact:true,publicSourceUnchanged:true,eventLogUnchanged:true};caseObservations.push(fact);observations.push(fact);return n;
  }catch(e){n?.free();throw e;}
 }
 try{
  call(d.insertSectionBreak(0,3,0));assert.equal(d.getSectionCount(),2);assert.equal(d.getParagraphCount(0),3);d.insertText(0,0,d.getParagraphLength(0,0),text.repeat(8));
  if(origin==='xml'){const n=await checkedSave(d,'hwpx','xml-origin-seed');d.free();d=n;}
  const host=d.getParagraphCount(0)-1;assert.equal(host,2);d.insertText(0,host,0,payload);assert.ok(d.getTextFileUnicode().includes(payload));
  for(let cycle=0;cycle<3;cycle++){const n=await checkedSave(d,'hwp',`native-cycle${cycle}`);d.free();d=n;}
  assert.equal(d.getSourceFormat(),'hwp');const before=readonly(d),undo=d.saveSnapshot(),section=d.getSectionCount()-1,tail=d.getParagraphCount(section)-1;
  phase='same-instance-other-section-edit';d.insertText(section,tail,0,late);assert.ok(d.getTextFileUnicode().includes(late));const after=readonly(d),redo=d.saveSnapshot();
  firstPageComparison={case:id,phase,exactTolerance:0,differences:differences(before.snapshot.layout[0],after.snapshot.layout[0],0),beforeFirstPage:before.snapshot.layout[0],afterFirstPage:after.snapshot.layout[0]};
  await writeFile(resolve(dir,'untouched-first-page.json'),JSON.stringify(firstPageComparison,null,2)+'\n');assert.deepEqual(firstPageComparison.differences,[],'later-section edit preserves every first-page control/text field exactly');assert.deepEqual(after.snapshot.layout[0],before.snapshot.layout[0]);
  phase='undo';d.restoreSnapshot(undo);assert.deepEqual(readonly(d).snapshot,before.snapshot);assert.deepEqual(snapshot(d).layout[0],before.snapshot.layout[0]);caseObservations.push({case:id,phase:'undo',geometry:0,semantic:0,exactSnapshot:true});
  phase='redo';d.restoreSnapshot(redo);assert.deepEqual(readonly(d).snapshot,after.snapshot);assert.deepEqual(snapshot(d).layout[0],before.snapshot.layout[0]);caseObservations.push({case:id,phase:'redo',geometry:0,semantic:0,exactSnapshot:true});
  for(const format of ['hwp','hwpx']){const n=await checkedSave(d,format,`retained-other-section-followup-${format}`);n.free();}
  assert.deepEqual(readonly(d).snapshot,after.snapshot);results.push({name:id,status:'PASS',firstPageExact:true,historyExact:true,observations:caseObservations});console.log('PASS',id);
 }catch(e){const f={name:id,status:'FAIL',phase,error:String(e),stack:e.stack,report:e.report,firstPageExact:firstPageComparison?firstPageComparison.differences.length===0:null,observations:caseObservations};results.push(f);failures.push(f);console.log('FAIL',id,phase,String(e).slice(0,500));}
 finally{d.free();}
}
assert.equal(results.length,12,'fixed origin2 × payload3 × plain/password2 denominator');
assert.equal(hash(await readFile(inputPath)),inputSha256,'pinned source file unchanged');for(const [path,expected]of Object.entries(sourceHashes))assert.equal(hash(await readFile(resolve(repo,path))),expected,'production proof source unchanged: '+path);assert.equal(hash(await readFile(verifier)),verifierSha256);
const report={engine:engine.metadata,verifierSha256,sourceHashes,inputHashes:{[inputPath]:inputSha256},results,failures,observations,totals:{cases:12,passed:results.filter(r=>r.status==='PASS').length,failed:failures.length,guardedDiskExports:observations.length,exactFirstPageChecks:results.filter(r=>r.firstPageExact===true).length},scope:'Pinned own Native fixture→two sections+prefix8; XML-origin variant uses actual guarded XML seed. Retained visible final table-host short/astral/wrapped edit, three real HWP disk export/reopens (plain/password), then mutate only section1 tail on the exact surviving Native instance. Exact numeric0 first-page control/text subtree, undo/redo exact full public snapshot, both-format retained follow-up with unchanged production semantic/whole geometry0.2 guard and disk readback. Public snapshot/Unicode/metadata/stored-information/events and input bytes remain unchanged by exports. No private global profile boolean, internal IR or lease is queried; actual Native reopen/other-section-edit path is the observable contract. No GUI/Hancom claim.'};
await writeFile(resolve(out,'result.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.totals));if(failures.length)process.exitCode=1;
