import http from 'node:http';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {expectedPictureHeading} from './repeated-picture-heading.mjs';
import {inspectPictureAnchors} from './axis-picture-fixture.mjs';

const insertRequest='첫 번째 양식 표의 결재란 바로 위에 새 행을 넣어 주세요.';
const deleteRequest='첫 번째 양식 표에서 결재란이 들어 있는 행을 삭제해 주세요.';
const pictureRequest='표에 있는 결재 도장을 유지하고 두 번째 줄 앞에 새 행을 넣어 주세요.';
const removePicture='그림이 들어 있는 행을 삭제해 주세요.';
const picturesRequest='제품 사진 네 장을 유지하고 두 번째 줄 앞에 새 행을 추가해 주세요.';
const removePictures='PicB 사진이 있는 행을 삭제해 주세요.';
const groupedRequest='한 칸에 나란히 넣은 사진 세 장을 유지하고 그 위에 새 행을 넣어 주세요.';
const removeGrouped='사진 세 장이 있는 행을 삭제해 주세요.';
const splitRequest='한 칸의 두 문단에 나눠 넣은 사진 세 장을 유지하고 그 위에 새 행을 넣어 주세요.';
const repeatRequest='각 쪽의 제목 행을 유지하고 사진 세 장이 든 본문 행 바로 위에 새 행을 넣어 주세요.';
const titlePictureRequests=['제목 그림 원본을 유지하고 본문 두 번째 행 앞에 새 행을 넣어 주세요.',
 '반복 제목 그림을 유지하고 맨 앞에 새 제목 열을 넣어 주세요.', '방금 만든 맨 앞 제목 열을 삭제해 주세요.',
 '그림이 들어 있는 반복 제목 행을 삭제해 주세요.'];

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

function proposal(input,splitPictures){
 const [t]=input.document.structure.tables;
 if(titlePictureRequests.includes(input.instruction)){
  assert.equal(t.cells.filter(c=>c.axisPicture).length,4);assert.equal(t.headerRows,1);
  assert.ok(t.cells.find(c=>c.text==='PicA').axisPicture);
  const index=titlePictureRequests.indexOf(input.instruction);
  return index===0?{kind:'insert_table_row',target:t.id,index:2,values:['새 행','','']}:
   index===1?{kind:'insert_table_column',target:t.id,index:0,values:['새 제목',...Array(t.rows-1).fill('')]}:
   {kind:index===2?'delete_table_column':'delete_table_row',target:t.id,index:0};
 }
 if([pictureRequest,removePicture,picturesRequest,removePictures,groupedRequest,splitRequest,repeatRequest,removeGrouped].includes(input.instruction)){
  const many=[picturesRequest,removePictures].includes(input.instruction);
  const grouped=[groupedRequest,splitRequest,repeatRequest,removeGrouped].includes(input.instruction);
  const owners=t.cells.filter(c=>c.axisPicture);
  assert.equal(owners.length,grouped?2:many?4:1);
  const owner=grouped?owners.find(c=>c.axisPicture.pictures?.length===3):owners.find(c=>c.text===(many?'PicB':'Picture owner'));
  assert.ok(owner);
  if(grouped)assert.deepEqual(owner.axisPicture.pictures.map(p=>[p.cellParaIndex,p.controlIndex]),splitPictures?[[0,0],[1,0],[1,1]]:[[0,0],[0,1],[0,2]]);
  if(input.instruction===repeatRequest){
   assert.ok([1,2].includes(t.headerRows));assert.equal(t.pagination.repeatHeader,true);assert.equal(owner.row,t.headerRows+1);
   return {kind:'insert_table_row',target:t.id,index:owner.row,values:['새 행','','']};
  }
  return [pictureRequest,picturesRequest,groupedRequest,splitRequest].includes(input.instruction)?{kind:'insert_table_row',target:t.id,index:1,values:['새 행','','']}:
    {kind:'delete_table_row',target:t.id,index:owner.row};
 }
 assert.ok([insertRequest,deleteRequest].includes(input.instruction));
 const named=t.cells.find(c=>c.properties.fieldName==='결재란');
 assert.ok(named.axisFieldSignature);assert.ok(t.cells.every(c=>c.rowSpan===1&&c.columnSpan===1));
 const insert=input.instruction===insertRequest;
 if(insert)assert.ok(t.cells.find(c=>c.text.startsWith('김민수')).axisFieldSignature);
 return {kind:insert?'insert_table_row':'delete_table_row',target:t.id,index:named.row,...(insert?{values:['신규','']}:{})};
}

