import type { Table } from '../../modules/document/public/index.ts';
import { projectTableAxis } from '../../modules/document/public/engine-integration.ts';
import { parsed } from './structure.ts';

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function content(doc: any, table: Table, index: number) {
  const { section, paragraph, control } = table;
  const count = doc.getCellParagraphCount(section, paragraph, control, index);
  return Array.from({ length: count }, (_, p) => {
    const args = [section, paragraph, control, index, p];
    const path = JSON.stringify([{ controlIndex: control, cellIndex: index, cellParaIndex: p }]);
    const length = doc.getCellParagraphLength(...args);
    return [doc.getTextInCell(...args, 0, length), parsed(doc.getCellStyleAt(...args)),
      parsed(doc.getCellCharPropertiesAt(...args, 0)), parsed(doc.getCellParaPropertiesAt(...args)),
      parsed(doc.getCharShapeRunsInCellByPath(section, paragraph, path, 0, length))];
  });
}

/** Derive the new outer size of a surviving merged cell from independent
 * single-span cells. A guessed track width or height would corrupt an
 * irregular table even when the new logical addresses appear correct. */
export function mergedAxisProof(doc: any, table: Table, row: boolean, insert: boolean, at: number, values: string[]) {
  const coord = row ? 'row' : 'column', span = row ? 'rowSpan' : 'columnSpan';
  const dimension = row ? 'height' : 'width', size = row ? table.rows : table.columns;
  const projected = projectTableAxis(table, row, insert, at, values);
  const source = table.cells.map(cell => content(doc, table, cell.index));
  if (table.cells.some(c => c.properties.fieldName !== '' || c.properties.cellProtect !== false))
    throw new Error('필드 또는 보호 상태가 불분명한 표는 행·열을 변경할 수 없습니다.');
  function track(i: number) {
    const sizes = new Set(table.cells.filter(c => c[coord] === i && c[span] === 1).map(c => c.properties[dimension]));
    const value = Number([...sizes][0]);
    if (sizes.size !== 1 || !Number.isSafeInteger(value) || value <= 0)
      throw new Error('병합 범위를 지나는 행 높이 또는 열 너비를 독립적으로 확인하지 못했습니다.');
    return value;
  }
  const properties = projected.map(({cell, sourceIndex}) => {
    if (sourceIndex === null) return;
    const old = table.cells[sourceIndex];
    if (old[span] === cell[span]) return old.properties;
    const originalSize = Array.from({length:old[span]}, (_, i) => track(old[coord] + i)).reduce((a,b) => a+b, 0);
    if (originalSize !== old.properties[dimension]) throw new Error('병합 셀 크기와 개별 행·열 크기의 합이 다릅니다.');
    const difference = track(Math.min(at, size - 1));
    return { ...old.properties, [dimension]: originalSize + (insert ? difference : -difference) };
  });
  return (after: Table) => {
    projected.forEach(({cell, sourceIndex}, i) => {
      const actual = after.cells[i];
      if (!actual || actual.index !== i || actual.row !== cell.row || actual.column !== cell.column
          || actual.rowSpan !== cell.rowSpan || actual.columnSpan !== cell.columnSpan)
        throw new Error('행·열 변경 후 실제 병합 셀 범위가 요청과 다릅니다.');
      if (sourceIndex !== null && (!same(properties[i], actual.properties) || !same(source[sourceIndex], content(doc, after, i))))
        throw new Error('남아야 할 셀의 내용·서식 또는 크기가 달라졌습니다.');
    });
  };
}
