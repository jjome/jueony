// Real browser + local API adapters + WASM document engine; synthetic provider replies.
// Uses a separate profile and an isolated DPAPI store. Never reads production keys.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,mkdir,readFile,writeFile,unlink,rmdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import http from 'node:http';
import puppeteer from 'puppeteer-core';
const directory=await mkdtemp(join(tmpdir(),'jueony-native-ui-')),file=join(directory,'connections.dpapi');
const origin='http://127.0.0.1:4204',evidence=resolve('evidence/native-providers');await mkdir(evidence,{recursive:true});
let server,browser,provider,providerOrigin;const results=[],calls=[],errors=[];
const pass=name=>{results.push(name);console.log('PASS '+name);};
const stop=async()=>{if(server&&server.exitCode===null){const closed=once(server,'exit');server.kill();await closed;}};
async function start(){
 server=spawn(process.execPath,['../launcher/server.mjs'],{windowsHide:true,env:{...process.env,JUEONY_PORT:'4204',JUEONY_DIST:resolve('dist'),JUEONY_CONNECTION_STORE:file},stdio:'ignore'});
 for(let i=0;i<100;i++){if(server.exitCode!==null)throw new Error('Server failed');if(await fetch(origin+'/api/health').then(r=>r.ok,()=>false))return;await new Promise(r=>setTimeout(r,100));}throw new Error('Server timed out');
}
try{
 assert.equal(await fetch(origin+'/api/health').then(()=>true,()=>false),false);
 provider=http.createServer(async(req,res)=>{
  let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw);
  const id=req.url.endsWith('/responses')?'openai-responses':req.url.endsWith('/messages')?'anthropic':'gemini';
  const data=JSON.parse(id==='openai-responses'?body.input[1].content:id==='anthropic'?body.messages[0].content:body.contents[0].parts[0].text);
  calls.push({id,model:body.model??req.url.split('/models/')[1].split(':')[0],key:req.headers.authorization??req.headers['x-api-key']??req.headers['x-goog-api-key'],input:data});
  const probe=data.document.revision==='connection-test',edit=data.instruction.includes('수정');
  const generation={message:'검증용 편집 제안',sourceIds:[],operations:probe?[]:edit?[
   {kind:'replace_body_text',target:data.document.nodes[0].id,start:0,count:data.document.nodes[0].codePointLength,text:id+' 수정 제목'},
   {kind:'format_characters',target:data.document.nodes[0].id,properties:{bold:true,fontSizePt:16,...(id==='openai-responses'?{italic:null,underline:null,strikethrough:null,color:null}:{})}},
   {kind:'create_table',after:data.document.nodes[1].id,resultId:'verify',rows:[['항목','상태'],['검사','대기']]},
   {kind:'insert_table_row',target:'@verify',index:2,values:['추가','확인']},
   {kind:'insert_table_column',target:'@verify',index:2,values:['비고','','완료']},
   {kind:'delete_table_row',target:'@verify',index:1},
   {kind:'delete_table_column',target:'@verify',index:1},
  ]:[{kind:'create_document',paragraphs:[id+' 제목','본문 검증']}]};
  if(id==='anthropic')generation.operations=generation.operations.map(({kind,...args})=>({kind,arguments:JSON.stringify(args)}));
  const text=JSON.stringify(generation),refusal=data.instruction.includes('거부');
  const wire=id==='openai-responses'?{status:'completed',output:[{type:'message',role:'assistant',status:'completed',content:[refusal?{type:'refusal',refusal:'blocked'}:{type:'output_text',text}]}]}:id==='anthropic'?{type:'message',role:'assistant',stop_reason:refusal?'refusal':'end_turn',content:[{type:'text',text}]}:{candidates:[{finishReason:refusal?'SAFETY':'STOP',content:{role:'model',parts:[{text}]}}]};
  await new Promise(r=>setTimeout(r,120));res.end(JSON.stringify(wire));
 });await new Promise(r=>provider.listen(0,'127.0.0.1',r));providerOrigin='http://127.0.0.1:'+provider.address().port+'/v1';
 await start();browser=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,defaultViewport:{width:1600,height:1080},args:['--no-first-run','--disable-background-networking']});
 const page=await browser.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 const ready=()=>page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('준비 완료'));
 const open=async()=>{await page.click('#connection-settings');await page.waitForFunction(()=>document.getElementById('model-dialog').open);};
 const fill=(id,value)=>page.$eval('#'+id,(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);
 const save=async()=>{await page.click('#model-form button[type=submit]');await page.waitForFunction(()=>!document.getElementById('model-dialog').open);};
 const snap=()=>page.evaluate(()=>document.querySelector('.editor-frame:not([hidden])').contentWindow.jueonyEditor.snapshot());
 const send=async(text,success=true)=>{await fill('request-input',text);const pending=page.waitForResponse(r=>r.url()===origin+'/api/generate');await page.click('#send-request');await pending;await page.waitForFunction(()=>!document.getElementById('send-request').disabled);const status=await page.$eval('#app-status',e=>e.textContent);if(success)assert.equal(status,'AI 요청이 완료되었습니다.');else assert.match(status,/거부|차단/);};
 const ids=['openai-responses','anthropic','gemini'],saved={};
 await page.goto(origin+'/?storage=download');await ready();
 for(const id of ids){
  await open();await page.click('#new-connection');await page.select('#config-adapter',id);
  assert.match(await page.$eval('#config-endpoint',e=>e.value),/^https:/);
  await fill('config-label',id);await fill('config-model',id+'-model');await fill('config-endpoint',providerOrigin);await fill('config-key','fake-'+id);
  await save();saved[id]=await page.$eval('#model-select',e=>e.value);
  await open();assert.equal(await page.$eval('#config-key',e=>e.value),'');await page.click('#test-connection');await page.waitForFunction(()=>document.getElementById('config-status').textContent.includes('연결 테스트 성공'));
  assert.equal(calls.at(-1).id,id);assert.deepEqual(calls.at(-1).input.references,[]);assert.deepEqual(calls.at(-1).input.document.nodes,[]);await page.click('#close-settings');
  await send('새 문서를 만들어줘');const created=await snap();assert.equal(created.nodes[0].text,id+' 제목');assert.equal(calls.at(-1).model,id+'-model');
  await send('제목을 수정하고 굵게 16pt로');const edited=await snap();assert.equal(edited.nodes[0].text,id+' 수정 제목');assert.equal(edited.structure.paragraphs[0].characters.fontSize,1600);assert.equal(edited.structure.paragraphs[0].characters.bold,true);
  assert.deepEqual(edited.structure.tables[0].cells.map(c=>c.text),['항목','비고','추가','완료']);
  const buttons=await page.$$('.message-actions button');await buttons.at(-1).click();await page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('되돌렸습니다'));assert.deepEqual((await snap()).structure,created.structure);
  await send('거부 동작 확인',false);assert.deepEqual((await snap()).structure,created.structure);
  pass(id+': UI registration, native request, probe, create, edit/format, undo, refusal');
 }
 // File picker, drop, and clipboard paths all enter the same temporary source boundary.
 const firstChat=await page.$eval('.chat-item.active',e=>e.textContent);
 const chooser=page.waitForFileChooser();await page.click('#attach-reference');await (await chooser).accept([resolve('fixtures/three-paragraphs.hwpx')]);
 await page.waitForSelector('.attachment-chip');
 await page.evaluate(()=>{
  const dropped=new DataTransfer();dropped.items.add(new File(['임시 TXT 자료'],'drop.txt'));
  document.getElementById('chat-panel').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dropped}));
  const pasted=new DataTransfer();pasted.items.add(new File(['임시 MD 자료'],'paste.md'));
  document.getElementById('request-input').dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:pasted}));
 });
 assert.equal(await page.$$eval('.attachment-chip',els=>els.length),3);
 await send('첨부 참고 새 문서를 만들어줘');assert.equal(calls.at(-1).input.references.length,3);assert.ok(calls.at(-1).input.references.some(s=>s.text==='임시 TXT 자료'));assert.ok(calls.at(-1).input.references.some(s=>s.name.endsWith('.hwpx')&&s.text.length>0));
 await page.click('#add-chat');assert.equal(await page.$$eval('.attachment-chip',els=>els.length),0);await send('새 채팅 문서를 만들어줘');assert.equal(calls.at(-1).input.references.length,0);
 await page.evaluate(title=>[...document.querySelectorAll('.chat-item')].find(e=>e.textContent===title).click(),firstChat);assert.equal(await page.$$eval('.attachment-chip',els=>els.length),3);
 await page.click('.attachment-chip');assert.equal(await page.$$eval('.attachment-chip',els=>els.length),2);
 pass('picker/drop/paste attachments parse HWPX and remain isolated to their chat');
 const encrypted=await readFile(file);for(const id of ids)assert.ok(!encrypted.includes('fake-'+id));pass('all three keys are encrypted on disk');
 await open();await page.screenshot({path:join(evidence,'connections.png'),fullPage:true});
 await page.select('#saved-connections',saved['openai-responses']);assert.equal(await page.$eval('#config-adapter',e=>e.value),'openai-responses');
 await fill('config-model','changed-model');await save();await open();await page.click('#test-connection');await page.waitForFunction(()=>document.getElementById('config-status').textContent.includes('연결 테스트 성공'));assert.equal(calls.at(-1).model,'changed-model');assert.equal(calls.at(-1).key,'Bearer fake-openai-responses');pass('saved connection picker edits model using its original key');
 await fill('config-key','fake-rotated');await save();await stop();await start();await page.reload();await ready();await open();
 assert.equal(await page.$$eval('#saved-connections option',els=>els.length),4);await page.select('#saved-connections',saved['openai-responses']);assert.equal(await page.$eval('#config-key',e=>e.value),'');await page.click('#test-connection');await page.waitForFunction(()=>document.getElementById('config-status').textContent.includes('연결 테스트 성공'));assert.equal(calls.at(-1).key,'Bearer fake-rotated');pass('all providers and rotated key restore after server restart');
 assert.equal(await page.$$eval('.attachment-chip',els=>els.length),0);pass('temporary file attachments are released on reload');
 await page.click('#delete-connection');await page.waitForFunction(()=>document.getElementById('config-status').textContent.includes('선택한 연결'));assert.equal(await page.$$eval('#saved-connections option',els=>els.length),3);await page.click('#close-settings');
 await stop();await start();await page.reload();await ready();await open();assert.equal(await page.$$eval('#saved-connections option',els=>els.length),3);pass('individual deletion preserves other provider connections across restart');
 assert.deepEqual(errors,[]);await writeFile(join(evidence,'result.json'),JSON.stringify({status:'PASS',results,externalAPICalls:0,fixtureCalls:calls.length,errors,runtime:await browser.version()},null,2));
}catch(e){console.error(e);process.exitCode=1;if(browser)await (await browser.pages()).at(-1).screenshot({path:join(evidence,'failure.png'),fullPage:true});}
finally{await browser?.close();await stop();if(provider){provider.closeAllConnections();await new Promise(r=>provider.close(r));}await unlink(file).catch(()=>{});await rmdir(directory);}
