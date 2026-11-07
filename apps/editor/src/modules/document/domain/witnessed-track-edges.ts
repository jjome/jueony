import type {Table} from '../public/types.ts';

/** Every stored cell fixes the distance between two logical grid lines. */
export function witnessedTrackEdges(table:Table, row:boolean):number[] {
  const count = row ? table.rows : table.columns;
  if (!Number.isSafeInteger(count) || count < 1 || count > 200) throw new Error('표 격자 크기를 확인하지 못했습니다.');
  const links:Array<Array<[number,number]>> = Array.from({length:count + 1}, () => []);
  for (const cell of table.cells) {
    const start = row ? cell.row : cell.column;
    const span = row ? cell.rowSpan : cell.columnSpan;
    const end = start + span;
    const length = cell.properties[row ? 'height' : 'width'];
    if (![start,span].every(Number.isSafeInteger) || start < 0 || span < 1 || end > count
        || typeof length !== 'number' || !Number.isSafeInteger(length) || length < 1)
      throw new Error('병합 범위의 행 높이 또는 열 너비를 확인하지 못했습니다.');
    links[start].push([end,length]);
    links[end].push([start,-length]);
  }
  const edges = Array<number>(count+1).fill(NaN);
  edges[0] = 0;
  const stack = [0];
  while (stack.length) {
    const from = stack.pop()!;
    for (const [to,delta] of links[from]) {
      const distance = edges[from] + delta;
      if (!Number.isSafeInteger(distance)) throw new Error('행·열 치수의 범위를 벗어났습니다.');
      if (Number.isNaN(edges[to])) { edges[to] = distance; stack.push(to); }
      else if (edges[to] !== distance) throw new Error('병합 셀 크기와 주변 행·열 치수가 다릅니다.');
    }
  }
  if (edges.some((v,i) => !Number.isFinite(v) || i > 0 && v <= edges[i-1]))
    throw new Error('병합 범위의 행 높이 또는 열 너비를 독립적으로 확인하지 못했습니다.');
  return edges;
}
