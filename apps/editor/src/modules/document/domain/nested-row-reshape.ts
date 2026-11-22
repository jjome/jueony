import type {AgentTableMergeOp, AgentTableSplitOp, Snapshot} from '../public/types.ts';

export function nestedRowReshapePlan(op: AgentTableMergeOp|AgentTableSplitOp, snapshot: Snapshot) {
  const table = snapshot.structure?.nestedTables?.find(item=>item.id===op.target);
  if(!table)return undefined;
  if(!table.reshapeAvailable||!table.axisEditable||!/\.hwpx?$/iu.test(snapshot.name)||table.cells.length>200) {
    throw new Error('병합과 분할을 지원하는 안쪽 표를 다시 조회하세요.');
  }
  const merge=op.kind==='merge_table_cells';
  const row=merge?op.startRow:op.row,column=merge?op.startColumn:op.column;
  const primary=table.cells.find(cell=>cell.row===row&&cell.column===column);
  const count=merge?op.columnCount:primary?.columnSpan;
  if(!primary||!Number.isSafeInteger(count)||count!<2||column+count!>table.columns||primary.rowSpan!==1||
      (merge&&(op.rowCount!==1||primary.columnSpan!==1))) {
    throw new Error('중첩 표는 한 행 안의 연속된 두 셀 이상 또는 가로로 병합된 주 셀을 지정하세요.');
  }
  const endColumn=column+count!-1;
  const targets=merge?table.cells.filter(cell=>cell.row===row&&cell.column>=column&&cell.column<=endColumn):[primary];
  if(merge&&(targets.length!==count||targets.some((cell,index)=>cell.column!==column+index||cell.columnSpan!==1||cell.rowSpan!==1))) {
    throw new Error('다른 병합 셀의 경계를 포함한 범위는 중첩 표에서 편집할 수 없습니다.');
  }
  return {table,row,column,endColumn,primary,targets,merge};
}
