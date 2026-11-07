import type {ControlOp, Snapshot} from '../public/types.ts';
import {planTableSeries} from './table-series.ts';
import {rectangleFillLines} from './table-fill-range.ts';

export type SeriesOperation = Extract<ControlOp,{kind:'fill_table_series'}>;
export function agentSeriesRange(snapshot:Snapshot, op:SeriesOperation) {
  const table=snapshot.structure?.tables.find(t=>t.id===op.target);
  if(!table || table.editable!==true || table.cells.length!==table.rows*table.columns ||
      table.cells.some(c=>c.rowSpan!==1 || c.columnSpan!==1)) throw Error('본문의 병합 없는 표를 지정하세요.');
  const {mode}=op,axis=op.axis??undefined,anchor={row:op.startRow,col:op.startColumn},focus={row:op.endRow,col:op.endColumn};
  const lines=rectangleFillLines(anchor,focus,axis,table.rows,table.columns);
  const formula=mode==='formula'||mode==='calculated-value';
  for(const line of lines){
  const {row:r,col:c}=line.anchor,{row:endR,col:endC}=line.focus;
  const count=1+Math.abs(r-endR)+Math.abs(c-endC);
  if(count>(formula?200:1000) || !formula&&(count<3 || endR<r || endC<c)) throw Error('수열은 첫 두 셀부터 오른쪽이나 아래로 세 셀 이상 지정하세요.');
  const selected=Array.from({length:count},(_,i)=>table.cells.find(cell=>
    cell.row===r+i*Math.sign(endR-r) && cell.column===c+i*Math.sign(endC-c)));
  const fields=snapshot.tableFormulaFields;
  const stored=(row:number,column:number)=>fields?.fields.find(f=>f.tableId===table.id&&f.row===row&&f.column===column&&f.path.length===1);
  const source=formula&&fields?.canFill?stored(r,c):undefined;
  if(selected.some((cell,i)=>!cell || cell.properties.cellProtect!==false || (!cell.editable&&!(source?.editable && (i===0 || mode==='formula')&&stored(cell.row,cell.column)?.editable))))
    throw Error('선택한 셀에 보호 또는 복잡한 내용이 있습니다.');
  if(formula) {
    if(!source?.editable && !selected[0]!.text.startsWith('=')) throw Error('시작 셀에는 조회한 계산식 필드 또는 = 수식 원문이 필요합니다.');
  } else {
    if(mode!=='days'&&mode!=='months'&&mode!=='years') throw Error('지원하지 않는 채우기 방식입니다.');
    planTableSeries(selected[0]!.text,selected[1]!.text,count,mode);
  }
  }
  return {table,block:{sec:table.section,ppi:table.paragraph,ci:table.control,anchor,focus,...(axis?{axis}:{})},
    unit:formula?'days' as const:mode,output:mode==='calculated-value'?'value' as const:'formula' as const};
}
