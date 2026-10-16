import assert from 'node:assert/strict';
// Owned tiny ZIP32 test artifacts only. Remove the provenance member without
// changing any retained member's compressed bytes, CRC or other metadata.
export function withoutHwp5OriginMarker(input){
 const b=Buffer.from(input);let endAt=b.length-22;
 while(endAt>=0&&b.readUInt32LE(endAt)!==0x06054b50)endAt--;
 assert.ok(endAt>=0);const count=b.readUInt16LE(endAt+10),locals=[],centrals=[];let at=b.readUInt32LE(endAt+16),offset=0,removed=0;
 for(let i=0;i<count;i++){
  assert.equal(b.readUInt32LE(at),0x02014b50);const n=b.readUInt16LE(at+28),extra=b.readUInt16LE(at+30),comment=b.readUInt16LE(at+32),end=at+46+n+extra+comment,name=b.subarray(at+46,at+46+n).toString();
  if(name==='META-INF/rhwp-hwp5-origin'){removed++;at=end;continue;}
  const old=b.readUInt32LE(at+42);assert.equal(b.readUInt32LE(old),0x04034b50);assert.equal(b.readUInt16LE(old+6)&8,0,'owned ZIP has no data descriptors');
  const length=30+b.readUInt16LE(old+26)+b.readUInt16LE(old+28)+b.readUInt32LE(at+20),local=b.subarray(old,old+length),central=Buffer.from(b.subarray(at,end));central.writeUInt32LE(offset,42);locals.push(local);centrals.push(central);offset+=local.length;at=end;
 }
 assert.equal(removed,1);const central=Buffer.concat(centrals),end=Buffer.from(b.subarray(endAt));end.writeUInt16LE(count-1,8);end.writeUInt16LE(count-1,10);end.writeUInt32LE(central.length,12);end.writeUInt32LE(offset,16);
 return new Uint8Array(Buffer.concat([...locals,central,end]));
}
