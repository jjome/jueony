// Isolated Windows persistence/UI test. Fake keys and local provider only.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,mkdir,readFile,writeFile,unlink,rmdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import http from 'node:http';
import puppeteer from 'puppeteer-core';
const directory=await mkdtemp(join(tmpdir(),'jueony-ui-keys-')),file=join(directory,'connections.dpapi');
const origin='http://127.0.0.1:4198',evidence=resolve('evidence/connections');await mkdir(evidence,{recursive:true});
let server,browser,provider;const results=[],calls=[];
const pass=name=>{results.push(name);console.log('PASS '+name);};
const stop=async()=>{if(server&&server.exitCode===null){const closed=once(server,'exit');server.kill();await closed;}};
async function start(){
 server=spawn(process.execPath,['../launcher/server.mjs'],{windowsHide:true,env:{...process.env,JUEONY_PORT:'4198',JUEONY_DIST:resolve('dist'),JUEONY_CONNECTION_STORE:file},stdio:'ignore'});
 for(let i=0;i<100;i++){if(server.exitCode!==null)throw new Error('Server failed');if(await fetch(origin+'/api/health').then(r=>r.ok,()=>false))return;await new Promise(r=>setTimeout(r,100));}throw new Error('Server timed out');
}
try{
 assert.equal(await fetch(origin+'/api/health').then(()=>true,()=>false),false);
 provider=http.createServer(async(req,res)=>{let data='';for await(const part of req)data+=part;calls.push({authorization:req.headers.authorization,url:req.url});res.end(JSON.stringify({status:{code:'20000'},result:{finishReason:'tool_calls',message:{role:'assistant',content:'',toolCalls:[{type:'function',function:{name:'submit_document_edits',arguments:{message:'확인',sourceIds:[],operations:[]}}}]}}}));});await new Promise(r=>provider.listen(4199,'127.0.0.1',r));
 await start();browser=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,defaultViewport:{width:1500,height:1100},args:['--no-first-run','--disable-background-networking']});
 const page=await browser.newPage();page.setDefaultTimeout(30000);
 const ready=()=>page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('준비 완료'));
 const open=async()=>{await page.click('#connection-settings');await page.waitForFunction(()=>document.getElementById('model-dialog').open);};
 const fill=(id,value)=>page.$eval('#'+id,(e,v)=>e.value=v,value);
 const save=async()=>{await page.click('#model-form button[type=submit]');await page.waitForFunction(()=>!document.getElementById('model-dialog').open);};
 await page.goto(origin);await ready();await open();await page.select('#config-adapter','hyperclova');await fill('config-endpoint','http://127.0.0.1:4199/v3/chat-completions');await fill('config-key','fake-ui-key');assert.equal(await page.$eval('#config-remember',e=>e.checked&&!e.disabled),true);await save();
 assert.ok(!(await readFile(file)).includes('fake-ui-key'));pass('UI saves an encrypted key without exposing it');
 await stop();await start();await page.reload();await ready();await open();assert.equal(await page.$eval('#config-model',e=>e.value),'HCX-005');assert.equal(await page.$eval('#config-key',e=>e.value),'');assert.equal(await page.$eval('#config-remember',e=>e.checked),true);pass('restart restores selected connection and leaves key input blank');
 await fill('config-label','수정한 연결');await save();await open();await page.click('#test-connection');await page.waitForFunction(()=>document.getElementById('config-status').textContent.includes('연결 테스트 성공'));assert.equal(calls.at(-1).authorization,'Bearer fake-ui-key');pass('blank key preserves existing credentials when editing the label');
 const before=calls.length;await fill('config-model','HCX-007');await page.click('#test-connection');await page.waitForFunction(()=>document.getElementById('config-status').textContent.includes('새 API 키'));assert.equal(calls.length,before);pass('changing a target requires explicit key entry before sending');
 await fill('config-model','HCX-005');await fill('config-key','fake-ui-rotated');await save();await stop();await start();await page.reload();await ready();await open();await page.click('#test-connection');await page.waitForFunction(()=>document.getElementById('config-status').textContent.includes('연결 테스트 성공'));assert.equal(calls.at(-1).authorization,'Bearer fake-ui-rotated');pass('replacement key survives restart and is used by the provider');
 await page.screenshot({path:join(evidence,'settings.png'),fullPage:true});await page.click('#delete-connection');await page.waitForFunction(()=>document.getElementById('config-status').textContent.includes('선택한 연결'));await page.click('#close-settings');await stop();await start();await page.reload();await ready();assert.equal(await page.$eval('#provider-select',e=>e.selectedOptions[0].textContent),'AI 연결 필요');pass('deleting a selected connection persists across restart');
 await writeFile(join(evidence,'result.json'),JSON.stringify({status:'PASS',results,provider:'local fixture; fake credentials only',runtime:await browser.version()},null,2));
}finally{await browser?.close();await stop();if(provider){provider.closeAllConnections();await new Promise(r=>provider.close(r));}await unlink(file).catch(()=>{});await rmdir(directory);}
