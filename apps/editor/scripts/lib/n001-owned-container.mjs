// Independent, bounded readers/writer for repository-owned N001 test files.
// Never used by the product document parser or its authorization checks.
import assert from 'node:assert/strict';
import {inflateRawSync,deflateRawSync} from 'node:zlib';
export const PASSIVE_ROW_PART='META-INF/rhwp-opaque-native-row-stream-v1.bin';
const crcTable=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(bytes){let n=0xffffffff;for(const b of bytes)n=crcTable[(n^b)&255]^(n>>>8);return(n^0xffffffff)>>>0;}
export function ownZipEntries(value){
 const b=Buffer.from(value),parts=[];assert.ok(b.length<=16*1024*1024);let end=-1;
 for(let p=b.length-22;p>=Math.max(0,b.length-65557);p--)if(b.readUInt32LE(p)===0x06054b50){end=p;break;}
 assert.ok(end>=0,'EOCD');let p=b.readUInt32LE(end+16);assert.ok(b.readUInt16LE(end+10)<=512);
 for(let i=0;i<b.readUInt16LE(end+10);i++){
  assert.equal(b.readUInt32LE(p),0x02014b50);const method=b.readUInt16LE(p+10),size=b.readUInt32LE(p+20),length=b.readUInt32LE(p+24),nl=b.readUInt16LE(p+28),el=b.readUInt16LE(p+30),cl=b.readUInt16LE(p+32),local=b.readUInt32LE(p+42),name=b.subarray(p+46,p+46+nl).toString('utf8');
  assert.ok(length<=4*1024*1024);assert.equal(b.readUInt32LE(local),0x04034b50);const offset=local+30+b.readUInt16LE(local+26)+b.readUInt16LE(local+28);assert.ok(offset+size<=b.length);
  const compressed=b.subarray(offset,offset+size),bytes=method===0?Buffer.from(compressed):method===8?inflateRawSync(compressed,{maxOutputLength:4*1024*1024}):assert.fail('ZIP compression');
  assert.equal(bytes.length,length);assert.equal(crc32(bytes),b.readUInt32LE(p+16));parts.push([name,bytes]);p+=46+nl+el+cl;
 }return parts;
}
export function ownZipPart(bytes,path){const entries=ownZipEntries(bytes).filter(([name])=>name===path);assert.equal(entries.length,1,'Unique ZIP '+path);return entries[0][1];}
export function ownZip(entries){
 const local=[],central=[];let offset=0;
 for(const[name,value,options]of entries){const bytes=Buffer.from(value),n=Buffer.from(name),packed=name==='mimetype'?bytes:deflateRawSync(bytes),method=name==='mimetype'?0:8,crc=crc32(bytes),l=Buffer.alloc(30),c=Buffer.alloc(46);
  let extra=Buffer.alloc(0);if(options?.unicodePath){const text=Buffer.from(options.unicodePath);extra=Buffer.alloc(9+text.length);extra.writeUInt16LE(0x7075);extra.writeUInt16LE(5+text.length,2);extra[4]=1;extra.writeUInt32LE(crc32(n),5);text.copy(extra,9);}
  l.writeUInt32LE(0x04034b50);l.writeUInt16LE(20,4);l.writeUInt16LE(0x800,6);l.writeUInt16LE(method,8);l.writeUInt32LE(crc,14);l.writeUInt32LE(packed.length,18);l.writeUInt32LE(bytes.length,22);l.writeUInt16LE(n.length,26);
  c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(0x800,8);c.writeUInt16LE(method,10);c.writeUInt32LE(crc,16);c.writeUInt32LE(packed.length,20);c.writeUInt32LE(bytes.length,24);c.writeUInt16LE(n.length,28);c.writeUInt32LE(offset,42);
  l.writeUInt16LE(extra.length,28);c.writeUInt16LE(extra.length,30);local.push(l,n,extra,packed);central.push(c,n,extra);offset+=l.length+n.length+extra.length+packed.length;
 }const directory=Buffer.concat(central),e=Buffer.alloc(22);e.writeUInt32LE(0x06054b50);e.writeUInt16LE(entries.length,8);e.writeUInt16LE(entries.length,10);e.writeUInt32LE(directory.length,12);e.writeUInt32LE(offset,16);return Buffer.concat([...local,directory,e]);
}
export function ownCfbStream(value,name){
 const b=Buffer.from(value);assert.ok(b.length<=16*1024*1024);const sector=2**b.readUInt16LE(30),mini=2**b.readUInt16LE(32);assert.ok([512,4096].includes(sector));assert.equal(mini,64);
 const sec=n=>{assert.ok(Number.isSafeInteger(n)&&n>=0&&(n+2)*sector<=b.length);return b.subarray((n+1)*sector,(n+2)*sector);},fat=[];
 assert.equal(b.readUInt32LE(72),0,'Own fixture needs no DIFAT extension');
 for(let i=0;i<109;i++){const n=b.readUInt32LE(76+4*i);if(n<0xfffffffa){const f=sec(n);for(let j=0;j<f.length;j+=4)fat.push(f.readUInt32LE(j));}}
 const chain=(start,tab)=>{const seen=new Set(),a=[];for(let n=start;n<0xfffffffa;n=tab[n]){assert.ok(Number.isSafeInteger(n)&&n<tab.length&&!seen.has(n),'CFB chain');seen.add(n);assert.ok(a.length<32768);a.push(n);}return a;};
 const dirs=Buffer.concat(chain(b.readUInt32LE(48),fat).map(sec)),entries=[];
 for(let p=0;p+128<=dirs.length;p+=128){const nl=dirs.readUInt16LE(p+64);if(nl<2)continue;assert.ok(nl<=64);entries.push({name:dirs.subarray(p,p+nl-2).toString('utf16le'),type:dirs[p+66],start:dirs.readUInt32LE(p+116),size:Number(dirs.readBigUInt64LE(p+120))});}
 const selected=entries.filter(v=>v.name===name&&v.type===2);if(!selected.length)return null;assert.equal(selected.length,1);const e=selected[0],root=entries.find(v=>v.type===5);assert.ok(e.size<=4*1024*1024);
 const rootchain=chain(root.start,fat),mf=Buffer.concat(chain(b.readUInt32LE(60),fat).map(sec)),mt=[];for(let p=0;p<mf.length;p+=4)mt.push(mf.readUInt32LE(p));
 const chunks=e.size<4096?chain(e.start,mt).map(n=>{const off=n*mini;return sec(rootchain[Math.floor(off/sector)]).subarray(off%sector,off%sector+mini);}):chain(e.start,fat).map(sec);
 return Buffer.concat(chunks).subarray(0,e.size);
}
