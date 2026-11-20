import test from 'node:test';
import assert from 'node:assert/strict';
import {sha256} from '@noble/hashes/sha2.js';
import {decideWindowsPickerOpenN043,type WindowsFileEvidenceN043,type WindowsFileProbeN043} from '../src/adapters/files/windows-file-preflight-n043.ts';
import {coordinateWindowsAtomicBoundSaveN043,type WindowsAtomicCommitResultN043,type WindowsAtomicSaveHostPortN043,type WindowsHostStepResultN043,type WindowsTemporaryCreateResultN043,type WindowsTemporaryHandleN043} from '../src/adapters/files/windows-atomic-save-coordinator-n043.ts';

const oldHash='a'.repeat(64),secretPath='C:\\private\\resident-number\\api-key.hwpx',secretIdentity='secret-file-identity';
const bytes=new TextEncoder().encode('새 문서 내용 😀');
const digest=(value:Uint8Array)=>Array.from(sha256(value),byte=>byte.toString(16).padStart(2,'0')).join('');
const evidence=(change:Partial<WindowsFileEvidenceN043>={}):WindowsFileEvidenceN043=>({canonicalPath:secretPath,identity:secretIdentity,kind:'file',size:321,modifiedTimeNs:'1780000000000000000',contentHash:oldHash,readable:true,writable:true,readOnly:false,...change});
function baseline(){const opened=decideWindowsPickerOpenN043({status:'selected',target:{canonicalPath:secretPath,identity:secretIdentity}},{status:'ok',evidence:evidence()});assert.equal(opened.status,'open-ready');if(opened.status!=='open-ready')throw new Error('fixture');return opened.baseline;}

function fixture(){
 const calls:string[]=[],probes:WindowsFileProbeN043[]=[{status:'ok',evidence:evidence()},{status:'ok',evidence:evidence()}];
 const temporary:WindowsTemporaryHandleN043={opaqueId:'opaque-temporary-1'};
 let capability={identityAndHashCheckedAtReplace:true,atomicReplaceOrNoClobber:true,committedBytesReadbackHash:true},create:WindowsTemporaryCreateResultN043={status:'created',temporary},write:WindowsHostStepResultN043={status:'ok'},flush:WindowsHostStepResultN043={status:'ok'},cleanup:'removed'|'absent'|'failed'='removed',commit:WindowsAtomicCommitResultN043|undefined;
 const host:WindowsAtomicSaveHostPortN043={
  get capability(){return capability;},
  async probe(){calls.push('probe');return probes.shift()??{status:'read-error'};},
  async createTemporary(){calls.push('create');return create;},
  async writeTemporary(_temporary,contents){calls.push('write');assert.notEqual(contents,bytes);return write;},
  async flushTemporary(){calls.push('flush');return flush;},
  async atomicCompareReplaceAndReadback(request){calls.push('atomic-compare-replace-readback');assert.equal(request.guard.identity,secretIdentity);assert.equal(request.guard.contentHash,oldHash);assert.equal(request.expectedContentHash,digest(bytes));return commit??{status:'committed',readback:{status:'ok',evidence:evidence({identity:'volume-3:new-file',size:bytes.byteLength,modifiedTimeNs:'1780000000000000001',contentHash:digest(bytes)})}};},
  async cleanupTemporary(){calls.push('cleanup');return cleanup;},
 };
 return {host,calls,probes,setCapability:(value:typeof capability)=>capability=value,setCreate:(value:WindowsTemporaryCreateResultN043)=>create=value,setWrite:(value:WindowsHostStepResultN043)=>write=value,setFlush:(value:WindowsHostStepResultN043)=>flush=value,setCommit:(value:WindowsAtomicCommitResultN043)=>commit=value,setCleanup:(value:typeof cleanup)=>cleanup=value};
}

test('open baseline flows through two probes, durable temporary IO and one atomic verified commit',async()=>{
 const f=fixture(),result=await coordinateWindowsAtomicBoundSaveN043(f.host,{baseline:baseline(),contents:bytes});
 assert.equal(result.status,'saved');
 if(result.status!=='saved')return;
 assert.deepEqual(f.calls,['probe','create','write','flush','probe','atomic-compare-replace-readback']);
 assert.equal(result.baseline.evidence.identity,'volume-3:new-file');
 assert.equal(result.baseline.evidence.contentHash,digest(bytes));
 assert.deepEqual(Object.keys(result).sort(),['baseline','status']);
});

test('preflight conflicts never create a temporary file or call replace',async()=>{
 for(const change of [{identity:'external-replacement'},{contentHash:'b'.repeat(64)},{modifiedTimeNs:'1780000000000000002'}]){
  const f=fixture();f.probes.splice(0,2,{status:'ok',evidence:evidence(change)});
  const result=await coordinateWindowsAtomicBoundSaveN043(f.host,{baseline:baseline(),contents:bytes});
  assert.equal(result.status,'not-saved');assert.deepEqual(f.calls,['probe']);assert.equal(f.calls.includes('atomic-compare-replace-readback'),false);
 }
});

