import assert from 'node:assert/strict';
import test from 'node:test';
import {
  executeTableCellTabB173,
  resolveTableCellTabB173,
  type TableCellTabEvidenceB173,
  type TableCellTabPortB173,
} from '../src/shortcuts/table-cell-tab-routing-b173.ts';

const key = (override: Record<string, unknown> = {}) => ({
  key: 'Tab', code: 'Tab', shiftKey: false, ctrlKey: false, altKey: false,
  metaKey: false, isComposing: false, keyCode: 9, defaultPrevented: false,
  ...override,
});

const cells = [
  {cellIndex: 2, row: 0, col: 0, rowSpan: 1, colSpan: 1},
  {cellIndex: 7, row: 0, col: 1, rowSpan: 1, colSpan: 1},
  {cellIndex: 9, row: 1, col: 0, rowSpan: 1, colSpan: 1},
  {cellIndex: 12, row: 1, col: 1, rowSpan: 1, colSpan: 1},
];

const evidence = (override: Partial<TableCellTabEvidenceB173> = {}): TableCellTabEvidenceB173 => ({
  revision: 4, active: true, hasDocument: true, editable: true, formMode: false,
  passwordProtected: false, handlerComposing: false, inCell: true, inTextBox: false,
  cellSelectionMode: false, tableObjectSelection: false, pictureObjectSelection: false,
  textSelection: false, atomicAppendRow: true,
  position: {sectionIndex: 0, parentParaIndex: 3, controlIndex: 1, cellIndex: 7},
  cells,
  ...override,
});

test('plain Tab and Shift+Tab resolve exact next/previous reading-order cells', () => {
  const next = resolveTableCellTabB173(key(), evidence());
  assert.equal(next.status, 'ready');
  if (next.status === 'ready') assert.deepEqual(next.action, {kind: 'move', direction: 'next', expectedCellIndex: 9});
  const previous = resolveTableCellTabB173(key({shiftKey: true}), evidence());
  assert.equal(previous.status, 'ready');
  if (previous.status === 'ready') assert.deepEqual(previous.action, {kind: 'move', direction: 'previous', expectedCellIndex: 2});
});

test('document tab cycle owns only body Ctrl+Tab while exact table Ctrl+Tab stays local', () => {
  const body = evidence({inCell: false, position: undefined, cells: undefined});
  assert.deepEqual(resolveTableCellTabB173(key({ctrlKey: true}), body), {
    status: 'pass-through', owner: 'document-tab-cycle', reason: 'exact-body-ctrl-tab',
  });
  assert.deepEqual(resolveTableCellTabB173(key({ctrlKey: true}), evidence()), {
    status: 'table-shortcut', owner: 'literal-tab',
  });
  assert.deepEqual(resolveTableCellTabB173(key({ctrlKey: true, shiftKey: true}), evidence()), {
    status: 'table-shortcut', owner: 'hanging-indent',
  });
  assert.equal(resolveTableCellTabB173(key(), body).status, 'pass-through');
});

test('IME and every selection/object ambiguity are consumed without cell or document navigation', () => {
  for (const [reason, changed] of [
    ['ime-composition-in-table', {handlerComposing: true}],
    ['ime-composition-in-table', {handlerComposing: false}],
    ['text-selection-active', {textSelection: true}],
    ['ambiguous-cell-owner', {cellSelectionMode: true}],
    ['ambiguous-cell-owner', {tableObjectSelection: true}],
    ['ambiguous-cell-owner', {pictureObjectSelection: true}],
    ['ambiguous-cell-owner', {inTextBox: true}],
  ] as const) {
    const actualKey = reason === 'ime-composition-in-table' && changed.handlerComposing === false
      ? key({isComposing: true}) : key();
    const result = resolveTableCellTabB173(actualKey, evidence(changed));
    assert.equal(result.status, 'blocked');
    if (result.status === 'blocked') {
      assert.equal(result.consume, true);
      assert.equal(result.reason, reason);
    }
  }
});

test('nested movement is allowed but nested last-cell append is explicitly fail-closed', () => {
  const path = [
    {controlIndex: 1, cellIndex: 4, cellParaIndex: 0},
    {controlIndex: 6, cellIndex: 7, cellParaIndex: 0},
  ];
  assert.equal(resolveTableCellTabB173(key(), evidence({position: {...evidence().position!, cellPath: path}})).status, 'ready');
  const last = evidence({position: {...evidence().position!, cellIndex: 12, cellPath: path}});
  assert.deepEqual(resolveTableCellTabB173(key(), last), {
    status: 'blocked', consume: true, reason: 'nested-last-cell-row-append-unsupported',
  });
});

