export type CellBorderShortcutKeyB154B155 = 'L' | 'C' | 'B' | 'F';

export type CellBorderShortcutBlockReasonB154B155 =
  | 'unsupported-shortcut'
  | 'not-cell-selection'
  | 'protected-selection'
  | 'non-rectangular-selection'
  | 'unsupported-nested-table'
  | 'selection-state-conflict'
  | 'invalid-selection-range'
  | 'table-evidence-unavailable'
  | 'ambiguous-cell-grid'
  | 'multiple-cells-required'
  | 'stale-selection';

type Point = Readonly<{row: number; col: number}>;
type Range = Readonly<{startRow: number; startCol: number; endRow: number; endCol: number}>;
type TableContext = Readonly<{sec: number; ppi: number; ci: number; cellPath?: readonly unknown[]}>;
type CursorPosition = Readonly<{
  sectionIndex: number;
  parentParaIndex?: number;
  controlIndex?: number;
  cellIndex?: number;
  cellPath?: readonly unknown[];
}>;
type CellSelectionState = Readonly<{
  sec: number;
  ppi: number;
  ci: number;
  cellPath?: readonly unknown[];
  anchor: Point;
  focus: Point;
  phase: number;
  reason: string;
  excluded: readonly string[];
}>;
type Dimensions = Readonly<{rowCount: number; colCount: number; cellCount: number}>;
type CellBox = Readonly<{
  cellIdx: number;
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
}>;

export type CellBorderShortcutPortB154B155 = Readonly<{
  isInCellSelectionMode(): boolean;
  hasMultiCellSelection(): boolean;
  getSelectedCellRange(): unknown;
  getCellTableContext(): unknown;
  getCursorPosition(): unknown;
  hasExcludedCellSelection(): boolean;
  isProtectedCellSelectionMode?(): boolean;
  captureCellSelection(): unknown;
  getTableDimensions(section: number, parentParagraph: number, control: number): unknown;
  getTableCellBboxes(section: number, parentParagraph: number, control: number): unknown;
}>;

export type CellBorderShortcutTargetB154B155 = Readonly<{
  key: CellBorderShortcutKeyB154B155;
  command: 'table:border-each' | 'table:border-one';
  tab: 'border' | 'background';
  applyMode: 'each' | 'asOne';
  selection: 'single-cell' | 'multiple-cells';
  table: Readonly<{section: number; parentParagraph: number; control: number}>;
  range: Range;
  cellIndices: readonly number[];
  evidenceStamp: string;
}>;

export type CellBorderShortcutDecisionB154B155 =
  | Readonly<{status: 'ready'; target: CellBorderShortcutTargetB154B155}>
  | Readonly<{status: 'blocked'; reason: CellBorderShortcutBlockReasonB154B155}>;

const MAX_CELLS = 10_000;
const MAX_SELECTED_GRID_POINTS = 100_000;

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
const positive = (value: unknown): value is number => integer(value) && Number(value) > 0;

function point(value: unknown): Point | undefined {
  if (!record(value) || !integer(value.row) || !integer(value.col)) return;
  return {row: value.row, col: value.col};
}

function range(value: unknown): Range | undefined {
  if (!record(value)
    || !integer(value.startRow) || !integer(value.startCol)
    || !integer(value.endRow) || !integer(value.endCol)
    || value.startRow > value.endRow || value.startCol > value.endCol) return;
  return {
    startRow: value.startRow,
    startCol: value.startCol,
    endRow: value.endRow,
    endCol: value.endCol,
  };
}

function tableContext(value: unknown): TableContext | undefined {
  if (!record(value) || !integer(value.sec) || !integer(value.ppi) || !integer(value.ci)) return;
  if (value.cellPath !== undefined && !Array.isArray(value.cellPath)) return;
  return {sec: value.sec, ppi: value.ppi, ci: value.ci, cellPath: value.cellPath as readonly unknown[] | undefined};
}

function cursorPosition(value: unknown): CursorPosition | undefined {
  if (!record(value) || !integer(value.sectionIndex)) return;
  if (value.parentParaIndex !== undefined && !integer(value.parentParaIndex)) return;
  if (value.controlIndex !== undefined && !integer(value.controlIndex)) return;
  if (value.cellIndex !== undefined && !integer(value.cellIndex)) return;
  if (value.cellPath !== undefined && !Array.isArray(value.cellPath)) return;
  return value as CursorPosition;
}

