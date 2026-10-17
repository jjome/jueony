import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {inflateRawSync} from 'node:zlib';
import {hwpLogicalStreams} from './lib/hwp-summary-evidence.mjs';
import {loadReviewEngine,snapshot,compareSnapshots,hash} from './lib/hancom-review.mjs';
import {verifyPreservedExport,PreservationError} from '../src/adapters/rhwp/preservation.ts';

for(const key of['JUEONY_ENGINE_PACKAGE','JUEONY_REPOSITORY','JUEONY_TEST_OUTPUT'])assert.ok(isAbsolute(process.env[key]??''),key+' requires an absolute path');
const root=resolve(process.env.JUEONY_REPOSITORY),out=resolve(process.env.JUEONY_TEST_OUTPUT);
await mkdir(out,{recursive:true});
const engine=await loadReviewEngine(process.env.JUEONY_ENGINE_PACKAGE),{HwpDocument}=engine;
const results=[],failures=[],observations=[];
const json=value=>typeof value==='string'?JSON.parse(value):value;
async function scenario(name,fn){try{await fn();results.push(name);console.log('PASS',name);}catch(e){failures.push({name,errorType:e.name,error:String(e)});console.error('FAIL',name,e.name);}}
function same(a,b){const d=compareSnapshots(a,b);assert.equal(d.status,'SAME_WITHIN_PUBLISHED_CONTRACT',JSON.stringify({pages:d.pages,semantic:d.semantic.count,geometry:d.geometry.count}));return{pages:d.pages,semanticDifferences:d.semantic.count,geometryDifferences:d.geometry.count};}

// Read structural native record bytes independently of the engine parser.
function noteRecords(bytes){
 const streams=hwpLogicalStreams(bytes),header=streams.get('FileHeader');assert.ok(header?.length>=40);
 const compressed=(header.readUInt32LE(36)&1)!==0,notes=[];
 for(const[path,stored]of streams){
  if(!/^BodyText\/Section\d+$/u.test(path))continue;
  const body=compressed?inflateRawSync(stored,{maxOutputLength:32*1024*1024}):stored;
  let offset=0;
  while(offset<body.length){
   assert.ok(offset+4<=body.length);const word=body.readUInt32LE(offset);offset+=4;
   const tag=word&1023,level=(word>>>10)&1023;let length=word>>>20;
   if(length===4095){assert.ok(offset+4<=body.length);length=body.readUInt32LE(offset);offset+=4;}
   assert.ok(offset+length<=body.length);
   if(tag===74){
    assert.equal(length,28,'Native Hancom note record must have the real 28-byte layout');
    const data=body.subarray(offset,offset+length);
    notes.push({section:path,level,rawHex:data.toString('hex'),length:data.readInt32LE(12),above:data.readInt16LE(16),below:data.readInt16LE(18),between:data.readUInt16LE(20),lineType:data[22],lineWidth:data[23],color:data.readUInt32LE(24)});
   }
   offset+=length;
  }
 }
 assert.ok(notes.length>=2);return notes;
}
async function storage(source,sequence,expectedNotes,expectedEndnote){
 const before=snapshot(source),events=source.getEventLog(),cycles=[];let current=source;
 try{for(let index=0;index<sequence.length;index++){
  const format=sequence[index],artifact=format==='hwp'?current.exportHwpWithReport():current.exportHwpxWithReport();let reopened;
  try{
   const bytes=artifact.takeBytes(),loss=json(artifact.contentLoss());
   const guard=verifyPreservedExport(current,bytes,format,loss,b=>new HwpDocument(b));
   assert.equal(guard.status,'checked');assert.ok(guard.checked.includes('whole-document-published-layout'));assert.equal(loss.count,0);
   const native=format==='hwp'?noteRecords(bytes):undefined;
   if(native&&expectedNotes)assert.deepEqual(native,expectedNotes,'Complete native note payloads must match independent Hancom original');
   if(native&&expectedEndnote){const n=native[1];for(const[k,v]of Object.entries(expectedEndnote))assert.equal(n[k],v,'independent native note '+k);}
   reopened=new HwpDocument(bytes);const comparison=same(before,snapshot(reopened));
   same(before,snapshot(source));assert.equal(source.getEventLog(),events,'Export must not mutate live history');
   cycles.push({step:index+1,format,sha256:hash(bytes),...comparison,guardStatus:guard.status,nativeNotes:native});
   if(current!==source)current.free();current=reopened;reopened=undefined;
  }finally{reopened?.free();artifact.free();}
 }}finally{if(current!==source)current.free();}
 return cycles;
}

