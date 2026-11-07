import {formulaGrid} from './table-formula-plan.ts';
import type {AgentTableFormulaOp,AgentInsertTableFormulaOp,Snapshot} from '../public/types.ts';

function validateFormula(op:AgentTableFormulaOp|AgentInsertTableFormulaOp,keys:string[]) {
 if(Object.keys(op).some(k=>!keys.includes(k)) || ![op.row,op.column].every(n=>Number.isSafeInteger(n)&&n>=0) ||
   typeof op.formula!=='string' || !op.formula.startsWith('=') || op.formula.length<2 || new TextEncoder().encode(op.formula).length>512 ||
   /[\u0000-\u001f\u007f]|\?\?|;;/u.test(op.formula) || typeof op.resultFormat!=='string' || !/^%(?:g|\.[012]f),?$/u.test(op.resultFormat))
   throw Error('계산식 필드에는 유효한 셀 위치·수식·숫자 서식이 필요합니다.');
}

function locate(base:Snapshot, target:string, row:number, column:number) {
 const matches=[...(base.structure?.tables??[]),...(base.structure?.nestedTables??[])].filter(t=>t.id===target);
 const table=matches[0];
 if(matches.length!==1 || ('ancestors' in table ? !base.tableFormulaFields?.canUseCellPaths : !table.editable))
  throw Error('조회된 편집 가능한 표의 경로를 확인하세요.');
 const cells=table.cells.filter(c=>c.row===row&&c.column===column),cell=cells[0];
 if(cells.length!==1 || !('ancestors' in table) && (!('properties' in cell) || cell.properties?.cellProtect!==false))
  throw Error('조회된 비보호 주 셀의 시작 위치를 확인하세요.');
 const path=[...('ancestors' in table?table.ancestors:[]),{controlIndex:table.control,cellIndex:cell.index,cellParaIndex:0}];
 formulaGrid(table);
 return {table,cell,path};
}

export function agentFormulaInsertTarget(op:AgentInsertTableFormulaOp,base:Snapshot) {
 validateFormula(op,['kind','target','row','column','originalText','formula','resultFormat']);
 const caps=base.tableFormulaFields;
 const result=locate(base,op.target,op.row,op.column),{cell}=result;
 if(!/\.hwpx?$/iu.test(base.name) || !caps?.canInsert || caps.unresolved!==0 || caps.fields.length>=200 ||
    !cell.editable ||
    typeof op.originalText!=='string' || Array.from(op.originalText).length>4000 || op.originalText!==cell.text ||
    caps.fields.some(f=>f.tableId===op.target&&f.row===op.row&&f.column===op.column))
  throw Error('현재 조회한 일반 셀의 위치·원문·보호 상태를 확인하세요.');
 return result;
}

export function agentTableFormulaTarget(op:AgentTableFormulaOp,base:Snapshot) {
 validateFormula(op,['kind','target','row','column','fieldId','originalCommand','formula','resultFormat']);
 if(!Number.isSafeInteger(op.fieldId)||op.fieldId<0)throw Error('유효한 계산식 필드 ID가 필요합니다.');
 const caps=base.tableFormulaFields;
 const candidates=caps?.fields.filter(f=>f.tableId===op.target&&f.row===op.row&&f.column===op.column&&f.fieldId===op.fieldId);
 const field=candidates?.[0],{table,path}=locate(base,op.target,op.row,op.column);
 if(!/\.hwpx?$/iu.test(base.name) || !caps?.canEdit || candidates?.length!==1 || !field?.editable || field.storedCommand!==op.originalCommand ||
    table.section!==field.section || table.paragraph!==field.paragraph || JSON.stringify(field.path)!==JSON.stringify(path))
   throw Error('조회된 편집 가능 계산식 필드의 위치·원문·보호 상태가 다릅니다.');
 return {field,table};
}
