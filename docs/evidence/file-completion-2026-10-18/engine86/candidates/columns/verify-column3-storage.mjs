import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {isAbsolute,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadReviewEngine,hash,snapshot,compareSnapshots,differences} from '../../apps/editor/scripts/lib/hancom-review.mjs';
import {verifyPreservedExport} from '../../apps/editor/src/adapters/rhwp/preservation.ts';

for(const key of ['JUEONY_ENGINE_PACKAGE','JUEONY_REPOSITORY','JUEONY_TEST_OUTPUT'])assert.ok(isAbsolute(process.env[key]??''),`${key} must be absolute`);
const root=resolve(process.env.JUEONY_REPOSITORY),out=resolve(process.env.JUEONY_TEST_OUTPUT);
await mkdir(out,{recursive:true});
const candidate=await loadReviewEngine(process.env.JUEONY_ENGINE_PACKAGE);
const baseline=await loadReviewEngine(join(root,'build/rhwp-engine/source-ad6186043c15532f/pkg'));
const results=[],failures=[],observations=[];
const j=x=>typeof x==='string'?JSON.parse(x):x;
async function test(name,action){try{await action();results.push(name);console.log('PASS',name);}catch(error){failures.push({name,error:String(error),comparison:error.comparison,report:error.report});console.error('FAIL',name,String(error).slice(0,250));}}
function equal(a,b){const c=compareSnapshots(snapshot(a),snapshot(b));assert.deepEqual(c.semantic.readIssues,{before:[],after:[]});if(c.status!=='SAME_WITHIN_PUBLISHED_CONTRACT'){const e=Error(`semantic=${c.semantic.count}; geometry=${c.geometry.count}`);e.comparison=c;throw e;}return c;}
function strict(d,format){const a=d[format==='hwp'?'exportHwpWithReport':'exportHwpxWithReport']();try{const bytes=a.takeBytes();const checked=verifyPreservedExport(d,bytes,format,a.contentLoss(),b=>new candidate.HwpDocument(b));assert.equal(checked.status,'checked');return bytes;}finally{a.free();}}
async function repeated(d,label){const start=snapshot(d),events=d.getEventLog(),cas=d.exportHwp();for(const format of ['hwp','hwpx']){let current=d,owned=false;try{for(let cycle=1;cycle<=2;cycle++){const bytes=strict(current,format),r=new candidate.HwpDocument(bytes);try{equal(d,r);observations.push({label,format,cycle,sha256:hash(bytes),semantic:0,geometry:0,guard:'checked'});}catch(error){r.free();throw error;}if(owned)current.free();current=r;owned=true;}}finally{if(owned)current.free();}}assert.deepEqual(snapshot(d),start);assert.equal(d.getEventLog(),events);assert.deepEqual(d.exportHwp(),cas);}
function open(name){return readFile(join(root,'build/file-closure69-overlap/support',name)).then(b=>new candidate.HwpDocument(b));}

await test('own fresh three-column source: full semantics/layout and strict both-codec two-cycle storage',async()=>{const d=await open('column3.hwp');try{assert.equal(j(d.getColumnDef(0)).columnCount,3);await repeated(d,'fresh-three');}finally{d.free();}});
await test('actual setColumnDef(3) with snapshot Undo/Redo and strict both-codec repeated storage',async()=>{const d=await open('column2.hwp');try{const original=snapshot(d),undo=d.saveSnapshot();d.setColumnDef(0,3,0,true,1000);assert.equal(j(d.getColumnDef(0)).columnCount,3);const edited=snapshot(d),redo=d.saveSnapshot();assert.notDeepEqual(edited.semantic.values,original.semantic.values);d.restoreSnapshot(undo);assert.deepEqual(snapshot(d),original);d.restoreSnapshot(redo);assert.deepEqual(snapshot(d),edited);await repeated(d,'api-three');d.discardSnapshot(undo);d.discardSnapshot(redo);}finally{d.free();}});
await test('three-column later body edit keeps table geometry; Undo/Redo and both-codec two-cycle storage',async()=>{const d=await open('column3.hwp');try{const original=snapshot(d),controls=j(d.getPageControlLayout(0)),undo=d.saveSnapshot();d.insertText(0,d.getParagraphCount(0)-1,0,'COLUMN3-HISTORY');const edited=snapshot(d),redo=d.saveSnapshot();assert.notDeepEqual(edited.semantic.values,original.semantic.values);assert.deepEqual(j(d.getPageControlLayout(0)),controls);d.restoreSnapshot(undo);assert.deepEqual(snapshot(d),original);d.restoreSnapshot(redo);assert.deepEqual(snapshot(d),edited);await repeated(d,'history-three');d.discardSnapshot(undo);d.discardSnapshot(redo);}finally{d.free();}});

for(const name of ['single_column','three_columns','rtl','distribute','unequal_columns','asymmetric_margin'])await test(`six existing disk exclusions retain formal83 full state and both-codec readback: ${name}`,async()=>{
 const path=join(root,'build/file-closure69-public/column2-candidate74/valid-negative-disk',`baseline-${name}.hwp`),input=await readFile(path),a=new candidate.HwpDocument(input),b=new baseline.HwpDocument(input);
 try{equal(a,b);for(const format of ['hwp','hwpx']){const aa=a[format==='hwp'?'exportHwpWithReport':'exportHwpxWithReport'](),bb=b[format==='hwp'?'exportHwpWithReport':'exportHwpxWithReport']();try{assert.equal(aa.contentLoss(),bb.contentLoss());const ar=new candidate.HwpDocument(aa.takeBytes()),br=new baseline.HwpDocument(bb.takeBytes());try{equal(ar,br);}finally{ar.free();br.free();}}finally{aa.free();bb.free();}}assert.equal(hash(await readFile(path)),hash(input));}finally{a.free();b.free();}
});
await writeFile(join(out,'result.json'),JSON.stringify({results,failures,observations,candidate:candidate.metadata,baseline:baseline.metadata,verifierSHA:hash(await readFile(fileURLToPath(import.meta.url))),scope:'Self-authored generated three-column first-frame table stack only; published whole-document semantic reader, all geometry fields at unchanged 0.2 and production preservation guard. Stale two-column width declared as three remains a negative. No actual Hancom three-column GUI comparison was available; no cross-app placement equality claim.'},null,2));
if(failures.length)process.exitCode=1;
