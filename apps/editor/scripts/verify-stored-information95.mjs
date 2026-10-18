// Own synthetic packages only. Inspect the ZIP independently of the document
// parser, so an exporter and parser cannot conceal the same metadata loss.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,isAbsolute} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {inflateRawSync,deflateRawSync} from 'node:zlib';
import {verifyPreservedExport} from '../src/adapters/rhwp/preservation.ts';

const app=resolve(fileURLToPath(new URL('..',import.meta.url))),repo=resolve(app,'../..');
const sourcePaths=['src/adapters/rhwp/preservation.ts','src/adapters/rhwp/document-stored-information.ts','src/adapters/rhwp/document-save-layout.ts','src/adapters/rhwp/overlap-save-layout.ts'];
const fingerprintSources=()=>Promise.all(sourcePaths.map(async path=>({path,sha256:createHash('sha256').update(await readFile(resolve(app,path))).digest('hex')})));
const sourceHashes=await fingerprintSources();

for(const key of ['JUEONY_ENGINE_PACKAGE','JUEONY_TEST_OUTPUT'])assert.ok(isAbsolute(process.env[key]??''),`${key}: absolute path required`);
const pkg=resolve(process.env.JUEONY_ENGINE_PACKAGE),out=resolve(process.env.JUEONY_TEST_OUTPUT);
await mkdir(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const wasm=await readFile(pkg+'/rhwp_bg.wasm'),js=await readFile(pkg+'/rhwp.js');
const engine=JSON.parse(await readFile(pkg+'/jueony-engine-build.json','utf8'));
assert.equal(sha(wasm),engine.wasmSha256);assert.equal(sha(js),engine.jsSha256);
const {default:init,HwpDocument}=await import(pathToFileURL(pkg+'/rhwp.js'));
await init({module_or_path:wasm});

const crcTable=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(bytes){let n=0xffffffff;for(const b of bytes)n=crcTable[(n^b)&255]^(n>>>8);return(n^0xffffffff)>>>0;}
function unzip(value){
 const b=Buffer.from(value),parts=new Map();let end=-1;
 for(let p=b.length-22;p>=Math.max(0,b.length-65557);p--)if(b.readUInt32LE(p)===0x06054b50){end=p;break;}
 assert.ok(end>=0,'EOCD');let p=b.readUInt32LE(end+16);
 for(let i=0;i<b.readUInt16LE(end+10);i++){
  assert.equal(b.readUInt32LE(p),0x02014b50);const method=b.readUInt16LE(p+10),size=b.readUInt32LE(p+20),length=b.readUInt32LE(p+24),nl=b.readUInt16LE(p+28),el=b.readUInt16LE(p+30),cl=b.readUInt16LE(p+32),local=b.readUInt32LE(p+42),name=b.subarray(p+46,p+46+nl).toString('utf8');
  assert.equal(b.readUInt32LE(local),0x04034b50);const offset=local+30+b.readUInt16LE(local+26)+b.readUInt16LE(local+28),compressed=b.subarray(offset,offset+size);
  const bytes=method===0?Buffer.from(compressed):method===8?inflateRawSync(compressed):assert.fail('ZIP compression');
  assert.equal(bytes.length,length);assert.equal(crc32(bytes),b.readUInt32LE(p+16));assert.ok(!parts.has(name),'duplicate ZIP entry');parts.set(name,bytes);p+=46+nl+el+cl;
 }
 return parts;
}
function zip(parts){
 const local=[],central=[];let offset=0;
 for(const[name,value]of parts){const bytes=Buffer.from(value),n=Buffer.from(name),packed=name==='mimetype'?bytes:deflateRawSync(bytes),method=name==='mimetype'?0:8,crc=crc32(bytes),l=Buffer.alloc(30),c=Buffer.alloc(46);
  l.writeUInt32LE(0x04034b50);l.writeUInt16LE(20,4);l.writeUInt16LE(0x800,6);l.writeUInt16LE(method,8);l.writeUInt32LE(crc,14);l.writeUInt32LE(packed.length,18);l.writeUInt32LE(bytes.length,22);l.writeUInt16LE(n.length,26);
  c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(0x800,8);c.writeUInt16LE(method,10);c.writeUInt32LE(crc,16);c.writeUInt32LE(packed.length,20);c.writeUInt32LE(bytes.length,24);c.writeUInt16LE(n.length,28);c.writeUInt32LE(offset,42);
  local.push(l,n,packed);central.push(c,n);offset+=l.length+n.length+packed.length;
 }
 const directory=Buffer.concat(central),e=Buffer.alloc(22);e.writeUInt32LE(0x06054b50);e.writeUInt16LE(parts.size,8);e.writeUInt16LE(parts.size,10);e.writeUInt32LE(directory.length,12);e.writeUInt32LE(offset,16);return Buffer.concat([...local,directory,e]);
}

function cfbStream(bytes, name) {
 const b=Buffer.from(bytes),sector=2**b.readUInt16LE(30),mini=2**b.readUInt16LE(32),END=0xfffffffe;
 const sec=n=>b.subarray((n+1)*sector,(n+2)*sector),fat=[];
 for(let i=0;i<109;i++){const n=b.readUInt32LE(76+4*i);if(n<0xfffffffa){const f=sec(n);for(let j=0;j<f.length;j+=4)fat.push(f.readUInt32LE(j));}}
 const chain=(start,tab,size)=>{const seen=new Set(),a=[];for(let n=start;n<0xfffffffa;n=tab[n]){assert.ok(!seen.has(n),'CFB loop');seen.add(n);assert.ok(a.length<65536);a.push(n);}return a;};
 const dirs=Buffer.concat(chain(b.readUInt32LE(48),fat).map(sec)),entries=[];
 for(let p=0;p+128<=dirs.length;p+=128){const nl=dirs.readUInt16LE(p+64);if(nl<2)continue;entries.push({name:dirs.subarray(p,p+nl-2).toString('utf16le'),type:dirs[p+66],start:dirs.readUInt32LE(p+116),size:Number(dirs.readBigUInt64LE(p+120))});}
 const e=entries.find(v=>v.name===name);assert.ok(e,'missing CFB '+JSON.stringify(name));
 const root=entries.find(v=>v.type===5),rootchain=chain(root.start,fat),miniFat=Buffer.concat(chain(b.readUInt32LE(60),fat).map(sec)),mt=[];for(let p=0;p<miniFat.length;p+=4)mt.push(miniFat.readUInt32LE(p));
 const chunks=e.size<4096?chain(e.start,mt).map(n=>{const off=n*mini;return {offset:(rootchain[Math.floor(off/sector)]+1)*sector+off%sector,size:mini};}):chain(e.start,fat).map(n=>({offset:(n+1)*sector,size:sector}));
 return {data:Buffer.concat(chunks.map(v=>b.subarray(v.offset,v.offset+v.size))).subarray(0,e.size),replace(raw){assert.equal(raw.length,e.size);let at=0;for(const v of chunks){const len=Math.min(v.size,raw.length-at);raw.copy(b,v.offset,at,at+len);at+=len;}return b;}};
}
function oleProps(raw){const b=Buffer.from(raw),off=b.readUInt32LE(44),n=b.readUInt32LE(off+4),out=new Map();for(let j=0;j<n;j++){const pid=b.readUInt32LE(off+8+j*8),p=off+b.readUInt32LE(off+12+j*8),type=b.readUInt32LE(p);out.set(pid,{type,offset:p,value:type===64?b.readBigUInt64LE(p+4).toString():null});}return out;}
const blank=HwpDocument.createEmpty();blank.createBlankDocument();blank.insertText(0,0,0,'날짜 시험 원본');const base=unzip(blank.exportHwpx());
// Build ordinary external XML fixtures with no private raw-summary contract.
// Explicit carrier counterexamples below retain their stale carrier and must fail.
base.delete('META-INF/jueony-summary-properties-v1.json');blank.free();
const stamp='2020-02-29T23:59:59.1234567Z',modified='2024-03-01T01:02:03.7654321Z';
const ticks=s=>(BigInt(Date.parse(s.slice(0,19)+'Z'))+11644473600000n)*10000n+BigInt(s.slice(20,27));
const results=[],failures=[];async function run(name,f){try{await f();results.push({name,status:'PASS'});}catch(e){results.push({name,status:'FAIL'});failures.push({name,error:String(e),stack:e.stack});}}
const parts=new Map(base);parts.set('Contents/content.hpf',Buffer.from(parts.get('Contents/content.hpf').toString().replace(/<opf:metadata\b[^>]*>[\s\S]*?<\/opf:metadata>/,`<opf:metadata><opf:title>시험</opf:title><opf:meta name="CreatedDate" content="text">${stamp}</opf:meta><opf:meta name="ModifiedDate" content="text">${modified}</opf:meta></opf:metadata>`)));
await run('XML standard dates become actual CFB FILETIME without sample timestamps',async()=>{const doc=new HwpDocument(zip(parts));try{const a=doc.exportHwpWithReport();try{const loss=JSON.parse(a.contentLoss()),bytes=a.takeBytes();assert.equal(loss.count,0,JSON.stringify(loss));const stream=cfbStream(bytes,'\u0005HwpSummaryInformation'),p=oleProps(stream.data);assert.equal(p.get(12)?.type,64);assert.equal(p.get(12)?.value,ticks(stamp).toString());assert.equal(p.get(13)?.value,ticks(modified).toString());assert.equal(verifyPreservedExport(doc,bytes,'hwp',loss,b=>new HwpDocument(b)).status,'checked');await awaitWrite(bytes,'xml-to-hwp.hwp');}finally{a.free();}}finally{doc.free();}});
async function awaitWrite(bytes,name){const path=resolve(out,name);await writeFile(path,bytes);assert.deepEqual(await readFile(path),Buffer.from(bytes),'independent on-disk readback');}
const native=await readFile(resolve(repo,'upstream/rhwp-source/saved/blank2010.hwp')),stream=cfbStream(native,'\u0005HwpSummaryInformation'),summary=Buffer.from(stream.data),props=oleProps(summary);for(const[pid,time]of [[12,stamp],[13,modified]]){const p=props.get(pid);assert.equal(p.type,64);summary.writeBigUInt64LE(ticks(time),p.offset+4);}summary.writeBigUInt64LE(ticks('2021-01-02T03:04:05.0000006Z'),props.get(11).offset+4); const source=stream.replace(summary);
await run('HWP FILETIME becomes actual standard XML CreatedDate/ModifiedDate',async()=>{const doc=new HwpDocument(source);try{const a=doc.exportHwpxWithReport();try{const loss=JSON.parse(a.contentLoss()),bytes=a.takeBytes(),text=unzip(bytes).get('Contents/content.hpf').toString();assert.equal(loss.count,0,JSON.stringify(loss));assert.ok(text.includes(stamp),'created date absent');assert.ok(text.includes(modified),'modified date absent');assert.equal(verifyPreservedExport(doc,bytes,'hwpx',loss,b=>new HwpDocument(b)).status,'checked');await awaitWrite(bytes,'hwp-to-xml.hwpx');const next=new HwpDocument(bytes);try{const binary=next.exportHwp(),p=oleProps(cfbStream(binary,'\u0005HwpSummaryInformation').data);assert.equal(p.get(12)?.value,ticks(stamp).toString());assert.equal(p.get(13)?.value,ticks(modified).toString());}finally{next.free();}}finally{a.free();}}finally{doc.free();}});
await run('readonly stored dates query exposes exact 100ns without guessing',()=>{const doc=new HwpDocument(source);try{assert.equal(typeof doc.getDocumentStoredInformation,'function');const q=JSON.parse(doc.getDocumentStoredInformation());assert.equal(q.created.fileTime100ns,ticks(stamp).toString());assert.equal(q.created.utc,stamp);assert.equal(q.modified.utc,modified);assert.equal(q.lastPrinted.utc,'2021-01-02T03:04:05.0000006Z');assert.equal(q.editingDuration.state,'absent');}finally{doc.free();}});

await run('XML missing dates remain missing rather than sample-created',()=>{const p=new Map(base);p.set('Contents/content.hpf',Buffer.from(p.get('Contents/content.hpf').toString().replace(/<opf:metadata\b[^>]*>[\s\S]*?<\/opf:metadata>/,'<opf:metadata><opf:title>날짜없음</opf:title></opf:metadata>')));const d=new HwpDocument(zip(p));try{const bytes=d.exportHwp(),map=oleProps(cfbStream(bytes,'\u0005HwpSummaryInformation').data);for(const id of [10,11,12,13])assert.equal(map.has(id),false);const next=new HwpDocument(bytes);try{assert.equal(JSON.parse(next.getDocumentStoredInformation()).created.state,'absent');}finally{next.free();}}finally{d.free();}});
await run('Native summary opaque properties and last print survive full conversion cycle',()=>{const d=new HwpDocument(source);try{const xml=d.exportHwpx(),n=new HwpDocument(xml);try{const q=JSON.parse(n.getDocumentStoredInformation());assert.equal(q.lastPrinted.utc,'2021-01-02T03:04:05.0000006Z');const bytes=n.exportHwp();assert.deepEqual(cfbStream(bytes,'\u0005HwpSummaryInformation').data,summary);}finally{n.free();}}finally{d.free();}});
await run('Five-field metadata edit on native document retains its timestamps',()=>{const d=new HwpDocument(source);try{const q=JSON.parse(d.getDocumentMetadata()),values={...q.values,title:'수정 제목'};d.setDocumentMetadata(q.fingerprint,JSON.stringify(values));for(const format of ['hwp','hwpx']){const bytes=format==='hwp'?d.exportHwp():d.exportHwpx(),n=new HwpDocument(bytes);try{const v=JSON.parse(n.getDocumentStoredInformation());assert.equal(v.created.utc,stamp);assert.equal(v.modified.utc,modified);assert.equal(v.lastPrinted.utc,'2021-01-02T03:04:05.0000006Z');assert.equal(JSON.parse(n.getDocumentMetadata()).values.title,'수정 제목');}finally{n.free();}}}finally{d.free();}});
await run('Editing duration is exact unsigned 100ns and survives carrier',()=>{const raw=Buffer.from(summary),o=raw.readUInt32LE(44),count=raw.readUInt32LE(o+4);for(let i=0;i<count;i++)if(raw.readUInt32LE(o+8+i*8)===11){raw.writeUInt32LE(10,o+8+i*8);const off=o+raw.readUInt32LE(o+12+i*8);raw.writeBigUInt64LE(18446744073709551615n,off+4);}const d=new HwpDocument(cfbStream(native,'\u0005HwpSummaryInformation').replace(raw));try{assert.equal(JSON.parse(d.getDocumentStoredInformation()).editingDuration.ticks100ns,'18446744073709551615');const n=new HwpDocument(d.exportHwpx());try{assert.equal(JSON.parse(n.getDocumentStoredInformation()).editingDuration.ticks100ns,'18446744073709551615');const o=new HwpDocument(n.exportHwp());try{assert.equal(JSON.parse(o.getDocumentStoredInformation()).editingDuration.ticks100ns,'18446744073709551615');}finally{o.free();}}finally{n.free();}}finally{d.free();}});
let transported;const owner=new HwpDocument(source);try{transported=unzip(owner.exportHwpx());}finally{owner.free();}
const carrierPath='META-INF/jueony-summary-properties-v1.json';
for(const mode of ['changed-standard-date','changed-author','carrier-raw-date-mismatch','truncated-summary','unknown-version','duplicate-path','aliased-duplicate','lossy-metadata'])await run('Untrusted carrier refuses '+mode,()=>{const p=new Map(transported);assert.ok(p.has(carrierPath),'carrier missing');if(mode==='changed-standard-date'||mode==='changed-author'){const xml=p.get('Contents/content.hpf').toString().replace(mode==='changed-standard-date'?stamp:'<opf:title>',mode==='changed-standard-date'?'2020-01-01T00:00:00.0000000Z':'<opf:title>changed');p.set('Contents/content.hpf',Buffer.from(xml));}else if(mode==='lossy-metadata'){
// A valid literal U+FFFD and an invalid byte decode to the same lossy string.
// A digest over decoded text alone must not grant the stale carrier authority.
const control=new HwpDocument(source);try{const state=JSON.parse(control.getDocumentMetadata());control.setDocumentMetadata(state.fingerprint,JSON.stringify({...state.values,title:'valid \ufffd metadata'}));const valid=unzip(control.exportHwpx());p.clear();for(const [name,bytes]of valid)p.set(name,bytes);}finally{control.free();}
const xml=p.get('Contents/content.hpf'),at=xml.indexOf(Buffer.from('\ufffd'));assert.ok(at>=0,'literal replacement-character control');p.set('Contents/content.hpf',Buffer.concat([xml.subarray(0,at),Buffer.from([0xff]),xml.subarray(at+3)]));} else if(!mode.includes('duplicate')){const c=JSON.parse(p.get(carrierPath));if(mode==='unknown-version')c.schemaVersion=2;else if(mode==='truncated-summary')c.summaryBase64=Buffer.from([1,2,3]).toString('base64');else {const raw=Buffer.from(c.summaryBase64,'base64'),o=oleProps(raw).get(12);raw.writeBigUInt64LE(1n,o.offset+4);c.summaryBase64=raw.toString('base64');}p.set(carrierPath,Buffer.from(JSON.stringify(c)));}let input=p;if(mode.includes('duplicate')){input=[...p,[mode==='duplicate-path'?carrierPath:carrierPath.toUpperCase(),p.get(carrierPath)]];input.size=input.length;}assert.throws(()=>{const d=new HwpDocument(zip(input));try{return d.getTextFileUnicode();}finally{d.free();}},/./);});
await run('Malformed XML timestamp is not guessed as valid/missing',()=>{const p=new Map(parts);p.set('Contents/content.hpf',Buffer.from(p.get('Contents/content.hpf').toString().replace(stamp,'2023-02-29T00:00:00Z')));const d=new HwpDocument(zip(p));try{assert.equal(JSON.parse(d.getDocumentStoredInformation()).created.state,'invalid');assert.throws(()=>d.exportHwp());}finally{d.free();}});
await run('Uninterpreted XML timestamp text retains exact bytes in same-format save',()=>{
 for(const lexical of ['2024-03-01 09:00:00','2023-02-29T00:00:00Z','2024-01-01T00:00:00.12345678Z']){
  const p=new Map(parts),sourceXml=p.get('Contents/content.hpf').toString().replace(stamp,lexical);p.set('Contents/content.hpf',Buffer.from(sourceXml));
  const d=new HwpDocument(zip(p));try{const before=JSON.parse(d.getDocumentStoredInformation());assert.equal(before.created.state,'invalid');
   const artifact=d.exportHwpxWithReport();try{const loss=JSON.parse(artifact.contentLoss()),bytes=artifact.takeBytes();assert.equal(loss.count,0);assert.equal(verifyPreservedExport(d,bytes,'hwpx',loss,b=>new HwpDocument(b)).status,'checked');
    const output=unzip(bytes);assert.equal(output.has(carrierPath),false,'invalid date must not acquire synthetic raw FILETIME');assert.ok(output.get('Contents/content.hpf').toString().includes(`<opf:meta name="CreatedDate" content="text">${lexical}</opf:meta>`),'original timestamp text changed');
    const reopened=new HwpDocument(bytes);try{assert.deepEqual(JSON.parse(reopened.getDocumentStoredInformation()).created,before.created);assert.equal(reopened.getTextFileUnicode(),d.getTextFileUnicode());}finally{reopened.free();}
   }finally{artifact.free();}assert.throws(()=>d.exportHwp(),'ambiguous timestamp must not become a guessed FILETIME');
  }finally{d.free();}
 }
});
assert.deepEqual(await fingerprintSources(),sourceHashes,'production guard sources changed during verification');
await writeFile(out+'/result.json',JSON.stringify({schemaVersion:1,engine,wasmSha256:sha(wasm),verifierSha256:sha(await readFile(fileURLToPath(import.meta.url))),sourceHashes,scope:'Actual WASM standard OPF dates and independent CFB FILETIME properties, exact raw OLE summary roundtrip, 100ns query precision, mandatory production guard, disk readback, and explicit untrusted carrier refusals. Own built-in fixture only. No Hancom UI or equivalence claim.',fixtureSourceSha256:sha(source),originalSummarySha256:sha(summary),results,failures,passed:results.filter(x=>x.status==='PASS').length,total:results.length},null,2));console.log(JSON.stringify({passed:results.filter(x=>x.status==='PASS').length,total:results.length,failures}));if(failures.length)process.exitCode=1;

