import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {inflateRawSync} from 'node:zlib';
import {capturePreservationEvidence,verifyPreservedExport} from '../src/adapters/rhwp/preservation.ts';
import {absolutePath,loadReviewEngine,hash,snapshot,compareSnapshots,writeJSON} from './lib/hancom-review.mjs';

const engine=await loadReviewEngine(process.env.JUEONY_ENGINE_PACKAGE),out=absolutePath(process.env.JUEONY_TEST_OUTPUT,'output');await mkdir(out,{recursive:true});
const inputRoot=absolutePath(process.env.JUEONY_TAB_REVIEW_INPUT,'owned tab fixtures');
// ZIP central-directory decoding avoids relying on rhwp to inspect its own caches.
function sectionXml(input){
 const b=Buffer.from(input);let end=b.length-22;const minimum=Math.max(0,b.length-65557);
 while(end>=minimum&&(b.readUInt32LE(end)!==0x06054b50||end+22+b.readUInt16LE(end+20)!==b.length))end--;
 assert.ok(end>=minimum);let at=b.readUInt32LE(end+16);const result=[];
 for(let i=0;i<b.readUInt16LE(end+10);i++){
  assert.equal(b.readUInt32LE(at),0x02014b50);const method=b.readUInt16LE(at+10),size=b.readUInt32LE(at+20),expanded=b.readUInt32LE(at+24),n=b.readUInt16LE(at+28),extra=b.readUInt16LE(at+30),comment=b.readUInt16LE(at+32),offset=b.readUInt32LE(at+42),name=b.subarray(at+46,at+46+n).toString();at+=46+n+extra+comment;
  if(!/^Contents\/section\d+\.xml$/.test(name))continue;assert.ok(expanded<=4*1024*1024);assert.equal(b.readUInt32LE(offset),0x04034b50);assert.ok(method===0||method===8);
  const start=offset+30+b.readUInt16LE(offset+26)+b.readUInt16LE(offset+28),compressed=b.subarray(start,start+size),raw=method===0?compressed:inflateRawSync(compressed,{maxOutputLength:4*1024*1024});assert.equal(raw.length,expanded);
  const xml=raw.toString('utf8'),attrs=s=>Object.fromEntries([...s.matchAll(/([\w:]+)="([^"]*)"/g)].map(m=>[m[1],m[2]])),sec=/<hp:secPr\b[^>]*>/.exec(xml);assert.ok(sec);
  result.push({name,...attrs(sec[0]),paragraphs:[...xml.matchAll(/<hp:p\b([^>]*)>(.*?)<\/hp:p>/gs)].map(m=>({id:attrs(m[1]).id,tabs:[...m[2].matchAll(/<hp:tab\b[^>]*\/>/g)].map(t=>attrs(t[0])),cached:m[2].includes('<hp:linesegarray>')}))});
 }
 return result.sort((a,b)=>a.name.localeCompare(b.name));
}
function assertRawCacheContract(bytes){
 const sections=sectionXml(bytes);assert.equal(sections.length,3);
 for(const [i,s]of sections.entries()){
  assert.equal(Number(s.tabStop),[4000,8000,12000][i]);assert.equal(Number(s.tabStopVal),[2000,4000,6000][i]);assert.equal(s.tabStopUnit,'HWPUNIT');
  const p=s.paragraphs.find(p=>p.tabs.length);assert.ok(p);assert.equal(p.tabs.length,2);
  const unresolved=p.tabs.some(t=>t.width==='0'&&t.leader==='0'&&t.type==='1');
  if(unresolved)assert.equal(p.cached,false,'zero-width tab placeholder must not be paired with trusted LINE_SEG: '+s.name);
 }
 return sections;
}
const fixtures=[['original','tabs-20-40-60.hwpx'],['hancom-collapsed','tabs-20-40-60-hancom.hwpx'],['hancom-resolved','tabs-diagnosis-final53/tabs-no-cache-hancom.hwpx']],results=[];
for(const[label,name]of fixtures){
 let doc;try{
 const input=join(inputRoot,name),bytes=await readFile(input);doc=new engine.HwpDocument(bytes);const initial=snapshot(doc),initialRaw=sectionXml(bytes),beforeLive=JSON.stringify(capturePreservationEvidence(doc));assert.equal(initial.pages,3);
 for(const format of['hwpx','hwp']){
  let current=doc,owned=false;try{
  for(let round=1;round<=2;round++){
   const artifact=format==='hwpx'?current.exportHwpxWithReport():current.exportHwpWithReport();let output,loss;try{output=artifact.takeBytes();loss=JSON.parse(artifact.contentLoss());}finally{artifact.free();}
   const strict=verifyPreservedExport(current,output,format,loss,b=>new engine.HwpDocument(b));assert.equal(strict.status,'checked');
   const next=new engine.HwpDocument(output);try{
    const after=snapshot(next),comparison=compareSnapshots(initial,after);assert.equal(comparison.semantic.count,0);assert.equal(comparison.geometry.count,0);assert.equal(after.pages,3);
    const raw=format==='hwpx'?assertRawCacheContract(output):undefined;
    if(raw)for(const [index,section]of initialRaw.entries())for(const previous of section.paragraphs){
     if(!previous.tabs.length||previous.tabs.some(t=>t.width==='0'&&t.leader==='0'&&t.type==='1'))continue;
     const saved=raw[index].paragraphs.find(p=>p.id===previous.id);assert.ok(saved);
     assert.deepEqual(saved.tabs,previous.tabs,'resolved tab advances/types must remain unchanged');
     if(previous.cached)assert.equal(saved.cached,true,'resolved saved tabs retain their trusted cache');
    }
    const target=join(out,`${label}-${round}.${format}`);await writeFile(target,output,{flag:'wx'});
    results.push({label,format,round,status:'PASS',inputSha256:hash(bytes),outputSha256:hash(output),target,strict:strict.status,semantic:comparison.semantic.count,geometry:comparison.geometry.count,pages:comparison.pages,...(raw?{raw}:{}),loss});
   }catch(error){next.free();throw error;}
   if(owned)current.free();current=next;owned=true;
  }
  }catch(error){results.push({label,format,status:'FAIL',error:String(error),...(error.report?{report:error.report}:{})});}finally{if(owned)current.free();}
 }
 assert.equal(JSON.stringify(capturePreservationEvidence(doc)),beforeLive,'export validation must not mutate the active document');
 }catch(error){results.push({label,status:'FAIL',error:String(error)});}finally{doc?.free();}
}
const failures=results.filter(r=>r.status==='FAIL');await writeJSON(join(out,'result.json'),{createdAt:new Date().toISOString(),enginePackage:engine.pkg,engine:engine.metadata,verifierSha256:hash(await readFile(new URL(import.meta.url))),geometryTolerance:0.2,results,failures:failures.length,scope:'Own three-section fixtures, live state, strict export, repeated serialization, independent XML cache/interval contract. Actual Hancom visual validation must be performed separately; no native screen equality claim.'});
console.log(JSON.stringify({success:results.filter(r=>r.status==='PASS').length,failures:failures.length,results:results.map(({label,format,round,status,error})=>({label,format,round,status,error}))}));if(failures.length)process.exitCode=1;
