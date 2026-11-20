export type CellSelectionPhaseB169 = 1 | 2 | 3;

export type CellSelectionPointB169 = Readonly<{ row: number; col: number }>;

/**
 * The subset of CursorState's F5 state that is needed to prove a transition.
 * It deliberately keeps the nested-table owner path opaque to this adapter.
 */
export type CellSelectionStateB169 = Readonly<{
  sec: number;
  ppi: number;
  ci: number;
  cellPath?: readonly unknown[];
  anchor: CellSelectionPointB169;
  focus: CellSelectionPointB169;
  phase: CellSelectionPhaseB169;
  reason: 'manual' | 'protected';
  excluded: readonly string[];
}>;

export type CellSelectionCursorPortB169<S extends CellSelectionStateB169 = CellSelectionStateB169> = {
  isInCell(): boolean;
  isInTextBox(): boolean;
  isInCellSelectionMode(): boolean;
  getCellSelectionPhase(): CellSelectionPhaseB169;
  enterCellSelectionMode(): boolean;
  advanceCellSelectionPhase(): void;
  exitCellSelectionMode(): void;
  captureCellSelection(): S | null;
  restoreCellSelection(state: S): boolean;
};

export type CellSelectionShortcutEventB169 = Readonly<{
  key: string;
  code?: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
  repeat?: boolean;
  isComposing?: boolean;
  defaultPrevented?: boolean;
  preventDefault(): void;
  stopImmediatePropagation?(): void;
}>;

export type CellSelectionEffectsB169 = Readonly<{
  /** Render/caret/focus updates are kept outside the state transition. */
  publishSelection(change: Readonly<{
    entered: boolean;
    phase: CellSelectionPhaseB169;
    shortcut: 'F5' | 'Shift+F5';
  }>): void;
}>;

export type CellSelectionShortcutResultB169 =
  | Readonly<{ kind: 'not-owned'; reason: 'different-key' | 'different-modifier' | 'outside-cell' | 'text-box' | 'already-prevented' }>
  | Readonly<{ kind: 'blocked'; reason: 'composition' | 'repeat' | 'unsupported-phase' | 'invalid-state' | 'state-uncertain' }>
  | Readonly<{
      kind: 'handled';
      shortcut: 'F5' | 'Shift+F5';
      phase: CellSelectionPhaseB169;
      changed: boolean;
    }>;

export type CellSelectionShortcutCapabilityB169 = Readonly<{
  f5: boolean;
  shiftF5: boolean;
  reason?: 'missing-cursor-contract';
}>;

const requiredCursorMethods: readonly (keyof CellSelectionCursorPortB169)[] = [
  'isInCell',
  'isInTextBox',
  'isInCellSelectionMode',
  'getCellSelectionPhase',
  'enterCellSelectionMode',
  'advanceCellSelectionPhase',
  'exitCellSelectionMode',
  'captureCellSelection',
  'restoreCellSelection',
];

/** Runtime drift guard for the generated Studio boundary. */
export function inspectCellSelectionShortcutCapabilityB169(candidate: unknown): CellSelectionShortcutCapabilityB169 {
  if (!candidate || typeof candidate !== 'object') {
    return { f5: false, shiftF5: false, reason: 'missing-cursor-contract' };
  }
  const record = candidate as Record<PropertyKey, unknown>;
  if (!requiredCursorMethods.every((name) => typeof record[name] === 'function')) {
    return { f5: false, shiftF5: false, reason: 'missing-cursor-contract' };
  }
  return { f5: true, shiftF5: true };
}

function isF5(event: CellSelectionShortcutEventB169): boolean {
  return event.key === 'F5' || event.code === 'F5';
}

function validPhase(value: unknown): value is CellSelectionPhaseB169 {
  return value === 1 || value === 2 || value === 3;
}

function validPoint(value: CellSelectionPointB169): boolean {
  return Number.isSafeInteger(value.row) && value.row >= 0
    && Number.isSafeInteger(value.col) && value.col >= 0;
}

function validState(value: CellSelectionStateB169 | null): value is CellSelectionStateB169 {
  return value !== null
    && Number.isSafeInteger(value.sec) && value.sec >= 0
    && Number.isSafeInteger(value.ppi) && value.ppi >= 0
    && Number.isSafeInteger(value.ci) && value.ci >= 0
    && validPhase(value.phase)
    && (value.reason === 'manual' || value.reason === 'protected')
    && Array.isArray(value.excluded)
    && value.excluded.every((item) => typeof item === 'string')
    && validPoint(value.anchor)
    && validPoint(value.focus);
}

function exactOpaqueValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right)
      && left.length === right.length
      && left.every((value, index) => exactOpaqueValue(value, right[index]));
  }
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord).sort();
  const rightKeys = Object.keys(rightRecord).sort();
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key, index) => key === rightKeys[index]
      && exactOpaqueValue(leftRecord[key], rightRecord[key]));
}

function sameOwner(left: CellSelectionStateB169, right: CellSelectionStateB169): boolean {
  return left.sec === right.sec
    && left.ppi === right.ppi
    && left.ci === right.ci
    && exactOpaqueValue(left.cellPath, right.cellPath);
}

function samePoint(left: CellSelectionPointB169, right: CellSelectionPointB169): boolean {
  return left.row === right.row && left.col === right.col;
}

