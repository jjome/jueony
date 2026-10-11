import assert from 'node:assert/strict';
import {inflateRawSync} from 'node:zlib';
// Inspect serialized XML independently of rhwp's parser, which reads tabStop and
// would otherwise miss a stale tabStopVal consumed by the native Hancom editor.
export function hwpxSectionTabAttributes(bytes){
 const zip=Buffer.from(bytes),minimum=Math.max(0,zip.length-65557);let end=zip.length-22;
 while(end>=minimum&&(zip.readUInt32LE(end)!==0x06054b50||end+22+zip.readUInt16LE(end+20)!==zip.length))end--;
 assert.ok(end>=minimum,'HWPX ZIP end directory must exist');
 const count=zip.readUInt16LE(end+10);let cursor=zip.readUInt32LE(end+16);const observations=[];
 for(let i=0;i<count;i++){
  assert.equal(zip.readUInt32LE(cursor),0x02014b50,'ZIP central-directory signature');
  const method=zip.readUInt16LE(cursor+10),size=zip.readUInt32LE(cursor+20),expanded=zip.readUInt32LE(cursor+24);
  const nameLength=zip.readUInt16LE(cursor+28),extraLength=zip.readUInt16LE(cursor+30),commentLength=zip.readUInt16LE(cursor+32);
  const offset=zip.readUInt32LE(cursor+42),name=zip.subarray(cursor+46,cursor+46+nameLength).toString('utf8');
  cursor+=46+nameLength+extraLength+commentLength;
  const section=/^Contents\/section(\d+)\.xml$/.exec(name);if(!section)continue;
  assert.ok(expanded<=4*1024*1024,'diagnostic section XML size limit');
  assert.equal(zip.readUInt32LE(offset),0x04034b50,'ZIP local-header signature');
  const start=offset+30+zip.readUInt16LE(offset+26)+zip.readUInt16LE(offset+28);assert.ok(start+size<=zip.length);
  const compressed=zip.subarray(start,start+size);assert.ok(method===0||method===8,'supported HWPX ZIP compression');
  const xml=method===0?compressed:inflateRawSync(compressed,{maxOutputLength:4*1024*1024});assert.equal(xml.length,expanded);
  const secPr=/<hp:secPr\b[^>]*>/.exec(xml.toString('utf8'));assert.ok(secPr,`${name} secPr must exist`);
  const attribute=key=>{const match=new RegExp(`\\b${key}="([^"]*)"`).exec(secPr[0]);assert.ok(match,`${name} must serialize ${key}`);return match[1];};
  observations.push({section:Number(section[1]),tabStop:Number(attribute('tabStop')),tabStopVal:Number(attribute('tabStopVal')),tabStopUnit:attribute('tabStopUnit')});
 }
 return observations.sort((a,b)=>a.section-b.section);
}
