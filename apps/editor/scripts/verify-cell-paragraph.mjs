import {createAxisPictureFixture} from './lib/axis-picture-fixture.mjs';
import puppeteer from 'puppeteer-core';
import {continuedMergedTable,fragmentedMergedCell} from './lib/continued-merged-table.mjs';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const app=resolve(dirname(fileURLToPath(import.meta.url)),'..'),repo=resolve(app,'../..'),dist=resolve(app,process.env.JUEONY_TEST_DIST),pkg=resolve(repo,process.env.JUEONY_ENGINE_PACKAGE),out=resolve(repo,process.env.JUEONY_TEST_OUTPUT??'build/cell-paragraph-browser');await mkdir(out,{recursive:true});
const port=4397,origin=`http://127.0.0.1:${port}`,delay=ms=>new Promise(r=>setTimeout(r,ms)),png=resolve(app,'fixtures/page-background/background-bands.png'),jpg=resolve(app,'fixtures/page-background/background-bands.jpg');
const {default:init,HwpDocument}=await import(pathToFileURL(resolve(pkg,'rhwp.js')).href);await init({module_or_path:await readFile(resolve(pkg,'rhwp_bg.wasm'))});if(await fetch(origin+'/api/health').then(()=>true,()=>false))throw new Error('Test port occupied');
const server=spawn(process.execPath,['apps/launcher/server.mjs'],{cwd:repo,windowsHide:true,stdio:'ignore',env:{...process.env,JUEONY_PORT:String(port),JUEONY_DIST:dist,JUEONY_CONNECTION_STORE:'memory'}}),results=[],failures=[],pageErrors=[],consoleErrors=[],externalRequests=[];let browser,page;let beforeUnloadCount=0;let expectedSaveFailure=false;const expectedSaveErrors=[];
const active=async()=>(await page.$('.editor-frame:not([hidden])')).contentFrame();
async function services(){const f=await active();await f.evaluate(()=>{if(window.__pageServices)return;const a=window.rhwpStudio.automation;a.registerCommand({id:'ext:master-inspect',label:'검수',canExecute:()=>true,execute:s=>window.__pageServices=s});a.execute('ext:master-inspect');a.unregisterCommand('ext:master-inspect');});return f;}
async function execute(id){const r=await(await active()).evaluate(id=>window.jueonyEditor.executeCommand(id),id);assert.equal(r.ok,true,JSON.stringify(r));}
async function open(ext='hwpx',source){const d=source??HwpDocument.createEmpty();if(!source){d.createBlankDocument();d.insertText(0,0,0,'첫 줄\n둘째 줄\n셋째 줄');}const bytes=[...d[ext==='hwp'?'exportHwp':'exportHwpx']()];d.free();const f=await services();await f.evaluate(async(bytes,ext)=>{const root=await navigator.storage.getDirectory(),h=await root.getFileHandle('master-review.'+ext,{create:true}),w=await h.createWritable();await w.write(new Uint8Array(bytes));await w.close();await window.jueonyEditor.open(new Uint8Array(bytes),'master-review.'+ext,h,false);const ih=window.__pageServices.getInputHandler();ih.cursor.moveTo({sectionIndex:0,paragraphIndex:0,charOffset:0});ih.focus();},bytes,ext);return f;}
const state=async()=>(await services()).evaluate(()=>({revision:window.jueonyEditor.revision(),bytes:[...window.jueonyEditor.recovery().bytes],history:window.__pageServices.getInputHandler().history.peekUndoTop()?.type??null,dirty:window.jueonyEditor.state().dirty}));
async function save(f,name,ext){const result=await f.evaluate(async()=>{const api=window.jueonyEditor,status=await api.save();return {status,bytes:[...new Uint8Array(await(await api.fileHandle().getFile()).arrayBuffer())]};});assert.equal(result.status,'saved');await writeFile(resolve(out,name+'.'+ext),new Uint8Array(result.bytes));return new HwpDocument(new Uint8Array(result.bytes));}
const casePattern=process.env.JUEONY_CASE_PATTERN?new RegExp(process.env.JUEONY_CASE_PATTERN,'u'):undefined;
async function scenario(name,run){if(casePattern&&!casePattern.test(name))return;if(process.env.JUEONY_HIDDEN_OWNER_ONLY==='1'&&!name.startsWith('long-table'))return;try{await run();results.push(name);console.log('PASS',name);}catch(error){failures.push({name,error:String(error),stack:error.stack});console.error('FAIL',name,error);await page.screenshot({path:resolve(out,'failure-'+failures.length+'.png')}).catch(()=>{});await(await active()).evaluate(()=>{document.querySelectorAll('.modal-overlay .dialog-close').forEach(e=>e.click());document.querySelectorAll('dialog[open]').forEach(e=>e.close());}).catch(()=>{});}}
function body(f='hwpx',second=false,makeMerge=true){const d=HwpDocument.createEmpty();d.createBlankDocument();d.insertText(0,0,0,'표 앞 본문 😀');d.splitParagraph(0,0,d.getParagraphLength(0,0));const t=JSON.parse(d.createTable(0,1,0,3,3));assert.equal(t.ok,true);for(let i=0;i<9;i++)d.setCellProperties(0,1,t.controlIdx,i,JSON.stringify({width:[6001,14000,21000][i%3]}));for(let c=0;c<9;c++)d.insertTextInCell(0,t.paraIdx,t.controlIdx,c,0,0,'업무 '+c);d.applyCharFormatInCell(0,t.paraIdx,t.controlIdx,2,0,0,4,JSON.stringify({bold:true,fontSize:1200}));if(second){d.splitParagraph(0,1,d.getParagraphLength(0,1));const other=JSON.parse(d.createTable(0,2,0,2,2));assert.equal(other.ok,true);}for(let i=0;i<9;i++)d.setCellProperties(0,1,t.controlIdx,i,JSON.stringify({height:[5001,7000,9000][Math.floor(i/3)]}));if(makeMerge){d.applyCharFormatInCell(0,1,0,1,0,0,d.getCellParagraphLength(0,1,0,1,0),JSON.stringify({bold:true}));d.applyParaFormatInCell(0,1,0,1,0,JSON.stringify({alignment:'center'}));}if(makeMerge)d.mergeTableCells(0,1,0,0,0,0,1);const x=new HwpDocument(d[f==='hwp'?'exportHwp':'exportHwpx']());d.free();return x;}
const calls=[],providerPort=4399;
if(await fetch('http://127.0.0.1:'+providerPort).then(()=>true,()=>false))throw new Error('Mock provider port occupied');
const provider=http.createServer(async(req,res)=>{try{let raw='';for await(const chunk of req)raw+=chunk;const request=JSON.parse(raw),id=req.url.endsWith('/responses')?'openai-responses':req.url.endsWith('/messages')?'anthropic':req.url.includes(':generateContent')?'gemini':'openai-compatible';const input=JSON.parse(id==='gemini'?request.contents[0].parts[0].text:id==='anthropic'?request.messages[0].content:id==='openai-responses'?request.input[1].content:request.messages[1].content);calls.push({id,model:request.model??req.url.split('/models/')[1]?.split(':')[0],input});

 const target=input.instruction.includes('missing')?'s9p0t0':input.document.structure.tables[0]?.id;
 const cell=input.document.cellParagraphSources?.[target]?.cells?.find(c=>c.rowSpan*c.columnSpan>1),paragraph=input.instruction.includes('first')?0:1;
 const fallback=input.document.structure.tables[0]?.cells?.[0]?.text?.split('\n')[paragraph]??'';
 const operations=[{kind:'replace_cell_paragraph',target,row:cell?.row??0,column:cell?.column??0,paragraph,originalText:cell?.paragraphs?.find(p=>p.index===paragraph)?.text??fallback,text:'Agent revised paragraph 😀'}];
 if(input.instruction.includes('photo-owner'))operations[0].text='개정5';
 if(input.instruction.includes('picture-suffix'))operations[0].text=operations[0].originalText+'개정';
 if(input.instruction.includes('mixed-tail'))operations[0].text=operations[0].originalText.slice(0,-1)+'개정😀';
 if(input.instruction.includes('split-owner'))operations[0].text=operations[0].originalText.slice(0,-6)+'Tail 2';
 if(input.instruction.includes('field-tail'))operations[0].text=Array.from(operations[0].originalText).slice(0,cell.paragraphs[paragraph].editableFrom).join('')+'수정😀';
 if(input.instruction.includes('new-character-style')){
  operations[0].text='가😀나다';
  operations[0].spanFormats=[{start:1,end:3,bold:false,italic:true,color:'#13579b',fontSizePt:14.5}];
 }
 if(input.instruction.includes('remove-style')){
  operations[0].spanTexts=['','수정😀'];
  operations[0].text=operations[0].spanTexts.join('');
 }
 if(input.instruction.includes('mixed-spans')){
  operations[0].spanTexts=['변경😀 ','공문'];
  operations[0].text=operations[0].spanTexts.join('');
 }
 if(input.instruction.includes('absorbed'))operations[0].column=1;
 if(input.instruction.includes('alias'))operations[0].kind='set_cell_paragraph';
 if(input.instruction.includes('overflow'))operations[0].paragraph=99;
 if(input.instruction.includes('no-op'))operations[0].text=operations[0].originalText;
 if(input.instruction.includes('batch'))operations.push({...operations[0]});
 if(input.instruction.includes('delay'))await new Promise(r=>setTimeout(r,2000));
 const generation={message:'Merged cell paragraph fixture proposal',sourceIds:[],operations};if(id==='anthropic')generation.operations=operations.map(({kind,...args})=>({kind,arguments:JSON.stringify(args)}));const text=JSON.stringify(generation);
 const wire=id==='openai-responses'?{status:'completed',output:[{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text}]}]}:id==='anthropic'?{type:'message',role:'assistant',stop_reason:'end_turn',content:[{type:'text',text}]}:id==='gemini'?{candidates:[{finishReason:'STOP',content:{role:'model',parts:[{text}]}}]}:{choices:[{message:{content:text}}]};res.setHeader('Content-Type','application/json');res.end(JSON.stringify(wire));}catch(e){res.writeHead(500);res.end(String(e));}});
