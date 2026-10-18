// Own synthetic packages only. Inspect the ZIP independently of the document
// parser, so an exporter and parser cannot conceal the same metadata loss.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,isAbsolute} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {inflateRawSync,deflateRawSync} from 'node:zlib';
import {capturePreservationEvidence,verifyPreservedExport} from '../src/adapters/rhwp/preservation.ts';

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

const fixturePath=resolve(app,'tests/fixtures/stored-time111-own/requests.json');
const fixtureBytes=await readFile(fixturePath),fixture=JSON.parse(fixtureBytes),fixtureHash=sha(fixtureBytes);
const VALUES=fixture.values,UTC=fixture.utc,request=values=>JSON.stringify({schemaVersion:1,values});
const carrier='META-INF/jueony-summary-properties-v1.json';
const results=[],failures=[],observations=[];
async function run(name,action){try{const detail=await action();results.push({name,status:'PASS',...(detail?{detail}:{})});console.log('PASS',name);}catch(error){results.push({name,status:'FAIL'});failures.push({name,error:String(error),stack:error.stack});console.log('FAIL',name,String(error));}}
const parse=value=>JSON.parse(value),edit=d=>parse(d.getDocumentStoredInformationEditState()),stored=d=>parse(d.getDocumentStoredInformation());
const fields=d=>parse(d.getDocumentMetadata()).values;
function snapshot(d){const evidence=capturePreservationEvidence(d);assert.deepEqual(evidence.issues,[]);return{evidence,metadata:parse(d.getDocumentMetadata()),stored:stored(d),text:d.getTextFileUnicode(),layout:Array.from({length:d.pageCount()},(_,p)=>({text:parse(d.getPageTextLayout(p)),controls:parse(d.getPageControlLayout(p))}))};}
function bodyOnly(s){const v=structuredClone(s);delete v.metadata;delete v.stored;delete v.evidence.values['stored-date-information'];return v;}
function apply(d,values=VALUES){const state=edit(d);assert.equal(state.editable,true,state.reason);const result=parse(d.setDocumentStoredInformation(state.fingerprint,request(values)));assert.equal(result.fingerprint,edit(d).fingerprint);assert.deepEqual(result.information,stored(d));return result;}
function checkValues(d,values=VALUES){const value=stored(d);for(const key of ['created','modified','lastPrinted'])if(Object.hasOwn(values,key)){assert.equal(value[key].state,'value');assert.equal(value[key].fileTime100ns,values[key]);if(values===VALUES)assert.equal(value[key].utc,UTC[key]);}if(Object.hasOwn(values,'editingDuration'))assert.equal(value.editingDuration.ticks100ns,values.editingDuration);assert.deepEqual(value.issues,[]);}
function rawProps(raw){const entries=oleProps(raw),base=raw.readUInt32LE(44),end=base+raw.readUInt32LE(base);return new Map([...entries].map(([id,p])=>{const next=Math.min(end,...[...entries.values()].map(v=>v.offset).filter(v=>v>p.offset));return[id,Buffer.from(raw.subarray(p.offset,next))];}));}
function checkCfb(bytes,values=VALUES){const raw=cfbStream(bytes,'\u0005HwpSummaryInformation').data,p=oleProps(raw);for(const[key,id]of [['created',12],['modified',13],['lastPrinted',11],['editingDuration',10]])if(Object.hasOwn(values,key)){assert.equal(p.get(id)?.type,64);assert.equal(p.get(id)?.value,values[key]);}return raw;}
function xmlParts(metadata){const p=new Map(xmlBase);p.delete(carrier);const old=p.get('Contents/content.hpf').toString();assert.match(old,/<opf:metadata\b[^>]*>[\s\S]*?<\/opf:metadata>/);p.set('Contents/content.hpf',Buffer.from(old.replace(/<opf:metadata\b[^>]*>[\s\S]*?<\/opf:metadata>/,metadata)));return p;}
async function artifact(d,format,name,values){const before=snapshot(d),a=d[format==='hwp'?'exportHwpWithReport':'exportHwpxWithReport']();try{const bytes=a.takeBytes(),loss=parse(a.contentLoss());assert.equal(loss.count,0,JSON.stringify(loss));assert.equal(verifyPreservedExport(d,bytes,format,loss,b=>new HwpDocument(b)).status,'checked');assert.deepEqual(snapshot(d),before,'export mutated source');if(values){if(format==='hwp')checkCfb(bytes,values);else{const x=unzip(bytes).get('Contents/content.hpf').toString();for(const key of ['created','modified'])if(values===VALUES)assert.ok(x.includes(UTC[key]),`standard ${key} missing`);}}
 const path=resolve(out,name);await writeFile(path,bytes);const disk=await readFile(path);assert.deepEqual(disk,Buffer.from(bytes),'disk readback');observations.push({name,format,bytes:disk.length,sha256:sha(disk),productionGuard:'checked',diskReadbackExact:true,sourceUnchanged:true});return new HwpDocument(disk);}finally{a.free();}}
