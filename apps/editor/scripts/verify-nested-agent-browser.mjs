import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir} from 'node:fs/promises';
import http from 'node:http';
import {resolve} from 'node:path';
import puppeteer from 'puppeteer-core';
import {loadReviewEngine} from './lib/hancom-review.mjs';
import {readStructure} from '../src/adapters/rhwp/structure.ts';

const repo=resolve(import.meta.dirname,'../../..'),dist=resolve(process.env.JUEONY_TEST_DIST);
const {HwpDocument}=await loadReviewEngine(resolve(process.env.JUEONY_ENGINE_PACKAGE));
const port=Number(process.env.JUEONY_TEST_PORT??4573),origin='http://127.0.0.1:'+port;
const calls=[];
const axisOnly=process.env.JUEONY_NESTED_AXIS_ONLY==='1';
const provider=http.createServer(async(req,res)=>{
  try {
    let raw=''; for await(const part of req) raw+=part;
    const wire=JSON.parse(raw),input=JSON.parse(wire.messages[1].content);
    const tables=input.document.structure.nestedTables;
    assert.equal(tables.length,2);
    const table=tables[1],cell=table.cells[1],mixed=input.instruction.includes('둘째 문단');
    const target=mixed?cell.paragraphs.find(p=>p.index===1):cell;
    assert.equal(target.text,'동일😀');
    if(mixed)assert.deepEqual(target.formatSpans,[{start:0,end:1},{start:1,end:3}]);
    else assert.ok(cell.editable);
    calls.push(table.id);
    const generation={message:'오른쪽 안쪽 표의 두 번째 셀을 바꿨습니다.',sourceIds:[],operations:[{kind:'set_table_cell',target:table.id,row:cell.row,column:cell.column,originalText:target.text,text:'변경😀',...(mixed?{paragraph:1,spanTexts:['변','경😀']}:{})}]};
    if(axisOnly){
      assert.equal(table.axisEditable,true);
      generation.operations=[input.instruction.includes('행 추가')?{kind:'insert_table_row',target:table.id,index:1,values:['새 행😀','']}:
        {kind:'delete_table_column',target:table.id,index:1}];
    }
    res.setHeader('Content-Type','application/json'); res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(generation)}}]}));
  } catch (e) {res.writeHead(500);res.end(String(e));}
});
if (await fetch(origin+'/api/health').then(()=>true,()=>false)) throw Error('Review port occupied');
await new Promise(r=>provider.listen(0,'127.0.0.1',r));
const launcher=spawn(process.execPath,['apps/launcher/server.mjs'],{cwd:repo,windowsHide:true,stdio:'ignore',env:{...process.env,JUEONY_PORT:String(port),JUEONY_DIST:dist,JUEONY_CONNECTION_STORE:'memory'}});
let browser;
try {
  for (let i=0;i<100;i++) {
    if(await fetch(origin+'/api/health').then(r=>r.ok,()=>false)) break;
    await new Promise(r=>setTimeout(r,100));
  }
  await mkdir(resolve(repo,'build'),{recursive:true});
  browser=await puppeteer.launch({executablePath:process.env.JUEONY_TEST_BROWSER??'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless:true,userDataDir:await mkdtemp(resolve(repo,'build/nested-agent-browser-')),args:['--no-first-run','--disable-background-networking']});
  const page=await browser.newPage(),errors=[]; page.on('pageerror',e=>errors.push(String(e)));
  page.on('dialog',d=>d.dismiss());
  await page.goto(origin);await page.waitForFunction(()=>document.getElementById('app-status')?.textContent.includes('준비 완료'));
  const fill=(id,value)=>page.$eval('#'+id,(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);
  await page.click('#connection-settings');await page.click('#new-connection');await page.select('#config-adapter','openai-compatible');
  await fill('config-label','중첩 셀 검수');await fill('config-endpoint','http://127.0.0.1:'+provider.address().port+'/v1');
  await fill('config-model','nested-fixture');await fill('config-key','synthetic-local-fixture');
  await page.$eval('#config-remember',e=>e.checked=false);await page.click('#model-form button[type=submit]');
  await page.waitForFunction(()=>!document.getElementById('model-dialog').open);
  for (const format of ['hwp','hwpx']) for(const mode of (axisOnly?['insert-row','delete-column']:['plain','mixed'])){
    const mixed=mode==='mixed';
    const frame=await (await page.$('.editor-frame:not([hidden])')).contentFrame();
    const doc=HwpDocument.createEmpty();doc.createBlankDocument();
    const inner='<table><tr><td>동일😀</td><td>동일😀</td></tr></table>';
    doc.pasteHtml(0,0,0,`<table><tr><td>왼쪽${inner}</td><td>오른쪽${inner}</td></tr></table>`);
    if(mixed){
      const table=readStructure(doc).nestedTables[1],step={controlIndex:table.control,cellIndex:1,cellParaIndex:0};
      const path=p=>JSON.stringify([...table.ancestors,{...step,cellParaIndex:p}]);
      const args=[table.section,table.paragraph];
      doc.splitParagraphInCellByPath(...args,path(0),0);
      doc.insertTextInCellByPath(...args,path(0),0,'첫 문단');
      doc.applyCharFormatInCellByPath(...args,path(1),1,3,'{"bold":true}');
    }
    const bytes=Array.from(format==='hwpx'?doc.exportHwpx():doc.exportHwp());doc.free();
    await frame.evaluate(async(bytes,name)=>{
      const root=await navigator.storage.getDirectory(),h=await root.getFileHandle(name,{create:true}),writer=await h.createWritable();
      await writer.write(new Uint8Array(bytes));await writer.close();await window.jueonyEditor.open(new Uint8Array(bytes),name,h,false);
    },bytes,'nested-review.'+format);
    const request=axisOnly?(mode==='insert-row'?'오른쪽 안쪽 표 마지막에 행 추가':'오른쪽 안쪽 표의 둘째 열 삭제'):
      mixed?'오른쪽 안쪽 표의 두 번째 셀 둘째 문단을 변경해줘':'오른쪽 안쪽 표의 두 번째 셀을 변경해줘';
    await fill('request-input',request);
    const sent=page.waitForResponse(r=>r.url()===origin+'/api/generate');
    await page.click('#send-request');await sent;
    await page.waitForFunction(()=>!document.getElementById('send-request').disabled);
    assert.equal(await page.$eval('#request-error',e=>e.hidden?'':e.textContent),'');
    const texts=()=>frame.evaluate(()=>window.jueonyEditor.snapshot().structure.nestedTables.map(t=>t.cells.map(c=>c.text)));
    const original=[['동일😀','동일😀'],['동일😀','동일😀']],edited=[['동일😀','동일😀'],['동일😀','변경😀']];
    if(mixed){original[1][1]='첫 문단\n동일😀';edited[1][1]='첫 문단\n변경😀';}
    if(axisOnly)edited[1]=mode==='insert-row'?[...original[1],'새 행😀','']:[original[1][0]];
    assert.deepEqual(await texts(),edited);
    const undo=(await page.$$('.message-actions button')).reverse();
    for (const b of undo) if (await b.evaluate(e=>e.textContent==='요청 되돌리기')) {await b.click();break;}
    await page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('되돌렸습니다'));
    assert.deepEqual(await texts(),original);
    assert.equal((await frame.evaluate(()=>window.jueonyEditor.executeCommand('edit:redo'))).ok,true);
    assert.deepEqual(await texts(),edited);
    const saved=await frame.evaluate(async()=>{
      const api=window.jueonyEditor,status=await api.save(),file=await api.fileHandle().getFile();
      return {status,bytes:Array.from(new Uint8Array(await file.arrayBuffer())),dirty:api.state().dirty};
    });
    assert.equal(saved.status,'saved');assert.equal(saved.dirty,false);
    const reopened=new HwpDocument(new Uint8Array(saved.bytes));
    try {
      assert.deepEqual(readStructure(reopened).nestedTables.map(t=>t.cells.map(c=>c.text)),edited);
      const hits=JSON.parse(reopened.searchAllText('변경😀',true,true));
      if(!axisOnly){assert.equal(hits.length,1);assert.deepEqual(hits[0].cellPath.map(p=>p.cellIndex),[1,1]);}
      if(mixed){
        assert.equal(hits[0].cellPath.at(-1).cellParaIndex,1);
        const table=readStructure(reopened).nestedTables[1],args=[table.section,table.paragraph,JSON.stringify(hits[0].cellPath)];
        assert.equal(JSON.parse(reopened.getCellCharPropertiesAtByPath(...args,0)).bold,false);
        assert.equal(JSON.parse(reopened.getCellCharPropertiesAtByPath(...args,1)).bold,true);
      }
    } finally {reopened.free();}
    console.log('PASS',format,mode,'UI chat → loopback provider → Agent application → undo/redo → bound file save and native reopen');
  }
  assert.equal(calls.length,4);assert.deepEqual(errors,[]);
} finally {await browser?.close();launcher.kill();await new Promise(r=>provider.close(r));}
