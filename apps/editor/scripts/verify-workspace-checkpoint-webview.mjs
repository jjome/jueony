import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtemp,readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {loadReviewEngine} from './lib/hancom-review.mjs';

const repo=resolve(import.meta.dirname,'../../..');
const required=(name)=>{
 const value=process.env[name];assert.ok(value,`${name} is required`);return resolve(repo,value);
};
const dist=required('JUEONY_TEST_DIST');
const launcher=required('JUEONY_TEST_SERVER');
const host=required('JUEONY_TEST_WEBVIEW_HOST');
const runtime=required('JUEONY_TEST_WEBVIEW_RUNTIME');
const output=required('JUEONY_TEST_OUTPUT');
const port=Number(process.env.JUEONY_TEST_PORT??5055);
const origin=`http://127.0.0.1:${port}`;
assert.equal(await fetch(origin+'/api/health').then(()=>true,()=>false),false,'test port already occupied');
await mkdir(output,{recursive:true});
const profile=await mkdtemp(resolve(output,'profile-'));
const {HwpDocument,metadata}=await loadReviewEngine(required('JUEONY_ENGINE_PACKAGE'));
const build=JSON.parse(await readFile(resolve(dist,'build-evidence.json'),'utf8'));
assert.equal(build.engineWasmSha256,metadata.wasmSha256);
const document=HwpDocument.createEmpty();
let fixture;
try{
 document.createBlankDocument();
 document.insertText(0,0,0,'Windows 복구 검수 원본');
 fixture=Buffer.from(document.exportHwpx());
}finally{document.free();}
const server=spawn(process.execPath,[launcher],{cwd:repo,windowsHide:true,stdio:'ignore',env:{
 ...process.env,JUEONY_PORT:String(port),JUEONY_DIST:dist,JUEONY_CONNECTION_STORE:'memory',JUEONY_REFERENCE_INDEX:':memory:',
}});
const init=resolve(profile,'initialize.js');
await writeFile(init,`if (window===window.top && !localStorage.getItem('rhwp-settings')) localStorage.setItem('rhwp-settings', JSON.stringify({version:1,autosave:{recoveryEnabled:false,idleSaveEnabled:true,idleDelaySeconds:5}}));`);

async function browserProbe(phase,data){
 const name='windows-checkpoint-review.hwpx';
 const fail=(message)=>{throw Error(message);};
 const wait=async(fn)=>{
  for(let attempt=0;attempt<240;attempt++){
   const value=await fn();if(value)return value;
   await new Promise(done=>setTimeout(done,100));
  }
  return fail(`Timed out waiting for the ${phase} check.`);
 };
 const hex=async(bytes)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
 const readCheckpoint=async()=>{
  const db=await new Promise((resolve,reject)=>{
   const request=indexedDB.open('jueony-workspaces',1);
   request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  });
  try{return await new Promise((resolve,reject)=>{
   const request=db.transaction('documents').objectStore('documents').getAll();
   request.onsuccess=()=>resolve(request.result.find(record=>record.name===name));request.onerror=()=>reject(request.error);
  });}finally{db.close();}
 };
 await wait(()=>document.getElementById('app-status')?.textContent.includes('준비 완료'));
 const frame=document.querySelector('.editor-frame:not([hidden])').contentWindow;
 const api=frame.jueonyEditor,root=await navigator.storage.getDirectory();
 const commits=[];
 if(phase==='write'){
  const transaction=IDBDatabase.prototype.transaction;
  IDBDatabase.prototype.transaction=function(names,mode,options){
   const tx=transaction.call(this,names,mode,options);
   if(this.name==='jueony-workspaces'&&mode==='readwrite'&&tx.objectStoreNames.contains('documents')){
    tx.addEventListener('complete',()=>commits.push(tx.durability));
   }
   return tx;
  };
  const handle=await root.getFileHandle(name,{create:true});
  const bytes=frame.Uint8Array.from(atob(data.bytes),letter=>letter.charCodeAt(0));
  const target=await handle.createWritable();await target.write(bytes);await target.close();
  await api.open(bytes,name,handle,false);
  const automation=frame.rhwpStudio.automation;
  const command='ext:webview-recovery-probe';
  automation.registerCommand({id:command,label:'복구 검수',canExecute:()=>true,execute:services=>{
   const input=services.getInputHandler(),position=input.getCursorPosition();
   input.executeOperation({kind:'snapshot',operationType:'webview-recovery-probe',operation:wasm=>{
    wasm.insertText(0,0,0,'미저장 변경 · ');return position;
   }});
  }});
  automation.execute(command);automation.unregisterCommand(command);
 }else{
  if(localStorage.getItem('workspace-checkpoint-orderly-exit'))fail('The test process ran orderly shutdown handlers.');
  if(api.state().name!==name||!api.state().dirty)fail('The window did not restore the dirty document.');
 }
 const stored=await wait(async()=>{const record=await readCheckpoint();return record?.dirty&&record.checkpointToken&&record;});
 if(!api.snapshot().nodes[0]?.text.startsWith('미저장 변경 · '))fail('Recovered document did not contain the edit.');
 const checkpointSha256=await hex(stored.bytes);
 const source=await (await root.getFileHandle(name)).getFile();
 const sourceSha256=await hex(await source.arrayBuffer());
 if(sourceSha256!==data.sourceSha256)fail('Original OPFS document changed.');
 if(phase==='write'){
  if(!commits.includes('strict'))fail('No strictly durable application checkpoint completed.');
  localStorage.removeItem('workspace-checkpoint-orderly-exit');
  const mark=()=>localStorage.setItem('workspace-checkpoint-orderly-exit','yes');
  window.addEventListener('beforeunload',mark);window.addEventListener('pagehide',mark);
 }else if(checkpointSha256!==data.checkpointSha256||stored.checkpointToken!==data.checkpointToken){
  fail('The restored checkpoint differs from the one committed before process exit.');
 }
 return {phase,dirty:true,sourceSha256,checkpointSha256,checkpointToken:stored.checkpointToken,strictCommit:commits.includes('strict')};
}

