import type { Cell, Table } from '../public/types.ts';

/** A physical cell may cover several logical positions. Reject gaps and
 * overlaps before mapping any of the document's physical cell indices. */
export function assertCoverage(table: Table) {
  const { rows, columns, cells } = table;
  if (![rows, columns].every(n => Number.isSafeInteger(n) && n > 0) || rows * columns > 1000)
    throw new Error('표의 행·열 범위를 확인하지 못했습니다.');
  const grid = new Uint8Array(rows * columns);
  cells.forEach((c, index) => {
    if (c.index !== index || ![c.row, c.column, c.rowSpan, c.columnSpan].every(Number.isSafeInteger)
        || c.row < 0 || c.column < 0 || c.rowSpan < 1 || c.columnSpan < 1
        || c.row + c.rowSpan > rows || c.column + c.columnSpan > columns)
      throw new Error('표의 실제 셀 위치 또는 병합 범위가 잘못되었습니다.');
    for (let r = c.row; r < c.row + c.rowSpan; r++)
      for (let col = c.column; col < c.column + c.columnSpan; col++) {
        if (grid[r * columns + col]) throw new Error('표의 셀 범위가 겹칩니다.');
        grid[r * columns + col] = 1;
      }
  });
  if (grid.includes(0)) throw new Error('표의 셀 위치를 확인하지 못했습니다.');
}

export function projectTableAxis(table: Table, row: boolean, insert: boolean, at: number, values: string[]) {
  assertCoverage(table);
  const coord = row ? 'row' : 'column', span = row ? 'rowSpan' : 'columnSpan';
  const across = row ? 'column' : 'row', acrossSpan = row ? 'columnSpan' : 'rowSpan';
  const delta = insert ? 1 : -1;
  const projected: { cell: Cell; sourceIndex: number | null }[] = [];
  const covered = new Set<number>();
  for (const original of table.cells) {
    const start = original[coord], end = start + original[span];
    if (!insert && start === at && original[span] === 1) continue;
    const cell = { ...original };
    if (insert ? start >= at : start > at) cell[coord] += delta;
    else if (at < end) {
      cell[span] += delta;
      if (insert) for (let i = cell[across]; i < cell[across] + cell[acrossSpan]; i++) covered.add(i);
    }
    projected.push({ cell, sourceIndex: original.index });
  }
  if (insert) values.forEach((value, i) => {
    if (covered.has(i)) {
      if (value !== '') throw new Error('병합 셀이 확장되는 위치의 삽입 값은 비워 두세요.');
      return;
    }
    projected.push({ cell: { index: 0, row: row ? at : i, column: row ? i : at, rowSpan: 1,
      columnSpan: 1, text: value, properties: {}, editable: true }, sourceIndex: null });
  });
  projected.sort((a, b) => a.cell.row - b.cell.row || a.cell.column - b.cell.column);
  projected.forEach(({ cell }, index) => { cell.index = index; });
  return projected;
}
