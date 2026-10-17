import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');
/** Strict logical-stream reader for small owned CFB fixtures. No writing and no Native parser. */
export function hwpLogicalStreams(input){
 const b=Buffer.from(input);assert.ok(b.length>=512&&b.length<=32*1024*1024);assert.equal(b.subarray(0,8).toString('hex'),'d0cf11e0a1b11ae1');
 const size=2**b.readUInt16LE(30),mini=2**b.readUInt16LE(32);assert.ok([512,4096].includes(size)&&mini===64);assert.equal(b.length%size,0);assert.equal(b.readUInt32LE(72),0,'external DIFAT unsupported in these small fixtures');
 const sector=id=>{assert.ok(Number.isSafeInteger(id)&&id>=0&&id<b.length/size-1);return b.subarray((id+1)*size,(id+2)*size);};
 const fats=b.readUInt32LE(44);assert.ok(fats<=109);const fat=Buffer.concat(Array.from({length:fats},(_,i)=>sector(b.readUInt32LE(76+4*i))));
 const chain=(first,table)=>{const ids=[],seen=new Set();for(let id=first;id<0xfffffff0;id=table.readUInt32LE(id*4)){assert.ok(!seen.has(id)&&ids.length<100000);seen.add(id);ids.push(id);}return ids;};
 const full=first=>Buffer.concat(chain(first,fat).map(sector));const directory=full(b.readUInt32LE(48)),entries=[];
 for(let at=0;at<directory.length;at+=128){const nameSize=directory.readUInt16LE(at+64),type=directory[at+66];if(!type){entries.push(null);continue;}assert.ok([1,2,5].includes(type)&&nameSize>=2&&nameSize<=64&&nameSize%2===0);const n=directory.subarray(at,at+nameSize-2);entries.push({name:new TextDecoder('utf-16le',{fatal:true}).decode(n),type,left:directory.readUInt32LE(at+68),right:directory.readUInt32LE(at+72),child:directory.readUInt32LE(at+76),first:directory.readUInt32LE(at+116),size:Number(directory.readBigUInt64LE(at+120))});}
 const roots=entries.map((v,i)=>v?.type===5?i:-1).filter(i=>i>=0);assert.equal(roots.length,1);const root=entries[roots[0]],miniRoot=full(root.first).subarray(0,root.size),miniFat=full(b.readUInt32LE(60));
 const streams=new Map(),visited=new Set([roots[0]]);const tree=(id,path)=>{if(id>=0xfffffff0)return;assert.ok(Number.isSafeInteger(id)&&id>=0&&id<entries.length&&!visited.has(id));visited.add(id);const e=entries[id];assert.ok(e);tree(e.left,path);const name=[...path,e.name].join('/');if(e.type===1)tree(e.child,[...path,e.name]);else{assert.equal(e.type,2);assert.ok(Number.isSafeInteger(e.size)&&e.size>=0&&e.size<=b.length);const bytes=e.size===0?Buffer.alloc(0):e.size<b.readUInt32LE(56)?Buffer.concat(chain(e.first,miniFat).map(i=>{assert.ok(i*mini+mini<=miniRoot.length);return miniRoot.subarray(i*mini,(i+1)*mini);})):full(e.first);assert.ok(bytes.length>=e.size);assert.ok(!streams.has(name));streams.set(name,Buffer.from(bytes.subarray(0,e.size)));}tree(e.right,path);};
 tree(root.child,[]);assert.equal(visited.size,entries.filter(Boolean).length,'unreachable or ambiguous active CFB entries');return streams;
}
function properties(input){
 const b=Buffer.from(input);assert.ok(b.length>=48&&b.length<=1024*1024);assert.equal(b.readUInt16LE(0),0xfffe);assert.equal(b.readUInt32LE(24),1);const base=b.readUInt32LE(44),size=b.readUInt32LE(base),n=b.readUInt32LE(base+4),tableEnd=8+n*8;assert.ok(base>=48&&n<=4096&&size>=tableEnd&&base+size<=b.length);
 const entries=[],ids=new Set(),offsets=new Set();for(let i=0;i<n;i++){const pid=b.readUInt32LE(base+8+i*8),at=b.readUInt32LE(base+12+i*8);assert.ok(!ids.has(pid)&&!offsets.has(at)&&at>=tableEnd&&at<size&&at%4===0);ids.add(pid);offsets.add(at);entries.push({pid,at});}
 const physical=[...entries].sort((a,b)=>a.at-b.at),values=new Map(physical.map((e,i)=>[e.pid,Buffer.from(b.subarray(base+e.at,base+(physical[i+1]?.at??size)))]));
 return{prefix:Buffer.from(b.subarray(0,base)),suffix:Buffer.from(b.subarray(base+size)),lead:Buffer.from(b.subarray(base+tableEnd,base+(physical[0]?.at??size))),entries,physical,values};
}
const keys=['title','subject','author','keywords','description'];
function strings(p){
 let cp;const codepage=p.values.get(1);if(codepage){assert.equal(codepage.readUInt32LE(0),2);cp=codepage.readUInt16LE(4);}
 return Object.fromEntries(keys.map((key,i)=>{const raw=p.values.get(i+2);if(!raw)return[key,''];const kind=raw.readUInt32LE(0),n=raw.readUInt32LE(4);assert.ok(n<=16385);let value;
  if(kind===31){assert.ok(8+n*2<=raw.length);const bytes=raw.subarray(8,8+n*2);if(n)assert.equal(bytes.readUInt16LE(bytes.length-2),0);value=new TextDecoder('utf-16le',{fatal:true}).decode(n?bytes.subarray(0,-2):bytes);}
  else{assert.equal(kind,30);assert.ok(8+n<=raw.length);const bytes=raw.subarray(8,8+n);if(n)assert.equal(bytes.at(-1),0);const text=n?bytes.subarray(0,-1):bytes;const codec=text.every(v=>v<128)?'utf-8':({65001:'utf-8',949:'euc-kr',1252:'windows-1252'})[cp];assert.ok(codec,'unknown ANSI codepage');value=new TextDecoder(codec,{fatal:true}).decode(text);}
  assert.ok(!value.includes('\0'));return[key,value];}));
}
export function hwpSummaryEvidence(bytes){const streams=hwpLogicalStreams(bytes),names=[...streams.keys()].filter(p=>p.split('/').at(-1).replace(/^\x05/u,'')==='HwpSummaryInformation');assert.equal(names.length,1);return{streams,summaryPath:names[0],properties:properties(streams.get(names[0])),values:strings(properties(streams.get(names[0])))};}
/** Exact expected rewrite of five known fields only; every other logical stream,
 * unknown PID payload, padding, property order and header/suffix byte is checked.
 * Use an independent, input-SHA-bound source OPF oracle as expectedValues. */
