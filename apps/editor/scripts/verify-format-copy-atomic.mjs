import puppeteer from 'puppeteer-core';
import {spawn} from 'node:child_process';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {resolve, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';

const app=resolve(dirname(fileURLToPath(import.meta.url)),'..'),repo=resolve(app,'../..');
if(!process.env.JUEONY_TEST_DIST||!process.env.JUEONY_ENGINE_PACKAGE)throw Error('JUEONY_TEST_DIST and JUEONY_ENGINE_PACKAGE required');
const dist=resolve(process.env.JUEONY_TEST_DIST),pkg=resolve(process.env.JUEONY_ENGINE_PACKAGE);
const out=resolve(process.env.JUEONY_TEST_OUTPUT??'build/format-copy-atomic');await mkdir(out,{recursive:true});
const port=Number(process.env.JUEONY_TEST_PORT??4504),origin=`http://127.0.0.1:${port}`;
if(await fetch(origin+'/api/health').then(()=>true,()=>false))throw Error('Test port occupied');
const {default:init,HwpDocument}=await import(pathToFileURL(resolve(pkg,'rhwp.js')).href);await init({module_or_path:await readFile(resolve(pkg,'rhwp_bg.wasm'))});
const server=spawn(process.execPath,['apps/launcher/server.mjs'],{cwd:repo,windowsHide:true,stdio:'ignore',env:{...process.env,JUEONY_PORT:String(port),JUEONY_DIST:dist,JUEONY_CONNECTION_STORE:'memory'}});
let browser,page;const results=[],failures=[],pageErrors=[],externalRequests=[];
const parse=x=>typeof x==='string'?JSON.parse(x):x;
try{
 for(let i=0;i<100;i++){if(await fetch(origin+'/api/health').then(r=>r.ok,()=>false))break;await new Promise(r=>setTimeout(r,100));}
 browser=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--no-first-run','--disable-background-networking'],defaultViewport:{width:1600,height:1000}});
 page=await browser.newPage();page.on('pageerror',e=>pageErrors.push(String(e)));
 await page.setRequestInterception(true);page.on('request',r=>{if(![origin,'blob:','data:'].some(p=>r.url().startsWith(p))){externalRequests.push(r.url());void r.abort();}else void r.continue();});
 await page.goto(origin);await page.waitForFunction(()=>document.querySelector('#app-status')?.textContent.includes('준비 완료'),{timeout:90000});
 const frame=await(await page.$('.editor-frame:not([hidden])')).contentFrame();
 await frame.evaluate(()=>{const a=window.rhwpStudio.automation;a.registerCommand({id:'ext:copy-inspect',label:'검수',canExecute:()=>true,execute:s=>{window.__copyServices=s;}});a.execute('ext:copy-inspect');a.unregisterCommand('ext:copy-inspect');});
 const command=async id=>{const result=await frame.evaluate(id=>window.jueonyEditor.executeCommand(id),id);assert.equal(result.ok,true,id+': '+JSON.stringify(result));};
 for(const ext of ['hwp','hwpx']){
  try{
   const doc=HwpDocument.createEmpty();doc.createBlankDocument();doc.insertText(0,0,0,'원본모양');doc.splitParagraph(0,0,4);doc.insertText(0,1,0,'대상😀모양');doc.applyCharFormat(0,0,0,4,JSON.stringify({bold:true,fontSize:1400}));doc.applyParaFormat(0,0,JSON.stringify({alignment:'center'}));
   const bytes=[...doc[ext==='hwp'?'exportHwp':'exportHwpx']()];doc.free();
   await frame.evaluate(async(bytes,ext)=>{const root=await navigator.storage.getDirectory(),handle=await root.getFileHandle('format-copy.'+ext,{create:true}),writer=await handle.createWritable();await writer.write(new Uint8Array(bytes));await writer.close();await window.jueonyEditor.open(new Uint8Array(bytes),'format-copy.'+ext,handle,false);const ih=window.__copyServices.getInputHandler();ih.cursor.clearSelection();ih.cursor.moveTo({sectionIndex:0,paragraphIndex:0,charOffset:0});ih.updateCaret();ih.focus();},bytes,ext);
   const state=()=>frame.evaluate(()=>{const s=window.__copyServices;return {char:s.wasm.getCharPropertiesAt(0,1,0),para:s.wasm.getParaPropertiesAt(0,1),text:s.wasm.borrowDocumentHandle().getTextFileUnicode(),selection:s.getInputHandler().cursor.getSelection()};});
   const before=await state();await command('edit:format-copy');
   await frame.evaluate(()=>{const ih=window.__copyServices.getInputHandler();ih.cursor.selectRange({sectionIndex:0,paragraphIndex:1,charOffset:0},{sectionIndex:0,paragraphIndex:1,charOffset:5});ih.updateCaret();ih.focus();});
   const selected=(await state()).selection;await command('edit:format-copy');let after=await state();assert.equal(after.char.bold,true);assert.equal(after.char.fontSize,1400);assert.equal(after.para.alignment,'center');assert.equal(after.text,before.text);assert.deepEqual(after.selection,selected);
   await command('edit:undo');const undone=await state();assert.deepEqual(undone.char,before.char,'one undo restores character format');assert.deepEqual(undone.para,before.para,'one undo restores paragraph format');assert.equal(undone.text,before.text);
   await command('edit:redo');after=await state();assert.equal(after.char.bold,true);assert.equal(after.para.alignment,'center');assert.deepEqual(after.selection,selected);
   const saved=await frame.evaluate(async()=>{const api=window.jueonyEditor;const status=await api.save(),file=await api.fileHandle().getFile();return {status,dirty:api.state().dirty,bytes:[...new Uint8Array(await file.arrayBuffer())]};});assert.equal(saved.status,'saved');assert.equal(saved.dirty,false);await writeFile(resolve(out,'format-copy.'+ext),new Uint8Array(saved.bytes));
   const reopened=new HwpDocument(new Uint8Array(saved.bytes));try{assert.equal(parse(reopened.getCharPropertiesAt(0,1,0)).bold,true);assert.equal(parse(reopened.getCharPropertiesAt(0,1,0)).fontSize,1400);assert.equal(parse(reopened.getParaPropertiesAt(0,1)).alignment,'center');}finally{reopened.free();}
   results.push(ext+': body format copy is one undo/redo with selection and saved formats');
   // A paragraph failure occurs after the character mutation. The outer snapshot must roll both back.
   await frame.evaluate(async(bytes,ext)=>{await window.jueonyEditor.open(new Uint8Array(bytes),'rollback.'+ext,null,false);const ih=window.__copyServices.getInputHandler();ih.cursor.clearSelection();ih.cursor.moveTo({sectionIndex:0,paragraphIndex:0,charOffset:0});ih.focus();},bytes,ext);
   await command('edit:format-copy');
   await frame.evaluate(()=>{const ih=window.__copyServices.getInputHandler();ih.cursor.selectRange({sectionIndex:0,paragraphIndex:1,charOffset:5},{sectionIndex:0,paragraphIndex:1,charOffset:0},1);ih.updateCaret();});
   const capture=()=>frame.evaluate(()=>{const s=window.__copyServices,ih=s.getInputHandler();return {bytes:[...s.wasm.borrowDocumentHandle().exportHwp()],revision:window.jueonyEditor.revision(),undo:ih.history.peekUndoTop()?.type??null,redo:ih.history.peekRedoTop()?.type??null,selection:ih.cursor.getSelection(),block:ih.cursor.blockSelectionPhase()};});
   const faultBefore=await capture();
   const failed=await frame.evaluate(()=>{const s=window.__copyServices,original=s.wasm.applyParaFormat;s.wasm.applyParaFormat=()=>{throw Error('synthetic paragraph format failure');};try{return window.jueonyEditor.executeCommand('edit:format-copy');}finally{s.wasm.applyParaFormat=original;}});
   assert.equal(failed.ok,false);assert.match(failed.message,/synthetic paragraph format failure/);assert.deepEqual(await capture(),faultBefore);assert.ok(await frame.evaluate(()=>window.__copyServices.getInputHandler().formatCopyState));
   results.push(ext+': paragraph failure after character application rolls back bytes, revision, history, selection');
   await command('edit:format-copy');assert.equal((await state()).char.bold,true);await command('edit:undo');assert.deepEqual((await state()).char,before.char);assert.deepEqual((await capture()).selection,faultBefore.selection);assert.equal((await capture()).block,1);await command('edit:redo');assert.deepEqual((await capture()).selection,faultBefore.selection);assert.equal((await capture()).block,1);
   results.push(ext+': retry succeeds and reverse/F3 selection survives undo and redo');
   await frame.evaluate(()=>{const ih=window.__copyServices.getInputHandler();ih.cursor.clearSelection();ih.cursor.moveTo({sectionIndex:0,paragraphIndex:0,charOffset:0});});await command('edit:format-copy');
   await frame.evaluate(async(bytes,ext)=>window.jueonyEditor.open(new Uint8Array(bytes),'swap.'+ext,null,false),bytes,ext);
   assert.equal(await frame.evaluate(()=>window.__copyServices.getInputHandler().formatCopyState),null);
   results.push(ext+': document swap invalidates copied document-local format references');

  }catch(e){failures.push({ext,message:String(e),stack:e.stack});}
 }
}catch(e){failures.push({message:String(e),stack:e.stack});}
finally{await browser?.close();server.kill();}
await writeFile(resolve(out,'result.json'),JSON.stringify({results,failures,pageErrors,externalRequests},null,2));
console.log(JSON.stringify({passed:results.length,failures,pageErrors,externalRequests}));
if(failures.length||pageErrors.length||externalRequests.length)process.exitCode=1;
