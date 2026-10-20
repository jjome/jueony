// A fixed deliberately oversized negative is never counted as storage support.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadReviewEngine,hash,snapshot} from './lib/hancom-review.mjs';
import {verifyPreservedExport,PreservationError} from '../src/adapters/rhwp/preservation.ts';
for(const k of ['JUEONY_ENGINE_PACKAGE','JUEONY_TEST_OUTPUT'])assert.ok(isAbsolute(process.env[k]??''),k);
const repo=resolve(fileURLToPath(new URL('../../..',import.meta.url))),out=resolve(process.env.JUEONY_TEST_OUTPUT);
const fixtures=resolve(repo,'apps/editor/tests/fixtures/n001-signed-short177-own');await mkdir(out,{recursive:true});
const manifestBytes=await readFile(resolve(fixtures,'manifest.json'));
assert.equal(hash(manifestBytes),'785d405f863ae6d85955b51034dd0052d1a193585e93d41c6c4a2ad7465fdb69');
const fixture=JSON.parse(manifestBytes).fixtures.find(f=>f.name==='unequal3-negative-oversize');assert.ok(fixture);
const engine=await loadReviewEngine(process.env.JUEONY_ENGINE_PACKAGE),{HwpDocument}=engine,results=[],failures=[];
function take(a){try{return {bytes:Buffer.from(a.takeBytes()),loss:JSON.parse(a.contentLoss())};}finally{a.free();}}
for(const origin of ['native','xml'])for(const password of ['','SignedNegative157']){
 const name=origin+'-'+(password?'password':'plain'),bytes=await readFile(resolve(fixtures,'fixtures',fixture.name+(origin==='native'?'.hwp':'.hwpx')));
 assert.equal(hash(bytes),fixture[origin+'Sha256']);const d=new HwpDocument(bytes);
 try{
  d.insertText(0,0,d.getParagraphLength(0,0),'Signed negative current prefix reflows across columns. '.repeat(8));
  const before=snapshot(d),events=d.getEventLog(),source=take(d.exportHwpWithReport()).bytes;
  const exported=take(password?d.exportHwpxWithPasswordAndReport(password):d.exportHwpxWithReport());
  assert.equal(exported.loss.count,0,'isolate the known layout refusal');
  // Only an owned temporary evidence file is written; no source/target save port runs.
  const path=resolve(out,name+'.hwpx');await writeFile(path,exported.bytes);assert.deepEqual(await readFile(path),exported.bytes);
  let rejection;try{verifyPreservedExport(d,exported.bytes,'hwpx',exported.loss,b=>password?HwpDocument.openWithPassword(b,password):new HwpDocument(b));}catch(e){rejection=e;}
  assert.ok(rejection instanceof PreservationError,'must reject through the real production preservation contract');
  assert.equal(rejection.report.status,'blocked');
  assert.ok(rejection.report.issues.some(i=>i.code==='changed'&&i.path.startsWith('whole-document-published-layout/')));
  assert.deepEqual(snapshot(d),before);assert.equal(d.getEventLog(),events);assert.deepEqual(take(d.exportHwpWithReport()).bytes,source);
  if(password)assert.throws(()=>HwpDocument.openWithPassword(exported.bytes,'wrong-signed-oversize'));
  results.push({name,status:'PASS',inputSha256:hash(bytes),outputSha256:hash(exported.bytes),rejection:rejection.report});
 }catch(e){results.push({name,status:'FAIL'});failures.push({name,error:String(e),stack:e.stack});}
 finally{d.free();}
}
const sourcePaths=['scripts/lib/hancom-review.mjs','src/adapters/rhwp/preservation.ts','src/adapters/rhwp/document-stored-information.ts','src/adapters/rhwp/document-save-layout.ts','src/adapters/rhwp/overlap-save-layout.ts'];
await writeFile(resolve(out,'result.json'),JSON.stringify({engine:engine.metadata,manifestSha256:hash(manifestBytes),verifierSha256:hash(await readFile(fileURLToPath(import.meta.url))),sourceHashes:await Promise.all(sourcePaths.map(async path=>({path,sha256:hash(await readFile(resolve(repo,'apps/editor',path)))}))),results,failures,scope:'Four deliberate oversized HWPX refusals through the unchanged production whole-document geometry guard. Native/XML, plain/password, disk readback, source bytes/snapshot/events exact. No unsafe target save or positive-support claim; separate from valid short8/48.'},null,2));
assert.equal(results.length,4);assert.deepEqual(failures,[]);assert.ok(results.every(r=>r.status==='PASS'));console.log('PASS 4 deliberate oversized refusals');