const snap=async()=>(await active()).evaluate(()=>window.jueonyEditor.snapshot());
const fill=(id,value)=>page.$eval('#'+id,(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);
const waitIdle=()=>page.waitForFunction(()=>!document.getElementById('send-request').disabled,{timeout:60000});
async function send(text){await fill('request-input',text);const pending=page.waitForResponse(r=>r.url()===origin+'/api/generate');await page.click('#send-request');await pending;await waitIdle();}
async function lastAction(text){for(const button of (await page.$$('.message-actions button')).reverse())if(await button.evaluate((e,t)=>e.textContent===t,text)){await button.click();return;}throw new Error('Missing action '+text);}
async function undo(){await lastAction('요청 되돌리기');await page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('되돌렸습니다'));}
async function configure(id){await page.click('#connection-settings');await page.waitForFunction(()=>document.getElementById('model-dialog').open);await page.click('#new-connection');await page.select('#config-adapter',id);await fill('config-label',id);await fill('config-endpoint','http://127.0.0.1:'+providerPort+'/v1');await fill('config-model',id+'-fixture');await fill('config-key','synthetic-'+id);await page.$eval('#config-remember',e=>e.checked=false).catch(()=>{});await page.click('#model-form button[type=submit]');await page.waitForFunction(()=>!document.getElementById('model-dialog').open);}
const apply=async operations=>(await active()).evaluate(async operations=>{const api=window.jueonyEditor,base=api.snapshot();return api.apply(crypto.randomUUID(),base,{message:'검수 명령',sourceIds:[],operations});},operations);