async function checkPicturePages(frame,expected,headings){
 const layouts=await frame.evaluate(headings=>{
  const d=window.__pageServices.wasm.borrowDocumentHandle(),active=d.canvasMetricsActive();
  const pages=()=>Array.from({length:d.pageCount()},(_,i)=>{
   const controls=JSON.parse(d.getPageControlLayout(i)).controls,images=controls.filter(c=>c.type==='image').length;
   if(!headings)return images;
   const table=controls.find(c=>c.type==='table'&&c.secIdx===0&&c.paraIdx===1&&c.controlIdx===0);
   const runs=JSON.parse(d.getPageTextLayout(i)).runs;
   const headerRows=Math.max(...headings.map(c=>c.row+c.rowSpan));
   return {images,cells:table.cells.filter(c=>c.row<headerRows).map(c=>[c.row,c.col,c.rowSpan,c.colSpan]),
    labels:headings.map(({paragraphs},cell)=>paragraphs.map((_,p)=>{
     const owned=runs.filter(r=>r.secIdx===0&&r.parentParaIdx===1&&r.controlIdx===0&&r.cellPath?.length===1&&
      r.cellPath[0].cellIndex===cell&&r.cellPath[0].cellParaIndex===p);
     return owned.length?owned.map(r=>r.text).join(''):null;
    }))};
  });
  try{
   d.selectCanvasMetrics(true);
   const screen=pages(),canvas=d.canvasMetricsActive();
   d.selectCanvasMetrics(false);return {canvas,screen,portable:pages()};
  }finally{d.selectCanvasMetrics(active);}
 },headings);
 assert.equal(layouts.canvas,true);
 const wanted=headings?expected.map(images=>({images,cells:headings.map(c=>[c.row,c.col,c.rowSpan,c.colSpan]),labels:headings.map(c=>c.paragraphs)})):expected;
 assert.deepEqual(layouts.screen,wanted);assert.deepEqual(layouts.portable,wanted);
}

