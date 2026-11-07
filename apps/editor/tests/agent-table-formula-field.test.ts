import test from 'node:test';
import assert from 'node:assert/strict';
import {validateEditOperations} from '../src/modules/document/public/index.ts';

const scope=()=>({
 name:'fixture.hwpx',revision:'1',limitations:[],nodes:[],
 structure:{sections:[],paragraphs:[],unsupportedControls:[],tables:[{
  id:'s0p0t2',editable:true,section:0,paragraph:0,control:2,rows:1,columns:1,
  cells:[{index:0,row:0,column:0,rowSpan:1,columnSpan:1,text:'10',editable:false,properties:{cellProtect:false}}],
 }]},
 tableFormulaFields:{unresolved:0,canEdit:true,canRefreshDependents:false,fields:[{
  tableId:'s0p0t2',fieldId:123,section:0,paragraph:0,path:[{controlIndex:2,cellIndex:0,cellParaIndex:0}],row:0,column:0,
  storedCommand:'=4+6??%g;;10',displayedValue:'10',editable:true,start:0,end:2,
 }]},
});
const op={kind:'update_table_formula_field',target:'s0p0t2',row:0,column:0,fieldId:123,originalCommand:'=4+6??%g;;10',formula:'=4+7',resultFormat:'%.2f,'};
test('one queried native field can be edited while ordinary cell text remains protected',()=>{
 const base=scope();assert.deepEqual(validateEditOperations([op],base),[op]);
 assert.throws(()=>validateEditOperations([{kind:'set_table_cell',target:op.target,row:0,column:0,originalText:'10',text:'11'}],base));
});
test('stale, injected, malformed and batched formula commands fail before execution',()=>{
 for(const override of [{row:1},{row:-1},{target:'alias'},{fieldId:44},{originalCommand:'stale'},{formula:'='},{formula:'=1\n+2'},
  {formula:'=1;;field metadata'},{formula:'=1??%g'},{formula:'='+'1'.repeat(512)},{formula:'='+'가'.repeat(171)},{resultFormat:'%n'},{unsafe:true}]){
  assert.throws(()=>validateEditOperations([{...op,...override}],scope()));
 }
 assert.throws(()=>validateEditOperations([op,op],scope()));
});
test('unavailable native capabilities, changed addresses, protection, duplicate labels and nested fields fail',()=>{
 for(const change of [
  (s:ReturnType<typeof scope>)=>{s.tableFormulaFields.canEdit=false;},
  (s:ReturnType<typeof scope>)=>{s.tableFormulaFields.fields[0].editable=false;},
  (s:ReturnType<typeof scope>)=>{s.structure.tables[0].editable=false;},
  (s:ReturnType<typeof scope>)=>{s.structure.tables[0].cells[0].properties.cellProtect=true;},
  (s:ReturnType<typeof scope>)=>{s.tableFormulaFields.fields[0].path[0].cellIndex=9;},
  (s:ReturnType<typeof scope>)=>{s.tableFormulaFields.fields.push(structuredClone(s.tableFormulaFields.fields[0]));},
  (s:ReturnType<typeof scope>)=>{s.tableFormulaFields.fields[0].path.push({controlIndex:0,cellIndex:0,cellParaIndex:0});},
 ]){const base=scope();change(base);assert.throws(()=>validateEditOperations([op],base));}
});
