import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const cases=[
 {name:'empty',source:'',request:'빈 C1 셀에 합계를 계산식 필드로 삽입해줘'},
 {name:'text',source:'합계 대기',request:'C1의 합계 대기 문구를 합계 계산식으로 바꿔줘'},
 {name:'dependent',source:'3',request:'기존 3이 있는 C1에 합계 필드를 넣고 이를 참조하는 셀도 갱신해줘'},
];
export function proposeFormulaCreation(input){
 const test=cases.find(c=>c.request===input.instruction);if(!test)return undefined;
 assert.equal(input.document.tableFormulaFields.canInsert,true);
 const t=input.document.structure.tables[0],cell=t.cells.find(c=>c.row===0&&c.column===2);
 assert.equal(cell.editable,true);assert.equal(cell.text,test.source);
 return {kind:'insert_table_formula_field',target:t.id,row:cell.row,column:cell.column,originalText:cell.text,formula:'=SUM(A1:B1)',resultFormat:'%.2f'};
}
export async function reviewFormulaCreation({HwpDocument,page,fill,origin}){
 const out=resolve(process.env.JUEONY_TEST_OUTPUT??'build/agent-formula-creation');await mkdir(out,{recursive:true});
 const results=[];
 async function action(name){
  await page.waitForFunction(text=>Array.from(document.querySelectorAll('.message-actions button')).some(b=>b.textContent===text),{timeout:5000},name)
   .catch(async()=>{throw Error('Missing '+name+': '+await page.$eval('#app-status',el=>el.textContent)+' / '+await page.$$eval('.message',els=>els.at(-1)?.textContent));});
  for (const button of (await page.$$('.message-actions button')).reverse()) if(await button.evaluate((e,label)=>e.textContent===label,name)){await button.click();return;}
  assert.fail('Missing action '+name);
 }
 for(const format of ['hwp','hwpx']) for(const test of cases){
  const doc=HwpDocument.createEmpty();doc.createBlankDocument();
  const t=JSON.parse(doc.createTable(0,0,0,1,4)),at=[0,t.paraIdx,t.controlIdx];
  for(const [index,text] of ['12','7',test.source,''].entries())if(text)doc.insertTextInCell(...at,index,0,0,text);
  if(test.name==='dependent')doc.insertTableFormulaField(...at,3,'','=C1*2','%g');
  const input=Array.from(format==='hwp'?doc.exportHwp():doc.exportHwpx());doc.free();
  const f=await(await page.$('.editor-frame:not([hidden])')).contentFrame(),name=test.name+'.'+format;
  await f.evaluate(async(bytes,name)=>{
   const dir=await navigator.storage.getDirectory(),handle=await dir.getFileHandle(name,{create:true}),w=await handle.createWritable();
   await w.write(new Uint8Array(bytes));await w.close();await window.jueonyEditor.open(new Uint8Array(bytes),name,handle,false);
  },input,name);
  const read=()=>f.evaluate(()=>{
   const s=window.jueonyEditor.snapshot();
   return {fields:s.tableFormulaFields?.fields??[],cells:s.structure.tables[0].cells.map(c=>c.text)};
  });
  const before=await read();await fill('request-input',test.request);
  const sent=page.waitForResponse(r=>r.url()===origin+'/api/generate');await page.click('#send-request');await sent;
  await page.waitForFunction(()=>!document.getElementById('send-request').disabled);
  assert.equal(await page.$eval('#request-error',e=>e.hidden?'':e.textContent),'');
  const after=await read(),fresh=after.fields.find(v=>v.row===0&&v.column===2);
  assert.deepEqual(after.cells,['12','7','19.00',test.name==='dependent'?'38':'']);
  assert.ok(fresh);assert.equal(fresh.storedCommand,'=SUM(A1:B1)??%.2f;;19.00');
  await action('변경 확인');
  const compare=await page.$eval('#structure-diff',el=>el.hidden?'':el.textContent);
  assert.ok(compare.includes('일반 셀'));assert.ok(compare.includes(fresh.storedCommand));
  if(test.name==='dependent')assert.ok(compare.includes('=C1*2??%g;;38'));
  await page.keyboard.press('Escape');await action('요청 되돌리기');
  await page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('되돌렸습니다'));
  assert.deepEqual(await read(),before);
  assert.ok((await f.evaluate(()=>window.jueonyEditor.executeCommand('edit:redo'))).ok);assert.deepEqual(await read(),after);
  const bytes=await f.evaluate(async()=>{
   const api=window.jueonyEditor;if(await api.save()!=='saved')throw Error('Guarded save failed');
   return [...new Uint8Array(await (await api.fileHandle().getFile()).arrayBuffer())];
  });
  const saved=resolve(out,name);await writeFile(saved,new Uint8Array(bytes));
  const raw=JSON.parse(execFileSync('python',[resolve(import.meta.dirname,'read-native-formula-fields.py'),saved],{encoding:'utf8'}));
  const field=format==='hwp'?raw.fields.find(v=>v.id===fresh.fieldId):raw.find(v=>v.id===fresh.fieldId);
  if(format==='hwp')assert.equal(field.command,fresh.storedCommand);
  else {assert.equal(field.fieldid,field.endFieldid);assert.ok(field.params.some(([,k,v])=>k==='Command'&&v===fresh.storedCommand));}
  const reopened=new HwpDocument(new Uint8Array(bytes));
  try {assert.deepEqual(JSON.parse(reopened.getFieldList()).filter(v=>v.fieldType==='formula').map(v=>[v.fieldId,v.command,v.value]),
    after.fields.map(v=>[v.fieldId,v.storedCommand,v.displayedValue]));}finally{reopened.free();}
  results.push({file:name,fieldId:fresh.fieldId,command:fresh.storedCommand});console.log('PASS Agent stored formula creation',name);
 }
 const doc=HwpDocument.createEmpty();doc.createBlankDocument();
 const {paraIdx,controlIdx}=JSON.parse(doc.createTable(0,0,0,1,4));
 doc.insertTextInCell(0,paraIdx,controlIdx,0,0,0,'12');doc.insertTextInCell(0,paraIdx,controlIdx,1,0,0,'7');
 const bytes=Array.from(doc.exportHwpx());doc.free();
 const frame=await(await page.$('.editor-frame:not([hidden])')).contentFrame();
 await frame.evaluate(async b=>window.jueonyEditor.open(new Uint8Array(b),'conflict.hwpx',null,false),bytes);
 let held=false;
 const hold=request=>{
  if(!held&&request.url()===origin+'/api/generate')held=true;
  else void request.continue();
 };
 await page.setRequestInterception(true);page.on('request',hold);
 try {
  await fill('request-input',cases[0].request);
  const waiting=page.waitForRequest(r=>r.url()===origin+'/api/generate',{timeout:10000});
  await page.click('#send-request');const request=await waiting;
  const userChange=await frame.evaluate(({paraIdx,controlIdx})=>{
   const api=window.jueonyEditor,automation=window.rhwpStudio.automation;
   let services;
   automation.registerCommand({id:'ext:insert-conflict-test',label:'검수',canExecute:()=>true,execute:s=>{services=s;}});
   try{automation.execute('ext:insert-conflict-test');}finally{automation.unregisterCommand('ext:insert-conflict-test');}
   const ih=services.getInputHandler(),revision=api.revision();
   ih.executeOperation({kind:'snapshot',operationType:'user-cell-edit',operation:wasm=>{
    wasm.insertTextInCell(0,paraIdx,controlIdx,2,0,0,'사용자 입력');return ih.getCursorPosition();
   }});
   const snapshot=api.snapshot();return {revision:snapshot.revision,changed:snapshot.revision!==revision,text:snapshot.structure.tables[0].cells[2].text};
  },{paraIdx,controlIdx});
  const sent=page.waitForResponse(r=>r.url()===origin+'/api/generate');await request.continue();await sent;
  assert.deepEqual([userChange.changed,userChange.text],[true,'사용자 입력']);
  await page.waitForFunction(()=>!document.getElementById('send-request').disabled);
  const guarded=await frame.evaluate(()=>{const s=window.jueonyEditor.snapshot();return {revision:s.revision,text:s.structure.tables[0].cells[2].text,fields:s.tableFormulaFields.fields.length};});
  assert.deepEqual(guarded,{revision:userChange.revision,text:'사용자 입력',fields:0});
  const error=await page.$eval('#request-error',e=>e.hidden?'':e.textContent);
  assert.ok(error || (await page.$$eval('.message',els=>els.at(-1)?.textContent)).includes('변경'));
  console.log('PASS Agent stale request preserved concurrent plain-cell edit and history revision');
 }finally{page.off('request',hold);await page.setRequestInterception(false);}
 await writeFile(resolve(out,'result.json'),JSON.stringify({results,concurrentEditPreserved:true,provider:'local deterministic OpenAI-compatible fixture'},null,2)+'\n');
}
