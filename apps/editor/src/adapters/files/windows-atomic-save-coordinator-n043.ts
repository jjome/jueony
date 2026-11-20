import {sha256} from '@noble/hashes/sha2.js';
import {
  decideWindowsPickerOpenN043,
  preflightWindowsBoundSaveN043,
  revalidateWindowsFinalReplaceN043,
  type WindowsCommitCapabilityN043,
  type WindowsFileProbeN043,
  type WindowsFileRejectionCodeN043,
  type WindowsFileTargetN043,
  type WindowsOpenBaselineN043,
} from './windows-file-preflight-n043.ts';

export type WindowsTemporaryHandleN043 = Readonly<{opaqueId:string}>;
export type WindowsHostStepResultN043 = Readonly<{status:'ok'}>|Readonly<{status:'failed'}>;
export type WindowsTemporaryCreateResultN043 = Readonly<{status:'created';temporary:WindowsTemporaryHandleN043}>|Readonly<{status:'failed'}>;
export type WindowsAtomicCommitFailureN043 = 'compare-mismatch'|'replace-failed'|'readback-failed'|'readback-hash-mismatch';
export type WindowsAtomicCommitResultN043 =
  | Readonly<{status:'committed';readback:WindowsFileProbeN043}>
  | Readonly<{status:'not-committed';code:WindowsAtomicCommitFailureN043}>;

export type WindowsAtomicReplaceRequestN043 = Readonly<{
  temporary:WindowsTemporaryHandleN043;
  target:WindowsFileTargetN043;
  guard:Readonly<{canonicalPath:string;identity:string;contentHash:string}>;
  expectedContentHash:string;
}>;

/**
 * Trusted desktop-host boundary. `opaqueId` is an unguessable host handle, not
 * a path. Every non-committed atomic result guarantees that the target still
 * has its pre-call bytes. A committed result is returned only after destination
 * flush and readback; a readback failure/mismatch must roll the replacement
 * back before the host returns `not-committed`.
 */
export interface WindowsAtomicSaveHostPortN043 {
  readonly capability:WindowsCommitCapabilityN043;
  probe(target:WindowsFileTargetN043):Promise<WindowsFileProbeN043>;
  createTemporary(target:WindowsFileTargetN043):Promise<WindowsTemporaryCreateResultN043>;
  writeTemporary(temporary:WindowsTemporaryHandleN043,contents:Uint8Array):Promise<WindowsHostStepResultN043>;
  flushTemporary(temporary:WindowsTemporaryHandleN043):Promise<WindowsHostStepResultN043>;
  atomicCompareReplaceAndReadback(request:WindowsAtomicReplaceRequestN043):Promise<WindowsAtomicCommitResultN043>;
  cleanupTemporary(temporary:WindowsTemporaryHandleN043):Promise<'removed'|'absent'|'failed'>;
}

export type WindowsAtomicSaveStageN043 = 'request'|'preflight-probe'|'preflight'|'temporary-create'|'temporary-write'|'temporary-flush'|'final-probe'|'final-revalidation'|'commit'|'readback';
export type WindowsAtomicSaveFailureCodeN043 = WindowsFileRejectionCodeN043|'invalid-request'|'host-failure'|'compare-mismatch'|'replace-failed'|'readback-failed'|'readback-hash-mismatch';
export type WindowsAtomicSaveFailureN043 = Readonly<{
  status:'not-saved';
  stage:WindowsAtomicSaveStageN043;
  code:WindowsAtomicSaveFailureCodeN043;
  originalUnchanged:true;
  temporaryCleanup:'not-needed'|'removed'|'absent'|'failed';
}>;
export type WindowsAtomicSaveUncertainN043 = Readonly<{
  status:'save-state-uncertain';
  stage:'readback';
  code:'committed-readback-unavailable'|'committed-readback-mismatch'|'committed-readback-invalid';
  requiresReopen:true;
  temporaryCleanup:'not-attempted-after-commit';
}>;
export type WindowsAtomicSaveSuccessN043 = Readonly<{status:'saved';baseline:WindowsOpenBaselineN043}>;
export type WindowsAtomicSaveResultN043 = WindowsAtomicSaveFailureN043|WindowsAtomicSaveUncertainN043|WindowsAtomicSaveSuccessN043;
export type WindowsAtomicSaveRequestN043 = Readonly<{baseline:WindowsOpenBaselineN043;contents:Uint8Array}>;

const hex=(bytes:Uint8Array)=>Array.from(bytes,value=>value.toString(16).padStart(2,'0')).join('');
const samePath=(left:string,right:string)=>left.normalize('NFC').toLocaleLowerCase('en-US')===right.normalize('NFC').toLocaleLowerCase('en-US');
const failure=(stage:WindowsAtomicSaveStageN043,code:WindowsAtomicSaveFailureCodeN043,cleanup:WindowsAtomicSaveFailureN043['temporaryCleanup']='not-needed'):WindowsAtomicSaveFailureN043=>Object.freeze({status:'not-saved',stage,code,originalUnchanged:true,temporaryCleanup:cleanup});
const uncertain=(code:WindowsAtomicSaveUncertainN043['code']):WindowsAtomicSaveUncertainN043=>Object.freeze({status:'save-state-uncertain',stage:'readback',code,requiresReopen:true,temporaryCleanup:'not-attempted-after-commit'});

