import {tableFormulaCall} from './table-formula-location.ts';
import type {AgentInsertTableFormulaOp,AgentTableFormulaFields,Receipt,Snapshot,TableFormulaChange} from '../../modules/document/public/types.ts';
import {agentFormulaInsertTarget} from '../../modules/document/public/engine-integration.ts';
import {nativeDocument,parsed,readStructure} from './structure.ts';
import {readTableFormulaFields} from './table-formula-fields.ts';

type Field=AgentTableFormulaFields['fields'][number];
const key=(f:Field)=>JSON.stringify([f.tableId,f.row,f.column,f.fieldId]);
const contents=(f:Field)=>({command:f.storedCommand,value:f.displayedValue});
function identity(f:Field) {
 const {editable,end,storedCommand,displayedValue,...definition}=f;
 return definition;
}

export function insertedTableFormulaReceipt(wasm:any,base:Snapshot,op:AgentInsertTableFormulaOp):NonNullable<Receipt['formulaField']> {
 const {table,cell,path}=agentFormulaInsertTarget(op,base),after=readTableFormulaFields(wasm);
 const original=base.tableFormulaFields!;
 if (!after || after.unresolved!==0 || after.fields.length!==original.fields.length+1)
  throw Error('저장할 계산식 필드 개수가 다릅니다.');
 const added=after.fields.find(f=>f.tableId===table.id&&f.row===cell.row&&f.column===cell.column);
 if(!added || added.section!==table.section || added.paragraph!==table.paragraph || JSON.stringify(added.path)!==JSON.stringify(path) ||
   added.start!==0 || added.end!==Array.from(added.displayedValue).length ||
   original.fields.some(f=>f.fieldId===added.fieldId) || added.expression!==op.formula || added.resultFormat!==op.resultFormat ||
   added.storedCommand!==op.formula+'??'+op.resultFormat+';;'+added.displayedValue)
  throw Error('새 계산식의 위치·ID·원문 또는 표시 결과가 예상과 다릅니다.');
 const siblings=new Map(after.fields.filter(f=>f!==added).map(f=>[key(f),f]));
 const dependents:TableFormulaChange[]=[];
 for(const old of original.fields) {
  const f=siblings.get(key(old));
  if(!f || JSON.stringify(identity(old))!==JSON.stringify(identity(f)) ||
     f.end!==old.end+Array.from(f.displayedValue).length-Array.from(old.displayedValue).length)
   throw Error('다른 계산식의 위치 또는 원문이 달라졌습니다.');
  if(f.storedCommand===old.storedCommand && f.displayedValue===old.displayedValue)continue;
  if(f.tableId!==table.id || !f.expression || !f.resultFormat || f.storedCommand!==f.expression+'??'+f.resultFormat+';;'+f.displayedValue)
   throw Error('같은 표에서 조회한 의존 계산식만 함께 변경할 수 있습니다.');
  dependents.push({tableId:f.tableId,row:f.row,column:f.column,fieldId:f.fieldId,before:contents(old),after:contents(f)});
 }
 return {tableId:table.id,row:cell.row,column:cell.column,fieldId:added.fieldId,
   before:{command:null,value:cell.text},after:contents(added),...(dependents.length?{dependents}:{})};
}

export function insertAgentTableFormula(wasm:any,base:Snapshot,op:AgentInsertTableFormulaOp) {
 const doc=nativeDocument(wasm),{table,cell,path}=agentFormulaInsertTarget(op,base);
 const structure=readStructure(doc),current=readTableFormulaFields(doc,true,true);
 const live=agentFormulaInsertTarget(op,{...base,structure,tableFormulaFields:current});
 if(table.section!==live.table.section || table.paragraph!==live.table.paragraph ||
    JSON.stringify(path)!==JSON.stringify(live.path) || JSON.stringify(table.cells)!==JSON.stringify(live.table.cells) ||
    JSON.stringify(current?.fields)!==JSON.stringify(base.tableFormulaFields?.fields))
  throw Error('계산식에 사용할 표의 원문·서식·필드가 변경되었습니다.');
 const result=parsed(tableFormulaCall(doc,'insertTableFormulaField',table.section,table.paragraph,path,cell.text,op.formula,op.resultFormat));
 const receipt=insertedTableFormulaReceipt(doc,base,op);
 if(result?.ok!==true || result.fieldId!==receipt.fieldId || result.command!==receipt.after.command ||
    result.value!==receipt.after.value || result.formula!==op.formula || !Number.isFinite(result.result) || !Array.isArray(result.dependentChanges))
  throw Error('엔진 응답과 실제 삽입한 계산식이 다릅니다.');
 const expected=(receipt.dependents??[]).map(f=>({
   fieldId:f.fieldId,cellIndex:table.cells.find(c=>c.row===f.row&&c.column===f.column)?.index,
   previousCommand:f.before.command,previousValue:f.before.value,command:f.after.command,value:f.after.value,
 }));
 if(result.dependentChanges.length!==expected.length ||
    expected.some(want=>!result.dependentChanges.some((actual:any)=>Object.entries(want).every(([k,v])=>actual?.[k]===v))))
  throw Error('같이 변경한 의존 계산식 결과가 다릅니다.');
 return {sectionIndex:table.section,parentParaIndex:table.paragraph,paragraphIndex:0,controlIndex:path[0].controlIndex,
   cellIndex:path[0].cellIndex,cellParaIndex:path[0].cellParaIndex,cellPath:path,charOffset:Array.from(receipt.after.value).length};
}
