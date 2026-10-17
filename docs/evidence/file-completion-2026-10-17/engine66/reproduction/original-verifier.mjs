import assert from 'node:assert/strict';import{readFile,writeFile,mkdir}from'node:fs/promises';import{resolve,join}from'node:path';
import{loadReviewEngine,hash,snapshot,compareSnapshots,writeJSON}from'../../apps/editor/scripts/lib/hancom-review.mjs';
import{verifyPreservedExport}from'../../apps/editor/src/adapters/rhwp/preservation.ts';
import{hwpTabCacheEvidence}from'../../apps/editor/scripts/integration/hwp-tab-evidence.mjs';
const root=resolve('build/hancom-owned-file-review-20261017'),pkg=resolve(process.env.JUEONY_OUTER_CANDIDATE_PACKAGE??'build/outer-native-candidate48/source/pkg'),out=resolve(process.env.JUEONY_TEST_OUTPUT??'build/outer-native-candidate48/engine-review');await mkdir(out,{recursive:true});const candidate=await loadReviewEngine(pkg),baseline=await loadReviewEngine(resolve('build/rhwp-engine/source-8deeb52a09ba2b75/pkg')),results=[],failures=[],observations=[];
async function scenario(name,run){try{await run();results.push(name);console.log('PASS',name);}catch(e){failures.push({name,error:String(e),stack:e.stack,...(e.comparison?{comparison:e.comparison}:{})});console.error('FAIL',name,String(e.message).slice(0,220));}}
function equal(a,b){const c=compareSnapshots(snapshot(a),snapshot(b));if(c.status!=='SAME_WITHIN_PUBLISHED_CONTRACT'){const error=Error('Full comparison mismatch: semantic='+c.semantic.count+', geometry='+c.geometry.count);error.comparison=c;throw error;}assert.equal(c.semantic.count,0);assert.equal(c.geometry.count,0);assert.equal(c.pages.equal,true);assert.deepEqual(c.semantic.readIssues,{before:[],after:[]});return c;}
for(const format of['hwp','hwpx'])await scenario(format+' original vs actual Hancom full semantics and geometry',async()=>{const a=new candidate.HwpDocument(await readFile(join(root,'outer-'+format+'.'+format))),b=new candidate.HwpDocument(await readFile(join(root,'outer-'+format+'-hancom.'+format)));try{const c=equal(a,b);observations.push({name:'actual-pair',format,semantic:0,geometry:0,pages:c.pages,tableY:JSON.parse(a.getPageControlLayout(0)).controls[0].y});}finally{a.free();b.free();}});
for(const name of ['outer-hwp.hwp','outer-hwp-hancom.hwp','outer-hwpx.hwpx','outer-hwpx-hancom.hwpx'])for(const format of['hwp','hwpx'])await scenario(name+' repeat strict '+format+' and untouched active/raw preservation',async()=>{
 const bytes=await readFile(join(root,name)),live=new candidate.HwpDocument(bytes),before=live.exportHwp(),events=live.getEventLog();let current=live,owns=false;
 try{for(let round=1;round<=2;round++){const artifact=current[format==='hwp'?'exportHwpWithReport':'exportHwpxWithReport']();try{const output=artifact.takeBytes(),strict=verifyPreservedExport(current,output,format,artifact.contentLoss(),b=>new candidate.HwpDocument(b));assert.equal(strict.status,'checked');const reopened=new candidate.HwpDocument(output);try{equal(live,reopened);const path=join(out,name+'-'+format+'-'+round+'.'+format);await writeFile(path,output,{flag:'wx'});observations.push({name,format,round,sha256:hash(output),semantic:0,geometry:0});}catch(e){reopened.free();throw e;}if(owns)current.free();current=reopened;owns=true;}finally{artifact.free();}}
 assert.deepEqual(live.exportHwp(),before);assert.equal(live.getEventLog(),events);
 if(name.endsWith('.hwp')){
  const recordBytes=values=>values.map(({compressedSha256,...records})=>records);
  const actualRaw=hwpTabCacheEvidence(live.exportHwp());assert.deepEqual(recordBytes(actualRaw),recordBytes(hwpTabCacheEvidence(bytes)),'entire decompressed native BodyText record bytes stay exact; container DEFLATE coding need not match Hancom');
  const old=new baseline.HwpDocument(bytes);try{assert.deepEqual(actualRaw,hwpTabCacheEvidence(old.exportHwp()),'candidate raw/compression policy is exactly the unchanged official63 policy');}finally{old.free();}
 }
 }finally{if(owns)current.free();live.free();}
});
for(const [label,alter] of [
 ['protected-cell',d=>d.setCellProperties(0,1,0,0,'{"cellProtect":true}')],
 ['field-cell',d=>d.setCellProperties(0,1,0,0,'{"fieldName":"source"}')],
 ['object-lock',d=>d.setControlLock(1,0,true)],
 ['row-break',d=>d.setTableProperties(0,1,0,'{"pageBreak":2}')],
])for(const input of ['outer-hwp.hwp','outer-hwpx.hwpx'])await scenario('unsafe scope unchanged '+label+' '+input,async()=>{
 const bytes=await readFile(join(root,input)),a=new candidate.HwpDocument(bytes),b=new baseline.HwpDocument(bytes);
 try{alter(a);alter(b);equal(a,b);const savedA=a.exportHwp(),savedB=b.exportHwp();assert.deepEqual(savedA,savedB,'unsafe scope export bytes stay exactly official63');const reopenedA=new candidate.HwpDocument(savedA),reopenedB=new baseline.HwpDocument(savedB);try{equal(reopenedA,reopenedB);}finally{reopenedA.free();reopenedB.free();}}finally{a.free();b.free();}
});
const manifest=JSON.parse(await readFile(join(root,'manifest.json'),'utf8'));for(const item of manifest.files.filter(x=>!x.name.startsWith('outer-')))await scenario('formal63 unchanged negative '+item.name,async()=>{const bytes=await readFile(join(root,item.name)),a=new candidate.HwpDocument(bytes),b=new baseline.HwpDocument(bytes);try{equal(a,b);}finally{a.free();b.free();}});
await writeJSON(join(out,'result.json'),{createdAt:new Date().toISOString(),results,failures,observations,candidate:candidate.metadata,baseline:baseline.metadata,verifierSha256:hash(await readFile(new URL(import.meta.url))),scope:'Ignored single-table placeholder-origin candidate only. Actual source/Hancom pairs are owned synthetic fixtures. All semantics and every published control/text geometry field compare with unchanged0.2. No source fields, raw stream bytes or guard were normalized. No fresh Hancom GUI verification is claimed.'});if(failures.length)process.exitCode=1;
