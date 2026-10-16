import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {sealRecoveryRecord,recoveryIntegrity} from '../src/adapters/storage/recovery-integrity.ts';
import {assertRecoveryRecord,partitionRecoveryRecords} from '../src/modules/document-files/public/index.ts';
const draft=()=>({id:'doc',workspaceId:'work',name:'계획.hwpx',bytes:new Uint8Array([0,1,127,128,255]),dirty:true,updatedAt:17,view:{scroll:3},additive:{kept:true}});

test('sealed checkpoint matches independent SHA-256 of versioned metadata and exact bytes',()=>{
 const original=draft(),saved=sealRecoveryRecord(original);
 const expected=createHash('sha256').update(JSON.stringify(['jueony-recovery',1,'doc','work','계획.hwpx',true,17,5])).update(original.bytes).digest('hex');
 assert.deepEqual(saved.integrity,{version:1,algorithm:'sha256',value:expected});
 assert.equal(Object.hasOwn(original,'integrity'),false);assert.deepEqual(saved.additive,original.additive);
 assert.doesNotThrow(()=>assertRecoveryRecord(saved,'work',recoveryIntegrity));
 original.bytes[0]=99;original.additive.kept=false;assert.equal(saved.bytes[0],0);assert.equal(saved.additive.kept,true);
});
test('every bound field and byte corruption refuses restoration without altering the saved record',()=>{
 const saved=sealRecoveryRecord(draft());
 for(const patch of [{id:'another'},{workspaceId:'other'},{name:'別名.hwp'},{dirty:false},{updatedAt:18},{bytes:new Uint8Array([0,1,127,128,254])},{bytes:new Uint8Array([0,1,127,128])}]){
  const changed={...saved,...patch},copy=structuredClone(changed);
  assert.throws(()=>assertRecoveryRecord(changed,changed.workspaceId,recoveryIntegrity),/무결성/);assert.deepEqual(changed,copy);
 }
});
test('view-only updates retain checksum and content identity',()=>{
 const saved=sealRecoveryRecord(draft()),changed={...saved,view:{scroll:44},viewUpdatedAt:100};
 assert.doesNotThrow(()=>assertRecoveryRecord(changed,'work',recoveryIntegrity));
 assert.deepEqual(sealRecoveryRecord(changed).integrity,saved.integrity);
});
test('malformed and unknown integrity tags cannot silently become legacy records',()=>{
 const saved=sealRecoveryRecord(draft());
 for(const integrity of [null,{}, {version:2,algorithm:'sha256',value:saved.integrity!.value},{...saved.integrity,algorithm:'md5'},{...saved.integrity,value:'F'.repeat(64)},{...saved.integrity,value:'a'.repeat(63)}])
  assert.throws(()=>assertRecoveryRecord({...saved,integrity} as any,'work',recoveryIntegrity),/무결성/);
 assert.throws(()=>assertRecoveryRecord(saved,'work'),/무결성/);
});
test('legacy drafts stay readable and gain integrity on their next successful write',()=>{
 const legacy=draft();assert.doesNotThrow(()=>assertRecoveryRecord(legacy,'work'));
 const upgraded=sealRecoveryRecord(legacy);assert.equal(upgraded.integrity!.version,1);assert.doesNotThrow(()=>assertRecoveryRecord(upgraded,'work',recoveryIntegrity));
});
test('damaged existing checksum cannot be refreshed into a seemingly valid checkpoint',()=>{
 const damaged=sealRecoveryRecord(draft());damaged.bytes[0]^=1;
 assert.throws(()=>sealRecoveryRecord(damaged),/무결성/);
 for(const workspaceId of ['',undefined,null])assert.throws(()=>sealRecoveryRecord({...draft(),workspaceId} as any),/저장 형식/);
});
test('bad sealed drafts are isolated from healthy and legacy drafts without deletion',()=>{
 const good=sealRecoveryRecord(draft()),bad=sealRecoveryRecord({...draft(),id:'bad'}),legacy={...draft(),id:'legacy'};bad.bytes[1]^=1;
 const records=[bad,good,legacy],copy=structuredClone(records),selected=partitionRecoveryRecords(records,'work',recoveryIntegrity);
 assert.deepEqual(selected.valid.map(x=>x.id),['doc','legacy']);assert.equal(selected.errors.length,1);assert.deepEqual(records,copy);
});
test('verification port failure isolates just that draft and keeps later recovery candidates',()=>{
 const saved=sealRecoveryRecord(draft()),legacy={...draft(),id:'legacy'},selected=partitionRecoveryRecords([saved,legacy],'work',{verify(){throw new Error('hash failed');}});
 assert.deepEqual(selected.valid,[legacy]);assert.match(selected.errors[0].message,/hash failed/);
});