export async function reviewFormAxisChat({HwpDocument,page,origin,scenario,open,state,snap,execute,reopen,pictureFolder,multiplePictures,groupedPictures,splitPictures,pagedPictures,repeatPictures,titlePictureOwner,outputFolder}){
 const calls=[];
 const provider=http.createServer(async(req,res)=>{
  try{
   let raw='';for await(const chunk of req)raw+=chunk;
   const input=JSON.parse(JSON.parse(raw).messages[1].content);
   const operation=proposal(input,splitPictures);
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
   if(titlePictureOwner){
    await scenario(ext+' Agent picture owner repeated title row and column edits preserve one stored source',async()=>{
     const sourceFile=resolve(pictureFolder,'before.'+ext),source=new HwpDocument(await readFile(sourceFile));
     const records=inspectPictureAnchors(sourceFile),frame=await open(ext,source);
     const verify=async expected=>{
      const views=await frame.evaluate(()=>{
       const d=window.__pageServices.wasm.borrowDocumentHandle(),active=d.canvasMetricsActive();
       const t=window.jueonyEditor.snapshot().structure.tables[0],title=t.cells.find(c=>c.text==='PicA');
       const layout=()=>Array.from({length:d.pageCount()},(_,p)=>{
        const images=JSON.parse(d.getPageControlLayout(p)).controls.filter(c=>c.type==='image');
        return {images:images.length,paths:images.filter(c=>c.cellPath?.[0]?.cellIndex===title.index).map(c=>[c.controlIdx,c.cellPath])};
       });
       try{d.selectCanvasMetrics(true);const screen=layout(),canvas=d.canvasMetricsActive();d.selectCanvasMetrics(false);
        return {canvas,screen,portable:layout(),stored:JSON.parse(d.getControls()).filter(c=>c.ctrlId==='gso').length,title:title.index};
       }finally{d.selectCanvasMetrics(active);}
      });
      assert.equal(views.canvas,true);assert.equal(views.stored,4);
      const wanted=expected.map(images=>({images,paths:[[0,[{controlIndex:0,cellIndex:views.title,cellParaIndex:0}]]]}));
      assert.deepEqual(views.screen,wanted);assert.deepEqual(views.portable,wanted);
     };
     await verify([2,3]);
     for(const request of titlePictureRequests.slice(0,3)){
      const before=(await snap()).structure;assert.equal(await send(request),'');const after=(await snap()).structure;
      await verify([1,4]);await execute('edit:undo');assert.deepEqual((await snap()).structure,before);
      await execute('edit:redo');assert.deepEqual((await snap()).structure,after);
     }
     const after=(await snap()).structure;
     await reopen(frame,'picture-title-axis-'+ext,ext);assert.deepEqual((await snap()).structure,after);await verify([1,4]);
     assert.deepEqual(inspectPictureAnchors(resolve(outputFolder,'picture-title-axis-'+ext+'.'+ext)),
      records.map(p=>({...p,row:p.row+(p.row>=2?1:0)})));
     const beforeRefusal=await state();assert.match(await send(titlePictureRequests[3]),/그림|제목/);
     assert.deepEqual(await state(),beforeRefusal);
    });
    continue;
   }
   if(pictureFolder){
    const sourceKind=repeatPictures?' with an existing repeated title row':pagedPictures?' with a merged photo cell moving between pages':splitPictures?' with three pictures in two cell paragraphs':groupedPictures?' with three pictures in one cell':multiplePictures?' with four products':'';
    await scenario(ext+' Agent picture owner row insertion and deletion refusal through chat'+sourceKind,async()=>{
     const source=new HwpDocument(await readFile(resolve(pictureFolder,'before.'+ext)));
     const headings=repeatPictures?expectedPictureHeading(JSON.parse(source.getCellInfo(0,1,0,0)).rowSpan===2,source.getCellParagraphCount(0,1,0,0)===2):undefined;
     const frame=await open(ext,source),before=(await snap()).structure;
     if(pagedPictures)await checkPicturePages(frame,[3,1],headings);
     const originals=before.tables[0].cells.filter(c=>c.axisPicture);assert.equal(originals.length,groupedPictures?2:multiplePictures?4:1);
     const request=repeatPictures?repeatRequest:splitPictures?splitRequest:groupedPictures?groupedRequest:multiplePictures?picturesRequest:pictureRequest;
     assert.equal(await send(request),'');
     const after=(await snap()).structure;
     if(pagedPictures)await checkPicturePages(frame,[0,4],headings);
     const insertionRow=repeatPictures?before.tables[0].headerRows+1:1;
     if(repeatPictures)assert.equal(after.tables[0].cells.find(c=>c.text==='새 행').row,insertionRow);
     for(const original of originals){
      const moved=after.tables[0].cells.find(c=>c.text===original.text);
      assert.equal(moved.row,original.row+(original.row>=insertionRow?1:0));assert.equal(moved.column,original.column);
      assert.equal(moved.axisPicture.signature,original.axisPicture.signature);
      assert.ok(Math.abs(moved.axisPicture.left-original.axisPicture.left)<=.2&&Math.abs(moved.axisPicture.top-original.axisPicture.top)<=.2);
      for(const [i,p] of (original.axisPicture.pictures??[]).entries()){
       const q=moved.axisPicture.pictures[i];assert.equal(q.cellParaIndex,p.cellParaIndex);assert.equal(q.controlIndex,p.controlIndex);
       assert.equal(q.signature,p.signature);
       assert.ok(Math.abs(q.left-p.left)<=.2&&Math.abs(q.top-p.top)<=.2);
      }
     }
     await execute('edit:undo');assert.deepEqual((await snap()).structure,before);
     if(repeatPictures)await checkPicturePages(frame,[3,1],headings);
     await execute('edit:redo');assert.deepEqual((await snap()).structure,after);
     if(repeatPictures)await checkPicturePages(frame,[0,4],headings);
     await reopen(frame,'picture-axis-'+ext,ext);assert.deepEqual((await snap()).structure,after);
     if(pagedPictures)await checkPicturePages(frame,[0,4],headings);
     const saved=await state();assert.match(await send(groupedPictures?removeGrouped:multiplePictures?removePictures:removePicture),/그림/);assert.deepEqual(await state(),saved);
    });
    continue;
   }
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
