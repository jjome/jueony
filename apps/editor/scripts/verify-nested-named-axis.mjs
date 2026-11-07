import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {loadReviewEngine} from './lib/hancom-review.mjs';
import {nestedNamedCellFixture} from './lib/nested-named-cell-fixture.mjs';
import {readStructure} from '../src/adapters/rhwp/structure.ts';
import {executeDocumentOperations} from '../src/adapters/rhwp/execute.ts';
import {validateEditOperations} from '../src/modules/document/public/index.ts';

const {HwpDocument}=await loadReviewEngine(resolve(process.env.JUEONY_ENGINE_PACKAGE)),fixture=nestedNamedCellFixture(HwpDocument);
const state=(d,ext)=>({revision:'v1',name:'이름 셀.'+ext,structure:readStructure(d),nodes:[],limitations:[]});
const fields=d=>JSON.parse(d.getFieldList());
const named=(d,owner)=>fields(d).find(f=>f.cellField&&f.location.path[0].cellIndex===owner);
function verifyFields(d){
 const all=fields(d);assert.equal(all.length,3);assert.equal(new Set(all.map(f=>f.fieldId)).size,3);
 assert.equal(all.find(f=>!f.cellField).fieldId,1);
 for(const [owner,text] of ['Alpha','Beta'].entries()){
  const field=named(d,owner);assert.equal(field.name,'공통 이름');assert.equal(field.value,text);
  assert.equal(field.startCharIdx,0);assert.equal(field.endCharIdx,text.length);
  assert.equal(JSON.parse(d.getFieldValue(field.fieldId)).value,text);
 }
}
try{
 for(const ext of ['hwp','hwpx']){
  const save=d=>ext==='hwp'?d.exportHwp():d.exportHwpx();
  for(const [kind,index,values,r,c,span] of [
   ['insert_table_row',0,['새 행','이름없는 새 셀'],1,1,2],['delete_table_row',0,null,0,1,1],
   ['insert_table_column',1,['가','나','다'],0,2,2],['delete_table_column',0,null,0,0,2]]){
   const d=new HwpDocument(save(fixture));
   try{
    verifyFields(d);
    const s=state(d,ext),[sibling,table]=s.structure.nestedTables,old=save(d),undo=d.saveSnapshot();
    assert.equal(table.axisEditable,true);assert.equal(table.cells[1].fieldName,'공통 이름');assert.equal(table.cells[1].editable,false);
    executeDocumentOperations(d,s,[{kind,target:table.id,index,...(values?{values}:{})}]);
    const bytes=save(d),copy=new HwpDocument(bytes);
    try{
     verifyFields(copy);const [other,edited]=readStructure(copy).nestedTables;
     assert.deepEqual(other,sibling);
     const field=named(copy,1),owner=edited.cells.find(v=>v.row===r&&v.column===c);
     assert.equal(owner.fieldName,field.name);assert.equal(owner.index,field.location.path.at(-1).cellIndex);
     assert.equal(owner.rowSpan,span);assert.equal(owner.text,'Beta\n둘째😀');
     assert.equal(edited.cells.filter(v=>v.fieldName).length,1);
     const path=JSON.stringify([...edited.ancestors,{controlIndex:edited.control,cellIndex:owner.index,cellParaIndex:1}]);
     assert.equal(JSON.parse(copy.getCellCharPropertiesAtByPath(edited.section,edited.paragraph,path,0)).bold,true);
     assert.equal(JSON.parse(copy.setFieldValue(field.fieldId,'새 첫 문단')).ok,true);
     assert.equal(named(copy,0).value,'Alpha');assert.equal(named(copy,1).value,'새 첫 문단');
     assert.equal(readStructure(copy).nestedTables[1].cells[owner.index].text,'새 첫 문단\n둘째😀');
    }finally{copy.free();}
    const redo=d.saveSnapshot();d.restoreSnapshot(undo);assert.deepEqual(save(d),old);
    d.restoreSnapshot(redo);assert.deepEqual(save(d),bytes);d.discardSnapshot(redo);d.discardSnapshot(undo);
    console.log('PASS',ext,kind,'named owner, stored ID reservation, sibling, undo/redo and reopen');
   }finally{d.free();}
  }
  const d=new HwpDocument(save(fixture));
  try{
   const s=state(d,ext),table=s.structure.nestedTables[1],path=JSON.stringify([...table.ancestors,{controlIndex:table.control,cellIndex:0,cellParaIndex:0}]),old=save(d);
   const op={kind:'delete_table_column',target:table.id,index:1};
   assert.throws(()=>validateEditOperations([op],s),/필드/);
   assert.throws(()=>d.editNestedTableAxis(table.section,table.paragraph,path,false,false,1));
   const valid={kind:'delete_table_row',target:table.id,index:0},edit=d.editNestedTableAxis.bind(d);
   d.editNestedTableAxis=(...args)=>{const res=edit(...args);d.setFieldValue(named(d,0).fieldId,'다른 값');return res;};
   assert.throws(()=>executeDocumentOperations(d,s,[valid]));assert.deepEqual(save(d),old);
   d.editNestedTableAxis=edit;
   const id=named(d,1).fieldId,lookup=d.getFieldValue.bind(d);
   d.getFieldValue=n=>n===id?'{"ok":true,"value":"Alpha"}':lookup(n);
   assert.ok(!state(d,ext).structure.nestedTables[1].axisEditable);d.getFieldValue=lookup;
   d.setCellProperties(table.section,table.paragraph,table.ancestors[0].controlIndex,1,'{"cellProtect":true}');
   assert.ok(!state(d,ext).structure.nestedTables[1].axisEditable);
   assert.throws(()=>d.editNestedTableAxis(table.section,table.paragraph,path,true,false,0));
   console.log('PASS',ext,'owner deletion, ID/value mismatch and protection refused; sibling fault rolled back');
  }finally{d.free();}
  const complex=new HwpDocument(save(fixture));
  try{
   const table=state(complex,ext).structure.nestedTables[1];
   const path=JSON.stringify([...table.ancestors,{controlIndex:table.control,cellIndex:1,cellParaIndex:0}]);
   complex.insertClickHereFieldByPath(table.section,table.paragraph,path,2,'안내','','안쪽 누름틀',true);
   const owner=named(complex,1);
   assert.deepEqual([owner.startCharIdx,owner.endCharIdx,owner.value],[0,4,'Beta']);
   const current=state(complex,ext).structure.nestedTables[1];
   assert.equal(current.axisEditable,true);assert.equal(current.cells[1].clickHereFieldIds.length,1);
   console.log('PASS',ext,'named-cell range remains the whole first paragraph with a separate inline field');
  }finally{complex.free();}
 }
}finally{fixture.free();}
