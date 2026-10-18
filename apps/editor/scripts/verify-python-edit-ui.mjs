// Python fixture editing must actually save; a protection refusal fails this regression.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const puppeteer = createRequire(import.meta.url)('puppeteer-core');
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,isAbsolute,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadReviewEngine,hash,snapshot,compareSnapshots,differences} from './lib/hancom-review.mjs';
import {verifyPreservedExport} from '../src/adapters/rhwp/preservation.ts';
import {hwpLogicalStreams} from './lib/hwp-summary-evidence.mjs';
for(const key of ['JUEONY_TEST_DIST','JUEONY_ENGINE_PACKAGE','JUEONY_TEST_OUTPUT','JUEONY_TEST_SOURCE','JUEONY_TEST_ORACLE'])assert.ok(isAbsolute(process.env[key]??''),key+' absolute required');
const repo=resolve(fileURLToPath(new URL('../../..',import.meta.url))),dist=resolve(process.env.JUEONY_TEST_DIST),out=resolve(process.env.JUEONY_TEST_OUTPUT),port=Number(process.env.JUEONY_TEST_PORT??4476),origin='http://127.0.0.1:'+port,delay=ms=>new Promise(r=>setTimeout(r,ms));
await mkdir(out,{recursive:true});const engine=await loadReviewEngine(process.env.JUEONY_ENGINE_PACKAGE),build=JSON.parse(await readFile(dist+'/build-evidence.json','utf8'));assert.equal(build.engineWasmSha256,engine.metadata.wasmSha256);
const source=await readFile(process.env.JUEONY_TEST_SOURCE),native=await readFile(process.env.JUEONY_TEST_ORACLE);
assert.equal(hash(source),'c11c90b48eb8b709cdeb91f5a2c7ecae1b89d0d1390dfc1db32865b902d0dd0f');
assert.equal(hash(native),'51e89075e288e36511df470ffc0fc63fa5ec38df350e606ff623b5e965704d52');
const pinned={source:hash(source),native:hash(native)},seed=new engine.HwpDocument(native);let generated;
try{const a=seed.exportHwpxWithReport();try{generated=a.takeBytes();const loss=JSON.parse(a.contentLoss());assert.equal(loss.count,0);assert.equal(verifyPreservedExport(seed,generated,'hwpx',loss,b=>new engine.HwpDocument(b)).status,'checked');}finally{a.free();}}finally{seed.free();}
const fixtures=new Map();for(const[input,bytes]of[['native',native],['regenerated-xml',generated],['independent-xml',source]])for(const kind of['body','cell'])fixtures.set(input+'-'+kind,bytes);
let browser,page,server,serverError='';const results=[],failures=[],pageErrors=[],consoleErrors=[],externalRequests=[],observations=[];
async function scenario(name,run){try{await run();results.push({name,status:'PASS'});console.log('PASS',name);}catch(e){failures.push({name,error:String(e),stack:e.stack});results.push({name,status:'FAIL'});console.log('FAIL',name,String(e));}}
async function frame(){return(await page.$('.editor-frame:not([hidden])')).contentFrame();}
async function services(){const f=await frame();await f.evaluate(()=>{if(window.__rowReview)return;const a=window.rhwpStudio.automation;a.registerCommand({id:'ext:row-review-services',label:'own test',canExecute:()=>true,execute:s=>window.__rowReview=s});a.execute('ext:row-review-services');a.unregisterCommand('ext:row-review-services');const w=window.__rowReview.wasm,exported=w.exportHwpxWithReport;w.exportHwpxWithReport=function(...args){const artifact=exported.apply(this,args);window.__rowExport={bytes:[...artifact.bytes],contentLoss:structuredClone(artifact.contentLoss)};return artifact;};});return f;}
async function probe(f){return f.evaluate(()=>{const s=window.__rowReview,d=s.wasm.borrowDocumentHandle(),h=s.getInputHandler().history,mode=d.canvasMetricsActive();let layout,hwp;try{if(mode)d.selectCanvasMetrics(false);layout=Array.from({length:d.pageCount()},(_,page)=>({page,controls:JSON.parse(d.getPageControlLayout(page)),text:JSON.parse(d.getPageTextLayout(page))}));hwp=[...d.exportHwp()];}finally{if(mode)d.selectCanvasMetrics(true);}if(d.canvasMetricsActive()!==mode)throw Error('Portable probe failed to restore Canvas mode');return{state:window.jueonyEditor.state(),revision:window.jueonyEditor.revision(),text:d.getTextFileUnicode(),hwp,undo:h.undoStack.length,redo:h.redoStack.length,layout,canvas:mode};});}
function verify(live,bytes,reported){assert.deepEqual(bytes,reported.bytes,'disk bytes must belong to the actual UI export report');assert.equal(reported.contentLoss.outputFormat,'hwpx');assert.equal(reported.contentLoss.count,0);const d=new engine.HwpDocument(new Uint8Array(live.hwp));try{verifyPreservedExport(d,new Uint8Array(bytes),'hwpx',reported.contentLoss,b=>new engine.HwpDocument(b));const reopened=new engine.HwpDocument(new Uint8Array(bytes));try{const after=snapshot(reopened),result=compareSnapshots(snapshot(d),after);assert.deepEqual(differences(live.layout,after.layout,0.2),[],'live portable layout must survive without an intermediate export hiding a change');assert.equal(reopened.getTextFileUnicode(),live.text);assert.equal(result.semantic.count,0);assert.equal(result.geometry.count,0);assert.deepEqual(result.semantic.readIssues,{before:[],after:[]});assert.equal(result.pages.equal,true);}finally{reopened.free();}}finally{d.free();}}
// CFB allocation/directory timestamps can differ between equivalent exports.
// Every logical stream, including unknown streams and exact raw payloads,
// must still be byte-identical; live geometry and text must also be exact.
function sameHistory(before,after){
 assert.equal(after.text,before.text);assert.deepEqual(differences(before.layout,after.layout,0),[]);
 const a=hwpLogicalStreams(before.hwp),b=hwpLogicalStreams(after.hwp);
 assert.deepEqual([...a.keys()].sort(),[...b.keys()].sort());
 for(const name of a.keys())assert.deepEqual(b.get(name),a.get(name),'history raw logical stream '+name);
 return{containerBytesEqual:hash(new Uint8Array(before.hwp))===hash(new Uint8Array(after.hwp)),logicalStreams:a.size,allLogicalBytesEqual:true,liveGeometryExact:true,textExact:true};
}
async function savedBytes(f){return f.evaluate(async()=>[...new Uint8Array(await(await window.__rowTarget.getFile()).arrayBuffer())]);}
async function checkSaved(f){verify(await probe(f),await savedBytes(f),await f.evaluate(()=>window.__rowExport));}
async function originalUnchanged(f,bytes){assert.deepEqual(await f.evaluate(async()=>[...new Uint8Array(await(await window.__rowSource.getFile()).arrayBuffer())]),[...bytes]);}
async function save(f,command){assert.equal((await f.evaluate(command=>window.jueonyEditor.executeCommand(command),command)).ok,true);}
try{
 assert.equal(await fetch(origin+'/api/health').then(()=>true,()=>false),false,'test port occupied; existing server untouched');
 server=spawn(process.execPath,[join(repo,'apps/launcher/server.mjs')],{cwd:repo,windowsHide:true,stdio:['ignore','ignore','pipe'],env:{...process.env,JUEONY_PORT:String(port),JUEONY_DIST:dist,JUEONY_CONNECTION_STORE:'memory'}});
 server.stderr.on('data',chunk=>serverError+=chunk);
 let healthy=false;for(let i=0;i<300;i++){healthy=await fetch(origin+'/api/health').then(r=>r.ok,()=>false);if(healthy)break;await delay(100);}assert.equal(healthy,true,'Owned test server did not start: '+serverError);
 browser=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,userDataDir:out+'/edge-profile',args:['--no-first-run','--disable-background-networking'],defaultViewport:{width:1500,height:1050}});
 page=await browser.newPage();page.on('pageerror',e=>pageErrors.push(String(e)));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});page.on('dialog',d=>d.accept());await page.setRequestInterception(true);page.on('request',r=>{if(!r.url().startsWith(origin+'/')&&!/^(data:|blob:)/.test(r.url())){externalRequests.push(r.url());r.abort();}else r.continue();});await page.goto(origin);await page.waitForFunction(()=>document.getElementById('app-status')?.textContent.includes('준비 완료'),{timeout:90000});
 for(const[name,bytes]of fixtures)for(const[kind,text]of [['retained','가']]){
  await scenario(name+' '+kind+' reflow: actual SaveAs, history, reopen and follow-up Save',async()=>{
   const f=await services(),id=name+'-'+kind;await f.waitForFunction(()=>!window.jueonyEditor.busy());
   await f.evaluate(async({id,bytes})=>{const dir=await(await navigator.storage.getDirectory()).getDirectoryHandle('owned-python-edit',{create:true}),source=await dir.getFileHandle(id+(id.startsWith('native-')?'.hwp':'.hwpx'),{create:true}),target=await dir.getFileHandle(id+'-saved.hwpx',{create:true});for(const[h,b]of[[source,new Uint8Array(bytes)],[target,new Uint8Array([1,2,3])]]){const w=await h.createWritable();await w.write(b);await w.close();}window.__rowSource=source;window.__rowTarget=target;window.__rowTargetCell=id.includes('-cell-');window.__rowTargetPara=60;window.__rowWrites=0;window.__rowExport=null;const write=target.createWritable.bind(target);target.createWritable=async(...args)=>{window.__rowWrites++;return write(...args);};await window.jueonyEditor.open(new Uint8Array(bytes),source.name,source,false);Object.defineProperty(window,'showSaveFilePicker',{configurable:true,value:async()=>target});},{id,bytes:[...bytes]});
   const before=await probe(f);
   await f.evaluate(text=>window.__rowReview.getInputHandler().executeOperation({kind:'snapshot',operationType:'own-prefix-reflow',operation:w=>{const p=window.__rowTargetPara;if(window.__rowTargetCell)w.insertTextInCell(0,100,0,0,0,0,text);else w.insertText(0,p,0,text);return{sectionIndex:0,paragraphIndex:p,charOffset:0};}}),text);
   const edited=await probe(f);assert.ok(edited.text.includes(text));assert.notEqual(edited.text,before.text);assert.equal(edited.undo,before.undo+1);assert.equal(edited.state.dirty,true);if(kind==='page')assert.ok(edited.layout.length>before.layout.length);
   await save(f,'file:save-as-hwpx');await f.waitForSelector('.modal-overlay input[type=text]');await f.$eval('.modal-overlay input[type=text]',(e,id)=>e.value=id+'-saved',id);await f.click('.modal-overlay .dialog-btn-primary');await f.waitForFunction(()=>window.__rowWrites===1&&!window.jueonyEditor.busy()&&!window.jueonyEditor.state().dirty,{timeout:20000});await checkSaved(f);
   assert.equal(await f.evaluate(()=>window.jueonyEditor.fileHandle()===window.__rowTarget),true);
   // SnapshotCommand captures its redo snapshot at undo time. SaveAs first
   // stamps the actual UI caret through onBeforeExport; compare redo against
   // that complete saved state, not the earlier pre-save caret metadata.
   const savedEdited=await probe(f);assert.equal(savedEdited.text,edited.text);assert.deepEqual(differences(savedEdited.layout,edited.layout,0),[]);assert.deepEqual(await f.evaluate(()=>JSON.parse(window.__rowReview.wasm.borrowDocumentHandle().getCaretPosition())),{sectionIndex:0,paragraphIndex:60,charOffset:0});
   await save(f,'edit:undo');await f.waitForFunction(text=>window.__rowReview.wasm.borrowDocumentHandle().getTextFileUnicode()===text,{},before.text);const undoProof=sameHistory(before,await probe(f));
   await save(f,'edit:redo');await f.waitForFunction(text=>window.__rowReview.wasm.borrowDocumentHandle().getTextFileUnicode()===text,{},edited.text);const redoProof=sameHistory(savedEdited,await probe(f));
   await save(f,'file:save');await f.waitForFunction(()=>window.__rowWrites===2&&!window.jueonyEditor.busy()&&!window.jueonyEditor.state().dirty,{timeout:20000});await checkSaved(f);
   const stored=await savedBytes(f);await f.evaluate(bytes=>window.jueonyEditor.open(new Uint8Array(bytes),window.__rowTarget.name,window.__rowTarget,false),stored);const reopened=await probe(f);assert.equal(reopened.text,edited.text);assert.deepEqual(differences(edited.layout,reopened.layout,0.2),[]);
   await f.evaluate(()=>window.__rowReview.getInputHandler().executeOperation({kind:'snapshot',operationType:'own-prefix-follow-up',operation:w=>{const p=window.__rowTargetPara;w.insertText(0,p,0,'나');return{sectionIndex:0,paragraphIndex:p,charOffset:1};}}));assert.ok((await probe(f)).text.includes('나'));
   await save(f,'file:save');await f.waitForFunction(()=>window.__rowWrites===3&&!window.jueonyEditor.busy()&&!window.jueonyEditor.state().dirty,{timeout:20000});await checkSaved(f);await originalUnchanged(f,bytes);
   observations.push({name,kind,textLength:text.length,sourceSha256:hash(bytes),savedSha256:hash(new Uint8Array(await savedBytes(f))),sourceUnchanged:true,singleUndo:true,undoRedoExactLogical:true,undoProof,redoProof,reopenedFollowUpSaved:true});
  });
 }
 assert.equal(hash(await readFile(process.env.JUEONY_TEST_SOURCE)),pinned.source);assert.equal(hash(await readFile(process.env.JUEONY_TEST_ORACLE)),pinned.native);
 await scenario('no page errors, unexpected console errors or external requests',()=>{assert.deepEqual(pageErrors,[]);assert.deepEqual(consoleErrors,[]);assert.deepEqual(externalRequests,[]);});
}finally{
 await writeFile(out+'/result.json',JSON.stringify({engine:engine.metadata,build,results,failures,observations,pageErrors,consoleErrors,externalRequests,verifierSha256:hash(await readFile(fileURLToPath(import.meta.url))),fixtureHashes:pinned,serverError,scope:'Actual Native, generated HWPX and independent HWPX body/cell retained edits, SaveAs/Save, byte-identical logical-stream history and exact live layout/text and reopen/follow-up in isolated headless application/OPFS. Actual UI export report must match disk bytes; SHA-pinned original Python fixture files remain unchanged. Refusal is a FAIL, not success. No OS/Hancom UI or real API.'},null,2));await browser?.close();server?.kill();
}
assert.equal(results.length,7);if(failures.length)process.exitCode=1;
