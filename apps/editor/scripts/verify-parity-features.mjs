import puppeteer from 'puppeteer-core';
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import init,{HwpDocument} from '@rhwp/core';

const app=resolve(dirname(fileURLToPath(import.meta.url)),'..'),repo=resolve(app,'../..');
const port=4210,origin=`http://127.0.0.1:${port}`,out=resolve(app,process.env.JUEONY_TEST_OUTPUT??'evidence/parity-features');
const dist=resolve(app,process.env.JUEONY_TEST_DIST??'evidence/dist-features');
await mkdir(out,{recursive:true});
await init({module_or_path:await readFile(resolve(app,'node_modules/@rhwp/core/rhwp_bg.wasm'))});
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
    await command('page:header-footer-dialog');await frame.click('#jueony-header-footer button[type=button]');assert.equal((await header()).exists,false);
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

  if(pageErrors.length)failures.push({name:'browser errors',errors:pageErrors});
  if(external.length)failures.push({name:'offline asset boundary',external});
  await page.screenshot({path:resolve(out,'features.png')});
  await writeFile(resolve(out,'result.json'),JSON.stringify({results,failures,pageErrors,browserDialogs,consoleErrors,externalRequests:external,build:await page.evaluate(()=>fetch('/build-evidence.json').then(r=>r.json())),note:'Isolated headless Edge profile, synthetic files/OPFS and memory model store. Manual command/UI tests use a test extension to position cursors and read engine values. No paid model or native Hancom comparison.'},null,2));
  if(failures.length)process.exitCode=1;
}catch(error){console.error(error);process.exitCode=1;await page?.screenshot({path:resolve(out,'fatal.png')}).catch(()=>{});await writeFile(resolve(out,'fatal.json'),JSON.stringify({error:String(error),stack:error.stack,results,failures,pageErrors,external},null,2));}
finally{await browser?.close();server.kill();}
