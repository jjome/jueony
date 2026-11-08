import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createAxisPictureFixture,inspectPictureAnchors} from './lib/axis-picture-fixture.mjs';
import {createRepeatedTitlePictures,expectedPictureHeading} from './lib/repeated-picture-heading.mjs';
import {loadReviewEngine} from './lib/hancom-review.mjs';
import {readStructure} from '../src/adapters/rhwp/structure.ts';
import {executeDocumentOperations} from '../src/adapters/rhwp/execute.ts';
import {validateEditOperations} from '../src/modules/document/public/index.ts';

const {HwpDocument}=await loadReviewEngine(resolve(process.env.JUEONY_ENGINE_PACKAGE));
const paragraphs=process.argv.includes('--paragraphs');
const transformed=process.argv.includes('--cropped-flipped');
const bands=process.argv.includes('--merged-headings'),headerRows=bands?2:1;
const expectedTitle=expectedPictureHeading(bands,paragraphs);
const out=resolve(process.env.JUEONY_TEST_OUTPUT??resolve(import.meta.dirname,'../../../build/'+(bands?'axis-repeat-header-bands':paragraphs?'axis-repeat-header-paragraphs':'axis-repeat-picture-header')));
await mkdir(out,{recursive:true});
const base=[0,1,0],op={kind:'insert_table_row',target:'s0p1t0',index:headerRows+1,values:['새 행','','']};
const raw=(file,kind)=>JSON.parse(execFileSync('python',[resolve(import.meta.dirname,'lib/inspect-axis-picture.py'),kind,file,String(headerRows)],{encoding:'utf8'}));
const bytes=(d,format)=>format==='hwp'?d.exportHwp():d.exportHwpx();
function apply(d,format,operation=op){
 const snapshot={name:'제품표.'+format,nodes:[],limitations:[],revision:'1',structure:readStructure(d)};
 executeDocumentOperations(d,snapshot,validateEditOperations([operation],snapshot));
}
function layout(d){
 assert.equal(d.pageCount(),2);
 return [0,1].map(i=>{
  const controls=JSON.parse(d.getPageControlLayout(i)).controls,table=controls.find(c=>c.type==='table');
  assert.deepEqual(table.cells.filter(c=>c.row<headerRows).map(c=>[c.row,c.col,c.rowSpan,c.colSpan]),
   expectedTitle.map(c=>[c.row,c.col,c.rowSpan,c.colSpan]));
  const runs=JSON.parse(d.getPageTextLayout(i)).runs;
  for(const [cell,{paragraphs:parts}] of expectedTitle.entries()){
   const actual=runs.filter(r=>r.cellPath?.[0]?.cellIndex===cell);
   assert.deepEqual([...new Set(actual.map(r=>r.cellParaIdx))],parts.map((_,i)=>i));
   assert.deepEqual(parts.map((_,p)=>actual.filter(r=>r.cellParaIdx===p).map(r=>r.text).join('')),parts);
  }
  return controls.filter(c=>c.type==='image').length;
 });
}
if(process.argv.includes('--title-pictures')){
 const fixture=await createRepeatedTitlePictures(HwpDocument,out),results=[];
 const view=d=>{
  assert.equal(d.pageCount(),2);
  assert.equal(JSON.parse(d.getControls()).filter(c=>c.ctrlId==='gso').length,4);
  const t=readStructure(d).tables[0],title=t.cells.find(c=>c.text==='PicA');
  assert.equal(t.cells.filter(c=>c.axisPicture).length,4);assert.ok(title.axisPicture);
  return [0,1].map(page=>{
   const controls=JSON.parse(d.getPageControlLayout(page)).controls;
   const pictures=controls.filter(c=>c.type==='image'),copies=pictures.filter(c=>c.cellPath?.[0]?.cellIndex===title.index);
   assert.equal(copies.length,1);assert.equal(copies[0].controlIdx,0);
   assert.deepEqual(copies[0].cellPath,[{controlIndex:0,cellIndex:title.index,cellParaIndex:0}]);
   return pictures.length;
  });
 };
 try{for(const format of ['hwp','hwpx']){
  const d=new HwpDocument(bytes(fixture,format));let original;
  try{
   original=bytes(d,format);const file=resolve(out,'before.'+format);await writeFile(file,original);
   const records=inspectPictureAnchors(file);assert.equal(records.length,4);assert.deepEqual(view(d),[2,3]);
   const operations=[{kind:'insert_table_row',target:'s0p1t0',index:2,values:['새 행','','']},
    {kind:'insert_table_column',target:'s0p1t0',index:0,values:['새 제목','','','','']},
    {kind:'delete_table_column',target:'s0p1t0',index:0},{kind:'delete_table_row',target:'s0p1t0',index:2}];
   let rowDelta=0,colDelta=0;
   for(const [stage,operation] of operations.entries()){
    const before=bytes(d,format),undo=d.saveSnapshot();apply(d,format,operation);
    rowDelta+=stage===0?1:stage===3?-1:0;colDelta+=stage===1?1:stage===2?-1:0;
    assert.deepEqual(view(d),stage===3?[2,3]:[1,4]);
    const after=resolve(out,operation.kind+'.'+format),saved=bytes(d,format);await writeFile(after,saved);
    assert.deepEqual(inspectPictureAnchors(after),records.map(p=>({...p,row:p.row+(p.row>=2?rowDelta:0),col:p.col+colDelta})));
    const copy=new HwpDocument(saved);
    try{assert.deepEqual(view(copy),view(d));assert.deepEqual(readStructure(copy),readStructure(d));}finally{copy.free();}
    const redo=d.saveSnapshot();d.restoreSnapshot(undo);assert.deepEqual(bytes(d,format),before);
    d.restoreSnapshot(redo);assert.deepEqual(bytes(d,format),saved);d.discardSnapshot(undo);d.discardSnapshot(redo);
   }
  }finally{d.free();}
  const faults=['wrong repeated path','duplicate repeated picture','wrong repeated paint','changed title style','new header flag','new header text'];
  for(const fault of faults){
   const d=new HwpDocument(original);let wrote=false;
   try{
    const column=fault.startsWith('new header'),method=column?'insertTableColumn':'insertTableRow',edit=d[method].bind(d);
    d[method]=(...args)=>{const r=edit(...args);wrote=true;
     if(fault==='new header flag')d.setCellProperties(...base,0,'{"isHeader":false}');
     if(fault==='new header text')d.insertTextInCell(...base,0,0,0,'불청객');return r;};
    if(fault==='wrong repeated path'||fault==='duplicate repeated picture'){
     const read=d.getPageControlLayout.bind(d);d.getPageControlLayout=page=>{
      const value=JSON.parse(read(page));if(wrote&&page===1){const p=value.controls.find(c=>c.type==='image'&&c.cellIdx===1);
       if(fault==='wrong repeated path')p.cellPath[0].cellIndex=0;else value.controls.push({...p,x:p.x+25});}return JSON.stringify(value);};
    }
    if(fault==='wrong repeated paint'){
     const read=d.getPageFlowImageOps.bind(d);d.getPageFlowImageOps=page=>{const value=JSON.parse(read(page));
      if(wrote&&page===1)value.images[0].transform.horzFlip=!value.images[0].transform.horzFlip;return JSON.stringify(value);};
    }
    if(fault==='changed title style'){
     const read=d.getPageTextLayout.bind(d);d.getPageTextLayout=page=>{const value=JSON.parse(read(page));
      if(wrote)for(const r of value.runs)if(r.cellIdx===0)r.bold=!r.bold;return JSON.stringify(value);};
    }
    const before=bytes(d,format);
    assert.throws(()=>apply(d,format,column?{kind:'insert_table_column',target:'s0p1t0',index:0,values:['새 제목','','','']}:
     {kind:'insert_table_row',target:'s0p1t0',index:2,values:['새 행','','']}),/그림|제목|보존/);
    assert.ok(wrote);assert.deepEqual(bytes(d,format),before);
   }finally{d.free();}
  }
  results.push({format,operations:4,rollbackFaults:faults.length,storedPictures:4,displayedPictures:5});
  console.log('PASS',format,'repeated source picture row/column insert/delete, native slots/resources, reopen, undo/redo and',faults.length,'rollback faults');
 }}finally{fixture.free();}
 await writeFile(resolve(out,'result.json'),JSON.stringify({results,engine:JSON.parse(await readFile(resolve(process.env.JUEONY_ENGINE_PACKAGE,'jueony-engine-build.json'),'utf8'))},null,2));
 process.exit(0);
}
const fixture=await createAxisPictureFixture(HwpDocument,out,{merged:true,grouped:true});
try{
 fixture.insertTableRow(...base,1,false);
 if(paragraphs){
  fixture.splitParagraphInCell(...base,0,0,1);
  fixture.deleteTextInCell(...base,1,0,0,fixture.getCellParagraphLength(...base,1,0));
 }
 for(const index of [0,1,2])fixture.setCellProperties(...base,index,JSON.stringify({height:paragraphs?3900:1800,isHeader:true}));
 for(const index of [3,4,5])fixture.setCellProperties(...base,index,'{"height":3000}');
 if(bands){
  fixture.insertTableRow(...base,1,false);
  for(let i=0;i<6;i++){
   fixture.setCellProperties(...base,i,'{"isHeader":true,"height":2100}');
   if(i>=3)fixture.insertTextInCell(...base,i,0,0,'계'+i);
  }
  fixture.mergeTableCells(...base,0,1,0,2);
  fixture.mergeTableCells(...base,0,0,1,0);
 }
 fixture.setPageDef(0,JSON.stringify({...JSON.parse(fixture.getPageDef(0)),height:bands?24500:paragraphs?23000:21000,marginTop:2000,marginBottom:2000,marginHeader:0,marginFooter:0}));
 fixture.setTableProperties(...base,'{"pageBreak":2,"repeatHeader":true}');
 if(transformed){
  const controls=JSON.parse(fixture.getControls()).filter(c=>c.userDesc==='그림');
  const lists=JSON.parse(fixture.getCursorModel()).lists;
  for(const [i,c] of controls.entries()){
   const owner=lists.find(l=>l.listId===c.list);
   const path=JSON.stringify([{controlIndex:0,cellIndex:owner.cellIndex,cellParaIndex:c.para}]);
   fixture.setCellPicturePropertiesByPath(0,1,path,c.controlIndex,JSON.stringify({
    cropLeft:225,cropRight:450,cropTop:150,cropBottom:225,horzFlip:i%2===0,vertFlip:i%2===1
   }));
  }
 }
 for(const format of ['hwp','hwpx']){
  const source=resolve(out,'before.'+format),original=bytes(fixture,format);await writeFile(source,original);
  const d=new HwpDocument(original);
  try{
   assert.deepEqual(layout(d),[3,1]);const initial=readStructure(d).tables[0];
   assert.equal(initial.cells.filter(c=>c.axisPicture).length,2);
   apply(d,format);assert.deepEqual(layout(d),[0,4]);
   const after=resolve(out,'insert_table_row.'+format);await writeFile(after,bytes(d,format));
   assert.deepEqual(raw(after,'inspect-title'),raw(source,'inspect-title'));
   assert.deepEqual(raw(after,'inspect-grouped'),raw(source,'inspect-grouped').map(p=>({...p,row:p.row+1})));
   const copy=new HwpDocument(await readFile(after));
   try{assert.deepEqual(layout(copy),[0,4]);assert.deepEqual(readStructure(copy),readStructure(d));}finally{copy.free();}
   console.log('PASS',format,headerRows,'stored title rows, two copies on screen, four pictures, original records/bytes, reopen');
  }finally{d.free();}
  const modes=format==='hwp'?['wrong source','missing title','inherited header','field in title']:['changed label','crop','lost repeat flag','changed title style'];
  if(paragraphs)modes.push(format==='hwp'?'missing empty paragraph':'wrong paragraph');
  if(bands)modes.push(format==='hwp'?'unmarked header slot':'wrong repeated span');
  if(transformed)modes.push('wrong paint crop','wrong paint flip','lost picture crop');
  for(const mode of modes){
   const d=new HwpDocument(original);
   try{
    if(mode==='lost picture crop'){
     const insert=d.insertTableRow.bind(d);d.insertTableRow=(...args)=>{
      const result=insert(...args),child=JSON.parse(d.getControls()).find(c=>c.userDesc==='그림');
      const owner=JSON.parse(d.getCursorModel()).lists.find(l=>l.listId===child.list);
      const path=JSON.stringify([{controlIndex:0,cellIndex:owner.cellIndex,cellParaIndex:child.para}]);
      d.setCellPicturePropertiesByPath(0,1,path,child.controlIndex,'{"cropLeft":0}');
      return result;
     };
    }
    if(mode==='wrong paint crop'||mode==='wrong paint flip'){
     const read=d.getPageFlowImageOps.bind(d);d.getPageFlowImageOps=page=>{
      const view=JSON.parse(read(page));
      if(view.images.length){
       if(mode==='wrong paint crop')view.images[0].crop.left+=75;
       else view.images[0].transform.horzFlip=!view.images[0].transform.horzFlip;
      }
      return JSON.stringify(view);
     };
    }
    if(mode==='field in title')d.insertClickHereFieldInCell(...base,0,0,0,false,'입력','번호','번호',true);
    if(mode==='unmarked header slot')d.setCellProperties(...base,2,'{"isHeader":false}');
    if(mode==='wrong repeated span'){
     const read=d.getPageControlLayout.bind(d);d.getPageControlLayout=page=>{
      const view=JSON.parse(read(page));
      if(page===1)view.controls.find(c=>c.type==='table').cells[0].rowSpan=1;
      return JSON.stringify(view);
     };
    }
    if(mode==='missing empty paragraph'||mode==='wrong paragraph'){
     const read=d.getPageTextLayout.bind(d);d.getPageTextLayout=page=>{
      const view=JSON.parse(read(page));
      if(page===1){
       if(mode==='missing empty paragraph')view.runs=view.runs.filter(r=>r.cellPath?.[0]?.cellIndex!==1);
       else view.runs.find(r=>r.cellPath?.[0]?.cellIndex===0&&r.cellParaIdx===1).cellPath[0].cellParaIndex=0;
      }
      return JSON.stringify(view);
     };
    }
    if(mode==='wrong source'||mode==='changed label'){
     const read=d.getPageTextLayout.bind(d);d.getPageTextLayout=page=>{
      const view=JSON.parse(read(page)),run=view.runs.find(r=>r.cellPath?.[0]?.cellIndex===2);
      if(page===1){if(mode==='wrong source')run.cellPath[0].cellIndex=1;else run.text='PicZ';}
      return JSON.stringify(view);
     };
    }
    if(mode==='missing title'||mode==='crop'){
     const read=d.getPageControlLayout.bind(d);d.getPageControlLayout=page=>{
      const view=JSON.parse(read(page)),t=view.controls.find(c=>c.type==='table');
      if(page===1){if(mode==='missing title')t.cells.splice(1,1);else t.cells[1].h-=2;}
      return JSON.stringify(view);
     };
    }
    if(mode==='lost repeat flag'){
     const insert=d.insertTableRow.bind(d);d.insertTableRow=(...args)=>{
      const result=insert(...args);d.setTableProperties(...base,'{"repeatHeader":false}');return result;
     };
    }
    if(mode==='changed title style'){
     const insert=d.insertTableRow.bind(d),read=d.getPageTextLayout.bind(d);
     let changed=false;
     d.insertTableRow=(...args)=>{const result=insert(...args);changed=true;return result;};
     d.getPageTextLayout=page=>{
      const view=JSON.parse(read(page));
      if(changed)for(const r of view.runs)if(r.cellPath?.[0]?.cellIndex===2)r.bold=!r.bold;
      return JSON.stringify(view);
     };
    }
    const before=bytes(d,format);
    assert.throws(()=>apply(d,format,mode==='inherited header'?{...op,index:0}:op),/그림|필드|보존|제목/,mode);
    assert.deepEqual(bytes(d,format),before);
   }finally{d.free();}
  }
  console.log('PASS',format,'original bytes on refusal:',modes.join(', '));
 }
}finally{fixture.free();}
