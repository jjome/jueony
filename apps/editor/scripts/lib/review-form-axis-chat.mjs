import http from 'node:http';
import assert from 'node:assert/strict';

const insertRequest='첫 번째 양식 표의 결재란 바로 위에 새 행을 넣어 주세요.';
const deleteRequest='첫 번째 양식 표에서 결재란이 들어 있는 행을 삭제해 주세요.';

function form(HwpDocument,inline){
 const doc=HwpDocument.createEmpty();
 doc.createBlankDocument();doc.insertText(0,0,0,'양식');doc.splitParagraph(0,0,2);doc.createTable(0,1,0,2,2);
 for(let i=0;i<4;i++){
  doc.setCellProperties(0,1,0,i,JSON.stringify({width:i%2?9000:6000,height:i<2?4500:6500}));
  doc.insertTextInCell(0,1,0,i,0,0,'항목'+i);
 }
 doc.setCellProperties(0,1,0,2,'{"fieldName":"결재란"}');
 if(inline){
  doc.insertClickHereFieldInCell(0,1,0,3,0,0,false,'입력','작성자','작성자',true);
  doc.setFieldValueByName('작성자','김민수');
 }
 doc.splitParagraph(0,1,doc.getParagraphLength(0,1));doc.createTable(0,2,0,1,1);
 doc.setCellProperties(0,2,0,0,'{"fieldName":"접수란"}');doc.insertTextInCell(0,2,0,0,0,0,'접수');
 return doc;
}

export async function reviewFormAxisChat({HwpDocument,page,origin,scenario,open,state,snap,execute,reopen}){
 const calls=[];
 const provider=http.createServer(async(req,res)=>{
  try{
   let raw='';for await(const chunk of req)raw+=chunk;
   const input=JSON.parse(JSON.parse(raw).messages[1].content);
   assert.ok([insertRequest,deleteRequest].includes(input.instruction));
   const [t]=input.document.structure.tables,named=t.cells.find(c=>c.properties.fieldName==='결재란');
   assert.ok(named.axisFieldSignature);assert.ok(t.cells.every(c=>c.rowSpan===1&&c.columnSpan===1));
   const insert=input.instruction===insertRequest;
   if(insert)assert.ok(t.cells.find(c=>c.text.startsWith('김민수')).axisFieldSignature);
   const operation={kind:insert?'insert_table_row':'delete_table_row',target:t.id,index:named.row,...(insert?{values:['신규','']}:{})};
   calls.push(input.instruction);
   res.setHeader('Content-Type','application/json');
   res.end(JSON.stringify({choices:[{message:{content:JSON.stringify({message:'양식 표 행 편집',sourceIds:[],operations:[operation]})}}]}));
  }catch(error){res.writeHead(500);res.end(String(error));}
 });
 await new Promise(r=>provider.listen(0,'127.0.0.1',r));
 try{
  const fill=(id,v)=>page.$eval('#'+id,(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},v);
  await page.click('#connection-settings');await page.click('#new-connection');await page.select('#config-adapter','openai-compatible');
  await fill('config-label','양식 표 검수');await fill('config-endpoint','http://127.0.0.1:'+provider.address().port+'/v1');
  await fill('config-model','form-axis-fixture');await fill('config-key','synthetic-local-fixture');
  await page.$eval('#config-remember',e=>e.checked=false);await page.click('#model-form button[type=submit]');
  await page.waitForFunction(()=>!document.getElementById('model-dialog').open);
  async function send(request){
   const count=calls.length;
   await fill('request-input',request);const sent=page.waitForResponse(r=>r.url()===origin+'/api/generate');
   await page.click('#send-request');await sent;await page.waitForFunction(()=>!document.getElementById('send-request').disabled);
   assert.deepEqual(calls.slice(count),[request]);
   return page.$eval('#request-error',e=>e.hidden?'':e.textContent);
  }
  for(const ext of ['hwp','hwpx']){
   await scenario(ext+' Agent form table insert through chat',async()=>{
    const frame=await open(ext,form(HwpDocument,true)),before=(await snap()).structure;
    assert.equal(await send(insertRequest),'');
    const after=(await snap()).structure,[t,other]=after.tables;
    assert.deepEqual(other,before.tables[1]);assert.equal(t.rows,3);
    assert.equal(t.cells[2].text,'신규');assert.equal(t.cells[4].properties.fieldName,'결재란');
    assert.equal(t.cells[5].axisFieldSignature,before.tables[0].cells[3].axisFieldSignature);
    assert.deepEqual(t.cells.map(c=>[c.properties.width,c.properties.height]),[
     [6000,4500],[9000,4500],[6000,6500],[9000,6500],[6000,6500],[9000,6500]]);
    await execute('edit:undo');assert.deepEqual((await snap()).structure,before);
    await execute('edit:redo');assert.deepEqual((await snap()).structure,after);
    await reopen(frame,'form-axis-'+ext,ext);assert.deepEqual((await snap()).structure,after);
   });
   await scenario(ext+' Agent form table named owner deletion refused through chat',async()=>{
    await open(ext,form(HwpDocument,false));const before=await state(),model=(await snap()).structure;
    assert.match(await send(deleteRequest),/필드/);
    assert.deepEqual(await state(),before);assert.deepEqual((await snap()).structure,model);
   });
  }
 }finally{await new Promise(r=>provider.close(r));}
}