const blank=HwpDocument.createEmpty();blank.createBlankDocument();blank.insertText(0,0,0,'Own stored-time fixture: exact ticks and source preservation.');
const nativeBase=blank.exportHwp(),xmlBase=unzip(blank.exportHwpx());xmlBase.delete(carrier);blank.free();
await writeFile(resolve(out,'own-native-input.hwp'),nativeBase);await writeFile(resolve(out,'own-xml-input.hwpx'),zip(xmlBase));
await run('Typed time API and exact edit-state schema',()=>{const d=new HwpDocument(nativeBase);try{for(const name of ['getDocumentStoredInformationEditState','previewDocumentStoredInformation','setDocumentStoredInformation'])assert.equal(typeof d[name],'function',name);const s=edit(d);assert.equal(s.editable,true,s.reason);assert.match(s.fingerprint,/^[0-9a-f]{64}$/);assert.deepEqual(Object.keys(s).sort(),['editable','fingerprint','information','reason']);assert.deepEqual(s.information,stored(d));}finally{d.free();}});
await run('Immutable preview cancellation retains complete source evidence',()=>{const d=new HwpDocument(nativeBase);try{const before=snapshot(d),s=edit(d),p=parse(d.previewDocumentStoredInformation(s.fingerprint,request(VALUES)));assert.equal(p.changed,true);assert.equal(p.originalFingerprint,s.fingerprint);assert.deepEqual(snapshot(d),before);const result=apply(d);assert.deepEqual(result.information,p.information);assert.deepEqual(bodyOnly(snapshot(d)),bodyOnly(before));}finally{d.free();}});
for(const initial of ['hwp','hwpx'])await run(`${initial} transaction exact 100ns with six alternating disk saves`,async()=>{let d=new HwpDocument(initial==='hwp'?nativeBase:zip(xmlBase));try{const original=snapshot(d),summary=fields(d);apply(d);checkValues(d);assert.deepEqual(fields(d),summary);assert.deepEqual(bodyOnly(snapshot(d)),bodyOnly(original));for(const[cycle,format]of ['hwp','hwpx','hwp','hwpx','hwp','hwpx'].entries()){const next=await artifact(d,format,`${initial}-cycle-${cycle}.${format}`,VALUES);checkValues(next);assert.deepEqual(fields(next),summary);d.free();d=next;}return{diskExports:6,exactTicks:true};}finally{d.free();}});
await run('No-op time transaction retains exact owner fingerprint and evidence',()=>{const d=new HwpDocument(nativeBase);try{apply(d);const before=snapshot(d),s=edit(d);assert.equal(parse(d.setDocumentStoredInformation(s.fingerprint,request(VALUES))).changed,false);assert.deepEqual(snapshot(d),before);}finally{d.free();}});
await run('Ordinary five-field edit and typed edit invalidate stale owner',()=>{const d=new HwpDocument(nativeBase);try{const first=edit(d);apply(d);let before=snapshot(d);assert.throws(()=>d.setDocumentStoredInformation(first.fingerprint,request(VALUES)));assert.deepEqual(snapshot(d),before);const s=edit(d),m=parse(d.getDocumentMetadata());d.setDocumentMetadata(m.fingerprint,JSON.stringify({...m.values,title:'Own new summary owner'}));before=snapshot(d);assert.throws(()=>d.setDocumentStoredInformation(s.fingerprint,request(VALUES)));assert.deepEqual(snapshot(d),before);}finally{d.free();}});
await run('Malformed requests and decoded duplicate keys fail without mutation',()=>{const d=new HwpDocument(nativeBase);try{const s=edit(d),bad=[...fixture.invalidRequests,' '.repeat(4097),'{"schemaVersion":1,"values":{"created":"0","\\u0063reated":"1"}}','{"schemaVersion":1,"schema\\u0056ersion":1,"values":{"created":"0"}}'];for(const source of bad){const before=snapshot(d);assert.throws(()=>d.previewDocumentStoredInformation(s.fingerprint,source));assert.throws(()=>d.setDocumentStoredInformation(s.fingerprint,source));assert.deepEqual(snapshot(d),before);}for(const fp of ['', 'A'.repeat(64),'a'.repeat(65)])assert.throws(()=>d.setDocumentStoredInformation(fp,request(VALUES)));return{requestsRejected:bad.length,invalidFingerprintsRejected:3};}finally{d.free();}});
await run('Unknown OLE property raw bytes and untouched creation remain exact',async()=>{const stream=cfbStream(nativeBase,'\u0005HwpSummaryInformation'),raw=Buffer.from(stream.data),off=raw.readUInt32LE(44),n=raw.readUInt32LE(off+4);let replaced=false;for(let i=0;i<n;i++)if(raw.readUInt32LE(off+8+i*8)===11){raw.writeUInt32LE(999,off+8+i*8);const at=off+raw.readUInt32LE(off+12+i*8);raw.writeUInt32LE(3,at);raw.writeUInt32LE(0x19732551,at+4);replaced=true;break;}assert.equal(replaced,true,'own builtin source has lastPrinted slot for synthetic unknown property');const d=new HwpDocument(stream.replace(raw));try{const original=rawProps(raw),s=stored(d);apply(d,{modified:MODIFIED(),editingDuration:'17'});const next=await artifact(d,'hwp','unknown-ole.hwp');try{const b=next.exportHwp(),actual=rawProps(cfbStream(b,'\u0005HwpSummaryInformation').data);assert.deepEqual(actual.get(999),original.get(999));assert.deepEqual(actual.get(12),original.get(12));assert.deepEqual(stored(next).created,s.created);}finally{next.free();}}finally{d.free();}});
function MODIFIED(){return VALUES.modified;}
await run('Alias OPF names and foreign date payload preserve exact source spans',async()=>{const metadata=`<p:metadata xmlns:p="http://www.idpf.org/2007/opf/" xmlns:q="urn:foreign" data-extra='keep'><p:title>Own XML</p:title><q:meta name='ModifiedDate'>FOREIGN</q:meta><p:meta name='CreatedDate' content='text'>${UTC.created}</p:meta></p:metadata>`,d=new HwpDocument(zip(xmlParts(metadata)));try{apply(d);const next=await artifact(d,'hwpx','alias.hwpx',VALUES);try{const x=unzip(next.exportHwpx()).get('Contents/content.hpf').toString();assert.ok(x.includes("data-extra='keep'"));assert.ok(x.includes("<q:meta name='ModifiedDate'>FOREIGN</q:meta>"));assert.ok(x.includes('<p:meta name="ModifiedDate" content="text">'+UTC.modified+'</p:meta>'));}finally{next.free();}}finally{d.free();}});
await run('Default namespace empty metadata expands exact attributed owner',async()=>{const d=new HwpDocument(zip(xmlParts("<metadata xmlns='http://www.idpf.org/2007/opf/' data-extra='keep' />")));try{apply(d);const next=await artifact(d,'hwpx','default-empty.hwpx',VALUES);try{const x=unzip(next.exportHwpx()).get('Contents/content.hpf').toString();assert.ok(x.includes("<metadata xmlns='http://www.idpf.org/2007/opf/' data-extra='keep' >"));assert.ok(x.includes('<meta name="CreatedDate" content="text">'+UTC.created+'</meta>'));}finally{next.free();}}finally{d.free();}});
await run('Empty date node keeps exact QName and unknown attributes',async()=>{const d=new HwpDocument(zip(xmlParts("<opf:metadata><opf:meta name='ModifiedDate' content='text' data-extra='yes' /></opf:metadata>")));try{apply(d);const next=await artifact(d,'hwpx','empty-date.hwpx',VALUES);try{const x=unzip(next.exportHwpx()).get('Contents/content.hpf').toString();assert.ok(x.includes("<opf:meta name='ModifiedDate' content='text' data-extra='yes' >"+UTC.modified+'</opf:meta>'));}finally{next.free();}}finally{d.free();}});
await run('Malformed original XML date is read-only and never repaired',()=>{const d=new HwpDocument(zip(xmlParts("<opf:metadata><opf:meta name='CreatedDate' content='text'>2023-02-29T00:00:00Z</opf:meta></opf:metadata>")));try{const s=edit(d),before=snapshot(d);assert.equal(s.editable,false);assert.equal(stored(d).created.state,'invalid');assert.throws(()=>d.setDocumentStoredInformation(s.fingerprint,request(VALUES)));assert.deepEqual(snapshot(d),before);}finally{d.free();}});
await run('Wrong native FILETIME raw type is read-only and retained',()=>{const stream=cfbStream(nativeBase,'\u0005HwpSummaryInformation'),raw=Buffer.from(stream.data),at=oleProps(raw).get(12).offset;raw.writeUInt32LE(40,at);const d=new HwpDocument(stream.replace(raw));try{const s=edit(d),before=snapshot(d);assert.equal(s.editable,false);assert.equal(stored(d).created.state,'invalid');assert.throws(()=>d.setDocumentStoredInformation(s.fingerprint,request(VALUES)));assert.deepEqual(snapshot(d),before);}finally{d.free();}});
await run('Numerically identical timezone date is an exact lexical no-op',()=>{const lexical='2024-02-29T02:00:00.1234567+01:00',d=new HwpDocument(zip(xmlParts(`<opf:metadata><opf:meta name='CreatedDate' content='text'>${lexical}</opf:meta></opf:metadata>`)));try{const before=snapshot(d);assert.equal(apply(d,{created:VALUES.created}).changed,false);assert.deepEqual(snapshot(d),before);assert.ok(unzip(d.exportHwpx()).get('Contents/content.hpf').toString().includes(lexical));}finally{d.free();}});
assert.equal(results.length,14,'fixed direct typed-transaction scenario count');
assert.deepEqual(await fingerprintSources(),sourceHashes,'production guard sources changed during verification');assert.equal(sha(await readFile(fixturePath)),fixtureHash,'own request fixture changed during verification');
const report={schemaVersion:1,engine,wasmSha256:sha(wasm),jsSha256:sha(js),verifierSha256:sha(await readFile(fileURLToPath(import.meta.url))),sourceHashes,fixture:{path:'tests/fixtures/stored-time111-own/requests.json',sha256:fixtureHash,nativeInputSha256:sha(nativeBase),xmlInputSha256:sha(zip(xmlBase)),origin:fixture.origin},scope:'Actual WASM explicit stored-time CAS primitive; exact independent CFB/OPF 100ns, immutable preview, stale and malformed owners, mandatory unchanged production guard, actual disk readback. No GUI/clock/save acknowledgement/automatic lifetime/Hancom equivalence claim.',results,observations,failures,passed:results.filter(v=>v.status==='PASS').length,total:results.length};
await writeFile(resolve(out,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,total:report.total,failures}));if(failures.length)process.exitCode=1;
