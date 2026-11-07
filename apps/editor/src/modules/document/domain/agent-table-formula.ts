import type {AgentTableFormulaOp,AgentInsertTableFormulaOp,Snapshot} from '../public/types.ts';

function validateFormula(op:AgentTableFormulaOp|AgentInsertTableFormulaOp,keys:string[]) {
 if(Object.keys(op).some(k=>!keys.includes(k)) || ![op.row,op.column].every(n=>Number.isSafeInteger(n)&&n>=0) ||
   typeof op.formula!=='string' || !op.formula.startsWith('=') || op.formula.length<2 || new TextEncoder().encode(op.formula).length>512 ||
   /[\u0000-\u001f\u007f]|\?\?|;;/u.test(op.formula) || typeof op.resultFormat!=='string' || !/^%(?:g|\.[012]f),?$/u.test(op.resultFormat))
   throw Error('계산식 필드에는 유효한 셀 위치·수식·숫자 서식이 필요합니다.');
}

export function agentFormulaInsertTarget(op:AgentInsertTableFormulaOp,base:Snapshot) {
 validateFormula(op,['kind','target','row','column','originalText','formula','resultFormat']);
 const caps=base.tableFormulaFields;
 const matches=base.structure?.tables.filter(t=>t.id===op.target)??[],table=matches[0];
 const cells=table?.cells.filter(c=>c.row===op.row&&c.column===op.column)??[],cell=cells[0];
 if(!/\.hwpx?$/iu.test(base.name) || !caps?.canInsert || caps.unresolved!==0 || caps.fields.length>=200 ||
    matches.length!==1 || !table.editable || table.cells.length!==table.rows*table.columns || table.cells.length>200 ||
    table.cells.some(c=>c.rowSpan!==1||c.columnSpan!==1) || cells.length!==1 || !cell.editable || cell.properties.cellProtect!==false ||
    typeof op.originalText!=='string' || Array.from(op.originalText).length>4000 || op.originalText!==cell.text ||
    caps.fields.some(f=>f.tableId===op.target&&f.row===op.row&&f.column===op.column))
  throw Error('현재 조회한 일반 셀의 위치·원문·보호 상태를 확인하세요.');
 return {cell,table};
}

export function agentTableFormulaTarget(op:AgentTableFormulaOp,base:Snapshot) {
 validateFormula(op,['kind','target','row','column','fieldId','originalCommand','formula','resultFormat']);
 if(!Number.isSafeInteger(op.fieldId)||op.fieldId<0)throw Error('유효한 계산식 필드 ID가 필요합니다.');
 const caps=base.tableFormulaFields;
 const candidates=caps?.fields.filter(f=>f.tableId===op.target&&f.row===op.row&&f.column===op.column&&f.fieldId===op.fieldId);
 const field=candidates?.[0],table=base.structure?.tables.find(t=>t.id===op.target);
 if(!/\.hwpx?$/iu.test(base.name) || !caps?.canEdit || candidates?.length!==1 || !field?.editable || field.path.length!==1 || field.storedCommand!==op.originalCommand ||
    !table?.editable || table.section!==field.section || table.paragraph!==field.paragraph || table.control!==field.path[0].controlIndex ||
    !table.cells.some(c=>c.row===op.row&&c.column===op.column&&c.index===field.path[0].cellIndex&&c.properties.cellProtect===false))
   throw Error('조회된 편집 가능 계산식 필드의 위치·원문·보호 상태가 다릅니다.');
 return {field,table};
}
