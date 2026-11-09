import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyDocumentWindowArrangementB063,
  captureDocumentWindowArrangementB063,
  type DocumentWindowDescriptorB063,
  type DocumentWindowPlacementB063,
} from '../src/adapters/browser/document-window-arrangement-b063.ts';

const viewport = {x: 0, y: 0, width: 900, height: 600};
const rows = (): DocumentWindowDescriptorB063[] => [
  {windowId: 'w-b', documentId: 'doc-b', revision: 'r2', windowEpoch: 'e2', visible: true, modal: false, movable: true, rect: {x: 10, y: 20, width: 400, height: 300}},
  {windowId: 'w-a', documentId: 'doc-a', revision: 'r1', windowEpoch: 'e1', visible: true, modal: false, movable: true, rect: {x: 20, y: 30, width: 410, height: 310}},
  {windowId: 'w-c', documentId: 'doc-c', revision: 'r3', windowEpoch: 'e3', visible: true, modal: false, movable: true, rect: {x: 30, y: 40, width: 420, height: 320}},
];

function fixture() {
  let state = rows();
  const calls: DocumentWindowPlacementB063[][] = [];
  let mode: 'ok' | 'reject' | 'partial-once' = 'ok';
  const port = {
    snapshot: () => structuredClone(state),
    applyBatch(value: readonly DocumentWindowPlacementB063[]) {
      calls.push(structuredClone(value));
      if (mode === 'reject') return false;
      const applied = mode === 'partial-once' && calls.length === 1 ? value.slice(0, 1) : value;
      for (const next of applied) {
        const index = state.findIndex(item => item.windowId === next.windowId);
        if (index >= 0) state[index] = {...state[index], rect: {...next.rect}};
      }
      return true;
    },
  };
  return {port, calls, state: () => structuredClone(state), setState: (value: DocumentWindowDescriptorB063[]) => { state = value; }, setMode: (value: typeof mode) => { mode = value; }};
}

test('B063 creates deterministic horizontal, vertical and cascade batches', () => {
  for (const [mode, first, second] of [
    ['tile-horizontal', {x: 0, y: 0, width: 300, height: 600}, {x: 300, y: 0, width: 300, height: 600}],
    ['tile-vertical', {x: 0, y: 0, width: 900, height: 200}, {x: 0, y: 200, width: 900, height: 200}],
    ['cascade', {x: 0, y: 0, width: 844, height: 544}, {x: 28, y: 28, width: 844, height: 544}],
  ] as const) {
    const captured = captureDocumentWindowArrangementB063({mode, viewport, windows: rows()});
    assert.equal(captured.status, 'ready');
    if (captured.status === 'ready') {
      assert.equal(captured.plan.target[0].windowId, 'w-a');
      assert.deepEqual(captured.plan.target[0].rect, first);
      assert.deepEqual(captured.plan.target[1].rect, second);
    }
  }
});

test('B063 applies one complete batch only after owner state matches', () => {
  const f = fixture();
  const captured = captureDocumentWindowArrangementB063({mode: 'tile-horizontal', viewport, windows: f.port.snapshot()});
  assert.equal(captured.status, 'ready');
  if (captured.status !== 'ready') return;
  const result = applyDocumentWindowArrangementB063(f.port, captured.plan);
  assert.equal(f.calls.length, 1);
  assert.deepEqual(result, captured.plan.target);
  assert.equal(f.state().find(item => item.windowId === 'w-a')?.rect.width, 300);
});

test('B063 stale revision or epoch fails before the OS callback', () => {
  const f = fixture();
  const captured = captureDocumentWindowArrangementB063({mode: 'cascade', viewport, windows: f.port.snapshot()});
  assert.equal(captured.status, 'ready');
  if (captured.status !== 'ready') return;
  const changed = f.state();
  changed[0] = {...changed[0], revision: 'stale'};
  f.setState(changed);
  assert.throws(() => applyDocumentWindowArrangementB063(f.port, captured.plan), /계획 이후 변경/);
  assert.equal(f.calls.length, 0);
});

test('B063 partial readback failure restores the original layout in one rollback batch', () => {
  const f = fixture();
  const original = f.state();
  const captured = captureDocumentWindowArrangementB063({mode: 'tile-vertical', viewport, windows: f.port.snapshot()});
  assert.equal(captured.status, 'ready');
  if (captured.status !== 'ready') return;
  f.setMode('partial-once');
  assert.throws(() => applyDocumentWindowArrangementB063(f.port, captured.plan), /결과가 일치/);
  assert.equal(f.calls.length, 2);
  assert.deepEqual(f.state(), original);
});

test('B063 one, hidden, modal, unmovable and duplicated windows fail closed', () => {
  const cases: Array<[DocumentWindowDescriptorB063[], string]> = [
    [rows().slice(0, 1), 'one-window'],
    [rows().map((item, index) => index ? item : {...item, visible: false}), 'hidden-window'],
    [rows().map((item, index) => index ? item : {...item, modal: true}), 'modal-window'],
    [rows().map((item, index) => index ? item : {...item, movable: false}), 'unmovable-window'],
    [[rows()[0], {...rows()[1], windowId: rows()[0].windowId}], 'duplicate-window'],
    [[rows()[0], {...rows()[1], documentId: rows()[0].documentId}], 'duplicate-document'],
  ];
  for (const [windows, reason] of cases) {
    assert.deepEqual(captureDocumentWindowArrangementB063({mode: 'cascade', viewport, windows}), {status: 'blocked', reason});
  }
});
