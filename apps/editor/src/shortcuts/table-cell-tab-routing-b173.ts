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
  /** Canonical cell/paragraph-format proof. Required by the atomic append adapter. */
  formatFingerprint?: string;
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
  /** Stable identity of the borrowed open document, never a file path. */
  documentIdentity?: object;
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
  appendRowAfterLastCell(): AtomicRowAppendTransitionB173 | false;
}

export interface AtomicRowAppendDocumentB173 {
  saveSnapshot(): number;
  restoreSnapshot(token: number): unknown;
  discardSnapshot(token: number): unknown;
  insertTableRow(section: number, paragraph: number, control: number, row: number, after: boolean): unknown;
}

export interface AtomicRowAppendTransitionB173 {
  readonly beforeRevision: number;
  readonly afterRevision: number;
  undo(): boolean;
  commit(): void;
  rollback(): boolean;
}

export type AtomicRowAppendHostB173 = Readonly<{
  document: AtomicRowAppendDocumentB173;
  capture(): TableCellTabEvidenceB173;
  moveToCellNext(): void;
}>;

export class AtomicRowAppendStateUncertainB173 extends Error {
  constructor() { super('표 마지막 행 추가 실패 뒤 원래 상태를 확인하지 못했습니다.'); }
}

export type TableCellTabEventControlB173 = Readonly<{
  preventDefault(): void;
  stopImmediatePropagation(): void;
}>;

export type TableCellTabExecutionB173 =
  | Readonly<{status: 'pass-through'; owner: 'document-tab-cycle' | 'editor-default'; reason: string}>
  | Readonly<{status: 'table-shortcut'; owner: 'literal-tab' | 'hanging-indent'}>
  | Readonly<{status: 'blocked'; reason: string}>
  | Readonly<{status: 'applied'; action: TableCellTabActionB173; transition?: AtomicRowAppendTransitionB173}>
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

function accepted(value: unknown): boolean {
  if (typeof value === 'string') {
    try { return accepted(JSON.parse(value)); } catch { return false; }
  }
  return value === undefined || value === true || (value !== null && typeof value === 'object'
    && !Array.isArray(value) && (value as {ok?: unknown}).ok !== false);
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
    cells.map(cell => `${cell.cellIndex}:${cell.row}:${cell.col}:${cell.rowSpan}:${cell.colSpan}:${cell.formatFingerprint ?? '-'}`).join('|')].join(';');
}

function tableStateStamp(evidence: TableCellTabEvidenceB173): string | undefined {
  if (!exactPosition(evidence.position)) return undefined;
  const cells = normalizedCells(evidence.cells);
  if (!cells) return undefined;
  const position = evidence.position;
  return [position.sectionIndex, position.parentParaIndex, position.controlIndex,
    cells.map(cell => `${cell.cellIndex}:${cell.row}:${cell.col}:${cell.rowSpan}:${cell.colSpan}:${cell.formatFingerprint ?? '-'}`).join('|')].join(';');
}