function selectionState(value: unknown): CellSelectionState | undefined {
  if (!record(value) || !integer(value.sec) || !integer(value.ppi) || !integer(value.ci)
    || !integer(value.phase) || !['manual', 'protected'].includes(String(value.reason))
    || !Array.isArray(value.excluded) || value.excluded.some(item => typeof item !== 'string')
    || value.cellPath !== undefined && !Array.isArray(value.cellPath)) return;
  const anchor = point(value.anchor), focus = point(value.focus);
  if (!anchor || !focus) return;
  return {
    sec: value.sec,
    ppi: value.ppi,
    ci: value.ci,
    cellPath: value.cellPath as readonly unknown[] | undefined,
    anchor,
    focus,
    phase: value.phase,
    reason: value.reason as string,
    excluded: value.excluded as readonly string[],
  };
}

function dimensions(value: unknown): Dimensions | undefined {
  if (!record(value) || !positive(value.rowCount) || !positive(value.colCount) || !positive(value.cellCount)
    || value.cellCount > MAX_CELLS || value.cellCount > value.rowCount * value.colCount) return;
  return {rowCount: value.rowCount, colCount: value.colCount, cellCount: value.cellCount};
}

function cellBox(value: unknown): CellBox | undefined {
  if (!record(value) || !integer(value.cellIdx) || !integer(value.row) || !integer(value.col)
    || !positive(value.rowSpan) || !positive(value.colSpan)) return;
  return value as CellBox;
}

function sameRange(left: Range, right: Range): boolean {
  return left.startRow === right.startRow && left.startCol === right.startCol
    && left.endRow === right.endRow && left.endCol === right.endCol;
}

function expectedRange(state: CellSelectionState): Range {
  return {
    startRow: Math.min(state.anchor.row, state.focus.row),
    startCol: Math.min(state.anchor.col, state.focus.col),
    endRow: Math.max(state.anchor.row, state.focus.row),
    endCol: Math.max(state.anchor.col, state.focus.col),
  };
}

function intent(key: string): Pick<CellBorderShortcutTargetB154B155, 'key' | 'command' | 'tab' | 'applyMode'> | undefined {
  switch (key.toUpperCase()) {
    case 'L': return {key: 'L', command: 'table:border-each', tab: 'border', applyMode: 'each'};
    case 'C': return {key: 'C', command: 'table:border-each', tab: 'background', applyMode: 'each'};
    case 'B': return {key: 'B', command: 'table:border-one', tab: 'border', applyMode: 'asOne'};
    case 'F': return {key: 'F', command: 'table:border-one', tab: 'background', applyMode: 'asOne'};
    default: return;
  }
}

function stableStamp(value: unknown): string {
  return JSON.stringify(value);
}

/**
 * Certifies the exact cell owners targeted by Hangul's L/C/B/F cell-block
 * shortcuts. It intentionally excludes nested tables, protected/non-rectangular
 * blocks, and partial merged-cell intersections because the current dialog
 * receives only a top-level `(section, paragraph, control)` address.
 */
