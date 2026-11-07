import type {ControlOp, NestedTable, Snapshot} from '../public/types.ts';
import {planTableSeries} from './table-series.ts';
import {fillLineOwners,rectangleFillLines} from './table-fill-range.ts';

export type SeriesOperation = Extract<ControlOp,{kind:'fill_table_series'}>;
export function agentSeriesRange(snapshot:Snapshot, op:SeriesOperation) {
  const table=snapshot.structure?.tables.find(t=>t.id===op.target) ??
    snapshot.structure?.nestedTables?.find(t=>t.id===op.target);
  if(!table||(!('ancestors' in table)&&table.editable!==true))throw Error('편집할 수 있는 표를 지정하세요.');
  const nested='ancestors' in table;
  const {mode}=op,axis=op.axis??undefined;
  const anchor={row:op.startRow,col:op.startColumn},focus={row:op.endRow,col:op.endColumn};
  const lines=rectangleFillLines(anchor,focus,axis,table.rows,table.columns);
  const formula=mode==='formula'||mode==='calculated-value';
  const fields=snapshot.tableFormulaFields;
  const stored=(row:number,column:number)=>fields?.fields.find(f=>f.tableId===table.id&&f.row===row&&f.column===column);
  const cells:readonly (NestedTable['cells'][number]&{properties?:{cellProtect?:unknown}})[]=table.cells;
  for(const line of lines){
    const selected=fillLineOwners(cells,line.anchor,line.focus,{anchor,focus});
    if(selected.length>(formula?200:1000) || (!formula&&(selected.length<3 || line.focus.row<line.anchor.row || line.focus.col<line.anchor.col)))
      throw Error('수열은 첫 두 셀부터 오른쪽이나 아래로 세 셀 이상 지정하세요.');
    const first=selected[0];
    const source=formula&&fields?.canFill?stored(first.row,first.column):undefined;
    for(const [i,cell] of selected.entries()){
      const editableField=source?.editable && (i===0 || mode==='formula') && stored(cell.row,cell.column)?.editable;
      if(!nested && cell.properties?.cellProtect!==false)throw Error('보호된 셀은 채울 수 없습니다.');
      if(!cell.editable&&!editableField)throw Error('선택한 셀에 보호 또는 복잡한 내용이 있습니다.');
    }
    if(formula){
      if(!source?.editable && !first.text.startsWith('='))throw Error('시작 셀에는 조회한 계산식 필드 또는 = 수식 원문이 필요합니다.');
    }else{
      if(mode!=='days'&&mode!=='months'&&mode!=='years')throw Error('지원하지 않는 채우기 방식입니다.');
      planTableSeries(first.text,selected[1].text,selected.length,mode);
    }
  }
  const cellPath=nested?[...table.ancestors,{controlIndex:table.control,cellIndex:0,cellParaIndex:0}]:undefined;
  return {table,block:{sec:table.section,ppi:table.paragraph,ci:table.control,cellPath,anchor,focus,...(axis?{axis}:{})},
    unit:formula?'days' as const:mode,output:mode==='calculated-value'?'value' as const:'formula' as const};
}