export function assertKnownSummaryMapping(beforeBytes,afterBytes,expectedValues){
 assert.deepEqual(Object.keys(expectedValues).sort(),[...keys].sort());for(const v of Object.values(expectedValues))assert.ok(typeof v==='string'&&v.length<=4096&&!/[\u0000\ud800-\udfff]/u.test(v));
 const a=hwpSummaryEvidence(beforeBytes),b=hwpSummaryEvidence(afterBytes);assert.deepEqual([...a.streams.keys()].sort(),[...b.streams.keys()].sort());assert.equal(a.summaryPath,b.summaryPath);
 let unchangedStreams=0;for(const[name,raw]of a.streams)if(name!==a.summaryPath){assert.deepEqual(b.streams.get(name),raw,'non-summary stream changed: '+name);unchangedStreams++;}
 const p=a.properties,old=a.values,known=new Map(keys.map((k,i)=>[i+2,k]));for(const pid of known.keys())assert.ok(p.values.has(pid),'missing known PID not allowed by this comparison scope');
 const table=Buffer.alloc(8+p.entries.length*8),parts=[table,p.lead],positions=new Map();let length=table.length+p.lead.length;const changed=[];
 for(const{pid}of p.physical){assert.equal(length%4,0);positions.set(pid,length);let raw=p.values.get(pid);const key=known.get(pid);if(key&&old[key]!==expectedValues[key]){const text=Buffer.from(expectedValues[key]+'\0','utf16le'),n=8+text.length;raw=Buffer.alloc(Math.ceil(n/4)*4);raw.writeUInt32LE(31,0);raw.writeUInt32LE(expectedValues[key].length+1,4);text.copy(raw,8);changed.push({field:key,pid,before:old[key],after:expectedValues[key]});}parts.push(raw);length+=raw.length;}
 table.writeUInt32LE(length,0);table.writeUInt32LE(p.entries.length,4);p.entries.forEach(({pid},i)=>{table.writeUInt32LE(pid,8+i*8);table.writeUInt32LE(positions.get(pid),12+i*8);});const expected=Buffer.concat([p.prefix,...parts,p.suffix]);
 assert.deepEqual(b.streams.get(b.summaryPath),expected,'summary bytes differ from the exact independent five-field rewrite');assert.deepEqual(b.values,expectedValues);const unknownPids=p.entries.filter(e=>!known.has(e.pid)).map(e=>e.pid);for(const pid of unknownPids)assert.deepEqual(b.properties.values.get(pid),p.values.get(pid));
 return{changed,unchangedLogicalStreams:unchangedStreams,unknownPidsByteExact:unknownPids,knownMappingExact:true,allOtherLogicalStreamsExact:true,summarySha256:{before:sha(a.streams.get(a.summaryPath)),after:sha(b.streams.get(b.summaryPath))},wholeFileByteEqual:Buffer.from(beforeBytes).equals(Buffer.from(afterBytes))};
}
