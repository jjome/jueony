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
await mkdir(out,{recursive:true});const profile=await mkdtemp(join(tmpdir(),'jueony-font-set-'));
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
 await frame.evaluate(()=>{const a=window.rhwpStudio.automation;a.registerCommand({id:'ext:font-set-inspect',label:'검수',canExecute:()=>true,execute:s=>window.__fontSetServices=s});a.execute('ext:font-set-inspect');a.unregisterCommand('ext:font-set-inspect');});
}
const stored=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('rhwp-settings')??'{}').font?.fontSets??[]);
async function openLibrary(){const r=await frame.evaluate(()=>window.rhwpStudio.automation.execute('tool:options',undefined,{allowDialog:true}));assert.equal(r.ok,true);await frame.locator('.opt-fontset-btn').click();}
async function add(){await frame.locator('.fs-toolbar button:first-child').click();await frame.waitForSelector('.fse-body');}
async function fill(value){await frame.$eval('.fse-name-input',(e,value)=>e.value=value.name,value);await frame.$$eval('.fse-select',(els,{value,languages})=>els.forEach((el,i)=>{el.value=value[languages[i]];el.dispatchEvent(new Event('change',{bubbles:true}));}),{value,languages});}
const confirm=()=>frame.evaluate(()=>[...document.querySelectorAll('.modal-overlay')].at(-1).querySelector('.dialog-btn-primary').click());
const closeTop=()=>frame.evaluate(()=>[...document.querySelectorAll('.modal-overlay')].at(-1).querySelector('.dialog-close').click());
async function closeAll(){for(let i=0;i<5&&await frame.$('.modal-overlay');i++)await closeTop();}
async function selectSet(name){await frame.evaluate(name=>{const item=[...document.querySelectorAll('.fs-list-item')].find(el=>el.querySelector('.fs-item-name')?.textContent===name);if(!item)throw new Error('Missing set '+name);item.click();},name);}
async function edit(name){await selectSet(name);await frame.locator('.fs-toolbar button:nth-child(2)').click();await frame.waitForSelector('.fse-body');}
async function externalDefinitions(values){await page.evaluate(values=>{const settings=JSON.parse(localStorage.getItem('rhwp-settings')??'{"version":1}');settings.font={...(settings.font??{}),fontSets:values};localStorage.setItem('rhwp-settings',JSON.stringify(settings));},values);await delay(50);}
async function openDocument(ext){
 const doc=HwpDocument.createEmpty();doc.createBlankDocument();doc.insertText(0,0,0,'대표 글꼴 검증ABCDEFGHI');const bytes=[...doc[ext==='hwp'?'exportHwp':'exportHwpx']()];doc.free();
 await frame.evaluate(async(bytes,ext)=>{const root=await navigator.storage.getDirectory(),handle=await root.getFileHandle('font-set.'+ext,{create:true}),writer=await handle.createWritable();await writer.write(new Uint8Array(bytes));await writer.close();await window.jueonyEditor.open(new Uint8Array(bytes),'font-set.'+ext,handle,false);const input=window.__fontSetServices.getInputHandler();input.cursor.selectRange({sectionIndex:0,paragraphIndex:0,charOffset:0},{sectionIndex:0,paragraphIndex:0,charOffset:5});input.updateCaret();input.focus();},bytes,ext);
}
const props=()=>frame.evaluate(()=>window.__fontSetServices.wasm.getCharPropertiesAt(0,0,1));
async function applySet(name){await frame.locator('#font-name').click();await frame.locator('.font-picker-category[data-category="fontSets"]').click();await frame.evaluate(name=>{const el=[...document.querySelectorAll('.font-picker-option')].find(el=>el.textContent==='◆ '+name);if(!el)throw new Error('Missing font-set picker entry');el.click();},name);await frame.waitForSelector('.font-picker-menu',{hidden:true});}
try{
 for(let i=0;i<100;i++){if(server.exitCode!==null)throw new Error('Server exited');if(await fetch(origin+'/api/health').then(r=>r.ok,()=>false))break;await delay(100);}
 await launch();const original=await frame.evaluate(()=>window.jueonyEditor.state());
 stage='invalid definition';await openLibrary();await add();await confirm();assert.ok(await frame.$('.fse-body'));assert.match(await frame.$eval('.fse-body [role="alert"]',e=>e.textContent),/이름/);assert.deepEqual(await stored(),[]);
 await fill(definition('업무 세트'));await confirm();await frame.waitForSelector('.fse-body',{hidden:true});assert.deepEqual(await stored(),[definition('업무 세트')]);
 await add();await fill(definition('업무 세트'));await confirm();assert.ok(await frame.$('.fse-body'));assert.match(await frame.$eval('.fse-body [role="alert"]',e=>e.textContent),/이미/);await closeTop();
 assert.deepEqual(await frame.evaluate(()=>window.jueonyEditor.state()),original);pass('empty/duplicate names retain the input dialog; a valid seven-language definition saves without document mutation');

 stage='quota';await add();await fill(definition('재시도 세트'));
 await frame.evaluate(()=>{window.__fontSetWrite=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='rhwp-settings')throw new DOMException('test quota','QuotaExceededError');return window.__fontSetWrite.call(this,key,value);};});
 await confirm();assert.ok(await frame.$('.fse-body'));assert.match(await frame.$eval('.fse-body [role="alert"]',e=>e.textContent),/저장/);assert.deepEqual(await stored(),[definition('업무 세트')]);
 await frame.evaluate(()=>{Storage.prototype.setItem=window.__fontSetWrite;delete window.__fontSetWrite;});await confirm();await frame.waitForSelector('.fse-body',{hidden:true});assert.deepEqual(await stored(),[definition('업무 세트'),definition('재시도 세트')]);
 await page.waitForFunction(()=>document.getElementById('app-status').textContent==='편집 환경 설정을 저장했습니다.');
 pass('storage failure retains input and old persisted definitions; retry commits exactly one set without uncaught errors');

 stage='stale edit';await edit('업무 세트');const changed={...definition('업무 세트'),english:'monospace'};await externalDefinitions([changed,definition('재시도 세트')]);await frame.$eval('.fse-name-input',e=>e.value='덮어쓰기 시도');await confirm();
 assert.ok(await frame.$('.fse-body'));assert.match(await frame.$eval('.fse-body [role="alert"]',e=>e.textContent),/다른 창/);assert.deepEqual(await stored(),[changed,definition('재시도 세트')]);await closeAll();
 pass('an edit opened before another window changes the target is rejected with the original input retained');

 stage='stale deletion';await openLibrary();await selectSet('업무 세트');await externalDefinitions([definition('재시도 세트'),definition('대체 항목')]);await frame.locator('.fs-toolbar button:nth-child(3)').click();
 assert.match(await frame.$eval('.fs-body [role="alert"]',e=>e.textContent),/다른 창/);assert.deepEqual(await stored(),[definition('재시도 세트'),definition('대체 항목')]);
 await add();await fill(definition('오류 복구 확인'));await confirm();await frame.waitForSelector('.fse-body',{hidden:true});assert.equal(await frame.$('.fs-body [data-font-set-error]'),null);
 await selectSet('오류 복구 확인');await frame.locator('.fs-toolbar button:nth-child(3)').click();assert.deepEqual(await stored(),[definition('재시도 세트'),definition('대체 항목')]);await closeAll();
 pass('deleting a stale selected row cannot remove the different set now occupying the old array index');

 stage='concurrent add and unbundled font';await openLibrary();await add();await fill(definition('추가 세트'));const unknown=definition('저장된 외부 글꼴',languages.map((_,i)=>`검수전용-미번들-${i}`));await externalDefinitions([definition('재시도 세트'),unknown]);await confirm();await frame.waitForSelector('.fse-body',{hidden:true});
 assert.deepEqual(await stored(),[definition('재시도 세트'),unknown,definition('추가 세트')]);await edit(unknown.name);assert.deepEqual(await frame.$$eval('.fse-select',els=>els.map(e=>e.value)),languages.map(key=>unknown[key]));
 await frame.$eval('.fse-name-input',e=>e.value='외부 글꼴 이름 변경');await confirm();await frame.waitForSelector('.fse-body',{hidden:true});const renamed={...unknown,name:'외부 글꼴 이름 변경'};assert.deepEqual(await stored(),[definition('재시도 세트'),renamed,definition('추가 세트')]);
 await page.screenshot({path:join(out,'font-set-library.png')});await closeAll();pass('adding merges another window definition; editing an unbundled family retains all seven exact stored names');

 for(const ext of ['hwp','hwpx']){
  stage=ext+' font-set save';await openDocument(ext);const before=await props();await applySet('추가 세트');assert.deepEqual((await props()).fontFamilies,families);
  const undo=await frame.evaluate(()=>window.jueonyEditor.executeCommand('edit:undo'));assert.equal(undo.ok,true);assert.deepEqual((await props()).fontFamilies,before.fontFamilies);
  const redo=await frame.evaluate(()=>window.jueonyEditor.executeCommand('edit:redo'));assert.equal(redo.ok,true);assert.deepEqual((await props()).fontFamilies,families);
  const saved=await frame.evaluate(async()=>{const api=window.jueonyEditor,result=await api.save(),file=await api.fileHandle().getFile();return{result,bytes:[...new Uint8Array(await file.arrayBuffer())],dirty:api.state().dirty};});assert.equal(saved.result,'saved');assert.equal(saved.dirty,false);
  await writeFile(join(out,'font-set.'+ext),new Uint8Array(saved.bytes));const reopen=new HwpDocument(new Uint8Array(saved.bytes));try{assert.deepEqual(parse(reopen.getCharPropertiesAt(0,0,1)).fontFamilies,families);}finally{reopen.free();}
  pass(`${ext}: actual representative font picker applies seven language families, undo/redo and safe save/reopen preserve them`);
 }
 stage='status ownership';
 await frame.evaluate(()=>window.parent.postMessage({type:'jueony:preferences-state',error:true,message:'검수용 이전 환경 오류'},location.origin));
 await page.waitForFunction(()=>document.getElementById('app-status').textContent==='검수용 이전 환경 오류');
 await page.locator('#save-document').click();await page.waitForFunction(()=>document.getElementById('app-status').textContent==='파일에 저장했습니다.');
 await openLibrary();await edit('추가 세트');await confirm();await frame.waitForSelector('.fse-body',{hidden:true});await closeAll();
 await frame.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 assert.equal(await page.$eval('#app-status',el=>el.textContent),'파일에 저장했습니다.');
 pass('successful preference retry clears its own error while a newer actual file-save status retains ownership');
 stage='restart and successful deletion';const persisted=await stored();await browser.close();browser=undefined;await launch();assert.deepEqual(await stored(),persisted);await openLibrary();await edit('외부 글꼴 이름 변경');assert.deepEqual(await frame.$$eval('.fse-select',els=>els.map(e=>e.value)),languages.map(key=>unknown[key]));await closeTop();await selectSet('재시도 세트');await frame.locator('.fs-toolbar button:nth-child(3)').click();assert.deepEqual(await stored(),[renamed,definition('추가 세트')]);await closeAll();
 pass('definitions survive a closed/relaunched isolated profile and a deliberate current-row deletion persists');
 assert.deepEqual(errors,[]);assert.deepEqual(externalRequests,[]);await writeFile(join(out,'result.json'),JSON.stringify({pass:true,results,errors,externalRequests,build:JSON.parse(await readFile(join(dist,'build-evidence.json'),'utf8')),limits:['Preserves unavailable family names but does not install fonts or assert rendering equivalence','Native Hancom comparison deferred']},null,2));
}catch(error){console.error(error);process.exitCode=1;await page?.screenshot({path:join(out,'failure.png')}).catch(()=>{});await writeFile(join(out,'failure.json'),JSON.stringify({stage,error:String(error.stack??error),results,errors,externalRequests},null,2));}
finally{await browser?.close();server.kill();}