async function runPhase(phase,data){
 const script=resolve(profile,`${phase}.js`),resultPath=resolve(profile,`${phase}.json`);
 await writeFile(script,`(${browserProbe.toString()})(${JSON.stringify(phase)},${JSON.stringify(data)}).then(result=>chrome.webview.postMessage(JSON.stringify(result)),error=>chrome.webview.postMessage(JSON.stringify({error:String(error)})))`);
 const child=spawn(host,[runtime,profile,origin,init,script,resultPath,phase==='write'?'hold':'close'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
 let stderr='';child.stderr.on('data',chunk=>{stderr+=chunk.toString('utf8');});
 const closed=new Promise((done,reject)=>{child.once('exit',(code,signal)=>done({code,signal}));child.once('error',reject);});
 try{
  for(let attempt=0;attempt<500;attempt++){
   const raw=await readFile(resultPath,'utf8').catch(error=>{if(error.code!=='ENOENT')throw error;});
   if(raw){
    const record=JSON.parse(raw);assert.equal(record.probe.error,undefined);assert.equal(record.externalRequests,0);
    if(phase==='write')await writeFile(resultPath+'.terminate','terminate isolated browser');
    const processExit=await closed;
    assert.equal(processExit.code,0,stderr);
    const browserTermination=phase==='write'?JSON.parse(await readFile(resultPath+'.terminated','utf8')):null;
    if(browserTermination)assert.equal(browserTermination.exited,true);
    return {...record,processExit,browserTermination};
   }
   if(child.exitCode!==null)throw Error(`WebView host exited ${child.exitCode}: ${stderr}`);
   await delay(100);
  }
  throw Error(`The ${phase} phase did not finish: ${stderr}`);
 }finally{if(child.exitCode===null&&!child.killed)child.kill();await closed.catch(()=>{});}
}

try{
 let healthy=false;
 for(let attempt=0;attempt<100&&!healthy;attempt++){
  healthy=await fetch(origin+'/api/health').then(response=>response.ok,()=>false);
  if(!healthy)await delay(100);
 }
 assert(healthy,'packaged launcher did not start');
 const sourceSha256=createHash('sha256').update(fixture).digest('hex');
 const committed=await runPhase('write',{bytes:fixture.toString('base64'),sourceSha256});
 assert.equal(committed.probe.strictCommit,true);
 await delay(750);
 const reopened=await runPhase('reopen',{...committed.probe,sourceSha256});
 assert.equal(reopened.webView2,committed.webView2);
 const result={build:build.customSourceSha256,webView2:reopened.webView2,committed,reopened,originalUnchanged:true,forcedProcessExit:true};
 await writeFile(resolve(output,'result.json'),JSON.stringify(result,null,2)+'\n');
 console.log('PASS strictly durable checkpoint and byte-verified recovery after Windows WebView browser termination');
}finally{server.kill();}
