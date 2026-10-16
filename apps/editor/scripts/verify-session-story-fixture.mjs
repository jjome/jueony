import assert from 'node:assert/strict';
import {inflateRawSync,deflateRawSync} from 'node:zlib';
// Mutate one known DocInfo style payload in a self-authored test HWP only.
// Allocation and topology remain intact; never use this helper on user documents.
export function sessionStyleRecordFixture(input,mutate,streamName='DocInfo'){
 const b=Buffer.from(input);assert.equal(b.subarray(0,8).toString('hex'),'d0cf11e0a1b11ae1');
 const sector=1<<b.readUInt16LE(30),mini=1<<b.readUInt16LE(32);assert.equal(mini,64);
 const readSector=n=>b.subarray((n+1)*sector,(n+2)*sector);
 const fats=[];for(let i=0;i<109;i++){const n=b.readUInt32LE(76+i*4);if(n<0xfffffffa)fats.push(readSector(n));}
 assert.equal(fats.length,b.readUInt32LE(44));const fat=Buffer.concat(fats);
 const chain=(start,map)=>{const result=[];for(let n=start;n<0xfffffffa;n=map.readUInt32LE(n*4)){assert.ok(!result.includes(n),'cycle');result.push(n);}return result;};
 const directory=chain(b.readUInt32LE(48),fat),dir=Buffer.concat(directory.map(readSector));
 const entries=[];for(let pos=0;pos<dir.length;pos+=128){const e=dir.subarray(pos,pos+128);if(e[66])entries.push({name:e.subarray(0,e.readUInt16LE(64)-2).toString('utf16le'),type:e[66],start:e.readUInt32LE(116),size:Number(e.readBigUInt64LE(120)),pos});}
 const root=entries.find(e=>e.type===5),body=entries.filter(e=>e.name===streamName);assert.equal(body.length,1);const e=body[0];assert.ok(e.size<4096,'tiny fixture mini stream');
 const miniFat=Buffer.concat(chain(b.readUInt32LE(60),fat).map(readSector)),rootChain=chain(root.start,fat),bodyChain=chain(e.start,miniFat);
 const offsets=bodyChain.map(n=>{const logical=n*mini;return(rootChain[Math.floor(logical/sector)]+1)*sector+logical%sector;});
 const compressed=Buffer.concat(offsets.map(o=>b.subarray(o,o+mini))).subarray(0,e.size),raw=inflateRawSync(compressed);let changed=0;
 for(let at=0;at<raw.length;){const recordHeader=raw.subarray(at,at+4),header=raw.readUInt32LE(at);at+=4;const tag=header&1023,level=(header>>>10)&1023;let size=header>>>20;if(size===4095){size=raw.readUInt32LE(at);at+=4;}assert.ok(at+size<=raw.length);if(mutate({tag,level,recordHeader,data:raw.subarray(at,at+size)}))changed++;at+=size;}
 assert.equal(changed,1);const replacement=deflateRawSync(raw);assert.ok(replacement.length<=offsets.length*mini,'fixture stream must fit existing allocation');
 offsets.forEach((o,i)=>{b.fill(0,o,o+mini);replacement.subarray(i*mini,(i+1)*mini).copy(b,o);});
 const logical=e.pos+120; b.writeBigUInt64LE(BigInt(replacement.length),(directory[Math.floor(logical/sector)]+1)*sector+logical%sector);return new Uint8Array(b);
}
