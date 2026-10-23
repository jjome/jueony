import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const app=resolve(dirname(fileURLToPath(import.meta.url)),'..'),repo=resolve(app,'../..');
const out=resolve(process.env.JUEONY_TEST_OUTPUT),dist=resolve(process.env.JUEONY_TEST_DIST),pkg=resolve(process.env.JUEONY_ENGINE_PACKAGE);
const port=Number(process.env.JUEONY_TEST_PORT??4503),origin=`http://127.0.0.1:${port}`,delay=ms=>new Promise(r=>setTimeout(r,ms));
await mkdir(out,{recursive:true});const profile=await mkdtemp(join(tmpdir(),'jueony-table-target-'));
const {default:init,HwpDocument}=await import(pathToFileURL(join(pkg,'rhwp.js')).href);await init({module_or_path:await readFile(join(pkg,'rhwp_bg.wasm'))});
if(await fetch(origin).then(()=>true,()=>false))throw new Error('Test port occupied');
const server=spawn(process.execPath,['apps/launcher/server.mjs'],{cwd:repo,windowsHide:true,stdio:'ignore',env:{...process.env,JUEONY_PORT:String(port),JUEONY_DIST:dist,JUEONY_CONNECTION_STORE:'memory'}});
let browser,page,frame,stage='startup';const results=[],errors=[],externalRequests=[];
const languages=['korean','english','chinese','japanese','other','symbol','user'];
const families=['함초롬돋움','serif','맑은 고딕','sans-serif','monospace','함초롬바탕','나눔고딕'];
const definition=(name,values=families)=>({name,...Object.fromEntries(languages.map((lang,index)=>[lang,values[index]]))});
const parse=value=>typeof value==='string'?JSON.parse(value):value;
const pass=name=>{results.push(name);console.log('PASS',name);};
async function launch(){
 browser=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,userDataDir:profile,protocolTimeout:45000,defaultViewport:{width:1700,height:1100},args:['--no-first-run','--disable-background-networking','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
 page=await browser.newPage();page.setDefaultTimeout(15000);page.on('dialog',d=>d.accept());page.on('pageerror',e=>errors.push(String(e)));
 await page.setRequestInterception(true);page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(origin+'/')){externalRequests.push(r.url());void r.abort();}else void r.continue();});
 await page.goto(origin+'/?storage=download');await page.waitForFunction(()=>document.getElementById('app-status')?.textContent.includes('준비 완료'),{timeout:90000});
 frame=await(await page.$('.editor-frame:not([hidden])')).contentFrame();await frame.waitForFunction(()=>window.jueonyEditor?.state&&!window.jueonyEditor.busy());
 await frame.evaluate(()=>{const a=window.rhwpStudio.automation;a.registerCommand({id:'ext:table-size-inspect',label:'검수',canExecute:()=>true,execute:s=>window.__tableServices=s});a.execute('ext:table-size-inspect');a.unregisterCommand('ext:table-size-inspect');});
}
async function openTable(ext='hwpx'){
 const d=HwpDocument.createEmpty();d.createBlankDocument();d.insertText(0,0,0,'표 앞 본문');d.splitParagraph(0,0,d.getParagraphLength(0,0));const t=JSON.parse(d.createTable(0,1,0,2,2));const bytes=[...d[ext==='hwp'?'exportHwp':'exportHwpx']()];d.free();
 await frame.evaluate(async(bytes,t,ext)=>{const root=await navigator.storage.getDirectory(),handle=await root.getFileHandle('table-size.'+ext,{create:true}),writer=await handle.createWritable();await writer.write(new Uint8Array(bytes));await writer.close();await window.jueonyEditor.open(new Uint8Array(bytes),'table-size.'+ext,handle,false);const i=window.__tableServices.getInputHandler();i.cursor.moveTo({sectionIndex:0,parentParaIndex:t.paraIdx,paragraphIndex:0,charOffset:0,controlIndex:t.controlIdx,cellIndex:0,cellParaIndex:0,cellPath:[{controlIndex:t.controlIdx,cellIndex:0,cellParaIndex:0}]});i.updateCaret();i.focus();},bytes,t,ext);
}
const inspect=()=>frame.evaluate(()=>{const a=window.jueonyEditor,i=window.__tableServices.getInputHandler(),w=window.__tableServices.wasm;return{state:a.state(),bytes:[...w.borrowDocumentHandle()[w.fileName.endsWith('.hwp')?'exportHwp':'exportHwpx']()],cell:w.getCellProperties(0,1,0,0),selection:i.getSelection(),cursor:i.getCursorPosition(),history:i.history.peekUndoTop()?.type??null};});
async function show(edit=true){assert.equal((await frame.evaluate(()=>window.jueonyEditor.executeCommand('table:cell-props'))).ok,true);await frame.waitForSelector('.tcp-dialog');if(edit)await frame.evaluate(()=>{const box=document.querySelector('.dialog-tab-panel[data-tab="cell"] input[type="checkbox"]');box.checked=true;box.dispatchEvent(new Event('change',{bubbles:true}));const number=document.querySelector('.dialog-tab-panel[data-tab="cell"] input[type="number"]');number.value='40';number.dispatchEvent(new Event('input',{bubbles:true}));});}
const confirm=()=>frame.locator('.tcp-dialog .dialog-footer .dialog-btn-primary').click();
const cancel=()=>frame.locator('.tcp-dialog .dialog-footer .dialog-btn:not(.dialog-btn-primary)').click();
try{
 for(let i=0;i<100;i++){if(await fetch(origin+'/api/health').then(r=>r.ok,()=>false))break;await delay(100);}await launch();
 for(const ext of ['hwp','hwpx']){
  stage=ext+' no-op and cancel';await openTable(ext);const original=await inspect();await show(false);await confirm();assert.deepEqual(await inspect(),original);await show();await cancel();assert.deepEqual(await inspect(),original);pass(stage+': native dimension precision, bytes, cursor and history preserved');
  stage=ext+' stale replacement';await show();await openTable(ext);const replacement=await inspect();await confirm();assert.ok(await frame.$('.tcp-dialog'));assert.match(await frame.$eval('[data-format-dialog-error]',e=>e.textContent),/변경/);assert.equal(await frame.$eval('.dialog-tab-panel[data-tab="cell"] input[type="number"]',e=>e.value),'40');assert.deepEqual(await inspect(),replacement);await confirm();assert.deepEqual(await inspect(),replacement);await cancel();assert.deepEqual(await inspect(),replacement);pass(stage+': stale form retains input and cancel while preserving replacement document, selection and undo');
  stage=ext+' normal size';await show();await confirm();await frame.waitForSelector('.tcp-dialog',{hidden:true});const changed=await inspect();assert.equal(changed.cell.width,11339);assert.equal((await frame.evaluate(()=>window.jueonyEditor.executeCommand('edit:undo'))).ok,true);assert.equal((await inspect()).cell.width,replacement.cell.width);assert.equal((await frame.evaluate(()=>window.jueonyEditor.executeCommand('edit:redo'))).ok,true);assert.equal((await inspect()).cell.width,11339);
  const saved=await frame.evaluate(async()=>{const a=window.jueonyEditor,result=await a.save(),file=await a.fileHandle().getFile();return{result,bytes:[...new Uint8Array(await file.arrayBuffer())],dirty:a.state().dirty};});assert.equal(saved.result,'saved');assert.equal(saved.dirty,false);await writeFile(join(out,'table-size.'+ext),new Uint8Array(saved.bytes));const reopened=new HwpDocument(new Uint8Array(saved.bytes));try{assert.equal(parse(reopened.getCellProperties(0,1,0,0)).width,11339);}finally{reopened.free();}pass(stage+': actual 40mm width change, undo/redo, safe save and engine reopen');
 }
 assert.deepEqual(errors,[]);assert.deepEqual(externalRequests,[]);await writeFile(join(out,'result.json'),JSON.stringify({pass:true,results,errors,externalRequests,build:JSON.parse(await readFile(join(dist,'build-evidence.json'),'utf8')),limits:['Two simple 2x2 synthetic table fixtures; no native Hancom UI comparison or general size capability expansion']},null,2));
}catch(e){console.error(e);process.exitCode=1;await writeFile(join(out,'failure.json'),JSON.stringify({stage,error:String(e.stack??e),results,errors},null,2));}finally{await browser?.close();server.kill();}
