import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadReviewEngine} from '../scripts/lib/hancom-review.mjs';
import {executeDocumentOperations} from '../src/adapters/rhwp/execute.ts';
import {readStructure} from '../src/adapters/rhwp/structure.ts';
import {validateEditOperations,type EditOp,type Snapshot} from '../src/modules/document/public/index.ts';

const pkg=process.env.JUEONY_ENGINE_PACKAGE??fileURLToPath(new URL('../node_modules/@rhwp/core/',import.meta.url));
const {HwpDocument}=await loadReviewEngine(resolve(pkg));
const at=[0,1,0] as const;
const serialize=(d:any,format:string)=>format==='hwp'?d.exportHwp():d.exportHwpx();
const state=(d:any,format:string):Snapshot=>({name:'양식.'+format,revision:'1',nodes:[],limitations:[],structure:readStructure(d)});
function fixture(format:string,withInline:boolean){
 const d=HwpDocument.createEmpty();
 try{
  d.createBlankDocument();d.insertText(0,0,0,'본문');d.splitParagraph(0,0,2);d.createTable(...at,2,3);
  for(let i=0;i<6;i++){
   d.setCellProperties(...at,i,JSON.stringify({width:[5000,7000,9000][i%3],height:i<3?4000:6000}));
   d.insertTextInCell(...at,i,0,0,'원문'+i);
  }
  d.setCellProperties(...at,4,'{"fieldName":"결재란"}');
  if(withInline){
   d.insertClickHereFieldInCell(...at,5,0,0,false,'입력','결재 담당자','담당자',true);
   d.setFieldValueByName('담당자','김민수');
  }
  d.splitParagraph(0,1,d.getParagraphLength(0,1));d.createTable(0,2,0,1,1);
  d.insertClickHereFieldInCell(0,2,0,0,0,0,false,'상태','별도 표','확인',false);
  d.setFieldValueByName('확인','접수');
  return new HwpDocument(serialize(d,format));
 }finally{d.free();}
}
function apply(d:any,format:string,op:EditOp){
 const s=state(d,format);executeDocumentOperations(d,s,validateEditOperations([op],s));
}
function fields(d:any){
 return JSON.parse(d.getFieldList()).map(({fieldId,listId,...f}:any)=>f.cellField?f:{fieldId,...f});
}
const target='s0p1t0';
for(const format of ['hwp','hwpx']){
 test(format+' verifies outside named field IDs and their cursor list paths',()=>{
  for(const key of ['fieldId','listId']){
   const doc=fixture(format,true);
   try{
    doc.setCellProperties(0,2,0,0,'{"fieldName":"접수란"}');
    const before=serialize(doc,format),insert=doc.insertTableRow.bind(doc),list=doc.getFieldList.bind(doc);
    let edited=false;
    doc.insertTableRow=(...args:any[])=>{const result=insert(...args);edited=true;return result;};
    doc.getFieldList=()=>{
     const fields=JSON.parse(list());
     if(edited){const named=fields.find((f:any)=>f.name==='접수란');assert.ok(named);named[key]++;}
     return JSON.stringify(fields);
    };
    assert.throws(()=>apply(doc,format,{kind:'insert_table_row',target,index:1,values:['새 항목','','']}),/표 밖에 있는 필드/);
    assert.deepEqual(serialize(doc,format),before);
   }finally{doc.free();}
  }
 });
 test(format+' refuses removal of a named cell from an ordinary form table',()=>{
  const doc=fixture(format,false);
  try{
   const bytes=serialize(doc,format);
   for(const op of [{kind:'delete_table_row',target,index:1},{kind:'delete_table_column',target,index:1}] as const){
    assert.throws(()=>apply(doc,format,op),/필드/);assert.deepEqual(serialize(doc,format),bytes);
   }
  }finally{doc.free();}
 });
 test(format+' inserts a row above surviving ClickHere and named fields in a form table',()=>{
  const doc=fixture(format,true);
  try{
   const original=fields(doc),before=serialize(doc,format),undo=doc.saveSnapshot();
   const op:EditOp={kind:'insert_table_row',target,index:1,values:['새 항목','','']};
   const expected=structuredClone(original);
   for(const f of expected)if(f.location.paraIndex===1)f.location.path[0].cellIndex+=3;
   const neighbor=readStructure(doc).tables[1];
   function check(d:any){
    assert.deepEqual(fields(d),expected);
    const [t,other]=readStructure(d).tables;assert.deepEqual(other,neighbor);
    assert.deepEqual(t.cells.map(c=>[c.row,c.column,c.properties.width,c.properties.height,c.text]),
     Array.from({length:9},(_,i)=>[Math.floor(i/3),i%3,[5000,7000,9000][i%3],i<3?4000:6000,
      ['원문0','원문1','원문2','새 항목','','','원문3','원문4','김민수원문5'][i]]));
    assert.equal(t.cells[7].properties.fieldName,'결재란');
   }
   const doInsert=doc.insertTableRow.bind(doc);
   doc.insertTableRow=(...args:any[])=>{
    const result=doInsert(...args);doc.setFieldValueByName('확인','변경');return result;
   };
   assert.throws(()=>apply(doc,format,op),/표 밖에 있는 필드/);
   assert.deepEqual(serialize(doc,format),before);
   doc.insertTableRow=doInsert;
   apply(doc,format,op);check(doc);
   const saved=serialize(doc,format),reopened=new HwpDocument(saved);
   try{check(reopened);}finally{reopened.free();}
   const redo=doc.saveSnapshot();
   try{doc.restoreSnapshot(undo);assert.deepEqual(serialize(doc,format),before);
    doc.restoreSnapshot(redo);assert.deepEqual(serialize(doc,format),saved);}
   finally{doc.discardSnapshot(redo);doc.discardSnapshot(undo);}
  }finally{doc.free();}
 });
}
