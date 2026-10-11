import puppeteer from 'puppeteer-core';
import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve('../..'),out=resolve('evidence/parity-state');await mkdir(out,{recursive:true});
const origin='http://127.0.0.1:4198';
if(await fetch(origin).then(()=>true,()=>false))throw new Error('Test port is occupied');
const server=spawn(process.execPath,['apps/launcher/server.mjs'],{cwd:root,windowsHide:true,env:{...process.env,JUEONY_PORT:'4198',JUEONY_DIST:resolve('evidence/dist-parity'),JUEONY_CONNECTION_STORE:'memory'},stdio:'ignore'});
let browser;const results=[],errors=[];let page;
const pass=name=>{results.push(name);console.log('PASS',name);};
const ready=()=>page.waitForFunction(()=>document.getElementById('app-status')?.textContent.includes('준비 완료'),{timeout:90000});
const dbRead=async(store,id)=>page.evaluate((store,id)=>new Promise((resolve,reject)=>{const r=indexedDB.open('jueony-workspaces');r.onsuccess=()=>{const db=r.result,q=db.transaction(store).objectStore(store).get(id);q.onsuccess=()=>{resolve(q.result);db.close();};q.onerror=()=>reject(q.error);};}),store,id);
const active=()=>page.$('.editor-frame:not([hidden])').then(h=>h.contentFrame());
const edit=async(text)=>{const f=await active();await f.evaluate(async text=>{const a=window.jueonyEditor,s=a.snapshot();await a.apply(crypto.randomUUID(),s,{message:'fixture',sourceIds:[],operations:[{kind:'replace_body_text',target:s.nodes[0].id,start:0,count:[...s.nodes[0].text].length,text}]});},text);};
try{
 for(let n=0;n<100;n++){if(server.exitCode!==null)throw new Error('Server exited');if(await fetch(origin+'/api/health').then(r=>r.ok,()=>false))break;await new Promise(r=>setTimeout(r,100));}
 browser=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--no-first-run','--disable-background-networking'],defaultViewport:{width:1500,height:1000}});
 page=await browser.newPage();page.on('pageerror',e=>errors.push(String(e)));page.on('dialog',d=>d.accept());
 await page.goto(origin+'/favicon.ico');
 const bytes=[...await readFile('fixtures/three-paragraphs.hwpx')];
 await page.evaluate(async bytes=>{
  const data=new Uint8Array(bytes),dir=await navigator.storage.getDirectory(),handle=await dir.getFileHandle('first.hwpx',{create:true}),writer=await handle.createWritable();await writer.write(data);await writer.close();
  const fingerprint=[...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(b=>b.toString(16).padStart(2,'0')).join('');
  await new Promise((resolve,reject)=>{const r=indexedDB.open('jueony-workspaces',1);r.onupgradeneeded=()=>{r.result.createObjectStore('state');r.result.createObjectStore('documents',{keyPath:'id'});};r.onsuccess=()=>{
   const db=r.result,t=db.transaction(['state','documents'],'readwrite');
   t.objectStore('state').put({version:1,activeWorkspaceId:'work',workspaces:[{id:'work',name:'검수 업무',activeChatId:'chat',activeDocumentId:'z-first',documentOrder:['z-first','a-second','m-broken']}],chats:[{id:'chat',workspaceId:'work',title:'검수 대화',messages:[]}],folders:[],runs:[],models:[],split:42},'current');
   for(const doc of [{id:'z-first',name:'first.hwpx',bytes:data,dirty:true,fileConnection:{handle,fingerprint}},{id:'a-second',name:'second.hwpx',bytes:data,dirty:false},{id:'m-broken',name:'broken.hwp',bytes:new Uint8Array([1,2,3]),dirty:true},{id:'',name:'invalid-id.hwp',bytes:data,dirty:false}])t.objectStore('documents').put({...doc,workspaceId:'work',updatedAt:Date.now()});
   t.oncomplete=()=>{db.close();resolve();};t.onerror=()=>reject(t.error);
  };});
 },bytes);
 await page.goto(origin+'/');await ready();
 assert.deepEqual(await page.$$eval('.document-tab',els=>els.map(e=>e.textContent)),['first.hwpx','second.hwpx','broken.hwp · 복원 실패']);
 assert.equal(await (await active()).evaluate(()=>window.jueonyEditor.fileHandle()?.name),'first.hwpx');
 pass('stored tab order and active document restored; corrupt record does not block healthy documents');
 await new Promise(r=>setTimeout(r,1800));assert.deepEqual(Object.values((await dbRead('documents','m-broken')).bytes),[1,2,3]);pass('failed restore never overwrites original recovery bytes with a blank editor');
 assert.equal((await dbRead('state','current')).workspaces[0].documentOrder.includes(''),false);assert.equal((await dbRead('documents','')).name,'invalid-id.hwp');pass('invalid recovery metadata is preserved without poisoning workspace tab order');
 await edit('재실행 후 원본 저장 검수');await page.click('#save-document');await page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('파일에 저장'));
 assert.equal(await (await active()).evaluate(()=>window.jueonyEditor.state().dirty),false);pass('restored dirty document saves to verified original handle');
 await page.click('#toggle-sidebar');await page.waitForFunction(()=>new Promise(resolve=>{const r=indexedDB.open('jueony-workspaces');r.onsuccess=()=>{const d=r.result,q=d.transaction('state').objectStore('state').get('current');q.onsuccess=()=>{resolve(q.result?.sidebarHidden===true);d.close();};};}));await page.reload();await ready();assert.equal(await page.$eval('#app-shell',e=>e.classList.contains('sidebar-hidden')),true);pass('workspace panel visibility survives restart');
 const f1=page.frames().find(f=>f.url().includes('editor.html'));
 const frames=page.frames().filter(f=>f.url().includes('editor.html'));
 const before=await frames[0].evaluate(()=>window.jueonyEditor.state().revision);
 await frames[0].evaluate(()=>window.rhwpStudio.automation.execute('view:para-mark'));
 await frames[1].waitForFunction(()=>window.rhwpStudio.automation.getContext().showParagraphMarks===true);
 await frames[1].evaluate(()=>window.rhwpStudio.automation.execute('view:toolbox-basic'));
 await frames[0].waitForFunction(()=>getComputedStyle(document.getElementById('icon-toolbar')).display==='none');
 const settings=await page.evaluate(()=>JSON.parse(localStorage.getItem('rhwp-settings')));assert.equal(settings.view.showParagraphMarks,true);assert.equal(settings.view.toolbarBasic,false);
 assert.equal(await frames[0].evaluate(()=>window.jueonyEditor.state().revision),before);pass('settings synchronize between real editor iframes without document mutation or stale overwrite');
 await page.reload();await ready();assert.equal(await (await active()).evaluate(()=>window.rhwpStudio.automation.getContext().showParagraphMarks),true);pass('stored viewing settings survive restart');
 await page.evaluate(async()=>{const d=await navigator.storage.getDirectory(),h=await d.getFileHandle('first.hwpx'),w=await h.createWritable();await w.write('external change sentinel');await w.close();});
 await page.reload();await ready();assert.equal(await (await active()).evaluate(()=>Boolean(window.jueonyEditor.fileHandle())),false);
 await page.click('#reconnect-document');await page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('원본 파일이'));
 assert.equal(await page.evaluate(async()=>await (await (await navigator.storage.getDirectory()).getFileHandle('first.hwpx')).getFile().then(f=>f.text())),'external change sentinel');
 assert.equal(await (await active()).evaluate(()=>window.jueonyEditor.snapshot().nodes[0].text),'재실행 후 원본 저장 검수');pass('external file change blocks reconnection and preserves recovered document and original file');
 await (await active()).evaluate(async bytes=>window.jueonyEditor.open(new Uint8Array(bytes),'different.hwpx'),bytes);
 await page.waitForFunction(()=>document.getElementById('reconnect-document').hidden);
 pass('replacing a restored tab clears pending original connection');
 // Force a document-store failure after the real editor has changed.
 await page.evaluate(()=>{window.originalPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){if(this.name==='documents')throw new DOMException('fixture full','QuotaExceededError');return window.originalPut.apply(this,args);};});
 await edit('저장 실패 닫기 검수');await page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('fixture full'));
 assert.equal(await page.evaluate(()=>{const e=new Event('beforeunload',{cancelable:true});window.dispatchEvent(e);return e.defaultPrevented;}),true);
 await page.click('.document-tab-wrap.is-active .close-tab');await page.waitForFunction(()=>document.getElementById('close-document').open);
 await page.click('#close-document button[value=discard]');await page.waitForFunction(()=>document.querySelectorAll('.document-tab').length===2);
 await page.evaluate(()=>{IDBObjectStore.prototype.put=window.originalPut;});assert.equal(await dbRead('documents','z-first'),undefined);
 pass('failed checkpoint warns on exit and does not permanently block explicit discard/close');
 // A protected-save transition removes any prior plaintext checkpoint.
 const remaining=await active();
 await remaining.evaluate(()=>{const api=window.jueonyEditor;window.originalRecovery=api.recovery;api.recovery=()=>{const e=new Error('protected checkpoint fixture');e.code='PASSWORD_RECOVERY_BLOCKED';throw e;};});
 await edit('protected checkpoint transition');
 await page.waitForFunction(()=>new Promise(resolve=>{const r=indexedDB.open('jueony-workspaces');r.onsuccess=()=>{const d=r.result,q=d.transaction('documents').objectStore('documents').get('a-second');q.onsuccess=()=>{resolve(q.result===undefined);d.close();};};}));
 pass('password-protection signal removes old plaintext recovery record without exporting another');
 await remaining.evaluate(()=>{window.jueonyEditor.recovery=window.originalRecovery;});
 await edit('unprotected checkpoint resumed');
 await page.waitForFunction(()=>new Promise(resolve=>{const r=indexedDB.open('jueony-workspaces');r.onsuccess=()=>{const d=r.result,q=d.transaction('documents').objectStore('documents').get('a-second');q.onsuccess=()=>{resolve(Boolean(q.result));d.close();};};}));
 pass('normal recovery resumes after protection is removed');
 // Loss or exporter failure must leave the last good record untouched.
 const previousRecord=await dbRead('documents','a-second');
 await remaining.evaluate(()=>{window.jueonyEditor.recovery=()=>{throw new Error('content loss fixture');};});
 await edit('must not replace previous recovery');
 await page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('content loss fixture'));
 assert.deepEqual((await dbRead('documents','a-second')).bytes,previousRecord.bytes);
 pass('lossy/failed export leaves last known good checkpoint intact');
 await remaining.evaluate(()=>{window.jueonyEditor.recovery=window.originalRecovery;});
 // Separate browser context, never the user's profile, for corrupt-store startup.
 const brokenContext=await browser.createBrowserContext(),brokenPage=await brokenContext.newPage();
 await brokenPage.goto(origin+'/favicon.ico');
 await brokenPage.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('jueony-workspaces',1);r.onupgradeneeded=()=>{r.result.createObjectStore('state');r.result.createObjectStore('documents',{keyPath:'id'});};r.onsuccess=()=>{const d=r.result,t=d.transaction('state','readwrite');t.objectStore('state').put({version:999,sentinel:'keep me'},'current');t.oncomplete=()=>{d.close();resolve();};};}));
 await brokenPage.goto(origin+'/');await brokenPage.waitForFunction(()=>document.getElementById('app-status').textContent.includes('버전'));
 assert.equal(await brokenPage.$eval('#app-shell',e=>e.inert),true);
 assert.equal(await brokenPage.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('jueony-workspaces');r.onsuccess=()=>{const d=r.result,q=d.transaction('state').objectStore('state').get('current');q.onsuccess=()=>{resolve(q.result.sentinel);d.close();};};})),'keep me');
 await brokenContext.close();pass('unsupported workspace schema blocks editing without resetting stored data');
 await page.screenshot({path:resolve(out,'state.png'),fullPage:true});
 assert.deepEqual(errors,[]);
 await writeFile(resolve(out,'result.json'),JSON.stringify({results,errors,build:await page.evaluate(()=>fetch('/build-evidence.json').then(r=>r.json())),limits:['Isolated headless Edge and OPFS handles, not physical Korean IME or native Windows file picker','Hancom 2024 independent editor comparison NOT_RUN']},null,2));
}catch(error){console.error(error);if(page){await page.screenshot({path:resolve(out,'failure.png'),fullPage:true}).catch(()=>{});await writeFile(resolve(out,'failure.json'),JSON.stringify({error:String(error),results,errors,status:await page.$eval('#app-status',e=>e.textContent).catch(()=>''),frames:await page.$$eval('.editor-frame',els=>els.map(f=>({hidden:f.hidden,name:f.contentWindow.jueonyEditor?.state().name}))).catch(()=>[])},null,2));}process.exitCode=1;}
finally{await browser?.close();server.kill();}
