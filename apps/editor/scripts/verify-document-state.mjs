import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';

// Standalone isolated integration check: it never reuses the user's browser,
// live launcher ports, workspace database, source files, or provider credentials.
const editor=fileURLToPath(new URL('../',import.meta.url)),root=resolve(editor,'../..');
const out=resolve(root,'docs/evidence/continuation-2026-10-11/state');
const dist=resolve(process.env.JUEONY_TEST_DIST??join(editor,'evidence/dist-continuation'));
const origin='http://127.0.0.1:4205',profile=await mkdtemp(join(tmpdir(),'jueony-document-state-'));
await mkdir(out,{recursive:true});
if(await fetch(origin).then(()=>true,()=>false))throw new Error('Isolated test port 4205 is already occupied');
const server=spawn(process.execPath,['apps/launcher/server.mjs'],{cwd:root,windowsHide:true,env:{...process.env,JUEONY_PORT:'4205',JUEONY_DIST:dist,JUEONY_CONNECTION_STORE:'memory'},stdio:'ignore'});
const results=[],errors=[],externalRequests=[];let browser,page,stage='startup',build,promptReply;
const pass=(name,detail)=>{results.push({name,...(detail?{detail}:{})});console.log('PASS',name);};
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const ready=async()=>{await page.waitForFunction(()=>document.getElementById('app-status')?.textContent.includes('준비 완료'),{timeout:90000});await activeReady();};
const active=async()=>{const handle=await page.$('.editor-frame:not([hidden])');assert.ok(handle,'active iframe');return handle.contentFrame();};
const activeReady=async()=>{const f=await active();await f.waitForFunction(()=>document.documentElement.dataset.unifiedChrome==='true'&&window.jueonyEditor?.snapshot&&window.jueonyEditor?.captureDocumentView&&!window.jueonyEditor.busy(),{timeout:60000});return f;};
const db=()=>page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('jueony-workspaces');r.onsuccess=()=>{const d=r.result,t=d.transaction(['state','documents']),s=t.objectStore('state').get('current'),a=t.objectStore('documents').getAll();t.oncomplete=()=>{resolve({state:s.result,documents:a.result.map(v=>({...v,bytes:undefined}))});d.close();};t.onerror=()=>reject(t.error);};r.onerror=()=>reject(r.error);}));
const structure=f=>f.evaluate(()=>window.jueonyEditor.snapshot().structure);
const view=f=>f.evaluate(()=>window.jueonyEditor.captureDocumentView());
const mm=value=>Math.round(value*7200/25.4);
async function tab(index){const buttons=await page.$$('.document-tab');await buttons[index].click();return activeReady();}
async function waitStored(predicate,description){for(let n=0;n<100;n++){const value=await db();if(predicate(value))return value;await pause(100);}throw new Error('Persistence timeout: '+description);}
async function setZoom(percent){
 const f=await activeReady();await f.click('#sb-zoom-display');await f.waitForSelector('.zoom-dialog');
 const preset=await f.$(`.zoom-dialog input[name="zoom-choice"][value="preset:${percent}"]`);
 if(preset)await preset.click();else{await f.click('.zoom-dialog input[name="zoom-choice"][value="custom"]');const input=await f.$('.zoom-dialog input[aria-describedby="zoom-dialog-custom-error"]');await input.click();await page.keyboard.down('Control');await page.keyboard.press('KeyA');await page.keyboard.up('Control');await page.keyboard.press('Backspace');await input.type(String(percent));}
 await f.click('.zoom-dialog .dialog-btn-primary');await f.waitForFunction(percent=>Math.abs((window.jueonyEditor.captureDocumentView()?.zoom??0)-percent/100)<1e-6,{timeout:10000},percent);
 assert.equal((await view(f)).fitMode,'none');return f;
}
async function fill(selector,value){const input=await page.$(selector);assert.ok(input,selector);await input.click();await page.keyboard.down('Control');await page.keyboard.press('KeyA');await page.keyboard.up('Control');await page.keyboard.press('Backspace');await input.type(String(value));}
try{
 for(let n=0;n<100;n++){if(server.exitCode!==null)throw new Error('Isolated server exited');if(await fetch(origin+'/api/health').then(r=>r.ok,()=>false))break;await pause(100);}
 browser=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,userDataDir:profile,args:['--no-first-run','--disable-background-networking'],defaultViewport:{width:1600,height:1100}});
 page=await browser.newPage();page.on('pageerror',e=>errors.push(String(e)));page.on('dialog',d=>d.accept(d.type()==='prompt'?promptReply:undefined));
 await page.setRequestInterception(true);page.on('request',request=>{if(/^https?:/.test(request.url())&&!request.url().startsWith(origin+'/')){externalRequests.push(request.url());void request.abort();}else void request.continue();});
 await page.goto(origin+'/?storage=download');await ready();build=await page.evaluate(()=>fetch('/build-evidence.json').then(r=>r.json()));
 let first=await activeReady();const original=await structure(first);const beforeRevision=await first.evaluate(()=>window.jueonyEditor.state().revision);
 assert.equal(original.sections[0].page.landscape,false);assert.equal(original.paragraphs[0].characters.fontSize,1000);
 pass('first unconfigured document retains existing engine defaults');
 stage='new-document defaults UI';
 await page.click('#document-defaults');await page.click('#defaults-enabled');await page.select('#defaults-landscape','true');
 await fill('[data-default-field="marginLeftMm"]',22);await fill('[data-default-field="marginRightMm"]',18);await fill('[data-default-font="family"]','맑은 고딕');await fill('[data-default-font="sizePt"]',13);
 await page.click('#defaults-form button[type="submit"]');await page.waitForFunction(()=>!document.getElementById('defaults-dialog').open);
 assert.deepEqual(await structure(first),original);assert.equal(await first.evaluate(()=>window.jueonyEditor.state().revision),beforeRevision);
 pass('saving new-document settings does not mutate the existing document or revision');
 await page.click('#new-document');await page.waitForFunction(()=>document.querySelectorAll('.editor-frame').length===2);let second=await activeReady();
 const custom=await structure(second),paper=custom.sections[0].page;
 assert.equal(paper.width,mm(210));assert.equal(paper.height,mm(297));assert.equal(paper.landscape,true);assert.equal(paper.marginLeft,mm(22));assert.equal(paper.marginRight,mm(18));
 assert.equal(custom.paragraphs[0].characters.fontFamily,'맑은 고딕');assert.equal(custom.paragraphs[0].characters.fontSize,1300);
 pass('new blank document uses stored landscape, margins and real engine font properties',{page:paper,font:custom.paragraphs[0].characters});
 stage='document-specific numeric zoom';
 first=await tab(0);await setZoom(125);
 await first.evaluate(()=>{document.getElementById('scroll-container').scrollTop=210;});await pause(250);const firstView=await view(first);assert.ok(firstView.scrollY>0,'first document can scroll');
 second=await tab(1);await setZoom(80);const secondView=await view(second);
 first=await tab(0);assert.equal((await view(first)).zoom,1.25);assert.equal((await view(first)).fitMode,'none');await first.waitForFunction(expected=>document.getElementById('scroll-container').scrollTop===expected,{timeout:5000},firstView.scrollY);assert.equal((await view(first)).scrollY,firstView.scrollY);
 second=await tab(1);assert.equal((await view(second)).zoom,.8);assert.equal((await view(second)).fitMode,'none');
 const saved=await waitStored(v=>v.documents.length===2&&v.documents.some(d=>d.view?.zoom===1.25)&&v.documents.some(d=>d.view?.zoom===.8),'two distinct numeric zoom values');const order=saved.state.workspaces[0].documentOrder;
 assert.equal(saved.documents.find(d=>d.id===order[0]).view.scrollY,firstView.scrollY);
 pass('two same-name tabs keep independent numeric zoom and scroll checkpoints',{first:firstView,second:secondView});
 stage='reload views and panels';
 await page.click('#toggle-sidebar');await page.click('#focus-mode');await waitStored(v=>v.state.sidebarHidden===true&&v.state.focusMode===true,'focus mode and sidebar');
 await page.reload();await ready();
 assert.equal(await page.$eval('#app-shell',e=>e.classList.contains('focus-mode')&&e.classList.contains('sidebar-hidden')),true);
 assert.equal(await page.$eval('#focus-mode',e=>e.getAttribute('aria-pressed')),'true');assert.equal(await page.$eval('#chat-panel',e=>getComputedStyle(e).visibility),'hidden');
 pass('focus mode and prior sidebar visibility restore after reload');
 second=await activeReady();assert.equal((await view(second)).zoom,.8);assert.deepEqual(await structure(second),custom);
 first=await tab(0);assert.equal((await view(first)).zoom,1.25);await first.waitForFunction(expected=>document.getElementById('scroll-container').scrollTop===expected,{timeout:5000},firstView.scrollY);assert.equal((await view(first)).scrollY,firstView.scrollY);assert.deepEqual(await structure(first),original);
 pass('reload restores document-specific numeric zoom and preserves old/new page and font data');
 await page.click('#focus-mode');assert.equal(await page.$eval('#chat-panel',e=>getComputedStyle(e).visibility),'visible');assert.equal(await page.$eval('#sidebar',e=>getComputedStyle(e).visibility),'hidden');
 await page.click('#toggle-sidebar');assert.equal(await page.$eval('#sidebar',e=>getComputedStyle(e).visibility),'visible');
 await page.click('#document-defaults');assert.equal(await page.$eval('#defaults-enabled',e=>e.checked),true);assert.equal(await page.$eval('[data-default-font="family"]',e=>e.value),'맑은 고딕');await page.click('#close-defaults');
 pass('leaving focus mode restores panels; new-document settings remain editable after restart');
 stage='existing-file open and fit rule';
 // Browser file chooser fallback uses actual fixture bytes, never user files.
 await page.evaluate(()=>{window.showOpenFilePicker=undefined;});
 const chooserPromise=page.waitForFileChooser();await page.click('#open-document');const chooser=await chooserPromise;await chooser.accept([resolve(editor,'fixtures/three-paragraphs.hwpx')]);
 await page.waitForFunction(()=>document.querySelectorAll('.editor-frame').length===3);let existing=await activeReady();await existing.waitForFunction(()=>window.jueonyEditor.state().name==='three-paragraphs.hwpx');
 const existingStructure=await structure(existing);assert.equal(existingStructure.sections[0].page.landscape,false);assert.notEqual(existingStructure.paragraphs[0].characters.fontSize,1300);
 assert.match(existing.url(),/skipDefaults=1/);pass('opening an existing HWPX skips custom blank-document defaults');
 await existing.click('#sb-zoom-fit-width');await existing.waitForFunction(()=>window.jueonyEditor.captureDocumentView()?.fitMode==='fitWidth');
 const fitBefore=await view(existing);
 first=await tab(0);assert.equal((await view(first)).zoom,1.25);assert.equal((await view(first)).fitMode,'none');await first.waitForFunction(expected=>document.getElementById('scroll-container').scrollTop===expected,{timeout:5000},firstView.scrollY);assert.equal((await view(first)).scrollY,firstView.scrollY);existing=await tab(2);
 await waitStored(v=>v.documents.length===3&&v.documents.some(d=>d.name==='three-paragraphs.hwpx'&&d.view?.fitMode==='fitWidth'),'existing file fit rule');
 await page.setViewport({width:1400,height:1000});await page.reload();await ready();existing=await activeReady();const fitAfter=await view(existing);
 assert.equal(fitAfter.fitMode,'fitWidth');assert.notEqual(fitAfter.zoom,fitBefore.zoom);assert.deepEqual(await structure(existing),existingStructure);
 first=await tab(0);assert.equal((await view(first)).zoom,1.25);second=await tab(1);assert.equal((await view(second)).zoom,.8);existing=await tab(2);
 pass('fit width recalculates after viewport change and reload without replacing numeric zoom in other documents',{before:fitBefore,after:fitAfter});
 stage='explicit defaults reset';await page.click('#document-defaults');await page.click('#reset-defaults');assert.equal(await page.$eval('#defaults-enabled',e=>e.checked),false);await page.click('#close-defaults');
 assert.deepEqual(await structure(existing),existingStructure);await page.click('#new-document');await page.waitForFunction(()=>document.querySelectorAll('.editor-frame').length===4);const reset=await structure(await activeReady());assert.deepEqual(reset,original);
 pass('explicit defaults reset affects only later new documents');
 stage='corrupt defaults with recovered documents';
 await waitStored(v=>v.documents.length===4,'four document checkpoints');
 const corruptDefaults='{"version":999,"sentinel":"keep-until-explicit-reset"}';
 await page.evaluate(raw=>localStorage.setItem('jueony-document-defaults',raw),corruptDefaults);await page.reload();await ready();
 assert.equal(await page.evaluate(()=>localStorage.getItem('jueony-document-defaults')),corruptDefaults);
 second=await tab(1);assert.deepEqual(await structure(second),custom);
 pass('future-version defaults remain untouched and do not block recovered document contents');
 await page.click('#document-defaults');assert.match(await page.$eval('#defaults-error',e=>e.textContent),/지원하지 않는/);
 assert.equal(await page.evaluate(()=>localStorage.getItem('jueony-document-defaults')),corruptDefaults);
 await page.click('#reset-defaults');assert.equal(await page.evaluate(()=>localStorage.getItem('jueony-document-defaults')),null);await page.click('#close-defaults');
 await page.click('#new-document');await page.waitForFunction(()=>document.querySelectorAll('.editor-frame').length===5);assert.deepEqual(await structure(await activeReady()),original);
 pass('corrupt-defaults dialog offers an explicit reset and the next document opens normally');
 stage='workspace switch keeps document view';
 first=await tab(0);await first.waitForFunction(expected=>document.getElementById('scroll-container').scrollTop===expected,{timeout:5000},firstView.scrollY);
 promptReply='다른 업무 상태 검사';await page.click('#add-workspace');await page.waitForFunction(()=>document.querySelectorAll('.editor-frame').length===6);await activeReady();promptReply=undefined;
 await setZoom(90);const otherState=await waitStored(v=>v.state.workspaces.length===2&&v.documents.some(d=>d.view?.zoom===.9),'other workspace view');const otherId=otherState.state.activeWorkspaceId;
 assert.notEqual(otherId,saved.state.activeWorkspaceId);
 await page.select('#workspace-select',saved.state.activeWorkspaceId);await waitStored(v=>v.state.activeWorkspaceId===saved.state.activeWorkspaceId,'return to first workspace');first=await activeReady();
 await first.waitForFunction(expected=>document.getElementById('scroll-container').scrollTop===expected,{timeout:5000},firstView.scrollY);assert.equal((await view(first)).zoom,1.25);
 await page.reload();await ready();first=await activeReady();await first.waitForFunction(expected=>document.getElementById('scroll-container').scrollTop===expected,{timeout:5000},firstView.scrollY);assert.equal((await view(first)).zoom,1.25);
 await page.select('#workspace-select',otherId);await waitStored(v=>v.state.activeWorkspaceId===otherId,'other workspace after restart');assert.equal((await view(await activeReady())).zoom,.9);
 await page.select('#workspace-select',saved.state.activeWorkspaceId);await waitStored(v=>v.state.activeWorkspaceId===saved.state.activeWorkspaceId,'final workspace');
 pass('workspace switching and restarting preserve each workspace document zoom and actual scroll');
 stage='corrupt defaults on a new profile';
 const freshContext=await browser.createBrowserContext(),fresh=await freshContext.newPage();
 await fresh.goto(origin+'/favicon.ico');await fresh.evaluate(()=>localStorage.setItem('jueony-document-defaults','{"version":999,"sentinel":"fresh-profile"}'));
 await fresh.goto(origin+'/');await fresh.waitForFunction(()=>document.getElementById('app-status')?.textContent.includes('새 문서 기본값'),{timeout:10000});
 assert.equal(await fresh.$eval('#app-shell',e=>e.inert),true);
 assert.equal(await fresh.evaluate(()=>JSON.parse(localStorage.getItem('jueony-document-defaults')).sentinel),'fresh-profile');
 await fresh.click('#document-defaults');await fresh.waitForFunction(()=>document.getElementById('defaults-dialog').open);await fresh.click('#reset-defaults');await fresh.click('#close-defaults');
 await fresh.reload();await fresh.waitForFunction(()=>document.getElementById('app-status')?.textContent.includes('준비 완료'),{timeout:60000});
 assert.equal(await fresh.$eval('#app-shell',e=>e.inert),false);await freshContext.close();
 pass('fresh profile with corrupt defaults reports the cause promptly and recovers after explicit reset and reload');
 assert.deepEqual(errors,[]);assert.deepEqual(externalRequests,[]);
 await page.screenshot({path:resolve(out,'document-state.png'),fullPage:true});
 await writeFile(resolve(out,'document-state-result.json'),JSON.stringify({status:'PASS',results,errors,externalRequests,build,profile,limits:['Isolated headless Edge with generated profile and port 4205; native Windows file picker and IME not tested','Document content/font properties inspected from real WASM state; actual installed-font rendering parity not asserted','Hancom 2024 independent comparison BLOCKED_REFERENCE']},null,2));
}catch(error){console.error('FAIL',stage,error);if(page){await page.screenshot({path:resolve(out,'document-state-failure.png'),fullPage:true}).catch(()=>{});await writeFile(resolve(out,'document-state-failure.json'),JSON.stringify({status:'FAIL',stage,error:String(error),results,errors,externalRequests,build,profile,statusMessage:await page.$eval('#app-status',e=>e.textContent).catch(()=>''),frames:await page.$$eval('.editor-frame',els=>els.map(f=>({hidden:f.hidden,url:f.src,state:f.contentWindow.jueonyEditor?.state(),view:f.contentWindow.jueonyEditor?.captureDocumentView?.()}))).catch(()=>[])},null,2));await writeFile(resolve(out,'document-state-result.json'),await readFile(resolve(out,'document-state-failure.json')));}process.exitCode=1;
}finally{await browser?.close();server.kill();}