const ready=()=>page.waitForFunction(()=>document.getElementById('app-status')?.textContent.includes('준비 완료'),{timeout:90000});



const cmd=(t,properties={equalizeRows:true},start=0,count=t.rows)=>({kind:'format_table_cells',target:t.id,startRow:start,rowCount:count,startColumn:0,columnCount:t.columns,properties});
function same(a,b,path='layout'){if(typeof a==='number'&&typeof b==='number'){assert.ok(Math.abs(a-b)<=0.2,path+': '+a+' != '+b);return;}if(Array.isArray(a)){assert.equal(a.length,b.length,path);a.forEach((v,i)=>same(v,b[i],path+'['+i+']'));return;}if(a&&typeof a==='object'){assert.deepEqual(Object.keys(a),Object.keys(b),path);for(const k of Object.keys(a))same(a[k],b[k],path+'.'+k);return;}assert.deepEqual(a,b,path);}
async function reopen(f,name){const inspect=()=>f.evaluate(()=>{const d=window.__pageServices.wasm.borrowDocumentHandle();return Array.from({length:d.pageCount()},(_,p)=>({controls:JSON.parse(d.getPageControlLayout(p)).controls,runs:JSON.parse(d.getPageTextLayout(p)).runs}));});const live=await inspect(),x=await save(f,name,'hwpx');x.free();const bytes=[...await readFile(resolve(out,name+'.hwpx'))];await f.evaluate(async bytes=>{const api=window.jueonyEditor;await api.open(new Uint8Array(bytes),'master-review.hwpx',api.fileHandle(),false);},bytes);await delay(500);const reopened=await inspect();same(live,reopened);await writeFile(resolve(out,name+'-layout.json'),JSON.stringify({live,reopened},null,2));}
async function saveAndReopen(f,label,format){
 (await save(f,label,format)).free();
 await f.evaluate(async format=>{
  const api=window.jueonyEditor,handle=api.fileHandle(),bytes=new Uint8Array(await (await handle.getFile()).arrayBuffer());
  await api.open(bytes,'master-review.'+format,handle,false);
 },format);
}
const paragraphOp=(s,text='Direct revised paragraph')=>{const t=s.structure.tables[0],c=s.cellParagraphSources[t.id].cells.find(c=>c.rowSpan*c.columnSpan>1);return {kind:'replace_cell_paragraph',target:t.id,row:c.row,column:c.column,paragraph:1,originalText:c.paragraphs[1].text,text};};
try{
 await new Promise(r=>provider.listen(providerPort,'127.0.0.1',r));for(let i=0;i<100;i++){if(await fetch(origin+'/api/health').then(r=>r.ok,()=>false))break;await delay(100);}
 browser=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--no-first-run','--disable-background-networking'],defaultViewport:{width:1400,height:1000}});page=await browser.newPage();page.setDefaultTimeout(15000);page.on('dialog',d=>{if(d.type()==='beforeunload'){beforeUnloadCount++;void d.accept();}else void d.dismiss();});page.on('pageerror',e=>pageErrors.push(String(e)));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});await page.setRequestInterception(true);page.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:')){externalRequests.push(r.url());void r.abort();}else void r.continue();});await page.goto(origin);await ready();
 if(casePattern)await configure('openai-compatible');
 for(const format of ['hwp','hwpx'])await scenario(format+' inline picture neighbors in a merged paragraph chat edit, undo, redo, save and UI reopen',async()=>{
  const f=await open(format,await createAxisPictureFixture(HwpDocument,out,{merged:true})),before=await snap();
  const owners=s=>s.structure.tables[0].cells.filter(c=>c.axisPicture).map(c=>({index:c.index,picture:c.axisPicture}));
  assert.equal(owners(before).length,4);assert.equal(before.cellParagraphSources.s0p1t0.editable,true);
  await f.evaluate(()=>{
   const ih=window.__pageServices.getInputHandler(),execute=ih.executeDocumentAgentOperation.bind(ih);
   ih.executeDocumentAgentOperation=(cmd,render)=>execute(cmd,async()=>{try{return await render();}catch(e){window.__pictureError=e.message;throw e;}});
  });
  await send('merged paragraph revision');
  assert.equal(await page.$eval('#request-error',e=>e.hidden?'':e.textContent),'',await f.evaluate(()=>window.__pictureError));
  const after=await snap();assert.equal(after.cellParagraphSources.s0p1t0.cells[0].paragraphs[1].text,'Agent revised paragraph 😀');
  same(owners(before),owners(after));
  await undo();assert.deepEqual((await snap()).structure,before.structure);
  await execute('edit:redo');assert.deepEqual((await snap()).structure,after.structure);
  await saveAndReopen(f,'photo-paragraph',format);
  const reopened=await snap();same(owners(after),owners(reopened));
  assert.equal(reopened.cellParagraphSources.s0p1t0.cells[0].paragraphs[1].text,'Agent revised paragraph 😀');
 });
 for(const format of ['hwp','hwpx'])await scenario(format+' edit a later paragraph in a merged picture owner via chat and reopen',async()=>{
  const f=await open(format,await createAxisPictureFixture(HwpDocument,out,{mergeRange:[0,2,1,2]})),before=await snap();
  const paragraphs=s=>s.cellParagraphSources.s0p1t0.cells.find(c=>c.column===2&&c.row===0).paragraphs;
  const pictures=()=>f.evaluate(()=>{
   const d=window.__pageServices.wasm.borrowDocumentHandle();
   return JSON.parse(d.getPageControlLayout(0)).controls.filter(c=>c.type==='image').map(c=>({
    path:c.cellPath,control:c.controlIdx,bytes:[...d.getControlImageData(c.secIdx,c.parentParaIdx,JSON.stringify(c.cellPath),c.controlIdx)]
   }));
  });
  const originals=await pictures();assert.equal(originals.length,4);
  assert.deepEqual(paragraphs(before).map(p=>[p.index,p.editableFrom]),[[0,1],[1,undefined]]);
  await send('photo-owner');
  assert.equal(await page.$eval('#request-error',e=>e.hidden?'':e.textContent),'');
  const after=await snap();assert.deepEqual(paragraphs(after),[{index:0,text:'PicA',editableFrom:1},{index:1,text:'개정5'}]);
  await undo();assert.deepEqual((await snap()).structure,before.structure);
  await execute('edit:redo');assert.deepEqual((await snap()).structure,after.structure);
  await saveAndReopen(f,'photo-owner',format);
  const reopened=await snap();assert.deepEqual(paragraphs(reopened),paragraphs(after));
  assert.deepEqual(await pictures(),originals);
 });
 for(const format of ['hwp','hwpx'])await scenario(format+' picture-suffix chat preserves all three anchors on undo, redo, save and reopen',async()=>{
  const f=await open(format,await createAxisPictureFixture(HwpDocument,out,{merged:true,grouped:true})),before=await snap();
  const owner=s=>s.structure.tables[0].cells.find(c=>c.row===1&&c.column===1);
  const text=s=>s.cellParagraphSources.s0p1t0.cells.find(c=>c.index===owner(s).index).paragraphs[0];
  assert.deepEqual(text(before),{index:0,text:'PicB',editableFrom:4});
  await send('first picture-suffix');assert.equal(await page.$eval('#request-error',e=>e.hidden?'':e.textContent),'');
  const after=await snap();assert.equal(text(after).text,'PicB개정');same(owner(after).axisPicture,owner(before).axisPicture);
  await undo();assert.deepEqual((await snap()).structure,before.structure);
  await execute('edit:redo');assert.deepEqual((await snap()).structure,after.structure);
  await saveAndReopen(f,'picture-suffix',format);
  const restored=await snap();assert.deepEqual(text(restored),text(after));same(owner(restored).axisPicture,owner(after).axisPicture);
 });
 for(const id of ['openai-responses','anthropic','gemini','openai-compatible'])await scenario(id+': actual merged paragraph chat, compare, one undo/redo, safe save and UI reopen',async()=>{
  await configure(id);const f=await open('hwpx',body('hwpx',true)),before=await snap(),t=before.structure.tables[0],cap=before.cellParagraphSources[t.id],start=calls.length;
  await f.evaluate(()=>{const ih=window.__pageServices.getInputHandler();if(window.__paragraphDiagnosticInstalled)return;window.__paragraphDiagnosticInstalled=true;window.__paragraphDiagnostics=[];const native=ih.executeDocumentAgentOperation.bind(ih);ih.executeDocumentAgentOperation=(command,render)=>native(command,async()=>{try{return await render();}catch(e){window.__paragraphDiagnostics.push({message:String(e),stack:e.stack});throw e;}});});
  assert.equal(cap.editable,true);assert.deepEqual(Object.keys(cap.cells[0].paragraphs[1]).sort(),['index','text']);
  await send('merged paragraph revision');assert.equal(calls.length,start+1);assert.equal(calls.at(-1).id,id);assert.equal(calls.at(-1).model,id+'-fixture');assert.equal(calls.at(-1).input.document.cellParagraphSources[t.id].editable,true);
  if(!await page.$eval('#request-error',e=>e.hidden))await writeFile(resolve(out,'diagnostic-'+id+'.json'),JSON.stringify(await f.evaluate(()=>window.__paragraphDiagnostics),null,2));assert.equal(await page.$eval('#request-error',e=>e.hidden),true,await page.$eval('#request-error',e=>e.textContent));const after=await snap();assert.equal(after.structure.tables[0].cells.length,t.cells.length);assert.equal(after.structure.tables[0].cells[0].text,cap.cells[0].paragraphs[0].text+'\nAgent revised paragraph 😀');assert.deepEqual(after.structure.tables[1],before.structure.tables[1]);assert.deepEqual(after.nodes,before.nodes);
  const format=await f.evaluate(()=>{const d=window.__pageServices.wasm.borrowDocumentHandle();return {first:JSON.parse(d.getCellCharPropertiesAt(0,1,0,0,0,0)),second:JSON.parse(d.getCellCharPropertiesAt(0,1,0,0,1,0)),paragraph:JSON.parse(d.getCellParaPropertiesAt(0,1,0,0,1))};});assert.equal(format.first.bold,false);assert.equal(format.second.bold,true);assert.equal(format.paragraph.alignment,'center');
  await lastAction('변경 확인');await page.waitForFunction(()=>document.getElementById('change-dialog').open);await page.$eval('#change-dialog details',e=>e.open=true);await page.screenshot({path:resolve(out,'cell-paragraph-comparison-'+id+'.png')});await page.click('#change-dialog button');await undo();assert.deepEqual((await snap()).structure,before.structure);await execute('edit:redo');assert.deepEqual((await snap()).structure,after.structure);await reopen(f,'cell-paragraph-ui-'+id);
 });
 await scenario('invalid original/coordinate, alias, missing target, overflow, no-op and batch never write',async()=>{for(const request of ['absorbed','alias','missing','overflow','no-op','batch']){await open('hwpx',body());const before=await state();await send(request);assert.equal(await page.$eval('#request-error',e=>e.hidden),false,request);assert.deepEqual(await state(),before);}});
 await scenario('mixed merged paragraph tail through chat retains both style boundaries on disk',async()=>{
  const d=body();d.applyCharFormatInCell(0,1,0,0,1,3,4,'{"italic":true}');
  const f=await open('hwpx',d),s=await snap(),p=s.cellParagraphSources[s.structure.tables[0].id].cells[0].paragraphs[1];
  assert.equal(p.text,'업무 1');assert.deepEqual(p.formatSpans,[{start:0,end:3},{start:3,end:4}]);
  await send('mixed-tail');assert.equal(await page.$eval('#request-error',e=>e.hidden?'':e.textContent),'');
  const after=await snap();assert.equal(after.cellParagraphSources[s.structure.tables[0].id].cells[0].paragraphs[1].text,'업무 개정😀');
  await undo();assert.deepEqual((await snap()).structure.tables,s.structure.tables);
  await execute('edit:redo');const x=await save(f,'mixed-tail','hwpx');
  try{assert.equal(x.getTextInCell(0,1,0,0,1,0,6),'업무 개정😀');assert.equal(JSON.parse(x.getCellCharPropertiesAt(0,1,0,0,1,2)).italic,false);assert.equal(JSON.parse(x.getCellCharPropertiesAt(0,1,0,0,1,5)).italic,true);}
  finally{x.free();}
 });
 for(const format of ['hwp','hwpx']) await scenario(format+' mixed paragraph explicit style spans through chat, undo, redo and saved reopen',async()=>{
  const d=body();d.applyCharFormatInCell(0,1,0,0,1,3,4,'{"italic":true}');
  const f=await open(format,d),before=await snap(),target=before.structure.tables[0].id;
  assert.equal(before.cellParagraphSources[target].editable,true);
  await send('mixed-spans');assert.equal(await page.$eval('#request-error',e=>e.hidden?'':e.textContent),'');
  assert.equal((await snap()).cellParagraphSources[target].cells[0].paragraphs[1].text,'변경😀 공문');
  await undo();assert.deepEqual((await snap()).structure.tables,before.structure.tables);
  await execute('edit:redo');const reopened=await save(f,'mixed-spans',format);
  try{assert.equal(reopened.getTextInCell(0,1,0,0,1,0,6),'변경😀 공문');
   assert.equal(JSON.parse(reopened.getCellCharPropertiesAt(0,1,0,0,1,1)).italic,false);
   assert.equal(JSON.parse(reopened.getCellCharPropertiesAt(0,1,0,0,1,5)).italic,true);
  }finally{reopened.free();}
 });
 for(const format of ['hwp','hwpx'])await scenario(format+' new-character-style through chat, undo/redo and bound file reopen',async()=>{
  const f=await open(format,body(format)),before=await snap(),target=before.structure.tables[0].id;
  await send('new-character-style');assert.equal(await page.$eval('#request-error',e=>e.hidden?'':e.textContent),'');
  assert.equal((await snap()).cellParagraphSources[target].cells[0].paragraphs[1].text,'가😀나다');
  await undo();assert.deepEqual((await snap()).structure.tables,before.structure.tables);
  await execute('edit:redo');const saved=await save(f,'new-character-style',format);
  try{
   const shape=at=>JSON.parse(saved.getCellCharPropertiesAt(0,1,0,0,1,at));
   assert.equal(shape(0).bold,true);assert.equal(shape(3).italic,false);
   for(const i of [1,2])assert.deepEqual([shape(i).bold,shape(i).italic,shape(i).textColor,shape(i).fontSize],[false,true,'#13579b',1450]);
  }finally{saved.free();}
 });
 for(const format of ['hwp','hwpx'])await scenario(format+' neighbor FORMULA preserved through chat, undo/redo and editor reopen',async()=>{
  const d=body(format,true),name='neighbor-formula',revised='Agent revised paragraph 😀';
  d.deleteTextInCell(0,1,0,2,0,0,4);d.insertTextInCell(0,1,0,2,0,0,'3');
  assert.equal(JSON.parse(d.insertTableFormulaField(0,1,0,4,'업무 5','=A2*2','%g')).value,'6');
  d.mergeTableCells(0,2,0,1,0,1,1);
  assert.equal(JSON.parse(d.insertTableFormulaField(0,2,0,1,'','=2+3','%g')).value,'5');
  const f=await open(format,d),before=await snap(),table=before.structure.tables[0];
  const fields=()=>f.evaluate(()=>JSON.parse(window.__pageServices.wasm.borrowDocumentHandle().getFieldList()));
  const originalFields=await fields();assert.equal(originalFields.length,2);
  await send('계산식을 보존하고 병합 셀 문단을 수정해 주세요.');
  assert.equal(await page.$eval('#request-error',e=>e.hidden?'':e.textContent),'');
  const cap=calls.at(-1).input.document.cellParagraphSources[table.id];
  assert.equal(cap.editable,true);assert.ok(!cap.cells.some(c=>c.index===2||c.index===4));
  assert.equal((await snap()).cellParagraphSources[table.id].cells[0].paragraphs[1].text,revised);
  await undo();assert.deepEqual((await snap()).structure.tables,before.structure.tables);
  await execute('edit:redo');const saved=await save(f,name,format);
  try{assert.deepEqual(JSON.parse(saved.getFieldList()),originalFields);}finally{saved.free();}
  await f.evaluate(async()=>{
   const api=window.jueonyEditor,handle=api.fileHandle(),file=await handle.getFile();
   await api.open(new Uint8Array(await file.arrayBuffer()),file.name,handle,false);
  });
  assert.deepEqual(await fields(),originalFields);
  assert.equal((await snap()).cellParagraphSources[table.id].cells[0].paragraphs[1].text,revised);
 });
 for(const format of ['hwp','hwpx'])await scenario(format+' named merged owner value through chat and bound file reopen',async()=>{
  const d=body(format);
  d.setCellProperties(0,1,0,0,JSON.stringify({fieldName:'계획명'}));
  d.setCellProperties(0,1,0,2,JSON.stringify({fieldName:'담당부서'}));
  const f=await open(format,d),before=await snap(),id=before.structure.tables[0].id;
  const fields=()=>f.evaluate(()=>JSON.parse(window.__pageServices.wasm.borrowDocumentHandle().getFieldList()));
  const original=await fields(),[owner,neighbor]=original;
  await send('first: 제목 셀의 첫 문단을 수정해 주세요.');
  assert.equal(await page.$eval('#request-error',e=>e.hidden?'':e.textContent),'');
  const text=(await snap()).cellParagraphSources[id].cells[0].paragraphs[0].text;
  assert.notEqual(text,owner.value);
  const expected=[{...owner,value:text,endCharIdx:Array.from(text).length},neighbor];
  assert.deepEqual(await fields(),expected);
  await undo();assert.deepEqual(await fields(),original);await execute('edit:redo');
  const reopened=await save(f,'named-merged-paragraph',format);
  try{assert.deepEqual(JSON.parse(reopened.getFieldList()),expected);assert.equal(JSON.parse(reopened.getFieldValue(owner.fieldId)).value,text);}
  finally{reopened.free();}
 });
 for(const format of ['hwp','hwpx'])await scenario(format+' anchored body markers and a merged cell through chat and reopen',async()=>{
  const d=body(format);
  const field=JSON.parse(d.insertClickHereField(0,0,2,'담당자','','작성자',true));
  assert.equal(JSON.parse(d.setFieldValue(field.fieldId,'김😀')).ok,true);
  assert.equal(JSON.parse(d.insertClickHereField(0,0,7,'일자','','작성일',true)).ok,true);
  assert.equal(JSON.parse(d.addBookmark(0,0,1,'기안 위치')).ok,true);
  d.insertClickHereFieldInCell(0,1,0,0,1,1,false,'제목','','업무명',true);
  const f=await open(format,d),original=await snap(),table=original.structure.tables[0];
  const stored=await f.evaluate(()=>{
   const doc=window.__pageServices.wasm.borrowDocumentHandle();
   return [JSON.parse(doc.getBookmarks()),JSON.parse(doc.getFieldList()),doc.getTextRange(0,0,0,doc.getParagraphLength(0,0))];
  });
  await send('field-tail: 병합 셀의 누름틀 뒤를 수정해 주세요.');
  assert.equal(await page.$eval('#request-error',e=>e.hidden?'':e.textContent),'');
  const target=()=>snap().then(s=>s.cellParagraphSources[table.id].cells[0].paragraphs[1].text);
  assert.equal(await target(),'업무수정😀');
  await undo();assert.equal(await target(),original.cellParagraphSources[table.id].cells[0].paragraphs[1].text);
  await execute('edit:redo');const reopened=await save(f,'body-markers',format);
  try{assert.deepEqual([JSON.parse(reopened.getBookmarks()),JSON.parse(reopened.getFieldList()),reopened.getTextRange(0,0,0,reopened.getParagraphLength(0,0))],stored);
   assert.equal(reopened.getTextInCell(0,1,0,0,1,0,5),'업무수정😀');}
  finally{reopened.free();}
 });
 for(const format of ['hwp','hwpx'])await scenario(format+' click-here boundaries in two root tables through chat and editor reopen',async()=>{
  const d=body(format,true),local=[0,1,0,0,0],remote=[0,2,0,0,0];
  d.mergeTableCells(0,2,0,0,0,0,1);d.insertTextInCell(...remote,0,'둘째 표 원문');
  d.insertClickHereFieldInCell(...local,1,false,'대상 안내','','대상',true);
  const field=JSON.parse(d.insertClickHereFieldInCell(...remote,1,false,'다른 안내','','다른 표',true));
  assert.equal(JSON.parse(d.setFieldValue(field.fieldId,'값😀칸')).ok,true);
  const f=await open(format,d),before=await snap(),[first,second]=before.structure.tables;
  const fields=()=>f.evaluate(()=>JSON.parse(window.__pageServices.wasm.borrowDocumentHandle().getFieldList()));
  const original=await fields();assert.equal(original.length,2);
  await send('first field-tail: 첫 표의 누름틀 뒤를 수정해 주세요.');
  assert.equal(await page.$eval('#request-error',e=>e.hidden?'':e.textContent),'');
  const caps=calls.at(-1).input.document.cellParagraphSources;
  assert.equal(caps[first.id].cells[0].paragraphs[0].editableFrom,2);
  assert.equal(caps[second.id].cells[0].paragraphs[0].editableFrom,5);
  const edited=await snap();assert.equal(edited.cellParagraphSources[first.id].cells[0].paragraphs[0].text,'업무수정😀');
  assert.deepEqual(edited.structure.tables[1],second);
  await undo();assert.deepEqual((await snap()).structure.tables,before.structure.tables);
  await execute('edit:redo');const saved=await save(f,'two-table-click-here',format);
  try{assert.deepEqual(JSON.parse(saved.getFieldList()),original);}finally{saved.free();}
  await f.evaluate(async()=>{
   const api=window.jueonyEditor,handle=api.fileHandle(),file=await handle.getFile();
   await api.open(new Uint8Array(await file.arrayBuffer()),file.name,handle,false);
  });
  const reopened=await snap();
  assert.equal(reopened.cellParagraphSources[first.id].cells[0].paragraphs[0].text,'업무수정😀');
  assert.deepEqual(reopened.cellParagraphSources[second.id].cells[0].paragraphs[0],{index:0,text:'둘값😀칸째 표 원문',editableFrom:5});
  assert.deepEqual(await fields(),original);
 });
 for(const format of ['hwp','hwpx'])for(const mode of ['split-owner','field-tail','two-field-tail','adjacent-field-tail'])await scenario(format+' '+mode+' through chat, undo/redo and bound file reopen',async()=>{
  const split=mode==='split-owner',d=split?fragmentedMergedCell(HwpDocument):body(format);
  const pair=mode==='two-field-tail'||mode==='adjacent-field-tail';
  if(pair){
   d.insertTextInCell(0,1,0,0,1,d.getCellParagraphLength(0,1,0,0,1),' 원래 문장');
   d.insertClickHereFieldInCell(0,1,0,0,1,mode==='adjacent-field-tail'?0:3,false,'SECOND','memo','input2',true);
  }
  if(!split)d.insertClickHereFieldInCell(0,1,0,0,1,1,false,'FIELD','memo','input',true);
  const fields=JSON.parse(d.getFieldList());
  const f=await open(format,d),before=await snap(),t=before.structure.tables[0],index=split?0:1;
  const paragraph=before.cellParagraphSources[t.id].cells[0].paragraphs[index];
  if(!split)assert.equal(paragraph.editableFrom,mode==='two-field-tail'?4:2);
  await send(split?'first split-owner':'field-tail');assert.equal(await page.$eval('#request-error',e=>e.hidden?'':e.textContent),'');
  const text=split?paragraph.text.slice(0,-6)+'Tail 2':Array.from(paragraph.text).slice(0,paragraph.editableFrom).join('')+'수정😀';
  assert.equal((await snap()).cellParagraphSources[t.id].cells[0].paragraphs[index].text,text);
  await undo();assert.deepEqual((await snap()).structure.tables,before.structure.tables);
  await execute('edit:redo');const reopened=await save(f,mode,format);
  try{
   assert.equal(reopened.getTextInCell(0,1,0,0,index,0,Array.from(text).length),text);
   if(split)assert.ok(reopened.pageCount()>1);
   else {assert.equal(fields.length,pair?2:1);assert.deepEqual(JSON.parse(reopened.getFieldList()),fields);}
  }finally{reopened.free();}
 });
 for(const format of ['hwp','hwpx'])await scenario(format+' delete first style run of a merged cell on a continuation page via chat',async()=>{
  const d=continuedMergedTable(HwpDocument);
  d.applyCharFormatInCell(0,1,0,34,0,5,7,'{"italic":true}');
  const f=await open(format,d),before=await snap();
  await send('first remove-style');
  assert.equal(await page.$eval('#request-error',e=>e.hidden?'':e.textContent),'');
  const bound=before.cellParagraphSources[before.structure.tables[0].id].cells.find(c=>c.row===17&&c.column===0);
  assert.equal(bound.index,34);
  await undo();assert.deepEqual((await snap()).structure.tables,before.structure.tables);
  await execute('edit:redo');const reopened=await save(f,'continued-remove',format);
  try{
   assert.ok(reopened.pageCount()>1);
   assert.equal(reopened.getTextInCell(0,1,0,34,0,0,3),'수정😀');
   assert.equal(JSON.parse(reopened.getCellCharPropertiesAt(0,1,0,34,0,0)).italic,true);
   assert.equal(reopened.getTextInCell(0,1,0,0,0,0,6),'cell 0');
  }finally{reopened.free();}
 });
 await scenario('protection, lock, ambiguous cross-style replacement, field and bookmark remain readonly',async()=>{for(const mode of ['protect','locked','mixed','field','bookmark','zone']){const d=body();if(mode==='protect')d.setCellProperties(0,1,0,1,'{"cellProtect":true}');if(mode==='locked')d.setControlLock(1,0,true);if(mode==='zone')d.setCellZoneProperties(0,1,0,0,0,1,1,JSON.stringify({background:'#aabbcc'}));if(mode==='mixed')d.applyCharFormatInCell(0,1,0,0,1,0,1,'{"italic":true}');if(mode==='field')d.insertClickHereField(0,0,0,'field','','input',true);if(mode==='bookmark')d.addBookmark(0,0,0,'mark');await open('hwpx',d);const before=await state();await send('paragraph revision');assert.equal(await page.$eval('#request-error',e=>e.hidden),false,mode);assert.deepEqual(await state(),before);}});
 await scenario('actual live fault restores bytes/history/dirty/cursor without an extra undo entry',async()=>{for(const mode of ['throw','neighbor','resource','raw-id']){
  const d=body('hwpx',true);d.insertTextInCell(0,2,0,0,0,0,'원본');const f=await open('hwpx',d),before=await state(),op=paragraphOp(await snap()),position=await f.evaluate(()=>window.__pageServices.getInputHandler().getCursorPosition());
  await f.evaluate(mode=>{const d=window.__pageServices.wasm.borrowDocumentHandle(),insert=d.insertTextInCell.bind(d),shape=d.setCharShapeIdInCell.bind(d),chars=d.getCellCharPropertiesAt.bind(d);let armed=false;
   d.insertTextInCell=(...args)=>{const result=insert(...args);if(mode==='throw')throw new Error('synthetic live insert failure');if(mode==='neighbor'){d.deleteTextInCell(0,2,0,0,0,0,2);insert(0,2,0,0,0,0,'변경');}return result;};
   d.setCharShapeIdInCell=(...args)=>{const result=shape(...args);armed=true;if(mode==='resource')d.findOrCreateFontIdForLang(0,'Unexpected unused font');return result;};
   d.getCellCharPropertiesAt=(...args)=>{const result=JSON.parse(chars(...args));if(mode==='raw-id'&&armed)result.charShapeId+=1;return JSON.stringify(result);};window.__restoreParagraph=()=>{d.insertTextInCell=insert;d.setCharShapeIdInCell=shape;d.getCellCharPropertiesAt=chars;};
  },mode);try{await assert.rejects(()=>apply([op]));assert.deepEqual(await state(),before);assert.deepEqual(await f.evaluate(()=>window.__pageServices.getInputHandler().getCursorPosition()),position);}finally{await f.evaluate(()=>window.__restoreParagraph());}
 }});
 await scenario('actual strict post-render geometry fault rolls back, then next request works',async()=>{
  const f=await open('hwpx',body()),before=await state(),op=paragraphOp(await snap(),'Post-render changed');
  await f.evaluate(original=>{const ih=window.__pageServices.getInputHandler(),run=ih.executeDocumentAgentOperation.bind(ih),d=window.__pageServices.wasm.borrowDocumentHandle(),layout=d.getPageControlLayout.bind(d);let armed=false;window.__paragraphStage={reads:0};
   ih.executeDocumentAgentOperation=(command,render)=>run({...command,operation:w=>{const result=command.operation(w);armed=true;return result;}},render);
   d.getPageControlLayout=(...args)=>{const value=JSON.parse(layout(...args));if(armed&&d.getTextInCell(0,1,0,0,1,0,d.getCellParagraphLength(0,1,0,0,1))!==original){for(const c of value.controls.filter(c=>c.type==='table'&&c.paraIdx===1))c.cells[0].h+=5;window.__paragraphStage.reads++;}return JSON.stringify(value);};window.__restoreParagraph=()=>{ih.executeDocumentAgentOperation=run;d.getPageControlLayout=layout;};
  },op.originalText);try{await assert.rejects(()=>apply([op]),/snapshot을 복구했습니다/);assert.deepEqual(await state(),before);assert.ok(await f.evaluate(()=>window.__paragraphStage.reads>0));}finally{await f.evaluate(()=>window.__restoreParagraph());}await send('paragraph revision');assert.equal(await page.$eval('#request-error',e=>e.hidden),true);
 });
 await scenario('late model response cannot overwrite a newer user cell edit',async()=>{
  await open('hwpx',body());const t=(await snap()).structure.tables[0],cell=t.cells.find(c=>c.row===0&&c.column===2),start=calls.length;await fill('request-input','delay paragraph revision');const pending=page.waitForResponse(r=>r.url()===origin+'/api/generate');await page.click('#send-request');for(let i=0;i<50&&calls.length===start;i++)await delay(50);await apply([{kind:'set_table_cell',target:t.id,row:0,column:2,originalText:cell.text,text:'사용자 입력'}]);const changed=await state();await pending;await waitIdle();assert.equal(await page.$eval('#request-error',e=>e.hidden),false);assert.deepEqual(await state(),changed);
 });
 await scenario('empty paragraph, reinsertion and unsupported growth keep request-sized undo and safe save',async()=>{
  const f=await open('hwpx',body()),before=await snap();await apply([paragraphOp(before,'')]);let current=await snap();assert.equal(current.cellParagraphSources[current.structure.tables[0].id].cells[0].paragraphs[1].text,'');await apply([paragraphOp(current,'다시 입력 😀')]);current=await snap();const unchanged=await state();await assert.rejects(()=>apply([paragraphOp(current,'매우 긴 문단 '.repeat(400))]));assert.deepEqual(await state(),unchanged);await reopen(f,'cell-paragraph-empty-reinsert');
 });
 await scenario('unsaved merged paragraph state survives workspace restart without redistributing text',async()=>{
  await open('hwpx',body());await send('paragraph revision');const before=await snap();await delay(1200);await page.reload();await ready();const after=await snap();assert.deepEqual(after.structure,before.structure);const t=after.structure.tables[0];assert.equal(after.cellParagraphSources[t.id].editable,true);const f=await services();await reopen(f,'cell-paragraph-recovery');
 });
 await scenario('no unexpected console/page errors or external assets',()=>{assert.deepEqual(pageErrors,[]);assert.deepEqual(consoleErrors,[]);assert.deepEqual(externalRequests,[]);});
}finally{await browser?.close();server.kill();await new Promise(r=>provider.close(r));}
if(casePattern&&!results.length&&!failures.length)throw Error('No matching cell paragraph scenario: '+casePattern);
await writeFile(resolve(out,'result.json'),JSON.stringify({results,failures,calls:calls.map(({id,model,input})=>({id,model,publicCapOnly:Object.values(input.document.cellParagraphSources??{}).every(s=>!JSON.stringify(s).includes('charShapeId'))})),pageErrors,consoleErrors,externalRequests,beforeUnloadCount,engine:JSON.parse(await readFile(resolve(pkg,'jueony-engine-build.json'),'utf8')),applicationBuild:JSON.parse(await readFile(resolve(dist,'build-evidence.json'),'utf8')),note:'Four synthetic protocol adapters, actual document/undo/save/reopen. Paid calls and Hancom NOT_RUN.'},null,2));if(failures.length)process.exitCode=1;
