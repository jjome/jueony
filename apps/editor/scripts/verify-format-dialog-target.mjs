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
await mkdir(out,{recursive:true});const profile=await mkdtemp(join(tmpdir(),'jueony-format-target-'));
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
 await frame.evaluate(()=>{const a=window.rhwpStudio.automation;a.registerCommand({id:'ext:shape-inspect',label:'검수',canExecute:()=>true,execute:s=>window.__shapeServices=s});a.execute('ext:shape-inspect');a.unregisterCommand('ext:shape-inspect');});
}
async function openDocument(ext){
 const doc=HwpDocument.createEmpty();doc.createBlankDocument();doc.insertText(0,0,0,'대표 글꼴 검증ABCDEFGHI');const bytes=[...doc[ext==='hwp'?'exportHwp':'exportHwpx']()];doc.free();
 await frame.evaluate(async(bytes,ext)=>{const root=await navigator.storage.getDirectory(),handle=await root.getFileHandle('format-dialog.'+ext,{create:true}),writer=await handle.createWritable();await writer.write(new Uint8Array(bytes));await writer.close();await window.jueonyEditor.open(new Uint8Array(bytes),'format-dialog.'+ext,handle,false);const input=window.__shapeServices.getInputHandler();input.cursor.selectRange({sectionIndex:0,paragraphIndex:0,charOffset:0},{sectionIndex:0,paragraphIndex:0,charOffset:5});input.updateCaret();input.focus();},bytes,ext);
}
const inspect=()=>frame.evaluate(()=>{const a=window.jueonyEditor,i=window.__shapeServices.getInputHandler(),w=window.__shapeServices.wasm;return{state:a.state(),bytes:[...w.borrowDocumentHandle()[w.fileName.endsWith('.hwp')?'exportHwp':'exportHwpx']()],selection:i.getSelection(),cursor:i.getCursorPosition(),history:i.history.peekUndoTop()?.type??null};});
const confirm=()=>frame.evaluate(()=>[...document.querySelectorAll('.modal-overlay')].at(-1).querySelector('.dialog-btn-primary').click());
const cancel=()=>frame.evaluate(()=>[...document.querySelectorAll('.modal-overlay')].at(-1).querySelector('.cs-right-col .dialog-btn:not(.dialog-btn-primary)').click());
async function openShape(kind){await frame.evaluate(kind=>window.jueonyEditor.executeCommand(kind==='char'?'format:char-shape':'format:para-shape'),kind);await frame.waitForSelector('.modal-overlay');await frame.$eval('.modal-overlay input[type="number"]',(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},kind==='char'?'22':'12');}
const text=()=>frame.evaluate(()=>{const w=window.__shapeServices.wasm;return w.getTextRange(0,0,0,w.getParagraphLength(0,0));});
try{
 for(let i=0;i<100;i++){if(server.exitCode!==null)throw new Error('Server exited');if(await fetch(origin+'/api/health').then(r=>r.ok,()=>false))break;await delay(100);}
 await launch();
 for(const ext of ['hwp','hwpx'])for(const kind of ['char','para']){
  stage=ext+' '+kind;await openDocument(ext);const original=await text(),beforeCancel=await inspect();await openShape(kind);await cancel();assert.deepEqual(await inspect(),beforeCancel);pass(stage+': cancel discards entered formatting without bytes/history/selection changes');
  await frame.evaluate(()=>window.__shapeBase=window.jueonyEditor.snapshot());await openShape(kind);
  await frame.evaluate(async()=>{const a=window.jueonyEditor;await a.apply(crypto.randomUUID(),window.__shapeBase,{message:'합성 Agent 동시 편집',sourceIds:[],operations:[{kind:'replace_body_text',target:'s0p0',start:0,count:0,text:'앞에 새로 삽입된 내용'}]});});
  const before=await inspect();await confirm();assert.ok(await frame.$('.modal-overlay'));assert.match(await frame.$eval('[data-format-dialog-error]',e=>e.textContent),/변경/);assert.equal(await frame.$eval('.modal-overlay input[type="number"]',e=>e.value),kind==='char'?'22':'12');assert.deepEqual(await inspect(),before);
  await confirm();assert.deepEqual(await inspect(),before);await cancel();assert.deepEqual(await inspect(),before);
  assert.equal((await frame.evaluate(()=>window.jueonyEditor.executeCommand('edit:undo'))).ok,true);assert.equal(await text(),original);assert.equal((await frame.evaluate(()=>window.jueonyEditor.executeCommand('edit:redo'))).ok,true);assert.equal(await text(),'앞에 새로 삽입된 내용'+original);
  pass(stage+': concurrent Agent insertion rejects stale target, keeps typed input/cancel available and adds no document or undo mutation');
 }
 for(const kind of ['char','para']){
  stage=kind+' selection only';await openDocument('hwpx');await openShape(kind);const revision=await frame.evaluate(()=>window.jueonyEditor.revision());assert.equal((await frame.evaluate(()=>window.jueonyEditor.executeCommand('edit:select-all'))).ok,true);assert.equal(await frame.evaluate(()=>window.jueonyEditor.revision()),revision);const before=await inspect();await confirm();assert.match(await frame.$eval('[data-format-dialog-error]',e=>e.textContent),/선택/);assert.deepEqual(await inspect(),before);await cancel();assert.deepEqual(await inspect(),before);pass(stage+': ordinary Select All changes selection without revision and rejects the captured range');
  stage=kind+' replaced document';await openDocument('hwpx');await openShape(kind);const previousRevision=await frame.evaluate(()=>window.jueonyEditor.revision());await openDocument('hwp');assert.notEqual(await frame.evaluate(()=>window.jueonyEditor.revision()),previousRevision);const replacement=await inspect();await confirm();assert.match(await frame.$eval('[data-format-dialog-error]',e=>e.textContent),/문서/);assert.deepEqual(await inspect(),replacement);await cancel();assert.deepEqual(await inspect(),replacement);pass(stage+': ordinary open bridge replaces the document and a retained old dialog cannot mutate it');
 }
 for(const ext of ['hwp','hwpx']){
  stage=ext+' normal';await openDocument(ext);await openShape('char');await confirm();await frame.waitForSelector('.modal-overlay',{hidden:true});assert.equal(await frame.evaluate(()=>window.__shapeServices.wasm.getCharPropertiesAt(0,0,1).fontSize),2200);
  await frame.evaluate(()=>window.jueonyEditor.executeCommand('edit:undo'));assert.equal(await frame.evaluate(()=>window.__shapeServices.wasm.getCharPropertiesAt(0,0,1).fontSize),1000);await frame.evaluate(()=>window.jueonyEditor.executeCommand('edit:redo'));
  const saved=await frame.evaluate(async()=>{const a=window.jueonyEditor,result=await a.save(),file=await a.fileHandle().getFile();return{result,bytes:[...new Uint8Array(await file.arrayBuffer())],dirty:a.state().dirty};});assert.equal(saved.result,'saved');assert.equal(saved.dirty,false);await writeFile(join(out,'format-dialog.'+ext),new Uint8Array(saved.bytes));const doc=new HwpDocument(new Uint8Array(saved.bytes));try{assert.equal(parse(doc.getCharPropertiesAt(0,0,1)).fontSize,2200);}finally{doc.free();}pass(stage+': fresh dialog applies, undo/redo and safe save/reopen retain 22pt');
 }
 stage='nested default tab';await openDocument('hwpx');await openShape('para');await frame.locator('.dialog-tab[data-tab="tabStops"]').click();await frame.locator('[data-jueony-default-tab-change]').click();await frame.$eval('[aria-label="기본 탭 간격(pt)"]',e=>e.value='28');await confirm();await frame.waitForSelector('[data-jueony-default-tabs]',{hidden:true});await confirm();await frame.waitForSelector('.modal-overlay',{hidden:true});assert.equal(await frame.evaluate(()=>window.__shapeServices.wasm.getSectionDef(0).defaultTabSpacing),5600);pass('normal nested default-tab commit permits its parent paragraph dialog to apply');
 assert.deepEqual(errors,[]);assert.deepEqual(externalRequests,[]);await writeFile(join(out,'result.json'),JSON.stringify({pass:true,results,errors,externalRequests,build:JSON.parse(await readFile(join(dist,'build-evidence.json'),'utf8')),limits:['Uses actual Agent apply boundary with synthetic operations; no external LLM or native Hancom comparison']},null,2));
}catch(error){console.error(error);process.exitCode=1;await page?.screenshot({path:join(out,'failure.png')}).catch(()=>{});await writeFile(join(out,'failure.json'),JSON.stringify({stage,error:String(error.stack??error),results,errors,externalRequests},null,2));}
finally{await browser?.close();server.kill();}
