// Same 14 public-engine scenarios as the frozen private verifier. No Hancom/UI.
// Fixtures are our tracked column fixture + pinned baseline113 engine output.
// Recreate them with generate-legacy-stack-fixtures115.mjs; all three SHA pins
// must match. The fixed whole preservation reader and 0.2 geometry contract apply.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join,isAbsolute,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadReviewEngine,snapshot,compareSnapshots,differences,hash} from './lib/hancom-review.mjs';
import {verifyPreservedExport} from '../src/adapters/rhwp/preservation.ts';
import {readOwnedZip} from './lib/owned-zip.mjs';
for(const name of ['JUEONY_LEGACY_STACK_FIXTURES','JUEONY_TEST_OUTPUT','JUEONY_ENGINE_PACKAGE'])assert.ok(isAbsolute(process.env[name]??''),name+' must be an absolute path');
const base=resolve(process.env.JUEONY_LEGACY_STACK_FIXTURES),out=resolve(process.env.JUEONY_TEST_OUTPUT),engine=await loadReviewEngine(process.env.JUEONY_ENGINE_PACKAGE);await mkdir(out,{recursive:true});
const app=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const verifierSha256=hash(await readFile(fileURLToPath(import.meta.url)));
const inputHashes={
 'old113-with-descriptor-removed.hwpx':'2db827d8b0c5a039cd38a392f2497959495e35c928e325efaf93439ce2522f9f',
 'old113-column-prefix-reflow.hwpx':'12a28b993fda7a5f48dc824fb3163fc447a1186644d9935ca0902e7a646fde89',
 'old113-reference.json':'6abe51b865790ae4da8af2bb9a80b996fc74507fa851391b5e83f87990ed1f83'};
for(const [name,expected]of Object.entries(inputHashes))assert.equal(hash(await readFile(join(base,name))),expected,name+' pinned own-fixture SHA');
const sourceFiles={'preservation.ts':resolve(app,'src/adapters/rhwp/preservation.ts'),'hancom-review.mjs':resolve(app,'scripts/lib/hancom-review.mjs'),'owned-zip.mjs':resolve(app,'scripts/lib/owned-zip.mjs')};
const sourceHashes=Object.fromEntries(await Promise.all(Object.entries(sourceFiles).map(async([name,path])=>[name,hash(await readFile(path))])));
const reference=JSON.parse(await readFile(join(base,'old113-reference.json'))),results=[],failures=[];
const read=b=>new engine.HwpDocument(b),descriptor='META-INF/rhwp-computed-native-rows-v1.json';
async function scenario(name,run){try{const detail=await run();results.push({name,status:'PASS',...detail});console.log('PASS',name);}catch(e){const f={name,status:'FAIL',error:String(e),stack:e.stack};results.push(f);failures.push(f);console.log('FAIL',name,String(e));}}
function artifact(d,format='hwpx'){const a=format==='hwpx'?d.exportHwpxWithReport():d.exportHwpWithReport();try{return{bytes:a.takeBytes(),loss:JSON.parse(a.contentLoss())};}finally{a.free();}}
function exact(a,b){const c=compareSnapshots(a,b);assert.equal(c.status,'SAME_WITHIN_PUBLISHED_CONTRACT',JSON.stringify(c));return{geometry:c.geometry.count,semantic:c.semantic.count};}
async function checkedSave(d,format,label){const before=snapshot(d),a=artifact(d,format);assert.equal(a.loss.count,0);const guard=verifyPreservedExport(d,a.bytes,format,a.loss,read);assert.equal(guard.status,'checked',JSON.stringify(guard));const path=join(out,label+'.'+format);await writeFile(path,a.bytes);const disk=await readFile(path);assert.deepEqual(disk,Buffer.from(a.bytes));const n=read(disk);const e=exact(before,snapshot(n));exact(before,snapshot(d));if(format==='hwpx')assert.ok(!new Map(readOwnedZip(disk)).has(descriptor));return{doc:n,detail:{...e,bytes:disk.length,sha256:hash(disk),guard:'checked',descriptor:format==='hwpx'?false:'CFB-not-inspected'}};}
for(const file of ['old113-with-descriptor-removed.hwpx','old113-column-prefix-reflow.hwpx']){
 const input=await readFile(join(base,file)),sourceSha=hash(input);
 await scenario(file+'/initial',async()=>{const d=read(input);try{assert.deepEqual(differences(reference.layout,snapshot(d).layout,0.2),[]);return{geometry:0,sourceSha};}finally{d.free();}});
 await scenario(file+'/xml3',async()=>{let d=read(input);const cycles=[];try{for(let cycle=0;cycle<3;cycle++){const s=await checkedSave(d,'hwpx',file+'-xml-'+cycle);d.free();d=s.doc;cycles.push(s.detail);}return{cycles};}finally{d.free();}});
 await scenario(file+'/legacy',async()=>{const d=read(input);let n;try{const before=snapshot(d),bytes=d.exportHwpx();n=read(bytes);return exact(before,snapshot(n));}finally{n?.free();d.free();}});
 for(const report of [false,true])await scenario(file+'/password-'+report,async()=>{const d=read(input);let n;try{const before=snapshot(d);let bytes;if(report){const a=d.exportHwpxWithPasswordAndReport('Owned115');try{bytes=a.takeBytes();assert.equal(JSON.parse(a.contentLoss()).count,0);}finally{a.free();}}else bytes=d.exportHwpxWithPassword('Owned115');n=engine.HwpDocument.openWithPassword(bytes,'Owned115');exact(before,snapshot(d));return exact(before,snapshot(n));}finally{n?.free();d.free();}});
 await scenario(file+'/history-retained-tail-both-formats',async()=>{const initial=read(input);let d;try{const s=await checkedSave(initial,'hwpx',file+'-history-first');d=s.doc;const before=snapshot(d),u=d.saveSnapshot();d.insertText(0,3,0,'Q');const edited=snapshot(d),r=d.saveSnapshot();d.restoreSnapshot(u);exact(before,snapshot(d));for(const f of ['hwp','hwpx']){const s=await checkedSave(d,f,file+'-undo-'+f);s.doc.free();}d.restoreSnapshot(r);exact(edited,snapshot(d));for(const f of ['hwp','hwpx']){const s=await checkedSave(d,f,file+'-redo-'+f);s.doc.free();}return{undo:0,redo:0,guardedExports:5};}finally{d?.free();initial.free();}});
 await scenario(file+'/mixed-hwpx-hwp-hwpx',async()=>{let d=read(input);const cycles=[];try{for(const [i,f]of ['hwpx','hwp','hwpx'].entries()){const s=await checkedSave(d,f,file+'-mixed-'+i);d.free();d=s.doc;cycles.push(s.detail);}return{cycles};}finally{d.free();}});
 assert.equal(hash(await readFile(join(base,file))),sourceSha);
}
for(const[name,expected]of Object.entries(inputHashes))assert.equal(hash(await readFile(join(base,name))),expected,name+' unchanged after execution');
for(const[name,path]of Object.entries(sourceFiles))assert.equal(hash(await readFile(path)),sourceHashes[name],name+' unchanged while executing');
assert.equal(results.length,14,'fixed scenario denominator');
await writeFile(join(out,'result.json'),JSON.stringify({engine:engine.metadata,verifierSha256,sourceHashes,inputHashes,fixtureDirectory:base,results,failures},null,2));if(failures.length)process.exitCode=1;
