import assert from 'node:assert/strict';
import test from 'node:test';
import {
  inspectCellBorderShortcutB154B155,
  openCellBorderShortcutB154B155,
  type CellBorderShortcutPortB154B155,
} from '../src/shortcuts/cell-border-shortcut-capability-b154-b155.ts';

type MutablePort = CellBorderShortcutPortB154B155 & {
  state: any;
  context: any;
  position: any;
  range: any;
  boxes: any[];
  multi: boolean;
  excluded: boolean;
  protected: boolean;
};

function port(overrides: Partial<MutablePort> = {}): MutablePort {
  const value: MutablePort = {
    state: {sec: 0, ppi: 2, ci: 1, anchor: {row: 0, col: 0}, focus: {row: 0, col: 0}, phase: 1, reason: 'manual', excluded: []},
    context: {sec: 0, ppi: 2, ci: 1},
    position: {sectionIndex: 0, parentParaIndex: 2, controlIndex: 1, cellIndex: 0},
    range: {startRow: 0, startCol: 0, endRow: 0, endCol: 0},
    boxes: [
      {cellIdx: 0, row: 0, col: 0, rowSpan: 1, colSpan: 1},
      {cellIdx: 1, row: 0, col: 1, rowSpan: 1, colSpan: 1},
      {cellIdx: 2, row: 1, col: 0, rowSpan: 1, colSpan: 1},
      {cellIdx: 3, row: 1, col: 1, rowSpan: 1, colSpan: 1},
    ],
    multi: false,
    excluded: false,
    protected: false,
    isInCellSelectionMode: () => true,
    hasMultiCellSelection() { return this.multi; },
    getSelectedCellRange() { return structuredClone(this.range); },
    getCellTableContext() { return structuredClone(this.context); },
    getCursorPosition() { return structuredClone(this.position); },
    hasExcludedCellSelection() { return this.excluded; },
    isProtectedCellSelectionMode() { return this.protected; },
    captureCellSelection() { return structuredClone(this.state); },
    getTableDimensions: () => ({rowCount: 2, colCount: 2, cellCount: 4}),
    getTableCellBboxes() { return structuredClone(this.boxes); },
  };
  return Object.assign(value, overrides);
}

function multiSelection(): MutablePort {
  const value = port();
  value.state.focus = {row: 0, col: 1};
  value.range.endCol = 1;
  value.position.cellIndex = 1;
  value.multi = true;
  return value;
}

test('L/C distinguish a certified single cell and open the requested tab in each-cell mode', () => {
  for (const [key, tab] of [['L', 'border'], ['C', 'background']] as const) {
    const result = inspectCellBorderShortcutB154B155(key, port());
    assert.equal(result.status, 'ready');
    if (result.status !== 'ready') continue;
    assert.equal(result.target.command, 'table:border-each');
    assert.equal(result.target.tab, tab);
    assert.equal(result.target.applyMode, 'each');
    assert.equal(result.target.selection, 'single-cell');
    assert.deepEqual(result.target.cellIndices, [0]);
  }
});

test('L/C keep a certified multi-cell block as separate cell owners', () => {
  const result = inspectCellBorderShortcutB154B155('C', multiSelection());
  assert.equal(result.status, 'ready');
  if (result.status !== 'ready') return;
  assert.equal(result.target.selection, 'multiple-cells');
  assert.deepEqual(result.target.cellIndices, [0, 1]);
  assert.equal(result.target.applyMode, 'each');
});

test('B/F require multiple exact owners and select as-one border/background modes', () => {
  for (const [key, tab] of [['B', 'border'], ['F', 'background']] as const) {
    const result = inspectCellBorderShortcutB154B155(key, multiSelection());
    assert.equal(result.status, 'ready');
    if (result.status !== 'ready') continue;
    assert.equal(result.target.command, 'table:border-one');
    assert.equal(result.target.tab, tab);
    assert.equal(result.target.applyMode, 'asOne');
  }
  assert.deepEqual(inspectCellBorderShortcutB154B155('B', port()), {status: 'blocked', reason: 'multiple-cells-required'});
});

