import type {Snapshot,AgentTableSubdivisionOp,Cell} from '../public/types.ts';
export function tableSubdivisionPlan(op:AgentTableSubdivisionOp, snapshot:Snapshot) {
  const keys = ['kind', 'target', 'row', 'column', 'rows', 'columns'];
  if (!op || op.kind !== 'split_table_cell_into' || Object.keys(op).length !== keys.length || keys.some(k => !Object.hasOwn(op, k))) throw new Error('셀 임의 분할의 행·열과 분할 개수를 모두 지정하세요.');
  const table = snapshot.structure?.tables.find(t => t.id === op.target), source = snapshot.tableSubdivisionSources?.[op.target];
  if (!/\.hwpx$/iu.test(snapshot.name) || !/^s\d+p\d+t\d+$/u.test(op.target) || !table || source?.editable !== true || !/^[a-f0-9]{64}$/u.test(source.fingerprint ?? '')) throw new Error('조회된 HWPX 임의 분할 가능 표가 필요합니다.');
  if (![op.row, op.column, op.rows, op.columns].every(Number.isSafeInteger) || op.row < 0 || op.column < 0 || op.rows < 1 || op.columns < 1 || op.rows > 8 || op.columns > 8 || op.rows * op.columns === 1) throw new Error('새 행·열 수는 1~8이며 적어도 한 방향을 나누어야 합니다.');
  if (table.editable === false || ![table.rows,table.columns].every(Number.isSafeInteger) || table.rows<1 || table.columns<1 || table.cells.length !== table.rows * table.columns || table.cells.some((c, i) => c.index !== i || c.row !== Math.floor(i / table.columns) || c.column !== i % table.columns || c.rowSpan !== 1 || c.columnSpan !== 1 || !c.editable || c.properties.cellProtect !== false || c.properties.isHeader === true)) throw new Error('임의 분할은 병합·보호·제목 셀이 없는 일치하는 평면 격자를 지원합니다.');
  if (table.cells.some(c=>typeof c.properties.width!=='number'||typeof c.properties.height!=='number'||!Number.isSafeInteger(c.properties.width)||!Number.isSafeInteger(c.properties.height)||c.properties.width<200||c.properties.height<200||c.properties.width!==table.cells[c.column].properties.width||c.properties.height!==table.cells[c.row*table.columns].properties.height))throw new Error('셀 크기와 원본 행·열 격자가 일치하지 않습니다.');
  const primary = table.cells.find(c => c.row === op.row && c.column === op.column);
  if (!source.frame || !primary || !source.cells?.some(c => c.row === op.row && c.column === op.column)) throw new Error('조회된 분할 가능 원본 셀과 배치 정보가 필요합니다.');
  const rows = table.rows + op.rows - 1, columns = table.columns + op.columns - 1;
  if (rows * columns > 200) throw new Error('분할 뒤 격자 위치는 200개 이하입니다.');
  const split = (value:unknown, count:number) => { if (typeof value!=='number'||!Number.isSafeInteger(value) || value < 200) throw new Error('셀 원본 크기를 확인하지 못했습니다.'); const base = Math.floor(value / count); return Array.from({ length: count }, (_, i) => base + (i === 0 ? value % count : 0)); };
  const widths = split(primary.properties.width, op.columns), heights = split(primary.properties.height, op.rows);
  const limits=source.cells!.find(c=>c.row===op.row&&c.column===op.column)!;
  if (![limits.minimumWidth,limits.minimumHeight].every(Number.isSafeInteger)||limits.minimumWidth<200||limits.minimumHeight<200||widths.some(v => v < limits.minimumWidth) || heights.some(v => v < limits.minimumHeight)) throw new Error('새 셀 크기가 기존 안 여백과 최소 크기보다 작습니다.');
  const cells:Array<Cell & {originIndex:number|null}> = table.cells.filter(c => c !== primary).map(c => ({ ...structuredClone(c), originIndex: c.index, row: c.row > op.row ? c.row + op.rows - 1 : c.row, column: c.column > op.column ? c.column + op.columns - 1 : c.column, rowSpan: c.row === op.row ? op.rows : 1, columnSpan: c.column === op.column ? op.columns : 1 }));
  for (let row = 0; row < op.rows; row++) for (let column = 0; column < op.columns; column++) cells.push({ ...structuredClone(primary), originIndex: row === 0 && column === 0 ? primary.index : null, row: op.row + row, column: op.column + column, rowSpan: 1, columnSpan: 1, text: row === 0 && column === 0 ? primary.text : '', properties: { ...primary.properties, width: widths[column], height: heights[row] } });
  cells.sort((a, b) => a.row - b.row || a.column - b.column); cells.forEach((c, index) => c.index = index);
  const occupied = new Set(); for (const c of cells) for (let r = c.row; r < c.row + c.rowSpan; r++) for (let col = c.column; col < c.column + c.columnSpan; col++) { const key = `${r},${col}`; if (r >= rows || col >= columns || occupied.has(key)) throw new Error('분할 격자가 겹치거나 표 범위를 벗어납니다.'); occupied.add(key); }
  if (occupied.size !== rows * columns) throw new Error('분할 뒤 격자에 빈 위치가 있습니다.');
  return { table, source, primary, rows, columns, cells, widths, heights };
}
