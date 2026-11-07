import type {AgentTableSubdivisionOp,AgentTableSubdivisionSource,Cell,Table} from '../public/types.ts';
import {assertCoverage} from './table-axis-grid.ts';
import {witnessedTrackEdges} from './witnessed-track-edges.ts';

function dividedAxis(old:number[], start:number, span:number, count:number) {
  const lo = old[start], length = old[start + span] - lo;
  const step = Math.floor(length / count), remainder = length % count;
  const cuts = count === span ? old.slice(start,start+span+1)
    : Array.from({length:count+1}, (_,i) => lo + i*step + (i ? remainder : 0));
  const edges = [...new Set([...old,...cuts])].sort((a,b) => a-b);
  const groups = cuts.slice(1).map((end,i) => ({
    start:edges.indexOf(cuts[i]), span:edges.indexOf(end)-edges.indexOf(cuts[i]), length:end-cuts[i],
  }));
  const remap = (i:number) => edges.indexOf(old[i]);
  return {groups, remap, count:edges.length-1};
}

export function exactSubdivisionPlan(op:AgentTableSubdivisionOp, table:Table, source:AgentTableSubdivisionSource) {
  assertCoverage(table);
  const primary = table.cells.find(c => c.row === op.row && c.column === op.column);
  const limits = source.cells?.find(c => c.row === op.row && c.column === op.column);
  if((primary?.axisFieldSignature || primary?.properties.fieldName) && (!limits || !primary.axisFieldSignature ||
      !primary.properties.fieldName || primary.rowSpan*primary.columnSpan===1))
    throw new Error('원래 필드 값을 확인한 병합 이름 셀이 필요합니다.');
  if (!primary || !limits || table.editable === false || !source.frame
      || table.cells.some(c => c.properties.cellProtect !== false || c.properties.isHeader !== false)
      || ![limits.minimumHeight,limits.minimumWidth].every(n => Number.isSafeInteger(n) && n >= 200))
    throw new Error('조회된 비보호 셀의 위치·최소 크기와 배치가 필요합니다.');
  const r = dividedAxis(witnessedTrackEdges(table,true),primary.row,primary.rowSpan,op.rows);
  const c = dividedAxis(witnessedTrackEdges(table,false),primary.column,primary.columnSpan,op.columns);
  if (r.count*c.count > 200) throw new Error('분할 뒤 격자 위치는 200개 이하입니다.');
  if (r.groups.some(g => g.length < limits.minimumHeight) || c.groups.some(g => g.length < limits.minimumWidth))
    throw new Error('분할한 셀이 최소 크기와 안 여백보다 작습니다.');
  const multi = table.cells.filter(c => c.rowSpan > 1 || c.columnSpan > 1).length > 1;
  const formats = multi || (primary.rowSpan === 1 && primary.columnSpan === 1) ? limits.paragraphFormats : source.paragraphFormats;
  const paragraphs = op.distributeParagraphs ? primary.text.split('\n') : undefined;
  if (paragraphs && (!formats || paragraphs.length !== formats.length || paragraphs.length < 2 || paragraphs.length > op.rows*op.columns))
    throw new Error('문단 분배는 모든 원본 문단을 수용할 수 있는 조회된 셀에서 지원합니다.');
  const cells:Array<Cell & {originIndex:number|null}> = table.cells.filter(v => v !== primary).map(v => ({
    ...v, originIndex:v.index, row:r.remap(v.row), column:c.remap(v.column),
    rowSpan:r.remap(v.row+v.rowSpan)-r.remap(v.row), columnSpan:c.remap(v.column+v.columnSpan)-c.remap(v.column),
  }));
  let slot = 0;
  for (const row of r.groups) for (const col of c.groups) {
    cells.push({...primary, row:row.start, column:col.start, rowSpan:row.span, columnSpan:col.span,
      originIndex:slot === 0 ? primary.index : null, text:paragraphs ? paragraphs[slot] ?? '' : slot === 0 ? primary.text : '',
      ...(slot>0 && primary.properties.fieldName ? {axisFieldSignature:undefined} : {}),
      properties:{...primary.properties,width:col.length,height:row.length,...(slot>0 && primary.properties.fieldName ? {fieldName:''} : {})}});
    slot++;
  }
  cells.sort((a,b) => a.row-b.row || a.column-b.column).forEach((v,i) => {v.index=i;});
  assertCoverage({...table, rows:r.count, columns:c.count, cells});
  const restoreTracks = op.rows === primary.rowSpan && op.columns === primary.columnSpan;
  const merged = primary.rowSpan > 1 || primary.columnSpan > 1;
  // The original native split still handles exact restores and matching bands.
  // Other cases require inserting grid lines or remapping another merged cell.
  const legacyBand = (groups:typeof r.groups, span:number) => {
    const count = groups.length, total = groups.reduce((sum,v) => sum + v.length,0);
    return groups.every((g,i) => g.span === Math.floor(span/count) + (i < span % count ? 1 : 0)
      && g.length === Math.floor(total/count) + (i === 0 ? total % count : 0));
  };
  const namedDistribution=Boolean(primary.properties.fieldName && op.distributeParagraphs);
  const useExactGrid = namedDistribution || multi || !merged || !restoreTracks && (r.count !== table.rows || c.count !== table.columns
    || !legacyBand(r.groups,primary.rowSpan) || !legacyBand(c.groups,primary.columnSpan));
  return {table, primary, source, rows:r.count, columns:c.count, cells, useExactGrid, restoreTracks,
    paragraphFormats:formats, widths:c.groups.map(g => g.length), heights:r.groups.map(g => g.length)};
}
