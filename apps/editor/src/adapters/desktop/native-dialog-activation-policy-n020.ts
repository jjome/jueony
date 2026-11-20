/**
 * Fail-closed policy for deciding whether a native modal may receive input.
 *
 * This module deliberately has no Win32, UI Automation, SendKeys, or retry loop.
 * A caller must collect a fresh observation through its supported host API and
 * execute only the single action returned here.
 */
export type NativeIntegrityLevel='low'|'medium'|'high'|'system'|'unknown';
export type ForegroundPermission='granted'|'denied'|'unknown';
export type NativeActivationError='failed-to-activate-captured-window'|'foreground-lock-denied'|'access-denied'|null;

export type NativeDialogActivationObservation={
 schemaVersion:1;
 evaluatedAtMs:number;
 observedAtMs:number;
 interactiveDesktop:boolean;
 controllerSessionId:number|null;
 targetSessionId:number|null;
 controllerIntegrity:NativeIntegrityLevel;
 targetIntegrity:NativeIntegrityLevel;
 foregroundPermission:ForegroundPermission;
 parentWindowId:string;
 ownedModalWindowId:string|null;
 ownedModalOwnerWindowId:string|null;
 lastActivePopupWindowId:string|null;
 capturedWindowId:string;
 inputBindingWindowId:string;
 foregroundWindowId:string|null;
 captureGeneration:number;
 inputBindingGeneration:number;
 modalVisibleInCapture:boolean;
 modalPresentInAccessibility:boolean;
 refreshAttempts:0|1;
 activationAttemptsForBinding:0|1;
 lastActivationError:NativeActivationError;
};

export type NativeDialogActivationReason=
 'exact-owned-modal-target'|
 'desktop-not-interactive'|
 'session-unverified'|
 'session-mismatch'|
 'integrity-unverified'|
 'integrity-mismatch'|
 'foreground-permission-unverified'|
 'foreground-permission-denied'|
 'dialog-not-present'|
 'capture-accessibility-disagree'|
 'observation-stale'|
 'input-binding-stale'|
 'owned-modal-not-targetable'|
 'modal-owner-mismatch'|
 'captured-window-mismatch'|
 'foreground-window-mismatch'|
 'activation-failed';

export type NativeDialogUserAction=
 'wait-for-interactive-desktop'|
 'reopen-in-controller-session'|
 'restart-with-matching-integrity'|
 'verify-dialog-is-open'|
 'bring-dialog-to-front'|
 'report-tool-modal-activation-failure';

export type NativeDialogActivationDecision=
 |{status:'ready';action:'dispatch-to-owned-modal';reason:'exact-owned-modal-target';targetWindowId:string;mayDispatchInput:true;retryAllowed:false;userAction:null}
 |{status:'retry';action:'refresh-and-reselect-owned-modal';reason:NativeDialogActivationReason;targetWindowId:null;mayDispatchInput:false;retryAllowed:true;userAction:null}
 |{status:'blocked';action:'request-user-action';reason:NativeDialogActivationReason;targetWindowId:null;mayDispatchInput:false;retryAllowed:false;userAction:NativeDialogUserAction};

const MAX_OBSERVATION_AGE_MS=5_000;
const integrity=new Set<NativeIntegrityLevel>(['low','medium','high','system','unknown']);
const foregroundPermission=new Set<ForegroundPermission>(['granted','denied','unknown']);
const activationError=new Set<Exclude<NativeActivationError,null>>(['failed-to-activate-captured-window','foreground-lock-denied','access-denied']);
const exactKeys=new Set([
 'schemaVersion','evaluatedAtMs','observedAtMs','interactiveDesktop','controllerSessionId','targetSessionId',
 'controllerIntegrity','targetIntegrity','foregroundPermission','parentWindowId','ownedModalWindowId',
 'ownedModalOwnerWindowId','lastActivePopupWindowId','capturedWindowId','inputBindingWindowId',
 'foregroundWindowId','captureGeneration','inputBindingGeneration','modalVisibleInCapture',
 'modalPresentInAccessibility','refreshAttempts','activationAttemptsForBinding','lastActivationError',
]);

const safeInteger=(value:unknown,min=0)=>Number.isSafeInteger(value)&&Number(value)>=min;
function windowId(value:unknown,nullable=false):value is string|null{
 if(nullable&&value===null)return true;
 return typeof value==='string'&&value.length>0&&value.length<=128&&value.trim()===value&&!/[\u0000-\u001f\u007f]/.test(value);
}
function session(value:unknown):value is number|null{return value===null||safeInteger(value);}