export function inspectCellBorderShortcutB154B155(
  key: string,
  port: CellBorderShortcutPortB154B155 | undefined,
): CellBorderShortcutDecisionB154B155 {
  const mapped = intent(key);
  if (!mapped) return {status: 'blocked', reason: 'unsupported-shortcut'};
  if (!port) return {status: 'blocked', reason: 'not-cell-selection'};

  let inSelection: boolean;
  let multiSignal: boolean;
  let excludedSignal: boolean;
  let protectedSignal: boolean;
  let rawRange: unknown;
  let rawContext: unknown;
  let rawPosition: unknown;
  let rawState: unknown;
  try {
    inSelection = port.isInCellSelectionMode();
    multiSignal = port.hasMultiCellSelection();
    excludedSignal = port.hasExcludedCellSelection();
    protectedSignal = port.isProtectedCellSelectionMode?.() === true;
    rawRange = port.getSelectedCellRange();
    rawContext = port.getCellTableContext();
    rawPosition = port.getCursorPosition();
    rawState = port.captureCellSelection();
  } catch {
    return {status: 'blocked', reason: 'selection-state-conflict'};
  }
  if (!inSelection) return {status: 'blocked', reason: 'not-cell-selection'};

  const selectedRange = range(rawRange), context = tableContext(rawContext), position = cursorPosition(rawPosition), state = selectionState(rawState);
  if (!selectedRange || !context || !position || !state) return {status: 'blocked', reason: 'selection-state-conflict'};
  if (protectedSignal || state.reason === 'protected') return {status: 'blocked', reason: 'protected-selection'};
  if (excludedSignal || state.excluded.length > 0) return {status: 'blocked', reason: 'non-rectangular-selection'};
  if ((context.cellPath?.length ?? 0) > 0 || (state.cellPath?.length ?? 0) > 0 || (position.cellPath?.length ?? 0) > 0) {
    return {status: 'blocked', reason: 'unsupported-nested-table'};
  }
  if (context.sec !== state.sec || context.ppi !== state.ppi || context.ci !== state.ci
    || position.sectionIndex !== context.sec || position.parentParaIndex !== context.ppi
    || position.controlIndex !== context.ci || !integer(position.cellIndex)
    || !sameRange(selectedRange, expectedRange(state))) {
    return {status: 'blocked', reason: 'selection-state-conflict'};
  }

  let dims: Dimensions | undefined;
  let boxes: CellBox[];
  try {
    dims = dimensions(port.getTableDimensions(context.sec, context.ppi, context.ci));
    const rawBoxes = port.getTableCellBboxes(context.sec, context.ppi, context.ci);
    if (!Array.isArray(rawBoxes) || rawBoxes.length === 0 || rawBoxes.length > MAX_CELLS) throw new Error('invalid-bboxes');
    boxes = rawBoxes.map(cellBox).filter((value): value is CellBox => Boolean(value));
    if (boxes.length !== rawBoxes.length) throw new Error('invalid-bbox');
  } catch {
    return {status: 'blocked', reason: 'table-evidence-unavailable'};
  }
  if (!dims || selectedRange.endRow >= dims.rowCount || selectedRange.endCol >= dims.colCount) {
    return {status: 'blocked', reason: 'invalid-selection-range'};
  }
  const selectedArea = (selectedRange.endRow - selectedRange.startRow + 1) * (selectedRange.endCol - selectedRange.startCol + 1);
  if (selectedArea > MAX_SELECTED_GRID_POINTS) return {status: 'blocked', reason: 'invalid-selection-range'};

  const owners = new Map<number, CellBox>();
  const coverage = new Map<string, number>();
  for (const box of boxes) {
    if (box.cellIdx >= dims.cellCount || box.row + box.rowSpan > dims.rowCount || box.col + box.colSpan > dims.colCount
      || owners.has(box.cellIdx)) return {status: 'blocked', reason: 'ambiguous-cell-grid'};
    owners.set(box.cellIdx, box);
    const intersects = box.row <= selectedRange.endRow && box.row + box.rowSpan - 1 >= selectedRange.startRow
      && box.col <= selectedRange.endCol && box.col + box.colSpan - 1 >= selectedRange.startCol;
    if (!intersects) continue;
    // A shortcut must not silently widen a block to the rest of a merged cell.
    if (box.row < selectedRange.startRow || box.col < selectedRange.startCol
      || box.row + box.rowSpan - 1 > selectedRange.endRow || box.col + box.colSpan - 1 > selectedRange.endCol) {
      return {status: 'blocked', reason: 'ambiguous-cell-grid'};
    }
    for (let row = box.row; row < box.row + box.rowSpan; row += 1) {
      for (let col = box.col; col < box.col + box.colSpan; col += 1) {
        const id = `${row}:${col}`;
        if (coverage.has(id)) return {status: 'blocked', reason: 'ambiguous-cell-grid'};
        coverage.set(id, box.cellIdx);
      }
    }
  }
  if (coverage.size !== selectedArea) return {status: 'blocked', reason: 'ambiguous-cell-grid'};
  const cellIndices = [...new Set(coverage.values())].sort((left, right) => left - right);
  if (!cellIndices.includes(position.cellIndex)) return {status: 'blocked', reason: 'selection-state-conflict'};
  const isMultiple = cellIndices.length > 1;
  if (multiSignal !== isMultiple) return {status: 'blocked', reason: 'selection-state-conflict'};
  if (mapped.applyMode === 'asOne' && !isMultiple) return {status: 'blocked', reason: 'multiple-cells-required'};

  const targetWithoutStamp = {
    ...mapped,
    selection: isMultiple ? 'multiple-cells' as const : 'single-cell' as const,
    table: {section: context.sec, parentParagraph: context.ppi, control: context.ci},
    range: selectedRange,
    cellIndices,
  };
  return {
    status: 'ready',
    target: Object.freeze({...targetWithoutStamp, evidenceStamp: stableStamp(targetWithoutStamp)}),
  };
}

/** Re-observes the live selection immediately before opening the dialog. */
export function openCellBorderShortcutB154B155(
  key: string,
  port: CellBorderShortcutPortB154B155 | undefined,
  open: (target: CellBorderShortcutTargetB154B155) => void,
): CellBorderShortcutDecisionB154B155 {
  const prepared = inspectCellBorderShortcutB154B155(key, port);
  if (prepared.status !== 'ready') return prepared;
  const live = inspectCellBorderShortcutB154B155(key, port);
  if (live.status !== 'ready' || live.target.evidenceStamp !== prepared.target.evidenceStamp) {
    return {status: 'blocked', reason: 'stale-selection'};
  }
  open(live.target);
  return live;
}
