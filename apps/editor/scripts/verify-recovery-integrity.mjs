import puppeteer from 'puppeteer-core';
import {spawn} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const app=resolve(dirname(fileURLToPath(import.meta.url)),'..'),repo=resolve(app,'../..');
if(!process.env.JUEONY_TEST_DIST||!process.env.JUEONY_ENGINE_PACKAGE)throw new Error('Explicit dist and engine required');
const dist=resolve(app,process.env.JUEONY_TEST_DIST),pkg=resolve(repo,process.env.JUEONY_ENGINE_PACKAGE),out=resolve(repo,process.env.JUEONY_TEST_OUTPUT??'build/recovery-integrity-browser');await mkdir(out,{recursive:true});
const port=Number(process.env.JUEONY_TEST_PORT??4433),origin=`http://127.0.0.1:${port}`,delay=ms=>new Promise(r=>setTimeout(r,ms)),hash=bytes=>createHash('sha256').update(new Uint8Array(bytes)).digest('hex');
const build=JSON.parse(await readFile(resolve(dist,'build-evidence.json'),'utf8')),engineBytes=await readFile(resolve(pkg,'rhwp_bg.wasm')),engine={wasmSha256:hash(engineBytes),jsSha256:hash(await readFile(resolve(pkg,'rhwp.js')))};
assert.equal(engine.wasmSha256,build.engineWasmSha256);assert.equal(engine.jsSha256,build.engineBuild.jsSha256);
const {default:init,HwpDocument}=await import(pathToFileURL(resolve(pkg,'rhwp.js')).href);await init({module_or_path:engineBytes});
if(await fetch(origin+'/api/health').then(()=>true,()=>false))throw new Error('Isolated test port occupied');
const server=spawn(process.execPath,[process.env.JUEONY_TEST_SERVER??'apps/launcher/server.mjs'],{cwd:repo,windowsHide:true,stdio:'ignore',env:{...process.env,JUEONY_PORT:String(port),JUEONY_DIST:dist,JUEONY_CONNECTION_STORE:'memory'}});
const profile=resolve(out,'edge-profile-'+randomUUID()),results=[],failures=[],pageErrors=[],consoleErrors=[],externalRequests=[],observations=[];let browser,page;
const conflictOnly=process.env.JUEONY_TEST_RECOVERY_CASE==='conflict';
const integrityOnly=process.env.JUEONY_TEST_RECOVERY_CASE==='integrity';
function text(bytes){const d=new HwpDocument(new Uint8Array(bytes));try{return d.getTextRange(0,0,0,d.getParagraphLength(0,0));}finally{d.free();}}
const ready=async target=>{
 try{await target.waitForFunction(()=>document.getElementById('app-status')?.textContent.includes('준비 완료'),{timeout:45000});}
 catch(error){throw Error('App startup: '+await target.$eval('#app-status',node=>node.textContent).catch(()=>'(no status)'),{cause:error});}
};
const active=async()=>(await page.$('.editor-frame:not([hidden])')).contentFrame();
const browserName=(process.env.JUEONY_TEST_BROWSER??'Edge').toLowerCase().includes('chrome')?'Chrome':'Edge';
async function boot(){
 browser=await puppeteer.launch({executablePath:process.env.JUEONY_TEST_BROWSER??'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,userDataDir:profile,args:['--no-first-run','--disable-background-networking'],defaultViewport:{width:1400,height:1000}});
 page=await openPage();
}
async function openPage(context=browser){
 const target=await context.newPage();target.setDefaultTimeout(25000);target.on('dialog',d=>void(d.type()==='beforeunload'?d.accept():d.dismiss()));target.on('pageerror',e=>pageErrors.push(String(e)));target.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
 await target.setRequestInterception(true);target.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:')){externalRequests.push(r.url());void r.abort();}else void r.continue();});await target.goto(origin);await ready(target);return target;
}
async function services(){const f=await active();await f.evaluate(()=>{if(window.__integrityServices)return;const a=window.rhwpStudio.automation;a.registerCommand({id:'ext:integrity-inspect',label:'검수',canExecute:()=>true,execute:s=>window.__integrityServices=s});a.execute('ext:integrity-inspect');a.unregisterCommand('ext:integrity-inspect');});return f;}
async function execute(id){const r=await(await active()).evaluate(id=>window.jueonyEditor.executeCommand(id),id);assert.equal(r.ok,true,JSON.stringify(r));}
async function historyState(){return (await services()).evaluate(()=>{
 const input=window.__integrityServices.getInputHandler();return {undo:input.canUndo(),redo:input.canRedo()};
});}
async function edit(value){const f=await services();await f.evaluate(value=>{const ih=window.__integrityServices.getInputHandler(),pos=ih.getCursorPosition();ih.executeOperation({kind:'snapshot',operationType:'integrity-check-edit',operation:w=>{w.insertText(0,0,0,value);return pos;}});},value);}
async function records(){return page.evaluate(async()=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('jueony-workspaces',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});try{return await new Promise((resolve,reject)=>{const r=db.transaction('documents').objectStore('documents').getAll();r.onsuccess=()=>resolve(r.result.map(d=>({id:d.id,workspaceId:d.workspaceId,name:d.name,dirty:d.dirty,updatedAt:d.updatedAt,viewUpdatedAt:d.viewUpdatedAt,view:d.view,integrity:d.integrity,checkpointToken:d.checkpointToken,bytes:[...d.bytes]})));r.onerror=()=>reject(r.error);});}finally{db.close();}});}
async function observeCheckpointTransactions(target){
 await target.evaluate(()=>{
  const start=IDBDatabase.prototype.transaction;
  window.__checkpointTransactions=[];
  IDBDatabase.prototype.transaction=function(storeNames,mode,options){
   const tx=start.call(this,storeNames,mode,options);
   if(this.name==='jueony-workspaces'&&mode==='readwrite'&&[...tx.objectStoreNames].includes('documents')){
    const entry={durability:tx.durability,outcome:'pending'};window.__checkpointTransactions.push(entry);
    tx.addEventListener('complete',()=>{entry.outcome='committed';});
    tx.addEventListener('abort',()=>{entry.outcome='aborted';});
   }
   return tx;
  };
 });
}
async function waitRecord(name,predicate){for(let i=0;i<180;i++){const d=(await records()).find(x=>x.name===name);if(d&&predicate(d))return d;await delay(100);}throw new Error('Checkpoint timeout '+name);}
function assertTag(record){const digest=createHash('sha256').update(JSON.stringify(['jueony-recovery',1,record.id,record.workspaceId,record.name,record.dirty,record.updatedAt,record.bytes.length])).update(new Uint8Array(record.bytes)).digest('hex');assert.deepEqual(record.integrity,{version:1,algorithm:'sha256',value:digest});}
async function disk(name){return page.evaluate(async name=>{const root=await navigator.storage.getDirectory(),h=await root.getFileHandle(name);return [...new Uint8Array(await(await h.getFile()).arrayBuffer())];},name);}
async function recoverySettings(){const f=await services();await execute('tool:options');await f.waitForSelector('.opt-body');await f.click('.opt-body .dialog-tab[data-tab=file]');await f.$eval('#opt-recovery-enabled',e=>{if(e.checked)e.click();});await f.$eval('#opt-idle-save-enabled',e=>{if(!e.checked)e.click();const input=e.closest('.opt-autosave-row').querySelector('input[type=number]');input.value='5';input.dispatchEvent(new Event('input',{bubbles:true}));});await f.click('.modal-overlay .dialog-btn-primary');}
async function crash(){
 const child=browser.process(),pid=child.pid;await page.evaluate(()=>{localStorage.removeItem('integrity-clean-exit');window.addEventListener('beforeunload',()=>localStorage.setItem('integrity-clean-exit','yes'));window.addEventListener('pagehide',()=>localStorage.setItem('integrity-clean-exit','yes'));});
 const exited=new Promise(resolve=>child.once('exit',(code,signal)=>resolve({code,signal})));
 assert.equal(child.kill('SIGKILL'),true,'The isolated test process must accept forced termination');
 const outcome=await Promise.race([exited,delay(25000).then(()=>{
  try{process.kill(pid,0);}catch(error){if(error.code==='ESRCH')return {exited:true,exitEventObserved:false};throw error;}
  throw new Error('Forced test process is still running');
 })]);
 browser=undefined;observations.push({kind:'forced-browser-process-exit',pid,...outcome});
 await delay(500);await boot();assert.equal(await page.evaluate(()=>localStorage.getItem('integrity-clean-exit')),null,'Orderly exit handlers must not run');
}
async function scenario(name,run){try{await run();results.push(name);console.log('PASS',name);}catch(e){failures.push({name,error:String(e),stack:e.stack});await page?.screenshot({path:resolve(out,'failure.png')}).catch(()=>{});throw e;}}
try{
 let healthy=false;
 for(let i=0;i<100&&!healthy&&server.exitCode===null;i++){
  healthy=await fetch(origin+'/api/health').then(r=>r.ok,()=>false);
  if(!healthy)await delay(100);
 }
 assert(healthy,'the packaged test launcher did not start');await boot();
 if(!conflictOnly){
 await recoverySettings();
 for(const format of ['hwp','hwpx']){
  const name='crash-integrity-'+format+'.'+format,d=HwpDocument.createEmpty();d.createBlankDocument();d.insertText(0,0,0,'복구 원문 '+format);const original=[...d[format==='hwp'?'exportHwp':'exportHwpx']()];d.free();
  await scenario(format+': actual checkpoint checksum and edit undo/redo',async()=>{
   const f=await services();await f.evaluate(async(bytes,name)=>{const root=await navigator.storage.getDirectory(),h=await root.getFileHandle(name,{create:true}),w=await h.createWritable();await w.write(new Uint8Array(bytes));await w.close();await window.jueonyEditor.open(new Uint8Array(bytes),name,h,false);},original,name);
   await edit('UNSAVED 😀 ');assert.deepEqual(await historyState(),{undo:true,redo:false});await execute('edit:undo');assert.equal(text(await f.evaluate(()=>[...window.jueonyEditor.recovery().bytes])),text(original));assert.deepEqual(await historyState(),{undo:false,redo:true});await execute('edit:redo');const saved=await waitRecord(name,d=>d.dirty&&text(d.bytes).startsWith('UNSAVED 😀 '));assertTag(saved);assert.deepEqual(await disk(name),original);observations.push({kind:'sealed-unsaved',format,id:saved.id,sha256:hash(saved.bytes),history:await historyState()});
  });
  const saved=await waitRecord(name,d=>d.dirty&&Boolean(d.integrity));
  await scenario(format+': view-only update retains content checksum',async()=>{await execute(saved.view?.fitMode==='fitWidth'?'view:zoom-100':'view:zoom-fit-width');const after=await waitRecord(name,d=>d.viewUpdatedAt>saved.viewUpdatedAt);assert.notEqual(after.view.fitMode,saved.view.fitMode);assert.equal(after.updatedAt,saved.updatedAt);assert.deepEqual(after.bytes,saved.bytes);assert.deepEqual(after.integrity,saved.integrity);assertTag(after);});
  await scenario(format+`: abrupt ${browserName} process crash restores dirty checkpoint and keeps original disk`,async()=>{await crash();const f=await active();await f.waitForFunction(name=>window.jueonyEditor?.state().name===name,{timeout:30000},name);const actual=await f.evaluate(()=>({state:window.jueonyEditor.state(),bytes:[...window.jueonyEditor.recovery().bytes]}));assert.equal(actual.state.dirty,true);assert.equal(text(actual.bytes),text(saved.bytes));assert.deepEqual(await disk(name),original);const stored=(await records()).find(d=>d.id===saved.id);assertTag(stored);assert.deepEqual(stored.bytes,saved.bytes);const history=await historyState();assert.deepEqual(history,{undo:false,redo:false});observations.push({kind:'restored-after-crash',format,dirty:true,diskUnchanged:true,checkpointSha256:hash(stored.bytes),history});});
  await scenario(format+': recovered document UI save and clean checksum checkpoint',async()=>{await page.click('#save-document');const clean=await waitRecord(name,d=>!d.dirty&&d.updatedAt>=saved.updatedAt);assertTag(clean);assert.equal(text(await disk(name)),text(saved.bytes));assert.equal((await(await active()).evaluate(()=>window.jueonyEditor.state())).dirty,false);await writeFile(resolve(out,'recovered-saved-'+format+'.'+format),new Uint8Array(await disk(name)));});
 }
 await scenario('corrupted bytes, rebound metadata and future tags isolate without deleting drafts',async()=>{
  await page.evaluate(async()=>{
   const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('jueony-workspaces',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});try{
    const values=await new Promise((resolve,reject)=>{const r=db.transaction('documents').objectStore('documents').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);}),base=values.find(d=>d.name==='crash-integrity-hwpx.hwpx');if(!base?.integrity)throw new Error('Missing sealed source');
    const bad=structuredClone(base);bad.id='integrity-corrupt';bad.name='corrupt-bytes.hwpx';
    const prefix=new TextEncoder().encode(JSON.stringify(['jueony-recovery',1,bad.id,bad.workspaceId,bad.name,bad.dirty,bad.updatedAt,bad.bytes.length])),payload=new Uint8Array(prefix.length+bad.bytes.length);payload.set(prefix);payload.set(bad.bytes,prefix.length);bad.integrity.value=[...new Uint8Array(await crypto.subtle.digest('SHA-256',payload))].map(b=>b.toString(16).padStart(2,'0')).join('');bad.bytes[bad.bytes.length-1]^=1;
    const meta=structuredClone(base);meta.id='integrity-metadata';meta.name='metadata-mismatch.hwpx';const future=structuredClone(base);future.id='integrity-future';future.integrity.version=2;
    const legacy=structuredClone(base);legacy.id='integrity-legacy';legacy.name='legacy-unsealed.hwpx';legacy.dirty=true;delete legacy.integrity;delete legacy.fileConnection;delete legacy.checkpointToken;
    await new Promise((resolve,reject)=>{const tx=db.transaction('documents','readwrite');for(const d of [bad,meta,future,legacy])tx.objectStore('documents').put(d);tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(tx.error);});
   }finally{db.close();}
  });
  const ids=['integrity-corrupt','integrity-metadata','integrity-future'],beforeReload=await records(),invalid=beforeReload.filter(d=>ids.includes(d.id));await page.reload();await ready(page);assert.match(await page.$eval('#app-status',e=>e.textContent),/일부 문서 복원 실패/);const tabs=await page.$$eval('.document-tab',es=>es.map(e=>e.textContent));assert.equal(tabs.length,2);assert.ok(tabs.includes('legacy-unsealed.hwpx'));assert.equal(tabs.some(t=>/metadata-mismatch|corrupt-bytes/.test(t)),false);assert.deepEqual((await records()).filter(d=>ids.includes(d.id)),invalid);
  const legacy=(await records()).find(d=>d.id==='integrity-legacy');assert.match(legacy.checkpointToken,/^[0-9a-f-]{36}$/u);
  assert.deepEqual(legacy.bytes,beforeReload.find(d=>d.id===legacy.id).bytes);if(legacy.integrity)assertTag(legacy);
  observations.push({kind:'isolated-damage',invalidIds:ids,recordsRetained:true,healthyAndLegacyOpened:true,legacyVersionAdopted:true});
 });
 await scenario('legacy restored draft gains checksum on next real automatic checkpoint',async()=>{await page.evaluate(()=>[...document.querySelectorAll('.document-tab')].find(e=>e.textContent==='legacy-unsealed.hwpx').click());await services();await edit('LEGACY UPGRADE ');const upgraded=await waitRecord('legacy-unsealed.hwpx',d=>Boolean(d.integrity)&&text(d.bytes).startsWith('LEGACY UPGRADE '));assertTag(upgraded);assert.equal(await(await active()).evaluate(()=>window.jueonyEditor.fileHandle()),null);observations.push({kind:'legacy-upgraded',id:upgraded.id,sha256:hash(upgraded.bytes)});});
 }
 if(!integrityOnly)await scenario('a stale app tab cannot overwrite or discard a newer committed checkpoint',async()=>{
  const parent=page,context=await browser.createBrowserContext();
  try{
   page=await openPage(context);await recoverySettings();
   const name='concurrent-recovery.hwpx',fixture=HwpDocument.createEmpty();
   fixture.createBlankDocument();fixture.insertText(0,0,0,'원본 문서');const original=[...fixture.exportHwpx()];fixture.free();
   const opened=await services();
   await opened.evaluate(async(bytes,name)=>{
    const root=await navigator.storage.getDirectory(),handle=await root.getFileHandle(name,{create:true}),out=await handle.createWritable();
    await out.write(new Uint8Array(bytes));await out.close();await window.jueonyEditor.open(new Uint8Array(bytes),name,handle,false);
   },original,name);
   const older=page;await observeCheckpointTransactions(older);
   await edit('BASE ');
   const base=await waitRecord(name,d=>d.dirty&&text(d.bytes).startsWith('BASE '));
   await older.waitForFunction(()=>window.__checkpointTransactions.some(tx=>tx.outcome==='committed'&&tx.durability==='strict'));
   // The application grants one window the workspace lock. An independent
   // IndexedDB connection in this synthetic profile creates the stale-writer case.
   const competing=await context.newPage();await competing.goto(origin+'/build-evidence.json');
   const updated=HwpDocument.createEmpty();
   const newerBytes=(()=>{try{updated.createBlankDocument();updated.insertText(0,0,0,'NEWER 원본 문서');return [...updated.exportHwpx()];}finally{updated.free();}})();
   const updatedAt=base.updatedAt+1000;
   const digest=createHash('sha256').update(JSON.stringify(['jueony-recovery',1,base.id,base.workspaceId,name,true,updatedAt,newerBytes.length])).update(new Uint8Array(newerBytes)).digest('hex');
   const replacement={bytes:newerBytes,updatedAt,integrity:{version:1,algorithm:'sha256',value:digest},checkpointToken:randomUUID()};
   const durability=await competing.evaluate(async(base,replacement)=>{
    const database=await new Promise((resolve,reject)=>{const request=indexedDB.open('jueony-workspaces',1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    try{return await new Promise((resolve,reject)=>{
     const tx=database.transaction('documents','readwrite',{durability:'strict'}),store=tx.objectStore('documents'),read=store.get(base.id);
     read.onsuccess=()=>{
      if(read.result?.checkpointToken!==base.checkpointToken){tx.abort();return;}
      store.put({...read.result,...replacement,bytes:new Uint8Array(replacement.bytes)});
     };
     tx.oncomplete=()=>resolve(tx.durability);tx.onabort=()=>reject(tx.error??Error('The competing checkpoint was not committed.'));
    });}finally{database.close();}
   },base,replacement);
   assert.equal(durability,'strict');
   const latest=(await records()).find(record=>record.id===base.id);
   assertTag(latest);assert.equal(latest.checkpointToken,replacement.checkpointToken);
   await older.bringToFront();
   await edit('STALE ');
   await older.waitForFunction(()=>document.getElementById('app-status').textContent.includes('다른 창에서 복구본이 바뀌었습니다'));
   const staleBytes=await (await active()).evaluate(()=>[...window.jueonyEditor.recovery().bytes]);
   const staleHistory=await historyState();assert.equal(staleHistory.undo,true);
   assert.match(text(staleBytes),/^STALE /u);
   assert.deepEqual((await records()).find(d=>d.id===latest.id),latest);
   const abortCount=await older.evaluate(()=>window.__checkpointTransactions.filter(tx=>tx.outcome==='aborted').length);
   await older.click('.document-tab-wrap.is-active .close-tab');await older.waitForSelector('#close-document[open]');
   await older.click('#close-document button[value=discard]');
   await older.waitForFunction(count=>window.__checkpointTransactions.filter(tx=>tx.outcome==='aborted').length>count,{},abortCount);
   assert.deepEqual(await (await active()).evaluate(()=>[...window.jueonyEditor.recovery().bytes]),staleBytes);
   assert.deepEqual(await historyState(),staleHistory);
   assert.deepEqual((await records()).find(d=>d.id===latest.id),latest);
   assert.deepEqual(await disk(name),original);
   await older.close();await competing.close();page=await openPage(context);
   const reopened=await (await active()).evaluate(()=>({state:window.jueonyEditor.state(),text:window.jueonyEditor.snapshot().nodes[0]?.text}));
   assert.equal(reopened.state.name,name);assert.equal(reopened.state.dirty,true);assert.equal(reopened.text,text(latest.bytes));
   const restored=(await records()).find(record=>record.id===latest.id);
   assert.equal(hash(restored.bytes),hash(latest.bytes));assertTag(restored);
   observations.push({kind:'concurrent-workspace-storage',strictCommit:true,staleWriteRejected:true,staleCloseRejected:true,newestRestored:true,originalUnchanged:true});
  }finally{page=parent;await context.close();}
 });
 assert.deepEqual(pageErrors,[]);assert.deepEqual(consoleErrors,[]);assert.deepEqual(externalRequests,[]);
}finally{await writeFile(resolve(out,'result.json'),JSON.stringify({results,failures,pageErrors,consoleErrors,externalRequests,observations,build,engine,scope:`Owned isolated ${browserName} persistent profile and synthetic OPFS files. Forced exit targets only the test process. Checksums detect accidental damage, not malicious tampering. Legacy unsealed records accepted. No Hancom, Windows picker/ACL, OS power loss or paid model calls.`},null,2));await browser?.close();server.kill();}
if(failures.length)process.exitCode=1;
