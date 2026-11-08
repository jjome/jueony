import assert from 'node:assert/strict';
import {inflateRawSync} from 'node:zlib';
import {hwpLogicalStreams} from './hwp-summary-evidence.mjs';

/** Independent raw HWP oracle for this one-table, first-owner fixture.
 * Preserve every owner paragraph record, including original LINE_SEG bit31.
 * HWP->HWPX cache emission is a different, ancestor-provenance-bound policy. */
export function subdivisionFieldOwnerRecords(bytes){
  const streams=hwpLogicalStreams(bytes),header=streams.get('FileHeader');
  assert.ok(header && streams.has('BodyText/Section0'));
  assert.equal([...streams.keys()].filter(n=>/^BodyText\/Section\d+$/.test(n)).length,1);
  const input=streams.get('BodyText/Section0'),body=header.readUInt32LE(36)&1?inflateRawSync(input):input,records=[];
  assert.ok(body.length<=32*1024*1024);
  for(let at=0;at<body.length;){
    const start=at;assert.ok(at+4<=body.length);
    const word=body.readUInt32LE(at),tag=word&1023,level=(word>>>10)&1023;let length=word>>>20;at+=4;
    if(length===4095){assert.ok(at+4<=body.length);length=body.readUInt32LE(at);at+=4;}
    assert.ok(at+length<=body.length);
    records.push({tag,level,data:body.subarray(at,at+length),bytes:body.subarray(start,at+length).toString('hex')});
    at+=length;
  }
  const tables=records.map((r,i)=>r.tag===71 && r.level===1 && r.data.subarray(0,4).toString('hex')==='206c6274'?i:-1).filter(i=>i>=0);
  assert.equal(tables.length,1);
  const first=records.findIndex((r,i)=>i>tables[0] && r.tag===72 && r.level===2);
  const next=records.findIndex((r,i)=>i>first && (r.level<2 || r.tag===72 && r.level===2));
  assert.ok(first>tables[0] && next>first);
  const paragraphs=records.slice(first+1,next);assert.equal(paragraphs[0].tag,66);
  assert.equal(paragraphs.filter(r=>r.tag===71 && r.data.subarray(0,4).toString('hex')==='6b6c6325').length,2);
  assert.equal(paragraphs.filter(r=>r.tag===69).length,5);
  return paragraphs.map(({tag,level,bytes})=>({tag,level,bytes}));
}
