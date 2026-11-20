import {sha256} from '@noble/hashes/sha2.js';

export type TableBoundaryOperationB068 = Readonly<
  | {kind: 'erase'; row: number; column: number; direction: 'right' | 'down'}
  | {kind: 'draw'; row: number; column: number}
>;

export interface TableAddressB068 {readonly section: number; readonly paragraph: number; readonly control: number}
export interface TableBoundaryContextB068 {
  documentIdentity(): unknown;
  revision(): unknown;
  story(): unknown;
  editable(): unknown;
  protected(): unknown;
}
export interface TableBoundaryHostB068 {
  getControls(): unknown;
  getTableDimensions(section: number, paragraph: number, control: number): unknown;
  getTableCellBboxes(section: number, paragraph: number, control: number): unknown;
  getCellOwnProperties(section: number, paragraph: number, control: number, cell: number): unknown;
  getCellParagraphCount(section: number, paragraph: number, control: number, cell: number): number;
  getCellParagraphLength(section: number, paragraph: number, control: number, cell: number, cellParagraph: number): number;
  mergeTableCells(section: number, paragraph: number, control: number, startRow: number, startColumn: number, endRow: number, endColumn: number): unknown;
  splitTableCell(section: number, paragraph: number, control: number, row: number, column: number): unknown;
  saveSnapshot(): number;
  restoreSnapshot(token: number): unknown;
  discardSnapshot(token: number): void;
}

type Cell = Readonly<{cellIdx: number; row: number; col: number; rowSpan: number; colSpan: number; pageIndex: number}>;
type TableState = Readonly<{rows: number; columns: number; cells: readonly Cell[]; fingerprint: string}>;
export interface TableBoundaryPlanB068 {
  readonly version: 1;
  readonly documentIdentity: string;
  readonly revision: string;
  readonly address: TableAddressB068;
  readonly operation: TableBoundaryOperationB068;
  readonly before: TableState;
  readonly fingerprint: string;
}
export type TableBoundaryTransitionB068 =
  | {status: 'applied'; command: TableBoundaryCommandB068}
  | {status: 'restored'}
  | {status: 'blocked'; reason: string}
  | {status: 'state-uncertain'; reason: 'rollback-failed'};

const id = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,255}$/u;
const required = ['getControls', 'getTableDimensions', 'getTableCellBboxes', 'getCellOwnProperties',
  'getCellParagraphCount', 'getCellParagraphLength', 'mergeTableCells', 'splitTableCell',
  'saveSnapshot', 'restoreSnapshot', 'discardSnapshot'] as const;
const integer = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const parsed = (value: unknown): unknown => typeof value === 'string' ? JSON.parse(value) : value;
const accepted = (value: unknown): boolean => {
  try { const result = parsed(value); return record(result) && result.ok === true; } catch { return false; }
};
const hash = (value: unknown): string => [...sha256(new TextEncoder().encode(JSON.stringify(value)))]
  .map(byte => byte.toString(16).padStart(2, '0')).join('');

function api(host: Partial<TableBoundaryHostB068>): host is TableBoundaryHostB068 {
  return required.every(name => typeof (host as Record<string, unknown>)[name] === 'function');
}

function context(port: TableBoundaryContextB068): {identity: string; revision: string} | undefined {
  try {
    const identity = port.documentIdentity(), revision = port.revision();
    return typeof identity === 'string' && id.test(identity) && typeof revision === 'string' && id.test(revision)
      && port.story() === 'body' && port.editable() === true && port.protected() !== true ? {identity, revision} : undefined;
  } catch { return undefined; }
}

function address(value: unknown): TableAddressB068 | undefined {
  if (!record(value) || Object.keys(value).some(key => !['section', 'paragraph', 'control'].includes(key))
    || !integer(value.section) || !integer(value.paragraph) || !integer(value.control)) return undefined;
  return {section: value.section, paragraph: value.paragraph, control: value.control};
}

function operation(value: unknown): TableBoundaryOperationB068 | undefined {
  if (!record(value) || (value.kind !== 'erase' && value.kind !== 'draw') || !integer(value.row) || !integer(value.column)) return undefined;
  if (value.kind === 'draw') {
    if (Object.keys(value).some(key => !['kind', 'row', 'column'].includes(key))) return undefined;
    return {kind: 'draw', row: value.row, column: value.column};
  }
  if (Object.keys(value).some(key => !['kind', 'row', 'column', 'direction'].includes(key))
    || (value.direction !== 'right' && value.direction !== 'down')) return undefined;
  return {kind: 'erase', row: value.row, column: value.column, direction: value.direction};
}

