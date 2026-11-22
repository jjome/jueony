import puppeteer from 'puppeteer-core';
import http from 'node:http';
import {spawn,execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const app=resolve(dirname(fileURLToPath(import.meta.url)),'..'),repo=resolve(app,'../..'),dist=resolve(app,process.env.JUEONY_TEST_DIST),pkg=resolve(repo,process.env.JUEONY_ENGINE_PACKAGE),out=resolve(repo,process.env.JUEONY_TEST_OUTPUT??'docs/evidence/agent-sections-2026-10-14/section-browser');await mkdir(out,{recursive:true});
const port=Number(process.env.JUEONY_TEST_PORT??4243),origin=`http://127.0.0.1:${port}`,delay=ms=>new Promise(r=>setTimeout(r,ms)),png=resolve(app,'fixtures/page-background/background-bands.png'),jpg=resolve(app,'fixtures/page-background/background-bands.jpg');
const {default:init,HwpDocument}=await import(pathToFileURL(resolve(pkg,'rhwp.js')).href);await init({module_or_path:await readFile(resolve(pkg,'rhwp_bg.wasm'))});if(await fetch(origin+'/api/health').then(()=>true,()=>false))throw new Error('Test port occupied');
const server=spawn(process.execPath,[process.env.JUEONY_TEST_SERVER??'apps/launcher/server.mjs'],{cwd:repo,windowsHide:true,stdio:'ignore',env:{...process.env,JUEONY_PORT:String(port),JUEONY_DIST:dist,JUEONY_CONNECTION_STORE:'memory'}}),results=[],failures=[],pageErrors=[],consoleErrors=[],externalRequests=[];let browser,page;
const active=async()=>(await page.$('.editor-frame:not([hidden])')).contentFrame();
async function services(){const f=await active();await f.evaluate(()=>{if(window.__pageServices)return;const a=window.rhwpStudio.automation;a.registerCommand({id:'ext:master-inspect',label:'검수',canExecute:()=>true,execute:s=>window.__pageServices=s});a.execute('ext:master-inspect');a.unregisterCommand('ext:master-inspect');});return f;}
async function execute(id){const r=await(await active()).evaluate(id=>window.jueonyEditor.executeCommand(id),id);assert.equal(r.ok,true,JSON.stringify(r));}
async function open(ext='hwpx',source){const d=source??HwpDocument.createEmpty();if(!source){d.createBlankDocument();d.insertText(0,0,0,'첫 줄\n둘째 줄\n셋째 줄');}const bytes=[...d[ext==='hwp'?'exportHwp':'exportHwpx']()];d.free();const f=await services();await f.evaluate(async(bytes,ext)=>{const root=await navigator.storage.getDirectory(),h=await root.getFileHandle('empty-review.'+ext,{create:true}),w=await h.createWritable();await w.write(new Uint8Array(bytes));await w.close();await window.jueonyEditor.open(new Uint8Array(bytes),'empty-review.'+ext,h,false);const ih=window.__pageServices.getInputHandler();ih.cursor.moveTo({sectionIndex:0,paragraphIndex:0,charOffset:0});ih.focus();},bytes,ext);return f;}
const read=async(kind='both',section=0)=>(await services()).evaluate((kind,section)=>JSON.parse(window.__pageServices.wasm.borrowDocumentHandle().getPageBorderFillEntry(section,kind)),kind,section);
const state=async()=>(await services()).evaluate(()=>({revision:window.jueonyEditor.revision(),bytes:[...window.jueonyEditor.recovery().bytes],history:window.__pageServices.getInputHandler().history.peekUndoTop()?.type??null,dirty:window.jueonyEditor.state().dirty}));
async function save(f,name,ext){const result=await f.evaluate(async()=>{const api=window.jueonyEditor,status=await api.save();return {status,bytes:[...new Uint8Array(await(await api.fileHandle().getFile()).arrayBuffer())]};});assert.equal(result.status,'saved');await writeFile(resolve(out,name+'.'+ext),new Uint8Array(result.bytes));return new HwpDocument(new Uint8Array(result.bytes));}
async function scenario(name,run){try{await run();results.push(name);console.log('PASS',name);}catch(error){failures.push({name,error:String(error),stack:error.stack});console.error('FAIL',name,error);await page.screenshot({path:resolve(out,'failure-'+failures.length+'.png')}).catch(()=>{});await(await active()).evaluate(()=>{document.querySelectorAll('.modal-overlay .dialog-close').forEach(e=>e.click());document.querySelectorAll('dialog[open]').forEach(e=>e.close());}).catch(()=>{});}}
function body(){const d=HwpDocument.createEmpty();d.createBlankDocument();for(const [i,text] of ['제목 😀','첫 본문','둘째 본문'].entries()){if(i)d.splitParagraph(0,i-1,d.getParagraphLength(0,i-1));d.insertText(0,i,0,text);}return d;}
const calls=[],providerPort=Number(process.env.JUEONY_TEST_PROVIDER_PORT??4245);
const pageSetupModelPort=Number(process.env.JUEONY_TEST_LOCAL_PAGE_SETUP_MODEL_PORT??0);
const scopedPageCases=[
 {name:'current',request:'현재 구역의 용지 방향을 가로로 바꿔 주세요.',sections:[1],property:'landscape',value:true},
 {name:'selected',request:'1구역과 3구역의 용지 방향을 가로로 바꿔 주세요.',sections:[0,2],property:'landscape',value:true},
 {name:'all',request:'모든 구역의 아래 여백을 22 mm로 바꿔 주세요.',sections:[0,1,2],property:'marginBottomMm',value:22},
];
const scopedPageProof=[];
const borderModelPort=Number(process.env.JUEONY_TEST_LOCAL_BORDER_MODEL_PORT??0);
const scopedBorderCases=[
 {name:'current',request:'현재 구역의 쪽 테두리에 머리말과 꼬리말을 포함해 주세요.',sections:[1],flags:{headerInside:true,footerInside:true}},
 {name:'selected',request:'1구역과 3구역의 쪽 테두리에 머리말을 포함해 주세요.',sections:[0,2],flags:{headerInside:true}},
 {name:'all',request:'모든 구역의 쪽 테두리에서 꼬리말을 제외해 주세요.',sections:[0,1,2],flags:{footerInside:false}},
];
const scopedBorderProof=[];
if(await fetch('http://127.0.0.1:'+providerPort).then(()=>true,()=>false))throw new Error('Mock provider port occupied');
const provider=http.createServer(async(req,res)=>{try{req.setEncoding('utf8');let raw='';for await(const chunk of req)raw+=chunk;const request=JSON.parse(raw),id=req.url.endsWith('/responses')?'openai-responses':req.url.endsWith('/messages')?'anthropic':req.url.includes(':generateContent')?'gemini':'openai-compatible';const input=JSON.parse(id==='gemini'?request.contents[0].parts[0].text:id==='anthropic'?request.messages[0].content:id==='openai-responses'?request.input[1].content:request.messages[1].content);calls.push({id,model:request.model??req.url.split('/models/')[1]?.split(':')[0],input});
 const scoped=scopedPageCases.find(test=>test.request===input.instruction);
 const border=scopedBorderCases.find(test=>test.request===input.instruction);
 if(scoped||border){
   const operations=scoped?scoped.sections.map(section=>({kind:'set_page_setup',section,properties:{[scoped.property]:scoped.value}})):
     [{kind:'set_page_border_inclusion',sections:border.sections,...border.flags}];
   const modelPort=scoped?pageSetupModelPort:borderModelPort;
   assert.equal(id,'openai-compatible');
   assert.deepEqual(input.document,{nodes:[],operations});
   assert.deepEqual(input.conversation,[]);
   assert.deepEqual(input.references,[]);
   res.setHeader('Content-Type','application/json');
   if(modelPort){
     const reply=await fetch(`http://127.0.0.1:${modelPort}/v1/chat/completions`,{
       method:'POST',redirect:'error',headers:{'Content-Type':'application/json'},
       body:JSON.stringify({...request,model:'local-table-size-review'}),signal:AbortSignal.timeout(70_000),
     });
     const body=await reply.text();
     console.log('Local section formatting response',JSON.stringify({kind:operations[0].kind,scope:(scoped??border).name,status:reply.status,reply:JSON.parse(body).choices?.[0]?.message?.content}));
     res.statusCode=reply.status;res.end(body);return;
   }
   res.end(JSON.stringify({choices:[{message:{content:JSON.stringify({message:'검수용 용지 설정 제안입니다.',sourceIds:[],operations})}}]}));
   return;
 }
 const tab={kind:'set_section_tabs',section:0,spacingPt:24},line={kind:'set_line_numbers',section:0,enabled:true,restart:'page',countBy:2,startNumber:input.instruction.includes('후속')?20:10,distanceMm:4};
 let operations=input.instruction.includes('탭만')?[tab]:input.instruction.includes('잘못')?[tab,{...line,script:'invalid'}]:[tab,line];
 if(input.instruction.startsWith('편집 용지 범위')){
   assert.deepEqual(input.document.structure.sections.map(section=>section.index),[0,1,2]);
   const direction=input.instruction.includes('가로');
   operations=(direction?[0,2]:[0,1,2]).map(section=>({kind:'set_page_setup',section,properties:direction?{landscape:true}:{marginBottomMm:22}}));
 }
 if(input.instruction.includes('지연'))await new Promise(r=>setTimeout(r,2000));
 const generation={message:'합성 모델의 구역 설정 제안입니다.',sourceIds:[],operations};if(id==='anthropic')generation.operations=operations.map(({kind,...args})=>({kind,arguments:JSON.stringify(args)}));const text=JSON.stringify(generation);
 const wire=id==='openai-responses'?{status:'completed',output:[{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text}]}]}:id==='anthropic'?{type:'message',role:'assistant',stop_reason:'end_turn',content:[{type:'text',text}]}:id==='gemini'?{candidates:[{finishReason:'STOP',content:{role:'model',parts:[{text}]}}]}:{choices:[{message:{content:text}}]};res.setHeader('Content-Type','application/json');res.end(JSON.stringify(wire));}catch(e){res.writeHead(500);res.end(String(e));}});
