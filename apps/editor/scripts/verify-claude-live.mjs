// Opt-in paid test: two synthetic requests, isolated server/profile, saved key only.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join,resolve} from 'node:path';
import puppeteer from 'puppeteer-core';
import init,{HwpDocument} from '@rhwp/core';
if(!process.argv.includes('--live'))throw new Error('Use --live to authorize two paid synthetic Claude requests.');
const root=fileURLToPath(new URL('../../../',import.meta.url));
const origin='http://127.0.0.1:4205',evidence=join(root,'apps/editor/evidence/claude-live');
const storeArgument=process.argv.indexOf('--store');
const store=storeArgument>=0?resolve(process.argv[storeArgument+1]):undefined;
await mkdir(evidence,{recursive:true});
assert.equal(await fetch(origin+'/api/health').then(()=>true,()=>false),false,'Test port must be free');
const server=spawn(process.execPath,[join(root,'apps/launcher/server.mjs')],{windowsHide:true,env:{...process.env,JUEONY_PORT:'4205',JUEONY_DIST:join(root,'apps/editor/dist'),...(store?{JUEONY_CONNECTION_STORE:store}:{})},stdio:'ignore'});
const report={syntheticOnly:true,separateBrowserProfile:true,calls:0,checks:[],hancomReview:'not tested',startedAt:new Date().toISOString()};
let browser,page;
const pass=name=>{report.checks.push(name);console.log('PASS '+name);};
const snapshot=()=>page.evaluate(()=>document.querySelector('.editor-frame:not([hidden])').contentWindow.jueonyEditor.snapshot());
async function send(text){
 await page.$eval('#request-input',(e,value)=>e.value=value,text);
 const responsePromise=page.waitForResponse(r=>r.url()===origin+'/api/generate',{timeout:110000});
 await page.click('#send-request');const response=await responsePromise;report.calls++;
 const result=await response.json();assert.equal(response.status(),200,result.error);
 await page.waitForFunction(()=>!document.getElementById('send-request').disabled,{timeout:30000});
 assert.equal(await page.$eval('#app-status',e=>e.textContent),'AI 요청이 완료되었습니다.');
 (report.generations??=[]).push(result.result);return result.result;
}
function verifyEdit(s){
 assert.equal(s.nodes[0].text,'Claude 연결 검증 완료');
 assert.equal(s.structure.paragraphs[0].characters.bold,true);assert.equal(s.structure.paragraphs[0].characters.fontSize,1600);
 assert.equal(s.structure.tables.length,1);assert.deepEqual(s.structure.tables[0].cells.map(c=>c.text),['항목','상태','본문','완료']);
 assert.equal(s.structure.sections[0].page.landscape,true);assert.equal(s.structure.sections[0].page.marginLeft,Math.round(20*7200/25.4));
}
try{
 for(let i=0;i<100;i++){if(server.exitCode!==null)throw new Error('Test server failed');if(await fetch(origin+'/api/health').then(r=>r.ok,()=>false))break;await new Promise(r=>setTimeout(r,100));}
 await init({module_or_path:await readFile(join(root,'apps/editor/node_modules/@rhwp/core/rhwp_bg.wasm'))});
 browser=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--no-first-run','--disable-background-networking'],defaultViewport:{width:1600,height:1050}});
 page=await browser.newPage();page.setDefaultTimeout(60000);page.on('dialog',d=>d.accept());const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/?storage=download');await page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('준비 완료'));
 report.model=await page.evaluate(async()=>{
  const token=(await (await fetch('/api/session',{headers:{'X-Jueony-Bootstrap':'1'}})).json()).token;
  const data=await (await fetch('/api/connections',{method:'POST',headers:{'Content-Type':'application/json','X-Jueony-Token':token},body:'{}'})).json();
  const candidates=data.connections.filter(c=>c.hasKey&&c.config.adapterId==='anthropic');if(candidates.length!==1)throw new Error('Exactly one saved Claude connection is required');
  const c=candidates[0].config,provider=document.getElementById('provider-select'),model=document.getElementById('model-select');
  provider.value=c.label+' | '+c.adapterId+' | '+c.endpoint;provider.dispatchEvent(new Event('change'));model.value=c.id;model.dispatchEvent(new Event('change'));return c.modelId;
 });
 const created=await send('검증용 새 문서를 만들어줘. 문단은 정확히 세 개이고 순서대로 "Claude 연결 검증", "기존 본문입니다.", "마지막 문단입니다."로 작성해줘. 다른 내용이나 서식은 추가하지 마.');
 assert.deepEqual(created.operations.map(o=>o.kind),['create_document']);const before=await snapshot();assert.deepEqual(before.nodes.map(n=>n.text),['Claude 연결 검증','기존 본문입니다.','마지막 문단입니다.']);pass('Real Claude creates three paragraphs through the chat and editor');
 await send('현재 첫 문단을 "Claude 연결 검증 완료"로 바꾸고 그 문단만 16pt 굵게로 설정해줘. 마지막 문단 바로 뒤에 정확히 2행 2열 표를 만들고 첫 행은 [항목,상태], 둘째 행은 [본문,완료]로 채워줘. 현재 구역은 A4 가로 방향으로 바꾸고 왼쪽 여백은 20mm로 해줘. 다른 본문과 서식은 유지하고 저장은 하지 마.');
 const after=await snapshot();verifyEdit(after);pass('Real Claude changes body, character format, table and page setup in one request');
 const actions=await page.$$('.message-actions button');await actions.at(-2).click();assert.match(await page.$eval('#structure-diff-text',e=>e.textContent),/2행 × 2열/);await page.screenshot({path:join(evidence,'diff.png'),fullPage:true});await page.keyboard.press('Escape');pass('Structure diff displays the applied table');
 const downloads=join(evidence,'downloads',String(Date.now()));await mkdir(downloads,{recursive:true});
 const session=await browser.target().createCDPSession();await session.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
 await page.click('#save-document');const frame=await (await page.$('.editor-frame:not([hidden])')).contentFrame();
 await frame.waitForFunction(()=>document.querySelector('.modal-overlay input[type=text]')||document.getElementById('jueony-download-confirm'));
 if(await frame.$('.modal-overlay input[type=text]')){await frame.$eval('.modal-overlay input[type=text]',e=>e.value='claude-live-'+Date.now()+'.hwp');await frame.click('.modal-overlay .dialog-btn-primary');}
 await frame.waitForSelector('#jueony-download-confirm');let files=[];
 for(let i=0;i<100;i++){files=(await readdir(downloads)).filter(f=>f.endsWith('.hwp')).sort();if(files.length)break;await new Promise(r=>setTimeout(r,100));}
 assert.ok(files.length,'HWP download completed');const hwp=await readFile(join(downloads,files.at(-1)));await writeFile(join(evidence,'claude-applied.hwp'),hwp);
 const doc=new HwpDocument(hwp);let hwpx;try{hwpx=doc.exportHwpx();await writeFile(join(evidence,'claude-applied.hwpx'),hwpx);}finally{doc.free();}
 await frame.click('#jueony-download-confirm button[value=saved]');await page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('파일에 저장'));await session.detach();pass('User save flow writes HWP; engine exports HWPX');
 const undo=await page.$$('.message-actions button');await undo.at(-1).click();await page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('되돌렸습니다'));
 const reverted=await snapshot();assert.deepEqual(reverted.structure,before.structure);assert.deepEqual(reverted.nodes.map(n=>n.text),before.nodes.map(n=>n.text));pass('One-request undo restores original body, formatting, tables and page setup');
 for(const [name,bytes] of [['hwp',hwp],['hwpx',hwpx]]){
  await frame.evaluate(bytes=>window.jueonyEditor.open(new Uint8Array(bytes),'검증 재열기'),[...bytes]);verifyEdit(await snapshot());pass(name.toUpperCase()+' reopen preserves AI text, format, table and page setup in the editor');
 }
 assert.deepEqual(errors,[]);await page.screenshot({path:join(evidence,'applied.png'),fullPage:true});report.status='PASS';report.pageErrors=errors;
}catch(e){report.status='FAIL';report.error=String(e.message).replace(/sk-[A-Za-z0-9_-]+/g,'[redacted]').slice(0,1500);process.exitCode=1;}
finally{
 await browser?.close();if(server.exitCode===null)server.kill();report.finishedAt=new Date().toISOString();await writeFile(join(evidence,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,calls:report.calls,checks:report.checks,error:report.error}));
}
