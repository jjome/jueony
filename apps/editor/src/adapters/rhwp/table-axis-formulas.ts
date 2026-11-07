import type {Table} from '../../modules/document/public/types.ts';
import {parsed} from './structure.ts';

/** Axis surgery first moves the original fields verbatim. Replace only the A1
 * references planned against their source owners, inside the caller's snapshot. */
export function prepareAxisFormulaUpdates(doc:any,table:Table,expected:Table) {
 const at=[table.section,table.paragraph,table.control] as const;
 const fields=table.cells.filter(c=>c.axisFormula);
 if(typeof doc.getFieldList==='function'){
  const nativeFields=parsed(doc.getFieldList()).filter((f:any)=>f.fieldType==='formula' &&
   f.location?.sectionIndex===table.section && f.location?.paraIndex===table.paragraph &&
   f.location?.path?.[0]?.type==='cell' && f.location.path[0].controlIndex===table.control);
  if(nativeFields.length!==fields.length || nativeFields.some((f:any)=>f.location.path.length!==1 ||
    table.cells[f.location.path[0].cellIndex]?.axisFormula?.fieldId!==f.fieldId))
   throw Error('표의 모든 계산식 필드와 주 셀 위치를 확인해야 행·열을 변경할 수 있습니다.');
 }
 if(!fields.length)return;
 const plans=fields.map(cell=>{
  const stored=cell.axisFormula!,next=expected.cells.find(c=>c.axisFormula?.fieldId===stored.fieldId);
  if(!next?.axisFormula)throw Error('이동 후 계산식 필드 위치를 확인하지 못했습니다.');
  const command=stored.expression+'??'+stored.resultFormat+';;'+cell.text;
  const preview=parsed(doc.previewTableFormulaField(...at,cell.index,stored.fieldId,command,stored.expression,stored.resultFormat));
  if(preview.ok!==true || preview.fieldId!==stored.fieldId || !Number.isFinite(preview.result) ||
     preview.command!==command || preview.value!==cell.text || preview.dependentChanges?.length!==0)
   throw Error('원본 계산식과 저장된 계산 결과가 일치해야 행·열을 변경할 수 있습니다.');
  return {cell,stored,next,command,result:preview.result};
 });
 function checkFields(actual:Table,original:boolean){
  if(actual.cells.filter(c=>c.axisFormula).length!==plans.length)throw Error('행·열 변경 중 계산식 필드 개수가 달라졌습니다.');
  for(const {cell,stored,next} of plans){
   const moved=actual.cells[next.index],field=original?stored:next.axisFormula;
   if(moved?.row!==next.row || moved.column!==next.column || moved.text!==cell.text ||
      JSON.stringify(moved.axisFormula)!==JSON.stringify(field))
    throw Error('이동한 계산식의 위치·필드 ID·원문 또는 표시값이 다릅니다.');
  }
 }
 return {
  apply(moved:Table){
   checkFields(moved,true);
   for(const {cell,stored,next,command,result} of plans){
    const expression=next.axisFormula!.expression;
    if(expression===stored.expression)continue;
    const actual=parsed(doc.updateTableFormulaField(...at,next.index,stored.fieldId,command,expression,stored.resultFormat));
    if(actual.ok!==true || actual.fieldId!==stored.fieldId || actual.result!==result || actual.value!==cell.text ||
       actual.command!==expression+'??'+stored.resultFormat+';;'+cell.text || actual.dependentChanges?.length!==0)
     throw Error('계산식 참조 이동 후 다른 필드나 계산 결과가 바뀌었습니다.');
   }
  },
  verify(actual:Table){
   checkFields(actual,false);
   for(const {cell,next,result} of plans){
    const field=next.axisFormula!,command=field.expression+'??'+field.resultFormat+';;'+cell.text;
    const preview=parsed(doc.previewTableFormulaField(...at,next.index,field.fieldId,command,field.expression,field.resultFormat));
    if(preview.ok!==true || preview.fieldId!==field.fieldId || preview.result!==result || preview.value!==cell.text ||
       preview.command!==command || preview.dependentChanges?.length!==0)
     throw Error('변경 후 계산식이 이전 셀 값에서 같은 결과를 내는지 확인하지 못했습니다.');
   }
  },
 };
}
