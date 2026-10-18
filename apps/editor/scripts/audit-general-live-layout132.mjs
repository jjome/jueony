// N001 independent old/new reader audit. Geometry changes remain evidence;
// this audit does not silently bless them as file-format compatibility.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,isAbsolute,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadReviewEngine,hash,snapshot,compareSnapshots} from './lib/hancom-review.mjs';
for(const key of ['JUEONY_BASELINE_ENGINE','JUEONY_ENGINE_PACKAGE','JUEONY_TEST_OUTPUT'])assert.ok(isAbsolute(process.env[key]??''),key);
const repo=resolve(fileURLToPath(new URL('../../..',import.meta.url))),out=resolve(process.env.JUEONY_TEST_OUTPUT);
await mkdir(join(out,'snapshots'),{recursive:true});
const old=await loadReviewEngine(process.env.JUEONY_BASELINE_ENGINE),next=await loadReviewEngine(process.env.JUEONY_ENGINE_PACKAGE);
assert.equal(old.metadata.wasmSha256,'5d32d09c73eeb5148c981422c3452e91c6b231a1fb87076a65e3fee04774fe36');
assert.notEqual(next.metadata.wasmSha256,old.metadata.wasmSha256,'Requires independently compiled new engine');
const observations=[],failures=[];
async function observe(label,bytes,edit,stable){
 const a=new old.HwpDocument(bytes),b=new next.HwpDocument(bytes);
 try{
  if(edit){edit(a);edit(b);}
  const ea=a.getEventLog(),eb=b.getEventLog(),before=snapshot(a),after=snapshot(b),comparison=compareSnapshots(before,after);
  assert.equal(a.getEventLog(),ea);assert.equal(b.getEventLog(),eb);
  assert.equal(a.getTextFileUnicode(),b.getTextFileUnicode());
  assert.equal(comparison.semantic.count,0,'Same operations must preserve identical public document values');
  const path=join(out,'snapshots',label+'.json');const data=JSON.stringify({before,after,comparison},null,2);await writeFile(path,data);
  observations.push({label,fixtureSha256:hash(bytes),stableGeometryRequired:stable,semanticDifferences:comparison.semantic.count,geometryDifferences:comparison.geometry.count,pages:comparison.pages,snapshotSha256:hash(Buffer.from(data))});
  if(stable)assert.equal(comparison.geometry.count,0,'Unexpected original Native single-column render regression');
 }catch(error){failures.push({label,error:String(error),stack:error.stack});}finally{a.free();b.free();}
}
const own=join(repo,'apps/editor/tests/fixtures/n001-general125-own'),manifest=JSON.parse(await readFile(join(own,'manifest.json')));
const inputs=manifest.fixtures.flatMap(f=>[{file:f.file,sha256:f.sha256},{file:f.xmlFile,sha256:f.xmlSha256}]);
assert.equal(inputs.length,44);
for(const fixture of inputs){const bytes=await readFile(join(own,fixture.file));assert.equal(hash(bytes),fixture.sha256);
 const stable=fixture.file.endsWith('.hwp')&&!/columns|unequal/.test(fixture.file);
 await observe(fixture.file+'-initial',bytes,null,stable);
 await observe(fixture.file+'-edited',bytes,d=>d.insertText(0,0,d.getParagraphLength(0,0),'현재 문맥으로 복합 배치를 다시 조판하는 자체 시험 문장입니다. '.repeat(25)),stable);
}
const baseline=await readFile(join(repo,'docs/evidence/file-completion-2026-10-18/engine76/columns-native/fixtures/build/file-closure69-public/column2-candidate74/valid-negative-disk/baseline-single_column.hwp'));
assert.equal(hash(baseline),'9778d66926e3138ce4bb51fadfd16173ee3d439aeec0a02a8f0af34b7fac0f3b');
const call=v=>{const x=typeof v==='string'?JSON.parse(v):v;assert.ok(x?.ok!==false,JSON.stringify(x));};
for(const name of ['reference','interleave','multiple-interleave','three-created','four-created'])await observe('public-'+name,baseline,d=>{
 if(name==='interleave'){call(d.insertParagraph(0,2));d.insertText(0,2,0,'표 사이의 본문을 그대로 유지합니다. '.repeat(4));}
 if(name==='multiple-interleave')for(let i=0;i<3;i++){call(d.insertParagraph(0,2+i));d.insertText(0,2+i,0,'독립 본문 '+i+' '.repeat(2));}
 if(name==='three-created'||name==='four-created')for(let i=0;i<(name==='three-created'?1:2);i++)call(d.createTableEx(JSON.stringify({sectionIdx:0,paraIdx:d.getParagraphCount(0)-1,charOffset:0,rowCount:2,colCount:2,treatAsChar:false})));
 d.insertText(0,0,d.getParagraphLength(0,0),'현재 문맥으로 복합 배치를 다시 조판하는 자체 시험 문장입니다. '.repeat(25));
},true);
await writeFile(join(out,'result.json'),JSON.stringify({baseline:old.metadata,target:next.metadata,observations,failures,verifierSha256:hash(await readFile(fileURLToPath(import.meta.url))),scope:'Fixed44 original and edited inputs plus5 public Native scenarios, independent old126/new readers. Full unchanged semantic values and every public geometry field; original single-column Native must remain stable. Multicolumn/XML deltas are recorded in full, never normalized or declared compatible here. No private row repairs, OS/Hancom, LLM or user documents.'},null,2));
console.log(JSON.stringify({observations:observations.length,stable:observations.filter(x=>x.stableGeometryRequired).length,changed:observations.filter(x=>x.geometryDifferences).map(x=>({label:x.label,count:x.geometryDifferences})),failures}));
if(failures.length)process.exitCode=1;
