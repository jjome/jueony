import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
 coordinateNativeDialogActivationN020,
 type NativeDialogActivationHostN020,
 type NativeDialogEvidencePhaseN020,
} from '../src/adapters/desktop/native-dialog-activation-coordinator-n020.ts';
import type {NativeDialogActivationObservation} from '../src/adapters/desktop/native-dialog-activation-policy-n020.ts';

const evidence=(patch:Partial<NativeDialogActivationObservation>={}):NativeDialogActivationObservation=>({
 schemaVersion:1,evaluatedAtMs:10_000,observedAtMs:9_900,interactiveDesktop:true,
 controllerSessionId:1,targetSessionId:1,controllerIntegrity:'medium',targetIntegrity:'medium',
 foregroundPermission:'granted',parentWindowId:'parent',ownedModalWindowId:'modal',ownedModalOwnerWindowId:'parent',
 lastActivePopupWindowId:'modal',capturedWindowId:'modal',inputBindingWindowId:'modal',foregroundWindowId:'modal',
 captureGeneration:4,inputBindingGeneration:4,modalVisibleInCapture:true,modalPresentInAccessibility:true,
 refreshAttempts:0,activationAttemptsForBinding:0,lastActivationError:null,...patch,
});

function hostFor(sequence:NativeDialogActivationObservation[],overrides:Partial<NativeDialogActivationHostN020>={}){
 const calls:{collect:NativeDialogEvidencePhaseN020[];refresh:number;activate:number;input:number;intents:string[]}={collect:[],refresh:0,activate:0,input:0,intents:[]};
 const host:NativeDialogActivationHostN020={
  async collectObservation(request){calls.collect.push(request.phase);return sequence.shift();},
  async refreshAndReselectOwnedModal(){calls.refresh++;return 'refreshed';},
  async activateOwnedModal(){calls.activate++;return 'activated';},
  async dispatchInput(_windowId,intent){calls.input++;calls.intents.push(intent);return 'dispatched';},
  ...overrides,
 };
 return {host,calls};
}

test('collects, activates, rechecks and only then dispatches semantic input',async()=>{
 const {host,calls}=hostFor([evidence(),evidence({activationAttemptsForBinding:1})]);
 const value=await coordinateNativeDialogActivationN020(host,'cancel');
 assert.deepEqual(value,{status:'completed',code:'input-dispatched',policyReason:'exact-owned-modal-target',refreshAttempts:0,activationAttempts:1,inputAttempts:1});
 assert.deepEqual(calls,{collect:['initial','after-activation'],refresh:0,activate:1,input:1,intents:['cancel']});
});

test('refreshes a parent-bound capture exactly once before activation',async()=>{
 const mismatch=evidence({capturedWindowId:'parent',inputBindingWindowId:'parent'});
 const ready=evidence({refreshAttempts:1});
 const after=evidence({refreshAttempts:1,activationAttemptsForBinding:1});
 const {host,calls}=hostFor([mismatch,ready,after]);
 const value=await coordinateNativeDialogActivationN020(host,'confirm');
 assert.equal(value.status,'completed');assert.equal(value.refreshAttempts,1);
 assert.deepEqual(calls,{collect:['initial','after-refresh','after-activation'],refresh:1,activate:1,input:1,intents:['confirm']});
});

for(const [name,patch] of [
 ['integrity mismatch',{targetIntegrity:'high'}],
 ['foreground permission denied',{foregroundPermission:'denied'}],
] as const)test(`${name} never activates or dispatches input`,async()=>{
 const {host,calls}=hostFor([evidence(patch)]);
 const value=await coordinateNativeDialogActivationN020(host,'cancel');
 assert.equal(value.status,'user-action-required');assert.equal(value.code,'policy-blocked');
 assert.equal(calls.refresh,0);assert.equal(calls.activate,0);assert.equal(calls.input,0);
});

test('persistent owner mismatch gets one refresh then requires user action',async()=>{
 const wrong=evidence({ownedModalOwnerWindowId:'other-parent'});
 const {host,calls}=hostFor([wrong,evidence({...wrong,refreshAttempts:1})]);
 const value=await coordinateNativeDialogActivationN020(host,'cancel');
 assert.equal(value.code,'policy-blocked-after-refresh');assert.equal(value.policyReason,'modal-owner-mismatch');
 assert.equal(calls.refresh,1);assert.equal(calls.activate,0);assert.equal(calls.input,0);
});

test('activation failure is never followed by input or fallback',async()=>{
 const {host,calls}=hostFor([evidence()],{async activateOwnedModal(){calls.activate++;return 'failed';}});
 const value=await coordinateNativeDialogActivationN020(host,'cancel');
 assert.equal(value.code,'activation-failed');assert.equal(calls.activate,1);assert.equal(calls.input,0);
});

test('post-activation identity drift fails closed before input',async()=>{
 const after=evidence({activationAttemptsForBinding:1,captureGeneration:5,inputBindingGeneration:5});
 const {host,calls}=hostFor([evidence(),after]);
 const value=await coordinateNativeDialogActivationN020(host,'confirm');
 assert.equal(value.code,'post-activation-evidence-drift');assert.equal(calls.activate,1);assert.equal(calls.input,0);
});

test('stale evidence can refresh once but never loops',async()=>{
 const stale=evidence({observedAtMs:1_000});
 const {host,calls}=hostFor([stale,evidence({...stale,refreshAttempts:1})]);
 const value=await coordinateNativeDialogActivationN020(host,'cancel');
 assert.equal(value.code,'policy-blocked-after-refresh');assert.equal(calls.refresh,1);assert.equal(calls.input,0);
});

test('provider errors are reduced to fixed codes without leaking messages',async()=>{
 const secret='account@example.test secret document title';
 const {host,calls}=hostFor([evidence()],{async activateOwnedModal(){calls.activate++;throw Error(secret);}});
 const value=await coordinateNativeDialogActivationN020(host,'cancel');
 assert.equal(value.code,'activation-failed');assert.doesNotMatch(JSON.stringify(value),/account|secret|document title/);
 assert.equal(calls.input,0);
});

test('host cannot skip or forge the bounded refresh counter',async()=>{
 const mismatch=evidence({capturedWindowId:'parent',inputBindingWindowId:'parent'});
 const {host,calls}=hostFor([mismatch,evidence()]);
 const value=await coordinateNativeDialogActivationN020(host,'cancel');
 assert.equal(value.code,'evidence-invalid');assert.equal(calls.refresh,1);assert.equal(calls.activate,0);assert.equal(calls.input,0);
});

test('pre-activated evidence cannot trigger a second activation',async()=>{
 const {host,calls}=hostFor([evidence({activationAttemptsForBinding:1})]);
 const value=await coordinateNativeDialogActivationN020(host,'cancel');
 assert.equal(value.code,'evidence-invalid');assert.equal(calls.activate,0);assert.equal(calls.input,0);
});
