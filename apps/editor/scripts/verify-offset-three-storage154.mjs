// Actual current-layout preservation for the fixed unequal three-column input.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {resolve,join,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadReviewEngine,snapshot,compareSnapshots,hash} from './lib/hancom-review.mjs';
import {verifyPreservedExport} from '../src/adapters/rhwp/preservation.ts';

for(const key of ['JUEONY_ENGINE_PACKAGE','JUEONY_TEST_OUTPUT'])assert.ok(isAbsolute(process.env[key]??''),key+' must be absolute');
const root=resolve(import.meta.dirname,'../../..'),out=resolve(process.env.JUEONY_TEST_OUTPUT),verifierPath=fileURLToPath(import.meta.url),verifierSha256=hash(await readFile(verifierPath));
try{await access(join(out,'result.json'));throw Error('A fresh output directory is required');}catch(e){if(e.code!=='ENOENT')throw e;}
await mkdir(out,{recursive:true});
const engine=await loadReviewEngine(process.env.JUEONY_ENGINE_PACKAGE),{HwpDocument}=engine;
const own=join(root,'apps/editor/tests/fixtures/n001-general125-own'),manifestBytes=await readFile(join(own,'manifest.json')),manifest=JSON.parse(manifestBytes);
const fixture=manifest.fixtures.find(f=>f.file==='unequal-three-offset.hwp');assert.ok(fixture);
const sourceHashes=await Promise.all(['preservation.ts','document-stored-information.ts','document-save-layout.ts','overlap-save-layout.ts'].map(async file=>({path:file,sha256:hash(await readFile(join(root,'apps/editor/src/adapters/rhwp',file)))})));
const results=[],failures=[],observations=[];let wrongPasswordRefusals=0,historyPairs=0;
const points=s=>Array.from(s),json=x=>typeof x==='string'?JSON.parse(x):x;
function artifact(d,format,pwd=''){
 const a=format==='hwp'?(pwd?d.exportHwpWithPasswordAndReport(pwd):d.exportHwpWithReport()):(pwd?d.exportHwpxWithPasswordAndReport(pwd):d.exportHwpxWithReport());
 try{return{bytes:Buffer.from(a.takeBytes()),loss:json(a.contentLoss())};}finally{a.free();}
}
const open=(bytes,pwd)=>pwd?HwpDocument.openWithPassword(bytes,pwd):new HwpDocument(bytes);
function bodyCoverage(d){
 const paragraphs=[];
 for(let section=0;section<d.getSectionCount();section++)for(let paragraph=0;paragraph<d.getParagraphCount(section);paragraph++){
  const length=d.getParagraphLength(section,paragraph),expected=d.getTextRange(section,paragraph,0,length);assert.equal(points(expected).length,length);
  let seen='',scalars=0;const rows=[];
  for(let page=0;page<d.pageCount();page++)for(const run of json(d.getPageTextLayout(page)).runs){
   if(Object.hasOwn(run,'cellPath')||Object.hasOwn(run,'parentParaIdx')||run.secIdx!==section||run.paraIdx!==paragraph)continue;
   const count=points(run.text).length;assert.equal(run.charStart,scalars,'body source order and scalar partition');assert.ok(Array.isArray(run.charX)&&run.charX.length===count+1&&run.charX.every(Number.isFinite),'published scalar boundaries include the ending position');
   rows.push({page,start:scalars,scalars:count,utf16:run.text.length});scalars+=count;seen+=run.text;
  }
  assert.equal(seen,expected,'every body scalar must be painted exactly once');paragraphs.push({section,paragraph,scalars,utf16:expected.length,rows});
 }
 return paragraphs;
}
async function save(d,format,pwd,label){
 const before=snapshot(d),events=d.getEventLog(),source=artifact(d,'hwp').bytes,coverage=bodyCoverage(d),a=artifact(d,format,pwd);
 assert.equal(a.loss.count,0,JSON.stringify(a.loss));const guard=verifyPreservedExport(d,a.bytes,format,a.loss,b=>open(b,pwd));assert.equal(guard.status,'checked');
 const file=join(out,label+'.'+format);await writeFile(file,a.bytes);const disk=await readFile(file);assert.deepEqual(disk,a.bytes);
 if(pwd){assert.throws(()=>HwpDocument.openWithPassword(disk,'incorrect-own154-password'));wrongPasswordRefusals++;}
 const next=open(disk,pwd);
 try{
  assert.equal(compareSnapshots(before,snapshot(next)).status,'SAME_WITHIN_PUBLISHED_CONTRACT');assert.deepEqual(bodyCoverage(next),coverage);
  assert.deepEqual(snapshot(d),before);assert.equal(d.getEventLog(),events);assert.deepEqual(artifact(d,'hwp').bytes,source);
  observations.push({label,format,encrypted:!!pwd,guard:guard.status,sha256:hash(disk),coverage});return next;
 }catch(e){next.free();throw e;}
}
const variants=[['initial',''],['ascii7','Retained current prefix editing causes line reflow. '.repeat(7)],['ascii15','Retained current prefix editing causes line reflow. '.repeat(15)],['astral','현재😀 𠮷 supplementary plain body reflows across columns. '.repeat(15)]];
for(const origin of ['native','xml'])for(const [variant,payload]of variants)for(const encrypted of [false,true]){
 const name=`${origin}-${variant}-${encrypted?'password':'plain'}`,pwd=encrypted?'Own154-password':'',input=await readFile(join(own,origin==='native'?fixture.file:fixture.xmlFile));
 assert.equal(hash(input),origin==='native'?fixture.sha256:fixture.xmlSha256);let d=new HwpDocument(input),phase='public-edit';
 try{
  const initial=snapshot(d),undo=d.saveSnapshot(),original=d.getTextRange(0,0,0,d.getParagraphLength(0,0));if(payload)d.insertText(0,0,d.getParagraphLength(0,0),payload);
  assert.equal(d.getTextRange(0,0,0,d.getParagraphLength(0,0)),original+payload,'the requested public edit must actually change the source text');
  const edited=snapshot(d),redo=d.saveSnapshot();d.restoreSnapshot(undo);assert.deepEqual(snapshot(d),initial);d.restoreSnapshot(redo);assert.deepEqual(snapshot(d),edited);historyPairs++;
  for(const [cycle,format]of ['hwpx','hwpx','hwpx','hwp','hwpx'].entries()){
   phase='disk-cycle-'+cycle;const next=await save(d,format,pwd,`${name}-${cycle}`);d.free();d=next;
  }
  phase='retained-tail-edit';const paragraph=d.getParagraphCount(0)-1,before=snapshot(d),u=d.saveSnapshot(),tail=d.getTextRange(0,paragraph,0,d.getParagraphLength(0,paragraph));d.insertText(0,paragraph,0,'후속 😀 tail154 ');
  assert.equal(d.getTextRange(0,paragraph,0,d.getParagraphLength(0,paragraph)),'후속 😀 tail154 '+tail,'the retained tail edit must actually change the source text');const after=snapshot(d),r=d.saveSnapshot();
  for(const format of ['hwp','hwpx']){const next=await save(d,format,pwd,name+'-tail');next.free();}
  d.restoreSnapshot(u);assert.deepEqual(snapshot(d),before);d.restoreSnapshot(r);assert.deepEqual(snapshot(d),after);historyPairs++;results.push({name,status:'PASS'});console.log('PASS',name);
 }catch(e){const row={name,status:'FAIL',phase,error:String(e),stack:e.stack,report:e.report};results.push(row);failures.push(row);console.log('FAIL',name,phase,String(e).slice(0,300));}finally{d.free();}
}
assert.equal(results.length,16);assert.equal(hash(await readFile(join(own,'manifest.json'))),hash(manifestBytes));
for(const source of sourceHashes)assert.equal(hash(await readFile(join(root,'apps/editor/src/adapters/rhwp',source.path))),source.sha256);
assert.equal(hash(await readFile(verifierPath)),verifierSha256,'verifier bytes must stay unchanged during execution');
const report={engine:engine.metadata,results,failures,observations,historyPairs,wrongPasswordRefusals,sourceHashes,manifestSha256:hash(manifestBytes),verifierSha256,scope:'Pinned unequal three-column positioned-table input: Native/XML × unchanged/ASCII7/ASCII15/astral × plain/password. Actual public edits with exact insertion assertions, all-body scalar/UTF16 coverage, five retained mixed-format disk cycles and two tail exports, exact Undo/Redo, unchanged production whole semantic/geometry guard0.2, source/events immutability. No private model, source-row/lease repair, GUI/Hancom, provider or credential access.'};
await writeFile(join(out,'result.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:16-failures.length,total:16,exports:observations.length,historyPairs,wrongPasswordRefusals}));if(failures.length)process.exitCode=1;