function normalizeBaseline(value:WindowsOpenBaselineN043):WindowsOpenBaselineN043|undefined{
 try{
  const evidence=value?.evidence;
  const decision=decideWindowsPickerOpenN043({status:'selected',target:{canonicalPath:evidence?.canonicalPath,identity:evidence?.identity} as WindowsFileTargetN043},{status:'ok',evidence});
  return decision.status==='open-ready'&&value.writable===decision.baseline.writable?decision.baseline:undefined;
 }catch{return;}
}

async function cleanup(host:WindowsAtomicSaveHostPortN043,temporary:WindowsTemporaryHandleN043):Promise<WindowsAtomicSaveFailureN043['temporaryCleanup']>{
 try{const result=await host.cleanupTemporary(temporary);return ['removed','absent','failed'].includes(result)?result:'failed';}catch{return 'failed';}
}

async function failedAfterTemporary(host:WindowsAtomicSaveHostPortN043,temporary:WindowsTemporaryHandleN043,stage:WindowsAtomicSaveStageN043,code:WindowsAtomicSaveFailureCodeN043):Promise<WindowsAtomicSaveFailureN043>{
 return failure(stage,code,await cleanup(host,temporary));
}

/**
 * Coordinates only the trusted host protocol. It never receives an OS path
 * from a picker and never implements Windows file operations itself.
 */
export async function coordinateWindowsAtomicBoundSaveN043(host:WindowsAtomicSaveHostPortN043,request:WindowsAtomicSaveRequestN043):Promise<WindowsAtomicSaveResultN043>{
 const baseline=normalizeBaseline(request?.baseline);
 if(!baseline||!(request?.contents instanceof Uint8Array))return failure('request','invalid-request');
 const target:WindowsFileTargetN043=Object.freeze({canonicalPath:baseline.evidence.canonicalPath,identity:baseline.evidence.identity});
 const contents=new Uint8Array(request.contents),expectedContentHash=hex(sha256(contents));
 let initialProbe:WindowsFileProbeN043;
 try{initialProbe=await host.probe(target);}catch{return failure('preflight-probe','host-failure');}
 let preflight:ReturnType<typeof preflightWindowsBoundSaveN043>;
 try{preflight=preflightWindowsBoundSaveN043(baseline,initialProbe);}catch{return failure('preflight','host-failure');}
 if(preflight.status!=='save-preflight-ready')return failure('preflight',preflight.code);

 let created:WindowsTemporaryCreateResultN043;
 try{created=await host.createTemporary(target);}catch{return failure('temporary-create','host-failure');}
 if(created.status!=='created')return failure('temporary-create','host-failure');
 const temporary=created.temporary;
 try{if((await host.writeTemporary(temporary,new Uint8Array(contents))).status!=='ok')return await failedAfterTemporary(host,temporary,'temporary-write','host-failure');}
 catch{return await failedAfterTemporary(host,temporary,'temporary-write','host-failure');}
 try{if((await host.flushTemporary(temporary)).status!=='ok')return await failedAfterTemporary(host,temporary,'temporary-flush','host-failure');}
 catch{return await failedAfterTemporary(host,temporary,'temporary-flush','host-failure');}

 let finalProbe:WindowsFileProbeN043;
 try{finalProbe=await host.probe(target);}catch{return await failedAfterTemporary(host,temporary,'final-probe','host-failure');}
 let finalDecision:ReturnType<typeof revalidateWindowsFinalReplaceN043>;
 try{finalDecision=revalidateWindowsFinalReplaceN043(preflight.grant,finalProbe,host.capability);}catch{return await failedAfterTemporary(host,temporary,'final-revalidation','host-failure');}
 if(finalDecision.status!=='final-revalidation-passed')return await failedAfterTemporary(host,temporary,'final-revalidation',finalDecision.code);

 let committed:WindowsAtomicCommitResultN043;
 try{committed=await host.atomicCompareReplaceAndReadback(Object.freeze({temporary,target,guard:finalDecision.guard,expectedContentHash}));}
 catch{return await failedAfterTemporary(host,temporary,'commit','host-failure');}
 if(committed.status!=='committed')return await failedAfterTemporary(host,temporary,committed.code.startsWith('readback-')?'readback':'commit',committed.code);
 if(committed.readback.status!=='ok')return uncertain('committed-readback-unavailable');
 const evidence=committed.readback.evidence;
 const reopened=decideWindowsPickerOpenN043({status:'selected',target:{canonicalPath:evidence.canonicalPath,identity:evidence.identity}},committed.readback);
 if(reopened.status!=='open-ready')return uncertain('committed-readback-invalid');
 const observed=reopened.baseline.evidence;
 if(!samePath(observed.canonicalPath,target.canonicalPath)||observed.size!==contents.byteLength||observed.contentHash!==expectedContentHash)return uncertain('committed-readback-mismatch');
 return Object.freeze({status:'saved',baseline:reopened.baseline});
}