/** Strictly validates untrusted host evidence before any activation decision. */
export function parseNativeDialogActivationObservation(value:unknown):NativeDialogActivationObservation{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('네이티브 대화상자 관찰값 형식이 올바르지 않습니다.');
 const row=value as Record<string,unknown>;
 const keys=Object.keys(row);
 if(keys.length!==exactKeys.size||keys.some(key=>!exactKeys.has(key)))throw Error('네이티브 대화상자 관찰값 계약이 일치하지 않습니다.');
 if(row.schemaVersion!==1||!safeInteger(row.evaluatedAtMs)||!safeInteger(row.observedAtMs)||Number(row.observedAtMs)>Number(row.evaluatedAtMs))throw Error('네이티브 대화상자 관찰 시각이 올바르지 않습니다.');
 if(typeof row.interactiveDesktop!=='boolean'||typeof row.modalVisibleInCapture!=='boolean'||typeof row.modalPresentInAccessibility!=='boolean')throw Error('네이티브 대화상자 상태 값이 올바르지 않습니다.');
 if(!session(row.controllerSessionId)||!session(row.targetSessionId))throw Error('네이티브 대화상자 세션 값이 올바르지 않습니다.');
 if(!integrity.has(row.controllerIntegrity as NativeIntegrityLevel)||!integrity.has(row.targetIntegrity as NativeIntegrityLevel))throw Error('네이티브 대화상자 무결성 수준이 올바르지 않습니다.');
 if(!foregroundPermission.has(row.foregroundPermission as ForegroundPermission))throw Error('네이티브 대화상자 전경 권한 값이 올바르지 않습니다.');
 for(const key of ['parentWindowId','capturedWindowId','inputBindingWindowId'] as const)if(!windowId(row[key]))throw Error('네이티브 대화상자 창 식별자가 올바르지 않습니다.');
 for(const key of ['ownedModalWindowId','ownedModalOwnerWindowId','lastActivePopupWindowId','foregroundWindowId'] as const)if(!windowId(row[key],true))throw Error('네이티브 대화상자 선택 창 식별자가 올바르지 않습니다.');
 if(!safeInteger(row.captureGeneration)||!safeInteger(row.inputBindingGeneration))throw Error('네이티브 대화상자 캡처 세대가 올바르지 않습니다.');
 if(row.refreshAttempts!==0&&row.refreshAttempts!==1)throw Error('네이티브 대화상자 재선택은 한 번만 허용됩니다.');
 if(row.activationAttemptsForBinding!==0&&row.activationAttemptsForBinding!==1)throw Error('동일 창 활성화는 한 번만 시도할 수 있습니다.');
 if(row.lastActivationError!==null&&!activationError.has(row.lastActivationError as Exclude<NativeActivationError,null>))throw Error('네이티브 대화상자 활성화 오류 값이 올바르지 않습니다.');
 if(row.activationAttemptsForBinding===0&&row.lastActivationError!==null)throw Error('활성화 시도 없이 오류를 기록할 수 없습니다.');
 return value as NativeDialogActivationObservation;
}
function blocked(reason:NativeDialogActivationReason,userAction:NativeDialogUserAction):NativeDialogActivationDecision{
 return {status:'blocked',action:'request-user-action',reason,targetWindowId:null,mayDispatchInput:false,retryAllowed:false,userAction};
}
function retryOrBlock(observation:NativeDialogActivationObservation,reason:NativeDialogActivationReason):NativeDialogActivationDecision{
 if(observation.refreshAttempts===0)return {status:'retry',action:'refresh-and-reselect-owned-modal',reason,targetWindowId:null,mayDispatchInput:false,retryAllowed:true,userAction:null};
 return blocked(reason,'report-tool-modal-activation-failure');
}

/**
 * Returns at most one refresh request. It never activates a window itself and
 * permits input only when capture, input binding, foreground and ownership all
 * identify the same fresh owned modal.
 */
export function decideNativeDialogActivation(value:unknown):NativeDialogActivationDecision{
 const observation=parseNativeDialogActivationObservation(value);
 if(!observation.interactiveDesktop)return blocked('desktop-not-interactive','wait-for-interactive-desktop');
 if(observation.controllerSessionId===null||observation.targetSessionId===null)return blocked('session-unverified','reopen-in-controller-session');
 if(observation.controllerSessionId!==observation.targetSessionId)return blocked('session-mismatch','reopen-in-controller-session');
 if(observation.controllerIntegrity==='unknown'||observation.targetIntegrity==='unknown')return blocked('integrity-unverified','restart-with-matching-integrity');
 if(observation.controllerIntegrity!==observation.targetIntegrity)return blocked('integrity-mismatch','restart-with-matching-integrity');
 if(observation.foregroundPermission==='unknown')return blocked('foreground-permission-unverified','bring-dialog-to-front');
 if(observation.foregroundPermission==='denied')return blocked('foreground-permission-denied','bring-dialog-to-front');
 if(!observation.modalVisibleInCapture&&!observation.modalPresentInAccessibility)return blocked('dialog-not-present','verify-dialog-is-open');
 if(observation.modalVisibleInCapture!==observation.modalPresentInAccessibility)return retryOrBlock(observation,'capture-accessibility-disagree');
 if(observation.evaluatedAtMs-observation.observedAtMs>MAX_OBSERVATION_AGE_MS)return retryOrBlock(observation,'observation-stale');
 if(observation.captureGeneration!==observation.inputBindingGeneration)return retryOrBlock(observation,'input-binding-stale');
 const modal=observation.ownedModalWindowId;
 if(!modal||observation.lastActivePopupWindowId!==modal)return retryOrBlock(observation,'owned-modal-not-targetable');
 if(observation.ownedModalOwnerWindowId!==observation.parentWindowId)return retryOrBlock(observation,'modal-owner-mismatch');
 if(observation.capturedWindowId!==modal||observation.inputBindingWindowId!==modal)return retryOrBlock(observation,'captured-window-mismatch');
 if(observation.foregroundWindowId!==modal)return retryOrBlock(observation,'foreground-window-mismatch');
 if(observation.lastActivationError!==null)return retryOrBlock(observation,'activation-failed');
 return {status:'ready',action:'dispatch-to-owned-modal',reason:'exact-owned-modal-target',targetWindowId:modal,mayDispatchInput:true,retryAllowed:false,userAction:null};
}