test('top-level last-cell Tab requires the atomic append capability and first-cell Shift+Tab only exits backward', () => {
  const last = evidence({position: {...evidence().position!, cellIndex: 12}});
  const append = resolveTableCellTabB173(key(), last);
  assert.equal(append.status, 'ready');
  if (append.status === 'ready') assert.deepEqual(append.action, {kind: 'append-row', afterRow: 1, expectedFirstColumn: 0});
  assert.deepEqual(resolveTableCellTabB173(key(), evidence({...last, atomicAppendRow: false})), {
    status: 'blocked', consume: true, reason: 'atomic-row-append-unavailable',
  });
  const first = resolveTableCellTabB173(key({shiftKey: true}), evidence({position: {...evidence().position!, cellIndex: 2}}));
  assert.equal(first.status, 'ready');
  if (first.status === 'ready') assert.deepEqual(first.action, {kind: 'exit-table', direction: 'previous'});
});

type MutablePort = TableCellTabPortB173 & {
  state: TableCellTabEvidenceB173;
  next: number;
  previous: number;
  appended: number;
};

function port(initial = evidence()): MutablePort {
  return {
    state: structuredClone(initial), next: 0, previous: 0, appended: 0,
    capture() { return structuredClone(this.state); },
    moveToCellNext() {
      this.next += 1;
      this.state = evidence({...this.state, revision: this.state.revision + 1,
        position: {...this.state.position!, cellIndex: 9}});
    },
    moveToCellPrevious() {
      this.previous += 1;
      if (this.state.position?.cellIndex === 2) {
        this.state = evidence({...this.state, revision: this.state.revision + 1,
          inCell: false, position: undefined, cells: undefined});
      } else {
        this.state = evidence({...this.state, revision: this.state.revision + 1,
          position: {...this.state.position!, cellIndex: 2}});
      }
    },
    appendRowAfterLastCell() {
      this.appended += 1;
      const appendedCells = [...cells,
        {cellIndex: 20, row: 2, col: 0, rowSpan: 1, colSpan: 1},
        {cellIndex: 21, row: 2, col: 1, rowSpan: 1, colSpan: 1}];
      this.state = evidence({...this.state, revision: this.state.revision + 1,
        position: {...this.state.position!, cellIndex: 20}, cells: appendedCells});
      return true;
    },
  };
}

const control = () => {
  const value = {prevented: 0, stopped: 0};
  return {value, api: {preventDefault: () => { value.prevented += 1; }, stopImmediatePropagation: () => { value.stopped += 1; }}};
};

test('execution consumes a certified key once and validates move/append/exit readback', () => {
  const move = port(); const moveControl = control();
  assert.equal(executeTableCellTabB173(key(), moveControl.api, move).status, 'applied');
  assert.deepEqual([move.next, move.previous, move.appended], [1, 0, 0]);
  assert.deepEqual(moveControl.value, {prevented: 1, stopped: 1});

  const append = port(evidence({position: {...evidence().position!, cellIndex: 12}}));
  assert.equal(executeTableCellTabB173(key(), control().api, append).status, 'applied');
  assert.equal(append.appended, 1);

  const exit = port(evidence({position: {...evidence().position!, cellIndex: 2}}));
  assert.equal(executeTableCellTabB173(key({shiftKey: true}), control().api, exit).status, 'applied');
  assert.equal(exit.previous, 1);
});

test('stale evidence, rejected mutation and lying readback call no fallback document navigation', () => {
  const stale = port(); let captures = 0; const original = stale.capture.bind(stale);
  stale.capture = () => {
    const value = original(); captures += 1;
    return captures === 2 ? {...value, revision: value.revision + 1} : value;
  };
  assert.deepEqual(executeTableCellTabB173(key(), control().api, stale), {
    status: 'blocked', reason: 'cell-tab-evidence-stale',
  });
  assert.deepEqual([stale.next, stale.previous, stale.appended], [0, 0, 0]);

  const rejected = port(evidence({position: {...evidence().position!, cellIndex: 12}}));
  rejected.appendRowAfterLastCell = () => { rejected.appended += 1; return false; };
  assert.deepEqual(executeTableCellTabB173(key(), control().api, rejected), {
    status: 'blocked', reason: 'row-append-rejected',
  });
  assert.equal(rejected.appended, 1);

  const lying = port();
  lying.moveToCellNext = () => { lying.next += 1; };
  assert.deepEqual(executeTableCellTabB173(key(), control().api, lying), {
    status: 'state-uncertain', reason: 'cell-tab-readback-mismatch',
  });
  assert.equal(lying.next, 1);
});

test('invalid duplicate geometry and unsupported modifiers are fail-closed in a table', () => {
  const duplicate = [...cells, {...cells[0], cellIndex: 99}];
  assert.deepEqual(resolveTableCellTabB173(key(), evidence({cells: duplicate})), {
    status: 'blocked', consume: true, reason: 'invalid-table-geometry',
  });
  for (const modifier of [{altKey: true}, {metaKey: true}]) {
    const result = resolveTableCellTabB173(key(modifier), evidence());
    assert.equal(result.status, 'blocked');
  }
});
