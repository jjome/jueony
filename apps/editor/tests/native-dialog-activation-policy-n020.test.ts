import {test} from 'node:test';
import assert from 'node:assert/strict';
import {decideNativeDialogActivation,type NativeDialogActivationObservation} from '../src/adapters/desktop/native-dialog-activation-policy-n020.ts';

const base=():NativeDialogActivationObservation=>({
 schemaVersion:1,evaluatedAtMs:10_000,observedAtMs:9_900,interactiveDesktop:true,
 controllerSessionId:1,targetSessionId:1,controllerIntegrity:'medium',targetIntegrity:'medium',
 foregroundPermission:'granted',parentWindowId:'hancom-parent',ownedModalWindowId:'hancom-modal',
 ownedModalOwnerWindowId:'hancom-parent',lastActivePopupWindowId:'hancom-modal',
 capturedWindowId:'hancom-modal',inputBindingWindowId:'hancom-modal',foregroundWindowId:'hancom-modal',
 captureGeneration:4,inputBindingGeneration:4,modalVisibleInCapture:true,modalPresentInAccessibility:true,
 refreshAttempts:0,activationAttemptsForBinding:0,lastActivationError:null,
});

test('permits input only for the fresh foreground owned modal',()=>{
 const decision=decideNativeDialogActivation(base());
 assert.deepEqual(decision,{status:'ready',action:'dispatch-to-owned-modal',reason:'exact-owned-modal-target',targetWindowId:'hancom-modal',mayDispatchInput:true,retryAllowed:false,userAction:null});
});

test('parent capture with a visible modal gets one reselect and then fails closed',()=>{
 const first=base();first.capturedWindowId='hancom-parent';first.inputBindingWindowId='hancom-parent';
 assert.deepEqual(decideNativeDialogActivation(first),{status:'retry',action:'refresh-and-reselect-owned-modal',reason:'captured-window-mismatch',targetWindowId:null,mayDispatchInput:false,retryAllowed:true,userAction:null});
 const final={...first,refreshAttempts:1 as const};
 assert.deepEqual(decideNativeDialogActivation(final),{status:'blocked',action:'request-user-action',reason:'captured-window-mismatch',targetWindowId:null,mayDispatchInput:false,retryAllowed:false,userAction:'report-tool-modal-activation-failure'});
});

test('stale capture and input bindings cannot receive input',()=>{
 const stale={...base(),captureGeneration:5};
 assert.equal(decideNativeDialogActivation(stale).reason,'input-binding-stale');
 const expired={...base(),observedAtMs:4_999,refreshAttempts:1 as const};
 const decision=decideNativeDialogActivation(expired);
 assert.equal(decision.status,'blocked');assert.equal(decision.reason,'observation-stale');assert.equal(decision.mayDispatchInput,false);
});

test('normal and elevated processes require a matching restart, never escalation',()=>{
 const decision=decideNativeDialogActivation({...base(),targetIntegrity:'high'});
 assert.deepEqual(decision,{status:'blocked',action:'request-user-action',reason:'integrity-mismatch',targetWindowId:null,mayDispatchInput:false,retryAllowed:false,userAction:'restart-with-matching-integrity'});
});

test('session, foreground permission and locked desktop are explicit user actions',()=>{
 assert.equal(decideNativeDialogActivation({...base(),targetSessionId:2}).userAction,'reopen-in-controller-session');
 assert.equal(decideNativeDialogActivation({...base(),foregroundPermission:'denied'}).userAction,'bring-dialog-to-front');
 assert.equal(decideNativeDialogActivation({...base(),interactiveDesktop:false}).userAction,'wait-for-interactive-desktop');
});

test('an activation failure is refreshed at most once',()=>{
 const failed={...base(),activationAttemptsForBinding:1 as const,lastActivationError:'failed-to-activate-captured-window' as const};
 assert.equal(decideNativeDialogActivation(failed).status,'retry');
 const final=decideNativeDialogActivation({...failed,refreshAttempts:1 as const});
 assert.equal(final.status,'blocked');assert.equal(final.reason,'activation-failed');assert.equal(final.retryAllowed,false);
});

test('missing or wrongly owned modal remains non-interactive',()=>{
 const missing=decideNativeDialogActivation({...base(),ownedModalWindowId:null,ownedModalOwnerWindowId:null,lastActivePopupWindowId:'hancom-parent'});
 assert.equal(missing.reason,'owned-modal-not-targetable');assert.equal(missing.mayDispatchInput,false);
 const wrongOwner=decideNativeDialogActivation({...base(),ownedModalOwnerWindowId:'other-parent'});
 assert.equal(wrongOwner.reason,'modal-owner-mismatch');assert.equal(wrongOwner.mayDispatchInput,false);
});

test('rejects malformed evidence and unbounded retries before policy evaluation',()=>{
 assert.throws(()=>decideNativeDialogActivation({...base(),refreshAttempts:2}),/한 번/);
 assert.throws(()=>decideNativeDialogActivation({...base(),unexpected:true}),/계약/);
 assert.throws(()=>decideNativeDialogActivation({...base(),activationAttemptsForBinding:0,lastActivationError:'access-denied'}),/시도 없이/);
});
