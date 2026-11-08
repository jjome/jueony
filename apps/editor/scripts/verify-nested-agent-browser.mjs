import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir} from 'node:fs/promises';
import http from 'node:http';
import {resolve} from 'node:path';
import puppeteer from 'puppeteer-core';
import {loadReviewEngine} from './lib/hancom-review.mjs';
import {nestedCaptionFixture} from './lib/nested-caption-fixture.mjs';
import {nestedNamedCellFixture} from './lib/nested-named-cell-fixture.mjs';
import {nestedClickHereFixture,rightSiblingLayout} from './lib/nested-click-here-fixture.mjs';
import {readStructure} from '../src/adapters/rhwp/structure.ts';

const repo=resolve(import.meta.dirname,'../../..'),dist=resolve(process.env.JUEONY_TEST_DIST);
const {HwpDocument}=await loadReviewEngine(resolve(process.env.JUEONY_ENGINE_PACKAGE));
const port=Number(process.env.JUEONY_TEST_PORT??4573),origin='http://127.0.0.1:'+port;
const calls=[];
const bodyMarkers=process.env.JUEONY_NESTED_AXIS_ONLY==='body-markers';
const mergedAxis=process.env.JUEONY_NESTED_AXIS_ONLY==='merged';
const namedAxis=process.env.JUEONY_NESTED_AXIS_ONLY==='named';
const leftDelete=process.env.JUEONY_NESTED_AXIS_ONLY==='left-delete';
const storedAxis=leftDelete||process.env.JUEONY_NESTED_AXIS_ONLY==='click-here';
const fieldAxis=namedAxis||storedAxis;
const captionFlow=process.env.JUEONY_NESTED_AXIS_ONLY==='caption-flow';
const captionAxis=captionFlow||process.env.JUEONY_NESTED_AXIS_ONLY==='caption';
const axisOnly=captionAxis||bodyMarkers||mergedAxis||fieldAxis||process.env.JUEONY_NESTED_AXIS_ONLY==='1';
async function captionScreen(frame){
  const result=await frame.evaluate(()=>{
    const automation=window.rhwpStudio.automation;let services;
    automation.registerCommand({id:'ext:nested-caption-review',label:'캡션 검수',canExecute:()=>true,execute:s=>services=s});
    automation.execute('ext:nested-caption-review');automation.unregisterCommand('ext:nested-caption-review');
    const doc=services.wasm.borrowDocumentHandle();
    const [,sibling,owner]=JSON.parse(doc.getPageControlLayout(0)).controls;
    // Growing a centered child table moves its top edge. Keep the caption's
    // offset from its owner and the untouched sibling's absolute placement.
    const runs=JSON.parse(doc.getPageTextLayout(0)).runs.filter(r=>r.cellIdx===65534).map(r=>({
      ...r,x:r.x-owner.x,y:r.y-owner.y
    }));
    return {canvas:doc.canvasMetricsActive(),runs,sibling};
  });
  assert.equal(result.canvas,true);
  return result;
}
function sameCaptionScreen(actual,expected){
  assert.equal(actual.canvas,expected.canvas);assert.deepEqual(actual.sibling,expected.sibling);
  assert.equal(actual.runs.length,expected.runs.length);
  for(const [i,{x,y,...run}] of actual.runs.entries()){
    const {x:beforeX,y:beforeY,...original}=expected.runs[i];
    // Native page layout coordinates are published to 0.1px. Subtraction
    // combines two rounded coordinates, matching the adapter's 0.21 bound.
    assert.ok(Math.abs(x-beforeX)<=.21&&Math.abs(y-beforeY)<=.21);
    assert.deepEqual(run,original);
  }
}
const provider=http.createServer(async(req,res)=>{
  try {
    let raw=''; for await(const part of req) raw+=part;
    const wire=JSON.parse(raw),input=JSON.parse(wire.messages[1].content);
    const tables=input.document.structure.nestedTables;
    assert.equal(tables.length,2);
    const table=tables[leftDelete?0:1],cell=table.cells[1],mixed=input.instruction.includes('둘째 문단');
    const target=mixed?cell.paragraphs.find(p=>p.index===1):cell;
    assert.equal(target.text,captionAxis?'나':leftDelete?'A좌😀lpha':storedAxis?'B우😀eta\n둘째😀':namedAxis?'Beta\n둘째😀':'동일😀');
    if(mixed)assert.deepEqual(target.formatSpans,[{start:0,end:1},{start:1,end:3}]);
    else if(namedAxis){assert.equal(cell.fieldName,'공통 이름');assert.equal(cell.editable,false);}
    else if(storedAxis){assert.equal(cell.clickHereFieldIds.length,2);assert.equal(cell.editable,false);}
    else assert.ok(cell.editable);
    calls.push(table.id);
    const generation={message:leftDelete?'왼쪽 안쪽 표의 첫 행을 삭제했습니다.':'오른쪽 안쪽 표의 두 번째 셀을 바꿨습니다.',sourceIds:[],operations:[{kind:'set_table_cell',target:table.id,row:cell.row,column:cell.column,originalText:target.text,text:'변경😀',...(mixed?{paragraph:1,spanTexts:['변','경😀']}:{})}]};
    if(axisOnly){
      assert.equal(table.axisEditable,true);
      if(mergedAxis)assert.equal(table.cells[0].rowSpan,2);
      generation.operations=[leftDelete?{kind:'delete_table_row',target:table.id,index:0}:input.instruction.includes('행 추가')?{kind:'insert_table_row',target:table.id,index:fieldAxis?0:1,values:mergedAxis?['','새 행😀']:['새 행😀','']}:
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
  for (const format of ['hwp','hwpx']) for(const mode of (leftDelete?['delete-left-row']:bodyMarkers||mergedAxis||fieldAxis||captionAxis?['insert-row']:axisOnly?['insert-row','delete-column']:['plain','mixed'])){
    const mixed=mode==='mixed';
    const frame=await (await page.$('.editor-frame:not([hidden])')).contentFrame();
    const captionOptions=captionFlow?{direction:format==='hwp'?'TOP':'RIGHT',compact:true,multiline:true,extraParagraph:true}:{};
    const doc=captionAxis?nestedCaptionFixture(HwpDocument,captionOptions):storedAxis?nestedClickHereFixture(HwpDocument):namedAxis?nestedNamedCellFixture(HwpDocument):HwpDocument.createEmpty();
    if(!fieldAxis&&!captionAxis)doc.createBlankDocument();
    const inner='<table><tr><td>동일😀</td><td>동일😀</td></tr></table>';
    if(bodyMarkers){
      doc.insertText(0,0,0,'작성자: 이름 / 업무');
      doc.splitParagraph(0,0,doc.getParagraphLength(0,0));
    }
    const right=mergedAxis?'<table><tr><td rowspan="2">동일😀</td><td>동일😀</td></tr><tr><td>끝</td></tr></table>':inner;
    if(!fieldAxis&&!captionAxis)doc.pasteHtml(0,bodyMarkers?1:0,0,`<table><tr><td>왼쪽${inner}</td><td>오른쪽${right}</td></tr></table>`);
    if(bodyMarkers){
      doc.insertClickHereField(0,0,5,'이름','담당 부서','작성자',true);
      doc.addBookmark(0,0,9,'업무 위치');
    }
    if(mixed){
      const table=readStructure(doc).nestedTables[1],step={controlIndex:table.control,cellIndex:1,cellParaIndex:0};
      const path=p=>JSON.stringify([...table.ancestors,{...step,cellParaIndex:p}]);
      const args=[table.section,table.paragraph];
      doc.splitParagraphInCellByPath(...args,path(0),0);
      doc.insertTextInCellByPath(...args,path(0),0,'첫 문단');
      doc.applyCharFormatInCellByPath(...args,path(1),1,3,'{"bold":true}');
    }
    const sourceTexts=fieldAxis||captionAxis?readStructure(doc).nestedTables.map(t=>t.cells.map(c=>c.text)):undefined;
    const originalFields=storedAxis?JSON.parse(doc.getFieldList()):undefined;
    const bytes=Array.from(format==='hwpx'?doc.exportHwpx():doc.exportHwp());doc.free();
    const records=d=>[JSON.parse(d.getFieldList()),JSON.parse(d.getBookmarks())];
    let originalMarkers,originalRightLayout,originalCaption,originalSibling;
    if(bodyMarkers||leftDelete||captionAxis){
      const source=new HwpDocument(new Uint8Array(bytes));
      try{if(bodyMarkers)originalMarkers=records(source);if(leftDelete)originalRightLayout=rightSiblingLayout(source);
       if(captionAxis){const t=readStructure(source).nestedTables[1],p=JSON.stringify([...t.ancestors,{controlIndex:t.control,cellIndex:0,cellParaIndex:0}]);
        originalCaption=JSON.parse(source.getTableAxisCaptionEvidenceByPath(t.section,t.paragraph,p));
        if(captionFlow)assert.deepEqual(originalCaption.paragraphs.map(p=>[p.text,p.lines.map(l=>l.text_start)]),[['캡션 제목😀뒤',[0,7]],['둘째 설명',[0]]]);
        originalSibling=JSON.parse(source.getPageControlLayout(0)).controls[1];}}finally{source.free();}
    }
    await frame.evaluate(async(bytes,name)=>{
      const root=await navigator.storage.getDirectory(),h=await root.getFileHandle(name,{create:true}),writer=await h.createWritable();
      await writer.write(new Uint8Array(bytes));await writer.close();await window.jueonyEditor.open(new Uint8Array(bytes),name,h,false);
    },bytes,'nested-review.'+format);
    const sourceScreen=captionFlow?await captionScreen(frame):undefined;
    const request=captionFlow?'여러 줄 캡션의 두 문단을 유지하고 오른쪽 안쪽 표의 두 행 사이에 행 추가':captionAxis?'아래 캡션을 유지하고 오른쪽 안쪽 표의 두 행 사이에 행 추가':leftDelete?'왼쪽 안쪽 표의 첫 행 삭제':fieldAxis?'오른쪽 안쪽 표의 필드 셀 위에 행 추가':mergedAxis?'오른쪽 안쪽 표의 세로 병합 사이에 행 추가':axisOnly?(mode==='insert-row'?'오른쪽 안쪽 표 마지막에 행 추가':'오른쪽 안쪽 표의 둘째 열 삭제'):
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
    if(mergedAxis){original[1].push('끝');edited[1]=['동일😀','동일😀','새 행😀','끝'];}
    if(captionAxis){
      [original[0],original[1]]=sourceTexts;edited[0]=original[0];edited[1]=[...original[1].slice(0,2),'새 행😀','',...original[1].slice(2)];
    }
    if(fieldAxis){
      [original[0],original[1]]=sourceTexts;
      if(leftDelete){edited[0]=[original[0][2],original[0][1],...original[0].slice(3)];edited[1]=original[1];}
      else{edited[0]=original[0];edited[1]=['새 행😀','',...original[1]];}
    }
    assert.deepEqual(await texts(),edited);
    if(captionFlow)sameCaptionScreen(await captionScreen(frame),sourceScreen);
    const undo=(await page.$$('.message-actions button')).reverse();
    for (const b of undo) if (await b.evaluate(e=>e.textContent==='요청 되돌리기')) {await b.click();break;}
    await page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('되돌렸습니다'));
    assert.deepEqual(await texts(),original);
    if(captionFlow)sameCaptionScreen(await captionScreen(frame),sourceScreen);
    assert.equal((await frame.evaluate(()=>window.jueonyEditor.executeCommand('edit:redo'))).ok,true);
    assert.deepEqual(await texts(),edited);
    if(captionFlow)sameCaptionScreen(await captionScreen(frame),sourceScreen);
    const saved=await frame.evaluate(async()=>{
      const api=window.jueonyEditor,status=await api.save(),file=await api.fileHandle().getFile();
      return {status,bytes:Array.from(new Uint8Array(await file.arrayBuffer())),dirty:api.state().dirty};
    });
    assert.equal(saved.status,'saved');assert.equal(saved.dirty,false);
    const reopened=new HwpDocument(new Uint8Array(saved.bytes));
    try {
      const tables=readStructure(reopened).nestedTables;
      assert.deepEqual(tables.map(t=>t.cells.map(c=>c.text)),edited);
      if(captionAxis){
        const t=tables[1],p=JSON.stringify([...t.ancestors,{controlIndex:t.control,cellIndex:0,cellParaIndex:0}]);
        assert.deepEqual(JSON.parse(reopened.getTableAxisCaptionEvidenceByPath(t.section,t.paragraph,p)),originalCaption);
        assert.deepEqual(JSON.parse(reopened.getPageControlLayout(0)).controls[1],originalSibling);
        const runs=JSON.parse(reopened.getPageTextLayout(0)).runs.filter(r=>r.cellIdx===65534);
        if(captionFlow)assert.deepEqual(runs.map(r=>[r.text,r.bold,r.cellParaIdx,r.charStart]),[
          ['캡션 ',false,0,0],['제목😀',true,0,3],['뒤',true,0,6],['둘째 ',false,1,0],['설명',true,1,3]
        ]);
        else assert.deepEqual(runs.map(r=>[r.text,r.bold]),[['캡션 ',false],['제목',true]]);
      }
      if(mergedAxis)assert.deepEqual([tables[1].rows,tables[1].cells[0].rowSpan],[3,3]);
      if(storedAxis){
        if(leftDelete)assert.deepEqual(rightSiblingLayout(reopened),originalRightLayout);
        const actual=JSON.parse(reopened.getFieldList()),owner=tables[leftDelete?0:1].cells.find(c=>c.row===(leftDelete?0:1)&&c.column===1);
        assert.equal(actual.length,originalFields.length);
        for(const previous of originalFields){
          const field=actual.find(f=>f.fieldId===previous.fieldId),expected=structuredClone(previous);
          if(owner.clickHereFieldIds.includes(previous.fieldId))expected.location.path.at(-1).cellIndex=owner.index;
          assert.deepEqual({...field,listId:0},{...expected,listId:0});
        }
      }
      if(namedAxis){
        const fields=JSON.parse(reopened.getFieldList());
        assert.equal(new Set(fields.map(f=>f.fieldId)).size,3);
        for(const [host,value] of ['Alpha','Beta'].entries()){
          const field=fields.find(f=>f.cellField&&f.location.path[0].cellIndex===host);
          const cell=tables[host].cells[field.location.path.at(-1).cellIndex];
          assert.deepEqual([cell.fieldName,cell.row,cell.column],['공통 이름',host,1]);
          assert.equal(JSON.parse(reopened.getFieldValue(field.fieldId)).value,value);
        }
      }
      if(bodyMarkers)assert.deepEqual(records(reopened),originalMarkers);
      const hits=JSON.parse(reopened.searchAllText('변경😀',true,true));
      if(!axisOnly){assert.equal(hits.length,1);assert.deepEqual(hits[0].cellPath.map(p=>p.cellIndex),[1,1]);}
      if(mixed){
        assert.equal(hits[0].cellPath.at(-1).cellParaIndex,1);
        const table=readStructure(reopened).nestedTables[1],args=[table.section,table.paragraph,JSON.stringify(hits[0].cellPath)];
        assert.equal(JSON.parse(reopened.getCellCharPropertiesAtByPath(...args,0)).bold,false);
        assert.equal(JSON.parse(reopened.getCellCharPropertiesAtByPath(...args,1)).bold,true);
      }
    } finally {reopened.free();}
    if(captionFlow){
      await frame.evaluate(async bytes=>{
        const api=window.jueonyEditor;
        await api.open(new Uint8Array(bytes),api.fileHandle().name,api.fileHandle(),false);
      },saved.bytes);
      assert.deepEqual(await texts(),edited);
      sameCaptionScreen(await captionScreen(frame),sourceScreen);
    }
    console.log('PASS',format,mode,'UI chat → loopback provider → Agent application → undo/redo → bound file save and native reopen');
  }
  assert.equal(calls.length,bodyMarkers||mergedAxis||fieldAxis||captionAxis?2:4);assert.deepEqual(errors,[]);
} finally {await browser?.close();launcher.kill();await new Promise(r=>provider.close(r));}
