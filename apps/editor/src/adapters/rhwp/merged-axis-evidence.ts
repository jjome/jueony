import type { Table } from '../../modules/document/public/index.ts';
import { projectTableAxis, witnessedTrackEdges } from '../../modules/document/public/engine-integration.ts';
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

/** Derive each affected dimension from stored cell sizes, including distances
 * between boundaries of overlapping spans in a staggered grid. */
export function mergedAxisProof(doc: any, table: Table, row: boolean, insert: boolean, at: number, values: string[]) {
  const coord = row ? 'row' : 'column', span = row ? 'rowSpan' : 'columnSpan';
  const dimension = row ? 'height' : 'width', size = row ? table.rows : table.columns;
  const projected = projectTableAxis(table, row, insert, at, values);
  const acrossSize = row ? 'tableWidth' : 'tableHeight';
  const readAcrossSize = () => parsed(doc.getTableProperties(table.section,table.paragraph,table.control))[acrossSize];
  const originalAcrossSize = readAcrossSize();
  if (!Number.isSafeInteger(originalAcrossSize) || originalAcrossSize < 0)
    throw new Error('표의 원래 외곽 치수를 확인하지 못했습니다.');
  const source = table.cells.map(cell => content(doc, table, cell.index));
  if (table.cells.some(c => c.properties.cellProtect !== false || c.properties.fieldName !== '' && !c.axisFieldSignature))
    throw new Error('필드 또는 보호 상태가 불분명한 표는 행·열을 변경할 수 없습니다.');
  let edges:number[]|undefined;
  // Inserting new cells materializes two stored dimensions. Native fallbacks
  // (width 1800 or height 400) can conceal an unwitnessed line on either axis.
  const createsCells = projected.some(p => p.sourceIndex === null);
  const x = createsCells ? witnessedTrackEdges(table,false) : [];
  const y = createsCells ? witnessedTrackEdges(table,true) : [];
  function track(i: number) {
    const sizes = new Set(table.cells.filter(c => c[coord] === i && c[span] === 1).map(c => c.properties[dimension]));
    if (!sizes.size) {
      edges ??= witnessedTrackEdges(table,row);
      return edges[i+1]-edges[i];
    }
    const value = [...sizes][0];
    if (sizes.size !== 1 || typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0)
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
    if (readAcrossSize() !== originalAcrossSize)
      throw new Error('행·열 변경으로 반대 축의 표 외곽 치수가 달라졌습니다.');
    projected.forEach(({cell, sourceIndex}, i) => {
      const actual = after.cells[i];
      if (!actual || actual.index !== i || actual.row !== cell.row || actual.column !== cell.column
          || actual.rowSpan !== cell.rowSpan || actual.columnSpan !== cell.columnSpan)
        throw new Error('행·열 변경 후 실제 병합 셀 범위가 요청과 다릅니다.');
      if (sourceIndex === null) {
        const col = row ? cell.column : Math.min(at, table.columns-1);
        const r = row ? Math.min(at, table.rows-1) : cell.row;
        if (actual.properties.width !== x[col+1]-x[col] || actual.properties.height !== y[r+1]-y[r])
          throw new Error('추가한 셀의 행 높이 또는 열 너비가 원래 격자와 다릅니다.');
      }
      if (actual.axisFieldSignature !== (sourceIndex === null ? undefined : table.cells[sourceIndex].axisFieldSignature))
        throw new Error('셀의 누름틀·이름 필드나 그 내용·범위가 바뀌었습니다.');
      if (sourceIndex !== null && (!same(properties[i], actual.properties) || !same(source[sourceIndex], content(doc, after, i))))
        throw new Error('남아야 할 셀의 내용·서식 또는 크기가 달라졌습니다.');
    });
  };
}
