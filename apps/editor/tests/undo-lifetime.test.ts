import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateUndoContinuity, initializeRestartedUndoState, rebaseAtomicRecipeAfterSave, undoLifetimeContract, validateAtomicUndoRecipe } from '../src/modules/session/domain/undo-lifetime.ts';

const digest = (character: string) => character.repeat(64);
const stamp = (revision: string, bytes = digest('a'), instance = 'doc-1', processEpoch = 'process-1') => ({ processEpoch, documentInstance: instance, revision, bytesSha256: bytes });
const recipe = () => ({ version: 1, id: 'recipe-1', kind: 'engine-snapshot', before: stamp('1', digest('a')), after: stamp('2', digest('b')) });
const continuity = (boundary: Parameters<typeof evaluateUndoContinuity>[2]['boundary'], current = recipe().after, extra: Partial<Parameters<typeof evaluateUndoContinuity>[2]> = {}) => evaluateUndoContinuity(recipe(), current, { boundary, historyTopId: 'recipe-1', atomicComplete: true, ...extra });

test('same live document retains only the exact top atomic recipe', () => {
  assert.equal(continuity('same-document').status, 'retain');
  assert.equal(continuity('same-document', stamp('3', digest('b'))).status, 'reset');
  assert.equal(continuity('same-document', stamp('2', digest('c'))).status, 'reset');
  assert.equal(continuity('same-document', stamp('2', digest('b'), 'doc-2')).status, 'reset');
  assert.equal(continuity('same-document', recipe().after, { historyTopId: 'later-recipe' }).status, 'reset');
  assert.equal(continuity('same-document', recipe().after, { atomicComplete: false }).status, 'reset');
});

test('save failure retains history only when memory bytes and revision stayed unchanged', () => {
  assert.equal(continuity('save-failed').status, 'retain');
  assert.equal(continuity('save-failed', stamp('3', digest('c'))).status, 'reset');
  assert.equal(continuity('save-succeeded').status, 'retain');
});

test('save-time revision changes require verified explicit rebase of the same live top recipe', () => {
  const next = stamp('3', digest('c'));
  const rebased = rebaseAtomicRecipeAfterSave(recipe(), { from: recipe().after, to: next, historyTopId: 'recipe-1', writeVerified: true });
  assert.deepEqual(rebased.after, next);
  assert.equal(evaluateUndoContinuity(rebased, next, { boundary: 'save-succeeded', historyTopId: 'recipe-1', atomicComplete: true }).status, 'retain');
  for (const transition of [
    { from: recipe().after, to: next, historyTopId: 'recipe-1', writeVerified: false },
    { from: recipe().after, to: next, historyTopId: 'other', writeVerified: true },
    { from: recipe().after, to: stamp('3', digest('c'), 'other'), historyTopId: 'recipe-1', writeVerified: true },
  ]) assert.throws(() => rebaseAtomicRecipeAfterSave(recipe(), transition));
});

test('reload, recovery, named history and process restart always initialize empty undo', () => {
  for (const boundary of ['document-reloaded', 'recovery-restored', 'manual-history-restored', 'process-restarted'] as const) assert.equal(continuity(boundary).status, 'reset');
  assert.deepEqual(initializeRestartedUndoState(stamp('2', digest('b'), 'new-doc', 'process-2')), { stamp: stamp('2', digest('b'), 'new-doc', 'process-2'), canUndo: false, canRedo: false, recipeCount: 0, reason: 'live undo history is process-scoped' });
  assert.equal(undoLifetimeContract.recoveryCheckpoint.restoresUndo, false);
  assert.equal(undoLifetimeContract.namedDocumentHistory.restoresUndo, false);
});

test('malformed, cross-process and no-op recipes are rejected', () => {
  assert.throws(() => validateAtomicUndoRecipe({ ...recipe(), extra: true }));
  assert.throws(() => validateAtomicUndoRecipe({ ...recipe(), before: { ...recipe().before, bytesSha256: 'short' } }));
  assert.throws(() => validateAtomicUndoRecipe({ ...recipe(), after: { ...recipe().after, processEpoch: 'process-2' } }));
  assert.throws(() => validateAtomicUndoRecipe({ ...recipe(), after: recipe().before }));
});