test('protected, excluded, nested and conflicting selection signals fail closed', () => {
  const protectedPort = port(); protectedPort.protected = true;
  assert.equal(inspectCellBorderShortcutB154B155('L', protectedPort).status, 'blocked');
  const excluded = port(); excluded.state.excluded = ['0:0'];
  assert.deepEqual(inspectCellBorderShortcutB154B155('L', excluded), {status: 'blocked', reason: 'non-rectangular-selection'});
  const nested = port(); nested.state.cellPath = [{controlIndex: 1, cellIndex: 0, cellParaIndex: 0}]; nested.context.cellPath = structuredClone(nested.state.cellPath); nested.position.cellPath = structuredClone(nested.state.cellPath);
  assert.deepEqual(inspectCellBorderShortcutB154B155('L', nested), {status: 'blocked', reason: 'unsupported-nested-table'});
  const conflict = multiSelection(); conflict.multi = false;
  assert.deepEqual(inspectCellBorderShortcutB154B155('L', conflict), {status: 'blocked', reason: 'selection-state-conflict'});
});

test('cursor/table/range disagreement and malformed live evidence never produce a target', () => {
  const wrongCursor = port(); wrongCursor.position.controlIndex = 9;
  assert.deepEqual(inspectCellBorderShortcutB154B155('L', wrongCursor), {status: 'blocked', reason: 'selection-state-conflict'});
  const wrongRange = port(); wrongRange.range.endRow = 1;
  assert.deepEqual(inspectCellBorderShortcutB154B155('L', wrongRange), {status: 'blocked', reason: 'selection-state-conflict'});
  const unavailable = port({getTableCellBboxes: () => null} as any);
  assert.deepEqual(inspectCellBorderShortcutB154B155('L', unavailable), {status: 'blocked', reason: 'table-evidence-unavailable'});
  assert.deepEqual(inspectCellBorderShortcutB154B155('X', port()), {status: 'blocked', reason: 'unsupported-shortcut'});
});

test('merged-cell boundary widening, overlapping owners and grid gaps are ambiguous', () => {
  const merged = port(); merged.boxes = [{cellIdx: 0, row: 0, col: 0, rowSpan: 1, colSpan: 2}, ...merged.boxes.slice(2)];
  assert.deepEqual(inspectCellBorderShortcutB154B155('L', merged), {status: 'blocked', reason: 'ambiguous-cell-grid'});
  const overlap = port(); overlap.boxes.push({cellIdx: 4, row: 0, col: 0, rowSpan: 1, colSpan: 1});
  assert.deepEqual(inspectCellBorderShortcutB154B155('L', overlap), {status: 'blocked', reason: 'ambiguous-cell-grid'});
  const gap = port(); gap.boxes = gap.boxes.slice(1);
  assert.deepEqual(inspectCellBorderShortcutB154B155('L', gap), {status: 'blocked', reason: 'ambiguous-cell-grid'});
});

test('stable evidence opens exactly once while a second-read selection drift performs no action', () => {
  let opened = 0;
  const stable = openCellBorderShortcutB154B155('F', multiSelection(), target => {
    opened += 1;
    assert.equal(target.tab, 'background');
  });
  assert.equal(stable.status, 'ready');
  assert.equal(opened, 1);

  const drifting = multiSelection();
  let reads = 0;
  const original = drifting.getSelectedCellRange.bind(drifting);
  drifting.getSelectedCellRange = () => {
    reads += 1;
    const value = original();
    if (reads > 1) value.endCol = 0;
    return value;
  };
  const blocked = openCellBorderShortcutB154B155('F', drifting, () => { opened += 1; });
  assert.deepEqual(blocked, {status: 'blocked', reason: 'stale-selection'});
  assert.equal(opened, 1);
});
