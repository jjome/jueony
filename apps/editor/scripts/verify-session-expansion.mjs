import puppeteer from 'puppeteer-core';
import {spawn,execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';

const app=resolve(dirname(fileURLToPath(import.meta.url)),'..'),repo=resolve(app,'../..');
const pkg=resolve(repo,process.env.JUEONY_ENGINE_PACKAGE??'apps/editor/node_modules/@rhwp/core');
const dist=resolve(app,process.env.JUEONY_TEST_DIST??'evidence/dist-features');
const out=resolve(repo,process.env.JUEONY_TEST_OUTPUT??'docs/evidence/session-expansion-2026-10-13/browser');
const port=4214,origin=`http://127.0.0.1:${port}`;
const {default:init,HwpDocument}=await import(pathToFileURL(resolve(pkg,'rhwp.js')).href);
await init({module_or_path:await readFile(resolve(pkg,'rhwp_bg.wasm'))});await mkdir(out,{recursive:true});
if(await fetch(origin+'/api/health').then(()=>true,()=>false))throw new Error(`Test port ${port} is already occupied`);
const server=spawn(process.execPath,['apps/launcher/server.mjs'],{cwd:repo,windowsHide:true,stdio:'ignore',env:{...process.env,JUEONY_PORT:String(port),JUEONY_DIST:dist,JUEONY_CONNECTION_STORE:'memory'}});
const results=[],failures=[],pageErrors=[],consoleErrors=[],externalRequests=[],dialogs=[];
let browser,page;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const parse=value=>typeof value==='string'?JSON.parse(value):value;
const ready=()=>page.waitForFunction(()=>document.getElementById('app-status')?.textContent.includes('준비 완료'),{timeout:90000});
const active=async()=>await(await page.$('.editor-frame:not([hidden])')).contentFrame();
async function services(){
 const frame=await active();await frame.evaluate(()=>{
  if(window.__sessionExpansionServices)return;
  // Isolated test extension uses the documented registry, never production debug exports.
  const automation=window.rhwpStudio.automation;
  automation.registerCommand({id:'ext:session-expansion-test',label:'상태 검수',canExecute:()=>true,execute:s=>{window.__sessionExpansionServices=s;}});
  const result=automation.execute('ext:session-expansion-test');automation.unregisterCommand('ext:session-expansion-test');
  if(!result.ok||!window.__sessionExpansionServices)throw new Error('test extension unavailable');
 });return frame;
}
async function openBytes(bytes,name){
 const frame=await services();await frame.evaluate(async(bytes,name)=>{
  const root=await navigator.storage.getDirectory(),handle=await root.getFileHandle(name,{create:true}),writer=await handle.createWritable();
  await writer.write(new Uint8Array(bytes));await writer.close();await window.jueonyEditor.open(new Uint8Array(bytes),name,handle,false);
  const s=window.__sessionExpansionServices,ih=s.getInputHandler(),c=ih.cursor;
  c.exitHeaderFooterMode();c.exitFootnoteMode();c.clearSelection();c.exitCellSelectionMode();c.exitTableObjectSelection();c.exitPictureObjectSelection();
  c.moveTo({sectionIndex:0,paragraphIndex:0,charOffset:0});ih.updateCaret();s.eventBus.emit('command-state-changed');
 },[...bytes],name);
 // Checkpoint the real open file before setting a view. A direct test API open
 // alone does not replace the shell's old blank recovery record.
 await page.click('#save-document');await page.waitForFunction(()=>document.getElementById('app-status')?.textContent==='파일에 저장했습니다.');
 return frame;
}
async function state(){return (await services()).evaluate(async()=>{
 const api=window.jueonyEditor,s=window.__sessionExpansionServices,c=s.getInputHandler().cursor;
 const bytes=s.wasm.exportHwpx(),digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
 const ih=s.getInputHandler();
 return {view:api.captureDocumentView(),dirty:api.state().dirty,revision:api.revision(),digest,position:c.getPosition(),picture:c.getSelectedPictureRef(),block:c.captureCellSelection(),
  keyboard:{active:ih.active,composing:ih.isComposing,form:ih.isFormMode(),requiresPassword:s.wasm.requiresPasswordForSave,context:window.rhwpStudio.automation.getContext(),literalEnabled:window.rhwpStudio.automation.isEnabled('ext:jueony-literal-table-tab'),hint:document.getElementById('jueony-key-hint')?.textContent,focused:document.activeElement?.getAttribute('aria-label')},
  header:c.headerFooterMode,note:c.isInFootnote(),noteRange:c.getFootnoteSelection(),headerRange:c.getHeaderFooterSelectionOrdered(),range:c.getSelection()};
 });}
async function settledState(){await delay(300);return state();}
async function storedViews(){return page.evaluate(async()=>{
 const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('jueony-workspaces',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 const rows=await new Promise((resolve,reject)=>{const r=db.transaction('documents').objectStore('documents').getAll();r.onsuccess=()=>resolve(r.result.map(d=>({name:d.name,view:d.view,dirty:d.dirty})));r.onerror=()=>reject(r.error);});db.close();return rows;
 });}
async function checkpointAndReload(saved,label){
 assert.ok(saved.view.cursor,`${label}: no supported cursor bookmark`);assert.equal(saved.dirty,false);
 await delay(2200);const persisted=await storedViews();
 assert.ok(persisted.some(row=>JSON.stringify(row.view?.cursor)===JSON.stringify(saved.view.cursor)),`${label}: missing persistent bookmark ${JSON.stringify(persisted)}`);
 await page.reload();await ready();const frame=await services();
 // captureDocumentView can return a deferred bookmark before cursor restoration.
 // Wait on the real engine cursor/mode, then check the stored view separately.
 await frame.waitForFunction(saved=>{
  const c=window.__sessionExpansionServices.getInputHandler().cursor,kind=saved.view.cursor.kind;
  const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
  const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
  if(kind==='picture-object')return c.isInPictureObjectSelection()&&c.getSelectedPictureRef()?.ci===saved.picture.ci;
  if(kind==='header-footer')return c.headerFooterMode===saved.header&&c.hfParaIdx===saved.view.cursor.caret.paragraph&&c.hfCharOffset===saved.view.cursor.caret.offset;
  if(kind==='footnote')return c.isInFootnote()&&c.fnParaIdx===saved.view.cursor.parentParagraph&&c.fnControlIdx===saved.view.cursor.control&&c.fnInnerParaIdx===saved.view.cursor.caret.paragraph&&c.fnCharOffset===saved.view.cursor.caret.offset;
  if(kind==='cells')return same(c.captureCellSelection(),saved.block);
  return same(c.getPosition(),saved.position)&&same(c.getSelection(),saved.range);
 },{timeout:20000},saved);
 const actual=await settledState();await writeFile(resolve(out,`${label}-observation.json`),JSON.stringify({saved,persisted,actual},null,2));assert.deepEqual(actual.view.cursor,saved.view.cursor,`${label}: restart changed cursor`);
 for(const key of ['position','picture','block','header','note','noteRange','headerRange','range'])assert.deepEqual(actual[key],saved[key],`${label}: real ${key} was not restored`);
 assert.ok(Math.abs(actual.view.scrollY-saved.view.scrollY)<=1,`${label}: vertical viewport changed ${saved.view.scrollY} -> ${actual.view.scrollY}`);assert.ok(Math.abs(actual.view.scrollX-saved.view.scrollX)<=1,`${label}: horizontal viewport changed`);
 assert.equal(actual.dirty,false,`${label}: restore dirtied file`);assert.equal(actual.digest,saved.digest,`${label}: restore changed bytes`);
 await page.$eval('#request-input',e=>e.focus());const before=await state();await frame.evaluate(view=>window.jueonyEditor.restoreDocumentView(view),saved.view);
 assert.equal(await page.evaluate(()=>document.activeElement.id),'request-input',`${label}: restore stole chat focus`);
 const after=await state();assert.equal(after.revision,before.revision);assert.equal(after.digest,before.digest);assert.equal(after.dirty,false);
 await writeFile(resolve(out,`${label}-restoration.json`),JSON.stringify({saved,persisted,actual,after},null,2));await page.screenshot({path:resolve(out,`${label}.png`)});
 return frame;
}
async function assertStaleRejected(saved,mutate,check,label,args){
 const frame=await services();await frame.evaluate(mutate,args);await page.$eval('#request-input',e=>e.focus());
 const before=await state();await frame.evaluate(view=>window.jueonyEditor.restoreDocumentView(view),saved.view);const after=await state();
 assert.equal(await frame.evaluate(check),true,`${label}: stale bookmark was applied`);assert.equal(after.revision,before.revision);assert.equal(after.digest,before.digest);assert.equal(after.dirty,before.dirty);
 assert.equal(await page.evaluate(()=>document.activeElement.id),'request-input');
 await writeFile(resolve(out,`${label}-stale.json`),JSON.stringify({saved:saved.view,before,after},null,2));
}
async function scenario(name,action){
 if(process.env.JUEONY_TEST_CASE&&!new RegExp(process.env.JUEONY_TEST_CASE).test(name))return;
 try{await action();results.push(name);console.log('PASS',name);}catch(error){
  failures.push({name,error:String(error),stack:error.stack,state:await state().catch(()=>null)});console.error('FAIL',name,error);
  await page.screenshot({path:resolve(out,`failure-${failures.length}.png`)}).catch(()=>{});
 }
}
function imageFixture(){const doc=HwpDocument.createEmpty();try{
 doc.createBlankDocument();doc.insertText(0,0,0,'본문 그림 확인');
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4AWPgmnbnPwAEpgJ8+MzEcgAAAABJRU5ErkJggg==','base64');
 const ref=parse(doc.insertPicture(0,0,1,'',png,7200,7200,1,1,'png','합성 검수'));return {bytes:doc.exportHwpx(),ref};
}finally{doc.free();}}
async function nestedFixture(){const doc=HwpDocument.createEmpty();try{
 doc.createBlankDocument();doc.insertText(0,0,0,'중첩 표 확인');const ref=parse(doc.createTable(0,0,7,2,2));
 doc.insertTextInCell(0,ref.paraIdx,ref.controlIdx,0,0,0,'가😀나다라');doc.insertTextInCell(0,ref.paraIdx,ref.controlIdx,1,0,0,'다른 셀');
 const base=resolve(out,'nested-base.hwpx'),nested=resolve(out,'nested-fixture.hwpx');await writeFile(base,doc.exportHwpx());
 execFileSync(process.env.JUEONY_TEST_PYTHON??'C:/Python314/python.exe',[resolve(app,'scripts/style-reference-fixture.py'),'prepare',base,nested,'0','0'],{windowsHide:true});
 return {bytes:await readFile(nested),ref,path:[{controlIndex:ref.controlIdx,cellIndex:0,cellParaIndex:1},{controlIndex:0,cellIndex:0,cellParaIndex:0}]};
}finally{doc.free();}}
function headerFixture(isHeader){const doc=HwpDocument.createEmpty();try{
 doc.createBlankDocument();doc.insertText(0,0,0,'본문 확인');doc.createHeaderFooter(0,isHeader,2);doc.insertTextInHeaderFooter(0,isHeader,2,0,0,'가😀나다라');return doc.exportHwpx();
}finally{doc.free();}}
function noteFixture(){const doc=HwpDocument.createEmpty();try{
 doc.createBlankDocument();doc.insertText(0,0,0,'본문 각주 확인');const ref=parse(doc.insertFootnote(0,0,1));doc.insertTextInFootnote(0,ref.paraIdx,ref.controlIdx,0,2,'가😀나다라');return {bytes:doc.exportHwpx(),ref};
}finally{doc.free();}}
function bodyFixture(text){const doc=HwpDocument.createEmpty();try{doc.createBlankDocument();doc.insertText(0,0,0,text);return doc.exportHwpx();}finally{doc.free();}}
async function chord(...keys){for(const key of keys.slice(0,-1))await page.keyboard.down(key);await page.keyboard.press(keys.at(-1));for(const key of keys.slice(0,-1).reverse())await page.keyboard.up(key);}
async function createTab(){
 const count=await page.$$eval('.document-tab',nodes=>nodes.length);await page.click('#new-document');await page.waitForFunction(count=>document.querySelectorAll('.document-tab').length>count,{},count);
 const frame=await active();await frame.waitForFunction(()=>Boolean(window.jueonyEditor?.ready));await frame.evaluate(()=>window.jueonyEditor.ready);await delay(200);return services();
}
try{
 for(let n=0;n<100;n++){if(await fetch(origin+'/api/health').then(r=>r.ok,()=>false))break;await delay(100);}
 browser=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--no-first-run','--disable-background-networking'],defaultViewport:{width:1600,height:1000}});
 page=await browser.newPage();page.setDefaultTimeout(15000);page.on('pageerror',error=>pageErrors.push(String(error)));page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});page.on('dialog',dialog=>{dialogs.push({type:dialog.type(),message:dialog.message()});void dialog.accept();});
 await page.setRequestInterception(true);page.on('request',request=>{if(![origin,'data:','blob:'].some(prefix=>request.url().startsWith(prefix))){externalRequests.push(request.url());void request.abort();}else void request.continue();});
 await page.goto(origin);await ready();
 const nested=await nestedFixture();
 for(const selected of [false,true])await scenario(`nested cell ${selected?'backward range':'caret'} persists actual workspace restart and refuses changed nested content`,async()=>{
  const frame=await openBytes(nested.bytes,`session-nested-${selected?'range':'caret'}.hwpx`);
  await frame.evaluate(({ref,path,selected})=>{
   const s=window.__sessionExpansionServices,ih=s.getInputHandler(),at=offset=>({sectionIndex:0,parentParaIndex:ref.paraIdx,paragraphIndex:0,controlIndex:ref.controlIdx,cellIndex:0,cellParaIndex:0,charOffset:offset,cellPath:path});
   if(selected){ih.cursor.moveTo(at(4));ih.cursor.setAnchor();}ih.cursor.moveTo(at(1));ih.updateCaret();s.eventBus.emit('command-state-changed');
  },{...nested,bytes:undefined,selected});
  const saved=await settledState();assert.equal(saved.view.cursor?.kind,'text');assert.equal(saved.view.cursor.focus.cellPath.length,2);assert.equal(Boolean(saved.view.cursor.anchor),selected);
  await checkpointAndReload(saved,`nested-${selected?'range':'caret'}`);
  await assertStaleRejected(saved,({ref,path})=>{const ih=window.__sessionExpansionServices.getInputHandler();ih.cursor.clearSelection();ih.cursor.exitCellSelectionMode();ih.cursor.moveTo({sectionIndex:0,paragraphIndex:0,charOffset:0});ih.wasm.insertTextInCellByPath(0,ref.paraIdx,JSON.stringify(path),0,'변경');ih.updateCaret();},()=>window.__sessionExpansionServices.getInputHandler().cursor.getPosition().parentParaIndex===undefined,`nested-${selected?'range':'caret'}`,nested);
 });
 await scenario('nested F5 cell block persists actual restart with the correct table path and rejects changed outer evidence',async()=>{
  const frame=await openBytes(nested.bytes,'session-nested-block.hwpx');
  await frame.evaluate(({ref,path})=>{
   const s=window.__sessionExpansionServices,ih=s.getInputHandler(),c=ih.cursor;
   c.moveTo({sectionIndex:0,parentParaIndex:ref.paraIdx,paragraphIndex:0,controlIndex:ref.controlIdx,cellIndex:0,cellParaIndex:0,charOffset:1,cellPath:path});
   if(!c.restoreCellSelection({sec:0,ppi:ref.paraIdx,ci:ref.controlIdx,cellPath:path,anchor:{row:0,col:0},focus:{row:1,col:1},phase:2,reason:'manual',excluded:['1,0']}))throw new Error('nested block creation failed');
   ih.updateCaret();s.eventBus.emit('command-state-changed');
  },nested);
  const saved=await settledState();assert.equal(saved.view.cursor?.kind,'cells');await checkpointAndReload(saved,'nested-block');
  await assertStaleRejected(saved,({ref})=>{const ih=window.__sessionExpansionServices.getInputHandler();ih.cursor.exitCellSelectionMode();ih.cursor.clearSelection();ih.wasm.insertTextInCell(0,ref.paraIdx,ref.controlIdx,1,0,0,'변경');ih.cursor.moveTo({sectionIndex:0,paragraphIndex:0,charOffset:0});ih.updateCaret();},()=>window.__sessionExpansionServices.getInputHandler().cursor.captureCellSelection()===null,'nested-block',nested);
 });
 await scenario('embedded image object selection persists actual restart and rejects changed picture properties',async()=>{
  const image=imageFixture(),frame=await openBytes(image.bytes,'session-picture.hwpx');
  await frame.evaluate(ref=>{const s=window.__sessionExpansionServices,ih=s.getInputHandler();ih.cursor.enterPictureObjectSelectionDirect(0,ref.paraIdx,ref.controlIdx,'image');ih.updateCaret();s.eventBus.emit('picture-object-selection-changed',true);s.eventBus.emit('command-state-changed');},image.ref);
  const saved=await settledState();assert.equal(saved.view.cursor?.kind,'picture-object');await checkpointAndReload(saved,'picture');
  await assertStaleRejected(saved,ref=>{const ih=window.__sessionExpansionServices.getInputHandler();ih.cursor.exitPictureObjectSelection();ih.cursor.moveTo({sectionIndex:0,paragraphIndex:0,charOffset:0});ih.wasm.borrowDocumentHandle().setPictureProperties(0,ref.paraIdx,ref.controlIdx,JSON.stringify({width:14400}));ih.updateCaret();},()=>!window.__sessionExpansionServices.getInputHandler().cursor.isInPictureObjectSelection(),'picture',image.ref);
 });
 for(const isHeader of [true,false])await scenario(`${isHeader?'header':'footer'} backwards selection persists target and body return across workspace restart`,async()=>{
  const label=isHeader?'header':'footer',frame=await openBytes(headerFixture(isHeader),`session-${label}.hwpx`);
  await frame.evaluate(isHeader=>{
   const s=window.__sessionExpansionServices,ih=s.getInputHandler(),c=ih.cursor;c.moveTo({sectionIndex:0,paragraphIndex:0,charOffset:2});c.enterHeaderFooterMode(isHeader,0,2);
   const at=offset=>({sectionIdx:0,isHeader,applyTo:2,paraIdx:0,charOffset:offset});if(!c.selectHeaderFooterRange(at(4),at(1),c.hfPreviewPage))throw new Error('HF range failed');
   ih.updateCaret();s.eventBus.emit('headerFooterModeChanged',{mode:isHeader?'header':'footer',sectionIdx:0,applyTo:2,previewPage:c.hfPreviewPage});s.eventBus.emit('command-state-changed');
  },isHeader);
  const saved=await settledState();assert.equal(saved.view.cursor?.kind,'header-footer');assert.equal(saved.view.cursor.isHeader,isHeader);assert.equal(saved.view.cursor.anchor.offset,4);
  await checkpointAndReload(saved,label);
  await assertStaleRejected(saved,isHeader=>{const ih=window.__sessionExpansionServices.getInputHandler();ih.cursor.exitHeaderFooterMode();ih.cursor.clearSelection();ih.cursor.moveTo({sectionIndex:0,paragraphIndex:0,charOffset:0});ih.wasm.insertTextInHeaderFooter(0,isHeader,2,0,0,'변경');ih.updateCaret();},()=>!window.__sessionExpansionServices.getInputHandler().cursor.isInHeaderFooter(),label,isHeader);
 });
 await scenario('body footnote backwards selection persists exact note binding and rejects changed story',async()=>{
  const note=noteFixture(),frame=await openBytes(note.bytes,'session-footnote.hwpx');
  await frame.evaluate(ref=>{
   const s=window.__sessionExpansionServices,ih=s.getInputHandler(),c=ih.cursor;c.moveTo({sectionIndex:0,paragraphIndex:0,charOffset:2});c.enterFootnoteMode(0,ref.paraIdx,ref.controlIdx,0,0);
   c.setFnCursorPosition(0,5);c.setFnAnchor();c.setFnCursorPosition(0,3);ih.updateCaret();s.eventBus.emit('footnoteModeChanged',true);s.eventBus.emit('command-state-changed');
   const scroll=document.getElementById('scroll-container');s.getViewportManager()?.setScrollTop(scroll.scrollHeight-scroll.clientHeight);
  },note.ref);
  const saved=await settledState();assert.equal(saved.view.cursor?.kind,'footnote');assert.equal(saved.view.cursor.anchor.offset,5);await checkpointAndReload(saved,'footnote');
  await assertStaleRejected(saved,ref=>{const ih=window.__sessionExpansionServices.getInputHandler();ih.cursor.exitFootnoteMode();ih.cursor.clearSelection();ih.cursor.moveTo({sectionIndex:0,paragraphIndex:0,charOffset:0});ih.wasm.insertTextInFootnote(0,ref.paraIdx,ref.controlIdx,0,2,'변경');ih.updateCaret();},()=>!window.__sessionExpansionServices.getInputHandler().cursor.isInFootnote(),'footnote',note.ref);
 });
 await scenario('trusted Ctrl+Tab and Ctrl+Shift+Tab cycle document tabs, wrap and preserve each body cursor without editing',async()=>{
  let frame=await openBytes(bodyFixture('첫째 문서 본문'),'session-tab-first.hwpx');
  await frame.evaluate(()=>{const ih=window.__sessionExpansionServices.getInputHandler();ih.cursor.moveTo({sectionIndex:0,paragraphIndex:0,charOffset:2});ih.updateCaret();});
  const first=await settledState();await createTab();frame=await openBytes(bodyFixture('둘째 문서 본문'),'session-tab-second.hwpx');
  await frame.evaluate(()=>{const ih=window.__sessionExpansionServices.getInputHandler();ih.cursor.moveTo({sectionIndex:0,paragraphIndex:0,charOffset:3});ih.updateCaret();ih.focus();});
  const second=await settledState();await chord('Control','Tab');
  await page.waitForFunction(()=>document.getElementById('active-document-name').textContent==='session-tab-first.hwpx');frame=await services();
  assert.deepEqual((await settledState()).view.cursor,first.view.cursor);assert.equal((await state()).digest,first.digest);assert.equal((await state()).dirty,false);
  await chord('Control','Shift','Tab');await page.waitForFunction(()=>document.getElementById('active-document-name').textContent==='session-tab-second.hwpx');frame=await services();
  assert.deepEqual((await settledState()).view.cursor,second.view.cursor);assert.equal((await state()).digest,second.digest);assert.equal((await state()).dirty,false);
  await chord('Control','Shift','Tab');await page.waitForFunction(()=>document.getElementById('active-document-name').textContent==='session-tab-first.hwpx');
  assert.deepEqual((await settledState()).view.cursor,first.view.cursor);
  frame=await services();const before=await state();await frame.evaluate(()=>{
   const input=document.querySelector('textarea[aria-label="문서 편집 입력"]');
   // Observe the host hotkey's window capture guard; keep this artificial event
   // from exercising unrelated engine text-input handlers afterward.
   input.addEventListener('keydown',event=>event.stopImmediatePropagation(),{capture:true,once:true});
   input.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',code:'Tab',ctrlKey:true,bubbles:true,cancelable:true}));
  });
  assert.equal(await page.$eval('#active-document-name',e=>e.textContent),'session-tab-first.hwpx','untrusted event changed tab');assert.equal((await state()).digest,before.digest);
  await writeFile(resolve(out,'document-cycle.json'),JSON.stringify({first,second,after:await state()},null,2));await page.screenshot({path:resolve(out,'document-cycle.png')});
 });
 await scenario('trusted table Ctrl+Tab inserts a literal tab and table hanging/modal contexts keep the current document tab',async()=>{
  const frame=await openBytes(await readFile(resolve(app,'fixtures/schedule-table.hwpx')),'session-tab-table.hwpx');
  if(await page.$$eval('.document-tab',nodes=>nodes.length)<2){await createTab();await page.click('.document-tab:first-child');await services();}
  let current=await services();await delay(350);await current.evaluate(()=>{const s=window.__sessionExpansionServices,ih=s.getInputHandler();ih.cursor.moveTo({sectionIndex:0,parentParaIndex:1,paragraphIndex:0,controlIndex:0,cellIndex:0,cellParaIndex:0,charOffset:0});ih.updateCaret();ih.focus();s.eventBus.emit('command-state-changed');});
  const text=await current.evaluate(()=>window.__sessionExpansionServices.wasm.getTextInCell(0,1,0,0,0,0,999)),beforeKey=await settledState();await writeFile(resolve(out,'table-tab-before-key.json'),JSON.stringify(beforeKey,null,2));
  assert.equal(beforeKey.position.parentParaIndex,1,'fixture cursor was overwritten before the key');assert.equal(beforeKey.keyboard.context.inTable,true);assert.equal(beforeKey.keyboard.literalEnabled,true,JSON.stringify(beforeKey.keyboard));
  await chord('Control','Tab');await writeFile(resolve(out,'table-tab-after-key.json'),JSON.stringify(await state(),null,2));
  assert.equal(await page.$eval('#active-document-name',e=>e.textContent),'session-tab-table.hwpx');assert.equal(await current.evaluate(()=>window.__sessionExpansionServices.wasm.getTextInCell(0,1,0,0,0,0,999)),'\t'+text);
  await current.evaluate(()=>window.jueonyEditor.executeCommand('edit:undo'));
  await current.evaluate(()=>{const ih=window.__sessionExpansionServices.getInputHandler();ih.cursor.moveTo({...ih.cursor.getPosition(),charOffset:0});ih.updateCaret();ih.focus();});await chord('Control','Shift','Tab');
  assert.equal(await page.$eval('#active-document-name',e=>e.textContent),'session-tab-table.hwpx');
  await current.evaluate(()=>{const ih=window.__sessionExpansionServices.getInputHandler();ih.cursor.exitCellSelectionMode();ih.cursor.clearSelection();ih.cursor.moveTo({sectionIndex:0,paragraphIndex:0,charOffset:0});ih.updateCaret();ih.focus();});
  await chord('F6');await current.waitForSelector('.modal-overlay');await chord('Control','Tab');assert.equal(await page.$eval('#active-document-name',e=>e.textContent),'session-tab-table.hwpx');await page.keyboard.press('Escape');await current.waitForSelector('.modal-overlay',{hidden:true});
  await page.$eval('#request-input',e=>e.focus());await chord('Control','Tab');assert.equal(await page.$eval('#active-document-name',e=>e.textContent),'session-tab-table.hwpx');
  await writeFile(resolve(out,'document-cycle-guards.json'),JSON.stringify({text,after:await state()},null,2));
 });
 if(pageErrors.length)failures.push({name:'page errors',errors:pageErrors});if(consoleErrors.length)failures.push({name:'console errors',errors:consoleErrors});if(externalRequests.length)failures.push({name:'offline assets',externalRequests});
 await writeFile(resolve(out,'result.json'),JSON.stringify({results,failures,pageErrors,consoleErrors,externalRequests,dialogs,build:await page.evaluate(()=>fetch('/build-evidence.json').then(r=>r.json())),note:'Headless Edge isolated profile; actual workspace IndexedDB/OPFS restart. Synthetic fixtures, test-only automation extension. No native Hancom parity assertion.'},null,2));if(failures.length)process.exitCode=1;
}catch(error){console.error(error);process.exitCode=1;await page?.screenshot({path:resolve(out,'fatal.png')}).catch(()=>{});await writeFile(resolve(out,'fatal.json'),JSON.stringify({error:String(error),stack:error.stack,results,failures,pageErrors,consoleErrors,externalRequests},null,2));}
finally{await browser?.close();server.kill();}
