import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createNativeFilePickers,readNativeHost,installNativeFilePickers,createNativeExitCoordinator,installNativeExitProtection} from '../src/adapters/desktop/native-host.ts';
import type {NativeInvoke,NativeHost,NativeExitSnapshot} from '../src/adapters/desktop/native-host.ts';
import {captureFileConnection} from '../src/adapters/files/file-connection.ts';
import {rememberFileSnapshot} from '../src/adapters/files/fingerprints.ts';

const fakeHost=(invoke:NativeInvoke):NativeHost=>({core:{invoke},window:{getCurrentWindow:()=>({onCloseRequested:async()=>()=>{},destroy:async()=>{}})}});
test('HWT copy has a separate IPC grant, shares the picker latch, and requires same-format target',async()=>{
 const calls:string[]=[];let complete!:(value:any)=>void;
 const p=createNativeFilePickers(async(command)=>{calls.push(command);if(command==='pick_save_hwt_copy')return await new Promise(r=>{complete=r;});if(command==='read_hwt_copy')return[]as any;throw Error('Unexpected '+command);});
 const pending=p.hwtCopy('사본.hwt');await assert.rejects(p.showOpenFilePicker(),{name:'InvalidStateError'});
 complete({token:'hwt-copy',name:'사본.hwt'});const h=await pending;assert.equal(h.name,'사본.hwt');assert.deepEqual(calls,['pick_save_hwt_copy']);
 assert.equal((await h.getFile()).size,0);assert.deepEqual(calls,['pick_save_hwt_copy','read_hwt_copy']);
 await assert.rejects(p.hwtCopy('wrong.hwpx'),/HWT/);assert.equal(calls.length,2);
 const cancel=createNativeFilePickers(async()=>null as any);await assert.rejects(cancel.hwtCopy('copy.hwt'),{name:'AbortError'});
 const wrong=createNativeFilePickers(async()=>({token:'bad',name:'wrong.hwp'})as any);await assert.rejects(wrong.hwtCopy('copy.hwt'),/HWT/);
});
test('native parent picker keeps an opaque original handle through exact read/write and save-as',async()=>{
 const disk=new Map([['original',new Uint8Array([1,2,3])],['new',new Uint8Array()]]),calls:{command:string;args:unknown}[]=[];
 const invoke:NativeInvoke=async(command,args)=>{calls.push({command,args});if(command==='pick_document')return {token:'original',name:'원본.hwp'} as any;if(command==='pick_save_document')return {token:'new',name:'새.hwpx'} as any;if(command==='same_document')return false as any;if(command==='read_document')return Array.from(disk.get(args!.token as string)!) as any;if(command==='write_document'){disk.set(args!.token as string,new Uint8Array(args!.bytes as number[]));return undefined as any;}throw new Error('unregistered');};
 const pickers=createNativeFilePickers(invoke),[handle]=await pickers.showOpenFilePicker();
 assert.equal(await handle.queryPermission({mode:'readwrite'}),'granted');
 assert.deepEqual(new Uint8Array(await (await handle.getFile()).arrayBuffer()),new Uint8Array([1,2,3]));
 assert.equal((await pickers.showOpenFilePicker())[0],handle);
 const writer=await handle.createWritable();await writer.write(new Blob([new Uint8Array([4,5])]));assert.deepEqual(disk.get('original'),new Uint8Array([1,2,3]));await writer.close();assert.deepEqual(disk.get('original'),new Uint8Array([4,5]));
 const copy=await pickers.showSaveFilePicker({suggestedName:'새.hwpx'});assert.notEqual(copy,handle);assert.deepEqual(calls.find(c=>c.command==='pick_save_document')?.args,{suggestedName:'새.hwpx'});
 assert.equal(await handle.isSameEntry(copy),false);
});
test('picker cancellation, abort and rejected native write preserve original bytes and surface failure',async()=>{
 let cancelled=true,writes=0;const invoke:NativeInvoke=async(command)=>{if(command==='pick_document')return (cancelled?null:{token:'t',name:'문서.hwp'}) as any;if(command==='pick_save_document')return null as any;if(command==='write_document'){writes++;throw new Error('external file changed');}return [1] as any;};
 const pickers=createNativeFilePickers(invoke);await assert.rejects(pickers.showOpenFilePicker(),{name:'AbortError'});await assert.rejects(pickers.showSaveFilePicker(),{name:'AbortError'});
 cancelled=false;const [handle]=await pickers.showOpenFilePicker(),aborted=await handle.createWritable();await aborted.write(new Blob(['discard']));await aborted.abort();await assert.rejects(aborted.close());assert.equal(writes,0);
 const writer=await handle.createWritable();await writer.write(new Blob(['changed']));await assert.rejects(writer.close(),/external file changed/);assert.equal(writes,1);
});
test('native abort acknowledged during Blob preparation prevents the later disk commit',async()=>{
 let release!:(bytes:ArrayBuffer)=>void,writes=0;const original=new Uint8Array([7,8]);let disk=original;
 const pickers=createNativeFilePickers(async(command,args)=>{if(command==='pick_document')return{token:'t',name:'own.hwp'}as any;if(command==='write_document'){writes++;disk=new Uint8Array(args!.bytes as number[]);}return undefined as any;});
 const[handle]=await pickers.showOpenFilePicker(),writer=await handle.createWritable();
 await writer.write({arrayBuffer:()=>new Promise<ArrayBuffer>(resolve=>release=resolve)}as Blob);
 const closing=writer.close();assert.equal(typeof release,'function');await writer.abort();
 release(new Uint8Array([1,2,3]).buffer);await assert.rejects(closing,{name:'AbortError'});
 assert.equal(writes,0);assert.deepEqual(disk,original);await assert.rejects(writer.close());
});
test('native closing writer refuses another close or payload while preparing exactly one commit',async()=>{
 let release!:(bytes:ArrayBuffer)=>void;const committed:number[][]=[];
 const pickers=createNativeFilePickers(async(command,args)=>{if(command==='pick_document')return{token:'t',name:'own.hwpx'}as any;if(command==='write_document')committed.push(args!.bytes as number[]);return undefined as any;});
 const[handle]=await pickers.showOpenFilePicker(),writer=await handle.createWritable();
 await writer.write({arrayBuffer:()=>new Promise<ArrayBuffer>(resolve=>release=resolve)}as Blob);
 const closing=writer.close();await assert.rejects(writer.close(),{name:'InvalidStateError'});await assert.rejects(writer.write(new Blob(['other'])),{name:'InvalidStateError'});
 release(new Uint8Array([3,4]).buffer);await closing;assert.deepEqual(committed,[[3,4]]);
});
test('native abort cannot claim cancellation after dispatch; failed commit still allows cleanup',async()=>{
 let resolve!:(value:unknown)=>void,reject!:(reason:unknown)=>void,writes=0;
 const pickers=createNativeFilePickers(async(command)=>{if(command==='pick_document')return{token:'t',name:'own.hwp'}as any;if(command==='write_document'){writes++;return await new Promise((yes,no)=>{resolve=yes;reject=no;});}return undefined as any;});
 const[handle]=await pickers.showOpenFilePicker(),writer=await handle.createWritable();
 await writer.write(new Blob(['own']));const closing=writer.close();await new Promise(r=>setImmediate(r));assert.equal(writes,1);
 await assert.rejects(writer.abort(),{name:'InvalidStateError'});resolve(undefined);await closing;assert.equal(writes,1);
 const failed=await handle.createWritable();await failed.write(new Blob(['retry']));const failure=failed.close();await new Promise(r=>setImmediate(r));assert.equal(writes,2);reject(Error('native refusal'));await assert.rejects(failure,/native refusal/);await failed.abort();await assert.rejects(failed.close());assert.equal(writes,2);
});
test('pending native picker rejects every concurrent open/save without invoking or queueing another dialog',async()=>{
 for(const firstKind of ['open','save']){
  let resolve!:(value:any)=>void,calls=0;const pickers=createNativeFilePickers(async()=>{calls++;return await new Promise(r=>resolve=r);});
  const first=firstKind==='open'?pickers.showOpenFilePicker():pickers.showSaveFilePicker();
  await assert.rejects(pickers.showOpenFilePicker(),{name:'InvalidStateError'});await assert.rejects(pickers.showSaveFilePicker(),{name:'InvalidStateError'});assert.equal(calls,1);
  resolve(null);await assert.rejects(first,{name:'AbortError'});assert.equal(calls,1);
  const next=pickers.showOpenFilePicker();assert.equal(calls,2);resolve({token:'new',name:'문서.hwp'});assert.equal((await next)[0].name,'문서.hwp');assert.equal(calls,2);
 }
});
test('native picker rejection releases its guard for a later explicit request',async()=>{
 let fail=true,calls=0;const pickers=createNativeFilePickers(async()=>{calls++;if(fail)throw Error('native picker failed');return {token:'t',name:'문서.hwpx'} as any;});
 await assert.rejects(pickers.showOpenFilePicker(),/native picker failed/);fail=false;assert.equal((await pickers.showSaveFilePicker()).name,'문서.hwpx');assert.equal(calls,2);
});
test('shell and same-origin child install native picker without granting cross-origin authority',async()=>{
 const host=fakeHost(async()=>({token:'t',name:'문서.hwp'}) as any),parent:any={__TAURI__:host,location:{origin:'http://tauri.localhost'}};parent.parent=parent;
 const child:any={location:{origin:parent.location.origin},parent};assert.equal(readNativeHost(child),host);assert.equal(installNativeFilePickers(parent),host);assert.equal(typeof parent.showOpenFilePicker,'function');const picker=parent.showOpenFilePicker;installNativeFilePickers(parent);assert.equal(parent.showOpenFilePicker,picker);assert.equal((await parent.showOpenFilePicker())[0].name,'문서.hwp');
 assert.equal(readNativeHost({location:{origin:'https://other.example'},parent} as any),undefined);
 const opaque:any={location:{origin:'null'}};Object.defineProperty(opaque,'parent',{get(){throw new Error('denied');}});assert.equal(readNativeHost(opaque),undefined);
});
test('shell and editor realms share one native-window picker guard, even when child has its own Tauri object',async()=>{
 let resolve!:(value:any)=>void,calls=0;const host=fakeHost(async()=>{calls++;return await new Promise(r=>resolve=r);}),parent:any={__TAURI__:host,location:{origin:'http://tauri.localhost'}};parent.parent=parent;
 const child:any={location:{origin:parent.location.origin},parent,__TAURI__:fakeHost(async()=>{throw Error('child must reuse parent authority');})};
 installNativeFilePickers(parent);assert.equal(installNativeFilePickers(child),host);assert.equal(parent.showOpenFilePicker,child.showOpenFilePicker);assert.equal(parent.showSaveFilePicker,child.showSaveFilePicker);
 const first=parent.showOpenFilePicker();await assert.rejects(child.showSaveFilePicker(),{name:'InvalidStateError'});await assert.rejects(child.showOpenFilePicker(),{name:'InvalidStateError'});assert.equal(calls,1);resolve(null);await assert.rejects(first,{name:'AbortError'});
});
test('native process handles cannot be persisted as original-file authority',async()=>{
 const [handle]=await createNativeFilePickers(async(command)=>command==='read_document'?[1,2,3] as any:{token:'t',name:'문서.hwp'} as any).showOpenFilePicker();
 await rememberFileSnapshot(handle,new Uint8Array([1,2,3]));assert.equal(captureFileConnection(handle),undefined);assert.throws(()=>structuredClone(handle));
});

