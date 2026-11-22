import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import http from 'node:http';
import {resolve} from 'node:path';
import puppeteer from 'puppeteer-core';

const bundle=resolve(process.env.JUEONY_TEST_BUNDLE);
const out=resolve(process.env.JUEONY_TEST_OUTPUT);
const port=Number(process.env.JUEONY_TEST_PORT??5216);
const origin=`http://127.0.0.1:${port}`;
const browserPath=process.env.JUEONY_TEST_BROWSER??'C:/Program Files/Google/Chrome/Application/chrome.exe';
const build=JSON.parse(await readFile(resolve(bundle,'dist/build-evidence.json'),'utf8'));
if(await fetch(origin+'/api/health').then(()=>true,()=>false))throw Error('Test port is already in use');
await mkdir(out,{recursive:true});
const calls=[];
const provider=http.createServer(async(req,res)=>{
  try{
    let body='';for await(const part of req)body+=part;
    const input=JSON.parse(JSON.parse(body).messages[1].content);
    calls.push(input);
    const result={message:`응답 ${input.instruction}`,sourceIds:[],operations:[]};
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(result)}}]}));
  }catch{res.writeHead(400).end();}
});
await new Promise((done,fail)=>{provider.once('error',fail);provider.listen(0,'127.0.0.1',done);});
const server=spawn(process.execPath,['server.mjs'],{
  cwd:bundle,windowsHide:true,stdio:'ignore',env:{...process.env,JUEONY_PORT:String(port),JUEONY_CONNECTION_STORE:'memory'},
});
const errors=[],externalRequests=[],verified=[];
let browser,page;
const pass=label=>{verified.push(label);console.log('PASS',label);};
const pause=()=>new Promise(done=>setTimeout(done,100));
async function until(predicate,label){
  for(let attempt=0;attempt<300;attempt++){
    if(await predicate())return;
    await pause();
  }
  throw Error(label);
}
function expectPrompt(text){page.once('dialog',dialog=>{assert.equal(dialog.type(),'prompt');void dialog.accept(text);});}
async function loadEditor(previous){
  await previous?.close();
  page=await browser.newPage();
  page.on('pageerror',error=>errors.push(String(error)));
  await page.setRequestInterception(true);
  page.on('request',request=>{
    const url=new URL(request.url());
    if(['https:','http:'].includes(url.protocol)&&url.origin!==origin){externalRequests.push(url.origin);void request.abort();}
    else void request.continue();
  });
  await page.goto(origin);
  await page.waitForFunction(()=>document.getElementById('app-status')?.textContent.includes('준비 완료'));
}
async function persisted(){
  return page.evaluate(async()=>{
    const db=await new Promise((done,fail)=>{
      const request=indexedDB.open('jueony-workspaces',1);
      request.onsuccess=()=>done(request.result);request.onerror=()=>fail(request.error);
    });
    try{
      return await new Promise((done,fail)=>{
        const request=db.transaction('state').objectStore('state').get('current');
        request.onsuccess=()=>done(request.result);request.onerror=()=>fail(request.error);
      });
    }finally{db.close();}
  });
}
const selectedWorkspace=()=>page.$eval('#workspace-select',select=>select.value);
const workspaceLabel=()=>page.$eval('#workspace-select',select=>select.selectedOptions[0]?.textContent);
const visibleChat=()=>page.$eval('#chat-title',node=>node.textContent);
const visibleMessages=()=>page.$eval('#messages',node=>node.textContent);
const referenceRoots=()=>page.$$eval('.folder-root > .folder-row > button:first-of-type',buttons=>buttons.map(button=>button.textContent));
const activeFrame=async()=>{
  await page.waitForFunction(()=>{
    try{return Boolean(document.querySelector('.editor-frame:not([hidden])')?.contentWindow.jueonyEditor.snapshot());}
    catch{return false;}
  });
  return (await page.$('.editor-frame:not([hidden])')).contentFrame();
};
async function activeDocument(){
  return (await activeFrame()).evaluate(()=>{
    const api=window.jueonyEditor;
    return {instance:api.documentInstance(),dirty:api.state().dirty,text:api.snapshot().nodes.map(node=>node.text).join('\n')};
  });
}
async function chooseWorkspace(id){
  await page.waitForSelector('#workspace-select:not([disabled])');
  await page.select('#workspace-select',id);
  await until(async()=>(await persisted()).activeWorkspaceId===id,'Workspace choice was not persisted');
  await page.waitForSelector('#workspace-select:not([disabled])');
  await page.waitForFunction(()=>{
    const api=document.querySelector('.editor-frame:not([hidden])')?.contentWindow.jueonyEditor;
    return api?.state().pageCount>0;
  });
}
async function send(text){
  await page.type('#request-input',text);
  await page.click('#send-request');
  await page.waitForFunction(text=>!document.getElementById('send-request').disabled&&
    document.getElementById('messages').textContent.includes(`응답 ${text}`),{},text);
}

