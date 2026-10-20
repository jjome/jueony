// Original valid short multi-page signed fixtures, never regenerated.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadReviewEngine,hash,snapshot,compareSnapshots} from './lib/hancom-review.mjs';
import {verifyPreservedExport} from '../src/adapters/rhwp/preservation.ts';
for(const k of ['JUEONY_ENGINE_PACKAGE','JUEONY_TEST_OUTPUT'])assert.ok(isAbsolute(process.env[k]??''),k);
const repo=resolve(fileURLToPath(new URL('../../..',import.meta.url))),out=resolve(process.env.JUEONY_TEST_OUTPUT),fixtures=resolve(repo,'apps/editor/tests/fixtures/n001-signed-short177-own');
await mkdir(out,{recursive:true});
const engine=await loadReviewEngine(process.env.JUEONY_ENGINE_PACKAGE),{HwpDocument}=engine;
const manifestBytes=await readFile(resolve(fixtures,'manifest.json'));
assert.equal(hash(manifestBytes),'785d405f863ae6d85955b51034dd0052d1a193585e93d41c6c4a2ad7465fdb69');
const manifest=JSON.parse(manifestBytes),targets=new Set(['unequal3-minus300-short', 'equal3-minus1200-short']);
const selected=manifest.fixtures.filter(f=>targets.has(f.name));assert.equal(selected.length,2);
const observations=[],results=[],failures=[],inputs=[];
const payload='Signed negative current prefix reflows across columns. '.repeat(8),followup='후속 😀 negative tail157 ';
const text=(d,p)=>d.getTextRange(0,p,0,d.getParagraphLength(0,p));
const take=a=>{try{return{bytes:Buffer.from(a.takeBytes()),loss:JSON.parse(a.contentLoss())};}finally{a.free();}};
const exported=(d,f,p)=>take(f==='hwp'?(p?d.exportHwpWithPasswordAndReport(p):d.exportHwpWithReport()):(p?d.exportHwpxWithPasswordAndReport(p):d.exportHwpxWithReport()));
const json=x=>typeof x==='string'?JSON.parse(x):x,scalars=x=>Array.from(x).length;
function coverage(d){
 const runs=Array.from({length:d.pageCount()},(_,p)=>json(d.getPageTextLayout(p)).runs).flat(),stories=[];
 const check=(expected,owned,address)=>{let seen='',at=0;for(const r of runs.filter(owned)){assert.equal(r.charStart,at,'scalar source start');assert.equal(r.charX.length,scalars(r.text)+1,'scalar boundaries plus end');assert.ok(r.charX.every(Number.isFinite));seen+=r.text;at+=scalars(r.text);}assert.equal(seen,expected,'all story text exactly once');stories.push({...address,scalars:at,utf16:seen.length});};
 for(let s=0;s<d.getSectionCount();s++)for(let p=0;p<d.getParagraphCount(s);p++){const n=d.getParagraphLength(s,p);check(d.getTextRange(s,p,0,n),r=>r.secIdx===s&&r.paraIdx===p&&!Object.hasOwn(r,'parentParaIdx'),{section:s,paragraph:p});}
 const lists=json(d.getCursorModel()).lists;for(const l of lists){assert.ok(l.isCell,'own fixtures contain only body/cell stories');assert.equal(l.hostListId,0,'own fixtures have no nested table');for(let cp=0;cp<l.paraCount;cp++){const s=l.sectionIndex,p=l.hostPara,c=l.controlIndex,cell=l.cellIndex,n=d.getCellParagraphLength(s,p,c,cell,cp);check(d.getTextInCell(s,p,c,cell,cp,0,n),r=>r.secIdx===s&&r.parentParaIdx===p&&r.controlIdx===c&&r.cellIdx===cell&&r.cellParaIdx===cp,{section:s,paragraph:p,control:c,cell,cellParagraph:cp});}}
 return stories;
}

