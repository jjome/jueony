import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {loadReviewEngine} from './lib/hancom-review.mjs';
import {readOwnedZip,writeOwnedZip} from './lib/owned-zip.mjs';
import {readStructure} from '../src/adapters/rhwp/structure.ts';
import {executeDocumentOperations} from '../src/adapters/rhwp/execute.ts';

const {HwpDocument}=await loadReviewEngine(resolve(process.env.JUEONY_ENGINE_PACKAGE));
const source=HwpDocument.createEmpty();
source.createBlankDocument();source.insertText(0,0,0,'업무 계획');source.splitParagraph(0,0,5);
const inner='<table><tr><td rowspan="2">A</td><td colspan="2">B</td></tr><tr><td>C</td><td>D</td></tr><tr><td>E</td><td>F</td><td>G</td></tr></table>';
source.pasteHtml(0,1,0,'<table><tr><td>왼쪽'+inner+'</td><td>오른쪽'+inner+'</td></tr></table>');
const path=(t,i,p=0)=>JSON.stringify([...t.ancestors,{controlIndex:t.control,cellIndex:i,cellParaIndex:p}]);
const [left,right]=readStructure(source).nestedTables,at=[right.section,right.paragraph];
source.splitParagraphInCellByPath(...at,path(right,0),1);
source.insertTextInCellByPath(...at,path(right,0,1),0,'보존😀');
source.applyCharFormatInCellByPath(...at,path(right,0,1),1,3,'{"italic":true}');
const cases=[
 ['insert_table_row',1,['','X','Y'],['0,0,3,1,A','0,1,1,2,B','1,1,1,1,X','1,2,1,1,Y','2,1,1,1,C','2,2,1,1,D','3,0,1,1,E','3,1,1,1,F','3,2,1,1,G']],
 ['delete_table_row',0,null,['0,0,1,1,A','0,1,1,1,C','0,2,1,1,D','1,0,1,1,E','1,1,1,1,F','1,2,1,1,G']],
 ['insert_table_column',2,['','X','Y'],['0,0,2,1,A','0,1,1,3,B','1,1,1,1,C','1,2,1,1,X','1,3,1,1,D','2,0,1,1,E','2,1,1,1,F','2,2,1,1,Y','2,3,1,1,G']],
 ['delete_table_column',1,null,['0,0,2,1,A','0,1,1,1,B','1,1,1,1,D','2,0,1,1,E','2,1,1,1,G']],
];
const state=(d,format)=>({name:'중첩 병합.'+format,revision:'v1',structure:readStructure(d),nodes:[],limitations:[]});
const signature=c=>[c.row,c.column,c.rowSpan,c.columnSpan,c.text[0]].join(',');
function guardedFixture(mode){
 if(mode==='control'){
  const doc=HwpDocument.createEmpty();doc.createBlankDocument();doc.splitParagraph(0,0,0);
  const child=inner.replace('G</td>','G<table><tr><td>더 안쪽</td></tr></table></td>');
  doc.pasteHtml(0,1,0,'<table><tr><td>왼쪽'+inner+'</td><td>오른쪽'+child+'</td></tr></table>');
  assert.equal(readStructure(doc).nestedTables.length,3);
  return doc;
 }
 const bytes=source.exportHwpx();
 if(mode==='zone'){
  const parts=readOwnedZip(bytes),part=parts.find(([k])=>k==='Contents/section0.xml');
  const xml=part[1].toString('utf8'),start=xml.lastIndexOf('<hp:tbl '),firstRow=xml.indexOf('<hp:tr>',start);
  assert.ok(start>=0&&firstRow>start);
  const zone='<hp:cellzoneList><hp:cellzone startRowAddr="0" startColAddr="0" endRowAddr="1" endColAddr="1" borderFillIDRef="1"/></hp:cellzoneList>';
  part[1]=Buffer.from(xml.slice(0,firstRow)+zone+xml.slice(firstRow));
  return new HwpDocument(writeOwnedZip(parts));
 }
 const doc=new HwpDocument(bytes);
 if(mode==='protect')doc.setCellProperties(...at,right.ancestors[0].controlIndex,1,'{"cellProtect":true}');
 if(mode==='formula')doc.insertTableFormulaFieldByPath(...at,path(right,6),'G','=4','%g');
 return doc;
}
try{
 for(const format of ['hwp','hwpx']){
  const save=d=>format==='hwp'?d.exportHwp():d.exportHwpx(),open=()=>new HwpDocument(save(source));
  for(const [kind,index,values,expected] of cases){
   const doc=open();
   try{
    const s=state(doc,format),[sibling,table]=s.structure.nestedTables,old=save(doc),undo=doc.saveSnapshot();
    assert.equal(table.axisEditable,true);
    const properties=(d,t,c)=>JSON.parse(d.getCellPropertiesByPath(...at,path(t,c.index),c.index));
    const single=properties(doc,table,table.cells[2]);
    executeDocumentOperations(doc,s,[{kind,target:table.id,index,...(values?{values}:{})}]);
    const saved=save(doc),reopened=new HwpDocument(saved);
    try{
     const result=readStructure(reopened),[unchanged,edited]=result.nestedTables;
     assert.deepEqual(unchanged,sibling);assert.deepEqual(result.tables,s.structure.tables);
     assert.deepEqual(edited.cells.map(signature),expected);
     for(const c of edited.cells){
      const props=properties(reopened,edited,c);
      assert.equal(props.width,single.width*c.columnSpan);assert.equal(props.height,single.height*c.rowSpan);
     }
     assert.equal(edited.cells[0].text,'A\n보존😀');
     assert.equal(JSON.parse(reopened.getCellCharPropertiesAtByPath(...at,path(edited,0,1),1)).italic,true);
    }finally{reopened.free();}
    const redo=doc.saveSnapshot();doc.restoreSnapshot(undo);assert.deepEqual(save(doc),old);
    doc.restoreSnapshot(redo);assert.deepEqual(save(doc),saved);
    doc.discardSnapshot(redo);doc.discardSnapshot(undo);
    console.log('PASS',format,kind,'merged owners, dimensions, sibling, save and undo/redo');
   }finally{doc.free();}
  }
  const doc=open();
  try{
   // The last row has conflicting stored heights. Column removal does not
   // materialize row heights; a new column or changed row would have to.
   doc.resizeTableCellsByPath(...at,path(right,0),'[{"cellIdx":5,"heightDelta":200}]');
   const s=state(doc,format),table=s.structure.nestedTables[1],baseline=save(doc),target=table.id;
   assert.equal(table.axisEditable,true);
   for(const op of [{kind:'insert_table_column',target,index:2,values:['','X','Y']},{kind:'delete_table_row',target,index:1}]){
    assert.throws(()=>executeDocumentOperations(doc,s,[op]));assert.deepEqual(save(doc),baseline);
    assert.throws(()=>doc.editNestedTableAxis(...at,path(right,0),op.kind.endsWith('_row'),op.kind.startsWith('insert_'),op.index));
   }
   executeDocumentOperations(doc,s,[{kind:'delete_table_column',target,index:1}]);
   const reopened=new HwpDocument(save(doc));
   try{assert.deepEqual(readStructure(reopened).nestedTables[1].cells.map(signature),cases[3][3]);}finally{reopened.free();}
   console.log('PASS',format,'only operations needing the unverified row heights are refused');
  }finally{doc.free();}
  const fault=open();
  try{
   const s=state(fault,format),target=right.id,old=save(fault),op={kind:'insert_table_row',target,index:1,values:['','X','Y']};
   assert.throws(()=>executeDocumentOperations(fault,s,[{...op,values:['covered','X','Y']}]),/병합/);
   const native=fault.editNestedTableAxis.bind(fault);
   fault.editNestedTableAxis=(...args)=>{const result=native(...args);fault.insertTextInCellByPath(...at,path(left,0),0,'!');return result;};
   assert.throws(()=>executeDocumentOperations(fault,s,[op]),/이웃/);assert.deepEqual(save(fault),old);
   console.log('PASS',format,'covered input refusal and rollback of sibling damage');
  }finally{fault.free();}
  for(const mode of ['protect','control','formula','zone']){
   const model=guardedFixture(mode),doc=new HwpDocument(save(model));model.free();
   try{
    const s=state(doc,format),table=s.structure.nestedTables.find(t=>t.id===right.id),old=save(doc);
    assert.ok(!table.axisEditable,mode);
    assert.throws(()=>executeDocumentOperations(doc,s,[{kind:'delete_table_row',target:table.id,index:0}]),undefined,mode);
    assert.throws(()=>doc.editNestedTableAxis(...at,path(right,0),true,false,0),undefined,mode);
    assert.deepEqual(save(doc),old);
   }finally{doc.free();}
  }
  console.log('PASS',format,'protected ancestor, nested control, stored formula and cell zone refuse before mutation');
 }
}finally{source.free();}
