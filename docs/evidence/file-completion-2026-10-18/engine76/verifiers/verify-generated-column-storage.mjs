// Replay the unchanged published contract using sealed, self-authored disk fixtures.
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {resolve, join, isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadReviewEngine, snapshot, compareSnapshots, differences, hash} from './lib/hancom-review.mjs';
import {verifyPreservedExport} from '../src/adapters/rhwp/preservation.ts';

for (const key of ['JUEONY_ENGINE_PACKAGE','JUEONY_BASELINE_ENGINE_PACKAGE','JUEONY_TEST_OUTPUT','JUEONY_COLUMN_EVIDENCE']) {
  assert.ok(process.env[key] && isAbsolute(process.env[key]), `${key} must be absolute`);
}
const evidence=resolve(process.env.JUEONY_COLUMN_EVIDENCE), out=resolve(process.env.JUEONY_TEST_OUTPUT);
await mkdir(out,{recursive:true});
const candidate=await loadReviewEngine(resolve(process.env.JUEONY_ENGINE_PACKAGE));
const baseline=await loadReviewEngine(resolve(process.env.JUEONY_BASELINE_ENGINE_PACKAGE));
const fixtureRoot=join(evidence,'fixtures/build/file-closure69-overlap');
const ownRoot=join(evidence,'fixtures/build/file-closure69-public/column2-candidate74');
const results=[], failures=[], observations=[];
async function scenario(name, action) {
  try {await action();results.push(name);console.log('PASS',name);}
  catch(error){failures.push({name,error:String(error),stack:error.stack,comparison:error.comparison,preservationReport:error.report});console.error('FAIL',name,String(error.message).slice(0,240));}
}
function equal(a,b){
  const comparison=compareSnapshots(snapshot(a),snapshot(b));
  if(comparison.status!=='SAME_WITHIN_PUBLISHED_CONTRACT'){
    const error=Error(`Full contract differs: semantic=${comparison.semantic.count}, geometry=${comparison.geometry.count}`);
    error.comparison=comparison;throw error;
  }
  assert.deepEqual(comparison.semantic.readIssues,{before:[],after:[]});
  return comparison;
}
function strictBytes(doc,format){
  const artifact=doc[format==='hwp'?'exportHwpWithReport':'exportHwpxWithReport']();
  try{
    const bytes=artifact.takeBytes(), loss=artifact.contentLoss();
    const report=verifyPreservedExport(doc,bytes,format,loss,b=>new candidate.HwpDocument(b));
    assert.equal(report.status,'checked');return bytes;
  }finally{artifact.free();}
}
const names=['support/column2.hwp','hancom-current/column2.hwp'];
await scenario('actual Hancom pair: every published semantic/control/text field',async()=>{
  const a=new candidate.HwpDocument(await readFile(join(fixtureRoot,names[0])));
  const b=new candidate.HwpDocument(await readFile(join(fixtureRoot,names[1])));
  try{observations.push({name:'actual-column2',...equal(a,b)});}finally{a.free();b.free();}
});
await scenario('frozen historical Hancom layout remains the exact oracle',async()=>{
  const frozen=JSON.parse(await readFile(join(evidence,'fixed-oracle-compact.json'),'utf8'));
  const item=frozen.observations.find(x=>x.name==='column2.hwp');assert.ok(item);
  const expected=item.afterLayout.map((p,page)=>({page,controls:{controls:p.controls},text:{runs:p.runs}}));
  for(const name of names){const d=new candidate.HwpDocument(await readFile(join(fixtureRoot,name)));try{assert.deepEqual(differences(expected,snapshot(d).layout,0.2),[]);}finally{d.free();}}
});
for(const name of names)for(const format of ['hwp','hwpx'])await scenario(`${name}: strict ${format} save/reopen twice; active document unchanged`,async()=>{
  const input=await readFile(join(fixtureRoot,name)), live=new candidate.HwpDocument(input);
  const rawBefore=live.exportHwp(), events=live.getEventLog();let current=live, owns=false;
  try{
    for(let round=1;round<=2;round++){
      const bytes=strictBytes(current,format), reopened=new candidate.HwpDocument(bytes);
      try{equal(live,reopened);await writeFile(join(out,`${name.replaceAll('/','-')}-${format}-${round}.${format}`),bytes,{flag:'wx'});}
      catch(error){reopened.free();throw error;}
      observations.push({name,format,round,sha256:hash(bytes),semantic:0,geometry:0});
      if(owns)current.free();current=reopened;owns=true;
    }
    assert.deepEqual(live.exportHwp(),rawBefore);assert.equal(live.getEventLog(),events);
  }finally{if(owns)current.free();live.free();}
});
for(const name of names)await scenario(`${name}: actual insert, snapshot Undo/Redo, strict both-format repeated storage`,async()=>{
  const input=await readFile(join(fixtureRoot,name)), d=new candidate.HwpDocument(input);
  try{
    const original=snapshot(d), controls=JSON.parse(d.getPageControlLayout(0)), undo=d.saveSnapshot();
    const tail=d.getParagraphCount(0)-1;d.insertText(0,tail,0,'HISTORY');
    const edited=snapshot(d), redo=d.saveSnapshot();
    assert.deepEqual(JSON.parse(d.getPageControlLayout(0)),controls);
    d.restoreSnapshot(undo);assert.deepEqual(snapshot(d),original);
    d.restoreSnapshot(redo);assert.deepEqual(snapshot(d),edited);
    for(const format of ['hwp','hwpx']){
      let current=d, owns=false;
      try{for(let round=1;round<=2;round++){
        const bytes=strictBytes(current,format), reopened=new candidate.HwpDocument(bytes);
        try{equal(d,reopened);}catch(error){reopened.free();throw error;}
        if(owns)current.free();current=reopened;owns=true;
      }}finally{if(owns)current.free();}
    }
    d.discardSnapshot(undo);d.discardSnapshot(redo);
  }finally{d.free();}
});
const negatives=['single_column','three_columns','rtl','distribute','unequal_columns','asymmetric_margin'];
for(const name of negatives)await scenario(`valid disk negative unchanged: ${name}`,async()=>{
  const bytes=await readFile(join(ownRoot,'valid-negative-disk',`baseline-${name}.hwp`));
  const a=new candidate.HwpDocument(bytes), b=new baseline.HwpDocument(bytes);
  try{
    equal(a,b);
    for(const format of ['hwp','hwpx']){
      const aa=a[format==='hwp'?'exportHwpWithReport':'exportHwpxWithReport']();
      const bb=b[format==='hwp'?'exportHwpWithReport':'exportHwpxWithReport']();
      try{
        assert.equal(aa.contentLoss(),bb.contentLoss());
        const ar=new candidate.HwpDocument(aa.takeBytes()), br=new baseline.HwpDocument(bb.takeBytes());
        try{equal(ar,br);}finally{ar.free();br.free();}
      }finally{aa.free();bb.free();}
    }
  }finally{a.free();b.free();}
});
const frozen=JSON.parse(await readFile(join(evidence,'fixed-oracle-compact.json'),'utf8'));
for(const item of frozen.observations.filter(x=>x.name!=='column2.hwp'))await scenario(`existing fixed actual pair unchanged: ${item.name}`,async()=>{
  const source=join(fixtureRoot,item.name==='negative.hwp'?'support/negative.hwp':item.original.path.split('/build/file-closure69-overlap/')[1]);
  const actual=join(fixtureRoot,'hancom-current',item.name);
  const a=new candidate.HwpDocument(await readFile(source)), b=new candidate.HwpDocument(await readFile(actual));
  try{equal(a,b);}finally{a.free();b.free();}
});
await writeFile(join(out,'result.json'),JSON.stringify({createdAt:new Date().toISOString(),results,failures,observations,candidate:candidate.metadata,baseline:baseline.metadata,verifierSha256:hash(await readFile(fileURLToPath(import.meta.url))),scope:'Owned synthetic column2 actual oracle and strict unchanged production preservation reader, all semantic fields and every published control/text geometry field with 0.2 numeric tolerance. Native fixtures assert real serialized column/margin properties. No raw cache, source, guard, comparator or oracle normalization. Hancom GUI not run here.'},null,2));
if(failures.length)process.exitCode=1;
