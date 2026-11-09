/**
 * B173 table-cell Tab ownership and execution seam.
 *
 * The host uses Ctrl+Tab for document tabs while the editor uses plain Tab /
 * Shift+Tab for cell navigation.  This module keeps those decisions separate
 * and deliberately consumes an ambiguous key once live evidence says that the
 * key originated in a table cell.  It never synthesizes keys or falls back to
 * document-tab cycling after a failed cell operation.
 */

export type TableCellTabKeyB173 = Readonly<{
  key: string;
  code?: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  isComposing: boolean;
  keyCode: number;
  defaultPrevented: boolean;
}>;

export type TableCellBoxB173 = Readonly<{
  cellIndex: number;
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
}>;

export type TableCellPositionB173 = Readonly<{
  sectionIndex: number;
  parentParaIndex: number;
  controlIndex: number;
  cellIndex: number;
  /** More than one entry means a table nested in another cell. */
  cellPath?: readonly Readonly<{controlIndex: number; cellIndex: number; cellParaIndex: number}>[];
}>;

export type TableCellTabEvidenceB173 = Readonly<{
  revision: number;
  active: boolean;
  hasDocument: boolean;
  editable: boolean;
  formMode: boolean;
  passwordProtected: boolean;
  handlerComposing: boolean;
  inCell: boolean;
  inTextBox: boolean;
  cellSelectionMode: boolean;
  tableObjectSelection: boolean;
  pictureObjectSelection: boolean;
  textSelection: boolean;
  position?: TableCellPositionB173;
  cells?: readonly TableCellBoxB173[];
  /** The current engine has an undoable snapshot operation for top-level row append. */
  atomicAppendRow: boolean;
}>;

export type TableCellTabActionB173 =
  | Readonly<{kind: 'move'; direction: 'next' | 'previous'; expectedCellIndex: number}>
  | Readonly<{kind: 'exit-table'; direction: 'previous'}>
  | Readonly<{kind: 'append-row'; afterRow: number; expectedFirstColumn: number}>;

export type TableCellTabDecisionB173 =
  | Readonly<{status: 'pass-through'; owner: 'document-tab-cycle' | 'editor-default'; reason: string}>
  | Readonly<{status: 'table-shortcut'; owner: 'literal-tab' | 'hanging-indent'}>
  | Readonly<{status: 'blocked'; consume: boolean; reason: string}>
  | Readonly<{status: 'ready'; consume: true; stamp: string; action: TableCellTabActionB173}>;

export interface TableCellTabPortB173 {
  capture(): TableCellTabEvidenceB173;
  moveToCellNext(): void;
  moveToCellPrevious(): void;
  appendRowAfterLastCell(): boolean;
}

export type TableCellTabEventControlB173 = Readonly<{
  preventDefault(): void;
  stopImmediatePropagation(): void;
}>;

export type TableCellTabExecutionB173 =
  | Readonly<{status: 'pass-through'; owner: 'document-tab-cycle' | 'editor-default'; reason: string}>
  | Readonly<{status: 'table-shortcut'; owner: 'literal-tab' | 'hanging-indent'}>
  | Readonly<{status: 'blocked'; reason: string}>
  | Readonly<{status: 'applied'; action: TableCellTabActionB173}>
  | Readonly<{status: 'state-uncertain'; reason: string}>;

