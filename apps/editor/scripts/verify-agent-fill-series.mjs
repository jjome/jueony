import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import http from 'node:http';
import {mkdtemp,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import puppeteer from 'puppeteer-core';
import {loadReviewEngine} from './lib/hancom-review.mjs';

const repo=resolve(import.meta.dirname,'../../..'),dist=resolve(process.env.JUEONY_TEST_DIST);
const {HwpDocument}=await loadReviewEngine(resolve(process.env.JUEONY_ENGINE_PACKAGE));
const port=Number(process.env.JUEONY_TEST_PORT??4576),origin='http://127.0.0.1:'+port;
const formula=['2','4','6','8','=A1+$A$1','첫 대상','둘째','셋째'];
const scenarios=[
  {request:'월말 날짜를 오른쪽으로 채워줘',mode:'months',row:0,original:['2024-01-31','2024-02-29','기존','원문'],expected:['2024-01-31','2024-02-29','2024-03-31','2024-04-30']},
  {request:'수식을 오른쪽으로 복사해줘',mode:'formula',row:1,original:formula,expected:[...formula.slice(0,5),'=B1+$A$1','=C1+$A$1','=D1+$A$1']},
  {request:'오른쪽 세 셀에 계산한 값을 써줘',mode:'calculated-value',row:1,original:formula,expected:[...formula.slice(0,5),'6','8','10']}
];
const calls=[];
const provider=http.createServer(async(req,res)=>{
  try {
    let raw='';for await(const chunk of req)raw+=chunk;
    const input=JSON.parse(JSON.parse(raw).messages[1].content),test=scenarios.find(c=>c.request===input.instruction);
    const table=input.document.structure.tables[0];
    assert.deepEqual(table.cells.map(c=>c.text),test.original);calls.push(test.mode);
    const op={kind:'fill_table_series',target:table.id,startRow:test.row,startColumn:0,endRow:test.row,endColumn:3,mode:test.mode};
    const result={message:'지정한 구간을 채웠습니다.',sourceIds:[],operations:[op]};
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(result)}}]}));
  } catch(e) {res.writeHead(500);res.end(String(e));}
});
if(await fetch(origin+'/api/health').then(()=>true,()=>false))throw Error('Review port occupied');
await new Promise(r=>provider.listen(0,'127.0.0.1',r));
const server=spawn(process.execPath,['apps/launcher/server.mjs'],{cwd:repo,windowsHide:true,stdio:'ignore',
  env:{...process.env,JUEONY_PORT:String(port),JUEONY_DIST:dist,JUEONY_CONNECTION_STORE:'memory'}});
let browser;
try {
  for(let i=0;i<100;i++){if(await fetch(origin+'/api/health').then(r=>r.ok,()=>false))break;await new Promise(r=>setTimeout(r,100));}
  await mkdir(resolve(repo,'build'),{recursive:true});
  browser=await puppeteer.launch({executablePath:process.env.JUEONY_TEST_BROWSER??'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    userDataDir:await mkdtemp(resolve(repo,'build/agent-series-browser-')),headless:true,args:['--no-first-run','--disable-background-networking']});
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('dialog',d=>d.dismiss());
  await page.goto(origin);await page.waitForFunction(()=>document.getElementById('app-status')?.textContent.includes('준비 완료'));
  const fill=(id,value)=>page.$eval('#'+id,(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);
  await page.click('#connection-settings');await page.click('#new-connection');await page.select('#config-adapter','openai-compatible');
  await fill('config-label','자동 채우기 검수');await fill('config-endpoint','http://127.0.0.1:'+provider.address().port+'/v1');
  await fill('config-model','series-fixture');await fill('config-key','synthetic-local-fixture');await page.$eval('#config-remember',e=>e.checked=false);
  await page.click('#model-form button[type=submit]');await page.waitForFunction(()=>!document.getElementById('model-dialog').open);
  for(const format of ['hwp','hwpx']) for(const test of scenarios) {
    const frame=await(await page.$('.editor-frame:not([hidden])')).contentFrame();
    const doc=HwpDocument.createEmpty();doc.createBlankDocument();
    const table=JSON.parse(doc.createTable(0,0,0,test.row+1,4)),styled=test.row*4+2;
    for(const [i,text] of test.original.entries()) doc.insertTextInCell(0,table.paraIdx,table.controlIdx,i,0,0,text);
    doc.applyCharFormatInCell(0,table.paraIdx,table.controlIdx,styled,0,0,Array.from(test.original[styled]).length,'{"bold":true}');
    const bytes=Array.from(format==='hwp'?doc.exportHwp():doc.exportHwpx());doc.free();
    await frame.evaluate(async(bytes,name)=>{
      const root=await navigator.storage.getDirectory(),handle=await root.getFileHandle(name,{create:true}),writer=await handle.createWritable();
      await writer.write(new Uint8Array(bytes));await writer.close();await window.jueonyEditor.open(new Uint8Array(bytes),name,handle,false);
    },bytes,test.mode+'.'+format);
    await fill('request-input',test.request);const sent=page.waitForResponse(r=>r.url()===origin+'/api/generate');await page.click('#send-request');await sent;
    await page.waitForFunction(()=>!document.getElementById('send-request').disabled);
    assert.equal(await page.$eval('#request-error',e=>e.hidden?'':e.textContent),'',format+'/'+test.mode);
    const current=()=>frame.evaluate(()=>window.jueonyEditor.snapshot().structure.tables[0].cells.map(c=>c.text));
    assert.deepEqual(await current(),test.expected);
    const buttons=(await page.$$('.message-actions button')).reverse();
    for(const b of buttons) if(await b.evaluate(e=>e.textContent==='요청 되돌리기')){await b.click();break;}
    await page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('되돌렸습니다'));assert.deepEqual(await current(),test.original);
    assert.equal((await frame.evaluate(()=>window.jueonyEditor.executeCommand('edit:redo'))).ok,true);assert.deepEqual(await current(),test.expected);
    const file=await frame.evaluate(async()=>{
      const api=window.jueonyEditor,status=await api.save(),t=api.snapshot().structure.tables[0],f=await api.fileHandle().getFile();
      return {status,dirty:api.state().dirty,coords:[t.section,t.paragraph,t.control],bytes:Array.from(new Uint8Array(await f.arrayBuffer()))};
    });
    assert.equal(file.status,'saved');assert.equal(file.dirty,false);
    const reopened=new HwpDocument(new Uint8Array(file.bytes));
    try {
      assert.deepEqual(test.expected.map((_,i)=>reopened.getTextInCell(...file.coords,i,0,0,reopened.getCellParagraphLength(...file.coords,i,0))),test.expected);
      assert.equal(JSON.parse(reopened.getCellCharPropertiesAt(...file.coords,styled,0,0)).bold,true);
    } finally {reopened.free();}
    console.log('PASS',format,test.mode,'chat, real edit, undo/redo, saved bytes, Native reopen and formatting');
  }
  assert.deepEqual(calls,[...scenarios,...scenarios].map(c=>c.mode));assert.deepEqual(errors,[]);
} finally {await browser?.close();server.kill();await new Promise(r=>provider.close(r));}