async function save(d,format,password,label){
 const open=b=>password?HwpDocument.openWithPassword(b,password):new HwpDocument(b),before=snapshot(d),events=d.getEventLog();
 const cov=coverage(d),unchanged=exported(d,'hwp','').bytes;const a=exported(d,format,password);assert.equal(a.loss.count,0,JSON.stringify(a.loss));
 const path=resolve(out,label+'.'+format);await writeFile(path,a.bytes);const bytes=await readFile(path);assert.deepEqual(bytes,a.bytes);
 let next;try{
  next=open(bytes);const comparison=compareSnapshots(before,snapshot(next));
  observations.push({label,format,password:!!password,sha256:hash(bytes),comparison});
  assert.equal(comparison.status,'SAME_WITHIN_PUBLISHED_CONTRACT');
  assert.equal(verifyPreservedExport(d,bytes,format,a.loss,open).status,'checked');
  assert.deepEqual(coverage(next),cov);assert.deepEqual(snapshot(d),before);assert.equal(d.getEventLog(),events);assert.deepEqual(exported(d,'hwp','').bytes,unchanged);
  if(password)assert.throws(()=>HwpDocument.openWithPassword(bytes,'wrong-signed-negative'));
  return next;
 }catch(e){next?.free();throw e;}
}
for(const fixture of selected)for(const origin of ['native','xml'])for(const password of ['', 'SignedNegative157']){
 const name=fixture.name+'-'+origin+'-'+(password?'password':'plain'),format=origin==='native'?'hwp':'hwpx';
 const path=resolve(fixtures,'fixtures',fixture.name+'.'+format),bytes=await readFile(path);assert.equal(hash(bytes),fixture[origin+'Sha256']);inputs.push({case:name,path,sha256:hash(bytes)});
 const d=new HwpDocument(bytes);
 try{
  const initial=snapshot(d),undo=d.saveSnapshot(),original=text(d,0);d.insertText(0,0,d.getParagraphLength(0,0),payload);assert.equal(text(d,0),original+payload);
  assert.ok(d.pageCount()>1,'actual used physical pages after prefix edit');coverage(d);const edited=snapshot(d),redo=d.saveSnapshot();d.restoreSnapshot(undo);assert.deepEqual(snapshot(d),initial);d.restoreSnapshot(redo);assert.deepEqual(snapshot(d),edited);
  const beforeCount=observations.length;
  for(const firstFormat of ['hwp','hwpx']){
   const next=await save(d,firstFormat,password,name+'-edit');
   try{const tail=next.getParagraphCount(0)-1,old=text(next,tail);next.insertText(0,tail,0,followup);assert.equal(text(next,tail),followup+old);
    for(const followFormat of ['hwp','hwpx']){const end=await save(next,followFormat,password,name+'-after-'+firstFormat+'-followup');end.free();}
   }finally{next.free();}
  }
  assert.equal(observations.length-beforeCount,6);results.push({name,status:'PASS',diskExports:6,historyExact:true});console.log('PASS',name);
 }catch(e){results.push({name,status:'FAIL'});failures.push({name,error:String(e),stack:e.stack,report:e.report});console.log('FAIL',name,String(e));}
 finally{d.free();}
}
const sourcePaths=['scripts/lib/hancom-review.mjs','src/adapters/rhwp/preservation.ts','src/adapters/rhwp/document-stored-information.ts','src/adapters/rhwp/document-save-layout.ts','src/adapters/rhwp/overlap-save-layout.ts'];
const report={engine:engine.metadata,verifierSha256:hash(await readFile(fileURLToPath(import.meta.url))),manifestSha256:hash(manifestBytes),sourceHashes:await Promise.all(sourcePaths.map(async path=>({path,sha256:hash(await readFile(resolve(repo,'apps/editor',path)))}))),inputs,results,failures,observations,expectedCases:8,expectedExports:48,scope:'Original signed short2 valid positives; actual multiple used pages, identical public prefix/astral tail payload to Native reproduction; 8 combinations/48 mixed disk exports, exact history, every body/cell scalar and UTF16 once, unmodified whole production0.2 guard, source public snapshot/HWP bytes/events exact. No raw-model repair, Hancom equality or oversized-refusal positive claim.'};
await writeFile(resolve(out,'result.json'),JSON.stringify(report,null,2));
assert.equal(results.length,8);assert.deepEqual(failures,[]);assert.ok(results.every(r=>r.status==='PASS'));assert.equal(observations.length,48);assert.ok(observations.every(o=>o.comparison.status==='SAME_WITHIN_PUBLISHED_CONTRACT'));
