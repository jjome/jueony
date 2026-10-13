import { preflightDocumentEdit } from './edit-preflight.ts';
const parse = (v: any): any => typeof v === 'string' ? JSON.parse(v) : v;
export type TransposeTarget = { sec: number; ppi: number; ci: number; cellPath?: unknown[] };
export function readTransposePlan(value: any, ref: TransposeTarget) {
  const doc = value.borrowDocumentHandle?.() ?? value;
  if (!ref || ref.cellPath?.length || ![ref.sec, ref.ppi, ref.ci].every(v => Number.isSafeInteger(v) && v >= 0)) throw new Error('본문의 표 개체를 선택하세요.');
  const dims = parse(doc.getTableDimensions(ref.sec, ref.ppi, ref.ci)), properties = parse(doc.getTableProperties(ref.sec, ref.ppi, ref.ci));
  if (![dims.cellCount, dims.rowCount, dims.colCount].every(v => Number.isSafeInteger(v) && v > 0) || dims.cellCount > 1000 || dims.rowCount * dims.colCount > 1000000) throw new Error('1,000셀·1,000,000칸 이하 표를 선택하세요.');
  if (properties.repeatHeader) throw new Error('반복 제목행을 해제한 뒤 표를 뒤집으세요.');
  const occupied = new Set<number>(), cells = Array.from({ length: dims.cellCount }, (_, index) => {
    const info = parse(doc.getCellInfo(ref.sec, ref.ppi, ref.ci, index)), props = parse(doc.getCellProperties(ref.sec, ref.ppi, ref.ci, index));
    if (props.cellProtect) throw new Error('보호된 셀이 있는 표는 뒤집을 수 없습니다.');
    if (![info.row, info.col, info.rowSpan, info.colSpan].every(v => Number.isSafeInteger(v) && v >= 0) || info.rowSpan < 1 || info.colSpan < 1 || info.row + info.rowSpan > dims.rowCount || info.col + info.colSpan > dims.colCount) throw new Error('병합 셀 범위가 올바르지 않습니다.');
    for (let r = info.row; r < info.row + info.rowSpan; r++) for (let c = info.col; c < info.col + info.colSpan; c++) { const key = r * dims.colCount + c; if (occupied.has(key)) throw new Error('셀 범위가 겹칩니다.'); occupied.add(key); }
    const paragraphs = Array.from({ length: doc.getCellParagraphCount(ref.sec, ref.ppi, ref.ci, index) }, (_, p) => {
      const args = [ref.sec, ref.ppi, ref.ci, index, p], length = doc.getCellParagraphLength(...args), path = JSON.stringify([{ controlIndex: ref.ci, cellIndex: index, cellParaIndex: p }]);
      return { text: doc.getTextInCell(...args, 0, length), runs: parse(doc.getCharShapeRunsInCellByPath(ref.sec, ref.ppi, path, 0, length)), paragraph: parse(doc.getCellParaPropertiesAt(...args)), style: parse(doc.getCellStyleAt(...args)) };
    });
    return { info, props, paragraphs };
  });
  if (occupied.size !== dims.rowCount * dims.colCount) throw new Error('빈 셀 영역이 있는 표는 뒤집을 수 없습니다.');
  return { target: structuredClone(ref), dims, cells };
}
export function executeTranspose(value: any, plan: ReturnType<typeof readTransposePlan>): void {
  const doc = value.borrowDocumentHandle?.() ?? value, ref = plan.target;
  if (JSON.stringify(readTransposePlan(doc, ref)) !== JSON.stringify(plan)) throw new Error('표의 내용이나 서식이 바뀌었습니다. 표를 다시 선택하세요.');
  if (parse(doc.transposeTableCellsInPlace(ref.sec, ref.ppi, ref.ci))?.ok !== true) throw new Error('표 뒤집기에 실패했습니다.');
  const result = readTransposePlan(doc, ref);
  if (result.dims.rowCount !== plan.dims.colCount || result.dims.colCount !== plan.dims.rowCount || result.cells.length !== plan.cells.length) throw new Error('뒤집은 표의 행·열 수가 다릅니다.');
  const expected = plan.cells.map(cell => ({ ...cell, info: { row: cell.info.col, col: cell.info.row, rowSpan: cell.info.colSpan, colSpan: cell.info.rowSpan } })).sort((a, b) => a.info.row - b.info.row || a.info.col - b.info.col);
  const content = (cell: any) => ({ info: cell.info, paragraphs: cell.paragraphs, props: Object.fromEntries(Object.entries(cell.props).filter(([key]) => !['width', 'height'].includes(key))) });
  if (JSON.stringify(result.cells.map(content)) !== JSON.stringify(expected.map(content))) throw new Error('표 뒤집기 중 셀 내용이나 서식이 바뀌었습니다.');
}
export function preflightTranspose(wasm: any, plan: ReturnType<typeof readTransposePlan>): void {
  preflightDocumentEdit(wasm, scratch => executeTranspose(scratch, readTransposePlan(scratch, plan.target)));
}

/** Whole-table transposition retains merged footprints, cell content and zone fills. */
export function installTransposeTable(registry: any, input: () => any, eventBus: any) {
  function target() {
    const ih = input(), ref = ih?.getSelectedTableRef();
    if (!ref || ref.cellPath?.length) throw new Error('본문의 표 개체를 선택하세요.');
    readTransposePlan(ih.wasm, ref);
    return ref;
  }
  registry.register({ id: 'ext:jueony-transpose-table', label: '표 뒤집기 (행/열 바꾸기)',
    canExecute: (c: any) => {
      const ih = input();
      if (!ih || !c.hasDocument || !c.isEditable || c.isFormMode || !c.inTableObjectSelection || ih.isComposing || ih.wasm.requiresPasswordForSave || ih.cursor.isInHeaderFooter() || ih.cursor.isInFootnote() || ih.cursor.isInTextBox()) return false;
      try { target(); return true; } catch { return false; }
    },
    execute: () => {
      const ih = input(); ih.flushDeferredPaginationIfNeeded('transpose-table'); const ref = target();
      const api = (window as any).jueonyEditor, revision = api.revision(), plan = readTransposePlan(ih.wasm, ref);
      preflightTranspose(ih.wasm, plan);
      if (api.busy() || api.revision() !== revision || JSON.stringify(ih.getSelectedTableRef()) !== JSON.stringify(ref)) throw new Error('문서나 표 선택이 바뀌었습니다. 다시 실행하세요.');
      ih.executeOperation({ kind: 'snapshot', operationType: 'transposeWholeTable', operation: (wasm: any) => {
        executeTranspose(wasm, plan);
        return { sectionIndex: ref.sec, paragraphIndex: ref.ppi, charOffset: 0 };
      } });
      ih.cursor.enterTableObjectSelectionDirect(ref.sec, ref.ppi, ref.ci);
      ih.updateCaret(); ih.focus(); eventBus.emit('table-object-selection-changed', true);
      eventBus.emit('command-state-changed');
    },
  });
  const anchor = document.querySelector('.md-item[data-cmd="table:transpose-copy"]');
  if (anchor) {
    const item = document.createElement('div'); item.className = 'md-item'; item.dataset.cmd = 'ext:jueony-transpose-table';
    const label = document.createElement('span'); label.className = 'md-label'; label.textContent = '표 뒤집기 (행/열 바꾸기)';
    item.append(label); anchor.before(item);
  }
}
