// Opt-in, paid live smoke check. Reads a key without echo; never writes it to disk.
// Run from apps/editor: node scripts/verify-hyperclova-live.mjs
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,join} from 'node:path';
import {spawn} from 'node:child_process';
import puppeteer from 'puppeteer-core';
import init,{HwpDocument} from '@rhwp/core';
import {createHyperCLOVA} from '../../launcher/providers/hyperclova.mjs';
import {connectionTestInput,assertConnectionTest} from '../../launcher/providers/connection-test.mjs';

const root=fileURLToPath(new URL('../../../',import.meta.url));
const app=join(root,'apps/editor');
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const evidence=join(app,'evidence','hyperclova-live',stamp);
const port=Number(process.env.JUEONY_LIVE_TEST_PORT??4197);
assert.ok(Number.isInteger(port)&&port>=1024&&port<=65535,'Valid isolated test port required');
const appUrl=`http://127.0.0.1:${port}`;
const config={id:'hyperclova-live-check',adapterId:'hyperclova',label:'NAVER Cloud 실제 검증',modelId:process.env.JUEONY_LIVE_MODEL??'HCX-005',endpoint:'https://clovastudio.stream.ntruss.com/v3/chat-completions',maxOutputTokens:2048};
const report={startedAt:new Date().toISOString(),provider:'NAVER Cloud live API',model:config.modelId,endpoint:config.endpoint,syntheticDataOnly:true,checks:[],calls:[],limitations:['가상 문서 1건의 smoke 검사이며 품질의 일반적 보장이 아님','HWPX는 UI로 저장한 HWP를 동일 엔진에서 변환','실제 한글 2024 재열기 미검사']};
await mkdir(evidence,{recursive:true});
const pass=name=>{report.checks.push(name);console.log('PASS '+name);};
let key='',browser,server,page;
const safe=value=>String(value).replaceAll(key||'__no_key__','[REDACTED]').replace(/\bnv-[A-Za-z0-9_-]+/g,'[REDACTED]').slice(0,1200);
async function hiddenKey(){
 if(!process.stdin.isTTY||!process.stdin.setRawMode)throw new Error('Run in an interactive terminal; key arguments/files are not accepted.');
 console.log('API key input ready (hidden; memory only). This check makes up to 3 paid API calls.');
 process.stdin.setEncoding('utf8');process.stdin.setRawMode(true);process.stdin.resume();
 return new Promise((accept,reject)=>{
  let value='';
  const finish=(error)=>{process.stdin.off('data',onData);process.stdin.setRawMode(false);process.stdin.pause();error?reject(error):accept(value.trim());};
  const onData=chunk=>{for(const c of chunk){if(c==='\u0003'){finish(new Error('Cancelled'));return;}if(c==='\r'||c==='\n'){finish();return;}if(c==='\u007f'||c==='\b')value=value.slice(0,-1);else if(c>=' ')value+=c;if(value.length>8192){finish(new Error('Key too long'));return;}}};
  process.stdin.on('data',onData);
 });
}
const originalFetch=globalThis.fetch;
const snapshot=()=>page.evaluate(()=>[...document.querySelectorAll('.editor-frame')].find(f=>!f.hidden).contentWindow.jueonyEditor.snapshot());
const body=doc=>Array.from({length:doc.getParagraphCount(0)},(_,p)=>doc.getTextRange(0,p,0,doc.getParagraphLength(0,p)));
async function saveArtifact(stage,expected){
 const directory=join(evidence,'downloads',stage);await mkdir(directory,{recursive:true});
 const session=await browser.target().createCDPSession();await session.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:directory});
 await page.click('#save-document');const frame=await (await page.$('.editor-frame:not([hidden])')).contentFrame();
 await frame.waitForFunction(()=>document.querySelector('.modal-overlay input[type=text]')||document.getElementById('jueony-download-confirm'));
 if(await frame.$('.modal-overlay input[type=text]')){await frame.$eval('.modal-overlay input[type=text]',e=>{e.value='hyperclova-review.hwp';});await frame.click('.modal-overlay .dialog-btn-primary');}
 await frame.waitForSelector('#jueony-download-confirm');
 let files=[];for(let i=0;i<100;i++){files=(await readdir(directory)).filter(f=>f.endsWith('.hwp'));if(files.length)break;await new Promise(r=>setTimeout(r,100));}
 assert.equal(files.length,1,'UI must download one HWP file');
 const bytes=await readFile(join(directory,files[0])),doc=new HwpDocument(bytes);
 try{assert.deepEqual(body(doc),expected);await writeFile(join(evidence,stage+'.hwp'),bytes);const hwpx=doc.exportHwpx();await writeFile(join(evidence,stage+'.hwpx'),hwpx);const reopened=new HwpDocument(hwpx);try{assert.deepEqual(body(reopened),expected);}finally{reopened.free();}}finally{doc.free();}
 await frame.click('#jueony-download-confirm button[value=saved]');
 await page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('파일에 저장'));
 await session.detach();pass(stage+' HWP UI save and HWP/HWPX engine reopen');
}
async function send(request){
 const responses=[];const observe=async response=>{if(response.url()===appUrl+'/api/generate')responses.push(response);};page.on('response',observe);
 try{await page.type('#request-input',request);await page.click('#send-request');await page.waitForFunction(()=>document.getElementById('send-request').disabled);await page.waitForFunction(()=>!document.getElementById('send-request').disabled,{timeout:120000});
 assert.equal(responses.length,1,'One model request without retry');const response=responses[0],payload=await response.json();report.calls.push({stage:'document',httpStatus:response.status(),request,response:payload});
 assert.equal(response.status(),200,'Model request failed: '+safe(payload.error??''));
 assert.equal(await page.$eval('#app-status',e=>e.textContent),'AI 요청이 완료되었습니다.','Agent rejected or failed to apply response');return payload.result;
 }finally{page.off('response',observe);}
}
try{
 key=await hiddenKey();assert.ok(key,'API key is required');
 // Capture protocol metadata only. Never record Authorization or full error bodies.
 globalThis.fetch=async(...args)=>{const started=Date.now();const response=await originalFetch(...args);const wire=await response.clone().json().catch(()=>null);report.calls.push({stage:'connection',httpStatus:response.status,statusCode:wire?.status?.code,statusMessage:wire?.status?.message? safe(wire.status.message):undefined,finishReason:wire?.result?.finishReason,syntheticProbeOutput:wire?.result?.message?.content? safe(wire.result.message.content):undefined,usage:wire?.result?.usage,durationMs:Date.now()-started});return response;};
 assertConnectionTest(await createHyperCLOVA(config,key).generate(connectionTestInput(),new AbortController().signal));pass('live authentication and validated connection JSON');globalThis.fetch=originalFetch;
 await init({module_or_path:await readFile(join(app,'node_modules/@rhwp/core/rhwp_bg.wasm'))});
 const occupied=await originalFetch(appUrl+'/api/health',{signal:AbortSignal.timeout(1000)}).then(()=>true,()=>false);assert.equal(occupied,false,'Isolated port is already in use');
 // Test-only IPC records successful synthetic outputs, never headers/keys.
 const launch=`const original=globalThis.fetch;globalThis.fetch=async(...args)=>{const r=await original(...args);if(r.ok){const wire=await r.clone().json().catch(()=>null);process.send({syntheticOutput:wire?.result?.message,finishReason:wire?.result?.finishReason});}return r;};await import('./apps/launcher/server.mjs');`;
 server=spawn(process.execPath,['--input-type=module','-e',launch],{cwd:root,windowsHide:true,env:{...process.env,JUEONY_DIST:join(app,'dist'),JUEONY_PORT:String(port),JUEONY_CONNECTION_STORE:'memory'},stdio:['ignore','ignore','ignore','ipc']});
 server.on('message',value=>{(report.syntheticProviderOutputs??=[]).push(value);});
 let ready=false;for(let i=0;i<50;i++){if(server.exitCode!==null)throw new Error('Test server exited');ready=await originalFetch(appUrl+'/api/health').then(r=>r.ok,()=>false);if(ready)break;await new Promise(r=>setTimeout(r,100));}assert.ok(ready,'Server ready');
 browser=await puppeteer.launch({executablePath:process.env.JUEONY_BROWSER_PATH??'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--no-first-run','--disable-background-networking'],defaultViewport:{width:1600,height:1050}});
 page=await browser.newPage();page.setDefaultTimeout(60000);const pageErrors=[];page.on('pageerror',e=>pageErrors.push(safe(e.message)));page.on('dialog',d=>d.accept());
 await page.goto(appUrl+'/?storage=download');await page.waitForFunction(()=>[...document.querySelectorAll('.editor-frame')].some(f=>f.contentWindow?.jueonyEditor?.snapshot)&&document.getElementById('app-status').textContent.includes('준비 완료'));
 await page.click('#connection-settings');await page.waitForFunction(()=>document.getElementById('model-dialog').open);await page.select('#config-adapter','hyperclova');await page.$eval('#config-label',(e,v)=>e.value=v,config.label);await page.$eval('#config-model',(e,v)=>e.value=v,config.modelId);await page.$eval('#config-tokens',(e,v)=>e.value=String(v),config.maxOutputTokens);await page.$eval('#config-key',(e,v)=>e.value=v,key);await page.click('#model-form button[type=submit]');await page.waitForFunction(()=>!document.getElementById('model-dialog').open);assert.equal(await page.$eval('#config-key',e=>e.value),'');pass('live provider registered through settings');
 const create=await send('기능 검증용 가상 문서를 새로 작성해줘. 제목은 주민 교육 계획, 나머지 세 문단은 목적, 일정, 기대 효과로 구성해줘. 총 네 문단으로 작성하고 각 문단은 한 문장으로 짧게 써줘. 실제 기관이나 개인정보는 넣지 마.');
 assert.deepEqual(create.operations.map(o=>o.kind),['create_document']);const created=(await snapshot()).nodes.map(n=>n.text);assert.equal(created.length,4);assert.deepEqual(created,create.operations[0].paragraphs);report.created=created;pass('real model new-document command applied to live editor');await saveArtifact('01-created',created);
 // Change the open engine without saving, then ask the LLM to operate on this latest text.
 await page.evaluate(async()=>{const api=[...document.querySelectorAll('.editor-frame')].find(f=>!f.hidden).contentWindow.jueonyEditor,s=api.snapshot();await api.apply('synthetic-manual-change',s,{message:'미저장 문맥 검증',sourceIds:[],operations:[{kind:'replace_body_text',target:s.nodes[0].id,start:0,count:Array.from(s.nodes[0].text).length,text:'미저장 주민 교육 계획'}]});});
 const before=(await snapshot()).nodes.map(n=>n.text);
 const edit=await send('현재 첫 문단의 맨 앞 "미저장 " 부분만 삭제하고, 마지막 문단 뒤에 "문의 안내: 담당 부서에 문의 바랍니다."라는 문단 하나를 추가해줘. 다른 내용은 유지해줘.');
 assert.equal(edit.operations.length,2);const changed=(await snapshot()).nodes.map(n=>n.text);assert.deepEqual(changed,['주민 교육 계획',...before.slice(1),'문의 안내: 담당 부서에 문의 바랍니다.']);report.beforeEdit=before;report.afterEdit=changed;pass('real model uses unsaved state and edits multiple locations');await saveArtifact('02-applied',changed);
 const compare=await page.$$('.message-actions button');await compare.at(-2).click();assert.equal(await page.$eval('#diff-before',e=>e.textContent),before.join('\n'));assert.equal(await page.$eval('#diff-after',e=>e.textContent),changed.join('\n'));await page.screenshot({path:join(evidence,'live-diff.png'),fullPage:true});await page.keyboard.press('Escape');pass('request diff matches actual document');
 const undo=await page.$$('.message-actions button');await undo.at(-1).click();await page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('되돌렸습니다'));assert.deepEqual((await snapshot()).nodes.map(n=>n.text),before);pass('request undo restores unsaved user content');await saveArtifact('03-reverted',before);
 const persisted=await page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('jueony-workspaces');r.onsuccess=()=>{const db=r.result;const q=db.transaction('state').objectStore('state').get('current');q.onsuccess=()=>{resolve(JSON.stringify(q.result));db.close();};q.onerror=()=>reject(new Error('State read failed'));};r.onerror=()=>reject(new Error('Database open failed'));}));assert.ok(!persisted.includes(key));pass('API key absent from persisted workspace state');
 report.pageErrors=pageErrors;assert.deepEqual(pageErrors,[]);report.runtime=await browser.version();report.build=await page.evaluate(()=>fetch('/build-evidence.json').then(r=>r.json()));await page.screenshot({path:join(evidence,'live-workspace.png'),fullPage:true});report.status='PASS';
}catch(error){report.status='FAIL';report.error=safe(error?.safeMessage??error?.message??'Unknown error');console.error('FAIL '+report.error);if(report.calls.length)console.error(JSON.stringify(report.calls.filter(c=>c.stage==='connection')));process.exitCode=1;
}finally{
 globalThis.fetch=originalFetch;
 await browser?.close().catch(()=>{});if(server&&server.exitCode===null){server.kill();await Promise.race([new Promise(r=>server.once('exit',r)),new Promise(r=>setTimeout(r,5000))]);}
 report.finishedAt=new Date().toISOString();const json=JSON.stringify(report,null,2);if(key&&json.includes(key))throw new Error('Secret detected; evidence write refused');await writeFile(join(evidence,'result.json'),json);key='';console.log('Evidence: '+evidence);
}
