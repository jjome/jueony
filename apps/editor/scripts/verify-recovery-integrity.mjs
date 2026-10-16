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
const port=4433,origin=`http://127.0.0.1:${port}`,delay=ms=>new Promise(r=>setTimeout(r,ms)),hash=bytes=>createHash('sha256').update(new Uint8Array(bytes)).digest('hex');
const build=JSON.parse(await readFile(resolve(dist,'build-evidence.json'),'utf8')),engineBytes=await readFile(resolve(pkg,'rhwp_bg.wasm')),engine={wasmSha256:hash(engineBytes),jsSha256:hash(await readFile(resolve(pkg,'rhwp.js')))};
assert.equal(engine.wasmSha256,build.engineWasmSha256);assert.equal(engine.jsSha256,build.engineBuild.jsSha256);
const {default:init,HwpDocument}=await import(pathToFileURL(resolve(pkg,'rhwp.js')).href);await init({module_or_path:engineBytes});
if(await fetch(origin+'/api/health').then(()=>true,()=>false))throw new Error('Isolated test port occupied');
const server=spawn(process.execPath,['apps/launcher/server.mjs'],{cwd:repo,windowsHide:true,stdio:'ignore',env:{...process.env,JUEONY_PORT:String(port),JUEONY_DIST:dist,JUEONY_CONNECTION_STORE:'memory'}});
const profile=resolve(out,'edge-profile-'+randomUUID()),results=[],failures=[],pageErrors=[],consoleErrors=[],externalRequests=[],observations=[];let browser,page;
function text(bytes){const d=new HwpDocument(new Uint8Array(bytes));try{return d.getTextRange(0,0,0,d.getParagraphLength(0,0));}finally{d.free();}}
const ready=()=>page.waitForFunction(()=>document.getElementById('app-status')?.textContent.includes('준비 완료'),{timeout:90000});
const active=async()=>(await page.$('.editor-frame:not([hidden])')).contentFrame();
async function boot(){
 browser=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,userDataDir:profile,args:['--no-first-run','--disable-background-networking'],defaultViewport:{width:1400,height:1000}});
 page=await browser.newPage();page.setDefaultTimeout(25000);page.on('dialog',d=>void(d.type()==='beforeunload'?d.accept():d.dismiss()));page.on('pageerror',e=>pageErrors.push(String(e)));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
 await page.setRequestInterception(true);page.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:')){externalRequests.push(r.url());void r.abort();}else void r.continue();});await page.goto(origin);await ready();
}
async function services(){const f=await active();await f.evaluate(()=>{if(window.__integrityServices)return;const a=window.rhwpStudio.automation;a.registerCommand({id:'ext:integrity-inspect',label:'검수',canExecute:()=>true,execute:s=>window.__integrityServices=s});a.execute('ext:integrity-inspect');a.unregisterCommand('ext:integrity-inspect');});return f;}
async function execute(id){const r=await(await active()).evaluate(id=>window.jueonyEditor.executeCommand(id),id);assert.equal(r.ok,true,JSON.stringify(r));}
async function edit(value){const f=await services();await f.evaluate(value=>{const ih=window.__integrityServices.getInputHandler(),pos=ih.getCursorPosition();ih.executeOperation({kind:'snapshot',operationType:'integrity-check-edit',operation:w=>{w.insertText(0,0,0,value);return pos;}});},value);}
async function records(){return page.evaluate(async()=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('jueony-workspaces',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});try{return await new Promise((resolve,reject)=>{const r=db.transaction('documents').objectStore('documents').getAll();r.onsuccess=()=>resolve(r.result.map(d=>({id:d.id,workspaceId:d.workspaceId,name:d.name,dirty:d.dirty,updatedAt:d.updatedAt,viewUpdatedAt:d.viewUpdatedAt,view:d.view,integrity:d.integrity,bytes:[...d.bytes]})));r.onerror=()=>reject(r.error);});}finally{db.close();}});}
async function waitRecord(name,predicate){for(let i=0;i<180;i++){const d=(await records()).find(x=>x.name===name);if(d&&predicate(d))return d;await delay(100);}throw new Error('Checkpoint timeout '+name);}
function assertTag(record){const digest=createHash('sha256').update(JSON.stringify(['jueony-recovery',1,record.id,record.workspaceId,record.name,record.dirty,record.updatedAt,record.bytes.length])).update(new Uint8Array(record.bytes)).digest('hex');assert.deepEqual(record.integrity,{version:1,algorithm:'sha256',value:digest});}
async function disk(name){return page.evaluate(async name=>{const root=await navigator.storage.getDirectory(),h=await root.getFileHandle(name);return [...new Uint8Array(await(await h.getFile()).arrayBuffer())];},name);}
async function recoverySettings(){const f=await services();await execute('tool:options');await f.waitForSelector('.opt-body');await f.click('.opt-body .dialog-tab[data-tab=file]');await f.$eval('#opt-recovery-enabled',e=>{if(e.checked)e.click();});await f.$eval('#opt-idle-save-enabled',e=>{if(!e.checked)e.click();const input=e.closest('.opt-autosave-row').querySelector('input[type=number]');input.value='5';input.dispatchEvent(new Event('input',{bubbles:true}));});await f.click('.modal-overlay .dialog-btn-primary');}
async function crash(){
 const child=browser.process(),pid=child.pid;await page.evaluate(()=>{localStorage.removeItem('integrity-clean-exit');window.addEventListener('beforeunload',()=>localStorage.setItem('integrity-clean-exit','yes'));window.addEventListener('pagehide',()=>localStorage.setItem('integrity-clean-exit','yes'));});
 const exited=new Promise(resolve=>child.once('exit',(code,signal)=>resolve({code,signal}))),disconnected=new Promise(resolve=>browser.once('disconnected',resolve)),cdp=await browser.target().createCDPSession();void cdp.send('Browser.crash').catch(()=>{});
 await Promise.race([disconnected,delay(10000).then(()=>{throw new Error('Own test browser did not crash');})]);
 const outcome=await Promise.race([exited,delay(10000).then(()=>{throw new Error('Crashed test process did not exit');})]);browser=undefined;observations.push({kind:'actual-browser-process-crash',pid,...outcome});await boot();assert.equal(await page.evaluate(()=>localStorage.getItem('integrity-clean-exit')),null,'Orderly exit handlers must not run');
}
async function scenario(name,run){try{await run();results.push(name);console.log('PASS',name);}catch(e){failures.push({name,error:String(e),stack:e.stack});await page?.screenshot({path:resolve(out,'failure.png')}).catch(()=>{});throw e;}}
try{
 for(let i=0;i<100;i++){if(await fetch(origin+'/api/health').then(r=>r.ok,()=>false))break;await delay(100);}await boot();await recoverySettings();
 for(const format of ['hwp','hwpx']){
  const name='crash-integrity-'+format+'.'+format,d=HwpDocument.createEmpty();d.createBlankDocument();d.insertText(0,0,0,'복구 원문 '+format);const original=[...d[format==='hwp'?'exportHwp':'exportHwpx']()];d.free();
  await scenario(format+': actual checkpoint checksum and edit undo/redo',async()=>{
   const f=await services();await f.evaluate(async(bytes,name)=>{const root=await navigator.storage.getDirectory(),h=await root.getFileHandle(name,{create:true}),w=await h.createWritable();await w.write(new Uint8Array(bytes));await w.close();await window.jueonyEditor.open(new Uint8Array(bytes),name,h,false);},original,name);
   await edit('UNSAVED 😀 ');await execute('edit:undo');assert.equal(text(await f.evaluate(()=>[...window.jueonyEditor.recovery().bytes])),text(original));await execute('edit:redo');const saved=await waitRecord(name,d=>d.dirty&&text(d.bytes).startsWith('UNSAVED 😀 '));assertTag(saved);assert.deepEqual(await disk(name),original);observations.push({kind:'sealed-unsaved',format,id:saved.id,sha256:hash(saved.bytes)});
  });
  const saved=await waitRecord(name,d=>d.dirty&&Boolean(d.integrity));
  await scenario(format+': view-only update retains content checksum',async()=>{await execute(saved.view?.fitMode==='fitWidth'?'view:zoom-100':'view:zoom-fit-width');const after=await waitRecord(name,d=>d.viewUpdatedAt>saved.viewUpdatedAt);assert.notEqual(after.view.fitMode,saved.view.fitMode);assert.equal(after.updatedAt,saved.updatedAt);assert.deepEqual(after.bytes,saved.bytes);assert.deepEqual(after.integrity,saved.integrity);assertTag(after);});
  await scenario(format+': abrupt Edge process crash restores dirty checkpoint and keeps original disk',async()=>{await crash();const f=await active();await f.waitForFunction(name=>window.jueonyEditor?.state().name===name,{timeout:30000},name);const actual=await f.evaluate(()=>({state:window.jueonyEditor.state(),bytes:[...window.jueonyEditor.recovery().bytes]}));assert.equal(actual.state.dirty,true);assert.equal(text(actual.bytes),text(saved.bytes));assert.deepEqual(await disk(name),original);const stored=(await records()).find(d=>d.id===saved.id);assertTag(stored);assert.deepEqual(stored.bytes,saved.bytes);observations.push({kind:'restored-after-crash',format,dirty:true,diskUnchanged:true,checkpointSha256:hash(stored.bytes)});});
  await scenario(format+': recovered document UI save and clean checksum checkpoint',async()=>{await page.click('#save-document');const clean=await waitRecord(name,d=>!d.dirty&&d.updatedAt>=saved.updatedAt);assertTag(clean);assert.equal(text(await disk(name)),text(saved.bytes));assert.equal((await(await active()).evaluate(()=>window.jueonyEditor.state())).dirty,false);await writeFile(resolve(out,'recovered-saved-'+format+'.'+format),new Uint8Array(await disk(name)));});
 }
 await scenario('corrupted bytes, rebound metadata and future tags isolate without deleting drafts',async()=>{
  await page.evaluate(async()=>{
   const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('jueony-workspaces',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});try{
    const values=await new Promise((resolve,reject)=>{const r=db.transaction('documents').objectStore('documents').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);}),base=values.find(d=>d.name==='crash-integrity-hwpx.hwpx');if(!base?.integrity)throw new Error('Missing sealed source');
    const bad=structuredClone(base);bad.id='integrity-corrupt';bad.name='corrupt-bytes.hwpx';
    const prefix=new TextEncoder().encode(JSON.stringify(['jueony-recovery',1,bad.id,bad.workspaceId,bad.name,bad.dirty,bad.updatedAt,bad.bytes.length])),payload=new Uint8Array(prefix.length+bad.bytes.length);payload.set(prefix);payload.set(bad.bytes,prefix.length);bad.integrity.value=[...new Uint8Array(await crypto.subtle.digest('SHA-256',payload))].map(b=>b.toString(16).padStart(2,'0')).join('');bad.bytes[bad.bytes.length-1]^=1;
    const meta=structuredClone(base);meta.id='integrity-metadata';meta.name='metadata-mismatch.hwpx';const future=structuredClone(base);future.id='integrity-future';future.integrity.version=2;
    const legacy=structuredClone(base);legacy.id='integrity-legacy';legacy.name='legacy-unsealed.hwpx';legacy.dirty=true;delete legacy.integrity;delete legacy.fileConnection;
    await new Promise((resolve,reject)=>{const tx=db.transaction('documents','readwrite');for(const d of [bad,meta,future,legacy])tx.objectStore('documents').put(d);tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(tx.error);});
   }finally{db.close();}
  });
  const ids=['integrity-corrupt','integrity-metadata','integrity-future'],invalid=(await records()).filter(d=>ids.includes(d.id));await page.reload();await ready();assert.match(await page.$eval('#app-status',e=>e.textContent),/일부 문서 복원 실패/);const tabs=await page.$$eval('.document-tab',es=>es.map(e=>e.textContent));assert.equal(tabs.length,2);assert.ok(tabs.includes('legacy-unsealed.hwpx'));assert.equal(tabs.some(t=>/metadata-mismatch|corrupt-bytes/.test(t)),false);assert.deepEqual((await records()).filter(d=>ids.includes(d.id)),invalid);observations.push({kind:'isolated-damage',invalidIds:ids,recordsRetained:true,healthyAndLegacyOpened:true});
 });
 await scenario('legacy restored draft gains checksum on next real automatic checkpoint',async()=>{await page.evaluate(()=>[...document.querySelectorAll('.document-tab')].find(e=>e.textContent==='legacy-unsealed.hwpx').click());await services();await edit('LEGACY UPGRADE ');const upgraded=await waitRecord('legacy-unsealed.hwpx',d=>Boolean(d.integrity)&&text(d.bytes).startsWith('LEGACY UPGRADE '));assertTag(upgraded);assert.equal(await(await active()).evaluate(()=>window.jueonyEditor.fileHandle()),null);observations.push({kind:'legacy-upgraded',id:upgraded.id,sha256:hash(upgraded.bytes)});});
 assert.deepEqual(pageErrors,[]);assert.deepEqual(consoleErrors,[]);assert.deepEqual(externalRequests,[]);
}finally{await writeFile(resolve(out,'result.json'),JSON.stringify({results,failures,pageErrors,consoleErrors,externalRequests,observations,build,engine,scope:'Owned isolated Edge persistent profile and synthetic OPFS files. Browser.crash affects only the test browser. Checksums detect accidental damage, not malicious tampering. Legacy unsealed records accepted. No Hancom, Windows picker/ACL, OS power loss or paid model calls.'},null,2));await browser?.close();server.kill();}
if(failures.length)process.exitCode=1;
