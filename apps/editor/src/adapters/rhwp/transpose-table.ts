/** Whole-table transposition uses the existing engine primitive and snapshot undo. */
export function installTransposeTable(registry: any, input: () => any, eventBus: any) {
  function target() {
    const ih = input(), ref = ih?.getSelectedTableRef();
    if (!ref || ref.cellPath?.length) throw new Error('본문의 표 개체를 선택하세요.');
    const dims = ih.wasm.getTableDimensions(ref.sec, ref.ppi, ref.ci);
    if (!Number.isSafeInteger(dims.cellCount) || dims.cellCount < 1 || dims.cellCount > 1000
      || dims.cellCount !== dims.rowCount * dims.colCount) throw new Error('현재는 병합 없는 1,000셀 이하 표만 뒤집을 수 있습니다.');
    for (let cell = 0; cell < dims.cellCount; cell++) {
      const info = ih.wasm.getCellInfo(ref.sec, ref.ppi, ref.ci, cell);
      const props = ih.wasm.getCellProperties(ref.sec, ref.ppi, ref.ci, cell);
      if (info.rowSpan !== 1 || info.colSpan !== 1 || props.cellProtect) throw new Error('병합 또는 보호된 셀이 있는 표는 뒤집을 수 없습니다.');
    }
    return ref;
  }
  registry.register({ id: 'ext:jueony-transpose-table', label: '표 뒤집기 (행/열 바꾸기)',
    canExecute: (c: any) => {
      if (!c.hasDocument || !c.isEditable || c.isFormMode || !c.inTableObjectSelection) return false;
      try { target(); return true; } catch { return false; }
    },
    execute: () => {
      const ih = input(); ih.flushDeferredPaginationIfNeeded('transpose-table'); const ref = target();
      ih.executeOperation({ kind: 'snapshot', operationType: 'transposeWholeTable', operation: (wasm: any) => {
        const result = wasm.transposeTableCellsInPlace(ref.sec, ref.ppi, ref.ci);
        if (!result?.ok) throw new Error('표 뒤집기에 실패했습니다.');
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