function exactSimpleLastRow(evidence: TableCellTabEvidenceB173): {
  cells: TableCellBoxB173[]; rows: number; columns: number; firstColumn: number; lastRow: number;
} | undefined {
  const cells = normalizedCells(evidence.cells);
  if (!cells?.length || cells.some(cell => cell.rowSpan !== 1 || cell.colSpan !== 1
    || typeof cell.formatFingerprint !== 'string' || cell.formatFingerprint.length < 1)) return undefined;
  const firstColumn = Math.min(...cells.map(cell => cell.col));
  const lastColumn = Math.max(...cells.map(cell => cell.col));
  const firstRow = Math.min(...cells.map(cell => cell.row));
  const lastRow = Math.max(...cells.map(cell => cell.row));
  if (firstColumn !== 0 || firstRow !== 0) return undefined;
  const columns = lastColumn + 1, rows = lastRow + 1;
  if (columns < 1 || rows < 1 || cells.length !== rows * columns || rows >= 50 || cells.length + columns > 200) return undefined;
  const slots = new Set(cells.map(cell => `${cell.row}:${cell.col}`));
  if (slots.size !== cells.length) return undefined;
  for (let row = 0; row < rows; row += 1) for (let column = 0; column < columns; column += 1)
    if (!slots.has(`${row}:${column}`)) return undefined;
  return {cells, rows, columns, firstColumn, lastRow};
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
 * Performs the last-cell row append through the real document API.  Only a
 * rectangular, unmerged top-level table with exact format fingerprints is
 * accepted.  The returned transition owns the sole snapshot: callers must
 * either keep it for one undo step or call commit after their history layer
 * has adopted the operation.
 */
export function appendLastTableRowAtomicB173(host: AtomicRowAppendHostB173): AtomicRowAppendTransitionB173 | false {
  const before = host.capture();
  const simple = exactSimpleLastRow(before);
  const position = before.position;
  if (!before.atomicAppendRow || !before.documentIdentity || before.documentIdentity !== host.document
    || !exactPosition(position) || (position.cellPath?.length ?? 0) > 1 || !simple) return false;
  const last = simple.cells[simple.cells.length - 1];
  if (position.cellIndex !== last.cellIndex) return false;
  const beforeState = tableStateStamp(before);
  const live = host.capture();
  if (live.documentIdentity !== before.documentIdentity || live.revision !== before.revision
    || tableStateStamp(live) !== beforeState) return false;
  const token = host.document.saveSnapshot();
  if (!integer(token)) return false;
  let active = true;
  const restore = (): boolean => {
    if (!active) return false;
    try {
      if (!accepted(host.document.restoreSnapshot(token))) return false;
      const restored = host.capture();
      if (restored.documentIdentity !== before.documentIdentity || tableStateStamp(restored) !== beforeState) return false;
      if (!accepted(host.document.discardSnapshot(token))) return false;
      active = false;
      return true;
    } catch { return false; }
  };
  try {
    if (!accepted(host.document.insertTableRow(position.sectionIndex, position.parentParaIndex,
      position.controlIndex, simple.lastRow, true))) throw new Error('row append rejected');
    host.moveToCellNext();
    const after = host.capture(), afterSimple = exactSimpleLastRow(after);
    if (after.documentIdentity !== before.documentIdentity || after.revision <= before.revision
      || !afterSimple || afterSimple.rows !== simple.rows + 1 || afterSimple.columns !== simple.columns
      || !validateAfter({kind: 'append-row', afterRow: simple.lastRow, expectedFirstColumn: simple.firstColumn}, before, after))
      throw new Error('row append readback mismatch');
    const sourceRow = simple.cells.filter(cell => cell.row === simple.lastRow).sort((a, b) => a.col - b.col);
    const appendedRow = afterSimple.cells.filter(cell => cell.row === simple.rows).sort((a, b) => a.col - b.col);
    if (sourceRow.length !== simple.columns || appendedRow.length !== simple.columns
      || sourceRow.some((cell, index) => cell.col !== appendedRow[index].col
        || cell.rowSpan !== appendedRow[index].rowSpan || cell.colSpan !== appendedRow[index].colSpan
        || cell.formatFingerprint !== appendedRow[index].formatFingerprint))
      throw new Error('row append format mismatch');
    const afterState = tableStateStamp(after)!;
    const afterRevision = after.revision;
    const transition: AtomicRowAppendTransitionB173 = Object.freeze({
      beforeRevision: before.revision,
      afterRevision,
      undo(): boolean {
        const current = host.capture();
        if (!active || current.documentIdentity !== before.documentIdentity
          || current.revision !== afterRevision || tableStateStamp(current) !== afterState) return false;
        return restore();
      },
      commit(): void {
        if (!active) return;
        if (!accepted(host.document.discardSnapshot(token))) throw new Error('row append snapshot discard failed');
        active = false;
      },
      rollback: restore,
    });
    return transition;
  } catch {
    if (!restore()) throw new AtomicRowAppendStateUncertainB173();
    return false;
  }
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
  let transition: AtomicRowAppendTransitionB173 | undefined;
  try {
    if (decision.action.kind === 'move') {
      if (decision.action.direction === 'next') port.moveToCellNext();
      else port.moveToCellPrevious();
    } else if (decision.action.kind === 'exit-table') {
      port.moveToCellPrevious();
    } else {
      const appended = port.appendRowAfterLastCell();
      if (!appended) return {status: 'blocked', reason: 'row-append-rejected'};
      transition = appended;
    }
  } catch (error) {
    if (error instanceof AtomicRowAppendStateUncertainB173)
      return {status: 'state-uncertain', reason: 'row-append-rollback-unverified'};
    return {status: 'blocked', reason: 'cell-tab-operation-failed'};
  }
  const after = port.capture();
  if (!validateAfter(decision.action, live, after)) {
    if (transition?.rollback()) return {status: 'blocked', reason: 'row-append-readback-rolled-back'};
    return {status: 'state-uncertain', reason: 'cell-tab-readback-mismatch'};
  }
  return {status: 'applied', action: decision.action, ...(transition ? {transition} : {})};
}
