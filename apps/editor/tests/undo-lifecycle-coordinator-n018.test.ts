import test from 'node:test';
import assert from 'node:assert/strict';
import {
  coordinateUndoLifecycleN018,
  type UndoHistoryCommandN018,
  type UndoLifecycleBoundaryN018,
  type UndoLifecycleObservationN018,
} from '../src/modules/session/application/undo-lifecycle-coordinator-n018.ts';

const digest = (character: string) => character.repeat(64);
const stamp = (revision: string, bytes = digest('a'), instance = 'doc-1', processEpoch = 'process-1') => ({ processEpoch, documentInstance: instance, revision, bytesSha256: bytes });
const recipe = () => ({ version: 1 as const, id: 'recipe-secret-id', kind: 'engine-snapshot' as const, before: stamp('1', digest('a')), after: stamp('2', digest('b')) });
const observation = (change: Partial<UndoLifecycleObservationN018> = {}): UndoLifecycleObservationN018 => ({
  boundary: 'same-document',
  recipe: recipe(),
  current: recipe().after,
  historyTopId: recipe().id,
  atomicComplete: true,
  writeVerified: false,
  ...change,
});

function history(result: 'applied' | 'rejected' = 'applied') {
  const calls: UndoHistoryCommandN018[] = [];
  return { calls, port: { apply(command: UndoHistoryCommandN018) { calls.push(structuredClone(command)); return result; } } };
}

test('same-document and save-failed retain only the exact top complete recipe', async () => {
  for (const boundary of ['same-document', 'save-failed'] as const) {
    const h = history(), result = await coordinateUndoLifecycleN018(observation({ boundary }), h.port);
    assert.equal(result.status, 'retained');
    assert.equal(result.operation, 'retain');
    assert.equal(result.attempted, 'retain');
    assert.deepEqual(h.calls, [{ kind: 'retain' }]);
    assert.doesNotMatch(JSON.stringify(result), /recipe-secret-id|a{32}|b{32}/u);
  }
});

test('revision, bytes, history top and incomplete atomic state reset exactly once', async () => {
  const changes: Partial<UndoLifecycleObservationN018>[] = [
    { current: stamp('3', digest('b')) },
    { current: stamp('2', digest('c')) },
    { historyTopId: 'later-recipe' },
    { atomicComplete: false },
  ];
  for (const change of changes) {
    const h = history(), result = await coordinateUndoLifecycleN018(observation(change), h.port);
    assert.equal(result.status, 'reset');
    assert.equal(result.operation, 'reset');
    assert.deepEqual(h.calls, [{ kind: 'reset' }]);
  }
});

test('verified save on the same live document rebases the exact top recipe once', async () => {
  const current = stamp('3', digest('c'));
  const h = history();
  const result = await coordinateUndoLifecycleN018(observation({
    boundary: 'save-succeeded', current, writeVerified: true,
  }), h.port);
  assert.equal(result.status, 'rebased');
  assert.equal(result.operation, 'rebase');
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].kind, 'rebase');
  if (h.calls[0].kind === 'rebase') assert.deepEqual(h.calls[0].recipe.after, current);
  assert.doesNotMatch(JSON.stringify(result), /recipe-secret-id|c{32}/u);
});

test('unverified save, document swap, process change and top mismatch reset instead of rebasing', async () => {
  const cases: Partial<UndoLifecycleObservationN018>[] = [
    { boundary: 'save-succeeded', current: stamp('3', digest('c')), writeVerified: false },
    { boundary: 'save-succeeded', current: stamp('3', digest('c'), 'doc-2'), writeVerified: true },
    { boundary: 'save-succeeded', current: stamp('3', digest('c'), 'doc-1', 'process-2'), writeVerified: true },
    { boundary: 'save-succeeded', current: stamp('3', digest('c')), writeVerified: true, historyTopId: 'other' },
  ];
  for (const change of cases) {
    const h = history(), result = await coordinateUndoLifecycleN018(observation(change), h.port);
    assert.equal(result.status, 'reset');
    assert.deepEqual(h.calls, [{ kind: 'reset' }]);
  }
});

test('reload, recovery, named history, document swap, process restart and manual edit always reset', async () => {
  const boundaries: UndoLifecycleBoundaryN018[] = [
    'document-reloaded', 'recovery-restored', 'manual-history-restored',
    'named-history-restored', 'document-swapped', 'process-restarted', 'manual-edit',
  ];
  for (const boundary of boundaries) {
    const h = history(), result = await coordinateUndoLifecycleN018(observation({ boundary }), h.port);
    assert.equal(result.status, 'reset');
    assert.equal(result.reason, 'boundary-or-continuity-reset');
    assert.deepEqual(h.calls, [{ kind: 'reset' }]);
  }
});

test('malformed recipe or current stamp is fail-closed through one reset without leaking raw data', async () => {
  for (const change of [
    { recipe: { ...recipe(), id: 'C:\\private\\api-key', extra: 'raw-document-secret' } },
    { current: { ...recipe().after, bytesSha256: 'raw-document-secret' } },
  ]) {
    const h = history(), result = await coordinateUndoLifecycleN018(observation(change), h.port);
    assert.equal(result.status, 'fail-closed');
    assert.equal(result.operation, 'reset');
    assert.equal(result.reason, 'invalid-observation');
    assert.deepEqual(h.calls, [{ kind: 'reset' }]);
    assert.doesNotMatch(JSON.stringify(result), /private|api-key|raw-document-secret/u);
  }
});

test('history rejection or exception is state-uncertain and never claims retention', async () => {
  const rejected = history('rejected');
  const rejectedResult = await coordinateUndoLifecycleN018(observation(), rejected.port);
  assert.equal(rejectedResult.status, 'state-uncertain');
  assert.equal(rejectedResult.operation, 'none');
  assert.equal(rejectedResult.attempted, 'retain');
  assert.equal(rejected.calls.length, 1);

  let calls = 0;
  const exception = await coordinateUndoLifecycleN018(observation(), { apply() { calls += 1; throw new Error('C:\\private\\history-secret'); } });
  assert.equal(exception.status, 'state-uncertain');
  assert.equal(exception.operation, 'none');
  assert.equal(exception.reason, 'history-port-exception');
  assert.equal(calls, 1);
  assert.doesNotMatch(JSON.stringify(exception), /private|history-secret/u);
});
