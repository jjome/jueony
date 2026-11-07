import assert from 'node:assert/strict';
import {execFileSync,spawn} from 'node:child_process';
import http from 'node:http';
import {mkdtemp,mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import puppeteer from 'puppeteer-core';
import {loadReviewEngine} from './lib/hancom-review.mjs';
import {proposeFormulaCreation,reviewFormulaCreation} from './lib/review-agent-formula-creation.mjs';

const repo=resolve(import.meta.dirname,'../../..'),dist=resolve(process.env.JUEONY_TEST_DIST);
const {HwpDocument}=await loadReviewEngine(resolve(process.env.JUEONY_ENGINE_PACKAGE));
const port=Number(process.env.JUEONY_TEST_PORT??4576),origin='http://127.0.0.1:'+port;
const nestedOnly=process.argv.includes('--nested-formula');
const insertReview=nestedOnly||process.env.JUEONY_REVIEW_FORMULA_INSERT==='1';
const nativeFieldReview=!nestedOnly&&process.env.JUEONY_REVIEW_NATIVE_FORMULAS==='1';
const cascadeReview=process.env.JUEONY_REVIEW_FORMULA_DEPENDENTS==='1';
const storedFillReview=process.env.JUEONY_REVIEW_STORED_FILL==='1';
if(nativeFieldReview){
  assert.equal(typeof HwpDocument.prototype.previewTableFormulaField,'function','The review engine must export stored formula preview');
  assert.equal(typeof HwpDocument.prototype.updateTableFormulaField,'function','The review engine must export stored formula editing');
}
const fieldCases=[
 {request:'기존 합계 계산식을 =2+5로 변경하고 소수 둘째 자리까지 표시해줘',source:'=SUM(A2,C1,D2)',old:'13',formula:'=2+5',format:'%.2f',value:'7.00'},
 ...(cascadeReview?[{request:'평균 계산식을 =2+3으로 바꾸고 연결된 결과도 확인해줘',source:'=AVG(ABOVE)',old:'2.00',formula:'=2+3',format:'%.2f,',value:'5.00',dependent:true}]:[])
];
const formula=['2','4','6','8','=A1+$A$1','첫 대상','둘째','셋째'];
const scenarios=[
  {request:'월말 날짜를 오른쪽으로 채워줘',mode:'months',row:0,original:['2024-01-31','2024-02-29','기존','원문'],expected:['2024-01-31','2024-02-29','2024-03-31','2024-04-30']},
  {request:'수식을 오른쪽으로 복사해줘',mode:'formula',row:1,original:formula,expected:[...formula.slice(0,5),'=B1+$A$1','=C1+$A$1','=D1+$A$1']},
  {request:'오른쪽 세 셀에 계산한 값을 써줘',mode:'calculated-value',row:1,original:formula,expected:[...formula.slice(0,5),'6','8','10']}
];
if(storedFillReview)for(const mode of ['formula','calculated-value']){
  scenarios.push({request:mode==='formula'?'실제 계산식 필드를 오른쪽 세 셀에 복사해줘':'실제 계산식의 결과만 오른쪽 세 셀에 채워줘',
    mode,row:1,stored:true,original:['2','4','6','8','4.00','첫 대상','둘째','셋째'],expected:['2','4','6','8','4.00','8.00','12.00','16.00']});
}
if(process.env.JUEONY_REVIEW_RECTANGLE==='1'){
  scenarios.push({request:'두 행에 월말 날짜를 가로로 채워줘',mode:'months',row:0,endRow:1,axis:'rows',
    original:['2024-01-31','2024-02-29','기존','원문','2024-03-31','2024-04-30','옛값','기존'],
    expected:['2024-01-31','2024-02-29','2024-03-31','2024-04-30','2024-03-31','2024-04-30','2024-05-31','2024-06-30']});
  for(const mode of ['formula','calculated-value']){
    scenarios.push({request:'두 행의 저장된 계산식을 '+(mode==='formula'?'필드':'고정값')+'로 가로 채워줘',mode,row:1,endRow:2,axis:'rows',stored:true,
      original:['2','4','6','8','4.00','첫 대상','둘째','셋째','5.00','기존','기존','기존'],
      expected:['2','4','6','8','4.00','8.00','12.00','16.00','5.00','9.00','13.00','17.00']});
  }
}
const seriesCases=nestedOnly?[]:scenarios;
const calls=[];
function propose(input){
  if(insertReview){
    const insertion=proposeFormulaCreation(input);
    if(insertion)return insertion;
  }
  const fieldCase=fieldCases.find(c=>c.request===input.instruction);
  if(fieldCase){
    const {fields,canRefreshDependents}=input.document.tableFormulaFields,field=fields.find(f=>f.expression===fieldCase.source);
    if(fieldCase.dependent)assert.equal(canRefreshDependents,true);
    assert.equal(field.editable,true);assert.equal(field.displayedValue,fieldCase.old);calls.push('field');
    return {kind:'update_table_formula_field',target:field.tableId,row:field.row,column:field.column,fieldId:field.fieldId,
      originalCommand:field.storedCommand,formula:fieldCase.formula,resultFormat:fieldCase.format};
  }
  const test=scenarios.find(c=>c.request===input.instruction),table=input.document.structure.tables[0];
  if(test.stored){assert.equal(input.document.tableFormulaFields.canFill,true);assert.equal(input.document.tableFormulaFields.fields[0].expression,'=A1*2');}
  assert.deepEqual(table.cells.map(c=>c.text),test.original);calls.push(test.mode);
  return {kind:'fill_table_series',target:table.id,startRow:test.row,startColumn:0,endRow:test.endRow??test.row,endColumn:3,mode:test.mode,...(test.axis?{axis:test.axis}:{})};
}
const provider=http.createServer(async(req,res)=>{
  try {
    let raw='';for await(const chunk of req)raw+=chunk;
    const op=propose(JSON.parse(JSON.parse(raw).messages[1].content));
    const result={message:'지정한 구간을 채웠습니다.',sourceIds:[],operations:[op]};
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(result)}}]}));
  } catch(e) {console.error('Fixture provider:',e);res.writeHead(500);res.end(String(e));}
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
  for(const format of ['hwp','hwpx']) for(const test of seriesCases) {
    const frame=await(await page.$('.editor-frame:not([hidden])')).contentFrame();
    const doc=HwpDocument.createEmpty();doc.createBlankDocument();
    const table=JSON.parse(doc.createTable(0,0,0,(test.endRow??test.row)+1,4)),styled=test.row*4+2;
    for(const [i,text] of test.original.entries()) doc.insertTextInCell(0,table.paraIdx,table.controlIdx,i,0,0,text);
    doc.applyCharFormatInCell(0,table.paraIdx,table.controlIdx,styled,0,0,Array.from(test.original[styled]).length,'{"bold":true}');
    if(test.stored)doc.insertTableFormulaField(0,table.paraIdx,table.controlIdx,4,'4.00','=A1*2','%.2f');
    if(test.stored&&test.axis)doc.insertTableFormulaField(0,table.paraIdx,table.controlIdx,8,'5.00','=A2+1','%.2f');
    const bytes=Array.from(format==='hwp'?doc.exportHwp():doc.exportHwpx());doc.free();
    await frame.evaluate(async(bytes,name)=>{
      const root=await navigator.storage.getDirectory(),handle=await root.getFileHandle(name,{create:true}),writer=await handle.createWritable();
      await writer.write(new Uint8Array(bytes));await writer.close();await window.jueonyEditor.open(new Uint8Array(bytes),name,handle,false);
    },bytes,(test.stored?'stored-':'')+test.mode+'.'+format);
    await fill('request-input',test.request);const sent=page.waitForResponse(r=>r.url()===origin+'/api/generate');await page.click('#send-request');await sent;
    await page.waitForFunction(()=>!document.getElementById('send-request').disabled);
    assert.equal(await page.$eval('#request-error',e=>e.hidden?'':e.textContent),'',format+'/'+test.mode);
    const current=()=>frame.evaluate(()=>window.jueonyEditor.snapshot().structure.tables[0].cells.map(c=>c.text));
    assert.deepEqual(await current(),test.expected);
    const storedCommands=()=>frame.evaluate(()=>window.jueonyEditor.snapshot().tableFormulaFields.fields.map(f=>f.storedCommand));
    const expectedCommands=['=A1*2??%.2f;;4.00',...(test.mode==='formula'?['=B1*2??%.2f;;8.00','=C1*2??%.2f;;12.00','=D1*2??%.2f;;16.00']:[])];
    const originalCommands=expectedCommands.slice(0,1);
    if(test.stored&&test.axis){originalCommands.push('=A2+1??%.2f;;5.00');expectedCommands.push(originalCommands[1],...(test.mode==='formula'?['=B2+1??%.2f;;9.00','=C2+1??%.2f;;13.00','=D2+1??%.2f;;17.00']:[]));}
    if(test.stored)assert.deepEqual(await storedCommands(),expectedCommands);
    const buttons=(await page.$$('.message-actions button')).reverse();
    for(const b of buttons) if(await b.evaluate(e=>e.textContent==='요청 되돌리기')){await b.click();break;}
    await page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('되돌렸습니다'));assert.deepEqual(await current(),test.original);
    if(test.stored)assert.deepEqual(await storedCommands(),originalCommands);
    assert.equal((await frame.evaluate(()=>window.jueonyEditor.executeCommand('edit:redo'))).ok,true);assert.deepEqual(await current(),test.expected);
    if(test.stored)assert.deepEqual(await storedCommands(),expectedCommands);
    const file=await frame.evaluate(async()=>{
      const api=window.jueonyEditor,status=await api.save(),t=api.snapshot().structure.tables[0],f=await api.fileHandle().getFile();
      return {status,dirty:api.state().dirty,coords:[t.section,t.paragraph,t.control],bytes:Array.from(new Uint8Array(await f.arrayBuffer()))};
    });
    assert.equal(file.status,'saved');assert.equal(file.dirty,false);
    const reopened=new HwpDocument(new Uint8Array(file.bytes));
    try {
      assert.deepEqual(test.expected.map((_,i)=>reopened.getTextInCell(...file.coords,i,0,0,reopened.getCellParagraphLength(...file.coords,i,0))),test.expected);
      assert.equal(JSON.parse(reopened.getCellCharPropertiesAt(...file.coords,styled,0,0)).bold,true);
      if(test.stored){
        assert.deepEqual(JSON.parse(reopened.getFieldList()).map(f=>f.command),expectedCommands);
        const path=resolve(await mkdtemp(resolve(repo,'build/native-formula-fill-')),'agent.'+format);await writeFile(path,new Uint8Array(file.bytes));
        const raw=JSON.parse(execFileSync('python',[resolve(import.meta.dirname,'lib/read-native-formula-fields.py'),path],{encoding:'utf8'}));
        assert.deepEqual(format==='hwp'?raw.fields.map(f=>f.command):raw.map(f=>f.params.find(([,key])=>key==='Command')[2]),expectedCommands);
      }
    } finally {reopened.free();}
    console.log('PASS',format,test.stored?'native FORMULA fill':'fill',test.mode,'chat, real edit, undo/redo, saved bytes, Native reopen and formatting');
  }
  assert.deepEqual(calls,[...seriesCases,...seriesCases].map(c=>c.mode));assert.deepEqual(errors,[]);
  if(nativeFieldReview)for(const format of ['hwp','hwpx'])for(const fieldCase of fieldCases){
    const f=await(await page.$('.editor-frame:not([hidden])')).contentFrame();
    const source=new HwpDocument(new Uint8Array(await readFile(resolve(repo,'upstream/rhwp-source/samples/calc-cell.hwp'))));
    if(fieldCase.dependent){
      const last=JSON.parse(source.getFieldList()).find(f=>f.command?.startsWith('=SUM(A2,C1,D2)??'));
      const {sectionIndex,paraIndex,path}=last.location;
      assert.equal(JSON.parse(source.updateTableFormulaField(sectionIndex,paraIndex,path[0].controlIndex,path[0].cellIndex,last.fieldId,last.command,'=A3*2','%g')).value,'4');
    }
    const bytes=Array.from(format==='hwp'?source.exportHwp():source.exportHwpx());source.free();
    await f.evaluate(async(bytes,name)=>{
      const root=await navigator.storage.getDirectory(),h=await root.getFileHandle(name,{create:true}),w=await h.createWritable();
      await w.write(new Uint8Array(bytes));await w.close();await window.jueonyEditor.open(new Uint8Array(bytes),name,h,false);
    },bytes,(fieldCase.dependent?'formula-dependents.':'native-field.')+format);
    const fields=()=>f.evaluate(()=>window.jueonyEditor.snapshot().tableFormulaFields.fields);
    const before=await fields();
    await fill('request-input',fieldCase.request);
    const sent=page.waitForResponse(r=>r.url()===origin+'/api/generate');await page.click('#send-request');await sent;
    await page.waitForFunction(()=>!document.getElementById('send-request').disabled);
    assert.equal(await page.$eval('#request-error',e=>e.hidden?'':e.textContent),'',format+' native field');
    const edited=await fields(),idx=before.findIndex(v=>v.expression===fieldCase.source),changed=edited[idx];
    assert.equal(changed.expression,fieldCase.formula);assert.equal(changed.displayedValue,fieldCase.value);assert.equal(changed.resultFormat,fieldCase.format);
    const dependent=fieldCase.dependent?edited.find(f=>f.expression==='=A3*2'):undefined;
    if(fieldCase.dependent){assert.ok(dependent);assert.equal(dependent.displayedValue,'10');assert.equal(dependent.storedCommand,'=A3*2??%g;;10');}
    const untouched=fields=>fields.filter((f,i)=>i!==idx&&f.fieldId!==dependent?.fieldId);
    assert.deepEqual(untouched(edited),untouched(before));
    for(const button of(await page.$$('.message-actions button')).reverse())if(await button.evaluate(e=>e.textContent==='변경 확인')){await button.click();break;}
    const comparison=await page.$eval('#structure-diff',e=>e.hidden?'':e.textContent);
    assert.ok(comparison.includes(before[idx].storedCommand));assert.ok(comparison.includes(changed.storedCommand));
    if(dependent){assert.ok(comparison.includes('=A3*2??%g;;4'));assert.ok(comparison.includes(dependent.storedCommand));}
    await page.keyboard.press('Escape');
    for(const b of(await page.$$('.message-actions button')).reverse())if(await b.evaluate(e=>e.textContent==='요청 되돌리기')){await b.click();break;}
    await page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('되돌렸습니다'));assert.deepEqual(await fields(),before);
    assert.equal((await f.evaluate(()=>window.jueonyEditor.executeCommand('edit:redo'))).ok,true);assert.deepEqual(await fields(),edited);
    const saved=await f.evaluate(async()=>{
      const api=window.jueonyEditor,status=await api.save(),file=await api.fileHandle().getFile();
      return {status,bytes:Array.from(new Uint8Array(await file.arrayBuffer()))};
    });
    assert.equal(saved.status,'saved');
    const path=resolve(await mkdtemp(resolve(repo,'build/native-formula-save-')),'agent.'+format);
    await writeFile(path,new Uint8Array(saved.bytes));
    const wire=JSON.parse(execFileSync('python',[resolve(import.meta.dirname,'lib/read-native-formula-fields.py'),path],{encoding:'utf8'}));
    const modified=dependent?[changed,dependent]:[changed];
    for(const item of modified){
      if(format==='hwp')assert.equal(wire.fields.find(f=>f.id===item.fieldId).command,item.storedCommand);
      else {
        const field=wire.find(f=>f.id===item.fieldId),params=Object.fromEntries(field.params.map(([,k,v])=>[k,v]));
        assert.equal(field.fieldid,field.endFieldid);assert.equal(params.Command,item.storedCommand);assert.equal(params.Formula,item.expression);
        assert.equal(params.ResultFormat,item.resultFormat);assert.equal(params.LastResult,item.displayedValue);
      }
    }
    const reopened=new HwpDocument(new Uint8Array(saved.bytes));
    try{for(const item of modified){const actual=JSON.parse(reopened.getFieldList()).find(v=>v.fieldId===item.fieldId);assert.equal(actual.command,item.storedCommand);assert.equal(actual.value,item.displayedValue);}}
    finally{reopened.free();}
    console.log('PASS',format,fieldCase.dependent?'native FORMULA edit and dependent recalculation':'native FORMULA edit','chat, sibling fields, undo/redo, guarded save, independent file metadata and reopened result');
  }
  if(nativeFieldReview)assert.deepEqual(calls.slice(scenarios.length*2),Array(fieldCases.length*2).fill('field'));
  if(insertReview)await reviewFormulaCreation({HwpDocument,page,fill,origin,nestedOnly});
  assert.deepEqual(errors,[]);
} finally {await browser?.close();server.kill();await new Promise(r=>provider.close(r));}
