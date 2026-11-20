import {
 decideNativeDialogActivation,
 parseNativeDialogActivationObservation,
 type NativeDialogActivationObservation,
 type NativeDialogActivationReason,
} from './native-dialog-activation-policy-n020.ts';

export type NativeDialogInputIntentN020='cancel'|'confirm';
export type NativeDialogEvidencePhaseN020='initial'|'after-refresh'|'after-activation';

/**
 * Supported host boundary only. Implementations may use their normal capture
 * provider, but this contract intentionally exposes no Win32/SendKeys escape
 * hatch and accepts no window title, document text or account identifier.
 */
export interface NativeDialogActivationHostN020{
 collectObservation(request:Readonly<{phase:NativeDialogEvidencePhaseN020;refreshAttempts:0|1}>):Promise<unknown>;
 refreshAndReselectOwnedModal():Promise<'refreshed'|'failed'>;
 activateOwnedModal(windowId:string):Promise<'activated'|'failed'>;
 dispatchInput(windowId:string,intent:NativeDialogInputIntentN020):Promise<'dispatched'|'failed'>;
}

export type NativeDialogCoordinatorCodeN020=
 'input-dispatched'|
 'evidence-unavailable'|
 'evidence-invalid'|
 'policy-blocked'|
 'refresh-failed'|
 'policy-blocked-after-refresh'|
 'activation-failed'|
 'post-activation-evidence-drift'|
 'input-failed';

export type NativeDialogCoordinatorResultN020=Readonly<{
 status:'completed'|'user-action-required';
 code:NativeDialogCoordinatorCodeN020;
 policyReason:NativeDialogActivationReason|null;
 refreshAttempts:0|1;
 activationAttempts:0|1;
 inputAttempts:0|1;
}>;

function result(
 status:NativeDialogCoordinatorResultN020['status'],
 code:NativeDialogCoordinatorCodeN020,
 policyReason:NativeDialogActivationReason|null,
 refreshAttempts:0|1,
 activationAttempts:0|1,
 inputAttempts:0|1,
):NativeDialogCoordinatorResultN020{
 return Object.freeze({status,code,policyReason,refreshAttempts,activationAttempts,inputAttempts});
}

async function observation(
 host:NativeDialogActivationHostN020,
 phase:NativeDialogEvidencePhaseN020,
 refreshAttempts:0|1,
):Promise<NativeDialogActivationObservation|null>{
 try{
  const value=parseNativeDialogActivationObservation(await host.collectObservation({phase,refreshAttempts}));
  return value.refreshAttempts===refreshAttempts?value:null;
 }catch{return null;}
}

function sameActivationTarget(before:NativeDialogActivationObservation,after:NativeDialogActivationObservation):boolean{
 return before.controllerSessionId===after.controllerSessionId
  &&before.targetSessionId===after.targetSessionId
  &&before.controllerIntegrity===after.controllerIntegrity
  &&before.targetIntegrity===after.targetIntegrity
  &&before.foregroundPermission===after.foregroundPermission
  &&before.parentWindowId===after.parentWindowId
  &&before.ownedModalWindowId===after.ownedModalWindowId
  &&before.ownedModalOwnerWindowId===after.ownedModalOwnerWindowId
  &&before.lastActivePopupWindowId===after.lastActivePopupWindowId
  &&before.capturedWindowId===after.capturedWindowId
  &&before.inputBindingWindowId===after.inputBindingWindowId
  &&before.foregroundWindowId===after.foregroundWindowId
  &&before.captureGeneration===after.captureGeneration
  &&before.inputBindingGeneration===after.inputBindingGeneration
  &&before.modalVisibleInCapture===after.modalVisibleInCapture
  &&before.modalPresentInAccessibility===after.modalPresentInAccessibility
  &&before.refreshAttempts===after.refreshAttempts
  &&after.activationAttemptsForBinding===1
  &&after.lastActivationError===null;
}

/**
 * Bounded orchestration for a semantic dialog action.
 *
 * It performs zero or one refresh, zero or one activation and zero or one
 * input dispatch. Any unavailable, stale, mismatched or drifting evidence is
 * returned as a fixed safe code; provider exception messages are never exposed.
 */
export async function coordinateNativeDialogActivationN020(
 host:NativeDialogActivationHostN020,
 intent:NativeDialogInputIntentN020,
):Promise<NativeDialogCoordinatorResultN020>{
 let refreshAttempts:0|1=0;
 let current=await observation(host,'initial',refreshAttempts);
 if(!current)return result('user-action-required','evidence-invalid',null,0,0,0);
 if(current.activationAttemptsForBinding!==0)return result('user-action-required','evidence-invalid',null,0,0,0);

 let decision=decideNativeDialogActivation(current);
 if(decision.status==='retry'){
  let refreshed:'refreshed'|'failed';
  try{refreshed=await host.refreshAndReselectOwnedModal();}catch{return result('user-action-required','refresh-failed',decision.reason,0,0,0);}
  if(refreshed!=='refreshed')return result('user-action-required','refresh-failed',decision.reason,0,0,0);
  refreshAttempts=1;
  current=await observation(host,'after-refresh',refreshAttempts);
  if(!current)return result('user-action-required','evidence-invalid',null,1,0,0);
  if(current.activationAttemptsForBinding!==0)return result('user-action-required','evidence-invalid',null,1,0,0);
  decision=decideNativeDialogActivation(current);
  if(decision.status!=='ready')return result('user-action-required','policy-blocked-after-refresh',decision.reason,1,0,0);
 }else if(decision.status==='blocked'){
  return result('user-action-required','policy-blocked',decision.reason,0,0,0);
 }

 const targetWindowId=decision.targetWindowId;
 let activated:'activated'|'failed';
 try{activated=await host.activateOwnedModal(targetWindowId);}catch{return result('user-action-required','activation-failed',null,refreshAttempts,1,0);}
 if(activated!=='activated')return result('user-action-required','activation-failed',null,refreshAttempts,1,0);

 const after=await observation(host,'after-activation',refreshAttempts);
 if(!after)return result('user-action-required','evidence-unavailable',null,refreshAttempts,1,0);
 const afterDecision=decideNativeDialogActivation(after);
 if(afterDecision.status!=='ready'||afterDecision.targetWindowId!==targetWindowId||!sameActivationTarget(current,after)){
  return result('user-action-required','post-activation-evidence-drift',afterDecision.reason,refreshAttempts,1,0);
 }

 let dispatched:'dispatched'|'failed';
 try{dispatched=await host.dispatchInput(targetWindowId,intent);}catch{return result('user-action-required','input-failed',null,refreshAttempts,1,1);}
 if(dispatched!=='dispatched')return result('user-action-required','input-failed',null,refreshAttempts,1,1);
 return result('completed','input-dispatched',afterDecision.reason,refreshAttempts,1,1);
}