function tableState(host: TableBoundaryHostB068, at: TableAddressB068): TableState {
  const dimensions = parsed(host.getTableDimensions(at.section, at.paragraph, at.control));
  const rawCells = parsed(host.getTableCellBboxes(at.section, at.paragraph, at.control));
  const controls = parsed(host.getControls());
  if (!record(dimensions) || !integer(dimensions.rowCount) || !integer(dimensions.colCount) || !integer(dimensions.cellCount)
    || dimensions.rowCount < 1 || dimensions.colCount < 1 || dimensions.rowCount * dimensions.colCount > 400
    || !Array.isArray(rawCells) || rawCells.length !== dimensions.cellCount || !Array.isArray(controls)) throw new Error('table-state');
  const rows = dimensions.rowCount, columns = dimensions.colCount, cellCount = dimensions.cellCount;
  const control = controls.filter(item => record(item) && item.ctrlId === 'tbl' && item.list === 0
    && item.para === at.paragraph && item.controlIndex === at.control);
  if (control.length !== 1 || !record(control[0]) || !record(control[0].props) || control[0].props.Lock !== 0) throw new Error('protected-table');
  const cells: Cell[] = rawCells.map(raw => {
    if (!record(raw) || !integer(raw.cellIdx) || !integer(raw.row) || !integer(raw.col)
      || !integer(raw.rowSpan) || raw.rowSpan < 1 || !integer(raw.colSpan) || raw.colSpan < 1 || !integer(raw.pageIndex)) throw new Error('cell-map');
    if (raw.row + raw.rowSpan > rows || raw.col + raw.colSpan > columns) throw new Error('cell-map');
    const props = parsed(host.getCellOwnProperties(at.section, at.paragraph, at.control, raw.cellIdx));
    if (!record(props) || props.cellProtect !== false || props.fieldName !== ''
      || host.getCellParagraphCount(at.section, at.paragraph, at.control, raw.cellIdx) !== 1
      || host.getCellParagraphLength(at.section, at.paragraph, at.control, raw.cellIdx, 0) !== 0) throw new Error('nonempty-cell');
    return {cellIdx: raw.cellIdx, row: raw.row, col: raw.col, rowSpan: raw.rowSpan, colSpan: raw.colSpan, pageIndex: raw.pageIndex};
  });
  if (new Set(cells.map(cell => cell.cellIdx)).size !== cells.length || new Set(cells.map(cell => cell.pageIndex)).size !== 1) throw new Error('cell-map');
  if (cells.length !== cellCount) throw new Error('cell-map');
  const stable = {rows, columns,
    cells: cells.sort((left, right) => left.row - right.row || left.col - right.col || left.cellIdx - right.cellIdx)};
  return {...stable, fingerprint: hash(stable)};
}

function assertOperation(state: TableState, op: TableBoundaryOperationB068): void {
  const primary = state.cells.find(cell => cell.row === op.row && cell.col === op.column);
  if (!primary) throw new Error('target-cell');
  if (op.kind === 'draw') {
    if (primary.rowSpan * primary.colSpan <= 1) throw new Error('no-erased-boundary');
    return;
  }
  if (primary.rowSpan !== 1 || primary.colSpan !== 1) throw new Error('merged-cell');
  const adjacent = op.direction === 'right'
    ? state.cells.find(cell => cell.row === op.row && cell.col === op.column + 1)
    : state.cells.find(cell => cell.row === op.row + 1 && cell.col === op.column);
  if (!adjacent || adjacent.rowSpan !== 1 || adjacent.colSpan !== 1) throw new Error('missing-adjacent-cell');
}

function sameState(left: TableState, right: TableState): boolean {
  return left.rows === right.rows && left.columns === right.columns && left.fingerprint === right.fingerprint;
}

function mutate(host: TableBoundaryHostB068, at: TableAddressB068, op: TableBoundaryOperationB068): boolean {
  if (op.kind === 'draw') return accepted(host.splitTableCell(at.section, at.paragraph, at.control, op.row, op.column));
  const endRow = op.row + (op.direction === 'down' ? 1 : 0), endColumn = op.column + (op.direction === 'right' ? 1 : 0);
  return accepted(host.mergeTableCells(at.section, at.paragraph, at.control, op.row, op.column, endRow, endColumn));
}

export function captureTableBoundaryB068(
  host: Partial<TableBoundaryHostB068>, port: TableBoundaryContextB068, addressInput: unknown, operationInput: unknown,
): TableBoundaryPlanB068 {
  if (!api(host)) throw new Error('이 편집 엔진은 검증 가능한 표 그리기·지우개를 지원하지 않습니다.');
  const current = context(port), at = address(addressInput), op = operation(operationInput);
  if (!current || !at || !op) throw new Error('표 그리기·지우개 대상을 확인하지 못했습니다.');
  const before = tableState(host, at); assertOperation(before, op);
  const unsigned = {version: 1 as const, documentIdentity: current.identity, revision: current.revision, address: at, operation: op, before};
  return Object.freeze({...unsigned, fingerprint: hash(unsigned)});
}

