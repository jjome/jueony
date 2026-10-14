import puppeteer from 'puppeteer-core';
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';

const app=resolve(dirname(fileURLToPath(import.meta.url)),'..'),repo=resolve(app,'../..');
const enginePkg=process.env.JUEONY_ENGINE_PACKAGE?resolve(repo,process.env.JUEONY_ENGINE_PACKAGE):resolve(app,'node_modules/@rhwp/core');
const {default:init,HwpDocument}=await import(pathToFileURL(resolve(enginePkg,'rhwp.js')).href);
const port=4210,origin=`http://127.0.0.1:${port}`,out=resolve(app,process.env.JUEONY_TEST_OUTPUT??'evidence/parity-features');
const dist=resolve(app,process.env.JUEONY_TEST_DIST??'evidence/dist-features');
await mkdir(out,{recursive:true});
await init({module_or_path:await readFile(resolve(enginePkg,'rhwp_bg.wasm'))});
if(await fetch(origin+'/api/health').then(()=>true,()=>false))throw new Error(`Test port ${port} already occupied`);
const server=spawn(process.execPath,['apps/launcher/server.mjs'],{cwd:repo,windowsHide:true,stdio:'ignore',env:{...process.env,JUEONY_PORT:String(port),JUEONY_DIST:dist,JUEONY_CONNECTION_STORE:'memory'}});
const results=[],failures=[],pageErrors=[],external=[],browserDialogs=[],consoleErrors=[];
let browser,page;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const parse=value=>typeof value==='string'?JSON.parse(value):value;
const fixture=async(name='three-paragraphs.hwpx')=>[...await readFile(resolve(app,'fixtures',name))];
const ready=()=>page.waitForFunction(()=>document.getElementById('app-status')?.textContent.includes('준비 완료'),{timeout:90000});
const active=async()=>await (await page.$('.editor-frame:not([hidden])')).contentFrame();
async function services(){
  const frame=await active();
  await frame.evaluate(()=>{
    if(window.__parityServices)return;
    // Isolated test extension: production debug globals are deliberately unnecessary.
    const automation=window.rhwpStudio.automation;
    automation.registerCommand({id:'ext:parity-inspect',label:'검수',canExecute:()=>true,execute:s=>{window.__parityServices=s;}});
    const result=automation.execute('ext:parity-inspect');
    automation.unregisterCommand('ext:parity-inspect');
    if(!result.ok||!window.__parityServices)throw new Error('test extension unavailable');
  });
  return frame;
}
async function command(id,params){
  const result=await (await active()).evaluate((id,params)=>window.jueonyEditor.executeCommand(id,params),id,params);
  assert.equal(result.ok,true,`${id}: ${JSON.stringify(result)}`);
}
async function chord(...keys){for(const key of keys.slice(0,-1))await page.keyboard.down(key);await page.keyboard.press(keys.at(-1));for(const key of keys.slice(0,-1).reverse())await page.keyboard.up(key);}
async function focusBody(){
  const frame=await services();
  if(await frame.evaluate(()=>window.__parityServices.getInputHandler().cursor.isInHeaderFooter()))await command('page:headerfooter-close');
  await frame.evaluate(()=>{const s=window.__parityServices,ih=s.getInputHandler();ih.cursor.exitCellSelectionMode();ih.cursor.exitTableObjectSelection();ih.cursor.moveTo({sectionIndex:0,paragraphIndex:0,charOffset:0});ih.updateCaret();ih.focus();s.eventBus.emit('command-state-changed');});
}
async function openBytes(bytes,name){
  const frame=await services();
  await frame.evaluate(async(bytes,name)=>{
    const root=await navigator.storage.getDirectory(),handle=await root.getFileHandle(name,{create:true}),writer=await handle.createWritable();
    await writer.write(new Uint8Array(bytes));await writer.close();
    await window.jueonyEditor.open(new Uint8Array(bytes),name,handle,false);
  },bytes,name);
  await focusBody();return frame;
}
async function openFixture(name='three-paragraphs.hwpx'){return openBytes(await fixture(name),'parity-'+name);}
async function snapshot(){return (await active()).evaluate(()=>window.jueonyEditor.snapshot());}
async function nativeHide(){return (await services()).evaluate(()=>{const v=window.__parityServices.wasm.borrowDocumentHandle().getPageHide(0,0);return typeof v==='string'?JSON.parse(v):v;});}
async function header(){return (await services()).evaluate(()=>{const v=window.__parityServices.wasm.getHeaderFooter(0,true,0);return typeof v==='string'?JSON.parse(v):v;});}
async function saveBytes(name){
  const result=await (await active()).evaluate(async()=>{const api=window.jueonyEditor,result=await api.save();const file=await api.fileHandle().getFile();return {result,dirty:api.state().dirty,message:document.getElementById('sb-message')?.textContent,dialogs:[...document.querySelectorAll('.modal-overlay,dialog[open]')].map(e=>e.textContent),bytes:[...new Uint8Array(await file.arrayBuffer())]};});
  assert.equal(result.result,'saved',JSON.stringify({result:result.result,message:result.message,dialogs:result.dialogs}));assert.equal(result.dirty,false);await writeFile(resolve(out,name),new Uint8Array(result.bytes));return result.bytes;
}
async function scenario(name,action){
  if(process.env.JUEONY_TEST_CASE&&!new RegExp(process.env.JUEONY_TEST_CASE).test(name))return;
  try{await action();results.push(name);console.log('PASS',name);}
  catch(error){failures.push({name,error:String(error),stack:error.stack,settings:await page.evaluate(()=>localStorage.getItem('rhwp-settings')),browserDialogs:[...browserDialogs],consoleErrors:[...consoleErrors]});console.error('FAIL',name,error);await page.screenshot({path:resolve(out,`failure-${failures.length}.png`)}).catch(()=>{});
    // Close only synthetic test dialogs so independent later cases can still run.
    await (await active()).evaluate(()=>{document.querySelectorAll('dialog[open]').forEach(d=>d.close());document.querySelectorAll('.modal-overlay .dialog-close').forEach(b=>b.click());}).catch(()=>{});
  }
}
async function settings(enabled){
  await focusBody();await command('tool:options');const frame=await active();
  await frame.waitForSelector('.opt-body');await frame.click('.opt-body .dialog-tab[data-tab=file]');
  await frame.$eval('#opt-recovery-enabled',e=>{if(e.checked)e.click();});
  await frame.$eval('#opt-idle-save-enabled',(e,value)=>{if(e.checked!==value)e.click();},enabled);
  await frame.$eval('#opt-idle-save-enabled',e=>{const input=e.closest('.opt-autosave-row').querySelector('input[type=number]');input.value='5';input.dispatchEvent(new Event('input',{bubbles:true}));});
  await frame.click('.modal-overlay .dialog-btn-primary');
  await page.waitForFunction(value=>{const s=JSON.parse(localStorage.getItem('rhwp-settings')).autosave;return s.recoveryEnabled===false&&(s.idleSaveEnabled??true)===value&&s.idleDelaySeconds===5;},{},enabled);
  await delay(150); // cross-window storage event delivery, not a recovery timeout
}
async function replaceFirst(text){await (await active()).evaluate(async text=>{const api=window.jueonyEditor,b=api.snapshot();await api.apply(crypto.randomUUID(),b,{message:'합성 검증',sourceIds:[],operations:[{kind:'replace_body_text',target:b.nodes[0].id,start:0,count:[...b.nodes[0].text].length,text}]});},text);}
async function storedDocuments(){return page.evaluate(async()=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('jueony-workspaces',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});const docs=await new Promise((resolve,reject)=>{const r=db.transaction('documents').objectStore('documents').getAll();r.onsuccess=()=>resolve(r.result.map(d=>({id:d.id,name:d.name,dirty:d.dirty,updatedAt:d.updatedAt,bytes:[...d.bytes]})));r.onerror=()=>reject(r.error);});db.close();return docs;});}
function firstText(bytes){const doc=new HwpDocument(new Uint8Array(bytes));try{return doc.getTextRange(0,0,0,doc.getParagraphLength(0,0));}finally{doc.free();}}

