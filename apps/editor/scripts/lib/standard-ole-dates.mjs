// Independent OLE property bytes + ECMAScript UTC conversion. No native timestamp decoder.
// Small sealed CFB fixtures only; malformed/ambiguous containers fail rather than become absent.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {hwpSummaryEvidence} from './hwp-summary-evidence.mjs';
import {blake3} from '@noble/hashes/blake3.js';
const sha=b=>createHash('sha256').update(b).digest('hex');
const bh=b=>Buffer.from(blake3(b)).toString('hex');
const keys=[['created',12],['modified',13],['lastPrinted',11],['editingDuration',10]];
export function readStandardHwpStoredDates(input){
 const evidence=hwpSummaryEvidence(input),records=[];
 const value=Object.fromEntries(keys.map(([key,pid])=>{
  const raw=evidence.properties.values.get(pid);if(!raw){records.push({key,pid,state:'absent'});return[key,{state:'absent'}];}
  const valid=raw.length>=12&&raw.readUInt32LE(0)===64&&raw.subarray(12).every(b=>b===0);
  const ticks=valid?raw.readBigUInt64LE(4):undefined;
  let state;
  if(!valid)state={state:'invalid',rawBlake3:bh(raw)};
  else if(pid===10)state={state:'value',ticks100ns:String(ticks)};
  else{
   // FILETIME starts at 1601-01-01. Use integer seconds; retain all seven
   // 100ns digits outside Date, whose milliseconds would otherwise truncate.
   const seconds=ticks/10_000_000n,unixMilliseconds=(seconds-11_644_473_600n)*1000n;
   const date=new Date(Number(unixMilliseconds)),year=date.getUTCFullYear();
   state=Number.isFinite(date.getTime())&&year>=1601&&year<=9999
    ?{state:'value',fileTime100ns:String(ticks),utc:date.toISOString().slice(0,19)+'.'+String(ticks%10_000_000n).padStart(7,'0')+'Z'}
    :{state:'invalid',rawBlake3:bh(raw)};
  }
  records.push({key,pid,type:raw.length>=4?raw.readUInt32LE(0):null,rawBytes:raw.length,rawSha256:sha(raw),...(ticks===undefined?{}:{rawFileTime100ns:String(ticks)}),state:state.state});return[key,state];
 }));
 return{summaryPath:evidence.summaryPath,summarySha256:sha(evidence.streams.get(evidence.summaryPath)),value,records};
}
export function assertStandardHwpStoredDates(bytes,doc){
 assert.equal(typeof doc.getDocumentStoredInformation,'function','selected engine must expose readonly timestamp API');
 const independent=readStandardHwpStoredDates(bytes),q=JSON.parse(doc.getDocumentStoredInformation());
 assert.equal(q.schemaVersion,1);assert.equal(q.sourceFormat,'hwp');assert.ok(Array.isArray(q.issues));
 const observed=Object.fromEntries(keys.map(([key])=>[key,q[key]]));assert.deepEqual(observed,independent.value,'WASM timestamps must equal independent original OLE property bytes');
 assert.equal(q.issues.length===0,Object.values(observed).every(v=>v.state!=='invalid'),'invalid raw value must remain observable');
 return{...independent,api:observed};
}
