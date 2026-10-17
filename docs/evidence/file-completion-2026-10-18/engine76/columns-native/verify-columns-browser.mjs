import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {resolve,join,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadReviewEngine,hash,snapshot,compareSnapshots,differences} from '../../../apps/editor/scripts/lib/hancom-review.mjs';
import {verifyPreservedExport} from '../../../apps/editor/src/adapters/rhwp/preservation.ts';
for(const k of ['JUEONY_REPO','JUEONY_ENGINE_PACKAGE','JUEONY_TEST_DIST','JUEONY_TEST_OUTPUT'])assert.ok(isAbsolute(process.env[k]??''),k+' absolute required');
const repo=resolve(process.env.JUEONY_REPO),out=resolve(process.env.JUEONY_TEST_OUTPUT),dist=resolve(process.env.JUEONY_TEST_DIST);
const puppeteer=createRequire(join(repo,'apps/editor/package.json'))('puppeteer-core');
const engine=await loadReviewEngine(process.env.JUEONY_ENGINE_PACKAGE),build=JSON.parse(await readFile(join(dist,'build-evidence.json'),'utf8'));
assert.equal(build.engineBuild.sourceId,engine.metadata.sourceId);assert.equal(build.engineWasmSha256,engine.metadata.wasmSha256);
const port=Number(process.env.JUEONY_TEST_PORT??4468),origin='http://127.0.0.1:'+port,delay=ms=>new Promise(r=>setTimeout(r,ms));
await mkdir(out,{recursive:true});
const results=[],failures=[],observations=[],pageErrors=[],consoleErrors=[],externalRequests=[];
let server,browser,page,sequence=0;
async function scenario(name,run){try{await run();results.push(name);console.log('PASS',name);}catch(e){failures.push({name,error:String(e),stack:e.stack,comparison:e.comparison});console.error('FAIL',name,e.message);await page?.screenshot({path:join(out,'failure-'+failures.length+'.png')}).catch(()=>{});}}
async function services(){const f=await(await page.$('.editor-frame:not([hidden])')).contentFrame();await f.evaluate(()=>{if(window.__columnReview)return;const a=window.rhwpStudio.automation;a.registerCommand({id:'ext:column-review',label:'검수',canExecute:()=>true,execute:s=>window.__columnReview=s});a.execute('ext:column-review');a.unregisterCommand('ext:column-review');});return f;}
async function open(name){
 const bytes=await readFile(join(repo,'build/file-closure69-overlap',name)),f=await services(),id=++sequence;
 await f.waitForFunction(()=>!window.jueonyEditor.busy());
 await f.evaluate(async({bytes,id})=>{const dir=await(await navigator.storage.getDirectory()).getDirectoryHandle('column-review76',{create:true}),source=await dir.getFileHandle('source-'+id+'.hwp',{create:true}),w=await source.createWritable();await w.write(new Uint8Array(bytes));await w.close();window.__columnSource=source;window.__columnWrites=0;window.__columnPickers=0;await window.jueonyEditor.open(new Uint8Array(bytes),source.name,source,false);},{bytes:[...bytes],id});
 await delay(400);return {f,id,bytes,name};
}
async function probe(f){return f.evaluate(()=>{const api=window.jueonyEditor,s=window.__columnReview,d=s.wasm.borrowDocumentHandle(),h=s.getInputHandler().history;return {dirty:api.state().dirty,revision:api.revision(),snapshot:api.snapshot(),history:{undo:h.undoStack.length,redo:h.redoStack.length,top:h.peekUndoTop()?.type},canvas:d.canvasMetricsActive(),layout:Array.from({length:d.pageCount()},(_,p)=>({controls:JSON.parse(d.getPageControlLayout(p)),text:JSON.parse(d.getPageTextLayout(p))})),bytes:[...s.wasm.exportHwp()]};});}
async function command(f,id){assert.equal((await f.evaluate(id=>window.jueonyEditor.executeCommand(id),id)).ok,true);await delay(120);}
async function target({f,id},format){await f.evaluate(async({id,format})=>{const dir=await(await navigator.storage.getDirectory()).getDirectoryHandle('column-review76',{create:true}),target=await dir.getFileHandle('target-'+id+'.'+format,{create:true}),w=await target.createWritable();await w.write(new Uint8Array([1,2,3]));await w.close();window.__columnTarget=target;const original=target.createWritable.bind(target);target.createWritable=async(...args)=>{window.__columnWrites++;return original(...args);};Object.defineProperty(window,'showSaveFilePicker',{configurable:true,value:async()=>{window.__columnPickers++;return target;}});},{id,format});}
async function saveAs(ctx,format){await command(ctx.f,'file:save-as-'+format);await ctx.f.waitForSelector('.modal-overlay input[type=text]');await ctx.f.$eval('.modal-overlay input[type=text]',(e,id)=>e.value='target-'+id,ctx.id);await ctx.f.click('.modal-overlay .dialog-btn-primary');await ctx.f.waitForFunction(()=>window.__columnWrites===1&&!window.jueonyEditor.busy()&&!window.jueonyEditor.state().dirty&&window.jueonyEditor.fileHandle()===window.__columnTarget,{timeout:25000});}
async function disk(f){return f.evaluate(async()=>({source:[...new Uint8Array(await(await window.__columnSource.getFile()).arrayBuffer())],target:[...new Uint8Array(await(await window.__columnTarget.getFile()).arrayBuffer())],writes:window.__columnWrites,pickers:window.__columnPickers}));}
function strict(live,saved,format){const d=new engine.HwpDocument(new Uint8Array(live)),r=new engine.HwpDocument(new Uint8Array(saved));try{const a=d[format==='hwp'?'exportHwpWithReport':'exportHwpxWithReport']();try{const report=verifyPreservedExport(d,new Uint8Array(saved),format,a.contentLoss(),b=>new engine.HwpDocument(b));assert.equal(report.status,'checked');}finally{a.free();}const c=compareSnapshots(snapshot(d),snapshot(r));if(c.status!=='SAME_WITHIN_PUBLISHED_CONTRACT'){const e=Error('Strict Node post-save difference');e.comparison=c;throw e;}return c;}finally{d.free();r.free();}}
try{
 if(await fetch(origin+'/api/health').then(()=>true,()=>false))throw Error('Own port already occupied');
 server=spawn(process.execPath,['apps/launcher/server.mjs'],{cwd:repo,windowsHide:true,stdio:'ignore',env:{...process.env,JUEONY_PORT:String(port),JUEONY_DIST:dist,JUEONY_CONNECTION_STORE:'memory'}});
 for(let i=0;i<100;i++){if(await fetch(origin+'/api/health').then(r=>r.ok,()=>false))break;await delay(100);}
 browser=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,userDataDir:join(out,'edge-profile'),args:['--no-first-run','--disable-background-networking'],defaultViewport:{width:1500,height:1050}});
 page=await browser.newPage();page.on('pageerror',e=>pageErrors.push(String(e)));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});page.on('dialog',d=>d.accept());await page.setRequestInterception(true);page.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:')){externalRequests.push(r.url());void r.abort();}else void r.continue();});
 await page.goto(origin);await page.waitForFunction(()=>document.getElementById('app-status')?.textContent.includes('준비 완료'),{timeout:90000});
 for(const name of ['support/column2.hwp','hancom-current/column2.hwp'])for(const format of ['hwp','hwpx'])await scenario(`${name}: keyboard edit, actual Undo/Redo, UI SaveAs ${format}, strict disk reopen and repeat Save`,async()=>{
   const ctx=await open(name),{f}=ctx,before=await probe(f);assert.equal(before.dirty,false);
   await f.evaluate(()=>{const s=window.__columnReview,d=s.wasm.borrowDocumentHandle(),ih=s.getInputHandler(),tail=d.getParagraphCount(0)-1;ih.cursor.moveTo({sectionIndex:0,paragraphIndex:tail,charOffset:0});ih.updateCaret();ih.focus();s.eventBus.emit('command-state-changed');});
   await page.keyboard.sendCharacter('HISTORY');await delay(150);const edited=await probe(f);assert.equal(edited.dirty,true);assert.equal(edited.history.undo,before.history.undo+1);assert.deepEqual(edited.layout.map(x=>x.controls),before.layout.map(x=>x.controls));
   await command(f,'edit:undo');const undone=await probe(f);assert.deepEqual(undone.snapshot.structure,before.snapshot.structure);assert.deepEqual(differences(before.layout,undone.layout,0.2),[]);
   await command(f,'edit:redo');const redone=await probe(f);assert.deepEqual(redone.snapshot.structure,edited.snapshot.structure);assert.deepEqual(differences(edited.layout,redone.layout,0.2),[]);assert.equal(redone.dirty,true);
   await target(ctx,format);await saveAs(ctx,format);let saved=await disk(f);assert.deepEqual(saved.source,[...ctx.bytes]);assert.equal(saved.pickers,1);assert.equal(saved.writes,1);strict(redone.bytes,saved.target,format);
   await writeFile(join(out,`${name.replaceAll('/','-')}-${format}.${format}`),new Uint8Array(saved.target));
   const savedBytes=saved.target;await f.evaluate(async({bytes,format})=>{await window.jueonyEditor.open(new Uint8Array(bytes),window.__columnTarget.name,window.__columnTarget,false);},{bytes:savedBytes,format});await delay(400);const reopened=await probe(f);assert.equal(reopened.dirty,false);assert.deepEqual(differences(redone.layout,reopened.layout,0.2),[]);
   for(let round=1;round<=2;round++){await command(f,'file:save');await f.waitForFunction(n=>window.__columnWrites===n&&!window.jueonyEditor.busy()&&!window.jueonyEditor.state().dirty,{},round+1);saved=await disk(f);assert.deepEqual(saved.source,[...ctx.bytes]);strict(reopened.bytes,saved.target,format);}
   await page.screenshot({path:join(out,`${name.replaceAll('/','-')}-${format}.png`)});observations.push({name,format,keyboardHistoryEntry:1,undo:true,redo:true,writes:saved.writes,pickers:saved.pickers,sourceUnchanged:true,geometryDifferences:0,semanticDifferences:0,sha256:hash(new Uint8Array(saved.target)),canvasBefore:before.canvas,canvasAfter:(await probe(f)).canvas});
 });
 await scenario('no unexpected page/console errors or external assets',()=>{assert.deepEqual(pageErrors,[]);assert.deepEqual(consoleErrors,[]);assert.deepEqual(externalRequests,[]);});
}catch(e){failures.push({name:'runner environment',error:String(e),stack:e.stack});}finally{
 await writeFile(join(out,'result.json'),JSON.stringify({results,failures,observations,pageErrors,consoleErrors,externalRequests,engine:engine.metadata,build,verifierSha256:hash(await readFile(fileURLToPath(import.meta.url))),scope:'Isolated actual Edge/editor Canvas, keyboard input, application Undo/Redo and SaveAs UI command, own OPFS source/target sink, strict production readback, repeat Save. No native OS dialog, user document, existing browser profile, Hancom GUI or paid API call touched.'},null,2));await browser?.close();server?.kill();
}
if(failures.length)process.exitCode=1;
