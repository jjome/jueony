import test from 'node:test';
import assert from 'node:assert/strict';
import { executeAutoFillSnapshot } from '../src/adapters/rhwp/table-auto-fill-native.ts';
import type { AutoFillPlan } from '../src/adapters/rhwp/table-auto-fill-native.ts';

test('table auto fill does not claim success when the editor router silently refuses execution', () => {
  let attempted = 0;
  assert.throws(() => executeAutoFillSnapshot({ executeOperation() { attempted++; }, getCursorPosition() { throw new Error('must not read cursor'); } }, {} as AutoFillPlan), /적용하지 못했습니다/);
  assert.equal(attempted, 1);
});

test('table auto fill propagates the router failure and never returns completion', () => {
  const failure = new Error('snapshot unavailable');
  assert.throws(() => executeAutoFillSnapshot({ executeOperation() { throw failure; } }, {} as AutoFillPlan), error => error === failure);
});
