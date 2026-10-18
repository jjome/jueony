// Reproduce our own historical stack fixture; no commercial documents or UI.
// Required absolute paths: JUEONY_BASELINE_ENGINE_PACKAGE (official113 package),
// JUEONY_LEGACY_STACK_FIXTURES (an empty/new output directory). Run from any cwd.
// Example (PowerShell, repository root):
// $env:JUEONY_BASELINE_ENGINE_PACKAGE=(Resolve-Path 'build/rhwp-engine/source-fc150ef856868d03/pkg').Path
// $env:JUEONY_LEGACY_STACK_FIXTURES=[IO.Path]::GetFullPath('build/reproduced-legacy-stack115')
// node --experimental-strip-types --no-warnings apps/editor/scripts/generate-legacy-stack-fixtures115.mjs
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join,dirname,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadReviewEngine,snapshot,compareSnapshots,hash} from './lib/hancom-review.mjs';
import {readOwnedZip,writeOwnedZip} from './lib/owned-zip.mjs';
import {verifyPreservedExport} from '../src/adapters/rhwp/preservation.ts';
for(const name of ['JUEONY_BASELINE_ENGINE_PACKAGE','JUEONY_LEGACY_STACK_FIXTURES'])assert.ok(isAbsolute(process.env[name]??''),name+' must be absolute');
const app=resolve(dirname(fileURLToPath(import.meta.url)),'..'),repo=resolve(app,'../..'),out=resolve(process.env.JUEONY_LEGACY_STACK_FIXTURES);
const engine=await loadReviewEngine(process.env.JUEONY_BASELINE_ENGINE_PACKAGE);
assert.equal(engine.metadata.sourceId,'fc150ef856868d03');
assert.equal(engine.metadata.wasmSha256,'569268eb2fed77851e7449cf19e37dadbee629f68a12f642bb76b49de06369bc');
assert.equal(engine.metadata.jsSha256,'5b10dbb379d8d609e466b816ccf25697d87a376f0e17481f63e4d9ef0156c57a');
const fixture=join(repo,'docs/evidence/file-completion-2026-10-18/engine76/columns-native/fixtures/build/file-closure69-public/column2-candidate74/valid-negative-disk/baseline-single_column.hwp');
const source=await readFile(fixture);assert.equal(hash(source),'9778d66926e3138ce4bb51fadfd16173ee3d439aeec0a02a8f0af34b7fac0f3b');
const d=new engine.HwpDocument(source);let bytes,reference;
try{
 d.insertText(0,0,d.getParagraphLength(0,0),'앞 문단 줄바꿈을 유발하는 본문입니다. '.repeat(25));reference=snapshot(d);
 const a=d.exportHwpxWithReport();try{bytes=a.takeBytes();const loss=JSON.parse(a.contentLoss());assert.equal(loss.count,0);assert.equal(verifyPreservedExport(d,bytes,'hwpx',loss,b=>new engine.HwpDocument(b)).status,'checked');}finally{a.free();}
 const reopened=new engine.HwpDocument(bytes);try{assert.equal(compareSnapshots(reference,snapshot(reopened)).status,'SAME_WITHIN_PUBLISHED_CONTRACT');}finally{reopened.free();}
 assert.deepEqual(snapshot(d),reference);
}finally{d.free();}
const path='META-INF/rhwp-computed-native-rows-v1.json',entries=readOwnedZip(bytes),descriptor=JSON.parse(new Map(entries).get(path));
assert.equal(descriptor.entries.length,6,'actual baseline113 computed entries');
const outputs={
 'old113-column-prefix-reflow.hwpx':Buffer.from(bytes),
 'old113-with-descriptor-removed.hwpx':writeOwnedZip(entries.filter(([name])=>name!==path)),
 'old113-reference.json':Buffer.from(JSON.stringify(reference)),
};
const expected={
 'old113-column-prefix-reflow.hwpx':'12a28b993fda7a5f48dc824fb3163fc447a1186644d9935ca0902e7a646fde89',
 'old113-with-descriptor-removed.hwpx':'2db827d8b0c5a039cd38a392f2497959495e35c928e325efaf93439ce2522f9f',
 'old113-reference.json':'6abe51b865790ae4da8af2bb9a80b996fc74507fa851391b5e83f87990ed1f83'};
// The old package includes deterministic ZIP entries. These pins also reject
// using a different generation, current export, reader, or codec by accident.
for(const[name,value]of Object.entries(outputs))assert.equal(hash(value),expected[name],name+' exact historical output');
await mkdir(out,{recursive:true});
for(const[name,value]of Object.entries(outputs))await writeFile(join(out,name),value,{flag:'wx'});
assert.equal(hash(await readFile(fixture)),hash(source));
await writeFile(join(out,'fixture-provenance.json'),JSON.stringify({generatorSha256:hash(await readFile(fileURLToPath(import.meta.url))),engine:engine.metadata,source:{path:fixture,sha256:hash(source)},inputHashes:expected,node:process.version,zlib:process.versions.zlib,commercialAssets:false},null,2),{flag:'wx'});
console.log('BASELINE113_FIXTURES_REPRODUCED',JSON.stringify(expected));