try{
  for(let i=0;i<100;i++){if(await fetch(origin+'/api/health').then(r=>r.ok,()=>false))break;await delay(100);}
  browser=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--no-first-run','--disable-background-networking'],defaultViewport:{width:1600,height:1000}});
  page=await browser.newPage();page.setDefaultTimeout(15000);page.on('pageerror',error=>pageErrors.push(String(error)));page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});page.on('dialog',dialog=>{browserDialogs.push({type:dialog.type(),message:dialog.message()});void dialog.accept();});
  await page.setRequestInterception(true);page.on('request',request=>{if(!request.url().startsWith(origin)&&!request.url().startsWith('data:')&&!request.url().startsWith('blob:')){external.push(request.url());void request.abort();}else void request.continue();});
  await page.goto(origin);await ready();

  await scenario('modal Tab/Shift-Tab, focused cancel Enter, Escape and nested Escape preserve document and editor focus',async()=>{
    const frame=await openFixture(),before=await snapshot();
    await chord('F6');await frame.waitForSelector('.sd-body');
    await page.keyboard.press('Tab');assert.equal(await frame.evaluate(()=>Boolean(document.activeElement?.closest('.modal-overlay'))),true);
    await chord('Shift','Tab');assert.equal(await frame.evaluate(()=>Boolean(document.activeElement?.closest('.modal-overlay'))),true);
    await frame.click('.sd-icon-bar button:nth-child(2)');
    await frame.waitForFunction(()=>document.querySelectorAll('.modal-overlay').length===2);
    await page.keyboard.press('Escape');await frame.waitForFunction(()=>document.querySelectorAll('.modal-overlay').length===1);
    assert.equal(await frame.evaluate(()=>Boolean(document.activeElement?.closest('.modal-overlay'))),true);
    await page.keyboard.press('Escape');await frame.waitForSelector('.modal-overlay',{hidden:true});
    assert.equal(await frame.evaluate(()=>document.activeElement?.getAttribute('aria-label')),'문서 편집 입력');
    assert.equal((await snapshot()).revision,before.revision);
    await chord('Alt','t');await frame.waitForSelector('.modal-overlay');
    assert.equal((await snapshot()).revision,before.revision,'opening paragraph dialog changed revision');
    const cancelFocus=await frame.$eval('.modal-overlay .cs-right-col > .dialog-btn:not(.dialog-btn-primary)',e=>{e.focus();return {target:e.textContent,active:document.activeElement?.textContent,disabled:e.disabled,tabIndex:e.tabIndex,inert:Boolean(e.closest('[inert]'))};});
    assert.equal(cancelFocus.active,'취소',JSON.stringify(cancelFocus));
    await page.keyboard.press('Enter');await frame.waitForSelector('.modal-overlay',{hidden:true});assert.equal((await snapshot()).revision,before.revision,JSON.stringify({before:before.nodes,after:(await snapshot()).nodes}));
    await chord('Alt','t');await frame.waitForSelector('.modal-overlay');
    await frame.evaluate(()=>document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',isComposing:true,bubbles:true,cancelable:true})));
    assert.ok(await frame.$('.modal-overlay'),'IME Escape must not cancel the dialog');
    await page.keyboard.press('Escape');await frame.waitForSelector('.modal-overlay',{hidden:true});
    await chord('Control','n');await page.keyboard.press('g');await frame.waitForSelector('.modal-overlay');
    await page.keyboard.press('Escape');await frame.waitForSelector('.modal-overlay',{hidden:true});assert.equal((await snapshot()).revision,before.revision);
  });

  await scenario('body caret survives actual workspace reload and tab switching without dirty or focus changes',async()=>{
    let frame=await openFixture(),before=await snapshot();
    // Host save checkpoints the opened bytes; a test-only direct API open alone
    // must not pretend to have replaced the shell's prior blank recovery record.
    await page.click('#save-document');await page.waitForFunction(()=>document.getElementById('app-status').textContent==='파일에 저장했습니다.');
    await frame.evaluate(()=>{const s=window.__parityServices,ih=s.getInputHandler();ih.cursor.moveTo({sectionIndex:0,paragraphIndex:1,charOffset:2});ih.updateCaret();ih.focus();s.eventBus.emit('command-state-changed');});
    const view=await frame.evaluate(()=>window.jueonyEditor.captureDocumentView());assert.equal(view.caret.paragraph,1);assert.equal(view.caret.offset,2);
    await delay(2000);
    const stored=await page.evaluate(async()=>{const db=await new Promise(resolve=>{const r=indexedDB.open('jueony-workspaces',1);r.onsuccess=()=>resolve(r.result);});const docs=await new Promise(resolve=>{const r=db.transaction('documents').objectStore('documents').getAll();r.onsuccess=()=>resolve(r.result);});db.close();return docs.map(d=>d.view);});
    assert.ok(stored.some(v=>v?.caret?.paragraph===1&&v?.caret?.offset===2),'persisted caret missing');
    await page.reload();await ready();frame=await services();
    assert.deepEqual(await frame.evaluate(()=>window.__parityServices.getInputHandler().getPosition()),{sectionIndex:0,paragraphIndex:1,charOffset:2});
    assert.equal((await snapshot()).nodes[1].text,before.nodes[1].text);assert.equal(await frame.evaluate(()=>window.jueonyEditor.state().dirty),false);
    const originalTab=await page.$eval('.document-tab[aria-selected=true]',e=>e.parentElement.getAttribute('data-document-id')??e.textContent);
    await page.click('#new-document');await page.waitForFunction(()=>document.querySelectorAll('.document-tab').length===2);
    await page.click('.document-tab:first-child');frame=await services();
    assert.equal(await page.$eval('.document-tab[aria-selected=true]',e=>e.parentElement.getAttribute('data-document-id')??e.textContent),originalTab);
    assert.deepEqual(await frame.evaluate(()=>window.__parityServices.getInputHandler().getPosition()),{sectionIndex:0,paragraphIndex:1,charOffset:2});
    await page.$eval('#request-input',e=>e.focus());
    await frame.evaluate(async()=>{const api=window.jueonyEditor,v=api.captureDocumentView();await api.restoreDocumentView(v);});
    assert.equal(await page.evaluate(()=>document.activeElement.id),'request-input','view restore stole chat focus');
    const invalid=await frame.evaluate(async()=>{const api=window.jueonyEditor,v=api.captureDocumentView();v.caret.before='X'.repeat([...v.caret.before].length);await api.restoreDocumentView(v);return window.__parityServices.getInputHandler().getPosition();});
    assert.deepEqual(invalid,{sectionIndex:0,paragraphIndex:1,charOffset:2});
  });

  await scenario('embedded dirty editors delegate the exit prompt to the workspace host; standalone retains protection',async()=>{
    await openFixture();await replaceFirst('EXIT GUARD TEST');
    const frame=await active();
    assert.equal(await frame.evaluate(()=>{const e=new Event('beforeunload',{cancelable:true});window.dispatchEvent(e);return e.defaultPrevented;}),false);
    assert.equal(await page.evaluate(()=>{const e=new Event('beforeunload',{cancelable:true});window.dispatchEvent(e);return e.defaultPrevented;}),true);
    const originalIndex=await page.evaluate(()=>[...document.querySelectorAll('.document-tab')].findIndex(e=>e.getAttribute('aria-selected')==='true'));
    await page.click('#new-document');
    await page.waitForFunction(()=>document.querySelector('.document-tab[aria-selected=true]')?.textContent!=='문서 준비 중…');
    const cleanFrame=await services();
    assert.equal(await cleanFrame.evaluate(()=>window.jueonyEditor.state().dirty),false);
    assert.equal(await page.evaluate(()=>{const e=new Event('beforeunload',{cancelable:true});window.dispatchEvent(e);return e.defaultPrevented;}),true,'inactive dirty document lost exit protection');
    await page.click(`.document-tab-wrap:nth-child(${originalIndex+1}) .document-tab`);
    const standalone=await browser.newPage();try{
      await standalone.goto(origin+'/editor.html?skipRecovery=1&storage=download');await standalone.waitForFunction(()=>window.jueonyEditor?.snapshot&&!window.jueonyEditor.busy());
      await standalone.evaluate(async()=>{const api=window.jueonyEditor,b=api.snapshot();await api.apply(crypto.randomUUID(),b,{message:'',sourceIds:[],operations:[{kind:'replace_body_text',target:b.nodes[0].id,start:0,count:0,text:'Standalone dirty'}]});});
      assert.equal(await standalone.evaluate(()=>{const e=new Event('beforeunload',{cancelable:true});window.dispatchEvent(e);return e.defaultPrevented;}),true);
    }finally{await standalone.close();}
    await page.bringToFront();await openFixture();
  });

  await scenario('Ctrl+1 through Ctrl+0 apply default paragraph styles and undo without changing text',async()=>{
    const doc=HwpDocument.createEmpty();doc.createBlankDocument();doc.insertText(0,0,0,'스타일 단축키 검증');
    const bytes=[...doc.exportHwpx()];doc.free();const frame=await openBytes(bytes,'style-shortcuts.hwpx');
    const before=await snapshot();
    const styles=await frame.evaluate(()=>window.__parityServices.wasm.getStyleList());
    for(let slot=0;slot<10;slot++){
      await focusBody();await chord('Control',String((slot+1)%10));
      const style=await frame.evaluate(()=>window.__parityServices.wasm.getStyleAt(0,0));
      const expected=['바탕글','본문',...Array.from({length:8},(_,i)=>`개요 ${i+1}`)][slot];
      assert.equal(style.name.replace(/\s/g,''),expected.replace(/\s/g,''),JSON.stringify({slot,style,styles}));
      assert.equal((await snapshot()).nodes[0].text,before.nodes[0].text);
    }
    await command('edit:undo');
    assert.equal((await frame.evaluate(()=>window.__parityServices.wasm.getStyleAt(0,0))).name.replace(/\s/g,''),'개요7');
    const bytesAfter=await saveBytes('default-style-shortcuts.hwpx');
    await openBytes(bytesAfter,'default-style-shortcuts-reopen.hwpx');
    assert.equal((await (await services()).evaluate(()=>window.__parityServices.wasm.getStyleAt(0,0))).name.replace(/\s/g,''),'개요7');
  });

  for(const extension of ['hwp','hwpx'])await scenario(`${extension}: paragraph shortcut aliases adjust per-paragraph values and undo/save without changing text`,async()=>{
    const doc=HwpDocument.createEmpty();doc.createBlankDocument();doc.insertText(0,0,0,'여백 가😀나');doc.splitParagraph(0,0,6);doc.insertText(0,1,0,'다른 여백 문단');
    doc.applyParaFormat(0,0,JSON.stringify({marginLeft:2000,marginRight:4000,indent:1000}));doc.applyParaFormat(0,1,JSON.stringify({marginLeft:6000,marginRight:8000,indent:0}));
    const bytes=[...doc[extension==='hwp'?'exportHwp':'exportHwpx']()];doc.free();const frame=await openBytes(bytes,`paragraph-keys.${extension}`),before=await snapshot();
    for(const [keys,field,delta] of [
      [['Control','Alt','F5'],'marginLeft',-1],[['Control','Shift','e'],'marginLeft',-1],[['Control','Alt','F6'],'marginLeft',1],[['Control','Shift','g'],'marginLeft',1],
      [['Control','Alt','F7'],'marginRight',1],[['Control','Shift','d'],'marginRight',1],[['Control','Alt','F8'],'marginRight',-1],[['Control','Shift','f'],'marginRight',-1],
      [['Control','F5'],'indent',-1],[['Control','Shift','o'],'indent',-1],[['Control','F6'],'indent',1],[['Control','Shift','i'],'indent',1],
      [['Control','F7'],'both',-1],[['Control','F8'],'both',1],
    ]){
      await focusBody();const old=await frame.evaluate(()=>JSON.parse(window.__parityServices.wasm.borrowDocumentHandle().getParaShapeSet(0,0)));await chord(...keys);
      const props=await frame.evaluate(()=>JSON.parse(window.__parityServices.wasm.borrowDocumentHandle().getParaShapeSet(0,0)));
      for(const key of field==='both'?['LeftMargin','RightMargin']:[{marginLeft:'LeftMargin',marginRight:'RightMargin',indent:'Indentation'}[field]])assert.equal(props[key]-old[key],delta*200,`${keys.join('+')}: ${JSON.stringify({old,props})}`);
      assert.deepEqual((await snapshot()).nodes.map(n=>n.text),before.nodes.map(n=>n.text));
    }
    const propsBefore=await frame.evaluate(()=>[0,1].map(p=>JSON.parse(window.__parityServices.wasm.borrowDocumentHandle().getParaShapeSet(0,p))));
    await frame.evaluate(()=>{const ih=window.__parityServices.getInputHandler();ih.cursor.selectRange({sectionIndex:0,paragraphIndex:0,charOffset:1},{sectionIndex:0,paragraphIndex:1,charOffset:2});ih.updateCaret();ih.focus();});
    await chord('Control','Shift','g');const propsAfter=await frame.evaluate(()=>[0,1].map(p=>JSON.parse(window.__parityServices.wasm.borrowDocumentHandle().getParaShapeSet(0,p))));
    for(let p=0;p<2;p++)assert.equal(propsAfter[p].LeftMargin-propsBefore[p].LeftMargin,200);
    assert.ok(await frame.evaluate(()=>window.__parityServices.getInputHandler().cursor.hasSelection()));
    await command('edit:undo');assert.deepEqual(await frame.evaluate(()=>[0,1].map(p=>JSON.parse(window.__parityServices.wasm.borrowDocumentHandle().getParaShapeSet(0,p)))),propsBefore);
    assert.ok(await frame.evaluate(()=>window.__parityServices.getInputHandler().cursor.hasSelection()));
    await command('edit:redo');const saved=await saveBytes(`paragraph-spacing.${extension}`),reopen=new HwpDocument(new Uint8Array(saved));
    try{for(let p=0;p<2;p++)assert.equal(parse(reopen.getParaShapeSet(0,p)).LeftMargin,propsAfter[p].LeftMargin);}finally{reopen.free();}
  });

  for(const extension of ['hwp','hwpx'])await scenario(`${extension}: quick hanging indent aligns to live prefix, repeats without edit and undoes/saves`,async()=>{
    const doc=HwpDocument.createEmpty();doc.createBlankDocument();doc.insertText(0,0,0,'1. 가😀나 항목의 내용');doc.applyParaFormat(0,0,JSON.stringify({marginLeft:1001,indent:600}));
    const bytes=[...doc[extension==='hwp'?'exportHwp':'exportHwpx']()];doc.free();const frame=await openBytes(bytes,`hanging-indent.${extension}`);
    await frame.evaluate(()=>{const ih=window.__parityServices.getInputHandler();ih.cursor.moveTo({sectionIndex:0,paragraphIndex:0,charOffset:3});ih.updateCaret();ih.focus();});
    const info=await frame.evaluate(()=>{const d=window.__parityServices.wasm.borrowDocumentHandle();return {before:JSON.parse(d.getParaShapeSet(0,0)),prefix:JSON.parse(d.getCursorRect(0,0,3)).x-JSON.parse(d.getCursorRect(0,0,0)).x};});
    await chord('Shift','Tab');const shape=await frame.evaluate(()=>JSON.parse(window.__parityServices.wasm.borrowDocumentHandle().getParaShapeSet(0,0)));
    assert.equal(shape.LeftMargin,info.before.LeftMargin+info.before.Indentation+Math.round(info.prefix*150));assert.equal(shape.Indentation,-Math.round(info.prefix*150));
    const changed=await snapshot();await chord('Shift','Tab');assert.equal((await snapshot()).revision,changed.revision);
    await command('edit:undo');assert.deepEqual(await frame.evaluate(()=>JSON.parse(window.__parityServices.wasm.borrowDocumentHandle().getParaShapeSet(0,0))),info.before);
    await command('edit:redo');const saved=await saveBytes(`hanging-indent.${extension}`),reopened=new HwpDocument(new Uint8Array(saved));
    try{assert.equal(parse(reopened.getParaShapeSet(0,0)).LeftMargin,shape.LeftMargin);assert.equal(parse(reopened.getParaShapeSet(0,0)).Indentation,shape.Indentation);}finally{reopened.free();}
    await frame.evaluate(()=>{const ih=window.__parityServices.getInputHandler();ih.cursor.selectRange({sectionIndex:0,paragraphIndex:0,charOffset:0},{sectionIndex:0,paragraphIndex:0,charOffset:2});ih.updateCaret();});
    assert.equal(await frame.evaluate(()=>window.rhwpStudio.automation.isEnabled('ext:jueony-hanging-indent')),false);
  });

  for(const extension of ['hwp','hwpx'])await scenario(`${extension}: flat-cell quick hanging indent retains Unicode and Shift+Tab cell navigation`,async()=>{
    const doc=HwpDocument.createEmpty();doc.createBlankDocument();const table=parse(doc.createTable(0,0,0,2,2));
    for(let c=0;c<2;c++)doc.insertTextInCell(0,table.paraIdx,table.controlIdx,c,0,0,'가😀나 셀');
    const bytes=[...doc[extension==='hwp'?'exportHwp':'exportHwpx']()];doc.free();const frame=await openBytes(bytes,`cell-hanging.${extension}`);
    const position=cell=>({sectionIndex:0,parentParaIndex:table.paraIdx,paragraphIndex:0,charOffset:2,controlIndex:table.controlIdx,cellIndex:cell,cellParaIndex:0,cellPath:[{controlIndex:table.controlIdx,cellIndex:cell,cellParaIndex:0}]});
    await frame.evaluate(p=>{const ih=window.__parityServices.getInputHandler();ih.cursor.moveTo(p);ih.updateCaret();ih.focus();},position(0));
    const before=(await snapshot()).revision;
    await chord('Control','Shift','Tab');assert.notEqual((await snapshot()).revision,before);
    const raw=()=>frame.evaluate(table=>{const d=window.__parityServices.wasm.borrowDocumentHandle(),l=JSON.parse(d.getCursorModel()).lists.find(l=>l.isCell&&l.hostListId===0&&l.hostPara===table.paraIdx&&l.controlIndex===table.controlIdx&&l.cellIndex===0);return JSON.parse(d.getParaShapeSet(l.listId,0));},table);
    const changed=await raw();assert.ok(changed.LeftMargin>0);assert.equal(changed.LeftMargin,-changed.Indentation);
    const saved=await saveBytes(`cell-hanging.${extension}`);await openBytes(saved,`cell-hanging-reopen.${extension}`);assert.deepEqual(await raw(),changed);
    await frame.evaluate(p=>{const ih=window.__parityServices.getInputHandler();ih.cursor.moveTo(p);ih.updateCaret();ih.focus();},position(1));
    const version=(await snapshot()).revision;await chord('Shift','Tab');assert.equal((await snapshot()).revision,version);
    assert.equal(await frame.evaluate(()=>window.__parityServices.getInputHandler().getCursorPosition().cellIndex),0);
  });

  for(const extension of ['hwp','hwpx'])await scenario(`${extension}: object T transposes whole table, preserves cell text/format and one-step undo/save`,async()=>{
    const doc=HwpDocument.createEmpty();doc.createBlankDocument();const table=parse(doc.createTable(0,0,0,2,3));
    for(let c=0;c<6;c++)doc.insertTextInCell(0,table.paraIdx,table.controlIdx,c,0,0,`셀${c}😀`);
    doc.applyCharFormatInCell(0,table.paraIdx,table.controlIdx,1,0,0,4,JSON.stringify({bold:true}));
    const bytes=[...doc[extension==='hwp'?'exportHwp':'exportHwpx']()];doc.free();const frame=await openBytes(bytes,`transpose-table.${extension}`);
    const select=()=>frame.evaluate(table=>{const ih=window.__parityServices.getInputHandler();ih.cursor.exitCellSelectionMode();ih.cursor.enterTableObjectSelectionDirect(0,table.paraIdx,table.controlIdx);ih.updateCaret();ih.focus();},table);
    const cells=()=>snapshot().then(s=>s.structure.tables[0].cells.map(c=>({row:c.row,column:c.column,text:c.text,characters:c.characters})));
    const original=await cells();await select();await page.keyboard.press('t');const after=await cells();
    assert.equal((await snapshot()).structure.tables[0].rows,3);assert.equal((await snapshot()).structure.tables[0].columns,2);
    for(const old of original)assert.deepEqual(after.find(c=>c.row===old.column&&c.column===old.row),{...old,row:old.column,column:old.row});
    await command('edit:undo');assert.deepEqual(await cells(),original);await command('edit:redo');
    const saved=await saveBytes(`transpose-table.${extension}`);await openBytes(saved,`transpose-reopen.${extension}`);assert.deepEqual(await cells(),after);
    await frame.evaluate(table=>window.__parityServices.wasm.setCellProperties(0,table.paraIdx,table.controlIdx,0,{cellProtect:true}),table);
    await select();assert.equal(await frame.evaluate(()=>window.rhwpStudio.automation.isEnabled('ext:jueony-transpose-table')),false);
    const before=(await snapshot()).revision;await page.keyboard.press('t');assert.equal((await snapshot()).revision,before);
  });

  await scenario('table object selection survives restart without dirty and rejects changed table evidence',async()=>{
    let frame=await openFixture('schedule-table.hwpx');await page.click('#save-document');await page.waitForFunction(()=>document.getElementById('app-status').textContent==='파일에 저장했습니다.');
    await frame.evaluate(()=>{const ih=window.__parityServices.getInputHandler();ih.cursor.enterTableObjectSelectionDirect(0,1,0);ih.updateCaret();ih.focus();window.__parityServices.eventBus.emit('table-object-selection-changed',true);});
    const saved=await frame.evaluate(()=>window.jueonyEditor.captureDocumentView());assert.equal(saved.cursor.kind,'table-object');
    await delay(2000);const storedBefore=await page.evaluate(async()=>{const db=await new Promise(resolve=>{const r=indexedDB.open('jueony-workspaces',1);r.onsuccess=()=>resolve(r.result);});const docs=await new Promise(resolve=>{const r=db.transaction('documents').objectStore('documents').getAll();r.onsuccess=()=>resolve(r.result.map(d=>({name:d.name,view:d.view})));});db.close();return docs;});await page.reload();await ready();frame=await services();
    const stateAfter=await frame.evaluate(()=>({selected:window.__parityServices.getInputHandler().cursor.isInTableObjectSelection(),view:window.jueonyEditor.captureDocumentView()}));
    assert.equal(stateAfter.selected,true,JSON.stringify({saved,storedBefore,stateAfter}));
    assert.equal(await frame.evaluate(()=>window.jueonyEditor.state().dirty),false);
    assert.deepEqual((await frame.evaluate(()=>window.jueonyEditor.captureDocumentView())).cursor,saved.cursor);
    await frame.evaluate(()=>{const ih=window.__parityServices.getInputHandler();ih.cursor.exitTableObjectSelection();ih.wasm.insertTextInCell(0,1,0,0,0,0,'변경');});
    const restored=await frame.evaluate(view=>window.jueonyEditor.restoreDocumentView(view),saved);
    await delay(200);assert.equal(await frame.evaluate(()=>window.__parityServices.getInputHandler().cursor.isInTableObjectSelection()),false);
  });

  for(const extension of ['hwp','hwpx'])await scenario(`${extension}: page border solid background dialog cancels, undoes and preserves guarded export`,async()=>{
    const frame=await openFixture(),original=await frame.evaluate(()=>window.__parityServices.wasm.getPageBorderFill(0)),revision=(await snapshot()).revision;
    await command('page:page-border');await page.keyboard.press('Escape');assert.equal((await snapshot()).revision,revision);
    await command('page:page-border');await frame.click('.modal-overlay .dialog-tab[data-tab=background]');
    await frame.click('input[name="page-border-bg"][value="solid"]');
    await frame.$eval('.dialog-tab-panel[data-tab=background] input[type=color]',e=>{e.value='#ffeedd';e.dispatchEvent(new Event('input',{bubbles:true}));});
    await frame.click('input[name="page-border-fill-area"][value="paper"]');await frame.click('.modal-overlay .dialog-btn-primary');
    const after=await frame.evaluate(()=>window.__parityServices.wasm.getPageBorderFill(0));assert.equal(after.fillType,'solid');assert.equal(after.fillColor.toLowerCase(),'#ffeedd');assert.equal(after.fillArea,'paper');
    await command('edit:undo');assert.deepEqual(await frame.evaluate(()=>window.__parityServices.wasm.getPageBorderFill(0)),original);await command('edit:redo');
    // Explicit format selection in the test file ensures both serialization paths are checked.
    const exported=await frame.evaluate(extension=>{const w=window.__parityServices.wasm;return [...(extension==='hwp'?w.exportHwp():w.exportHwpx())];},extension);
    const file=await openBytes(exported,`page-border.${extension}`);const saved=await saveBytes(`page-border.${extension}`),doc=new HwpDocument(new Uint8Array(saved));
    try{assert.deepEqual(parse(doc.getPageBorderFill(0)),after);}finally{doc.free();}
    await command('page:page-border');await file.click('.modal-overlay .dialog-tab[data-tab=background]');
    assert.equal(await file.$eval('.dialog-tab-panel[data-tab=background] select:not([data-page-border-kind]):not([data-page-gradient])',e=>e.value),'0');await page.keyboard.press('Escape');
  });

  await scenario('cursor history physical Equal keys go back/forward, branch on manual movement and do not dirty the document',async()=>{
    const frame=await openFixture(),revision=(await snapshot()).revision;
    const generation=await frame.evaluate(()=>{window.__historySwapCount=0;window.__parityServices.eventBus.on('document-swapped',()=>window.__historySwapCount++);return window.__parityServices.wasm.documentGeneration;});
    const move=async(paragraph,offset)=>{await frame.evaluate((paragraph,offset)=>{const ih=window.__parityServices.getInputHandler();ih.cursor.clearSelection();ih.cursor.moveTo({sectionIndex:0,paragraphIndex:paragraph,charOffset:offset});ih.updateCaret();ih.focus();},paragraph,offset);await delay(180);};
    const point=()=>frame.evaluate(()=>window.__parityServices.getInputHandler().getCursorPosition());
    await move(0,1);await move(1,1);await move(2,1);
    await chord('Control','=');assert.equal((await point()).paragraphIndex,1);
    await chord('Control','Shift','=');assert.equal((await point()).paragraphIndex,2);
    await chord('Control','=');await move(0,2);
    assert.equal(await frame.evaluate(()=>window.rhwpStudio.automation.isEnabled('ext:jueony-next-cursor')),false);
    await chord('Control','=');assert.equal((await point()).paragraphIndex,1);
    assert.equal((await snapshot()).revision,revision);assert.equal(await frame.evaluate(()=>window.jueonyEditor.state().dirty),false);
    await openFixture();await delay(180);
    const reopened=await (await active()).evaluate(()=>({enabled:window.rhwpStudio.automation.isEnabled('ext:jueony-previous-cursor'),generation:window.__parityServices.wasm.documentGeneration,swaps:window.__historySwapCount,position:window.__parityServices.getInputHandler().getCursorPosition(),view:window.jueonyEditor.captureDocumentView()}));
    assert.equal(reopened.enabled,false,JSON.stringify({previousGeneration:generation,...reopened}));
  });

  for(const extension of ['hwp','hwpx'])await scenario(`${extension}: calendar string shortcut, preview, cancel/conflict, single undo and guarded save`,async()=>{
    const doc=HwpDocument.createEmpty();doc.createBlankDocument();doc.insertText(0,0,0,'기준 본문');const bytes=[...(extension==='hwp'?doc.exportHwp():doc.exportHwpx())];doc.free();
    const frame=await openBytes(bytes,`calendar-string.${extension}`),base=(await snapshot()).nodes[0].text,revision=(await snapshot()).revision;
    await chord('Control','k');await page.keyboard.press('d');await frame.waitForSelector('[aria-label="날짜/시간 형식"]');
    await page.keyboard.press('Escape');assert.equal((await snapshot()).revision,revision);assert.equal((await snapshot()).nodes[0].text,base);
    await command('ext:jueony-calendar-stamp');await frame.select('[aria-label="날짜/시간 형식"]','date-time');
    const stamp=await frame.$eval('[aria-label="넣을 날짜/시간"]',e=>e.value);assert.match(stamp,/^\d{4}\.\d{2}\.\d{2} \d{2}:\d{2}:\d{2}$/);
    await frame.click('.modal-overlay .dialog-btn-primary');await frame.waitForFunction(()=>!document.querySelector('.modal-overlay'));
    assert.equal((await snapshot()).nodes[0].text,stamp+base);await command('edit:undo');assert.equal((await snapshot()).nodes[0].text,base);await command('edit:redo');
    const saved=await saveBytes(`calendar-string.${extension}`),reopened=new HwpDocument(new Uint8Array(saved));
    try{assert.equal(reopened.getTextRange(0,0,0,reopened.getParagraphLength(0,0)),stamp+base);}finally{reopened.free();}
    await focusBody();await command('ext:jueony-calendar-stamp');const beforeConflict=(await snapshot()).revision;
    await frame.evaluate(()=>{const ih=window.__parityServices.getInputHandler();ih.cursor.moveTo({...ih.getCursorPosition(),charOffset:1});ih.updateCaret();});
    await frame.click('.modal-overlay .dialog-btn-primary');assert.equal((await snapshot()).revision,beforeConflict);
    assert.match(await frame.$eval('.modal-overlay [role=alert]',e=>e.textContent),/문서나 커서가 바뀌었습니다/);await page.keyboard.press('Escape');
  });

  await scenario('calendar format survives restart; cancel and corrupt/quota storage do not duplicate document insertion',async()=>{
    let frame=await openFixture();
    await frame.evaluate(()=>localStorage.removeItem('jueony-calendar-format'));
    await command('ext:jueony-calendar-stamp');await frame.select('[aria-label="날짜/시간 형식"]','date-iso');
    await frame.click('.modal-overlay .dialog-btn-primary');
    await page.reload({waitUntil:'networkidle0'});await ready();await focusBody();frame=await active();
    await command('ext:jueony-calendar-stamp');
    assert.equal(await frame.$eval('[aria-label="날짜/시간 형식"]',e=>e.value),'date-iso');
    await frame.select('[aria-label="날짜/시간 형식"]','time');await page.keyboard.press('Escape');
    assert.equal(await frame.evaluate(()=>JSON.parse(localStorage.getItem('jueony-calendar-format')).format),'date-iso');
    await frame.evaluate(()=>localStorage.setItem('jueony-calendar-format','{"version":2,"format":"time"}'));
    await command('ext:jueony-calendar-stamp');
    assert.match(await frame.$eval('.modal-overlay [role=alert]',e=>e.textContent),/지원하지 않는 형식/);
    const before=(await snapshot()).nodes[0].text,stamp=await frame.$eval('[aria-label="넣을 날짜/시간"]',e=>e.value);
    await frame.click('.modal-overlay .dialog-btn-primary');await frame.waitForFunction(()=>!document.querySelector('.modal-overlay'));
    assert.equal((await snapshot()).nodes[0].text,stamp+before);
    assert.equal(await frame.evaluate(()=>localStorage.getItem('jueony-calendar-format')),'{"version":2,"format":"time"}');
    assert.match(await frame.$eval('#rhwp-toast-container',e=>e.textContent),/날짜\/시간은 넣었습니다.*형식 저장 실패/);
    await command('edit:undo');assert.equal((await snapshot()).nodes[0].text,before);
    await frame.evaluate(()=>{localStorage.setItem('jueony-calendar-format','{"version":1,"format":"time"}');window.__calendarOriginalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='jueony-calendar-format')throw new DOMException('Quota','QuotaExceededError');return window.__calendarOriginalSet.call(this,key,value);};});
    try{
      await command('ext:jueony-calendar-stamp');await frame.select('[aria-label="날짜/시간 형식"]','date-time');
      const value=await frame.$eval('[aria-label="넣을 날짜/시간"]',e=>e.value);
      await frame.click('.modal-overlay .dialog-btn-primary');await frame.waitForFunction(()=>!document.querySelector('.modal-overlay'));
      assert.equal((await snapshot()).nodes[0].text,value+before);
      assert.equal(await frame.evaluate(()=>JSON.parse(localStorage.getItem('jueony-calendar-format')).format),'time');
      await command('edit:undo');assert.equal((await snapshot()).nodes[0].text,before);
    }finally{await frame.evaluate(()=>{Storage.prototype.setItem=window.__calendarOriginalSet;delete window.__calendarOriginalSet;localStorage.removeItem('jueony-calendar-format');});}
  });

  await scenario('cursor history skips changed text bookmarks and restores flat-cell scalar offsets',async()=>{
    let frame=await openFixture();
    const move=async(paragraph)=>{await frame.evaluate(paragraph=>{const ih=window.__parityServices.getInputHandler();ih.cursor.moveTo({sectionIndex:0,paragraphIndex:paragraph,charOffset:1});ih.updateCaret();ih.focus();},paragraph);await delay(180);};
    await move(0);await move(1);await move(2);
    await frame.evaluate(()=>{const doc=window.__parityServices.wasm.borrowDocumentHandle();doc.deleteText(0,1,0,1);doc.insertText(0,1,0,'X');});
    await command('ext:jueony-previous-cursor');assert.equal(await frame.evaluate(()=>window.__parityServices.getInputHandler().getCursorPosition().paragraphIndex),0);
    const doc=HwpDocument.createEmpty();doc.createBlankDocument();const table=parse(doc.createTable(0,0,0,2,2));
    for(let cell=0;cell<2;cell++)doc.insertTextInCell(0,table.paraIdx,table.controlIdx,cell,0,0,'가😀나 셀');
    const bytes=[...doc.exportHwpx()];doc.free();frame=await openBytes(bytes,'cursor-history-cell.hwpx');
    const cell=async(index,offset)=>{await frame.evaluate((table,index,offset)=>{const ih=window.__parityServices.getInputHandler();ih.cursor.moveTo({sectionIndex:0,parentParaIndex:table.paraIdx,paragraphIndex:0,charOffset:offset,controlIndex:table.controlIdx,cellIndex:index,cellParaIndex:0,cellPath:[{controlIndex:table.controlIdx,cellIndex:index,cellParaIndex:0}]});ih.updateCaret();ih.focus();},table,index,offset);await delay(180);};
    await cell(0,2);await cell(1,3);await command('ext:jueony-previous-cursor');
    let position=await frame.evaluate(()=>window.__parityServices.getInputHandler().getCursorPosition());assert.equal(position.cellIndex,0);assert.equal(position.charOffset,2);
    await command('ext:jueony-next-cursor');position=await frame.evaluate(()=>window.__parityServices.getInputHandler().getCursorPosition());assert.equal(position.cellIndex,1);assert.equal(position.charOffset,3);
    assert.equal(await frame.evaluate(()=>window.jueonyEditor.state().dirty),false);
  });

  await scenario('body selection preserves backward anchor and F3 phase after delayed persistence/reload; changed middle text refuses restore',async()=>{
    let frame=await openFixture(),before=await snapshot();await page.click('#save-document');await page.waitForFunction(()=>document.getElementById('app-status').textContent==='파일에 저장했습니다.');
    await delay(1800); // Exceed the previous save timer: the cursor event must trigger its own view write.
    const saved=await frame.evaluate(()=>{const ih=window.__parityServices.getInputHandler();ih.cursor.selectRange({sectionIndex:0,paragraphIndex:2,charOffset:2},{sectionIndex:0,paragraphIndex:0,charOffset:1},3);ih.updateCaret();ih.focus();return window.jueonyEditor.captureDocumentView();});
    assert.equal(saved.cursor.kind,'text');assert.equal(saved.cursor.blockPhase,3);assert.equal(saved.cursor.anchor.caret.paragraph,2);
    await delay(2000);await page.reload();await ready();frame=await services();
    const actual=await frame.evaluate(()=>({view:window.jueonyEditor.captureDocumentView(),range:window.__parityServices.getInputHandler().cursor.getSelection(),phase:window.__parityServices.getInputHandler().cursor.blockSelectionPhase()}));
    assert.deepEqual(actual.view.cursor,saved.cursor);assert.equal(actual.phase,3);assert.equal(actual.range.anchor.paragraphIndex,2);assert.equal(actual.range.focus.paragraphIndex,0);
    assert.deepEqual((await snapshot()).nodes.map(n=>n.text),before.nodes.map(n=>n.text));assert.equal(await frame.evaluate(()=>window.jueonyEditor.state().dirty),false);
    await page.$eval('#request-input',e=>e.focus());await frame.evaluate(v=>window.jueonyEditor.restoreDocumentView(v),saved);assert.equal(await page.evaluate(()=>document.activeElement.id),'request-input');
    await frame.evaluate(()=>{const ih=window.__parityServices.getInputHandler();ih.cursor.exitBlockSelectionMode();ih.cursor.moveTo({sectionIndex:0,paragraphIndex:1,charOffset:0});ih.applyParaPropsAtCursor({alignment:'left'});});
    await frame.evaluate(async saved=>{const s=window.__parityServices,ih=s.getInputHandler();const text=s.wasm.getTextRange(0,1,0,s.wasm.getParagraphLength(0,1));s.wasm.borrowDocumentHandle().deleteText(0,1,0,1);s.wasm.borrowDocumentHandle().insertText(0,1,0,text[0]==='X'?'Y':'X');ih.cursor.moveTo({sectionIndex:0,paragraphIndex:1,charOffset:0});ih.updateCaret();await window.jueonyEditor.restoreDocumentView(saved);},saved);
    assert.equal(await frame.evaluate(()=>window.__parityServices.getInputHandler().cursor.hasSelection()),false);
  });

  await scenario('paragraph repeated keys preserve no-op redo and refuse modal/form/IME edits',async()=>{
    const doc=HwpDocument.createEmpty();doc.createBlankDocument();doc.insertText(0,0,0,'반복 단축키');const bytes=[...doc.exportHwpx()];doc.free();const frame=await openBytes(bytes,'paragraph-guards.hwpx');
    await page.keyboard.down('Control');await page.keyboard.down('Shift');for(let n=0;n<3;n++)await page.keyboard.down('g');await page.keyboard.up('g');await page.keyboard.up('Shift');await page.keyboard.up('Control');
    assert.equal(await frame.evaluate(()=>JSON.parse(window.__parityServices.wasm.borrowDocumentHandle().getParaShapeSet(0,0)).LeftMargin),600);
    for(let n=0;n<3;n++)await command('edit:undo');const revision=(await snapshot()).revision;
    await focusBody();await chord('Control','Shift','e');assert.equal((await snapshot()).revision,revision);assert.equal(await frame.evaluate(()=>window.rhwpStudio.automation.isEnabled('edit:redo')),true);
    await frame.evaluate(()=>window.__parityServices.getInputHandler().setEditMode('form'));
    await chord('Control','F6');assert.equal((await snapshot()).revision,revision);await frame.evaluate(()=>window.__parityServices.getInputHandler().setEditMode('normal'));
    await focusBody();await frame.evaluate(()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'g',code:'KeyG',ctrlKey:true,shiftKey:true,isComposing:true,bubbles:true,cancelable:true})));assert.equal((await snapshot()).revision,revision);
    await chord('Alt','t');await frame.waitForSelector('.modal-overlay');await chord('Control','Shift','g');assert.equal((await snapshot()).revision,revision);await page.keyboard.press('Escape');
  });

  await scenario('flat table cell Unicode caret and same-cell text selection survive reload and tab switching',async()=>{
    const doc=HwpDocument.createEmpty();doc.createBlankDocument();const table=parse(doc.createTable(0,0,0,2,2));doc.insertTextInCell(0,table.paraIdx,table.controlIdx,0,0,0,'가😀나 셀 문서');
    const bytes=[...doc.exportHwpx()];doc.free();let frame=await openBytes(bytes,'cell-cursor.hwpx');await page.click('#save-document');await page.waitForFunction(()=>document.getElementById('app-status').textContent==='파일에 저장했습니다.');
    await frame.evaluate(table=>{const ih=window.__parityServices.getInputHandler();ih.cursor.moveTo({sectionIndex:0,parentParaIndex:table.paraIdx,paragraphIndex:0,charOffset:2,controlIndex:table.controlIdx,cellIndex:0,cellParaIndex:0,cellPath:[{controlIndex:table.controlIdx,cellIndex:0,cellParaIndex:0}]});ih.updateCaret();ih.focus();},table);
    const saved=await frame.evaluate(()=>window.jueonyEditor.captureDocumentView());assert.equal(saved.cursor.focus.kind,'cell');assert.equal(saved.cursor.focus.caret.before,'가😀');
    await delay(2000);await page.reload();await ready();frame=await services();assert.deepEqual((await frame.evaluate(()=>window.jueonyEditor.captureDocumentView())).cursor,saved.cursor);
    const selected=await frame.evaluate(()=>{const ih=window.__parityServices.getInputHandler(),p=ih.cursor.getPosition();ih.cursor.moveTo({...p,charOffset:1});ih.cursor.setAnchor();ih.cursor.moveTo({...p,charOffset:4});ih.updateCaret();return window.jueonyEditor.captureDocumentView();});
    assert.equal(selected.cursor.anchor.kind,'cell');await delay(2000);await page.reload();await ready();frame=await services();assert.deepEqual((await frame.evaluate(()=>window.jueonyEditor.captureDocumentView())).cursor,selected.cursor);
    const index=await page.evaluate(()=>[...document.querySelectorAll('.document-tab')].findIndex(e=>e.getAttribute('aria-selected')==='true'));
    await page.click('#new-document');await page.waitForFunction(()=>document.querySelector('.document-tab[aria-selected=true]')?.textContent!=='문서 준비 중…');await page.click(`.document-tab-wrap:nth-child(${index+1}) .document-tab`);frame=await services();
    assert.deepEqual((await frame.evaluate(()=>window.jueonyEditor.captureDocumentView())).cursor,selected.cursor);
    assert.equal(await frame.evaluate(()=>window.jueonyEditor.state().dirty),false);
  });

  await scenario('F5 cell block stores phase/rectangle/exclusions and paragraph delta applies to all selected cells as one undo',async()=>{
    let frame=await openFixture('schedule-table.hwpx');await page.click('#save-document');await page.waitForFunction(()=>document.getElementById('app-status').textContent==='파일에 저장했습니다.');
    await frame.evaluate(()=>{const ih=window.__parityServices.getInputHandler();ih.cursor.moveTo({sectionIndex:0,parentParaIndex:1,paragraphIndex:0,charOffset:0,controlIndex:0,cellIndex:0,cellParaIndex:0,cellPath:[{controlIndex:0,cellIndex:0,cellParaIndex:0}]});ih.cursor.enterCellSelectionMode();ih.cursor.advanceCellSelectionPhase();ih.cursor.setCellSelectionFocus(1,1);ih.cursor.ctrlToggleCell(0,1);ih.updateCaret();ih.focus();});
    const saved=await frame.evaluate(()=>window.jueonyEditor.captureDocumentView());assert.equal(saved.cursor.kind,'cells');assert.equal(saved.cursor.block.phase,2);
    await delay(2000);await page.reload();await ready();frame=await services();assert.deepEqual((await frame.evaluate(()=>window.jueonyEditor.captureDocumentView())).cursor,saved.cursor);
    const block=await frame.evaluate(()=>window.__parityServices.getInputHandler().cursor.captureCellSelection());assert.equal(block.phase,2);assert.deepEqual(block.focus,saved.cursor.block.focus);
    assert.deepEqual(block.excluded,['0,1']);
    const cellInfo=await frame.evaluate(()=>{const w=window.__parityServices.wasm;return Array.from({length:w.getTableDimensions(0,1,0).cellCount},(_,c)=>w.getCellInfo(0,1,0,c));});
    const before=await frame.evaluate(()=>{const w=window.__parityServices.wasm,d=w.borrowDocumentHandle(),lists=JSON.parse(d.getCursorModel()).lists;return Array.from({length:w.getTableDimensions(0,1,0).cellCount},(_,c)=>JSON.parse(d.getParaShapeSet(lists.find(l=>l.isCell&&l.hostListId===0&&l.sectionIndex===0&&l.hostPara===1&&l.controlIndex===0&&l.cellIndex===c).listId,0)));});
    await frame.evaluate(()=>window.__parityServices.getInputHandler().focus());await chord('Control','Shift','g');
    const after=await frame.evaluate(()=>{const w=window.__parityServices.wasm,d=w.borrowDocumentHandle(),lists=JSON.parse(d.getCursorModel()).lists;return Array.from({length:w.getTableDimensions(0,1,0).cellCount},(_,c)=>JSON.parse(d.getParaShapeSet(lists.find(l=>l.isCell&&l.hostListId===0&&l.sectionIndex===0&&l.hostPara===1&&l.controlIndex===0&&l.cellIndex===c).listId,0)));});
    for(let i=0;i<cellInfo.length;i++){
      const inside=cellInfo[i].row>=Math.min(block.anchor.row,block.focus.row)&&cellInfo[i].row<=Math.max(block.anchor.row,block.focus.row)&&cellInfo[i].col>=Math.min(block.anchor.col,block.focus.col)&&cellInfo[i].col<=Math.max(block.anchor.col,block.focus.col)&&!block.excluded.includes(`${cellInfo[i].row},${cellInfo[i].col}`);
      assert.equal(after[i].LeftMargin-before[i].LeftMargin,inside?200:0,`cell ${i} selection delta`);
    }
    await command('edit:undo');assert.deepEqual(await frame.evaluate(()=>{const w=window.__parityServices.wasm,d=w.borrowDocumentHandle(),lists=JSON.parse(d.getCursorModel()).lists;return Array.from({length:w.getTableDimensions(0,1,0).cellCount},(_,c)=>JSON.parse(d.getParaShapeSet(lists.find(l=>l.isCell&&l.hostListId===0&&l.sectionIndex===0&&l.hostPara===1&&l.controlIndex===0&&l.cellIndex===c).listId,0)));}),before);
    assert.equal(await frame.evaluate(()=>window.__parityServices.getInputHandler().cursor.isInCellSelectionMode()),true);
  });

  await scenario('merged flat table cell cursor survives checkpoint/reload and new input cancels a pending restore',async()=>{
    const doc=HwpDocument.createEmpty();doc.createBlankDocument();const table=parse(doc.createTable(0,0,0,2,2));doc.insertTextInCell(0,table.paraIdx,table.controlIdx,0,0,0,'병합😀셀');
    doc.mergeTableCells(0,table.paraIdx,table.controlIdx,0,0,0,1);const bytes=[...doc.exportHwpx()];doc.free();let frame=await openBytes(bytes,'merged-cell-cursor.hwpx');
    await page.click('#save-document');await page.waitForFunction(()=>document.getElementById('app-status').textContent==='파일에 저장했습니다.');
    await frame.evaluate(table=>{const ih=window.__parityServices.getInputHandler();ih.cursor.moveTo({sectionIndex:0,parentParaIndex:table.paraIdx,paragraphIndex:0,charOffset:3,controlIndex:table.controlIdx,cellIndex:0,cellParaIndex:0});ih.updateCaret();},table);
    const saved=await frame.evaluate(()=>window.jueonyEditor.captureDocumentView());assert.equal(saved.cursor.focus.kind,'cell');
    await delay(2000);await page.reload();await ready();frame=await services();assert.deepEqual((await frame.evaluate(()=>window.jueonyEditor.captureDocumentView())).cursor,saved.cursor);
    const result=await frame.evaluate(async saved=>{const ih=window.__parityServices.getInputHandler(),p=ih.cursor.getPosition();ih.cursor.moveTo({...p,charOffset:0});ih.updateCaret();const pending=window.jueonyEditor.restoreDocumentView(saved);document.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',code:'ArrowRight',bubbles:true}));const status=await pending;return {status,offset:ih.cursor.getPosition().charOffset};},saved);
    assert.deepEqual(result,{status:'ignored',offset:0});assert.equal(await frame.evaluate(()=>window.jueonyEditor.state().dirty),false);
    await saveBytes('merged-cell-cursor.hwpx');
  });

  await scenario('immediate reload journals latest body/cell selection before the debounced IndexedDB write',async()=>{
    let frame=await openFixture();await page.click('#save-document');await page.waitForFunction(()=>document.getElementById('app-status').textContent==='파일에 저장했습니다.');
    const saved=await frame.evaluate(()=>{const ih=window.__parityServices.getInputHandler();ih.cursor.selectRange({sectionIndex:0,paragraphIndex:0,charOffset:1},{sectionIndex:0,paragraphIndex:2,charOffset:2},3);ih.updateCaret();return window.jueonyEditor.captureDocumentView();});
    await page.reload();await ready();frame=await services();assert.deepEqual((await frame.evaluate(()=>window.jueonyEditor.captureDocumentView())).cursor,saved.cursor);
    await openFixture('schedule-table.hwpx');frame=await services();await page.click('#save-document');await page.waitForFunction(()=>document.getElementById('app-status').textContent==='파일에 저장했습니다.');
    const cell=await frame.evaluate(()=>{const ih=window.__parityServices.getInputHandler();ih.cursor.moveTo({sectionIndex:0,parentParaIndex:1,paragraphIndex:0,charOffset:1,controlIndex:0,cellIndex:1,cellParaIndex:0});ih.updateCaret();return window.jueonyEditor.captureDocumentView();});assert.equal(cell.cursor.focus.kind,'cell');
    await page.reload();await ready();frame=await services();assert.deepEqual((await frame.evaluate(()=>window.jueonyEditor.captureDocumentView())).cursor,cell.cursor);
    const journal=await page.evaluate(()=>JSON.parse(localStorage.getItem('jueony-document-view-journal-v1')));assert.equal(journal.version,1);assert.ok(journal.entries.every(e=>!('bytes' in e)));
  });

  if(process.env.JUEONY_ENGINE_PACKAGE) {
    if(typeof HwpDocument.prototype.mergeSectionBoundary==='function'||process.env.JUEONY_EXPECT_SECTION_MERGE==='1') {
      for(const extension of ['hwp','hwpx'])for(const key of ['Delete','Backspace'])await scenario(`${key} joins section boundary, previous settings, undo/redo and ${extension} save`,async()=>{
        const doc=HwpDocument.createEmpty();doc.createBlankDocument();doc.insertText(0,0,0,'가😀나\t다');
        doc.splitParagraph(0,0,5);doc.insertText(0,1,0,'보존 문단');doc.insertSectionBreak(0,0,2);
        doc.setSectionDef(0,JSON.stringify({defaultTabSpacing:4000}));doc.setSectionDef(1,JSON.stringify({defaultTabSpacing:12000}));
        const bytes=[...doc[extension==='hwp'?'exportHwp':'exportHwpx']()];doc.free();
        const frame=await openBytes(bytes,`join-${key}.${extension}`),before=await snapshot();
        const position=key==='Delete'?{sectionIndex:0,paragraphIndex:0,charOffset:2}:{sectionIndex:1,paragraphIndex:0,charOffset:0};
        await frame.evaluate(pos=>{const s=window.__parityServices,ih=s.getInputHandler();ih.cursor.moveTo(pos);ih.updateCaret();ih.focus();s.eventBus.emit('command-state-changed');},position);
        await page.keyboard.press(key);await frame.waitForFunction(()=>window.jueonyEditor.snapshot().structure.sections.length===1);
        const after=await snapshot();assert.deepEqual(after.nodes.map(n=>n.text),['가😀나\t다','보존 문단']);
        assert.equal(await frame.evaluate(()=>window.__parityServices.wasm.getSectionDef(0).defaultTabSpacing),4000);
        assert.deepEqual(await frame.evaluate(()=>window.__parityServices.getInputHandler().getPosition()),{sectionIndex:0,paragraphIndex:0,charOffset:2});
        assert.equal(await frame.evaluate(()=>window.jueonyEditor.state().dirty),true);
        await command('edit:undo');assert.deepEqual((await snapshot()).structure,before.structure);
        assert.deepEqual(await frame.evaluate(()=>window.__parityServices.getInputHandler().getPosition()),position);
        await command('edit:redo');assert.deepEqual((await snapshot()).nodes.map(n=>n.text),after.nodes.map(n=>n.text));
        const saved=await saveBytes(`ui-section-join-${key.toLowerCase()}.${extension}`),reopen=new HwpDocument(new Uint8Array(saved));
        try{assert.equal(reopen.getSectionCount(),1);assert.equal(reopen.getParagraphCount(0),2);assert.equal(parse(reopen.getSectionDef(0)).defaultTabSpacing,4000);}finally{reopen.free();}
      });
      await scenario('ordinary body deletion and outer document edges retain existing key behavior',async()=>{
        const frame=await openFixture(),before=await snapshot();await page.keyboard.press('Backspace');assert.equal((await snapshot()).revision,before.revision);
        await frame.evaluate(()=>{const ih=window.__parityServices.getInputHandler();ih.cursor.moveTo({sectionIndex:0,paragraphIndex:0,charOffset:1});ih.updateCaret();ih.focus();});
        await page.keyboard.press('Backspace');assert.equal((await snapshot()).nodes[0].text,[...before.nodes[0].text].slice(1).join(''));
        await command('edit:undo');assert.deepEqual((await snapshot()).nodes.map(n=>n.text),before.nodes.map(n=>n.text));
        await page.keyboard.press('Delete');assert.equal((await snapshot()).nodes[0].text,[...before.nodes[0].text].filter((_,i)=>i!==1).join(''));
        await command('edit:undo');
        await frame.evaluate(()=>{const ih=window.__parityServices.getInputHandler(),w=window.__parityServices.wasm;const p=w.getParagraphCount(0)-1;ih.cursor.moveTo({sectionIndex:0,paragraphIndex:p,charOffset:w.getParagraphLength(0,p)});ih.updateCaret();ih.focus();});
        const last=await snapshot();await page.keyboard.press('Delete');assert.equal((await snapshot()).revision,last.revision);
        for(const key of ['Backspace','Delete']) {
          const pos=key==='Backspace'?{sectionIndex:0,paragraphIndex:1,charOffset:0}:{sectionIndex:0,paragraphIndex:0,charOffset:[...before.nodes[0].text].length};
          await frame.evaluate(pos=>{const ih=window.__parityServices.getInputHandler();ih.cursor.moveTo(pos);ih.updateCaret();ih.focus();},pos);
          await page.keyboard.press(key);assert.deepEqual((await snapshot()).nodes.map(n=>n.text),[before.nodes[0].text+before.nodes[1].text,...before.nodes.slice(2).map(n=>n.text)]);
          await command('edit:undo');assert.deepEqual((await snapshot()).nodes.map(n=>n.text),before.nodes.map(n=>n.text));
        }
      });
      await scenario('unsupported header-bearing right section refuses join without document or dirty mutation',async()=>{
        const doc=HwpDocument.createEmpty();doc.createBlankDocument();doc.insertText(0,0,0,'LEFT RIGHT');doc.insertSectionBreak(0,0,4);doc.createHeaderFooter(1,true,0);doc.insertTextInHeaderFooter(1,true,0,0,0,'RIGHT HEADER');
        const bytes=[...doc.exportHwpx()];doc.free();const frame=await openBytes(bytes,'unsupported-section-header.hwpx'),before=await snapshot();
        await frame.evaluate(()=>{const ih=window.__parityServices.getInputHandler();ih.cursor.moveTo({sectionIndex:1,paragraphIndex:0,charOffset:0});ih.updateCaret();ih.focus();});
        await page.keyboard.press('Backspace');assert.deepEqual((await snapshot()).structure,before.structure);assert.deepEqual((await snapshot()).nodes,before.nodes);
        assert.equal(await frame.evaluate(()=>window.jueonyEditor.state().dirty),false);
        assert.match(await frame.$eval('#sb-message',e=>e.textContent),/구역을 합치지 못했습니다/);
      });
      await scenario('form mode and first table cell cannot trigger a body section merge',async()=>{
        const doc=HwpDocument.createEmpty();doc.createBlankDocument();doc.insertText(0,0,0,'LEFT RIGHT');doc.insertSectionBreak(0,0,4);
        const table=parse(doc.createTable(1,0,0,2,2)),bytes=[...doc.exportHwpx()];doc.free();
        const frame=await openBytes(bytes,'guarded-section-cell.hwpx'),before=await snapshot();
        await frame.evaluate(()=>{const ih=window.__parityServices.getInputHandler();ih.cursor.moveTo({sectionIndex:1,paragraphIndex:0,charOffset:0});ih.setEditMode('form');ih.updateCaret();ih.focus();});
        try{await page.keyboard.press('Backspace');assert.deepEqual((await snapshot()).structure,before.structure);assert.deepEqual((await snapshot()).nodes,before.nodes);}finally{await frame.evaluate(()=>window.__parityServices.getInputHandler().setEditMode('normal'));}
        await frame.evaluate(table=>{const ih=window.__parityServices.getInputHandler();ih.cursor.moveTo({sectionIndex:1,parentParaIndex:table.paraIdx,paragraphIndex:0,charOffset:0,controlIndex:table.controlIdx,cellIndex:0,cellParaIndex:0});ih.updateCaret();ih.focus();},table);
        await page.keyboard.press('Backspace');assert.deepEqual((await snapshot()).structure,before.structure);assert.deepEqual((await snapshot()).nodes,before.nodes);
      });
    }
    await scenario('Alt+Shift+Enter splits actual body sections; undo/redo and guarded file save',async()=>{
      const frame=await openFixture(),before=await snapshot();
      await frame.evaluate(()=>{const s=window.__parityServices,ih=s.getInputHandler();ih.cursor.moveTo({sectionIndex:0,paragraphIndex:1,charOffset:2});ih.updateCaret();ih.focus();s.eventBus.emit('command-state-changed');});
      await chord('Alt','Shift','Enter');
      await frame.waitForFunction(()=>window.jueonyEditor.snapshot().structure.sections.length===2);
      const after=await snapshot();assert.equal(after.nodes.map(n=>n.text).join(''),before.nodes.map(n=>n.text).join(''));
      assert.equal(await frame.evaluate(()=>window.__parityServices.getInputHandler().getPosition().sectionIndex),1);
      await saveBytes('ui-section-split.hwpx');
      await command('edit:undo');assert.deepEqual((await snapshot()).structure.sections,before.structure.sections);assert.deepEqual((await snapshot()).nodes.map(n=>n.text),before.nodes.map(n=>n.text));
      await command('edit:redo');assert.equal((await snapshot()).structure.sections.length,2);
    });
    await scenario('paragraph dialog changes default tab spacing in pt; cancel/undo/reopen preserve state',async()=>{
      const doc=HwpDocument.createEmpty();doc.createBlankDocument();doc.insertText(0,0,0,'A\tB\tC');doc.splitParagraph(0,0,5);doc.insertText(0,1,0,'D\tE\tF');doc.insertSectionBreak(0,1,0);doc.setSectionDef(0,JSON.stringify({defaultTabSpacing:8000}));doc.setSectionDef(1,JSON.stringify({defaultTabSpacing:12000}));
      const bytes=[...doc.exportHwpx()];doc.free();const frame=await openBytes(bytes,'ui-default-tabs.hwpx');
      await frame.evaluate(()=>{const s=window.__parityServices,ih=s.getInputHandler();ih.cursor.moveTo({sectionIndex:1,paragraphIndex:0,charOffset:0});ih.updateCaret();ih.focus();s.eventBus.emit('command-state-changed');});
      await command('format:para-shape');
      await frame.click('.modal-overlay .dialog-tabs .dialog-tab[data-tab="tabStops"]');
      await frame.click('[data-jueony-default-tab-change]');await frame.waitForSelector('[data-jueony-default-tabs]');
      assert.equal(await frame.$eval('[aria-label="기본 탭 간격(pt)"]',e=>e.value),'60.0');
      await frame.$eval('[aria-label="기본 탭 간격(pt)"]',e=>{e.value='20';});
      await frame.click('.modal-overlay:has([data-jueony-default-tabs]) .dialog-btn-primary');
      await frame.waitForSelector('[data-jueony-default-tabs]',{hidden:true});
      await page.keyboard.press('Escape');
      assert.equal(await frame.evaluate(()=>window.__parityServices.wasm.getSectionDef(1).defaultTabSpacing),4000);
      assert.equal(await frame.evaluate(()=>window.__parityServices.wasm.getSectionDef(0).defaultTabSpacing),8000);
      await saveBytes('ui-default-tabs-20pt.hwpx');await command('edit:undo');
      assert.equal(await frame.evaluate(()=>window.__parityServices.wasm.getSectionDef(1).defaultTabSpacing),12000);
      await command('edit:redo');assert.equal(await frame.evaluate(()=>window.__parityServices.wasm.getSectionDef(1).defaultTabSpacing),4000);
      const revision=(await snapshot()).revision;
      await command('format:para-shape');await frame.click('.modal-overlay .dialog-tabs .dialog-tab[data-tab="tabStops"]');await frame.click('[data-jueony-default-tab-change]');
      assert.equal(await frame.$eval('[aria-label="기본 탭 간격(pt)"]',e=>e.value),'20.0');
      await page.keyboard.press('Escape');await page.keyboard.press('Escape');assert.equal((await snapshot()).revision,revision);
    });
  }

  await scenario('F6 opens styles; Alt+F6 focuses chat; modal F6 does not change document',async()=>{
    const frame=await openFixture(),before=await snapshot();await page.keyboard.press('F6');await frame.waitForSelector('.sd-body');
    assert.equal(await page.$eval('#request-input',e=>document.activeElement===e),false);
    await page.keyboard.press('F6');assert.equal((await snapshot()).revision,before.revision);
    await page.keyboard.press('Escape');await frame.waitForSelector('.sd-body',{hidden:true});
    await focusBody();await chord('Alt','F6');await page.waitForFunction(()=>document.activeElement?.id==='request-input');
    assert.equal((await snapshot()).revision,before.revision);
  });

  await scenario('table cell block F7 selects column; P opens cell properties without typing text',async()=>{
    const frame=await openFixture('schedule-table.hwpx'),before=await snapshot();
    await frame.evaluate(()=>{const s=window.__parityServices,ih=s.getInputHandler();ih.cursor.moveTo({sectionIndex:0,parentParaIndex:1,paragraphIndex:0,charOffset:0,controlIndex:0,cellIndex:0,cellParaIndex:0});ih.cursor.enterCellSelectionMode();ih.updateCaret();ih.focus();s.eventBus.emit('command-state-changed');});
    await page.keyboard.press('F7');
    const selected=await frame.evaluate(()=>window.__parityServices.getInputHandler().cursor.captureCellSelection());
    assert.equal(Math.abs(selected.focus.row-selected.anchor.row),2);assert.equal(Math.abs(selected.focus.col-selected.anchor.col),0);
    await page.keyboard.press('p');await frame.waitForSelector('.modal-overlay');
    assert.match(await frame.$eval('.modal-overlay .dialog-title',e=>e.textContent),/표|셀/);
    await page.keyboard.press('Escape');assert.deepEqual((await snapshot()).structure.tables,before.structure.tables);
  });

  await scenario('document information reads live text/table counts without changing revision or dirty state',async()=>{
    const frame=await openFixture('schedule-table.hwpx'),before=await snapshot();
    const dirty=await frame.evaluate(()=>window.jueonyEditor.state().dirty);
    await command('file:document-info');await frame.waitForSelector('#jueony-document-info');
    const rows=await frame.$$eval('#jueony-document-info tr',elements=>Object.fromEntries(elements.map(row=>[row.querySelector('th').textContent,row.querySelector('td').textContent])));
    assert.equal(rows['표'],'1');assert.equal(rows['구역'],'1');assert.ok(Number(rows['추출한 글자 · 공백 포함'])>0);
    assert.match(await frame.$eval('#jueony-document-info',e=>e.textContent),/저장 전 내용/);
    await page.keyboard.press('Escape');await frame.waitForSelector('#jueony-document-info',{hidden:true});
    assert.equal((await snapshot()).revision,before.revision);assert.equal(await frame.evaluate(()=>window.jueonyEditor.state().dirty),dirty);
  });

  for(const extension of ['hwp','hwpx'])await scenario(`${extension}: page hide cancel/apply/undo/redo and actual save/reopen`,async()=>{
    const frame=await openFixture('three-paragraphs.'+extension),before=await snapshot();
    const initial=await nativeHide();assert.notEqual(initial.hideHeader,true);
    await command('page:hide');await frame.waitForSelector('#jueony-page-hide[open]');
    await frame.click('#jueony-page-hide input[name=hideHeader]');await frame.click('#jueony-page-hide button[type=button]');
    assert.equal((await snapshot()).revision,before.revision);assert.notEqual((await nativeHide()).hideHeader,true);
    await command('page:hide');await frame.click('#jueony-page-hide input[name=hideHeader]');await frame.click('#jueony-page-hide input[name=hidePageNum]');await frame.click('#jueony-page-hide button[type=submit]');
    await frame.waitForSelector('#jueony-page-hide',{hidden:true});assert.equal((await nativeHide()).hideHeader,true);assert.equal((await nativeHide()).hidePageNum,true);
    assert.equal(await frame.evaluate(()=>window.jueonyEditor.state().dirty),true);
    await command('edit:undo');assert.notEqual((await nativeHide()).hideHeader,true);
    await command('edit:redo');assert.equal((await nativeHide()).hideHeader,true);
    const bytes=await saveBytes('page-hide.'+extension),doc=new HwpDocument(new Uint8Array(bytes));
    try{const saved=parse(doc.getPageHide(0,0));assert.equal(saved.hideHeader,true);assert.equal(saved.hidePageNum,true);}finally{doc.free();}
    await openBytes(bytes,'page-hide-reopened.'+extension);assert.equal((await nativeHide()).hideHeader,true);
    await command('page:hide');assert.equal(await frame.$eval('#jueony-page-hide input[name=hideHeader]',e=>e.checked),true);await page.keyboard.press('Escape');
  });

  await scenario('header/footer dialog cancel, create, undo/redo, then existing content stays intact',async()=>{
    const frame=await openFixture();assert.equal((await header()).exists,false);
    await command('page:header-footer-dialog');await frame.click('#jueony-header-footer button[type=button]');
    // Native dialog.close() queues the close listener. Wait for its actual disposal before
    // opening another dialog with the same ID, rather than selecting the old hidden button.
    await frame.waitForFunction(()=>!document.getElementById('jueony-header-footer'));assert.equal((await header()).exists,false);
    await command('page:header-footer-dialog');await frame.click('#jueony-header-footer button[type=submit]');
    await frame.waitForSelector('#jueony-header-footer',{hidden:true});assert.equal((await header()).exists,true);
    // Undo directly inside the header, exercising the production history/mode transition.
    await command('edit:undo');assert.equal((await header()).exists,false);await command('edit:redo');assert.equal((await header()).exists,true);
    const saved=await saveBytes('header-created.hwpx'),read=new HwpDocument(new Uint8Array(saved));try{assert.equal(parse(read.getHeaderFooter(0,true,0)).exists,true);}finally{read.free();}
    const doc=new HwpDocument(new Uint8Array(await fixture()));let bytes;
    try{doc.createHeaderFooter(0,true,0);doc.insertTextInHeaderFooter(0,true,0,0,0,'EXISTING HEADER 2026');bytes=[...doc.exportHwpx()];}finally{doc.free();}
    await openBytes(bytes,'existing-header.hwpx');const original=await header(),before=await snapshot();
    await command('page:header-footer-dialog');await frame.click('#jueony-header-footer button[type=submit]');await frame.waitForSelector('#jueony-header-footer',{hidden:true});
    assert.deepEqual(await header(),original);assert.equal((await snapshot()).revision,before.revision);
    await focusBody();await saveBytes('header-preserved.hwpx');
  });

  await scenario('manual table caption position/removal form single undo steps and survive saving',async()=>{
    const frame=await openFixture('schedule-table.hwpx');
    const select=()=>frame.evaluate(()=>{const s=window.__parityServices,ih=s.getInputHandler();ih.cursor.exitCellSelectionMode();ih.cursor.enterTableObjectSelectionDirect(0,1,0);ih.updateCaret();ih.focus();s.eventBus.emit('command-state-changed');});
    const props=()=>frame.evaluate(()=>window.__parityServices.wasm.getTableProperties(0,1,0));
    assert.equal((await props()).hasCaption,false);await select();await command('insert:caption-rm');
    assert.equal((await props()).hasCaption,true);assert.equal((await props()).captionDirection,1);assert.equal((await props()).captionVertAlign,1);
    await command('edit:undo');assert.equal((await props()).hasCaption,false);await command('edit:redo');assert.equal((await props()).hasCaption,true);
    await select();await command('insert:caption-none');assert.equal((await props()).hasCaption,false);await command('edit:undo');assert.equal((await props()).hasCaption,true);
    const bytes=await saveBytes('table-caption.hwpx'),doc=new HwpDocument(new Uint8Array(bytes));
    try{const saved=parse(doc.getTableProperties(0,1,0));assert.equal(saved.hasCaption,true);assert.equal(saved.captionDirection,1);assert.equal(saved.captionVertAlign,1);}finally{doc.free();}
  });

  for(const extension of ['hwp','hwpx'])await scenario(`${extension}: Agent style/columns/page-hide batch uses live snapshot, persists and undoes as one request`,async()=>{
    const frame=await openFixture('three-paragraphs.'+extension),before=await snapshot();
    assert.ok(before.structure.styles.some(style=>style.id===1),'style registry missing');
    const receipt=await frame.evaluate(async()=>{
      const api=window.jueonyEditor,base=api.snapshot();
      return api.apply(crypto.randomUUID(),base,{message:'합성 구조 편집',sourceIds:[],operations:[
        {kind:'apply_paragraph_style',target:base.nodes[0].id,styleId:1},
        {kind:'set_columns',section:0,count:2,spacingMm:8},
        {kind:'set_page_hide',target:base.nodes[0].id,properties:{hideHeader:true,hidePageNum:true}},
      ]});
    });
    const after=await snapshot();assert.equal(after.structure.sections[0].columns.columnCount,2);
    assert.equal(after.structure.paragraphs[0].style.id,1);assert.equal(after.structure.paragraphs[0].pageHide.hideHeader,true);
    assert.deepEqual(after.nodes.map(n=>n.text),before.nodes.map(n=>n.text));assert.equal(receipt.operationCount,3);
    const saved=await saveBytes('agent-style-columns-hide.'+extension),doc=new HwpDocument(new Uint8Array(saved));
    try{assert.equal(parse(doc.getColumnDef(0)).columnCount,2);assert.equal(parse(doc.getStyleAt(0,0)).id,1);assert.equal(parse(doc.getPageHide(0,0)).hidePageNum,true);}finally{doc.free();}
    await frame.evaluate(receipt=>window.jueonyEditor.undoRequest(receipt),receipt);
    assert.deepEqual((await snapshot()).structure,before.structure);
    const revision=(await snapshot()).revision;
    const rejection=await frame.evaluate(async()=>{const api=window.jueonyEditor,base=api.snapshot();try{await api.apply(crypto.randomUUID(),base,{message:'거부 검증',sourceIds:[],operations:[{kind:'set_columns',section:0,count:6,spacingMm:100}]});return '';}catch(error){return error.message;}});
    assert.ok(rejection,'impossible geometry should be rejected');assert.equal((await snapshot()).revision,revision);
  });

  if(typeof HwpDocument.prototype.insertDocumentBytes==='function') {
    for(const sourceFormat of ['hwp','hwpx'])for(const extension of ['hwp','hwpx'])await scenario(`${sourceFormat} into ${extension}: document insertion Ctrl+O, file preflight, one undo/redo and guarded save`,async()=>{
      const source=new HwpDocument(new Uint8Array(await fixture('schedule-table.hwpx')));
      const sourcePath=resolve(out,`import-source-${sourceFormat}-to-${extension}.${sourceFormat}`),sourceBytes=source[sourceFormat==='hwp'?'exportHwp':'exportHwpx']();source.free();await writeFile(sourcePath,sourceBytes);
      const destination=HwpDocument.createEmpty();destination.createBlankDocument();destination.insertText(0,0,0,'앞😀뒤');
      const bytes=[...destination[extension==='hwp'?'exportHwp':'exportHwpx']()];destination.free();const frame=await openBytes(bytes,`insert-destination.${extension}`);
      await frame.evaluate(()=>{const ih=window.__parityServices.getInputHandler();ih.cursor.moveTo({sectionIndex:0,paragraphIndex:0,charOffset:2});ih.updateCaret();ih.focus();});
      const before=await snapshot(),pageBefore=before.structure.sections[0];
      await chord('Control','o');await frame.waitForSelector('[data-jueony-document-insertion]');
      await (await frame.$('input[aria-label="끼워 넣을 한글 문서"]')).uploadFile(sourcePath);
      await frame.waitForFunction(()=>document.querySelector('[data-jueony-document-insertion] [role=status]')?.textContent.includes('사전 검사 통과'),{timeout:30000});
      assert.equal((await snapshot()).revision,before.revision);assert.equal(await frame.evaluate(()=>window.jueonyEditor.state().dirty),false);
      await frame.click('.modal-overlay .dialog-btn-primary');await frame.waitForFunction(()=>!document.querySelector('[data-jueony-document-insertion]'));
      const after=await snapshot();assert.notEqual(after.revision,before.revision);assert.equal(after.nodes[0].text.startsWith('앞😀'),true);assert.ok(after.structure.tables.length>0);
      // Numbering editability and header creation eligibility are derived capabilities: adding a table changes them,
      // while every stored page/tab/numbering property must stay unchanged.
      const settingsOnly=entry=>{const result=structuredClone(entry);if(result.lineNumbers)delete result.lineNumbers.editable;for(const header of result.headerFooters??[])delete header.creatable;return result;};
      assert.deepEqual(settingsOnly(after.structure.sections[0]),settingsOnly(pageBefore));
      if(pageBefore.headerFooters?.some(h=>h.creatable!==undefined)){assert.ok(pageBefore.headerFooters.every(h=>h.creatable===true));assert.ok(after.structure.sections[0].headerFooters.every(h=>h.creatable===false));}
      if(after.structure.sections[0].lineNumbers){assert.equal(pageBefore.lineNumbers.editable,true);assert.equal(after.structure.sections[0].lineNumbers.editable,false);}
      await command('edit:undo');assert.deepEqual((await snapshot()).nodes.map(n=>n.text),before.nodes.map(n=>n.text));assert.deepEqual((await snapshot()).structure,before.structure);
      await command('edit:redo');assert.deepEqual((await snapshot()).structure,after.structure);
      const saved=await saveBytes(`inserted-${sourceFormat}-to-${extension}.${extension}`);await openBytes(saved,`insert-reopen.${extension}`);assert.deepEqual((await snapshot()).structure,after.structure);
      assert.deepEqual(new Uint8Array(await readFile(sourcePath)),sourceBytes);
    });
    await scenario('document insertion cancel, invalid file and revision conflict never change the live document',async()=>{
      const sourcePath=resolve(out,'import-simple.hwpx');await writeFile(sourcePath,new Uint8Array(await fixture()));
      const invalidPath=resolve(out,'invalid-import.hwpx');await writeFile(invalidPath,'invalid HWPX');
      const frame=await openFixture(),before=await snapshot();
      await command('ext:jueony-insert-document');await (await frame.$('input[aria-label="끼워 넣을 한글 문서"]')).uploadFile(invalidPath);
      await frame.waitForFunction(()=>{const s=document.querySelector('[data-jueony-document-insertion] [role=status]')?.textContent;return s&&!s.includes('검사하고')&&!s.includes('로컬 파일');});
      await frame.click('.modal-overlay .dialog-btn-primary');assert.equal((await snapshot()).revision,before.revision);
      await (await frame.$('input[aria-label="끼워 넣을 한글 문서"]')).uploadFile(sourcePath);await frame.waitForFunction(()=>document.querySelector('[data-jueony-document-insertion] [role=status]')?.textContent.includes('사전 검사 통과'));
      await page.keyboard.press('Escape');assert.equal((await snapshot()).revision,before.revision);
      await command('ext:jueony-insert-document');await (await frame.$('input[aria-label="끼워 넣을 한글 문서"]')).uploadFile(sourcePath);await frame.waitForFunction(()=>document.querySelector('[data-jueony-document-insertion] [role=status]')?.textContent.includes('사전 검사 통과'));
      await frame.evaluate(()=>{const ih=window.__parityServices.getInputHandler();ih.executeOperation({kind:'snapshot',operationType:'test-concurrent-edit',operation:wasm=>{wasm.insertText(0,0,0,'나중 변경');return ih.getCursorPosition();}});});
      const changed=await snapshot();await frame.click('.modal-overlay .dialog-btn-primary');assert.equal((await snapshot()).revision,changed.revision);
      assert.match(await frame.$eval('[data-jueony-document-insertion] [role=status]',e=>e.textContent),/문서나 커서가 바뀌/);await page.keyboard.press('Escape');
    });
    await scenario('document insertion rejects source headers/multiple sections and disables cell/selection targets',async()=>{
      const frame=await openFixture(),before=await snapshot();
      for(const kind of ['header','sections']){
        const doc=HwpDocument.createEmpty();doc.createBlankDocument();doc.insertText(0,0,0,'삽입 금지');if(kind==='header')doc.createHeaderFooter(0,true,0);else doc.insertSectionBreak(0,0,1);
        const path=resolve(out,`unsupported-${kind}.hwpx`);await writeFile(path,doc.exportHwpx());doc.free();await command('ext:jueony-insert-document');
        await (await frame.$('input[aria-label="끼워 넣을 한글 문서"]')).uploadFile(path);
        await frame.waitForFunction(()=>{const s=document.querySelector('[data-jueony-document-insertion] [role=status]')?.textContent;return s&&!s.includes('검사하고')&&!s.includes('로컬 파일');});
        assert.doesNotMatch(await frame.$eval('[data-jueony-document-insertion] [role=status]',e=>e.textContent),/사전 검사 통과/);
        await frame.click('.modal-overlay .dialog-btn-primary');assert.equal((await snapshot()).revision,before.revision);await page.keyboard.press('Escape');
      }
      await frame.evaluate(()=>{const ih=window.__parityServices.getInputHandler();ih.cursor.selectRange({sectionIndex:0,paragraphIndex:0,charOffset:0},{sectionIndex:0,paragraphIndex:0,charOffset:1});ih.updateCaret();});
      assert.equal(await frame.evaluate(()=>window.rhwpStudio.automation.isEnabled('ext:jueony-insert-document')),false);
      await openFixture('schedule-table.hwpx');await frame.evaluate(()=>{const ih=window.__parityServices.getInputHandler();ih.cursor.moveTo({sectionIndex:0,parentParaIndex:1,paragraphIndex:0,charOffset:0,controlIndex:0,cellIndex:0,cellParaIndex:0,cellPath:[{controlIndex:0,cellIndex:0,cellParaIndex:0}]});ih.updateCaret();});
      assert.equal(await frame.evaluate(()=>window.rhwpStudio.automation.isEnabled('ext:jueony-insert-document')),false);
    });
    await scenario('document insertion is disabled for an actually password-opened document',async()=>{
      const doc=HwpDocument.createEmpty();doc.createBlankDocument();doc.insertText(0,0,0,'암호 문서 원문');
      const password='jueony-synthetic-only',bytes=[...doc.exportHwpWithPassword(password)];doc.free();const frame=await openFixture();
      await frame.evaluate((bytes,password)=>{
        const s=window.__parityServices;s.wasm.loadDocumentWithPassword(new Uint8Array(bytes),password,'encrypted-test.hwp');
        const ih=s.getInputHandler();ih.cursor.clearSelection();ih.cursor.moveTo({sectionIndex:0,paragraphIndex:0,charOffset:0});ih.updateCaret();
      },bytes,password);
      const before=await snapshot();assert.equal(await frame.evaluate(()=>window.__parityServices.wasm.requiresPasswordForSave),true);
      assert.equal(await frame.evaluate(()=>window.rhwpStudio.automation.isEnabled('ext:jueony-insert-document')),false);
      const result=await frame.evaluate(()=>window.jueonyEditor.executeCommand('ext:jueony-insert-document'));assert.equal(result.ok,false);
      assert.equal((await snapshot()).revision,before.revision);assert.equal(await frame.$('[data-jueony-document-insertion]'),null);
    });
  }

  await scenario('style list arrow/Home/End navigation retains modal focus and document state',async()=>{
    const frame=await openFixture(),before=await snapshot();await command('format:style-dialog');await frame.focus('.sd-style-item');
    await page.keyboard.press('ArrowDown');assert.equal(await frame.$$eval('.sd-style-item',items=>items.indexOf(document.activeElement)),1);
    await page.keyboard.press('End');assert.equal(await frame.$$eval('.sd-style-item',items=>items.indexOf(document.activeElement)),await frame.$$eval('.sd-style-item',items=>items.length-1));
    await page.keyboard.press('Home');assert.equal(await frame.$$eval('.sd-style-item',items=>items.indexOf(document.activeElement)),0);
    assert.equal((await snapshot()).revision,before.revision);await page.keyboard.press('Escape');assert.equal((await snapshot()).revision,before.revision);
  });
  for(const extension of ['hwp','hwpx'])await scenario(`${extension}: style clone retains definitions and one-step undo/save without changing body`,async()=>{
    const doc=HwpDocument.createEmpty();doc.createBlankDocument();doc.insertText(0,0,0,'스타일 원문');
    const id=doc.createStyle(JSON.stringify({name:'복제 원본',englishName:'CloneSource',nextStyleId:0}));doc.updateStyle(id,JSON.stringify({nextStyleId:id}));doc.updateStyleShapes(id,JSON.stringify({bold:true,fontSize:1300}),'{}');doc.applyStyle(0,0,id);
    const bytes=[...doc[extension==='hwp'?'exportHwp':'exportHwpx']()];doc.free();const frame=await openBytes(bytes,`style-clone.${extension}`),before=await snapshot();
    const details=await frame.evaluate(id=>window.__parityServices.wasm.getStyleDetail(id),id);
    await page.keyboard.press('F6');await frame.click('[data-jueony-clone-style]');
    const clone=await frame.evaluate(()=>window.__parityServices.wasm.getStyleList().find(s=>s.name==='복제 원본 복사'));assert.ok(clone);assert.equal(clone.type,0);assert.equal(clone.nextStyleId,clone.id);assert.equal(clone.englishName,'');
    assert.deepEqual(await frame.evaluate(id=>window.__parityServices.wasm.getStyleDetail(id),clone.id),details);
    await page.keyboard.press('Escape');assert.deepEqual((await snapshot()).nodes.map(n=>n.text),before.nodes.map(n=>n.text));
    await command('edit:undo');assert.equal(await frame.evaluate(()=>window.__parityServices.wasm.getStyleList().some(s=>s.name==='복제 원본 복사')),false);
    await command('edit:redo');const saved=await saveBytes(`style-clone.${extension}`);const reopened=new HwpDocument(new Uint8Array(saved));try{const next=parse(reopened.getStyleList()).find(s=>s.name==='복제 원본 복사');assert.equal(next.nextStyleId,next.id);assert.equal(parse(reopened.getStyleDetail(next.id)).charProps.bold,true);}finally{reopened.free();}
  });
  for(const extension of ['hwp','hwpx'])await scenario(`${extension}: style character type and deferred font shape commit cancel/undo/save correctly`,async()=>{
    const frame=await openFixture(),name=`style-create.${extension}`,bytes=await frame.evaluate(extension=>[...window.__parityServices.wasm.borrowDocumentHandle()[extension==='hwp'?'exportHwp':'exportHwpx']()],extension);await openBytes(bytes,name);
    const before=await snapshot(),baseline=await frame.evaluate(()=>[...window.__parityServices.wasm.exportHwp()]);
    await command('format:style-dialog');await frame.click('.sd-icon-btn');await frame.waitForSelector('.se-body');
    await frame.click('.se-type-radios input[value="1"]');assert.equal(await frame.$eval('.se-shape-btn',b=>b.disabled),true);
    await frame.$eval('[aria-label="스타일 이름"]',e=>{e.value='새 글자 스타일';});
    await frame.click('.se-shape-btns button:nth-child(2)');
    await frame.waitForSelector('.cs-dialog');
    await frame.evaluate(()=>{const dialog=[...document.querySelectorAll('.modal-overlay')].at(-1),select=[...dialog.querySelectorAll('select')].find(s=>[...s.options].some(o=>o.value==='함초롬바탕'));const option=document.createElement('option');option.value='JueonySyntheticStyleFont';option.textContent=option.value;select.append(option);select.value=option.value;});
    await frame.click('.cs-dialog .dialog-btn-primary');
    assert.deepEqual(await frame.evaluate(()=>[...window.__parityServices.wasm.exportHwp()]),baseline);
    await frame.click('.se-shape-btns button:nth-child(2)');
    assert.equal(await frame.evaluate(()=>{const dialog=[...document.querySelectorAll('.modal-overlay')].at(-1);return [...dialog.querySelectorAll('select')].some(s=>s.value==='JueonySyntheticStyleFont');}),true);
    await page.keyboard.press('Escape');await page.keyboard.press('Escape');assert.equal((await snapshot()).revision,before.revision);assert.deepEqual(await frame.evaluate(()=>[...window.__parityServices.wasm.exportHwp()]),baseline);
    await frame.click('.sd-icon-btn');await frame.click('.se-type-radios input[value="1"]');await frame.$eval('[aria-label="스타일 이름"]',e=>e.value='확정 글자 스타일');
    await frame.click('.se-shape-btns button:nth-child(2)');await frame.evaluate(()=>{const dialog=[...document.querySelectorAll('.modal-overlay')].at(-1),select=[...dialog.querySelectorAll('select')].find(s=>[...s.options].some(o=>o.value==='함초롬바탕'));const o=document.createElement('option');o.value='JueonySyntheticStyleFont';o.textContent=o.value;select.append(o);select.value=o.value;});await frame.click('.cs-dialog .dialog-btn-primary');
    await frame.click('.se-body + .dialog-footer .dialog-btn-primary');await frame.waitForSelector('.se-body',{hidden:true});
    const created=await frame.evaluate(()=>window.__parityServices.wasm.getStyleList().find(s=>s.name==='확정 글자 스타일'));assert.equal(created.type,1);
    assert.equal((await frame.evaluate(id=>window.__parityServices.wasm.getStyleDetail(id),created.id)).charProps.fontFamily,'JueonySyntheticStyleFont');
    await page.keyboard.press('Escape');await command('edit:undo');assert.deepEqual(await frame.evaluate(()=>[...window.__parityServices.wasm.exportHwp()]),baseline);
    await command('edit:redo');const saved=await saveBytes(`style-character.${extension}`),reopened=new HwpDocument(new Uint8Array(saved));try{assert.equal(parse(reopened.getStyleList()).find(s=>s.name==='확정 글자 스타일').type,1);}finally{reopened.free();}
  });
  for(const extension of ['hwp','hwpx'])await scenario(`${extension}: deleting styles remaps flat-cell references and retains text/format in one undo`,async()=>{
    const doc=new HwpDocument(new Uint8Array(await fixture('schedule-table.hwpx'))),deleted=doc.createStyle(JSON.stringify({name:'삭제 대상'})),kept=doc.createStyle(JSON.stringify({name:'남을 스타일'}));
    doc.applyCellStyle(0,1,0,0,0,deleted);doc.applyCellStyle(0,1,0,1,0,kept);doc.applyStyle(0,0,kept);const bytes=[...doc[extension==='hwp'?'exportHwp':'exportHwpx']()];doc.free();const frame=await openBytes(bytes,`style-delete.${extension}`),before=await snapshot();
    await command('format:style-dialog');await frame.$$eval('.sd-style-item',items=>items.find(e=>e.textContent.includes('삭제 대상')).click());await frame.click('.sd-icon-btn:nth-child(3)');
    assert.equal((await frame.evaluate(()=>window.__parityServices.wasm.getCellStyleAt(0,1,0,0,0))).id,0);
    assert.equal((await frame.evaluate(()=>window.__parityServices.wasm.getCellStyleAt(0,1,0,1,0))).name,'남을 스타일');
    await page.keyboard.press('Escape');assert.deepEqual((await snapshot()).nodes.map(n=>n.text),before.nodes.map(n=>n.text));await command('edit:undo');assert.deepEqual((await snapshot()).structure,before.structure);
    await command('edit:redo');const saved=await saveBytes(`style-deleted.${extension}`),reopened=new HwpDocument(new Uint8Array(saved));try{assert.equal(parse(reopened.getCellStyleAt(0,1,0,1,0)).name,'남을 스타일');assert.equal(parse(reopened.getCellStyleAt(0,1,0,0,0)).id,0);}finally{reopened.free();}
  });
  for(const extension of ['hwp','hwpx'])await scenario(`${extension}: style edit renames identity, propagates body and cell size, keeps overrides and no-op undo state`,async()=>{
    const doc=new HwpDocument(new Uint8Array(await fixture('schedule-table.hwpx'))),id=doc.createStyle(JSON.stringify({name:'편집 원본',englishName:'EditOriginal'}));
    doc.applyStyle(0,0,id);doc.applyCellStyle(0,1,0,0,0,id);doc.applyCharFormat(0,0,1,2,JSON.stringify({italic:true}));
    const bytes=[...doc[extension==='hwp'?'exportHwp':'exportHwpx']()];doc.free();const frame=await openBytes(bytes,`style-edit.${extension}`),before=await snapshot();
    await command('format:style-dialog');await frame.click('.sd-icon-btn:nth-child(2)');await frame.click('.se-body + .dialog-footer .dialog-btn-primary');
    await page.keyboard.press('Escape');assert.equal((await snapshot()).revision,before.revision);
    await command('format:style-dialog');await frame.click('.sd-icon-btn:nth-child(2)');await frame.$eval('[aria-label="스타일 이름"]',e=>e.value='편집 완료');
    await frame.click('.se-shape-btns button:nth-child(2)');
    await frame.$eval('.cs-dialog input[type=number]',e=>{e.value='16';e.dispatchEvent(new Event('input',{bubbles:true}));});await frame.click('.cs-dialog .dialog-btn-primary');
    await frame.click('.se-body + .dialog-footer .dialog-btn-primary');await frame.waitForSelector('.se-body',{hidden:true});await page.keyboard.press('Escape');
    assert.equal((await frame.evaluate(id=>window.__parityServices.wasm.getStyleList().find(s=>s.id===id),id)).name,'편집 완료');
    assert.equal(await frame.evaluate(()=>window.__parityServices.wasm.getCharPropertiesAt(0,0,0).fontSize),1600);
    assert.equal(await frame.evaluate(()=>window.__parityServices.wasm.getCharPropertiesAt(0,0,1).italic),true);
    assert.equal(await frame.evaluate(()=>window.__parityServices.wasm.getCellCharPropertiesAt(0,1,0,0,0,0).fontSize),1600);
    await command('edit:undo');assert.deepEqual((await snapshot()).structure,before.structure);await command('edit:redo');
    const saved=await saveBytes(`style-edited.${extension}`),reopened=new HwpDocument(new Uint8Array(saved));try{assert.equal(parse(reopened.getStyleList()).find(s=>s.id===id).name,'편집 완료');assert.equal(parse(reopened.getCharPropertiesAt(0,0,0)).fontSize,1600);}finally{reopened.free();}
  });
  await scenario('style editing rejects duplicate names and concurrent document changes without applying pending formats',async()=>{
    const frame=await openFixture();await command('format:style-dialog');await frame.click('.sd-icon-btn');
    await frame.$eval('[aria-label="스타일 이름"]',e=>e.value='바탕글');const before=await snapshot();await frame.click('.se-body + .dialog-footer .dialog-btn-primary');assert.equal((await snapshot()).revision,before.revision);
    assert.match(await frame.$eval('.se-body [role=alert]',e=>e.textContent),/같은 이름/);await frame.$eval('[aria-label="스타일 이름"]',e=>e.value='충돌 스타일');
    await frame.evaluate(()=>{const ih=window.__parityServices.getInputHandler();ih.executeOperation({kind:'snapshot',operationType:'test-style-concurrent',operation:wasm=>{wasm.insertText(0,0,0,'후속');return ih.getPosition();}});});
    const changed=await snapshot();await frame.click('.se-body + .dialog-footer .dialog-btn-primary');assert.equal((await snapshot()).revision,changed.revision);assert.match(await frame.$eval('.se-body [role=alert]',e=>e.textContent),/문서 상태가 바뀌/);
    await page.keyboard.press('Escape');await frame.click('.sd-icon-btn');assert.equal(await frame.$('.se-body'),null);
    assert.match(await frame.$eval('.sd-body [role=alert]',e=>e.textContent),/문서 상태가 바뀌/);await page.keyboard.press('Escape');
  });

  await scenario('recovery options off retain old checkpoint; idle 5 seconds saves dirty changes and restores after reload',async()=>{
    await openFixture();await settings(true);await replaceFirst('RECOVERY BASELINE');await delay(6500);
    let records=await storedDocuments(),baseline=records.find(record=>firstText(record.bytes)==='RECOVERY BASELINE');assert.ok(baseline,'enabled recovery checkpoint missing');
    await settings(false);await replaceFirst('MUST NOT RECOVER DISABLED');await delay(11000);
    records=await storedDocuments();assert.equal(firstText(records.find(record=>record.id===baseline.id).bytes),'RECOVERY BASELINE');
    await page.reload();await ready();assert.equal((await snapshot()).nodes[0].text,'RECOVERY BASELINE');
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('rhwp-settings')).autosave.idleSaveEnabled),false);
    await settings(true);await replaceFirst('RECOVERY ENABLED AGAIN');await delay(6500);
    records=await storedDocuments();assert.equal(firstText(records.find(record=>record.id===baseline.id).bytes),'RECOVERY ENABLED AGAIN');
    await page.reload();await ready();assert.equal((await snapshot()).nodes[0].text,'RECOVERY ENABLED AGAIN');
  });

  for(const format of ['hwp','hwpx'])await scenario(`${format}: selected character style preserves unselected runs and one undo/save roundtrip`,async()=>{
    const source=new HwpDocument(new Uint8Array(await fixture())),id=source.createStyle(JSON.stringify({name:'선택 강조',type:1}));
    source.updateStyleShapes(id,JSON.stringify({bold:true,fontSize:1800}),'{}');
    const data=[...source[format==='hwp'?'exportHwp':'exportHwpx']()];source.free();
    const frame=await openBytes(data,'selected-style.'+format),before=await snapshot();
    await frame.evaluate(()=>{const ih=window.__parityServices.getInputHandler();ih.cursor.selectRange({sectionIndex:0,paragraphIndex:0,charOffset:1},{sectionIndex:0,paragraphIndex:0,charOffset:4},null);ih.updateCaret();});
    await command('format:apply-style',{styleId:id});
    const check=await frame.evaluate(()=>{const w=window.__parityServices.wasm;return [w.getCharPropertiesAt(0,0,0),w.getCharPropertiesAt(0,0,2),w.getCharPropertiesAt(0,0,4),w.getStyleAt(0,0)];});
    assert.equal(check[1].bold,true);assert.equal(check[1].fontSize,1800);assert.notEqual(check[0].fontSize,1800);assert.notEqual(check[2].fontSize,1800);assert.equal(check[3].id,0);
    assert.deepEqual((await snapshot()).nodes.map(n=>n.text),before.nodes.map(n=>n.text));
    await command('edit:undo');assert.deepEqual((await snapshot()).structure,before.structure);await command('edit:redo');
    const bytes=await saveBytes('selected-style-saved.'+format),reopened=new HwpDocument(new Uint8Array(bytes));
    try{assert.equal(parse(reopened.getCharPropertiesAt(0,0,2)).fontSize,1800);assert.notEqual(parse(reopened.getCharPropertiesAt(0,0,0)).fontSize,1800);}finally{reopened.free();}
  });
  await scenario('Enter at paragraph end follows next style and undo restores the original document',async()=>{
    const source=new HwpDocument(new Uint8Array(await fixture())),next=source.createStyle(JSON.stringify({name:'다음 본문'})),title=source.createStyle(JSON.stringify({name:'제목 연결',nextStyleId:next}));
    source.applyStyle(0,0,title);const data=[...source.exportHwpx()];source.free();
    const frame=await openBytes(data,'next-style.hwpx'),before=await snapshot();
    await frame.evaluate(()=>{const s=window.__parityServices,ih=s.getInputHandler();ih.cursor.moveTo({sectionIndex:0,paragraphIndex:0,charOffset:s.wasm.getParagraphLength(0,0)});ih.updateCaret();ih.focus();});
    await page.keyboard.press('Enter');
    assert.equal(await frame.evaluate(()=>window.__parityServices.wasm.getStyleAt(0,1).name),'다음 본문');
    assert.equal((await snapshot()).nodes.length,before.nodes.length+1);await command('edit:undo');assert.deepEqual((await snapshot()).structure,before.structure);
    await command('edit:redo');assert.equal(await frame.evaluate(()=>window.__parityServices.wasm.getStyleAt(0,1).name),'다음 본문');
  });
  await scenario('style manager moves definitions together with body references, blocks fallback and undo restores order',async()=>{
    const source=new HwpDocument(new Uint8Array(await fixture())),a=source.createStyle(JSON.stringify({name:'순서 첫째'})),b=source.createStyle(JSON.stringify({name:'순서 둘째',nextStyleId:a}));
    source.applyStyle(0,0,b);const data=[...source.exportHwpx()];source.free();const frame=await openBytes(data,'style-order.hwpx'),before=await snapshot();
    await command('format:style-dialog');await frame.click('[data-jueony-move-style="-1"]');
    assert.equal(await frame.evaluate(()=>window.__parityServices.wasm.getStyleAt(0,0).name),'순서 둘째');
    assert.equal(await frame.evaluate(b=>window.__parityServices.wasm.getStyleList().find(s=>s.name==='순서 둘째').id,b),a);
    await page.keyboard.press('Escape');await command('edit:undo');assert.deepEqual((await snapshot()).structure,before.structure);
    await command('edit:redo');const saved=await saveBytes('style-order-saved.hwpx'),reopened=new HwpDocument(new Uint8Array(saved));try{assert.equal(parse(reopened.getStyleAt(0,0)).name,'순서 둘째');assert.equal(parse(reopened.getStyleList()).find(s=>s.name==='순서 둘째').id,a);}finally{reopened.free();}
  });
  if(pageErrors.length)failures.push({name:'browser errors',errors:pageErrors});
  if(external.length)failures.push({name:'offline asset boundary',external});
  await page.screenshot({path:resolve(out,'features.png')});
  await writeFile(resolve(out,'result.json'),JSON.stringify({results,failures,pageErrors,browserDialogs,consoleErrors,externalRequests:external,build:await page.evaluate(()=>fetch('/build-evidence.json').then(r=>r.json())),note:'Isolated headless Edge profile, synthetic files/OPFS and memory model store. Manual command/UI tests use a test extension to position cursors and read engine values. No paid model or native Hancom comparison.'},null,2));
  if(failures.length)process.exitCode=1;
}catch(error){console.error(error);process.exitCode=1;await page?.screenshot({path:resolve(out,'fatal.png')}).catch(()=>{});await writeFile(resolve(out,'fatal.json'),JSON.stringify({error:String(error),stack:error.stack,results,failures,pageErrors,external},null,2));}
finally{await browser?.close();server.kill();}