export function applyTableBoundaryB068(
  host: Partial<TableBoundaryHostB068>, port: TableBoundaryContextB068, plan: TableBoundaryPlanB068,
): TableBoundaryTransitionB068 {
  if (!api(host)) return {status: 'blocked', reason: 'api-unavailable'};
  const current = context(port), at = address(plan?.address), op = operation(plan?.operation);
  if (!current || !at || !op || plan.version !== 1 || !/^[0-9a-f]{64}$/u.test(plan.fingerprint)) return {status: 'blocked', reason: 'invalid-plan'};
  const live = tableState(host, at);
  const unsigned = {version: 1 as const, documentIdentity: plan.documentIdentity, revision: plan.revision, address: at, operation: op, before: plan.before};
  if (hash(unsigned) !== plan.fingerprint || current.identity !== plan.documentIdentity || current.revision !== plan.revision
    || !sameState(live, plan.before)) return {status: 'blocked', reason: 'stale-table'};
  let token: number;
  try { token = host.saveSnapshot(); } catch { return {status: 'blocked', reason: 'history-unavailable'}; }
  if (!integer(token)) return {status: 'blocked', reason: 'history-unavailable'};
  try {
    if (!mutate(host, at, op)) throw new Error('mutation');
    const after = tableState(host, at), changed = context(port), expectedDelta = op.kind === 'draw'
      ? (live.cells.find(cell => cell.row === op.row && cell.col === op.column)!.rowSpan
        * live.cells.find(cell => cell.row === op.row && cell.col === op.column)!.colSpan - 1) : -1;
    if (!changed || changed.identity !== plan.documentIdentity || changed.revision === plan.revision
      || after.rows !== live.rows || after.columns !== live.columns || after.cells.length !== live.cells.length + expectedDelta) throw new Error('verification');
    return {status: 'applied', command: new TableBoundaryCommandB068(host, port, plan, token, after, changed.revision)};
  } catch {
    try {
      if (!accepted(host.restoreSnapshot(token)) || !sameState(tableState(host, at), live)) throw new Error('rollback');
      host.discardSnapshot(token); return {status: 'blocked', reason: 'verification-failed'};
    } catch { return {status: 'state-uncertain', reason: 'rollback-failed'}; }
  }
}

export class TableBoundaryCommandB068 {
  #position: 'before' | 'after' | 'disposed' = 'after';
  private readonly host: TableBoundaryHostB068;
  private readonly port: TableBoundaryContextB068;
  private readonly plan: TableBoundaryPlanB068;
  private readonly token: number;
  private readonly after: TableState;
  private readonly afterRevision: string;
  constructor(host: TableBoundaryHostB068, port: TableBoundaryContextB068, plan: TableBoundaryPlanB068, token: number, after: TableState, afterRevision: string) {
    this.host = host; this.port = port; this.plan = plan; this.token = token; this.after = after; this.afterRevision = afterRevision;
  }
  undo(): TableBoundaryTransitionB068 {
    const current = context(this.port);
    if (this.#position !== 'after' || !current || current.revision !== this.afterRevision
      || !sameState(tableState(this.host, this.plan.address), this.after)) return {status: 'blocked', reason: 'history-state-mismatch'};
    try {
      if (!accepted(this.host.restoreSnapshot(this.token)) || !sameState(tableState(this.host, this.plan.address), this.plan.before)) throw new Error('restore');
      this.#position = 'before'; return {status: 'restored'};
    } catch { return {status: 'state-uncertain', reason: 'rollback-failed'}; }
  }
  redo(): TableBoundaryTransitionB068 {
    const current = context(this.port);
    if (this.#position !== 'before' || !current || current.revision !== this.plan.revision
      || !sameState(tableState(this.host, this.plan.address), this.plan.before)) return {status: 'blocked', reason: 'history-state-mismatch'};
    if (!mutate(this.host, this.plan.address, this.plan.operation)) return {status: 'blocked', reason: 'mutation-rejected'};
    const changed = context(this.port);
    if (!changed || changed.revision !== this.afterRevision || !sameState(tableState(this.host, this.plan.address), this.after)) {
      try { this.host.restoreSnapshot(this.token); } catch { return {status: 'state-uncertain', reason: 'rollback-failed'}; }
      return {status: 'blocked', reason: 'verification-failed'};
    }
    this.#position = 'after'; return {status: 'restored'};
  }
  dispose(): void { if (this.#position !== 'disposed') { this.#position = 'disposed'; try { this.host.discardSnapshot(this.token); } catch {} } }
}