test('final identity or content race is rejected after flush with zero replace calls and cleanup',async()=>{
 for(const change of [{identity:'raced-identity'},{contentHash:'c'.repeat(64)},{size:322}]){
  const f=fixture();f.probes[1]={status:'ok',evidence:evidence(change)};
  const result=await coordinateWindowsAtomicBoundSaveN043(f.host,{baseline:baseline(),contents:bytes});
  assert.equal(result.status,'not-saved');assert.deepEqual(f.calls,['probe','create','write','flush','probe','cleanup']);assert.equal(f.calls.includes('atomic-compare-replace-readback'),false);
  if(result.status==='not-saved')assert.equal(result.temporaryCleanup,'removed');
 }
});

test('failure matrix attempts cleanup after every temporary-bearing failure',async()=>{
 const cases:[string,(f:ReturnType<typeof fixture>)=>void,string[]][]=[
  ['write',f=>f.setWrite({status:'failed'}),['probe','create','write','cleanup']],
  ['flush',f=>f.setFlush({status:'failed'}),['probe','create','write','flush','cleanup']],
  ['final-probe',f=>{f.probes[1]={status:'read-error'};},['probe','create','write','flush','probe','cleanup']],
  ['capability',f=>f.setCapability({...f.host.capability,atomicReplaceOrNoClobber:false}),['probe','create','write','flush','probe','cleanup']],
  ['compare',f=>f.setCommit({status:'not-committed',code:'compare-mismatch'}),['probe','create','write','flush','probe','atomic-compare-replace-readback','cleanup']],
  ['readback',f=>f.setCommit({status:'not-committed',code:'readback-hash-mismatch'}),['probe','create','write','flush','probe','atomic-compare-replace-readback','cleanup']],
 ];
 for(const [name,arrange,expected] of cases){const f=fixture();arrange(f);const result=await coordinateWindowsAtomicBoundSaveN043(f.host,{baseline:baseline(),contents:bytes});assert.equal(result.status,'not-saved',name);assert.deepEqual(f.calls,expected,name);if(result.status==='not-saved'){assert.equal(result.originalUnchanged,true,name);assert.equal(result.temporaryCleanup,'removed',name);}}
});

test('create failure is write-free, while cleanup failure remains explicit and leak-free',async()=>{
 const createFailure=fixture();createFailure.setCreate({status:'failed'});const first=await coordinateWindowsAtomicBoundSaveN043(createFailure.host,{baseline:baseline(),contents:bytes});assert.deepEqual(createFailure.calls,['probe','create']);assert.deepEqual(first,{status:'not-saved',stage:'temporary-create',code:'host-failure',originalUnchanged:true,temporaryCleanup:'not-needed'});
 const cleanupFailure=fixture();cleanupFailure.setWrite({status:'failed'});cleanupFailure.setCleanup('failed');const second=await coordinateWindowsAtomicBoundSaveN043(cleanupFailure.host,{baseline:baseline(),contents:bytes});assert.equal(second.status,'not-saved');assert.doesNotMatch(JSON.stringify(second),/private|resident|api-key|secret-file|새 문서/u);if(second.status==='not-saved')assert.equal(second.temporaryCleanup,'failed');
});

test('a committed target with unavailable or mismatched readback is uncertain, never falsely preserved',async()=>{
 const cases:WindowsAtomicCommitResultN043[]=[
  {status:'committed',readback:{status:'read-error'}},
  {status:'committed',readback:{status:'ok',evidence:evidence({identity:'volume-3:new-file',size:bytes.byteLength,modifiedTimeNs:'1780000000000000001',contentHash:'malformed'})}},
  {status:'committed',readback:{status:'ok',evidence:evidence({identity:'volume-3:new-file',size:bytes.byteLength,modifiedTimeNs:'1780000000000000001',contentHash:'f'.repeat(64)})}},
 ];
 for(const committed of cases){
  const f=fixture();f.setCommit(committed);
  const result=await coordinateWindowsAtomicBoundSaveN043(f.host,{baseline:baseline(),contents:bytes});
  assert.equal(result.status,'save-state-uncertain');
  assert.deepEqual(f.calls,['probe','create','write','flush','probe','atomic-compare-replace-readback']);
  assert.equal('originalUnchanged' in result,false);
  assert.equal(result.status==='save-state-uncertain'&&result.requiresReopen,true);
  assert.equal(result.status==='save-state-uncertain'&&result.temporaryCleanup,'not-attempted-after-commit');
  assert.doesNotMatch(JSON.stringify(result),/private|resident|api-key|secret-file|새 문서/u);
 }
});
