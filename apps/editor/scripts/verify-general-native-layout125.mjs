// N001: public edits on pinned own Native input. No private row/cache repair.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadReviewEngine,hash,snapshot,compareSnapshots} from './lib/hancom-review.mjs';
import {verifyPreservedExport} from '../src/adapters/rhwp/preservation.ts';
for(const key of ['JUEONY_ENGINE_PACKAGE','JUEONY_TEST_OUTPUT'])assert.ok(isAbsolute(process.env[key]??''),key);
const repo=resolve(fileURLToPath(new URL('../../..',import.meta.url))),out=resolve(process.env.JUEONY_TEST_OUTPUT),engine=await loadReviewEngine(process.env.JUEONY_ENGINE_PACKAGE),{HwpDocument}=engine;await mkdir(out,{recursive:true});
const path=resolve(repo,'docs/evidence/file-completion-2026-10-18/engine76/columns-native/fixtures/build/file-closure69-public/column2-candidate74/valid-negative-disk/baseline-single_column.hwp');
const input=await readFile(path);assert.equal(hash(input),'9778d66926e3138ce4bb51fadfd16173ee3d439aeec0a02a8f0af34b7fac0f3b');
const results=[],failures=[],observations=[],text='현재 문맥으로 복합 배치를 다시 조판하는 자체 시험 문장입니다. ';
function call(value){const v=typeof value==='string'?JSON.parse(value):value;assert.ok(v?.ok!==false,JSON.stringify(v));return v;}
function tail(d){return d.getParagraphCount(0)-1;}
function prefix(d,n=25){d.insertText(0,0,d.getParagraphLength(0,0),text.repeat(n));}
const cases=[
 ['two-table-reference',d=>prefix(d)],
 ['one-table-after-delete',d=>{call(d.deleteTableControl(0,2,0));prefix(d);}],
 ['three-tables-created',d=>{call(d.createTableEx(JSON.stringify({sectionIdx:0,paraIdx:tail(d),charOffset:0,rowCount:2,colCount:2,treatAsChar:false})));prefix(d);}],
 ['four-tables-created',d=>{for(let i=0;i<2;i++)call(d.createTableEx(JSON.stringify({sectionIdx:0,paraIdx:tail(d),charOffset:0,rowCount:2,colCount:2,treatAsChar:false})));prefix(d);}],
 ['interleaved-body',d=>{call(d.insertParagraph(0,2));d.insertText(0,2,0,'표 사이의 본문을 그대로 유지합니다. '.repeat(4));prefix(d);}],
 ['multiple-interleaved-body',d=>{for(let i=0;i<3;i++){call(d.insertParagraph(0,2+i));d.insertText(0,2+i,0,'독립 본문 '+i+' '.repeat(2));}prefix(d);}],
 ['two-column-current',d=>{call(d.setColumnDef(0,2,0,1,900));prefix(d,8);}],
 ['three-column-current',d=>{call(d.setColumnDef(0,3,0,1,720));prefix(d,8);}],
 ['multi-page-prefix',d=>prefix(d,220)],
 ['explicit-page-boundary',d=>{call(d.insertPageBreak(0,2,0));prefix(d,8);}],
 ['explicit-column-boundary',d=>{call(d.setColumnDef(0,2,0,1,900));call(d.insertColumnBreak(0,2,0));prefix(d,8);}],
 ['multiple-sections',d=>{call(d.insertSectionBreak(0,3,0));prefix(d,8);}],
 ['negative-table-offset',d=>{call(d.setTableProperties(0,2,0,JSON.stringify({vertOffset:-300,allowOverlap:true})));prefix(d,8);}],
 ['positive-table-offset',d=>{call(d.setTableProperties(0,2,0,JSON.stringify({vertOffset:450,allowOverlap:true})));prefix(d,8);}]
];
function take(a){try{return{bytes:Buffer.from(a.takeBytes()),loss:JSON.parse(a.contentLoss())};}finally{a.free();}}
for(const[name,mutate]of cases)for(const format of ['hwp','hwpx'])for(const password of ['', 'Own125-general-password']){
 const mode=password?'encrypted':'plain',open=bytes=>password?HwpDocument.openWithPassword(bytes,password):new HwpDocument(bytes),exported=d=>take(format==='hwp'?(password?d.exportHwpWithPasswordAndReport(password):d.exportHwpWithReport()):(password?d.exportHwpxWithPasswordAndReport(password):d.exportHwpxWithReport()));
 const d=new HwpDocument(input);let next;
 try{
  const initial=snapshot(d),undo=d.saveSnapshot();mutate(d);const before=snapshot(d),redo=d.saveSnapshot(),events=d.getEventLog();
  d.restoreSnapshot(undo);assert.deepEqual(snapshot(d),initial);d.restoreSnapshot(redo);assert.deepEqual(snapshot(d),before);
  const a=exported(d);assert.equal(a.loss.count,0,JSON.stringify(a.loss));
  const reopened=open(a.bytes);let comparison;try{comparison=compareSnapshots(before,snapshot(reopened));}finally{reopened.free();}
  observations.push({name,format,mode,pages:before.pages,sha256:hash(a.bytes),comparison});
  assert.equal(verifyPreservedExport(d,a.bytes,format,a.loss,open).status,'checked');
  assert.equal(comparison.status,'SAME_WITHIN_PUBLISHED_CONTRACT');assert.deepEqual(snapshot(d),before);assert.equal(d.getEventLog(),events);
  await writeFile(resolve(out,name+'-'+mode+'.'+format),a.bytes);const disk=await readFile(resolve(out,name+'-'+mode+'.'+format));assert.deepEqual(disk,a.bytes);next=open(disk);assert.equal(compareSnapshots(before,snapshot(next)).status,'SAME_WITHIN_PUBLISHED_CONTRACT');
  const end=next.getParagraphCount(0)-1;next.insertText(0,end,0,'후속 편집 ');const follow=snapshot(next),b=exported(next);assert.equal(b.loss.count,0);assert.equal(verifyPreservedExport(next,b.bytes,format,b.loss,open).status,'checked');
  if(password)assert.throws(()=>HwpDocument.openWithPassword(b.bytes,'wrong-general-password'));const n=open(b.bytes);try{assert.equal(compareSnapshots(follow,snapshot(n)).status,'SAME_WITHIN_PUBLISHED_CONTRACT');}finally{n.free();}
  results.push({name:name+' '+format+' '+mode,status:'PASS'});console.log('PASS',name,format,mode);
 }catch(e){results.push({name:name+' '+format+' '+mode,status:'FAIL'});failures.push({name,format,mode,error:String(e),stack:e.stack,report:e.report});console.log('FAIL',name,format,mode,String(e).slice(0,250));}
 finally{next?.free();d.free();}
}
const sourcePaths=['src/adapters/rhwp/preservation.ts','src/adapters/rhwp/document-stored-information.ts','src/adapters/rhwp/document-save-layout.ts','src/adapters/rhwp/overlap-save-layout.ts'];
const report={engine:engine.metadata,results,failures,observations,sourceHashes:await Promise.all(sourcePaths.map(async path=>({path,sha256:hash(await readFile(resolve(repo,'apps/editor',path)))}))),verifierSha256:hash(await readFile(fileURLToPath(import.meta.url))),fixtureSha256:hash(input),scope:'N001 public-edit general layout regression, full unchanged production semantic/whole-layout0.2 guards, snapshot Undo/Redo, ordinary/password disk reopen and follow-up. No private leases, payload repairs, GUI/Hancom or LLM.'};
await writeFile(resolve(out,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:results.filter(x=>x.status==='PASS').length,total:results.length,failures:failures.map(x=>({name:x.name,format:x.format,mode:x.mode,error:x.error}))}));if(failures.length)process.exitCode=1;