function sameState(left: CellSelectionStateB169, right: CellSelectionStateB169): boolean {
  return sameOwner(left, right)
    && left.phase === right.phase
    && left.reason === right.reason
    && exactOpaqueValue(left.excluded, right.excluded)
    && samePoint(left.anchor, right.anchor)
    && samePoint(left.focus, right.focus);
}

function ownEvent(event: CellSelectionShortcutEventB169): void {
  event.preventDefault();
  event.stopImmediatePropagation?.();
}

function restoreBefore<S extends CellSelectionStateB169>(
  cursor: CellSelectionCursorPortB169<S>,
  before: S | null,
): boolean {
  try {
    if (before === null) {
      cursor.exitCellSelectionMode();
      return !cursor.isInCellSelectionMode();
    }
    if (!cursor.restoreCellSelection(before)) return false;
    const restored = cursor.captureCellSelection();
    return validState(restored) && sameState(before, restored);
  } catch {
    return false;
  }
}

function blockedAfterMutation<S extends CellSelectionStateB169>(
  cursor: CellSelectionCursorPortB169<S>,
  before: S | null,
): CellSelectionShortcutResultB169 {
  return restoreBefore(cursor, before)
    ? { kind: 'blocked', reason: 'invalid-state' }
    : { kind: 'blocked', reason: 'state-uncertain' };
}

/**
 * Executes only the table-cell meaning of F5.
 *
 * Hangul's two shortcuts are intentionally different:
 * - F5 enters phase 1 (arrow keys move the one-cell block); subsequent F5
 *   advances to phase 2 and phase 3.
 * - Shift+F5 enters phase 2 immediately (arrow keys extend the block).
 *
 * Body F5, text-box F5 and modified F5 combinations remain owned by their
 * existing handlers. A phase-3 Shift+F5 is blocked because the public cursor
 * contract cannot prove which single cell should become the new anchor.
 */
export function handleCellSelectionShortcutB169<S extends CellSelectionStateB169>(
  event: CellSelectionShortcutEventB169,
  cursor: CellSelectionCursorPortB169<S>,
  effects: CellSelectionEffectsB169,
): CellSelectionShortcutResultB169 {
  if (!isF5(event)) return { kind: 'not-owned', reason: 'different-key' };
  if (event.defaultPrevented) return { kind: 'not-owned', reason: 'already-prevented' };
  if (event.ctrlKey || event.altKey || event.metaKey) {
    return { kind: 'not-owned', reason: 'different-modifier' };
  }

  let inCell: boolean;
  let inTextBox: boolean;
  try {
    inCell = cursor.isInCell();
    inTextBox = cursor.isInTextBox();
  } catch {
    ownEvent(event);
    return { kind: 'blocked', reason: 'state-uncertain' };
  }
  if (!inCell) return { kind: 'not-owned', reason: 'outside-cell' };
  if (inTextBox) return { kind: 'not-owned', reason: 'text-box' };

  ownEvent(event);
  if (event.isComposing) return { kind: 'blocked', reason: 'composition' };
  if (event.repeat) return { kind: 'blocked', reason: 'repeat' };

  const shortcut = event.shiftKey ? 'Shift+F5' : 'F5';
  let selected: boolean;
  let before: S | null;
  try {
    selected = cursor.isInCellSelectionMode();
    before = selected ? cursor.captureCellSelection() : null;
  } catch {
    return { kind: 'blocked', reason: 'state-uncertain' };
  }
  if (selected && !validState(before)) return { kind: 'blocked', reason: 'invalid-state' };

  let entered = false;
  let changed = false;
  let expectedPhase: CellSelectionPhaseB169;
  try {
    const phase = selected ? cursor.getCellSelectionPhase() : null;
    if (phase !== null && !validPhase(phase)) return { kind: 'blocked', reason: 'invalid-state' };

    if (shortcut === 'Shift+F5') {
      if (phase === 3) return { kind: 'blocked', reason: 'unsupported-phase' };
      if (phase === null) {
        if (!cursor.enterCellSelectionMode()) return blockedAfterMutation(cursor, before);
        entered = true;
        changed = true;
        if (cursor.getCellSelectionPhase() !== 1) return blockedAfterMutation(cursor, before);
        cursor.advanceCellSelectionPhase();
      } else if (phase === 1) {
        cursor.advanceCellSelectionPhase();
        changed = true;
      }
      expectedPhase = 2;
    } else if (phase === null) {
      if (!cursor.enterCellSelectionMode()) return blockedAfterMutation(cursor, before);
      entered = true;
      changed = true;
      expectedPhase = 1;
    } else if (phase === 1 || phase === 2) {
      cursor.advanceCellSelectionPhase();
      changed = true;
      expectedPhase = phase === 1 ? 2 : 3;
    } else {
      expectedPhase = 3;
    }

    const after = cursor.captureCellSelection();
    if (!validState(after) || after.phase !== expectedPhase) {
      return blockedAfterMutation(cursor, before);
    }
    if (before && !sameOwner(before, after)) return blockedAfterMutation(cursor, before);
    if (expectedPhase < 3 && !samePoint(after.anchor, after.focus)) {
      return blockedAfterMutation(cursor, before);
    }

    try {
      effects.publishSelection({ entered, phase: expectedPhase, shortcut });
    } catch {
      restoreBefore(cursor, before);
      return { kind: 'blocked', reason: 'state-uncertain' };
    }
    return { kind: 'handled', shortcut, phase: expectedPhase, changed };
  } catch {
    return blockedAfterMutation(cursor, before);
  }
}
