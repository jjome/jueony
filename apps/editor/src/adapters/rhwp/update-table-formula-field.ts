import {tableFormulaCall} from './table-formula-location.ts';
import type {AgentTableFormulaFields,AgentTableFormulaOp,Receipt,Snapshot,TableFormulaChange} from '../../modules/document/public/types.ts';
import {agentTableFormulaTarget} from '../../modules/document/public/engine-integration.ts';
import {parsed,readStructure} from './structure.ts';
import {readTableFormulaFields} from './table-formula-fields.ts';

type Field=AgentTableFormulaFields['fields'][number];
type Result={command:string;value:string;expression:string;resultFormat:string};

function change(before:Field,after:Field):TableFormulaChange {
 return {tableId:before.tableId,row:before.row,column:before.column,fieldId:before.fieldId,
  before:{command:before.storedCommand,value:before.displayedValue},after:{command:after.storedCommand,value:after.displayedValue}};
}

export function tableFormulaReceipt(doc:any,base:Snapshot,op:AgentTableFormulaOp):NonNullable<Receipt['formulaField']> {
 const {field}=agentTableFormulaTarget(op,base),original=base.tableFormulaFields!,after=readTableFormulaFields(doc);
 if(!after || after.fields.length!==original.fields.length || after.unresolved!==original.unresolved)throw Error('조판 후 계산식 필드 목록이 다릅니다.');
 const dependents:TableFormulaChange[]=[];
 let target:TableFormulaChange|undefined;
 for(const [index,before] of original.fields.entries()){
  const actual=after.fields[index];
  if(before.tableId!==actual.tableId || before.fieldId!==actual.fieldId || before.row!==actual.row || before.column!==actual.column)throw Error('조판 후 계산식의 위치가 달라졌습니다.');
  if(before===field){
   if(actual.expression!==op.formula || actual.resultFormat!==op.resultFormat ||
      actual.storedCommand!==op.formula+'??'+op.resultFormat+';;'+actual.displayedValue)throw Error('조판 후 계산식의 원문과 결과가 달라졌습니다.');
   target=change(before,actual);
  }else if(before.storedCommand!==actual.storedCommand || before.displayedValue!==actual.displayedValue){
   if(before.tableId!==field.tableId || before.expression!==actual.expression || before.resultFormat!==actual.resultFormat)throw Error('다른 계산식의 원문 또는 서식이 달라졌습니다.');
   dependents.push(change(before,actual));
  }
 }
 if(!target)throw Error('변경한 계산식 필드를 찾지 못했습니다.');
 return dependents.length?{...target,dependents}:target;
}

/** Only native-planned changes to an identified, current field's cache may
 * accompany the target. The dependent's own expression and format must survive. */
function expectedFields(preview:any,target:Field,base:AgentTableFormulaFields,live:AgentTableFormulaFields,op:AgentTableFormulaOp){
 const expected=new Map<Field,Result>();
 expected.set(target,{command:preview.command,value:preview.value,expression:op.formula,resultFormat:op.resultFormat});
 const dependencies=preview.dependentChanges===undefined?[]:preview.dependentChanges;
 if(!Array.isArray(dependencies)||dependencies.length>live.fields.length)throw Error('의존 계산식 목록을 확인할 수 없습니다.');
 for(const item of dependencies){
  const field=live.fields.find(f=>f.tableId===target.tableId && f.fieldId===item?.fieldId && f.path.at(-1)?.cellIndex===item.cellIndex);
  const original=base.fields.find(f=>f.tableId===target.tableId && f.fieldId===item?.fieldId && f.path.at(-1)?.cellIndex===item.cellIndex);
  if(!field||!original||expected.has(field)||!field.expression||!field.resultFormat||field.storedCommand!==item.previousCommand||
    field.displayedValue!==item.previousValue||original.storedCommand!==item.previousCommand||original.displayedValue!==item.previousValue||
    typeof item.value!=='string'||item.command!==field.expression+'??'+field.resultFormat+';;'+item.value)
    throw Error('의존 계산식의 셀·원문·표시값이 달라졌습니다.');
  expected.set(field,{command:item.command,value:item.value,expression:field.expression,resultFormat:field.resultFormat});
 }
 return expected;
}

/** The engine is the only formula parser/writer. Compare the native preview,
 * updated field and sibling fields inside the existing editor transaction. */
export function updateTableFormulaField(doc:any,base:Snapshot,op:AgentTableFormulaOp) {
 const {field}=agentTableFormulaTarget(op,base);
 const current=readTableFormulaFields(doc,true),structure=readStructure(doc);
 const live=agentTableFormulaTarget(op,{...base,structure,tableFormulaFields:current}).field;
 if(JSON.stringify(live)!==JSON.stringify(field))throw Error('계산식 필드가 변경되었습니다. 현재 문서를 다시 조회하세요.');
 const owner=field.path[0],leaf=field.path.at(-1)!,args=[field.section,field.paragraph,field.path,field.fieldId,field.storedCommand,op.formula,op.resultFormat] as const;
 const preview=parsed(tableFormulaCall(doc,'previewTableFormulaField',...args));
 if(preview?.ok!==true || preview.fieldId!==field.fieldId || preview.formula!==op.formula || typeof preview.value!=='string' ||
    preview.command!==op.formula+'??'+op.resultFormat+';;'+preview.value || !Number.isFinite(preview.result))throw Error('계산식 원문과 표시 결과를 확인하지 못했습니다.');
 const expected=expectedFields(preview,live,base.tableFormulaFields!,current!,op);
 if(![...expected].some(([f,v])=>v.command!==f.storedCommand || v.value!==f.displayedValue))throw Error('계산식과 계산 결과가 현재 값과 같습니다.');
 const result=parsed(tableFormulaCall(doc,'updateTableFormulaField',...args));
 if(result?.ok!==true || result.fieldId!==preview.fieldId || result.command!==preview.command || result.formula!==preview.formula || result.value!==preview.value || result.result!==preview.result ||
    JSON.stringify(result.dependentChanges)!==JSON.stringify(preview.dependentChanges))
   throw Error('계산식 필드 변경이 검증된 예상 결과와 다릅니다.');
 const after=readTableFormulaFields(doc,false);
 if(!after || !current || after.fields.length!==current.fields.length || after.unresolved!==current.unresolved)throw Error('변경 후 계산식 필드 목록이 다릅니다.');
 for(const [i,old] of current.fields.entries()){
  const {editable:_before,...original}=old,{editable:_after,...actual}=after.fields[i];
  const next=expected.get(old);
  const verified=next?{...original,storedCommand:next.command,displayedValue:next.value,
    expression:next.expression,resultFormat:next.resultFormat,end:original.start+Array.from(next.value).length}:original;
  if(JSON.stringify(actual)!==JSON.stringify(verified))throw Error('저장할 수식 원문·표시 값·다른 계산식 필드가 예상과 다릅니다.');
 }
 return {sectionIndex:field.section,parentParaIndex:field.paragraph,paragraphIndex:leaf.cellParaIndex,controlIndex:owner.controlIndex,cellIndex:owner.cellIndex,
   cellParaIndex:owner.cellParaIndex,cellPath:field.path,charOffset:field.start+Array.from(preview.value).length};
}