function exitHarness(){
 let snapshot:NativeExitSnapshot={stamp:'r1',blocked:false,needsConfirmation:true},consent=true;const calls:string[]=[],errors:unknown[]=[];
 const hooks={snapshot:()=>({...snapshot}),confirm:async()=>{calls.push('confirm');return consent;},checkpoint:async()=>{calls.push('checkpoint');},freeze:()=>{calls.push('freeze');return()=>calls.push('resume');},close:async()=>{calls.push('close');},error:(error:unknown)=>errors.push(error)};
 return {hooks,calls,errors,event:{preventDefault:()=>calls.push('prevent')},setState:(value:Partial<NativeExitSnapshot>)=>Object.assign(snapshot,value),setConsent:(value:boolean)=>consent=value};
}
test('every native close event is vetoed; only verified unchanged state approves explicit destroy',async()=>{
 const h=exitHarness(),coordinator=createNativeExitCoordinator(h.hooks);const result=coordinator.request(h.event);assert.deepEqual(h.calls,['prevent','freeze','confirm']);await result;assert.deepEqual(h.calls,['prevent','freeze','confirm','checkpoint','close']);assert.equal(coordinator.isApproved(),true);await coordinator.request(h.event);assert.equal(h.calls.filter(x=>x==='prevent').length,2);assert.equal(h.calls.filter(x=>x==='close').length,1);assert.deepEqual(h.errors,[]);
});
test('native exit cancellation never writes recovery or invokes close, and restores editing',async()=>{
 const h=exitHarness();h.setConsent(false);const coordinator=createNativeExitCoordinator(h.hooks);await coordinator.request(h.event);assert.deepEqual(h.calls,['prevent','freeze','confirm','resume']);assert.equal(coordinator.isApproved(),false);
});
test('busy native window refuses close without prompting or writing checkpoint',async()=>{
 const h=exitHarness();h.setState({blocked:true});const coordinator=createNativeExitCoordinator(h.hooks);await coordinator.request(h.event);assert.deepEqual(h.calls,['prevent']);assert.equal(h.errors.length,1);assert.equal(coordinator.isApproved(),false);
});
test('checkpoint failure and protected export failure keep native window open and dirty state intact',async()=>{
 for(const message of ['IDB abort','PASSWORD_RECOVERY_BLOCKED','unsupported layout']){const h=exitHarness();h.hooks.checkpoint=async()=>{h.calls.push('checkpoint');throw new Error(message);};const coordinator=createNativeExitCoordinator(h.hooks);await coordinator.request(h.event);assert.deepEqual(h.calls,['prevent','freeze','confirm','checkpoint','resume']);assert.equal(coordinator.isApproved(),false);assert.match(String(h.errors[0]),new RegExp(message));}
});
test('revision change during async checkpoint or new busy state cannot close with stale approval',async()=>{
 for(const update of [{stamp:'r2'},{blocked:true}]){const h=exitHarness();h.hooks.checkpoint=async()=>{h.calls.push('checkpoint');h.setState(update);};const coordinator=createNativeExitCoordinator(h.hooks);await coordinator.request(h.event);assert.equal(h.calls.includes('close'),false);assert.equal(h.calls.at(-1),'resume');assert.equal(coordinator.isApproved(),false);assert.equal(h.errors.length,1);}
});
test('repeated close events while user consent is pending do not duplicate prompts or commits',async()=>{
 const h=exitHarness();let resolve!:(value:boolean)=>void;h.hooks.confirm=()=>{h.calls.push('confirm');return new Promise(r=>resolve=r);};const coordinator=createNativeExitCoordinator(h.hooks);const first=coordinator.request(h.event);await coordinator.request(h.event);assert.equal(h.calls.filter(x=>x==='confirm').length,1);assert.equal(h.calls.filter(x=>x==='prevent').length,2);resolve(true);await first;assert.equal(h.calls.filter(x=>x==='checkpoint').length,1);assert.equal(h.calls.filter(x=>x==='close').length,1);
});
test('close invocation rejection revokes approval, restores controls, and allows a safe retry',async()=>{
 const h=exitHarness();let fail=true;h.hooks.close=async()=>{h.calls.push('close');if(fail)throw new Error('IPC denied');};const coordinator=createNativeExitCoordinator(h.hooks);await coordinator.request(h.event);assert.equal(coordinator.isApproved(),false);assert.equal(h.calls.at(-1),'resume');fail=false;await coordinator.request(h.event);assert.equal(coordinator.isApproved(),true);assert.equal(h.calls.filter(x=>x==='confirm').length,2);
});
test('clean native close still awaits checkpoint and never prompts unnecessarily',async()=>{
 const h=exitHarness();h.setState({needsConfirmation:false});const coordinator=createNativeExitCoordinator(h.hooks);await coordinator.request(h.event);assert.deepEqual(h.calls,['prevent','freeze','checkpoint','close']);assert.equal(coordinator.isApproved(),true);h.setState({stamp:'other'});assert.equal(coordinator.isApproved(),false);
});
test('native event installation wires the actual window facade and exposes registration failure',async()=>{
 const h=exitHarness();let listener:((event:any)=>any)|undefined,closed=0;const host=fakeHost(async()=>undefined as any);host.window.getCurrentWindow=()=>({onCloseRequested:async fn=>{listener=fn;return()=>{};},destroy:async()=>{closed++;}});const guard=installNativeExitProtection(host,h.hooks);await guard.ready;assert.equal(typeof listener,'function');await listener!(h.event);assert.equal(closed,1);assert.equal(guard.isApproved(),true);
 host.window.getCurrentWindow=()=>({onCloseRequested:async()=>{throw new Error('event permission');},destroy:async()=>{}});await assert.rejects(installNativeExitProtection(host,h.hooks).ready,/event permission/);
});

test('native close capability includes main-window destroy used after verified recovery commit',()=>{const capability=JSON.parse(readFileSync(new URL('../src-tauri/capabilities/main.json',import.meta.url),'utf8'));assert.deepEqual(capability.windows,['main']);assert.ok(capability.permissions.includes('core:window:allow-destroy'));assert.equal(capability.remote,undefined);});
