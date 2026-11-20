import test from 'node:test';
import assert from 'node:assert/strict';
import {EventBus} from '../../../upstream/rhwp-source/rhwp-studio/src/core/event-bus.ts';
import {bindInputHandlerUndoCallbacksN018} from '../src/adapters/rhwp/input-handler-undo-callback-n018.ts';
import type {UndoLifecycleResultN018} from '../src/modules/session/public/index.ts';

const digest = (character: string) => character.repeat(64);
const stamp = (revision: string, bytes = digest('a')) => ({
  processEpoch: 'process-1',
  documentInstance: 'document-1',
  revision,
  bytesSha256: bytes,
});
const recipe = () => ({
  version: 1 as const,
  id: 'recipe-1',
  kind: 'engine-snapshot' as const,
  before: stamp('1'),
  after: stamp('2', digest('b')),
});

test('actual upstream EventBus callbacks never claim retain without the missing atomic InputHandler bridge', async () => {
  const events = new EventBus();
  const results: UndoLifecycleResultN018[] = [];
  const actualInputHandlerSurface = {
    canUndo: () => true,
    canRedo: () => false,
    performUndo() {},
    performRedo() {},
  };
  const binding = bindInputHandlerUndoCallbacksN018({
    events,
    inputHandler: () => actualInputHandlerSurface,
    recipe,
    current: () => recipe().after,
    onResult: result => results.push(result),
  });

  assert.equal(binding.status, 'bound');
  assert.deepEqual(binding.inspectCapability(), {
    supported: false,
    mode: 'capability-gated',
    reason: 'missing-state-reader',
  });

  events.emit('document-mutated', 'input-handler-edit');
  events.emit('history-jumped');
  events.emit('document-swapped');
  await binding.drain();

  assert.equal(results.length, 3);
  assert.ok(results.every(result => result.status === 'state-uncertain'));
  assert.ok(results.every(result => result.operation === 'none'));
  assert.ok(results.every(result => result.attempted === 'reset'));
  assert.ok(results.every(result => result.reason === 'history-port-rejected'));
  assert.ok(results.every(result => result.recipeExposed === false && result.documentContentExposed === false));
  assert.doesNotMatch(JSON.stringify(results), /recipe-1|a{32}|b{32}/u);
});

test('callback observations are captured at emit time and processed serially', async () => {
  const events = new EventBus();
  let recipeReads = 0, currentReads = 0, inputReads = 0;
  const results: UndoLifecycleResultN018[] = [];
  const binding = bindInputHandlerUndoCallbacksN018({
    events,
    inputHandler() { inputReads += 1; return {canUndo: () => true, canRedo: () => false}; },
    recipe() { recipeReads += 1; return recipe(); },
    current() { currentReads += 1; return recipe().after; },
    onResult(result) { results.push(result); },
  });

  events.emit('document-mutated');
  events.emit('history-jumped');
  assert.equal(recipeReads, 2);
  assert.equal(currentReads, 2);
  assert.equal(inputReads, 2);
  await binding.drain();
  assert.equal(results.length, 2);
  assert.deepEqual(results.map(result => result.attempted), ['reset', 'reset']);
});

test('observer failures are sanitized and still fail closed through a reset attempt', async () => {
  const events = new EventBus();
  const binding = bindInputHandlerUndoCallbacksN018({
    events,
    inputHandler() { throw new Error('C:\\private\\input-token'); },
    recipe() { throw new Error('raw recipe secret'); },
    current() { throw new Error('raw document content'); },
  });
  events.emit('document-mutated');
  const result = await binding.drain();
  assert.equal(result?.status, 'state-uncertain');
  assert.equal(result?.attempted, 'reset');
  assert.doesNotMatch(JSON.stringify(result), /private|token|recipe secret|document content/u);
});

test('dispose detaches the real upstream callbacks but lets an already captured boundary finish', async () => {
  const events = new EventBus();
  const results: UndoLifecycleResultN018[] = [];
  const binding = bindInputHandlerUndoCallbacksN018({
    events,
    inputHandler: () => ({canUndo: () => false, canRedo: () => false}),
    recipe,
    current: () => recipe().after,
    onResult: result => results.push(result),
  });
  events.emit('document-mutated');
  binding.dispose();
  events.emit('history-jumped');
  await binding.drain();
  assert.equal(results.length, 1);
  binding.dispose();
});

test('partial subscription failure unwinds earlier callbacks and reports a typed not-bound result', async () => {
  let subscriptions = 0, removals = 0;
  const binding = bindInputHandlerUndoCallbacksN018({
    events: {
      on() {
        subscriptions += 1;
        if (subscriptions === 2) throw new Error('C:\\private\\event-secret');
        return () => { removals += 1; };
      },
    },
    inputHandler: () => undefined,
    recipe,
    current: () => recipe().after,
  });
  assert.equal(binding.status, 'not-bound');
  assert.equal(binding.reason, 'subscription-failed');
  assert.equal(removals, 1);
  assert.equal(await binding.drain(), null);
  assert.doesNotMatch(JSON.stringify(binding), /private|event-secret/u);
});
