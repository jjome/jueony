import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import puppeteer from 'puppeteer-core';
import {serve} from './serve.mjs';

const port=4379,origin=`http://127.0.0.1:${port}`,root=resolve(import.meta.dirname,'../../..');
const samples={
 hwp:resolve(root,'upstream/rhwp-source/samples/chart/가로막대형/묶은가로막대형.hwp'),
 hwpx:resolve(root,'upstream/rhwp-source/samples/chart/가로막대형/묶은가로막대형.hwpx'),
};
const results=[],pageErrors=[],consoleErrors=[],externalRequests=[];
let browser,server;
async function frame(){const handle=await page.$('.editor-frame:not([hidden])');assert.ok(handle,'active editor iframe');const value=await handle.contentFrame();assert.ok(value,'active editor frame');return value;}
async function ready(){await page.waitForSelector('.editor-frame:not([hidden])',{timeout:90000});const value=await frame();await value.waitForFunction(()=>window.jueonyEditor&&!window.jueonyEditor.busy()&&document.getElementById('jueony-chart-data'),{timeout:90000});return value;}
async function open(format,bytes){const value=await ready();await value.evaluate(async({format,bytes})=>{const directory=await navigator.storage.getDirectory(),handle=await directory.getFileHandle(`chart-ui.${format}`,{create:true}),writer=await handle.createWritable();await writer.write(Uint8Array.from(bytes));await writer.close();await window.jueonyEditor.open(Uint8Array.from(bytes),handle.name,handle,false);},{format,bytes:[...bytes]});await value.waitForFunction(()=>!window.jueonyEditor.busy()&&window.jueonyEditor.state().name.startsWith('chart-ui.'));return value;}
async function dialog(frame){await frame.$eval('#jueony-chart-data',element=>element.click());await frame.waitForSelector('#jueony-chart-data-dialog[open]');return frame;}
async function selectValue(frame,value){const selects=await frame.$$('#jueony-chart-data-dialog select');assert.equal(selects.length,4);await selects[2].select('2');await selects[3].select('3');const before=await frame.$eval('#jueony-chart-data-dialog input[readonly]',element=>element.value);assert.equal(before,value);}
async function scenario(format){let value=await open(format,await readFile(samples[format]));await dialog(value);await selectValue(value,'5');await value.$eval('#jueony-chart-data-dialog input:not([readonly])',element=>element.value='8.8');await value.$$eval('#jueony-chart-data-dialog button',buttons=>buttons.find(button=>button.textContent==='적용')?.click());await value.waitForFunction(()=>document.querySelector('#jueony-chart-data-dialog [role=status]')?.textContent?.includes('적용했습니다'));await value.$$eval('#jueony-chart-data-dialog button',buttons=>buttons.find(button=>button.textContent==='닫기')?.click());await value.waitForFunction(()=>!document.getElementById('jueony-chart-data-dialog'));
 const saved=await value.evaluate(()=>[...window.jueonyEditor.recovery().bytes]);
 value=await open(format,Uint8Array.from(saved));await dialog(value);await selectValue(value,'8.8');const status=await value.$eval('#jueony-chart-data-dialog [role=status]',element=>element.textContent);assert.match(status,/bar · category/);await value.$$eval('#jueony-chart-data-dialog button',buttons=>buttons.find(button=>button.textContent==='닫기')?.click());results.push({format,status:'PASS',savedBytes:saved.length});
}
let page;
try{server=await serve(port);browser=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,userDataDir:resolve(root,`build/chart-data-edge-${Date.now()}`),args:['--no-first-run','--disable-background-networking','--disable-sync','--disable-component-update'],defaultViewport:{width:1500,height:1000}});page=await browser.newPage();page.on('pageerror',error=>pageErrors.push(String(error)));page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});await page.setRequestInterception(true);page.on('request',request=>{if(request.url().startsWith(origin)||request.url().startsWith('data:')||request.url().startsWith('blob:'))void request.continue();else{externalRequests.push(request.url());void request.abort();}});await page.goto(origin);await scenario('hwp');await scenario('hwpx');const unrelatedConsoleErrors=consoleErrors.filter(message=>message==='Failed to load resource: the server responded with a status of 404 (Not Found)'||message.includes('새 문서 날짜 초기화: 현재 엔진은 새 문서 작성 시각 초기화를 지원하지 않습니다.'));const chartConsoleErrors=consoleErrors.filter(message=>!unrelatedConsoleErrors.includes(message));assert.deepEqual(pageErrors,[]);assert.deepEqual(chartConsoleErrors,[]);assert.deepEqual(externalRequests,[]);console.log(JSON.stringify({results,pageErrors,chartConsoleErrors,unrelatedConsoleErrors,externalRequests}));}
finally{await browser?.close();await new Promise(resolve=>server?.close(resolve));}
