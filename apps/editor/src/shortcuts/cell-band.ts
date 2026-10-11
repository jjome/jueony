/** Selection-only adapter; it preserves the engine's nested-table identity. */
export type CellBlockState = {
  sec: number; ppi: number; ci: number;
  cellPath?: unknown[];
  anchor: { row: number; col: number };
  focus: { row: number; col: number };
  phase: number; reason: string; excluded: string[];
};
export type CellBlockDimensions = { rowCount: number; colCount: number };
export function wholeCellBand<T extends CellBlockState>(state: T, dims: CellBlockDimensions, axis: 'rows' | 'columns'): T | null {
  const validCount = (n: number) => Number.isSafeInteger(n) && n > 0;
  if (!validCount(dims.rowCount) || !validCount(dims.colCount)) return null;
  const inside = (p: { row: number; col: number }) => Number.isSafeInteger(p.row) && Number.isSafeInteger(p.col)
    && p.row >= 0 && p.row < dims.rowCount && p.col >= 0 && p.col < dims.colCount;
  if (!inside(state.anchor) || !inside(state.focus)) return null;
  // Keep the selected band on the other axis, including backward selections.
  const anchor = axis === 'columns' ? { ...state.anchor, row: 0 } : { ...state.anchor, col: 0 };
  const focus = axis === 'columns' ? { ...state.focus, row: dims.rowCount - 1 } : { ...state.focus, col: dims.colCount - 1 };
  return { ...state, anchor, focus, phase: 2, excluded: [] };
}

export function selectWholeCellBand(input: {
  cursor: {
    captureCellSelection(): CellBlockState | null;
    restoreCellSelection(state: CellBlockState): boolean;
  };
  wasm: {
    getTableDimensions(sec: number, ppi: number, ci: number): CellBlockDimensions;
    getTableDimensionsByPath(sec: number, ppi: number, path: string): CellBlockDimensions;
  };
  flushDeferredPaginationIfNeeded(reason: string): void;
  caret: { hide(): void };
  updateCellSelection(): void;
  focus(): void;
}, axis: 'rows' | 'columns'): boolean {
  input.flushDeferredPaginationIfNeeded('hangul-cell-band');
  const state = input.cursor.captureCellSelection();
  if (!state) return false;
  const dims = state.cellPath?.length
    ? input.wasm.getTableDimensionsByPath(state.sec, state.ppi, JSON.stringify(state.cellPath))
    : input.wasm.getTableDimensions(state.sec, state.ppi, state.ci);
  const next = wholeCellBand(state, dims, axis);
  if (!next || !input.cursor.restoreCellSelection(next)) return false;
  input.caret.hide();
  input.updateCellSelection();
  input.focus();
  return true;
}