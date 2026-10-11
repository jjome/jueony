import type { CellBlockState } from '../shortcuts/cell-band.ts';

export type GeometryCell = { cellIdx: number; row: number; col: number; rowSpan: number; colSpan: number; width: number; height: number; cellProtect?: boolean };
export type EqualAxis = 'width' | 'height';
export type GeometryUpdate = { cellIdx: number; widthDelta?: number; heightDelta?: number };
export const equalCellHelp = '병합 없는 표에서 너비는 칸 전체(F7), 높이는 줄 전체(F8)를 선택하세요. 두 칸 또는 두 줄 이상이어야 합니다.';

/** Only full bands of an ordinary grid have a durable representation in this engine.
 * Preserve the sum in integer HWPUNIT; rounding differs by at most one unit.
 * Never silently expand a partial selection or modify unselected cells.
 */
export function planEqualCells(cells: GeometryCell[], state: CellBlockState, rows: number, cols: number, axis: EqualAxis): GeometryUpdate[] {
  const fail = () => { throw new Error(equalCellHelp); };
  if (![rows, cols].every(n => Number.isSafeInteger(n) && n > 0) || cells.length !== rows * cols || state.excluded?.length) return fail();
  const r0 = Math.min(state.anchor.row, state.focus.row), r1 = Math.max(state.anchor.row, state.focus.row);
  const c0 = Math.min(state.anchor.col, state.focus.col), c1 = Math.max(state.anchor.col, state.focus.col);
  if (![r0, r1, c0, c1].every(Number.isSafeInteger) || r0 < 0 || c0 < 0 || r1 >= rows || c1 >= cols) return fail();
  if (axis === 'width' ? (r0 !== 0 || r1 !== rows - 1 || c0 === c1) : (c0 !== 0 || c1 !== cols - 1 || r0 === r1)) return fail();
  const positions = new Set<string>(), indices = new Set<number>();
  const sizes = Array.from({ length: axis === 'width' ? cols : rows }, () => -1);
  for (const cell of cells) {
    const n = cell[axis], i = axis === 'width' ? cell.col : cell.row, pos = `${cell.row}:${cell.col}`;
    if (![cell.cellIdx, cell.row, cell.col, n].every(Number.isSafeInteger) || cell.cellIdx < 0 || cell.row < 0 || cell.row >= rows || cell.col < 0 || cell.col >= cols || n < 200 || n > 0x7fffffff || cell.rowSpan !== 1 || cell.colSpan !== 1 || positions.has(pos) || indices.has(cell.cellIdx)) return fail();
    positions.add(pos); indices.add(cell.cellIdx);
    // Inconsistent stored grid dimensions would reflow other cells on serialization.
    if (sizes[i] !== -1 && sizes[i] !== n) return fail();
    sizes[i] = n;
  }
  const lo = axis === 'width' ? c0 : r0, hi = axis === 'width' ? c1 : r1;
  const selected = sizes.slice(lo, hi + 1), total = selected.reduce((a, b) => a + b, 0);
  if (!Number.isSafeInteger(total)) return fail();
  const base = Math.floor(total / selected.length), remainder = total % selected.length;
  const updates: GeometryUpdate[] = [];
  for (const cell of cells) {
    const i = axis === 'width' ? cell.col : cell.row;
    if (i < lo || i > hi) continue;
    if (cell.cellProtect) return fail();
    const delta = base + (i - lo < remainder ? 1 : 0) - cell[axis];
    if (delta) updates.push(axis === 'width' ? { cellIdx: cell.cellIdx, widthDelta: delta } : { cellIdx: cell.cellIdx, heightDelta: delta });
  }
  return updates;
}

/** Table control height can exceed the sum of stored rows (the renderer gives the
 * surplus to the last row). Distribute it too, or a successful property change
 * would leave visibly unequal rows. Surplus requires selecting the whole table.
 */