try{
  await until(()=>fetch(origin+'/api/health').then(response=>response.ok,()=>false),'Local launcher did not start');
  browser=await puppeteer.launch({executablePath:browserPath,headless:true,args:['--disable-background-networking','--no-first-run'],
    defaultViewport:{width:1440,height:900}});
  await loadEditor();
  const first=await selectedWorkspace();
  const frame=await activeFrame();
  await frame.evaluate(async()=>{
    const api=window.jueonyEditor,state=api.snapshot();
    await api.apply('workspace-fixture',state,{message:'업무 격리 확인',sourceIds:[],operations:[{
      kind:'replace_body_text',target:state.nodes[0].id,start:0,count:0,text:'첫 업무의 미저장 본문',
    }]});
  });
  const outgoing=await activeDocument();
  assert.equal(outgoing.dirty,true);
  await page.evaluate(()=>{
    const put=IDBObjectStore.prototype.put;
    window.workspaceCheckpointAborts=0;
    IDBObjectStore.prototype.put=function(...args){
      const request=put.apply(this,args);
      if(this.name==='documents'){
        IDBObjectStore.prototype.put=put;
        window.workspaceCheckpointAborts++;
        this.transaction.abort();
      }
      return request;
    };
  });
  expectPrompt('저장 실패로 생성하면 안 되는 업무');
  await page.click('#add-workspace');
  await page.waitForFunction(()=>window.workspaceCheckpointAborts===1&&/저장에 실패|복구본/.test(document.getElementById('app-status').textContent));
  assert.equal(await selectedWorkspace(),first);
  assert.deepEqual(await activeDocument(),outgoing);
  const afterAbort=await persisted();
  assert.equal(afterAbort.activeWorkspaceId,first);
  assert.equal(afterAbort.workspaces.length,1);
  await page.focus('#sidebar-split');
  await page.keyboard.press('ArrowDown');
  await until(async()=> (await persisted()).split!==afterAbort.split,'Follow-up settings write did not finish');
  const afterSettingsWrite=await persisted();
  assert.equal(afterSettingsWrite.activeWorkspaceId,first);
  assert.equal(afterSettingsWrite.workspaces.length,1);
  pass('failed document checkpoint preserves the old workspace and dirty document during a later settings write');

  expectPrompt('첫 업무 이름 변경');
  await page.click('#rename-workspace');
  await until(async()=> (await persisted()).workspaces[0].name==='첫 업무 이름 변경','Workspace rename did not persist');
  assert.equal(await workspaceLabel(),'첫 업무 이름 변경');
  assert.match(await page.title(),/^첫 업무 이름 변경/u);
  await page.click('#connection-settings');
  await page.click('#new-connection');
  await page.select('#config-adapter','openai-compatible');
  await page.type('#config-label','검증 모델');
  await page.$eval('#config-endpoint',(field,value)=>{field.value=value;field.dispatchEvent(new Event('input',{bubbles:true}));},
    `http://127.0.0.1:${provider.address().port}/v1`);
  await page.$eval('#config-model',field=>{field.value='fixture-workspace';field.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.$eval('#config-remember',field=>{field.checked=false;});
  await page.type('#config-key','fixture-only');
  await page.click('#model-form button[type=submit]');
  await page.waitForFunction(()=>!document.getElementById('model-dialog').open);
  await send('첫 채팅 내용');
  await page.click('#add-chat');
  assert.doesNotMatch(await visibleMessages(),/첫 채팅 내용/u);
  await page.click('.chat-item:first-child');
  const chat2=await page.$('.chat-item:nth-child(2)');
  expectPrompt('둘째 채팅 이름 변경');
  await chat2.click({count:2});
  await page.waitForFunction(()=>document.getElementById('chat-title').textContent==='둘째 채팅 이름 변경');
  await send('둘째 채팅 내용');
  assert.doesNotMatch(await visibleMessages(),/첫 채팅 내용/u);
  await page.click('.chat-item:first-child');
  assert.equal(await visibleChat(),'첫 채팅');
  assert.match(await visibleMessages(),/응답 첫 채팅 내용/u);
  assert.doesNotMatch(await visibleMessages(),/둘째 채팅 내용/u);
  const initialState=await persisted();
  const firstChats=initialState.chats.filter(chat=>chat.workspaceId===first);
  assert.equal(firstChats.length,2);
  assert.equal(initialState.runs.filter(run=>run.workspaceId===first&&run.status==='completed').length,2);
  assert.equal(new Set(initialState.runs.map(run=>run.chatId)).size,2);
  pass('created and renamed a second chat, with distinct messages and completed run histories');

  await page.evaluate(async()=>{
    const root=await navigator.storage.getDirectory();
    const first=await root.getDirectoryHandle('검수 폴더 A',{create:true});
    const sub=await first.getDirectoryHandle('하위 폴더',{create:true});
    const second=await root.getDirectoryHandle('검수 폴더 B',{create:true});
    for(const [directory,name,content] of [[sub,'근거.txt','하위 원본 유지'],[second,'별도.txt','별도 원본 유지']]){
      const file=await directory.getFileHandle(name,{create:true});
      const writer=await file.createWritable();await writer.write(content);await writer.close();
    }
    const choices=[first,second,first];
    window.showDirectoryPicker=async options=>{
      if(options.mode!=='read')throw Error('Expected a read-only folder picker');
      return choices.shift();
    };
  });
  await page.click('#add-folder');
  await until(async()=> (await referenceRoots()).length===1,'First folder did not appear');
  await page.click('#add-folder');
  await until(async()=> (await referenceRoots()).length===2,'Second folder did not appear');
  await page.click('#add-folder');
  await page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('이미 연결'));
  assert.deepEqual(await referenceRoots(),['▸ 검수 폴더 A','▸ 검수 폴더 B']);
  await page.click('.folder-root:first-child > .folder-row > button:first-of-type');
  await page.waitForSelector('button.file-label[title="검수 폴더 A/하위 폴더"]');
  await page.click('button.file-label[title="검수 폴더 A/하위 폴더"]');
  await page.waitForSelector('button.file-label[title="검수 폴더 A/하위 폴더/근거.txt"]');
  pass('linked two read-only local directory handles, expanded a nested folder and rejected a duplicate');

  await page.evaluate(workspaceId=>{
    window.workspaceFolderDisplayLeaks=[];
    const chooser=document.getElementById('workspace-select');
    const tree=document.getElementById('folder-tree');
    const observer=new MutationObserver(()=>{
      if(chooser.value!==workspaceId&&tree.querySelector('.folder-root'))window.workspaceFolderDisplayLeaks.push(chooser.value);
    });
    observer.observe(chooser,{childList:true,subtree:true,attributes:true});
    observer.observe(tree,{childList:true,subtree:true});
  },first);
  expectPrompt('둘째 업무');
  await page.click('#add-workspace');
  await until(async()=> (await persisted()).activeWorkspaceId!==first,'Second workspace creation did not persist');
  const second=await selectedWorkspace();
  assert.equal(await workspaceLabel(),'둘째 업무');
  assert.equal(await visibleChat(),'첫 채팅');
  assert.doesNotMatch(await visibleMessages(),/채팅 내용/u);
  assert.deepEqual(await referenceRoots(),[]);
  assert.deepEqual(await page.evaluate(()=>window.workspaceFolderDisplayLeaks),[]);
  assert.deepEqual(await page.$$eval('.editor-frame:not([hidden])',frames=>frames.length),1);
  assert.equal((await activeDocument()).text,'');
  await chooseWorkspace(first);
  assert.deepEqual(await activeDocument(),outgoing);
  assert.match(await visibleMessages(),/응답 첫 채팅 내용/u);
  await until(async()=> (await referenceRoots()).length===2,'Workspace folders did not reappear');
  assert.deepEqual(await referenceRoots(),['▸ 검수 폴더 A','▸ 검수 폴더 B']);
  pass('created and switched workspaces while preserving the original document, chats and folders');

  await page.click('.folder-root:first-child > .folder-row > button:last-of-type');
  await until(async()=> (await persisted()).folders.length===1,'Folder removal did not persist');
  await until(async()=> (await referenceRoots()).length===1,'The disconnected folder remained visible');
  assert.deepEqual(await referenceRoots(),['▸ 검수 폴더 B']);
  const folderContents=async()=>page.evaluate(async()=>{
    const root=await navigator.storage.getDirectory();
    const first=await root.getDirectoryHandle('검수 폴더 A');
    const sub=await first.getDirectoryHandle('하위 폴더');
    const second=await root.getDirectoryHandle('검수 폴더 B');
    return Promise.all([[sub,'근거.txt'],[second,'별도.txt']].map(async([directory,name])=>(await (await directory.getFileHandle(name)).getFile()).text()));
  });
  assert.deepEqual(await folderContents(),['하위 원본 유지','별도 원본 유지']);
  pass('disconnecting the directory only removed its link and preserved the source bytes');

  const split=()=>page.$eval('#sidebar-split',handle=>Number(handle.getAttribute('aria-valuenow')));
  const before=await split();
  await page.focus('#sidebar-split');
  await page.keyboard.press('ArrowDown');
  assert.equal(await split(),before+3);
  const sidebar=await (await page.$('#sidebar')).boundingBox();
  const handle=await (await page.$('#sidebar-split')).boundingBox();
  await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);
  await page.mouse.down();
  await page.mouse.move(handle.x+handle.width/2,sidebar.y+sidebar.height*.60,{steps:5});
  await page.mouse.up();
  const resized=await split();
  assert.equal(resized,60);
  await until(async()=> (await persisted()).split===resized,'Resized sidebar was not saved');
  await loadEditor(page);
  assert.equal(await split(),resized);
  assert.equal(await selectedWorkspace(),first);
  assert.equal(await workspaceLabel(),'첫 업무 이름 변경');
  assert.equal((await activeDocument()).text,outgoing.text);
  assert.equal((await activeDocument()).dirty,true);
  assert.deepEqual(await referenceRoots(),['▸ 검수 폴더 B']);
  assert.deepEqual(await folderContents(),['하위 원본 유지','별도 원본 유지']);
  assert.match(await visibleMessages(),/응답 첫 채팅 내용/u);
  const secondChat=await page.waitForSelector('.chat-item:nth-child(2)');
  await secondChat.click();
  assert.equal(await visibleChat(),'둘째 채팅 이름 변경');
  assert.match(await visibleMessages(),/응답 둘째 채팅 내용/u);
  assert.doesNotMatch(await visibleMessages(),/첫 채팅 내용/u);
  await chooseWorkspace(second);
  assert.equal(await workspaceLabel(),'둘째 업무');
  assert.deepEqual(await referenceRoots(),[]);
  pass('pointer and keyboard resize persist; reload restores names, isolated chat content, dirty document and only the retained folder link');
  assert.deepEqual(errors,[]);
  assert.deepEqual(externalRequests,[]);
  await writeFile(resolve(out,'result.json'),JSON.stringify({
    build:{customSourceSha256:build.customSourceSha256,engineWasmSha256:build.engineWasmSha256},
    verified,folderAccess:'Chromium OPFS directory handles through a simulated picker',
    provider:'local deterministic fixture',localModelRequests:calls.length,errors,externalRequests,
  },null,2));
}catch(problem){
  const ui=await page?.evaluate(()=>Object.fromEntries(['app-status','request-error','config-status','chat-title'].map(id=>[id,
    document.getElementById(id)?.textContent]))).catch(()=>null);
  await writeFile(resolve(out,'failure.json'),JSON.stringify({failure:String(problem),verified,ui,errors,externalRequests},null,2));
  throw problem;
}finally{
  await browser?.close();
  server.kill();
  provider.close();
}
