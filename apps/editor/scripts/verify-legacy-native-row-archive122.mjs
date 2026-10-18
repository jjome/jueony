// N001: retain stale opaque bytes without promoting them to layout authority.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadReviewEngine,hash,snapshot,compareSnapshots} from './lib/hancom-review.mjs';
import {ownCfbStream,ownZipEntries,ownZipPart,ownZip,PASSIVE_ROW_PART} from './lib/n001-owned-container.mjs';
import {verifyPreservedExport} from '../src/adapters/rhwp/preservation.ts';
for(const key of ['JUEONY_ENGINE_PACKAGE','JUEONY_TEST_OUTPUT'])assert.ok(isAbsolute(process.env[key]??''),key);
const repo=resolve(fileURLToPath(new URL('../../..',import.meta.url))),out=resolve(process.env.JUEONY_TEST_OUTPUT),engine=await loadReviewEngine(process.env.JUEONY_ENGINE_PACKAGE),{HwpDocument}=engine;
await mkdir(out,{recursive:true});const results=[],failures=[],observations=[];
const sourcePaths=['src/adapters/rhwp/preservation.ts','src/adapters/rhwp/document-stored-information.ts','src/adapters/rhwp/document-save-layout.ts','src/adapters/rhwp/overlap-save-layout.ts'];
const fingerprints=()=>Promise.all(sourcePaths.map(async path=>({path,sha256:hash(await readFile(resolve(repo,'apps/editor',path)))}))),sourceHashes=await fingerprints();
const fixtures=[['ordinary-prefix-native.hwp','c130c61777775304f96085db8084041da700b55fc51f51d5959b8b6470d7894c'],['stamped-prefix-native.hwp','66c29b4047707b4aa7077b0f531146163cb2110102dd2395709d4aee9b6c99d9']];
function take(a){try{return{bytes:Buffer.from(a.takeBytes()),loss:JSON.parse(a.contentLoss())};}finally{a.free();}}
function artifact(d,format,pwd){return take(format==='hwp'?(pwd?d.exportHwpWithPasswordAndReport(pwd):d.exportHwpWithReport()):(pwd?d.exportHwpxWithPasswordAndReport(pwd):d.exportHwpxWithReport()));}
function passiveFromOpen(d,raw){const a=artifact(d,'hwpx');assert.equal(a.loss.count,0);assert.deepEqual(ownZipPart(a.bytes,PASSIVE_ROW_PART),raw);return a.bytes;}
function checkPlainNative(bytes,raw){
 const active=ownCfbStream(bytes,'RhwpComputedNativeRowsV1'),archive=ownCfbStream(bytes,'RhwpArchivedNativeRowsV1');
 if(active?.equals(raw)){assert.equal(archive,null,'Original Native opaque owner need not be relocated');return;}
 assert.ok(archive,'Passive Native envelope');assert.equal(archive.subarray(0,16).toString('ascii'),'RHWP-OPAQUE-ROW\0');assert.equal(archive.readUInt32LE(16),1);assert.equal(Number(archive.readBigUInt64LE(20)),raw.length);assert.equal(archive.length,60+raw.length);assert.equal(archive.subarray(28,60).toString('hex'),hash(raw));assert.deepEqual(archive.subarray(60),raw);
}
async function run(name,fn){try{await fn();results.push({name,status:'PASS'});console.log('PASS',name);}catch(e){results.push({name,status:'FAIL'});failures.push({name,error:String(e),stack:e.stack});console.log('FAIL',name,String(e));}}
async function roundtrip(d,format,pwd,raw,label){
 const before=snapshot(d),source=artifact(d,'hwp').bytes,a=artifact(d,format,pwd);assert.equal(a.loss.count,0,JSON.stringify(a.loss));
 const open=b=>pwd?HwpDocument.openWithPassword(b,pwd):new HwpDocument(b);assert.equal(verifyPreservedExport(d,a.bytes,format,a.loss,open).status,'checked');
 if(!pwd){if(format==='hwp')checkPlainNative(a.bytes,raw);else assert.deepEqual(ownZipPart(a.bytes,PASSIVE_ROW_PART),raw);}
 else{if(format==='hwpx')assert.notDeepEqual(ownZipPart(a.bytes,PASSIVE_ROW_PART),raw,'Archive must be password protected');assert.throws(()=>openWrong(a.bytes));}
 await writeFile(resolve(out,label+'.'+format),a.bytes);const disk=await readFile(resolve(out,label+'.'+format));assert.deepEqual(disk,a.bytes);const n=open(disk);
 try{assert.equal(compareSnapshots(before,snapshot(n)).status,'SAME_WITHIN_PUBLISHED_CONTRACT');passiveFromOpen(n,raw);assert.deepEqual(snapshot(d),before);assert.deepEqual(artifact(d,'hwp').bytes,source);observations.push({label,format,password:!!pwd,sha256:hash(disk),opaqueSha256:hash(raw),loss:0,strictGuard:'checked',geometryDifferences:0,sourceUnchanged:true,diskReadbackExact:true});return n;}catch(e){n.free();throw e;}
}
function openWrong(bytes){let d;try{d=HwpDocument.openWithPassword(bytes,'wrong-own122-password');return d;}finally{d?.free();}}
const inputs=[];
for(const[name,sha]of fixtures){const bytes=await readFile(resolve(repo,'apps/editor/tests/fixtures/n001-legacy237-own',name));assert.equal(hash(bytes),sha);const raw=ownCfbStream(bytes,'RhwpComputedNativeRowsV1');assert.ok(raw);inputs.push({name,sha,bytes,raw});}
for(const input of inputs)for(const format of ['hwp','hwpx'])for(const encrypted of [false,true])await run(`${input.name}: edit then ${format} ${encrypted?'password':'plain'}`,async()=>{
 const d=new HwpDocument(input.bytes);try{d.insertText(0,0,d.getParagraphLength(0,0),' Compatibility retained body edit.');const n=await roundtrip(d,format,encrypted?'own122-password':null,input.raw,input.name+'-'+format+'-'+encrypted);n.free();assert.equal(hash(input.bytes),input.sha);}finally{d.free();}
});
for(const input of inputs)await run(input.name+': repeated format/password changes retain same opaque payload',async()=>{
 let d=new HwpDocument(input.bytes);try{d.insertText(0,0,d.getParagraphLength(0,0),' Repeated conversion.');const expected=snapshot(d);for(const[cycle,format,pwd]of [[0,'hwpx',null],[1,'hwp','own122-cycle1'],[2,'hwpx','own122-cycle2'],[3,'hwp',null]]){const n=await roundtrip(d,format,pwd,input.raw,input.name+'-cycle'+cycle);assert.equal(compareSnapshots(expected,snapshot(n)).status,'SAME_WITHIN_PUBLISHED_CONTRACT');d.free();d=n;}}finally{d.free();}
});
// Deliberate malformed-container inputs for refusal tests only. Positive saves
// above never add, remove or repair private payloads in the test harness.
const probe=new HwpDocument(inputs[0].bytes);let base;try{base=ownZipEntries(artifact(probe,'hwpx').bytes).filter(([p])=>p!==PASSIVE_ROW_PART);base.push([PASSIVE_ROW_PART,inputs[0].raw]);}finally{probe.free();}
for(const[kind,alter]of [
 ['alias path',entries=>entries.map(([p,b])=>[p===PASSIVE_ROW_PART?'META-INF/./rhwp-opaque-native-row-stream-v1.bin':p,b])],
 ['conflicting duplicate',entries=>[...entries,[PASSIVE_ROW_PART,Buffer.from('different original bytes')]]],
 ['oversize payload',entries=>entries.map(([p,b])=>[p,p===PASSIVE_ROW_PART?Buffer.alloc(2*1024*1024+1):b])],
 ['raw private name remapped away by Unicode extra',entries=>entries.map(([p,b])=>[p,b,...(p===PASSIVE_ROW_PART?[{unicodePath:'META-INF/ignored-passive.bin'}]:[])])],
 ['unrelated raw name remapped to private by Unicode extra',entries=>entries.map(([p,b])=>p===PASSIVE_ROW_PART?['META-INF/ignored-passive.bin',b,{unicodePath:PASSIVE_ROW_PART}]:[p,b])]
])await run('Passive archive safely rejects '+kind,()=>{const bytes=ownZip(alter(base)),sha=hash(bytes);let rejected=false;try{const d=new HwpDocument(bytes);d.free();}catch(e){assert.ok(!(e instanceof WebAssembly.RuntimeError));assert.doesNotMatch(String(e),/unreachable|memory access out of bounds|out of memory/i);rejected=true;}assert.equal(rejected,true);assert.equal(hash(bytes),sha);});
await run('Duplicate valid encrypted ZIP owner refuses before password package rewrite',()=>{const d=new HwpDocument(inputs[0].bytes);let encrypted;try{encrypted=artifact(d,'hwpx','own122-duplicate-password').bytes;}finally{d.free();}const entries=ownZipEntries(encrypted),part=entries.find(([p])=>p===PASSIVE_ROW_PART);assert.ok(part);const bad=ownZip([...entries,part]);let refused=false;try{const n=HwpDocument.openWithPassword(bad,'own122-duplicate-password');n.free();}catch(e){assert.ok(!(e instanceof WebAssembly.RuntimeError));refused=true;}assert.equal(refused,true);});
assert.equal(results.length,16);assert.deepEqual(await fingerprints(),sourceHashes);
const report={schemaVersion:1,scope:'N001 actual WASM; unchanged production semantic/layout guards plus independent raw SHA/container checks. Existing119 inputs remain stale/opaque; no old resource allowlist. Native/HWPX/plain/password changes, disk reopen, refusal negatives. Not Hancom GUI/print certification.',engine:engine.metadata,verifierSha256:hash(await readFile(fileURLToPath(import.meta.url))),sourceHashes,fixtures:inputs.map(({name,sha,raw})=>({name,sha256:sha,opaqueSha256:hash(raw)})),results,observations,failures,passed:results.filter(v=>v.status==='PASS').length,total:results.length};
await writeFile(resolve(out,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,total:report.total,failures}));if(failures.length)process.exitCode=1;