export function planEqualHeights(cells: GeometryCell[], state: CellBlockState, rows: number, cols: number, tableHeight: number): GeometryUpdate[] {
  planEqualCells(cells, state, rows, cols, 'height'); // validate before deriving a grid
  if (!Number.isSafeInteger(tableHeight) || tableHeight < 0) throw new Error(equalCellHelp);
  const sum = cells.filter(c => c.col === 0).reduce((n, c) => n + c.height, 0), surplus = Math.max(0, tableHeight - sum);
  if (surplus && (Math.min(state.anchor.row, state.focus.row) !== 0 || Math.max(state.anchor.row, state.focus.row) !== rows - 1)) throw new Error('표 높이에 여유분이 있습니다. 표 전체 셀을 선택한 뒤 높이를 같게 실행하세요.');
  const effective = cells.map(c => ({ ...c, height: c.height + (c.row === rows - 1 ? surplus : 0) }));
  const planned = new Map(planEqualCells(effective, state, rows, cols, 'height').map(u => [u.cellIdx, u.heightDelta!]));
  return effective.flatMap((c, i) => {
    const delta = c.height + (planned.get(c.cellIdx) ?? 0) - cells[i].height;
    return delta ? [{ cellIdx: c.cellIdx, heightDelta: delta }] : [];
  });
}
function readPlan(input: any, axis: EqualAxis) {
  const state: CellBlockState | null = input?.cursor.captureCellSelection();
  if (!state) throw new Error(equalCellHelp);
  const wasm = input.wasm, path = state.cellPath?.length ? JSON.stringify(state.cellPath) : null;
  if (axis === 'height' && state.cellPath && state.cellPath.length > 1) throw new Error('중첩 표의 높이 같게는 아직 지원하지 않습니다.');
  const dims = path ? wasm.getTableDimensionsByPath(state.sec, state.ppi, path) : wasm.getTableDimensions(state.sec, state.ppi, state.ci);
  const bboxes = path ? wasm.getTableCellBboxesByPath(state.sec, state.ppi, path) : wasm.getTableCellBboxes(state.sec, state.ppi, state.ci);
  const unique = [...new Map<number, any>(bboxes.map((b: any) => [b.cellIdx, b])).values()];
  const cells = unique.map(b => ({ ...b, ...(path ? wasm.getCellPropertiesByPath(state.sec, state.ppi, path, b.cellIdx) : wasm.getCellProperties(state.sec, state.ppi, state.ci, b.cellIdx)) }));
  return { state, path, cells, updates: axis === 'height' ? planEqualHeights(cells, state, dims.rowCount, dims.colCount, wasm.getTableProperties(state.sec, state.ppi, state.ci).tableHeight) : planEqualCells(cells, state, dims.rowCount, dims.colCount, axis) };
}

export function installEqualCells(registry: any, input: () => any) {
  for (const axis of ['height', 'width'] as const) {
    const id = `table:cell-${axis}-equal`, label = axis === 'width' ? '셀 너비를 같게 (칸 전체)' : '셀 높이를 같게 (줄 전체)';
    registry.register({ id, label, canExecute: (ctx: any) => {
      if (!ctx.hasDocument || !ctx.isEditable || ctx.isFormMode || !ctx.inCellSelectionMode) return false;
      try { readPlan(input(), axis); return true; } catch { return false; }
    }, execute: () => {
      const ih = input(); ih.flushDeferredPaginationIfNeeded('equal-cell-size');
      const { state, path, cells, updates } = readPlan(ih, axis);
      if (!updates.length) return; // Already equal: do not create undo or dirty state.
      ih.executeOperation({ kind: 'snapshot', operationType: `equalCell${axis}`, operation: (wasm: any) => {
        if (axis === 'height') {
          for (const update of updates) {
            const original = cells.find(c => c.cellIdx === update.cellIdx)!;
            wasm.setCellProperties(state.sec, state.ppi, state.ci, update.cellIdx, { height: original.height + update.heightDelta! });
          }
          return ih.cursor.getPosition();
        }
        const result = path ? wasm.resizeTableCellsByPath(state.sec, state.ppi, path, updates) : wasm.resizeTableCells(state.sec, state.ppi, state.ci, updates);
        if (result?.ok === false) throw new Error('셀 크기를 변경하지 못했습니다.');
        return ih.cursor.getPosition();
      } });
      ih.cursor.restoreCellSelection(state); ih.updateCellSelection(); ih.caret.hide(); ih.focus();
    } });
    for (const item of document.querySelectorAll<HTMLElement>(`[data-cmd="${id}"]`)) {
      item.title = equalCellHelp; item.removeAttribute('aria-disabled');
      const text = item.querySelector('.md-label'); if (text) text.textContent = label;
    }
  }
}