await scenario('actual MCST native note records and complete layout survive two cycles of each format plus six alternating saves',async()=>{
 const nativePath=join(root,'build/hancom-final-file-review-20261017/source-mcst-bid-2026.hwp'),xmlPath=join(root,'build/hancom-final-file-review-20261017/mcst-bid-2026-hwpx-hancom.hwpx');
 const native=await readFile(nativePath),xml=await readFile(xmlPath);
 assert.equal(hash(native),'c61a13b249183a675d38d5badfa3af610edcf99a403622440fc81b7f52b348f2');assert.equal(hash(xml),'20a3960b4315626c3f97d9c5d47746e3cfadd8fe50dde43a4a424aa3a2a76936');
 const expected=noteRecords(native);assert.equal(expected[0].length,-1);assert.equal(expected[0].above,852);assert.equal(expected[1].length,0);assert.equal(expected[1].above,864);
 const d=new HwpDocument(xml);try{
  assert.equal(d.pageCount(),16);const cycles=[];
  for(const sequence of[['hwp','hwp'],['hwpx','hwpx'],['hwp','hwpx','hwp','hwpx','hwp','hwpx']])cycles.push(...await storage(d,sequence,expected));
  observations.push({kind:'actual-note-contract',nativeInputSha256:hash(native),xmlInputSha256:hash(xml),expected,cycles,sourceUnchanged:true});
 }finally{d.free();}
 assert.equal(hash(await readFile(nativePath)),hash(native));assert.equal(hash(await readFile(xmlPath)),hash(xml));
});

await scenario('real endnote format API, snapshot Undo/Redo and both storage formats preserve requested independent slots',async()=>{
 const d=HwpDocument.createEmpty();try{
  d.createBlankDocument();d.insertText(0,0,0,'OWN note shape storage');const before=snapshot(d),undo=d.saveSnapshot();
  d.applyEndnoteShape(0,JSON.stringify({separatorLength:12345,separatorMarginTop:852,separatorMarginBottom:568,noteSpacing:284,separatorLineType:1,separatorLineWidth:2,separatorColor:'#112233'}));
  const edited=snapshot(d),requested=json(d.getEndnoteShape(0)),redo=d.saveSnapshot();
  d.restoreSnapshot(undo);same(before,snapshot(d));d.restoreSnapshot(redo);same(edited,snapshot(d));assert.deepEqual(json(d.getEndnoteShape(0)),requested);
  const cycles=[];for(const sequence of[['hwp','hwp'],['hwpx','hwpx']])cycles.push(...await storage(d,sequence,undefined,{length:12345,above:852,below:568,between:284,lineType:1,lineWidth:2}));
  observations.push({kind:'real-api-history',requested,cycles,sourceUnchanged:true});
 }finally{d.free();}
});

await scenario('native original note payloads remain immutable through unedited native save',async()=>{
 const path=join(root,'build/hancom-final-file-review-20261017/source-mcst-bid-2026.hwp'),bytes=await readFile(path),expected=noteRecords(bytes),d=new HwpDocument(bytes);
 try{const before=snapshot(d),artifact=d.exportHwpWithReport();try{const saved=artifact.takeBytes();assert.deepEqual(noteRecords(saved),expected);same(before,snapshot(d));observations.push({kind:'native-original-raw-notes',inputSha256:hash(bytes),outputSha256:hash(saved),records:expected});}finally{artifact.free();}}finally{d.free();}
 assert.equal(hash(await readFile(path)),hash(bytes));
});

await scenario('corrupted published layout injection is still rejected before any sink write',()=>{
 const d=HwpDocument.createEmpty();try{d.createBlankDocument();d.insertText(0,0,0,'OWN guard');const before=snapshot(d),a=d.exportHwpxWithReport();try{const bytes=a.takeBytes();let writes=0;
  assert.throws(()=>{verifyPreservedExport(d,bytes,'hwpx',a.contentLoss(),b=>{const r=new HwpDocument(b),get=r.getPageTextLayout.bind(r);r.getPageTextLayout=page=>JSON.stringify({...json(get(page)),injected:'changed'});return r;});writes++;},e=>e instanceof PreservationError&&e.report.issues.some(i=>i.path.startsWith('whole-document-published-layout')));
  assert.equal(writes,0);same(before,snapshot(d));observations.push({kind:'corrupt-layout-negative',writes});
 }finally{a.free();}}finally{d.free();}
});

await writeFile(join(out,'result.json'),JSON.stringify({engine:engine.metadata,verifierSha256:hash(await readFile(fileURLToPath(import.meta.url))),independentReaderSha256:hash(await readFile(new URL('./lib/hwp-summary-evidence.mjs',import.meta.url))),results,failures,observations,scope:'Actual WASM plus unchanged production preservation gate. Independent CFB/native 28-byte i32 note decoding, real note API/history, both formats twice and alternating six steps. Public originals are SHA-pinned and read-only. No public derivative bytes, document text/snapshots, fonts or binaries written. Full published geometry tolerance remains0.2; complete semantic fields are exact. This is not native Hancom UI or all note rendering compatibility.'},null,2));
if(failures.length)process.exitCode=1;
