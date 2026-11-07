import puppeteer from 'puppeteer-core';
import {fragmentedSubdivisionTable} from './lib/fragmented-subdivision.mjs';
import {subdivisionNeighborFieldTable} from './lib/subdivision-neighbor-fields.mjs';
import {continuedMergedTable} from './lib/continued-merged-table.mjs';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const app=resolve(dirname(fileURLToPath(import.meta.url)),'..'),repo=resolve(app,'../..'),dist=resolve(app,process.env.JUEONY_TEST_DIST),pkg=resolve(repo,process.env.JUEONY_ENGINE_PACKAGE),out=resolve(repo,process.env.JUEONY_TEST_OUTPUT??'build/table-subdivision-browser');await mkdir(out,{recursive:true});
const port=Number(process.env.JUEONY_TEST_PORT??4401),origin=`http://127.0.0.1:${port}`,delay=ms=>new Promise(r=>setTimeout(r,ms)),png=resolve(app,'fixtures/page-background/background-bands.png'),jpg=resolve(app,'fixtures/page-background/background-bands.jpg');
const {default:init,HwpDocument}=await import(pathToFileURL(resolve(pkg,'rhwp.js')).href);await init({module_or_path:await readFile(resolve(pkg,'rhwp_bg.wasm'))});if(await fetch(origin+'/api/health').then(()=>true,()=>false))throw new Error('Test port occupied');
const server=spawn(process.execPath,['apps/launcher/server.mjs'],{cwd:repo,windowsHide:true,stdio:'ignore',env:{...process.env,JUEONY_PORT:String(port),JUEONY_DIST:dist,JUEONY_CONNECTION_STORE:'memory'}}),results=[],failures=[],pageErrors=[],consoleErrors=[],externalRequests=[];let browser,page;let beforeUnloadCount=0;let expectedSaveFailure=false;const expectedSaveErrors=[];
const active=async()=>(await page.$('.editor-frame:not([hidden])')).contentFrame();
async function services(){const f=await active();await f.evaluate(()=>{if(window.__pageServices)return;const a=window.rhwpStudio.automation;a.registerCommand({id:'ext:master-inspect',label:'검수',canExecute:()=>true,execute:s=>window.__pageServices=s});a.execute('ext:master-inspect');a.unregisterCommand('ext:master-inspect');});return f;}
async function execute(id){const r=await(await active()).evaluate(id=>window.jueonyEditor.executeCommand(id),id);assert.equal(r.ok,true,JSON.stringify(r));}
async function open(ext='hwpx',source){const d=source??HwpDocument.createEmpty();if(!source){d.createBlankDocument();d.insertText(0,0,0,'첫 줄\n둘째 줄\n셋째 줄');}const bytes=[...d[ext==='hwp'?'exportHwp':'exportHwpx']()];d.free();const f=await services();await f.evaluate(async(bytes,ext)=>{const root=await navigator.storage.getDirectory(),h=await root.getFileHandle('master-review.'+ext,{create:true}),w=await h.createWritable();await w.write(new Uint8Array(bytes));await w.close();await window.jueonyEditor.open(new Uint8Array(bytes),'master-review.'+ext,h,false);const ih=window.__pageServices.getInputHandler();ih.cursor.moveTo({sectionIndex:0,paragraphIndex:0,charOffset:0});ih.focus();},bytes,ext);return f;}
const state=async()=>(await services()).evaluate(()=>({revision:window.jueonyEditor.revision(),bytes:[...window.jueonyEditor.recovery().bytes],history:window.__pageServices.getInputHandler().history.peekUndoTop()?.type??null,dirty:window.jueonyEditor.state().dirty}));
async function save(f,name,ext){const result=await f.evaluate(async()=>{const api=window.jueonyEditor,status=await api.save();return {status,bytes:[...new Uint8Array(await(await api.fileHandle().getFile()).arrayBuffer())]};});assert.equal(result.status,'saved');await writeFile(resolve(out,name+'.'+ext),new Uint8Array(result.bytes));return new HwpDocument(new Uint8Array(result.bytes));}
async function scenario(name,run){if(process.env.JUEONY_SUBDIVISION_CASE && !name.startsWith(process.env.JUEONY_SUBDIVISION_CASE))return;if(process.env.JUEONY_HIDDEN_OWNER_ONLY==='1'&&!name.startsWith('long-table'))return;try{await run();results.push(name);console.log('PASS',name);}catch(error){failures.push({name,error:String(error),stack:error.stack});console.error('FAIL',name,error);await page.screenshot({path:resolve(out,'failure-'+failures.length+'.png')}).catch(()=>{});await(await active()).evaluate(()=>{document.querySelectorAll('.modal-overlay .dialog-close').forEach(e=>e.click());document.querySelectorAll('dialog[open]').forEach(e=>e.close());}).catch(()=>{});}}
function body(f='hwpx',second=false,makeMerge=false){const d=HwpDocument.createEmpty();d.createBlankDocument();d.insertText(0,0,0,'표 앞 본문 😀');d.splitParagraph(0,0,d.getParagraphLength(0,0));const t=JSON.parse(d.createTable(0,1,0,3,3));assert.equal(t.ok,true);for(let i=0;i<9;i++)d.setCellProperties(0,1,t.controlIdx,i,JSON.stringify({width:[6001,14000,21000][i%3]}));for(let c=0;c<9;c++)d.insertTextInCell(0,t.paraIdx,t.controlIdx,c,0,0,'업무 '+c);d.applyCharFormatInCell(0,t.paraIdx,t.controlIdx,2,0,0,4,JSON.stringify({bold:true,fontSize:1200}));if(second){d.splitParagraph(0,1,d.getParagraphLength(0,1));const other=JSON.parse(d.createTable(0,2,0,2,2));assert.equal(other.ok,true);}for(let i=0;i<9;i++)d.setCellProperties(0,1,t.controlIdx,i,JSON.stringify({height:[5001,7000,9000][Math.floor(i/3)]}));if(makeMerge)d.mergeTableCells(0,1,0,0,0,0,1);const x=new HwpDocument(d[f==='hwp'?'exportHwp':'exportHwpx']());d.free();return x;}
const calls=[],providerPort=Number(process.env.JUEONY_TEST_PROVIDER_PORT??4403);
if(await fetch('http://127.0.0.1:'+providerPort).then(()=>true,()=>false))throw new Error('Mock provider port occupied');
const provider=http.createServer(async(req,res)=>{try{let raw='';for await(const chunk of req)raw+=chunk;const request=JSON.parse(raw),id=req.url.endsWith('/responses')?'openai-responses':req.url.endsWith('/messages')?'anthropic':req.url.includes(':generateContent')?'gemini':'openai-compatible';const input=JSON.parse(id==='gemini'?request.contents[0].parts[0].text:id==='anthropic'?request.messages[0].content:id==='openai-responses'?request.input[1].content:request.messages[1].content);calls.push({id,model:request.model??req.url.split('/models/')[1]?.split(':')[0],input});

 const target=input.instruction.includes('없는 대상')?'s9p0t0':input.instruction.includes('새 표')?'@new':input.document.structure.tables[0]?.id;
 const operations=[{kind:'split_table_cell_into',target,row:1,column:1,rows:2,columns:2}];
 if (id==='openai-responses') operations[0].distributeParagraphs=null;
 if (input.instruction.includes('병합 주 셀')) Object.assign(operations[0],{row:0,column:0,rows:2,columns:1});
 if (input.instruction.includes('문단 분배')) Object.assign(operations[0],{row:0,column:0,rows:2,columns:2,distributeParagraphs:true});
 if(input.instruction.includes('둘째 쪽의 합친 셀')) Object.assign(operations[0],{row:17,column:0,rows:1,columns:3,distributeParagraphs:true});
 if(input.instruction.includes('세 쪽에 걸친 셀'))Object.assign(operations[0],{row:0,column:0,rows:1,columns:3});
 if(input.instruction.includes('이웃 누름틀'))Object.assign(operations[0],{row:0,column:0,rows:1,columns:3});
 if(input.instruction.includes('이름을 첫 칸'))Object.assign(operations[0],{row:0,column:0,rows:1,columns:input.instruction.includes('두 칸')?2:3});
 if(input.instruction.includes('누름틀이 있는 표에 열 추가')) operations[0]={kind:'insert_table_column',target,index:1,values:['','','']};
 if(input.instruction.includes('범위 초과'))operations[0].row=99;
 if(input.instruction.includes('무변경')){operations[0].rows=1;operations[0].columns=1;}
 if(input.instruction.includes('가로')){operations[0].column=2;operations[0].rows=1;operations[0].columns=3;}
 if(input.instruction.includes('세로'))operations[0].columns=1;
 if(input.instruction.includes('미지원'))operations[0].equalRowHeight=false;
 if(input.instruction.includes('묶음'))operations.push({...operations[0]});
 if(input.instruction.includes('지연'))await new Promise(r=>setTimeout(r,2000));
 const generation={message:'한 셀을 지정 행과 열로 나누는 합성 제안입니다.',sourceIds:[],operations};if(id==='anthropic')generation.operations=operations.map(({kind,...args})=>({kind,arguments:JSON.stringify(args)}));const text=JSON.stringify(generation);
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
async function reopen(f,name,ext='hwpx'){const inspect=()=>f.evaluate(()=>{const d=window.__pageServices.wasm.borrowDocumentHandle();return Array.from({length:d.pageCount()},(_,p)=>({controls:JSON.parse(d.getPageControlLayout(p)).controls,runs:JSON.parse(d.getPageTextLayout(p)).runs}));});const live=await inspect(),x=await save(f,name,ext);x.free();const bytes=[...await readFile(resolve(out,name+'.'+ext))];await f.evaluate(async(bytes,ext)=>{const api=window.jueonyEditor;await api.open(new Uint8Array(bytes),'master-review.'+ext,api.fileHandle(),false);},bytes,ext);await delay(500);const reopened=await inspect();same(live,reopened);await writeFile(resolve(out,name+'-layout.json'),JSON.stringify({live,reopened},null,2));}
const split=t=>({kind:'split_table_cell_into',target:t.id,row:1,column:1,rows:2,columns:2});
const error=async expected=>assert.equal(await page.$eval('#request-error',e=>e.hidden),!expected,await page.$eval('#request-error',e=>e.textContent));
async function verifyMergedSubdivision() {
 const doc=body();
 for(let i=0;i<9;i++) doc.setCellProperties(0,1,0,i,JSON.stringify({width:10000,height:9000}));
 doc.mergeTableCells(0,1,0,0,0,1,1);
 const frame=await open('hwpx',doc), before=await snap(), table=before.structure.tables[0];
 assert.equal(before.tableSplitSources[table.id].editable,true);
 await send('병합 주 셀을 두 줄로 나눠줘'); await error(false);
 const after=await snap(), divided=after.structure.tables[0];
 assert.equal(calls.at(-1).input.document.tableSubdivisionSources[table.id].editable,true);
 assert.equal(divided.rows,3); assert.equal(divided.columns,3); assert.equal(divided.cells.length,7);
 assert.equal(divided.cells[0].text,table.cells[0].text);
 assert.deepEqual([divided.cells[0].rowSpan,divided.cells[0].columnSpan],[1,2]);
 await undo(); assert.deepEqual((await snap()).structure,before.structure);
 await execute('edit:redo'); assert.deepEqual((await snap()).structure,after.structure);
 await reopen(frame,'subdivision-merged-grid');
}
try{
 await new Promise(r=>provider.listen(providerPort,'127.0.0.1',r));for(let i=0;i<100;i++){if(await fetch(origin+'/api/health').then(r=>r.ok,()=>false))break;await delay(100);}
 browser=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--no-first-run','--disable-background-networking'],defaultViewport:{width:1400,height:1000}});page=await browser.newPage();page.setDefaultTimeout(15000);page.on('dialog',d=>void (d.type()==='beforeunload'?d.accept():d.dismiss()));page.on('pageerror',e=>pageErrors.push(String(e)));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});await page.setRequestInterception(true);page.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:')){externalRequests.push(r.url());void r.abort();}else void r.continue();});await page.goto(origin);await ready();
 for(const id of ['openai-responses','anthropic','gemini','openai-compatible'])await scenario(id+': chat subdivision, compare, cursor, undo/redo, save/UI reopen',async()=>{await configure(id);const f=await open('hwpx',body('hwpx',true)),before=await snap(),t=before.structure.tables[0],start=calls.length;assert.equal(before.tableSubdivisionSources[t.id].editable,true);await send('셀 2행 2열 분할');await error(false);assert.equal(calls.length,start+1);assert.equal(calls.at(-1).id,id);assert.equal(calls.at(-1).model,id+'-fixture');assert.equal(calls.at(-1).input.document.tableSubdivisionSources[t.id].editable,true);const after=await snap(),table=after.structure.tables[0],primary=table.cells.find(c=>c.row===1&&c.column===1);assert.equal(table.rows,4);assert.equal(table.columns,4);assert.equal(table.cells.length,12);assert.equal(primary.text,t.cells[4].text);for(const c of table.cells.filter(c=>c.row>=1&&c.row<=2&&c.column>=1&&c.column<=2&&c!==primary))assert.equal(c.text,'');assert.deepEqual(after.structure.tables[1],before.structure.tables[1]);assert.deepEqual(after.nodes,before.nodes);assert.equal(await f.evaluate(()=>window.__pageServices.getInputHandler().getCursorPosition().cellIndex),primary.index);await lastAction('변경 확인');await page.waitForFunction(()=>document.getElementById('change-dialog').open);await page.$eval('#change-dialog details',e=>e.open=true);await page.screenshot({path:resolve(out,'subdivision-'+id+'.png')});await page.click('#change-dialog button');await undo();assert.deepEqual((await snap()).structure,before.structure);await execute('edit:redo');assert.deepEqual((await snap()).structure,after.structure);await reopen(f,'subdivision-ui-'+id);});
 for(const ext of ['hwp','hwpx'])for(const columns of [2,3])await scenario('named owner subdivision - '+ext+' keeps one field in '+columns+' pieces',async()=>{
   await configure('openai-compatible');
   const f=await open(ext,subdivisionNeighborFieldTable(HwpDocument,true)),before=await snap(),table=before.structure.tables[0];
   const inspect=()=>f.evaluate(()=>JSON.parse(window.__pageServices.wasm.borrowDocumentHandle().getFieldList()));
   const fields=await inspect(),source=table.cells[0],original=fields.find(v=>v.name===source.properties.fieldName);
   assert.ok(original.cellField && original.value);
   await send('병합 셀을 '+(columns===2?'두 칸':'세 칸')+'으로 나누고 값과 이름을 첫 칸에 유지해 줘');await error(false);
   const after=await snap(),parts=after.structure.tables[0].cells.slice(0,columns),changed=await inspect();
   assert.deepEqual(changed.filter(f=>f.name===original.name),[original]);assert.equal(changed.length,fields.length);
   assert.deepEqual(parts.map(c=>c.text),[source.text,...Array(columns-1).fill('')]);
   assert.deepEqual(parts.map(c=>c.properties.fieldName),[original.name,...Array(columns-1).fill('')]);
   await undo();assert.deepEqual(await inspect(),fields);
   await execute('edit:redo');assert.deepEqual(await inspect(),changed);
   await reopen(f,'split-named-owner-'+columns+'-'+ext,ext);assert.deepEqual(await inspect(),changed);
   assert.deepEqual((await snap()).structure,after.structure);
 });
 for(const ext of ['hwp','hwpx'])await scenario('neighbor field subdivision - '+ext+' moves and saves both field owners',async()=>{
   await configure('openai-compatible');
   const f=await open(ext,subdivisionNeighborFieldTable(HwpDocument));
   const inspect=()=>f.evaluate(()=>JSON.parse(window.__pageServices.wasm.borrowDocumentHandle().getFieldList()));
   const original=await inspect(),before=await snap(),s=before.structure.tables[0];
   assert.deepEqual(before.tableSubdivisionSources[s.id].cells.map(c=>[c.row,c.column]),[[0,0]]);
   await send('이웃 누름틀과 이름 셀의 내용을 유지하고 첫 병합 셀을 세 칸으로 나눠줘');await error(false);
   const after=await snap(),fields=await inspect(),t=after.structure.tables[0];
   assert.equal(fields.length,2);assert.equal(t.cells.length,s.cells.length+2);
   for(const from of original){
     const to=fields.find(v=>v.name===from.name),old=from.location.path[0].cellIndex,index=to.location.path[0].cellIndex;
     assert.ok(index>old);
     assert.equal(to.fieldId,from.cellField?index:from.fieldId);
     assert.equal(to.guide,from.guide);assert.equal(to.value,from.value);
     assert.equal(t.cells[index].axisFieldSignature,s.cells[old].axisFieldSignature);
   }
   await undo();assert.deepEqual(await inspect(),original);
   await execute('edit:redo');assert.deepEqual(await inspect(),fields);
   await reopen(f,'split-neighbor-fields-'+ext,ext);assert.deepEqual(await inspect(),fields);
   await writeFile(resolve(out,'split-neighbor-field-owners-'+ext+'.json'),JSON.stringify({original,fields}));
 });
 for (const ext of ['hwpx','hwp']) await scenario('fragmented subdivision - '+ext+' three-page owner with saved paragraph styles',async()=>{
   await configure('openai-compatible');
   const f=await open(ext,fragmentedSubdivisionTable(HwpDocument,{emoji:false}));
   const before=await snap(),t=before.structure.tables[0],frames=before.tableSubdivisionSources[t.id].frames;
   assert.ok(frames.length>=2 && frames.every(page=>page.cells.find(c=>c.index===0)?.lineSignature));
   await send('세 쪽에 걸친 셀을 세 칸으로 나누고 첫 칸에 원래 문단을 유지해 줘');await error(false);
   const after=await snap(),parts=after.structure.tables[0].cells.filter(c=>c.row===0).slice(0,3);
   assert.deepEqual(parts.map(c=>c.text),[t.cells[0].text,'','']);
   assert.equal(await f.evaluate(()=>JSON.parse(window.__pageServices.wasm.borrowDocumentHandle().getCellCharPropertiesAt(0,1,0,0,19,0)).bold),true);
   const split=after.tableSubdivisionSources[t.id].frames;
   assert.deepEqual(split.map(f=>f.page),frames.map(f=>f.page));
   for(const [i,page] of frames.entries()) {
     const original=page.cells.find(c=>c.index===0);
     for(const [part,c] of parts.entries()){
       const piece=split[i].cells.find(v=>v.index===c.index);
       assert.ok(piece && piece.lineSignature);
       same([piece.x,piece.y,piece.w,piece.h],[original.x+original.w*part/3,original.y,original.w/3,original.h]);
     }
   }
   await undo();assert.deepEqual((await snap()).structure,before.structure);
   await execute('edit:redo');assert.deepEqual((await snap()).structure,after.structure);
   await reopen(f,'fragmented-split-'+ext,ext);assert.deepEqual((await snap()).structure,after.structure);
 });
 for(const ext of ['hwpx','hwp']) await scenario('fragmented subdivision - measured emoji keeps three page fragments in '+ext,async()=>{
   await configure('openai-compatible');
   const f=await open(ext,fragmentedSubdivisionTable(HwpDocument)),before=await snap();
   const widths=await f.evaluate(()=>{
     const wasm=window.__pageServices.wasm,live=wasm.borrowDocumentHandle();
     const copy=new (wasm.getWasmModuleExports().HwpDocument)(live.exportHwpx());
     const width=d=>JSON.parse(d.getPageTextLayout(0)).runs.find(r=>r.text==='😀').w;
     try {return {active:live.canvasMetricsActive(),live:width(live),portable:width(copy)};} finally {copy.free();}
   });
   assert.ok(widths.active && Math.abs(widths.live-widths.portable)>0.2);
   await writeFile(resolve(out,'live-reopened-emoji-width-'+ext+'.json'),JSON.stringify(widths));
   await send('세 쪽에 걸친 셀을 세 칸으로 나눠줘');
   await error(false);
   const after=await snap(),t=before.structure.tables[0],parts=after.structure.tables[0].cells;
   assert.deepEqual(parts.slice(0,3).map(c=>c.text),[t.cells[0].text,'','']);
   const frames=s=>s.tableSubdivisionSources[t.id].frames.map(f=>[f.page,f.cells.find(c=>c.index===0).lineSignature]);
   assert.ok(frames(before).length>1);
   assert.deepEqual(frames(after),frames(before));
   await undo();assert.deepEqual((await snap()).structure,before.structure);
   await execute('edit:redo');assert.deepEqual((await snap()).structure,after.structure);
   await reopen(f,'fragmented-measured-emoji-'+ext,ext);assert.deepEqual(frames(await snap()),frames(after));
 });
 await scenario('fragmented subdivision - changed page breaks preserve bytes and undo history',async()=>{
   await configure('openai-compatible');
   await open('hwpx',fragmentedSubdivisionTable(HwpDocument,{wrapped:true}));
   const before=await state();
   await send('세 쪽에 걸친 셀을 세 칸으로 나눠줘');await error(true);
   assert.match(await page.$eval('#request-error',e=>e.textContent),/표 외형이나 쪽|이웃 셀의 쪽|쪽별 실제 크기|원래 높이/);
   assert.deepEqual(await state(),before);
 });
 await scenario('fragmented subdivision - real page movement after applying rolls back the live emoji document',async()=>{
   const f=await open('hwpx',fragmentedSubdivisionTable(HwpDocument)),base=await snap(),before=await state();
   await f.evaluate(()=>{
     const input=window.__pageServices.getInputHandler(),doc=window.__pageServices.wasm.borrowDocumentHandle();
     const run=input.executeDocumentAgentOperation.bind(input);
     const y=()=>JSON.parse(doc.getPageControlLayout(0)).controls.find(c=>c.type==='table').y;
     const trace=window.__fragmentRollback={};
     input.executeDocumentAgentOperation=(command,render)=>run({...command,operation:wasm=>{
       const result=command.operation(wasm);
       // Move the rendered table on real engine pages, after the copy and
       // live pre-render checks passed. Keep the same printable body height.
       const paper=JSON.parse(doc.getPageDef(0));
       trace.before=y();
       doc.setPageDef(0,JSON.stringify({...paper,marginTop:paper.marginTop+300,marginBottom:paper.marginBottom-300}));
       trace.moved=y();
       return result;
     }},async()=>{try{await render();}catch(e){trace.reason=String(e);throw e;}});
     window.__restoreFragmentTest=()=>{input.executeDocumentAgentOperation=run;};
   });
   try {
     await assert.rejects(()=>apply([{kind:'split_table_cell_into',target:base.structure.tables[0].id,row:0,column:0,rows:1,columns:3}]));
     const trace=await f.evaluate(()=>window.__fragmentRollback);
     assert.ok(trace.moved-trace.before>3,JSON.stringify(trace));
     assert.match(trace.reason,/쪽|외형/);
     assert.deepEqual(await state(),before);
     await writeFile(resolve(out,'fragmented-live-rollback.json'),JSON.stringify(trace));
   } finally {await f.evaluate(()=>window.__restoreFragmentTest());}
 });
 for(const stop of ['cancel','conflict']) await scenario('fragmented subdivision - delayed emoji request honors '+stop,async()=>{
   await configure('openai-compatible');
   await open('hwpx',fragmentedSubdivisionTable(HwpDocument));
   const start=calls.length,before=await state(),base=await snap();
   await fill('request-input','지연 세 쪽에 걸친 셀을 세 칸으로 나눠줘');await page.click('#send-request');
   for(let i=0;i<50 && calls.length===start;i++)await delay(50);
   assert.equal(calls.length,start+1);
   let expected=before;
   if(stop==='cancel'){
     await page.click('#cancel-run');await waitIdle();
     await delay(2100); // The provider completes after the abort.
   } else {
     await apply([{kind:'replace_body_text',target:base.nodes[0].id,start:0,count:1,text:'X'}]);
     expected=await state();
     assert.notEqual(expected.revision,before.revision);
     await waitIdle();await error(true);
   }
   assert.deepEqual(await state(),expected);
   assert.deepEqual((await snap()).structure.tables[0],base.structure.tables[0]);
 });
 await scenario('staggered grid - second page split across new lines with formatted paragraphs',async()=>{
   await configure('openai-compatible');
   const d=continuedMergedTable(HwpDocument);
   d.applyCharFormatInCell(0,1,0,34,1,0,7,'{"bold":true}');
   const f=await open('hwpx',d),before=await snap(),table=before.structure.tables[0];
   assert.ok(before.tableSubdivisionSources[table.id].frames.find(frame=>frame.page>0 && frame.cells.some(cell=>cell.row===17)));
   await send('둘째 쪽의 합친 셀을 세 칸으로 나누고 문단을 차례로 옮겨줘');await error(false);
   const after=await snap();
   const parts=after.structure.tables[0].cells.filter(c=>c.row===17);
   assert.deepEqual(parts.map(c=>c.text),['cell 34','cell 35','']);
   assert.equal(parts[1].characters.bold,true);
   await undo();assert.deepEqual((await snap()).structure,before.structure);
   await execute('edit:redo');assert.deepEqual((await snap()).structure,after.structure);
   await reopen(f,'continued-grid-split');assert.deepEqual((await snap()).structure,after.structure);
 });
 await scenario('staggered grid - insert through merge and retain click-here field',async()=>{
   await configure('openai-compatible');
   const d=body();
   d.mergeTableCells(0,1,0,0,0,0,1);d.mergeTableCells(0,1,0,1,1,1,2);d.mergeTableCells(0,1,0,2,0,2,1);
   d.insertClickHereFieldInCell(0,1,0,0,0,0,false,'안내','설명','입력',true);
   const f=await open('hwp',d),before=await snap(),owner=before.structure.tables[0].cells[0];
   assert.ok(owner.axisFieldSignature);
   await send('누름틀이 있는 표에 열 추가');await error(false);
   const after=await snap(),changed=after.structure.tables[0].cells[0];
   assert.equal(changed.columnSpan,owner.columnSpan+1);
   assert.equal(changed.axisFieldSignature,owner.axisFieldSignature);
   assert.equal(changed.text,owner.text);
   await undo();assert.deepEqual((await snap()).structure,before.structure);
   await execute('edit:redo');assert.deepEqual((await snap()).structure,after.structure);
   await reopen(f,'field-grid-axis','hwp');assert.deepEqual((await snap()).structure,after.structure);
 });
 await scenario('merged cell split into two rows in chat, undo, redo and UI reopen', verifyMergedSubdivision);
 await scenario('HWP5 chat divides original cell paragraphs and saves/reopens the same binary format',async()=>{
   const doc=body();
   for(let i=0;i<9;i++) doc.setCellProperties(0,1,0,i,'{"width":10000,"height":10000}');
   doc.applyParaFormatInCell(0,1,0,3,0,'{"alignment":"right"}');
   doc.mergeTableCells(0,1,0,0,0,1,1);
   const f=await open('hwp',doc),before=await snap(),table=before.structure.tables[0];
   assert.ok(before.tableSubdivisionSources[table.id].hwp5Grid);
   await send('원본 셀의 문단 분배');await error(false);
   const after=await snap();
   assert.deepEqual(after.structure.tables[0].cells.filter(c=>c.row<2&&c.column<2).map(c=>c.text),['업무 0','업무 1','업무 3','업무 4']);
   await undo();assert.deepEqual((await snap()).structure,before.structure);
   await execute('edit:redo');assert.deepEqual((await snap()).structure,after.structure);
   await reopen(f,'original-format-chat-split','hwp');
   assert.deepEqual((await snap()).structure,after.structure);
   assert.equal(await f.evaluate(()=>window.__pageServices.wasm.borrowDocumentHandle().getSourceFormat()),'hwp');
 });
 await scenario('chat splits four styled paragraphs into reading order and preserves request undo, redo and saved cells',async()=>{
   const doc=body();
   for(let i=0;i<9;i++) doc.setCellProperties(0,1,0,i,'{"width":10000,"height":9000}');
   doc.applyCharFormatInCell(0,1,0,1,0,0,4,'{"bold":true}');
   doc.applyParaFormatInCell(0,1,0,3,0,'{"alignment":"right"}');
   doc.mergeTableCells(0,1,0,0,0,1,1);
   const frame=await open('hwpx',doc),before=await snap(),table=before.structure.tables[0];
   assert.equal(before.tableSubdivisionSources[table.id].paragraphFormats.length,4);
   const original=await state();
   await frame.evaluate(()=>{
     const d=window.__pageServices.wasm.borrowDocumentHandle(),split=d.splitCellParagraphs.bind(d);
     d.splitCellParagraphs=(...args)=>{split(...args);throw new Error('합성 문단 분배 후 실패');};
     window.__restoreParagraphSplit=()=>d.splitCellParagraphs=split;
   });
   try {
     await assert.rejects(()=>apply([{kind:'split_table_cell_into',target:table.id,row:0,column:0,rows:2,columns:2,distributeParagraphs:true}]));
     assert.deepEqual(await state(),original);
   } finally { await frame.evaluate(()=>window.__restoreParagraphSplit()); }
   await send('원본 셀의 문단 분배');await error(false);
   const after=await snap(),cells=after.structure.tables[0].cells.filter(c=>c.row<2&&c.column<2);
   assert.deepEqual(cells.map(c=>c.text),['업무 0','업무 1','업무 3','업무 4']);
   assert.equal(cells[1].characters.bold,true);
   await undo();assert.deepEqual((await snap()).structure,before.structure);
   await execute('edit:redo');assert.deepEqual((await snap()).structure,after.structure);
   await reopen(frame,'subdivision-distributed-paragraphs');assert.deepEqual((await snap()).structure,after.structure);
 });
 for(const request of ['가로 분할','세로 분할'])await scenario(request+': one-axis unequal geometry save/reopen',async()=>{const f=await open('hwpx',body());await send(request);await error(false);const t=(await snap()).structure.tables[0];assert.equal(t.rows,request.startsWith('가로')?3:4);assert.equal(t.columns,request.startsWith('가로')?5:3);await reopen(f,'subdivision-'+(request.startsWith('가로')?'horizontal':'vertical'));});
 await scenario('alias/missing/overflow/no-op/extra args/batch refuse without writes',async()=>{for(const request of ['새 표','없는 대상','범위 초과','무변경','미지원','묶음']){await open('hwpx',body());const before=await state();await send(request);await error(true);assert.deepEqual(await state(),before);}});
 await scenario('HWP/protection/hidden grid line/mixed/field/zones/unknown getter readonly',async()=>{for(const mode of ['hwp-multiple','protect','merged','mixed','field','zone','missing']){console.log('readonly fixture',mode);const d=body('hwpx',mode==='hwp-multiple');if(mode==='protect')d.setCellProperties(0,1,0,7,'{"cellProtect":true}');if(mode==='merged'){d.mergeTableCells(0,1,0,0,0,0,1);d.mergeTableCells(0,1,0,2,0,2,1);d.mergeTableCells(0,1,0,1,0,1,1);}if(mode==='mixed')d.applyCharFormatInCell(0,1,0,0,0,0,1,'{"italic":true}');if(mode==='field')d.insertClickHereField(0,0,0,'필드','','입력',true);if(mode==='zone')d.setCellZoneProperties(0,1,0,0,0,2,2,'{}');const f=await open(mode==='hwp-multiple'?'hwp':'hwpx',d),before=await state();if(mode==='missing')await f.evaluate(()=>{const d=window.__pageServices.wasm.borrowDocumentHandle(),native=d.getTableProperties.bind(d);d.getTableProperties=(...a)=>{const p=JSON.parse(native(...a));delete p.cellZoneCount;return JSON.stringify(p);};window.__restoreProps=()=>d.getTableProperties=native;});try{const s=await snap(),t=s.structure.tables[0];assert.equal(s.tableSubdivisionSources[t.id].editable,false,mode);await send('셀 분할');await error(true);if(mode!=='missing')assert.deepEqual(await state(),before);}finally{if(mode==='missing')await f.evaluate(()=>window.__restoreProps());}assert.deepEqual(await state(),before);}});
 await scenario('live Native throw/text/width fault restores bytes/history/cursor/dirty',async()=>{for(const mode of ['throw','text','width']){const d=body('hwpx',true);d.insertTextInCell(0,2,0,0,0,0,'원본');const f=await open('hwpx',d),before=await state(),t=(await snap()).structure.tables[0],pos=await f.evaluate(()=>window.__pageServices.getInputHandler().getCursorPosition());await f.evaluate(mode=>{const d=window.__pageServices.wasm.borrowDocumentHandle(),native=d.splitTableCellInto.bind(d);d.splitTableCellInto=(...a)=>{const r=native(...a);if(mode==='throw')throw new Error('합성 분할 실패');if(mode==='text'){d.deleteTextInCell(0,2,0,0,0,0,2);d.insertTextInCell(0,2,0,0,0,0,'변경');}if(mode==='width')d.setCellProperties(0,1,0,0,'{"width":9999}');return r;};window.__restoreSplit=()=>d.splitTableCellInto=native;},mode);try{await assert.rejects(()=>apply([split(t)]));assert.deepEqual(await state(),before);assert.deepEqual(await f.evaluate(()=>window.__pageServices.getInputHandler().getCursorPosition()),pos);}finally{await f.evaluate(()=>window.__restoreSplit());}}});
 await scenario('post-render geometry fault rolls back and next request succeeds',async()=>{const f=await open('hwpx',body()),before=await state(),t=(await snap()).structure.tables[0];await f.evaluate(()=>{const ih=window.__pageServices.getInputHandler(),run=ih.executeDocumentAgentOperation.bind(ih),d=window.__pageServices.wasm.borrowDocumentHandle(),get=d.getPageControlLayout.bind(d);let armed=false;window.__splitStage={reads:0};ih.executeDocumentAgentOperation=(command,render)=>run({...command,operation:w=>{const r=command.operation(w);armed=true;return r;}},render);d.getPageControlLayout=(...a)=>{const v=JSON.parse(get(...a));if(armed&&JSON.parse(d.getTableDimensions(0,1,0)).cellCount===12){for(const c of v.controls.filter(c=>c.type==='table'&&c.paraIdx===1))c.cells[0].h+=5;window.__splitStage.reads++;}return JSON.stringify(v);};window.__restoreSplit=()=>{ih.executeDocumentAgentOperation=run;d.getPageControlLayout=get;};});try{await assert.rejects(()=>apply([split(t)]),/snapshot을 복구했습니다/);assert.deepEqual(await state(),before);assert.ok(await f.evaluate(()=>window.__splitStage.reads>0));}finally{await f.evaluate(()=>window.__restoreSplit());}await send('셀 분할');await error(false);});
 await scenario('late response preserves newer user edit',async()=>{await open('hwpx',body());const t=(await snap()).structure.tables[0],c=t.cells[0],start=calls.length;await fill('request-input','지연 분할');const pending=page.waitForResponse(r=>r.url()===origin+'/api/generate');await page.click('#send-request');for(let i=0;i<50&&calls.length===start;i++)await delay(50);await apply([{kind:'set_table_cell',target:t.id,row:0,column:0,originalText:c.text,text:'사용자 내용'}]);const changed=await state();await pending;await waitIdle();await error(true);assert.deepEqual(await state(),changed);});
 await scenario('unsaved restart restores the divided grid and rejects an unknown target',async()=>{await open('hwpx',body());await send('셀 분할');const after=await snap();await delay(1400);await page.reload();await ready();await delay(600);assert.deepEqual((await snap()).structure,after.structure);const before=await state();await send('없는 대상 셀 분할');await error(true);assert.deepEqual(await state(),before);});
 await scenario('later-section mapping saves/reopens in UI',async()=>{const d=body();d.insertSectionBreak(0,0,0);const f=await open('hwpx',d);assert.equal((await snap()).structure.tables[0].section,1);await send('셀 분할');await error(false);await reopen(f,'subdivision-later-section');});
 assert.deepEqual(pageErrors,[]);assert.deepEqual(consoleErrors,[]);assert.deepEqual(externalRequests,[]);
}finally{await writeFile(resolve(out,'result.json'),JSON.stringify({results,failures,pageErrors,consoleErrors,externalRequests,providerCalls:calls.map(c=>({adapterId:c.id,model:c.model,instruction:c.input.instruction,tableSubdivisionSources:c.input.document.tableSubdivisionSources})),build:JSON.parse(await readFile(resolve(dist,'build-evidence.json'),'utf8')),note:'Actual Edge with four synthetic provider protocols; HWPX and verified original HWP5 subdivision, merged-cell paragraph distribution, request undo/redo and reopens. Hancom and paid providers NOT_RUN.'},null,2));await browser?.close();server.kill();provider.closeAllConnections();await new Promise(r=>provider.close(r));}if(failures.length)process.exitCode=1;
