import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  handleCellSelectionShortcutB169,
  inspectCellSelectionShortcutCapabilityB169,
  type CellSelectionPhaseB169,
  type CellSelectionStateB169,
} from '../src/shortcuts/cell-selection-shortcuts-b169.ts';

type State = CellSelectionStateB169;

function setup(options: { inCell?: boolean; inTextBox?: boolean; phase?: CellSelectionPhaseB169 } = {}) {
  let state: State | null = options.phase === undefined ? null : {
    sec: 0,
    ppi: 2,
    ci: 1,
    cellPath: [{ controlIndex: 1, cellIndex: 4 }],
    anchor: { row: 1, col: 1 },
    focus: options.phase === 3 ? { row: 2, col: 2 } : { row: 1, col: 1 },
    phase: options.phase,
    reason: 'manual',
    excluded: [],
  };
  const publications: unknown[] = [];
  let prevented = 0;
  let stopped = 0;
  const cursor = {
    isInCell: () => options.inCell ?? true,
    isInTextBox: () => options.inTextBox ?? false,
    isInCellSelectionMode: () => state !== null,
    getCellSelectionPhase: () => state?.phase ?? 1,
    enterCellSelectionMode: () => {
      if (state !== null) return false;
      state = {
        sec: 0, ppi: 2, ci: 1,
        cellPath: [{ controlIndex: 1, cellIndex: 4 }],
        anchor: { row: 1, col: 1 }, focus: { row: 1, col: 1 }, phase: 1,
        reason: 'manual', excluded: [],
      };
      return true;
    },
    advanceCellSelectionPhase: () => {
      if (!state || state.phase === 3) return;
      state = state.phase === 1
        ? { ...state, phase: 2 }
        : { ...state, phase: 3, anchor: { row: 0, col: 0 }, focus: { row: 2, col: 2 } };
    },
    exitCellSelectionMode: () => { state = null; },
    captureCellSelection: () => state === null ? null : structuredClone(state),
    restoreCellSelection: (next: State) => { state = structuredClone(next); return true; },
  };
  const event = (shiftKey = false, overrides: Record<string, unknown> = {}) => ({
    key: 'F5', code: 'F5', ctrlKey: false, altKey: false, shiftKey, metaKey: false,
    repeat: false, isComposing: false, defaultPrevented: false,
    preventDefault: () => { prevented += 1; },
    stopImmediatePropagation: () => { stopped += 1; },
    ...overrides,
  });
  const effects = { publishSelection: (change: unknown) => { publications.push(change); } };
  return {
    cursor, event, effects, publications,
    get state() { return state; },
    get prevented() { return prevented; },
    get stopped() { return stopped; },
  };
}

test('F5 enters move mode, then expansion mode, then selects the whole table', () => {
  const x = setup();
  assert.deepEqual(handleCellSelectionShortcutB169(x.event(), x.cursor, x.effects),
    { kind: 'handled', shortcut: 'F5', phase: 1, changed: true });
  assert.equal(x.state?.phase, 1);
  assert.deepEqual(handleCellSelectionShortcutB169(x.event(), x.cursor, x.effects),
    { kind: 'handled', shortcut: 'F5', phase: 2, changed: true });
  assert.equal(x.state?.phase, 2);
  assert.deepEqual(handleCellSelectionShortcutB169(x.event(), x.cursor, x.effects),
    { kind: 'handled', shortcut: 'F5', phase: 3, changed: true });
  assert.deepEqual(x.publications, [
    { entered: true, phase: 1, shortcut: 'F5' },
    { entered: false, phase: 2, shortcut: 'F5' },
    { entered: false, phase: 3, shortcut: 'F5' },
  ]);
  assert.equal(x.prevented, 3);
  assert.equal(x.stopped, 3);
});

test('Shift+F5 enters expansion mode immediately and is idempotent in phase 2', () => {
  const x = setup();
  assert.deepEqual(handleCellSelectionShortcutB169(x.event(true), x.cursor, x.effects),
    { kind: 'handled', shortcut: 'Shift+F5', phase: 2, changed: true });
  assert.equal(x.state?.phase, 2);
  assert.deepEqual(handleCellSelectionShortcutB169(x.event(true), x.cursor, x.effects),
    { kind: 'handled', shortcut: 'Shift+F5', phase: 2, changed: false });
  assert.deepEqual(x.publications.at(-1), { entered: false, phase: 2, shortcut: 'Shift+F5' });
});

