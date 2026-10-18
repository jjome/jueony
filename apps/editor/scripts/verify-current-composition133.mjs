import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,isAbsolute,join} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=resolve(fileURLToPath(new URL('../../..',import.meta.url))),sha=x=>createHash('sha256').update(x).digest('hex');
for(const key of ['JUEONY_ENGINE_PACKAGE','JUEONY_TEST_OUTPUT'])assert.ok(isAbsolute(process.env[key]??''),`${key} must be absolute`);
const pkg=resolve(process.env.JUEONY_ENGINE_PACKAGE),out=resolve(process.env.JUEONY_TEST_OUTPUT);await mkdir(out,{recursive:true});
const metadata=JSON.parse(await readFile(join(pkg,'jueony-engine-build.json'),'utf8')),wasm=await readFile(join(pkg,'rhwp_bg.wasm')),js=await readFile(join(pkg,'rhwp.js'));
assert.equal(sha(wasm),metadata.wasmSha256);assert.equal(sha(js),metadata.jsSha256);
const module=await import(pathToFileURL(join(pkg,'rhwp.js')));await module.default({module_or_path:wasm});const {HwpDocument}=module;
const fixtureDir=resolve(root,'apps/editor/tests/fixtures/n001-general125-own'),manifest=JSON.parse(await readFile(join(fixtureDir,'manifest.json'),'utf8'));
const json=x=>typeof x==='string'?JSON.parse(x):x,points=s=>Array.from(s);
function sourceText(d){const count=d.getParagraphLength(0,0),text=d.getTextRange(0,0,0,count);assert.equal(typeof text,'string');assert.equal(points(text).length,count,'API paragraph length counts Unicode scalars, not UTF16 units');return text;}
function coverage(d,expected){
 const source=sourceText(d),chars=points(source),counts=Array(chars.length).fill(0),runs=[],errors=[];let next=0;
 if(source!==expected)errors.push({kind:'source-model-text-changed'});
 for(let page=0;page<d.pageCount();page++)for(const [runIndex,r]of json(d.getPageTextLayout(page)).runs.entries()){
  // Public cell coordinates distinguish local cell paragraph 0 from body 0.
  // Never classify a body run merely by whether its text happens to match.
  if(Object.hasOwn(r,'cellPath')||Object.hasOwn(r,'parentParaIdx')){assert.ok(Array.isArray(r.cellPath)&&r.cellPath.length>0,'published cell owner must be explicit');continue;}
  if(r.secIdx!==0||r.paraIdx!==0)continue;
  assert.equal(typeof r.text,'string');assert.ok(Number.isSafeInteger(r.charStart)&&r.charStart>=0);
  const text=points(r.text),start=r.charStart,end=start+text.length;
  if(start!==next)errors.push({kind:'source-order-or-gap',page,runIndex,expectedScalarStart:next,actualScalarStart:start});
  if(end>chars.length||chars.slice(start,end).join('')!==r.text)errors.push({kind:'run-text-does-not-match-source-scalar-range',page,runIndex,start,end});
  assert.ok(Array.isArray(r.charX)&&r.charX.every(Number.isFinite));
  if(r.charX.length!==text.length+1)errors.push({kind:'published-charX-scalar-count',page,runIndex,scalars:text.length,charX:r.charX.length});
  for(let i=start;i<Math.min(end,counts.length);i++)counts[i]++;
  next=end;runs.push({page,runIndex,start,end,unicodeScalars:text.length,utf16Units:r.text.length,x:r.x,y:r.y,textSha256:sha(r.text)});
 }
 const ranges=predicate=>{const result=[];let start=null;for(let i=0;i<=counts.length;i++){const yes=i<counts.length&&predicate(counts[i]);if(yes&&start===null)start=i;if(!yes&&start!==null){result.push([start,i]);start=null;}}return result;};
 const omitted=ranges(n=>n===0),duplicates=ranges(n=>n>1);if(omitted.length)errors.push({kind:'unpainted-source-scalars',ranges:omitted});if(duplicates.length)errors.push({kind:'duplicate-source-scalars',ranges:duplicates});if(next!==chars.length)errors.push({kind:'source-tail-not-painted',end:next,sourceScalars:chars.length});
 return {status:errors.length?'FAIL':'PASS',sourceSha256:sha(source),sourceScalars:chars.length,sourceUtf16Units:source.length,astralScalars:chars.filter(c=>c.length===2).length,sourceControlUnitsExcludedFromScalarIndexes:true,runs,errors};
}
function artifact(d,format){const a=format==='hwp'?d.exportHwpWithReport():d.exportHwpxWithReport();try{return{bytes:Buffer.from(a.takeBytes()),loss:json(a.contentLoss())};}finally{a.free();}}
const names=['two-columns','three-columns','unequal-two','unequal-three','two-columns-multipage','unequal-three-offset'],results=[];
for(const name of names)for(const origin of ['native','xml'])for(const mode of (name==='unequal-three-offset'?['fixed-ascii','astral']:['fixed-ascii'])){
 const f=manifest.fixtures.find(f=>f.file===`${name}.hwp`);assert.ok(f);const file=origin==='native'?f.file:f.xmlFile,input=await readFile(join(fixtureDir,file));assert.equal(sha(input),origin==='native'?f.sha256:f.xmlSha256);
 const id=`${name}-${origin}-${mode}`,d=new HwpDocument(input),observations=[];try{
  const inserted=(mode==='astral'?'현재😀 𠮷 supplementary plain body reflows across columns. ':'Retained current prefix editing causes line reflow. ').repeat(f.shortPage?15:7);
  d.insertText(0,0,d.getParagraphLength(0,0),inserted);const expected=sourceText(d);if(mode==='astral')assert.ok(points(expected).some(c=>c.length===2));
  observations.push({phase:'live-public-edit',coverage:coverage(d,expected)});
  for(const format of ['hwp','hwpx']){try{const a=artifact(d,format),path=join(out,`${id}.${format}`);await writeFile(path,a.bytes);const disk=await readFile(path);assert.equal(sha(disk),sha(a.bytes));const reopened=new HwpDocument(disk);try{observations.push({phase:`disk-reopen-${format}`,artifactSha256:sha(disk),loss:a.loss,coverage:coverage(reopened,expected)});}finally{reopened.free();}}catch(error){observations.push({phase:`disk-reopen-${format}`,status:'FAIL',error:String(error?.stack??error)});}}
  assert.equal(sourceText(d),expected,'exports must not mutate source text');
 }finally{d.free();}
 const status=observations.every(o=>o.status!=='FAIL'&&o.coverage?.status==='PASS')?'PASS':'FAIL';results.push({case:id,fixture:file,inputSha256:sha(input),status,observations});
}
const report={metadata,wasmSha256:sha(wasm),jsSha256:sha(js),verifierSha256:sha(await readFile(fileURLToPath(import.meta.url))),manifestSha256:sha(await readFile(join(fixtureDir,'manifest.json'))),results,pass:results.filter(r=>r.status==='PASS').length,fail:results.filter(r=>r.status==='FAIL').length,scope:'Fixed own12 Native/XML inputs plus2 astral public-edit controls. Exact source scalar coverage and order once, source UTF16 mapping explicit, public text positions only. Both-format disk/reopen observations. No raw/model/cache/lease repair, no GUI, no application source imports. This is additional coverage proof; mandatory production semantic/geometry preservation guards remain separately required.'};
await writeFile(join(out,'result.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({pass:report.pass,fail:report.fail}));if(report.fail)process.exitCode=1;