const snap=async()=>(await active()).evaluate(()=>window.jueonyEditor.snapshot());
async function moveToSection(sectionIndex){
 const f=await services();
 await f.evaluate(sectionIndex=>{
  const input=window.__pageServices.getInputHandler();
  input.cursor.moveTo({sectionIndex,paragraphIndex:0,charOffset:0});
  input.updateCaret();input.focus();
 },sectionIndex);
}
const fill=(id,value)=>page.$eval('#'+id,(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);
const waitIdle=()=>page.waitForFunction(()=>!document.getElementById('send-request').disabled,{timeout:60000});
async function send(text){await fill('request-input',text);const pending=page.waitForResponse(r=>r.url()===origin+'/api/generate');await page.click('#send-request');await pending;await waitIdle();}
async function lastAction(text){for(const button of (await page.$$('.message-actions button')).reverse())if(await button.evaluate((e,t)=>e.textContent===t,text)){await button.click();return;}throw new Error('Missing action '+text);}
async function undo(){await lastAction('요청 되돌리기');await page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('되돌렸습니다'));}
async function configure(id){await page.click('#connection-settings');await page.waitForFunction(()=>document.getElementById('model-dialog').open);await page.click('#new-connection');await page.select('#config-adapter',id);await fill('config-label',id);await fill('config-endpoint','http://127.0.0.1:'+providerPort+'/v1');await fill('config-model',id+'-fixture');await fill('config-key','synthetic-'+id);await page.$eval('#config-remember',e=>e.checked=false).catch(()=>{});await page.click('#model-form button[type=submit]');await page.waitForFunction(()=>!document.getElementById('model-dialog').open);}
const apply=async operations=>(await active()).evaluate(async operations=>{const api=window.jueonyEditor,base=api.snapshot();return api.apply(crypto.randomUUID(),base,{message:'검수 명령',sourceIds:[],operations});},operations);
try{
 await new Promise(r=>provider.listen(providerPort,'127.0.0.1',r));for(let i=0;i<100;i++){if(await fetch(origin+'/api/health').then(r=>r.ok,()=>false))break;await delay(100);}
 browser=await puppeteer.launch({executablePath:process.env.JUEONY_TEST_BROWSER??'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--no-first-run','--disable-background-networking'],defaultViewport:{width:1400,height:1000}});page=await browser.newPage();page.setDefaultTimeout(15000);page.on('dialog',dialog=>dialog.dismiss());page.on('pageerror',e=>pageErrors.push(String(e)));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});page.on('response',response=>{if(response.status()===404)console.error('Missing resource:',new URL(response.url()).pathname);});await page.setRequestInterception(true);page.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:')){externalRequests.push(r.url());void r.abort();}else void r.continue();});await page.goto(origin);await page.waitForFunction(()=>document.getElementById('app-status')?.textContent.includes('준비 완료'),{timeout:90000});
 for(const id of ['openai-responses','anthropic','gemini','openai-compatible'])await scenario(`${id}: actual chat selects the provider/model and changes tabs plus line numbers with one request undo and save`,async()=>{await configure(id);const f=await open('hwpx',body()),before=await snap(),start=calls.length;await send('기본 탭을 24pt로 바꾸고 줄 번호는 10부터 2줄마다 표시해줘');assert.equal(calls.length,start+1);const call=calls.at(-1);assert.equal(call.id,id);assert.equal(call.model,id+'-fixture');assert.equal(call.input.document.structure.sections[0].defaultTabSpacingPt,40);assert.equal(call.input.document.structure.sections[0].lineNumbers.enabled,false);const after=await snap();assert.equal(after.structure.sections[0].defaultTabSpacingPt,24);assert.equal(after.structure.sections[0].lineNumbers.startNumber,10);assert.equal(after.structure.sections[0].lineNumbers.enabled,true);assert.deepEqual(after.nodes.map(n=>n.text),before.nodes.map(n=>n.text));await lastAction('변경 확인');await page.waitForFunction(()=>document.getElementById('change-dialog').open);assert.match(await page.$eval('#change-dialog',e=>e.textContent),/기본 탭/);await page.click('#change-dialog button');const loaded=await save(f,'provider-'+id,'hwpx');try{assert.equal(JSON.parse(loaded.getLineNumberSettings(0)).startNumber,10);assert.equal(JSON.parse(loaded.getSectionDef(0)).defaultTabSpacing,4800);}finally{loaded.free();}await undo();assert.deepEqual((await snap()).structure,before.structure);await execute('edit:redo');assert.equal((await snap()).structure.sections[0].lineNumbers.enabled,true);});
 for(const format of ['hwp','hwpx'])await scenario(`${format}: actual model requests change selected page directions and all-section margins through one undo each`,async()=>{
   const doc=body();
   doc.insertSectionBreak(0,1,0);
   doc.insertSectionBreak(1,1,0);
   for(const section of [0,1,2])doc.setPageDef(section,JSON.stringify({marginLeft:7800+section*420,landscape:false}));
   const f=await open(format,doc),before=await snap();
   await send('편집 용지 범위: 첫째와 셋째 구역만 가로 방향으로 바꿔 줘');
   const selected=await snap();
   assert.deepEqual(selected.structure.sections.map(section=>section.page.landscape),[true,false,true]);
   assert.deepEqual(selected.structure.sections[1],before.structure.sections[1]);
   await send('편집 용지 범위: 모든 구역의 아래 여백을 22mm로 바꿔 줘');
   const after=await snap();
   assert.deepEqual(after.structure.sections.map(section=>section.page.marginBottom),Array(3).fill(Math.round(22*7200/25.4)));
   assert.deepEqual(after.structure.sections.map(section=>section.page.marginLeft),before.structure.sections.map(section=>section.page.marginLeft));
   assert.deepEqual(after.nodes,before.nodes);
   const loaded=await save(f,'provider-page-scope-'+format,format);
   try{
     for(const section of [0,1,2])assert.deepEqual(JSON.parse(loaded.getPageDef(section)),after.structure.sections[section].page);
   }finally{loaded.free();}
   await undo();
   assert.deepEqual((await snap()).structure.sections,selected.structure.sections);
   await execute('edit:undo');
   assert.deepEqual((await snap()).structure.sections,before.structure.sections);
 });
 for(const format of ['hwp','hwpx'])for(const test of scopedPageCases)await scenario(`${format}: ${test.name} page setup uses only its verified sections and one undo`,async()=>{
   const doc=body();
   doc.insertSectionBreak(0,1,0);doc.insertSectionBreak(1,1,0);
   for(const section of [0,1,2])doc.setPageDef(section,JSON.stringify({marginLeft:7800+section*420,landscape:false}));
   const f=await open(format,doc);
   await moveToSection(1);
   const before=await snap(),original=await state(),start=calls.length;
   assert.equal(before.currentSection,1);
   await send(test.request);
   assert.equal(calls.length,start+1);
   const after=await snap();
   const field=test.property==='landscape'?'landscape':'marginBottom';
   const value=test.property==='landscape'?test.value:Math.round(test.value*7200/25.4);
   const changes=before.structure.sections.map((section,index)=>test.sections.includes(index)?{...section,page:{...section.page,[field]:value}}:section);
   assert.deepEqual(after.structure.sections,changes);
   assert.deepEqual(after.nodes,before.nodes);
   const loaded=await save(f,`scoped-${test.name}-${format}`,format);
   try{
     for(const section of changes)assert.deepEqual(JSON.parse(loaded.getPageDef(section.index)),section.page);
   }finally{loaded.free();}
   await undo();
   assert.deepEqual((await snap()).structure,before.structure);
   await moveToSection(1);
   assert.deepEqual((await state()).bytes,original.bytes);
   scopedPageProof.push({format,scope:test.name,sections:test.sections,realModel:Boolean(pageSetupModelPort),savedAndReopened:true,undoByteExact:true});
 });
 if(borderModelPort)for(const format of ['hwp','hwpx'])for(const test of scopedBorderCases)await scenario(`${format}: ${test.name} changes only the requested flags on the three page parities`,async()=>{
   const doc=body();
   doc.insertSectionBreak(0,1,0);doc.insertSectionBreak(1,1,0);
   for(const [section,fillColor] of ['#fff2cc','#bbccdd','#efe9ed'].entries()){
     const original=JSON.parse(doc.getPageBorderFillEntry(section,'both'));
     doc.setPageBorderFillEntry(section,'both',JSON.stringify({...original,basis:'page',headerInside:false,
       footerInside:test.name==='all',fillType:'solid',fillColor}));
   }
   const f=await open(format,doc);
   await moveToSection(1);
   const before=await snap(),original=await state(),start=calls.length;
   assert.equal(before.currentSection,1);
   assert(before.structure.sections.every(section=>section.pageBorderInclusion.editable));
   const originalColors=await f.evaluate(()=>{
     const doc=window.__pageServices.wasm.borrowDocumentHandle();
     return [0,1,2].map(section=>Object.fromEntries(['both','even','odd'].map(kind=>[kind,JSON.parse(doc.getPageBorderFillEntry(section,kind)).fillColor])));
   });
   await send(test.request);
   assert.equal(calls.length,start+1);
   const after=await snap();
   const expected=before.structure.sections.map((section,index)=>section.pageBorderInclusion.entries.map(entry=>test.sections.includes(index)?{...entry,...test.flags}:entry));
   assert.deepEqual(after.structure.sections.map(section=>section.pageBorderInclusion.entries),expected);
   assert.deepEqual(after.nodes,before.nodes);
   if(process.env.JUEONY_TEST_SECTION_RECEIPTS==='1'){
     await lastAction('변경 확인');await page.waitForSelector('#change-dialog[open]');
     const details=await page.$eval('#structure-diff-text',node=>node.textContent);
     for(const index of test.sections)assert.match(details,new RegExp(`${index+1}구역 · 쪽 테두리 머리말·꼬리말 포함`,'u'));
     if(Object.hasOwn(test.flags,'headerInside'))assert.match(details,/머리말 제외 → 포함/u);
     if(Object.hasOwn(test.flags,'footerInside'))assert.match(details,test.flags.footerInside?/꼬리말 제외 → 포함/u:/꼬리말 포함 → 제외/u);
     await page.click('#change-dialog button');
   }
   const loaded=await save(f,`scoped-border-${test.name}-${format}`,format);
   try{
     for(const [index,entries] of expected.entries())for(const entry of entries){
       const actual=JSON.parse(loaded.getPageBorderFillEntry(index,entry.kind));
       assert.deepEqual([actual.fillColor,actual.headerInside,actual.footerInside],[originalColors[index][entry.kind],entry.headerInside,entry.footerInside]);
     }
   }finally{loaded.free();}
   await undo();
   await moveToSection(1);
   assert.deepEqual((await state()).bytes,original.bytes);
   scopedBorderProof.push({format,scope:test.name,sections:test.sections,realModel:true,savedAndReopened:true,undoByteExact:true,
     receiptFlagsVerified:process.env.JUEONY_TEST_SECTION_RECEIPTS==='1'});
 });
 await scenario('follow-up chat edits an already numbered HWPX without converting the rollback baseline to HWP',async()=>{const f=await open('hwpx',body());await send('줄 번호와 기본 탭을 적용해줘');const before=await snap();await send('후속: 줄 번호 시작을 20으로 바꿔줘');assert.equal((await snap()).structure.sections[0].lineNumbers.startNumber,20);const loaded=await save(f,'follow-up-numbering','hwpx');try{assert.equal(JSON.parse(loaded.getLineNumberSettings(0)).startNumber,20);}finally{loaded.free();}await undo();assert.deepEqual((await snap()).structure,before.structure);});
 await scenario('HWP tab-only request saves, while an HWP numbering batch is rejected before changing its tabs',async()=>{const f=await open('hwp',body());await send('기본 탭만 24pt로 바꿔줘');assert.equal((await snap()).structure.sections[0].defaultTabSpacingPt,24);const loaded=await save(f,'hwp-tabs','hwp');try{assert.equal(JSON.parse(loaded.getSectionDef(0)).defaultTabSpacing,4800);}finally{loaded.free();}await undo();const before=await state();await send('줄 번호와 탭을 적용해줘');assert.match(await page.$eval('#request-error',e=>e.textContent),/HWPX/);assert.deepEqual((await state()).bytes,before.bytes);});
 await scenario('invalid model command cannot partially apply its preceding valid tab operation',async()=>{await open('hwpx',body());const before=await state();await send('잘못된 구역 설정 검수');assert.match(await page.$eval('#request-error',e=>e.textContent),/속성|지원/);assert.deepEqual((await state()).bytes,before.bytes);assert.equal((await state()).history,before.history);});
 await scenario('late live native failure rolls back enabled HWPX line configuration, body, tabs and prior history',async()=>{const f=await open('hwpx',body());await send('줄 번호와 탭을 적용해줘');const before=await state(),structure=(await snap()).structure;await f.evaluate(()=>{const d=window.__pageServices.wasm.borrowDocumentHandle(),original=d.setLineNumberSettings.bind(d);d.setLineNumberSettings=(...args)=>{original(...args);throw new Error('합성 실문서 줄 번호 실패');};});const error=await f.evaluate(async()=>{try{const api=window.jueonyEditor;await api.apply(crypto.randomUUID(),api.snapshot(),{message:'실패 검수',sourceIds:[],operations:[{kind:'set_section_tabs',section:0,spacingPt:18},{kind:'set_line_numbers',section:0,enabled:true,restart:'page',countBy:1,startNumber:40,distanceMm:4}]});return null;}catch(e){return {name:e.name,message:e.message};}});assert.equal(error.name,'RolledBackError');assert.match(error.message,/합성/);const after=await state();assert.deepEqual(after.bytes,before.bytes);assert.equal(after.history,before.history);assert.equal(after.dirty,before.dirty);assert.deepEqual((await snap()).structure,structure);});
 await scenario('document changes during a delayed model call prevent stale section settings from applying',async()=>{await open('hwpx',body());const start=calls.length;await fill('request-input','지연 구역 설정');await page.click('#send-request');for(let i=0;i<100&&calls.length===start;i++)await delay(30);assert.equal(calls.length,start+1);await apply([{kind:'set_section_tabs',section:0,spacingPt:18}]);await waitIdle();assert.equal((await snap()).structure.sections[0].defaultTabSpacingPt,18);assert.equal((await snap()).structure.sections[0].lineNumbers.enabled,false);assert.match(await page.$eval('#request-error',e=>e.textContent),/변경|최신/);});
 await scenario('saved HWPX section settings persist after shell checkpoint and application restart',async()=>{await open('hwpx',body());await send('구역 설정을 적용해줘');await page.click('#save-document');await page.waitForFunction(()=>document.getElementById('app-status').textContent==='파일에 저장했습니다.');await delay(2200);await page.reload();await page.waitForFunction(()=>document.getElementById('app-status')?.textContent.includes('준비 완료'),{timeout:90000});const value=await snap();assert.equal(value.structure.sections[0].defaultTabSpacingPt,24);assert.equal(value.structure.sections[0].lineNumbers.startNumber,10);assert.equal(value.structure.sections[0].lineNumbers.enabled,true);await page.screenshot({path:resolve(out,'agent-section-settings.png')});});
 assert.deepEqual(pageErrors,[]);assert.deepEqual(consoleErrors,[]);assert.deepEqual(externalRequests,[]);
}finally{await writeFile(resolve(out,'result.json'),JSON.stringify({results,failures,pageErrors,consoleErrors,externalRequests,scopedPageProof,scopedBorderProof,providerCalls:calls.map(c=>({adapterId:c.id,model:c.model,instruction:c.input.instruction,sections:c.input.document.structure?.sections,operations:c.input.document.operations,body:c.input.document.nodes.map(n=>n.text)})),build:JSON.parse(await readFile(resolve(dist,'build-evidence.json'),'utf8')),note:'Narrow scope cases use the real loopback model when configured. Other adapter and refusal cases use deterministic synthetic replies. Checked real document changes, request undo, independent reopen and failure rollback.'},null,2));await browser?.close();server.kill();provider.closeAllConnections();await new Promise(r=>provider.close(r));}if(failures.length||pageErrors.length||consoleErrors.length||externalRequests.length)process.exitCode=1;
