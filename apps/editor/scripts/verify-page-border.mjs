import puppeteer from 'puppeteer-core';
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';

const app=resolve(dirname(fileURLToPath(import.meta.url)),'..'),repo=resolve(app,'../..');
if(!process.env.JUEONY_TEST_DIST||!process.env.JUEONY_ENGINE_PACKAGE)throw new Error('JUEONY_TEST_DIST and JUEONY_ENGINE_PACKAGE required');
const dist=resolve(app,process.env.JUEONY_TEST_DIST),pkg=resolve(repo,process.env.JUEONY_ENGINE_PACKAGE),out=resolve(repo,process.env.JUEONY_TEST_OUTPUT??'docs/evidence/page-border-2026-10-13/browser');
const port=4215,origin=`http://127.0.0.1:${port}`,delay=ms=>new Promise(r=>setTimeout(r,ms));await mkdir(out,{recursive:true});
const {default:init,HwpDocument}=await import(pathToFileURL(resolve(pkg,'rhwp.js')).href);await init({module_or_path:await readFile(resolve(pkg,'rhwp_bg.wasm'))});
if(await fetch(origin+'/api/health').then(()=>true,()=>false))throw new Error(`Port ${port} occupied`);
const server=spawn(process.execPath,['apps/launcher/server.mjs'],{cwd:repo,windowsHide:true,stdio:'ignore',env:{...process.env,JUEONY_PORT:String(port),JUEONY_DIST:dist,JUEONY_CONNECTION_STORE:'memory'}});
const results=[],failures=[],pageErrors=[],consoleErrors=[],externalRequests=[];let browser,page;
const active=async()=>(await page.$('.editor-frame:not([hidden])')).contentFrame();
async function services(){const frame=await active();await frame.evaluate(()=>{if(window.__pageBorderServices)return;const a=window.rhwpStudio.automation;a.registerCommand({id:'ext:page-border-inspect',label:'검수',canExecute:()=>true,execute:s=>window.__pageBorderServices=s});const r=a.execute('ext:page-border-inspect');a.unregisterCommand('ext:page-border-inspect');if(!r.ok)throw new Error('Services unavailable');});return frame;}
async function execute(id){const result=await(await active()).evaluate(id=>window.jueonyEditor.executeCommand(id),id);assert.equal(result.ok,true,JSON.stringify(result));}
async function open(ext='hwpx'){
 const doc=HwpDocument.createEmpty();doc.createBlankDocument();doc.insertText(0,0,0,'쪽 테두리 검증 본문');const bytes=[...doc[ext==='hwp'?'exportHwp':'exportHwpx']()];doc.free();
 const frame=await services();await frame.evaluate(async(bytes,ext)=>{const root=await navigator.storage.getDirectory(),h=await root.getFileHandle(`page-border.${ext}`,{create:true}),w=await h.createWritable();await w.write(new Uint8Array(bytes));await w.close();await window.jueonyEditor.open(new Uint8Array(bytes),`page-border.${ext}`,h,false);const ih=window.__pageBorderServices.getInputHandler();ih.cursor.moveTo({sectionIndex:0,paragraphIndex:0,charOffset:0});ih.focus();},bytes,ext);return frame;
}
const revision=async()=>(await active()).evaluate(()=>window.jueonyEditor.revision());
const read=async kind=>(await services()).evaluate(kind=>JSON.parse(window.__pageBorderServices.wasm.borrowDocumentHandle().getPageBorderFillEntry(0,kind)),kind);
async function scenario(name,run){try{await run();results.push(name);console.log('PASS',name);}catch(error){failures.push({name,error:String(error),stack:error.stack});console.error('FAIL',name,error);await page.screenshot({path:resolve(out,`failure-${failures.length}.png`)}).catch(()=>{});await(await active()).evaluate(()=>document.querySelectorAll('.modal-overlay .dialog-close').forEach(button=>button.click())).catch(()=>{});}}
async function background(frame){await execute('page:page-border');await frame.waitForSelector('[data-page-border-kind]');await frame.click('.dialog-tab[data-tab=background]');}
async function kind(frame,value){await frame.select('.dialog-tab-panel.active [data-page-border-kind]',value);}
async function fill(frame,type=1){await frame.click('input[name="page-border-bg"][value=gradient]');await frame.select('[data-page-gradient=type]',String(type));await frame.$eval('[data-page-gradient=start]',e=>e.value='#112233');await frame.$eval('[data-page-gradient=end]',e=>e.value='#aabbcc');await frame.$eval('[data-page-gradient=angle]',e=>e.value='45');}
async function confirm(frame){await frame.click('.modal-overlay .dialog-btn-primary');await frame.waitForSelector('.modal-overlay',{hidden:true});}
try{
 for(let i=0;i<100;i++){if(await fetch(origin+'/api/health').then(r=>r.ok,()=>false))break;await delay(100);}
 browser=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--no-first-run','--disable-background-networking'],defaultViewport:{width:1400,height:960}});
 page=await browser.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>pageErrors.push(String(e)));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
 await page.setRequestInterception(true);page.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:')){externalRequests.push(r.url());void r.abort();}else void r.continue();});await page.goto(origin);await page.waitForFunction(()=>document.getElementById('app-status')?.textContent.includes('준비 완료'),{timeout:90000});
 await scenario('page dialog cancel and unchanged confirmation do not mark document dirty',async()=>{const frame=await open(),before=await revision();await background(frame);await page.keyboard.press('Escape');assert.equal(await revision(),before);await background(frame);await confirm(frame);assert.equal(await revision(),before);});
 for(const ext of ['hwp','hwpx'])for(const application of ['all','exceptFirst','firstOnly'])await scenario(`${ext}: odd-page gradient ${application} actual dialog → one snapshot undo/redo → save/reopen`,async()=>{
  const frame=await open(ext),before=await revision(),original=await read('odd');await background(frame);await kind(frame,'odd');await fill(frame);await frame.click(`.dialog-tab-panel.active input[name="page-border-apply"][value="${application}"]`);await confirm(frame);
  let current=await read('odd');assert.equal(current.fillType,'gradient');assert.equal(current.applyPage,application);assert.deepEqual(current.gradient.colors,['#112233','#aabbcc']);assert.notEqual(await revision(),before);
  await execute('edit:undo');assert.equal((await read('odd')).fillType,original.fillType);await execute('edit:redo');assert.equal((await read('odd')).fillType,'gradient');
  const saved=await frame.evaluate(async()=>{const api=window.jueonyEditor,result=await api.save(),file=await api.fileHandle().getFile();return {result,dirty:api.state().dirty,bytes:[...new Uint8Array(await file.arrayBuffer())]};});assert.equal(saved.result,'saved');assert.equal(saved.dirty,false);await writeFile(resolve(out,`${application}.${ext}`),new Uint8Array(saved.bytes));
  const reopened=new HwpDocument(new Uint8Array(saved.bytes));try{current=JSON.parse(reopened.getPageBorderFillEntry(0,'odd'));assert.equal(current.fillType,'gradient');assert.equal(current.applyPage,application);assert.deepEqual(current.gradient.colors,['#112233','#aabbcc']);}finally{reopened.free();}
 });
 await scenario('multiple page-kind drafts commit atomically in a single undo',async()=>{const frame=await open(),original=await read('both');await background(frame);await fill(frame,2);await kind(frame,'even');await fill(frame,1);await kind(frame,'odd');await fill(frame,2);await frame.$eval('[data-page-gradient=angle]',e=>e.value='90');await kind(frame,'both');assert.equal(await frame.$eval('[data-page-gradient=type]',e=>e.value),'2');await confirm(frame);assert.equal((await read('both')).gradient.type,2);assert.equal((await read('even')).gradient.type,1);assert.equal((await read('odd')).gradient.angle,90);await execute('edit:undo');for(const value of ['both','even','odd'])assert.equal((await read(value)).fillType,original.fillType);});
 await scenario('invalid gradient coordinates retain dialog and leave native document unchanged',async()=>{const frame=await open(),before=await revision();await background(frame);await fill(frame);await frame.$eval('[data-page-gradient=angle]',e=>e.value='361');await frame.click('.modal-overlay .dialog-btn-primary');await frame.waitForSelector('.jueony-page-border-error');assert.equal(await revision(),before);assert.match(await frame.$eval('.jueony-page-border-error',e=>e.textContent),/각도/);await page.keyboard.press('Escape');});
 await scenario('mixed section visibility is preserved while unsupported inclusion controls remain disabled',async()=>{
  const frame=await open();await frame.evaluate(()=>{const s=window.__pageBorderServices,ih=s.getInputHandler();ih.executeOperation({kind:'snapshot',operationType:'testMixedPageScope',operation:wasm=>{const doc=wasm.borrowDocumentHandle(),base=JSON.parse(doc.getPageBorderFillEntry(0,'both'));doc.setPageBorderFillEntry(0,'both',JSON.stringify({...base,hideBorder:true,hideFill:false,firstPageBorder:false,firstPageFill:true}));return ih.getPosition();}});});
  const before=await read('both'),current=await revision();await background(frame);await confirm(frame);assert.equal(await revision(),current);
  await execute('page:page-border');assert.equal(await frame.evaluate(()=>[...document.querySelectorAll('.modal-overlay input[type=checkbox]')].filter(e=>e.dataset.label?.includes('배치 미지원')).every(e=>e.disabled)),true);
  await frame.click('.page-border-side-btn[title="위쪽"]');await confirm(frame);
  const after=await read('both');for(const key of ['hideBorder','hideFill','firstPageBorder','firstPageFill','headerInside','footerInside'])assert.equal(after[key],before[key],key);assert.equal(after.borderTop.type,1);
 });
 await scenario('stale page dialog refuses to overwrite intervening document edit',async()=>{const frame=await open();await background(frame);await fill(frame);await frame.evaluate(async()=>{const api=window.jueonyEditor,b=api.snapshot();await api.apply(crypto.randomUUID(),b,{message:'합성 검증',sourceIds:[],operations:[{kind:'replace_body_text',target:b.nodes[0].id,start:0,count:0,text:'새 편집 '}]});});const changed=await revision();await frame.click('.modal-overlay .dialog-btn-primary');await frame.waitForSelector('.jueony-page-border-error');assert.equal(await revision(),changed);assert.equal((await read('both')).fillType,'none');await page.keyboard.press('Escape');});
 await scenario('unified menu keyboard and quick format dialog preserve real editor selection',async()=>{
  const frame=await open();await frame.evaluate(()=>{const ih=window.__pageBorderServices.getInputHandler();ih.cursor.selectRange({sectionIndex:0,paragraphIndex:0,charOffset:1},{sectionIndex:0,paragraphIndex:0,charOffset:4});ih.updateCaret();ih.focus();});
  const selection=await frame.evaluate(()=>window.__pageBorderServices.getInputHandler().cursor.getSelection()),before=await revision();
  await page.focus('#unified-menus > details:first-child > summary');await page.keyboard.press('ArrowDown');assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('role')),'menuitem');await page.keyboard.press('End');await page.keyboard.press('Home');await page.keyboard.press('Escape');
  assert.deepEqual(await frame.evaluate(()=>window.__pageBorderServices.getInputHandler().cursor.getSelection()),selection);
  await page.click('#unified-tools [data-editor-command="format:char-shape"]');await frame.waitForSelector('.modal-overlay');await page.keyboard.press('Escape');await frame.waitForSelector('.modal-overlay',{hidden:true});
  assert.deepEqual(await frame.evaluate(()=>window.__pageBorderServices.getInputHandler().cursor.getSelection()),selection);assert.equal(await revision(),before);
 });
 await scenario('actual unified popup remains inside narrow 200% DPI viewport',async()=>{
  await page.setViewport({width:360,height:600,deviceScaleFactor:2});await page.click('#unified-menus > details:last-child > summary');
  const bounds=await page.$eval('#unified-menus > details:last-child > .unified-menu-popup',e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,bottom:r.bottom,width:innerWidth,height:innerHeight};});assert.ok(bounds.left>=0&&bounds.right<=bounds.width&&bounds.bottom<=bounds.height,JSON.stringify(bounds));await page.keyboard.press('Escape');await page.setViewport({width:1400,height:960,deviceScaleFactor:1});
 });
 assert.deepEqual(pageErrors,[]);assert.deepEqual(consoleErrors,[]);assert.deepEqual(externalRequests,[]);
}finally{await writeFile(resolve(out,'result.json'),JSON.stringify({results,failures,pageErrors,consoleErrors,externalRequests,build:JSON.parse(await readFile(resolve(dist,'build-evidence.json'),'utf8')),note:'Actual browser command/selection/history and real WASM save. Native Hancom comparison remains pending.'},null,2));await browser?.close();server.kill();}
if(failures.length)process.exitCode=1;