function integer(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function exactPosition(value: TableCellPositionB173 | undefined): value is TableCellPositionB173 {
  if (!value || !integer(value.sectionIndex) || !integer(value.parentParaIndex)
    || !integer(value.controlIndex) || !integer(value.cellIndex)) return false;
  return value.cellPath === undefined || (value.cellPath.length > 0 && value.cellPath.every(entry =>
    integer(entry.controlIndex) && integer(entry.cellIndex) && integer(entry.cellParaIndex)));
}

function normalizedCells(cells: readonly TableCellBoxB173[] | undefined): TableCellBoxB173[] | undefined {
  if (!cells?.length || cells.some(cell => !integer(cell.cellIndex) || !integer(cell.row)
    || !integer(cell.col) || !integer(cell.rowSpan) || cell.rowSpan < 1
    || !integer(cell.colSpan) || cell.colSpan < 1)) return undefined;
  const byIndex = new Map<number, TableCellBoxB173>();
  for (const cell of cells) {
    const existing = byIndex.get(cell.cellIndex);
    if (existing && (existing.row !== cell.row || existing.col !== cell.col
      || existing.rowSpan !== cell.rowSpan || existing.colSpan !== cell.colSpan)) return undefined;
    byIndex.set(cell.cellIndex, cell);
  }
  const result = [...byIndex.values()].sort((left, right) =>
    left.row - right.row || left.col - right.col || left.cellIndex - right.cellIndex);
  for (let index = 1; index < result.length; index += 1) {
    const previous = result[index - 1];
    const current = result[index];
    if (previous.row === current.row && previous.col === current.col) return undefined;
  }
  return result;
}

function isTab(key: TableCellTabKeyB173): boolean {
  return key.key === 'Tab' || key.code === 'Tab';
}

function tableHint(evidence: TableCellTabEvidenceB173): boolean {
  return evidence.inCell || evidence.cellSelectionMode || evidence.tableObjectSelection
    || evidence.position !== undefined;
}

function stamp(evidence: TableCellTabEvidenceB173, cells: readonly TableCellBoxB173[]): string {
  const position = evidence.position!;
  const path = position.cellPath?.map(entry =>
    `${entry.controlIndex}:${entry.cellIndex}:${entry.cellParaIndex}`).join('/') ?? '-';
  return [evidence.revision, position.sectionIndex, position.parentParaIndex,
    position.controlIndex, position.cellIndex, path,
    cells.map(cell => `${cell.cellIndex}:${cell.row}:${cell.col}:${cell.rowSpan}:${cell.colSpan}`).join('|')].join(';');
}

/**
 * Resolve ownership before either the iframe editor or host document-tabs act.
 * Only Ctrl+Tab in exact body context is a document-tab key.  Ctrl+Tab in a
 * cell remains the existing literal-tab shortcut; Ctrl+Shift+Tab remains the
 * table hanging-indent shortcut.
 */
export function resolveTableCellTabB173(
  key: TableCellTabKeyB173,
  evidence: TableCellTabEvidenceB173,
): TableCellTabDecisionB173 {
  if (!isTab(key)) return {status: 'pass-through', owner: 'editor-default', reason: 'not-tab'};
  if (key.defaultPrevented) return {status: 'blocked', consume: false, reason: 'already-consumed'};

  const hinted = tableHint(evidence);
  if (key.isComposing || key.keyCode === 229 || evidence.handlerComposing) {
    return hinted
      ? {status: 'blocked', consume: true, reason: 'ime-composition-in-table'}
      : {status: 'pass-through', owner: 'editor-default', reason: 'ime-composition'};
  }
  if (key.altKey || key.metaKey) {
    return hinted
      ? {status: 'blocked', consume: true, reason: 'unsupported-table-modifier'}
      : {status: 'pass-through', owner: 'editor-default', reason: 'unsupported-modifier'};
  }
  if (key.ctrlKey) {
    if (!hinted) return {status: 'pass-through', owner: 'document-tab-cycle', reason: 'exact-body-ctrl-tab'};
    if (!evidence.inCell || evidence.inTextBox || evidence.cellSelectionMode
      || evidence.tableObjectSelection || evidence.pictureObjectSelection || evidence.textSelection) {
      return {status: 'blocked', consume: true, reason: 'ambiguous-table-shortcut-context'};
    }
    return {status: 'table-shortcut', owner: key.shiftKey ? 'hanging-indent' : 'literal-tab'};
  }

  if (!hinted) return {status: 'pass-through', owner: 'editor-default', reason: 'plain-tab-outside-table'};
  if (!evidence.active || !evidence.hasDocument || !evidence.editable || evidence.formMode
    || evidence.passwordProtected) return {status: 'blocked', consume: true, reason: 'editor-not-mutable'};
  if (!evidence.inCell || evidence.inTextBox || evidence.cellSelectionMode
    || evidence.tableObjectSelection || evidence.pictureObjectSelection) {
    return {status: 'blocked', consume: true, reason: 'ambiguous-cell-owner'};
  }
  if (evidence.textSelection) return {status: 'blocked', consume: true, reason: 'text-selection-active'};
  if (!exactPosition(evidence.position)) return {status: 'blocked', consume: true, reason: 'invalid-cell-position'};
  const cells = normalizedCells(evidence.cells);
  if (!cells) return {status: 'blocked', consume: true, reason: 'invalid-table-geometry'};
  const current = cells.findIndex(cell => cell.cellIndex === evidence.position!.cellIndex);
  if (current < 0) return {status: 'blocked', consume: true, reason: 'current-cell-not-in-table'};
  const evidenceStamp = stamp(evidence, cells);

  if (key.shiftKey) {
    if (current === 0) return {
      status: 'ready', consume: true, stamp: evidenceStamp,
      action: {kind: 'exit-table', direction: 'previous'},
    };
    return {
      status: 'ready', consume: true, stamp: evidenceStamp,
      action: {kind: 'move', direction: 'previous', expectedCellIndex: cells[current - 1].cellIndex},
    };
  }
  if (current + 1 < cells.length) return {
    status: 'ready', consume: true, stamp: evidenceStamp,
    action: {kind: 'move', direction: 'next', expectedCellIndex: cells[current + 1].cellIndex},
  };

  const nested = (evidence.position.cellPath?.length ?? 0) > 1;
  if (nested) return {status: 'blocked', consume: true, reason: 'nested-last-cell-row-append-unsupported'};
  if (!evidence.atomicAppendRow) return {status: 'blocked', consume: true, reason: 'atomic-row-append-unavailable'};
  const currentCell = cells[current];
  return {
    status: 'ready', consume: true, stamp: evidenceStamp,
    action: {
      kind: 'append-row',
      afterRow: currentCell.row + currentCell.rowSpan - 1,
      expectedFirstColumn: Math.min(...cells.map(cell => cell.col)),
    },
  };
}

function sameTable(left: TableCellPositionB173, right: TableCellPositionB173): boolean {
  const leftOuter = left.cellPath?.[0]?.controlIndex ?? left.controlIndex;
  const rightOuter = right.cellPath?.[0]?.controlIndex ?? right.controlIndex;
  return left.sectionIndex === right.sectionIndex
    && left.parentParaIndex === right.parentParaIndex && leftOuter === rightOuter;
}

function validateAfter(
  action: TableCellTabActionB173,
  before: TableCellTabEvidenceB173,
  after: TableCellTabEvidenceB173,
): boolean {
  if (action.kind === 'exit-table') return !after.inCell && !after.cellSelectionMode
    && !after.tableObjectSelection && !after.pictureObjectSelection;
  if (!exactPosition(before.position) || !exactPosition(after.position) || !after.inCell
    || !sameTable(before.position, after.position)) return false;
  if (action.kind === 'move') return after.position.cellIndex === action.expectedCellIndex;
  const afterCells = normalizedCells(after.cells);
  if (!afterCells || afterCells.length <= (normalizedCells(before.cells)?.length ?? Number.MAX_SAFE_INTEGER)) return false;
  const target = afterCells.find(cell => cell.cellIndex === after.position!.cellIndex);
  return Boolean(target && target.row === action.afterRow + 1 && target.col === action.expectedFirstColumn);
}

/**
 * Executes only a certified plain cell Tab.  A second evidence capture closes
 * the host capture/InputHandler race.  A consumed failure is never retried as
 * document-tab cycling.
 */
export function executeTableCellTabB173(
  key: TableCellTabKeyB173,
  control: TableCellTabEventControlB173,
  port: TableCellTabPortB173,
): TableCellTabExecutionB173 {
  const before = port.capture();
  const decision = resolveTableCellTabB173(key, before);
  if (decision.status === 'pass-through' || decision.status === 'table-shortcut') return decision;
  if (decision.consume) {
    control.preventDefault();
    control.stopImmediatePropagation();
  }
  if (decision.status === 'blocked') return {status: 'blocked', reason: decision.reason};

  const live = port.capture();
  const liveDecision = resolveTableCellTabB173(key, live);
  if (liveDecision.status !== 'ready' || liveDecision.stamp !== decision.stamp) {
    return {status: 'blocked', reason: 'cell-tab-evidence-stale'};
  }
  try {
    if (decision.action.kind === 'move') {
      if (decision.action.direction === 'next') port.moveToCellNext();
      else port.moveToCellPrevious();
    } else if (decision.action.kind === 'exit-table') {
      port.moveToCellPrevious();
    } else if (!port.appendRowAfterLastCell()) {
      return {status: 'blocked', reason: 'row-append-rejected'};
    }
  } catch {
    return {status: 'blocked', reason: 'cell-tab-operation-failed'};
  }
  const after = port.capture();
  if (!validateAfter(decision.action, live, after)) {
    return {status: 'state-uncertain', reason: 'cell-tab-readback-mismatch'};
  }
  return {status: 'applied', action: decision.action};
}
