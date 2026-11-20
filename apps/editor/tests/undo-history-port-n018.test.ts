import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInputHandlerUndoHistoryPortN018,
  inspectInputHandlerUndoCapabilityN018,
  observeInputHandlerUndoLifecycleN018,
  type InputHandlerUndoLifecycleStateN018,
} from '../src/adapters/rhwp/undo-history-port-n018.ts';
import type {UndoHistoryCommandN018} from '../src/modules/session/application/undo-lifecycle-coordinator-n018.ts';

const digest = (value: string) => value.repeat(64);
const stamp = (revision: string, bytes = digest('a'), instance = 'doc-1', processEpoch = 'process-1') => ({processEpoch, documentInstance: instance, revision, bytesSha256: bytes});
const recipe = () => ({version: 1 as const, id: 'recipe-1', kind: 'engine-snapshot' as const, before: stamp('1'), after: stamp('2', digest('b'))});
const state = (change: Partial<InputHandlerUndoLifecycleStateN018> = {}): InputHandlerUndoLifecycleStateN018 => ({
  version: 1,
  historyTopId: 'recipe-1',
  recipeCount: 1,
  canUndo: true,
  canRedo: false,
  atomicComplete: true,
  activeRecipe: recipe(),
  ...change,
});

class Bridge {
  current = state();
  calls: unknown[] = [];
  behavior: 'apply' | 'reject' | 'throw' | 'malformed' = 'apply';
  readUndoLifecycleState() { return structuredClone(this.current); }
  async applyUndoLifecycleCommand(request: {version: 1; expected: InputHandlerUndoLifecycleStateN018; command: UndoHistoryCommandN018}) {
    this.calls.push(structuredClone(request));
    if (this.behavior === 'throw') throw new Error('C:\\private\\undo-secret');
    if (this.behavior === 'malformed') return {status: 'applied', state: {...this.current, unexpected: true}};
    if (this.behavior === 'reject') return {status: 'rejected', state: structuredClone(this.current)};
    if (request.command.kind === 'reset') this.current = state({historyTopId: null, recipeCount: 0, canUndo: false, canRedo: false, atomicComplete: false, activeRecipe: null});
    if (request.command.kind === 'rebase') this.current = state({historyTopId: request.command.recipe.id, activeRecipe: request.command.recipe});
    return {status: 'applied', state: structuredClone(this.current)};
  }
}

const event = (change: Record<string, unknown> = {}) => ({
  kind: 'same-document' as const,
  recipe: recipe(),
  current: recipe().after,
  ...change,
});

test('current public InputHandler surface is capability-gated instead of using its private history', async () => {
  const actualLike = {canUndo: () => true, canRedo: () => false, performUndo() {}, performRedo() {}};
  assert.deepEqual(inspectInputHandlerUndoCapabilityN018(actualLike), {supported: false, mode: 'capability-gated', reason: 'missing-state-reader'});
  const result = await observeInputHandlerUndoLifecycleN018(actualLike, event());
  assert.equal(result.status, 'state-uncertain');
  assert.equal(result.reason, 'history-port-rejected');
  assert.equal(result.operation, 'none');
});

test('same document and failed save retain only the exact observed top recipe', async () => {
  for (const kind of ['same-document', 'save-failed'] as const) {
    const bridge = new Bridge();
    const result = await observeInputHandlerUndoLifecycleN018(bridge, event({kind}));
    assert.equal(result.status, 'retained');
    assert.equal(result.operation, 'retain');
    assert.equal(bridge.calls.length, 1);
    assert.deepEqual((bridge.calls[0] as any).command, {kind: 'retain'});
  }
});

test('verified save rebases the exact recipe and verifies the bridge readback', async () => {
  const bridge = new Bridge();
  const current = stamp('3', digest('c'));
  const result = await observeInputHandlerUndoLifecycleN018(bridge, event({kind: 'save-succeeded', current, writeVerified: true}));
  assert.equal(result.status, 'rebased');
  assert.equal(result.operation, 'rebase');
  assert.equal(bridge.current.activeRecipe?.after.revision, '3');
  assert.equal(bridge.current.activeRecipe?.after.bytesSha256, digest('c'));
  assert.doesNotMatch(JSON.stringify(result), /recipe-1|c{32}/u);
});

test('reload, recovery, named history, swap, restart and manual edit each atomically reset history', async () => {
  for (const kind of ['document-reloaded', 'recovery-restored', 'named-history-restored', 'document-swapped', 'process-restarted', 'manual-edit'] as const) {
    const bridge = new Bridge();
    const result = await observeInputHandlerUndoLifecycleN018(bridge, event({kind}));
    assert.equal(result.status, 'reset', kind);
    assert.equal(result.operation, 'reset');
    assert.equal(bridge.current.recipeCount, 0);
    assert.equal(bridge.current.canUndo, false);
    assert.equal(bridge.current.canRedo, false);
    assert.equal(bridge.calls.length, 1);
  }
});

test('top mismatch and a recipe/state mismatch reset rather than retaining a stale token', async () => {
  const explicit = new Bridge();
  const mismatch = await observeInputHandlerUndoLifecycleN018(explicit, event({kind: 'history-top-mismatch'}));
  assert.equal(mismatch.status, 'reset');
  assert.equal(explicit.current.recipeCount, 0);

  const changed = new Bridge();
  changed.current = state({historyTopId: 'later', activeRecipe: {...recipe(), id: 'later'}});
  const result = await observeInputHandlerUndoLifecycleN018(changed, event());
  assert.equal(result.status, 'reset');
  assert.equal(changed.current.recipeCount, 0);
});

test('unverified save resets and cannot be promoted to a rebase by the bridge', async () => {
  const bridge = new Bridge();
  const result = await observeInputHandlerUndoLifecycleN018(bridge, event({kind: 'save-succeeded', current: stamp('3', digest('c')), writeVerified: false}));
  assert.equal(result.status, 'reset');
  assert.deepEqual((bridge.calls[0] as any).command, {kind: 'reset'});
});

test('bridge rejection, exception, or malformed readback is state-uncertain and leaks no raw error', async () => {
  for (const behavior of ['reject', 'throw', 'malformed'] as const) {
    const bridge = new Bridge();
    bridge.behavior = behavior;
    const result = await observeInputHandlerUndoLifecycleN018(bridge, event());
    assert.equal(result.status, 'state-uncertain');
    assert.equal(result.operation, 'none');
    assert.doesNotMatch(JSON.stringify(result), /private|undo-secret|recipe-1|a{32}|b{32}/u);
    assert.equal(bridge.calls.length, 1);
  }
});

test('port refuses absent expected state and never invokes a nominal bridge', async () => {
  const bridge = new Bridge();
  const port = createInputHandlerUndoHistoryPortN018(bridge);
  assert.equal(await port.apply({kind: 'reset'}), 'rejected');
  assert.equal(bridge.calls.length, 0);
});

test('atomic bridge capability requires both state and command methods', () => {
  assert.deepEqual(inspectInputHandlerUndoCapabilityN018({readUndoLifecycleState() { return state(); }}), {supported: false, mode: 'capability-gated', reason: 'missing-atomic-command'});
  assert.deepEqual(inspectInputHandlerUndoCapabilityN018(new Bridge()), {supported: true, mode: 'atomic-lifecycle-bridge'});
});
