import test from 'node:test';
import assert from 'node:assert/strict';
import {recoveryBytes} from '../src/mvp/recovery-export.ts';
const artifact=(format:string,count=0)=>({bytes:new Uint8Array([1,2]),contentLoss:{schemaVersion:1,outputFormat:format,count,losses:Array.from({length:count},()=>({code:'controlOmitted'}))}});
test('recovery chooses the actual document format and returns only a loss-free export',()=>{
 const exporter={exportHwpWithReport:()=>artifact('hwp'),exportHwpxWithReport:()=>artifact('hwpx')};
 assert.deepEqual(recoveryBytes(exporter,'계획.HWPX'),new Uint8Array([1,2]));
 assert.deepEqual(recoveryBytes(exporter,'계획.hwp'),new Uint8Array([1,2]));
});
test('loss, missing/mismatched reports and empty bytes never become a new recovery record',()=>{
 for(const bad of [artifact('hwpx',1),artifact('hwp'),{...artifact('hwpx'),bytes:new Uint8Array()},{...artifact('hwpx'),contentLoss:{...artifact('hwpx').contentLoss,count:1}}]){
  assert.throws(()=>recoveryBytes({exportHwpWithReport:()=>artifact('hwp'),exportHwpxWithReport:()=>bad},'계획.hwpx'));
 }
});

test('password-protected document never invokes an unencrypted recovery exporter',()=>{
 let calls=0;const exportPlain=()=>{calls++;return artifact('hwp');};
 assert.throws(()=>recoveryBytes({requiresPasswordForSave:true,exportHwpWithReport:exportPlain,exportHwpxWithReport:exportPlain},'protected.hwp'),/암호/);
 assert.equal(calls,0);
});
