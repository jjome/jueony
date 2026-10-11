import puppeteer from 'puppeteer-core';
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const origin='http://127.0.0.1:4208',out=resolve('evidence/refactor-compatibility');
await mkdir(out,{recursive:true});
if(await fetch(origin+'/api/health').then(()=>true,()=>false))throw new Error('Test port 4208 already occupied');
const bundle=resolve('../../build/jueony-refactor-20261011');
const server=spawn(process.execPath,['server.mjs'],{cwd:bundle,windowsHide:true,stdio:'ignore',env:{...process.env,JUEONY_PORT:'4208',JUEONY_DIST:resolve(bundle,'dist'),JUEONY_CONNECTION_STORE:'memory'}});
const fixture=[...await readFile('fixtures/three-paragraphs.hwpx')],results=[],errors=[],external=[];
let browser,page;
const pass=name=>{results.push(name);console.log('PASS',name);};
const active=async()=>await (await page.$('.editor-frame:not([hidden])')).contentFrame();
const ready=()=>page.waitForFunction(()=>document.getElementById('app-status')?.textContent.includes('준비 완료'),{timeout:90000});
try{
 for(let i=0;i<100;i++){if(await fetch(origin+'/api/health').then(r=>r.ok,()=>false))break;await new Promise(r=>setTimeout(r,100));}
 browser=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--no-first-run','--disable-background-networking'],defaultViewport:{width:1440,height:900}});
 page=await browser.newPage();page.on('pageerror',error=>errors.push(String(error)));page.on('dialog',dialog=>dialog.accept());
 await page.setRequestInterception(true);page.on('request',request=>{if(!request.url().startsWith(origin)&&!request.url().startsWith('data:')&&!request.url().startsWith('blob:')){external.push(request.url());void request.abort();}else void request.continue();});
 // Load an inert same-origin resource before seeding the unchanged IndexedDB v1 layout.
 await page.goto(origin+'/api/health');
 await page.evaluate(async bytes=>{
  const root=await navigator.storage.getDirectory(),folder=await root.getDirectoryHandle('legacy-folder',{create:true});
  const text=await folder.getFileHandle('근거.txt',{create:true}),stream=await text.createWritable();await stream.write('기존 자료 연결');await stream.close();
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('jueony-workspaces',1);r.onupgradeneeded=()=>{r.result.createObjectStore('state');r.result.createObjectStore('documents',{keyPath:'id'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  const state={version:1,activeWorkspaceId:'w1',workspaces:[{id:'w1',name:'기존 업무',activeChatId:'c1',documentOrder:['d2','d1']},{id:'w2',name:'다른 업무',activeChatId:'c3'}],chats:[{id:'c1',workspaceId:'w1',title:'첫 대화',messages:[{id:'m1',role:'user',text:'기존 대화 보존',runId:'r1'}]},{id:'c2',workspaceId:'w1',title:'독립 대화',messages:[{id:'m2',role:'user',text:'다른 대화 내용'}]},{id:'c3',workspaceId:'w2',title:'다른 업무 대화',messages:[{id:'m3',role:'user',text:'섞이지 않는 대화'}]}],folders:[{id:'f1',workspaceId:'w1',name:'이전 폴더',handle:folder}],runs:[{id:'r1',workspaceId:'w1',chatId:'c1',documentId:'d1',status:'generating',sources:[],createdAt:1}],models:[],split:53,agentWidth:560,retrieveSources:true,reviewBeforeApply:false,legacyExtension:{preserve:'unknown additive data'},macros:[{id:'macro1',workspaceId:'w1',name:'이전 반복 작업',createdAt:1,template:{version:1,operations:[{kind:'create_document',paragraphs:['이전 양식']}],anchors:{}}}]};
  await new Promise((resolve,reject)=>{const tx=db.transaction(['state','documents'],'readwrite');tx.objectStore('state').put(state,'current');for(const id of ['d1','d2'])tx.objectStore('documents').put({id,workspaceId:'w1',name:id+'.hwpx',bytes:new Uint8Array(bytes),dirty:true,updatedAt:1,view:{version:1,zoom:1,fitMode:'none',scrollX:0,scrollY:0}});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();
 },fixture);
 await page.evaluate(async()=>{
  const db=await new Promise(resolve=>{const r=indexedDB.open('jueony-workspaces',1);r.onsuccess=()=>resolve(r.result);});
  await new Promise((resolve,reject)=>{const tx=db.transaction('documents','readwrite');tx.objectStore('documents').put({id:'',workspaceId:'w1',name:'손상 복구본.hwpx',bytes:new Uint8Array([1]),dirty:true,updatedAt:1});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();
 });
 await page.goto(origin);await ready();
 assert.match(await page.$eval('#messages',e=>e.textContent),/기존 대화 보존/);
 assert.match(await page.$eval('#messages',e=>e.textContent),/이전 실행이 중단/);
 assert.equal(await page.$$('.chat-item').then(v=>v.length),2);
 assert.equal(await (await active()).evaluate(()=>window.jueonyEditor.snapshot().name),'d2.hwpx');
 assert.match(await page.$eval('#folder-tree',e=>e.textContent),/이전 폴더/);
 pass('v1 workspace/chat/native folder handle/recovery/tab order restored despite malformed draft; interrupted run not replayed');
 await page.click('#macro-manager');assert.match(await page.$eval('#macro-list',e=>e.textContent),/이전 반복 작업/);await page.click('#close-macros');
 await page.select('#workspace-select','w2');await page.waitForFunction(()=>document.querySelector('.chat-item')?.textContent==='다른 업무 대화');
 await page.waitForFunction(()=>!document.getElementById('folder-tree').textContent.includes('이전 폴더'));
 assert.doesNotMatch(await page.$eval('#messages',e=>e.textContent),/기존 대화 보존/);assert.doesNotMatch(await page.$eval('#folder-tree',e=>e.textContent),/이전 폴더/);
 await page.waitForFunction(()=>{const f=document.querySelector('.editor-frame:not([hidden])');return f?.contentWindow?.jueonyEditor?.state().pageCount>0;});
 await page.select('#workspace-select','w1');await page.waitForFunction(()=>document.getElementById('chat-title').textContent==='첫 대화');
 await page.waitForFunction(()=>document.getElementById('folder-tree').textContent.includes('이전 폴더'));
 pass('workspace switch isolates chat/folders; legacy macro remains available');
 await new Promise(r=>setTimeout(r,2000));
 const persisted=await page.evaluate(async()=>{const db=await new Promise(resolve=>{const r=indexedDB.open('jueony-workspaces',1);r.onsuccess=()=>resolve(r.result);});const value=await new Promise(resolve=>{const r=db.transaction('state','readonly').objectStore('state').get('current');r.onsuccess=()=>resolve(r.result);});db.close();return {version:value.version,extension:value.legacyExtension,folderKind:value.folders[0].handle.kind,run:value.runs[0].status};});
 assert.deepEqual(persisted,{version:1,extension:{preserve:'unknown additive data'},folderKind:'directory',run:'interrupted'});
 await page.reload();await ready();pass('v1 resave/reload retains unknown fields and structured-cloned folder handles');
 const save=await (await active()).evaluate(async bytes=>{
  const root=await navigator.storage.getDirectory(),handle=await root.getFileHandle('refactor-save.hwpx',{create:true});let stream=await handle.createWritable();await stream.write(new Uint8Array(bytes));await stream.close();
  const api=window.jueonyEditor;await api.open(new Uint8Array(bytes),'refactor-save.hwpx',handle,false);
  const before=api.snapshot(),proposal={message:'검증',sourceIds:[],operations:[{kind:'replace_body_text',target:before.nodes[0].id,start:0,count:[...before.nodes[0].text].length,text:'리팩터링 저장 검증'}]};
  const receipt=await api.apply('refactor-save-run',before,proposal);const saved=await api.save();
  const file=await handle.getFile(),savedBytes=new Uint8Array(await file.arrayBuffer());const text=await api.readReference(savedBytes);
  await api.undoRequest(receipt);return {saved,text,restored:api.snapshot().nodes[0].text===before.nodes[0].text,bytes:[...savedBytes]};
 },fixture);
 assert.equal(save.saved,'saved');assert.match(save.text,/리팩터링 저장 검증/);assert.equal(save.restored,true);
 await writeFile(resolve(out,'saved-after-refactor.hwpx'),new Uint8Array(save.bytes));pass('offline native file-handle write, reopened saved content and request undo succeed');
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 await page.screenshot({path:resolve(out,'compatibility.png')});
 await writeFile(resolve(out,'result.json'),JSON.stringify({results,errors,externalRequests:external,persisted,build:await page.evaluate(()=>fetch('/build-evidence.json').then(r=>r.json())),note:'Synthetic v1 storage and local OPFS file; no user profile or paid model calls'},null,2));
}catch(error){console.error(error);process.exitCode=1;await page?.screenshot({path:resolve(out,'failure.png')}).catch(()=>{});await writeFile(resolve(out,'failure.json'),JSON.stringify({error:String(error),results,errors,external},null,2));}
finally{await browser?.close();server.kill();}
