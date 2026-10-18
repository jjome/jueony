// Reproduce the two repository-owned generation119 inputs used by N001.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadReviewEngine,hash} from './lib/hancom-review.mjs';
for(const key of ['JUEONY_ENGINE_PACKAGE','JUEONY_TEST_OUTPUT'])assert.ok(isAbsolute(process.env[key]??''),key);
const repo=resolve(fileURLToPath(new URL('../../..',import.meta.url))),out=resolve(process.env.JUEONY_TEST_OUTPUT),engine=await loadReviewEngine(process.env.JUEONY_ENGINE_PACKAGE);
assert.equal(engine.metadata.sourceId,'704c7d510eb58bc2');assert.equal(engine.metadata.wasmSha256,'5f117ad797d5882f32aaff5c05f1b121db23d880cba9c79b66787ecdbec0fc51');
const input=await readFile(resolve(repo,'docs/evidence/file-completion-2026-10-18/engine76/columns-native/fixtures/build/file-closure69-public/column2-candidate74/valid-negative-disk/baseline-single_column.hwp'));
assert.equal(hash(input),'9778d66926e3138ce4bb51fadfd16173ee3d439aeec0a02a8f0af34b7fac0f3b');
await mkdir(out,{recursive:true});const d=new engine.HwpDocument(input),results=[];
try{
 d.insertText(0,0,d.getParagraphLength(0,0),'앞 문단 줄바꿈을 유발하는 본문입니다. '.repeat(25));
 for(const kind of ['ordinary','stamped']){
  const state=JSON.parse(d.getDocumentStoredInformationEditState()),a=kind==='ordinary'?d.exportHwpWithReport():d.exportStampedDocumentWithReport('hwp',state.fingerprint,JSON.stringify({schemaVersion:1,values:{modified:'133536420007654321',editingDuration:'123456789012345'}}));
  try{assert.equal(JSON.parse(a.contentLoss()).count,0);const bytes=a.takeBytes(),name=kind+'-prefix-native.hwp';await writeFile(resolve(out,name),bytes);results.push({path:name,bytes:bytes.length,sha256:hash(bytes)});}finally{a.free();}
 }
}finally{d.free();}
await writeFile(resolve(out,'manifest.json'),JSON.stringify({engine:engine.metadata.sourceId,inputSha256:hash(input),operation:'Public insert followed by ordinary or explicit timestamped HWP export; no descriptor edited/removed and no private lease constructed.',files:results},null,2));console.log(JSON.stringify(results));