test('Shift+F5 advances an existing phase-1 selection but blocks ambiguous phase 3', () => {
  const phase1 = setup({ phase: 1 });
  assert.equal(handleCellSelectionShortcutB169(phase1.event(true), phase1.cursor, phase1.effects).kind, 'handled');
  assert.equal(phase1.state?.phase, 2);

  const phase3 = setup({ phase: 3 });
  const before = structuredClone(phase3.state);
  assert.deepEqual(handleCellSelectionShortcutB169(phase3.event(true), phase3.cursor, phase3.effects),
    { kind: 'blocked', reason: 'unsupported-phase' });
  assert.deepEqual(phase3.state, before);
  assert.equal(phase3.publications.length, 0);
  assert.equal(phase3.prevented, 1, 'wrong generic F5 fallback must not advance an ambiguous selection');
});

test('the seam does not steal body, text-box, modified, or already handled F5', () => {
  const body = setup({ inCell: false });
  assert.deepEqual(handleCellSelectionShortcutB169(body.event(), body.cursor, body.effects),
    { kind: 'not-owned', reason: 'outside-cell' });
  assert.equal(body.prevented, 0);

  const textBox = setup({ inTextBox: true });
  assert.deepEqual(handleCellSelectionShortcutB169(textBox.event(), textBox.cursor, textBox.effects),
    { kind: 'not-owned', reason: 'text-box' });
  const modified = setup();
  assert.deepEqual(handleCellSelectionShortcutB169(modified.event(false, { ctrlKey: true }), modified.cursor, modified.effects),
    { kind: 'not-owned', reason: 'different-modifier' });
  const handled = setup();
  assert.deepEqual(handleCellSelectionShortcutB169(handled.event(false, { defaultPrevented: true }), handled.cursor, handled.effects),
    { kind: 'not-owned', reason: 'already-prevented' });
});

test('composition and key-repeat are consumed without changing selection state', () => {
  for (const [field, reason] of [['isComposing', 'composition'], ['repeat', 'repeat']] as const) {
    const x = setup();
    assert.deepEqual(handleCellSelectionShortcutB169(x.event(false, { [field]: true }), x.cursor, x.effects),
      { kind: 'blocked', reason });
    assert.equal(x.state, null);
    assert.equal(x.prevented, 1);
    assert.equal(x.publications.length, 0);
  }
});

test('invalid post-state rolls back exact owner/path/selection and does not publish success', () => {
  const x = setup({ phase: 1 });
  const before = structuredClone(x.state);
  x.cursor.advanceCellSelectionPhase = () => {
    const current = x.state;
    assert.ok(current);
    // Simulate a drifted engine changing the nested-table owner while advancing.
    x.cursor.restoreCellSelection({ ...current, ci: 9, phase: 2 });
  };
  assert.deepEqual(handleCellSelectionShortcutB169(x.event(), x.cursor, x.effects),
    { kind: 'blocked', reason: 'invalid-state' });
  assert.deepEqual(x.state, before);
  assert.equal(x.publications.length, 0);
});

test('capability inspection requires every real CursorState method used by the command', () => {
  const x = setup();
  assert.deepEqual(inspectCellSelectionShortcutCapabilityB169(x.cursor), { f5: true, shiftF5: true });
  assert.deepEqual(inspectCellSelectionShortcutCapabilityB169({ ...x.cursor, captureCellSelection: undefined }),
    { f5: false, shiftF5: false, reason: 'missing-cursor-contract' });
});

test('upstream Studio exposes the exact cursor APIs and currently routes F5 through its keyboard handler', async () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const root = resolve(here, '../../..');
  const cursor = await readFile(resolve(root, 'upstream/rhwp/rhwp-studio/src/engine/cursor.ts'), 'utf8');
  const keyboard = await readFile(resolve(root, 'upstream/rhwp/rhwp-studio/src/engine/input-handler-keyboard.ts'), 'utf8');
  for (const method of [
    'enterCellSelectionMode', 'advanceCellSelectionPhase', 'getCellSelectionPhase',
    'captureCellSelection', 'restoreCellSelection', 'exitCellSelectionMode',
  ]) assert.match(cursor, new RegExp(`\\b${method}\\s*\\(`));
  assert.match(keyboard, /if \(e\.key === 'F5'\)/);
  assert.match(keyboard, /this\.cursor\.enterCellSelectionMode\(\)/);
  assert.match(keyboard, /this\.cursor\.advanceCellSelectionPhase\(\)/);
});
