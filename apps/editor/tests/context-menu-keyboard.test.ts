import test from 'node:test';
import assert from 'node:assert/strict';
import { contextMenuIndex } from '../src/adapters/browser/context-menu-keyboard.ts';
test('keyboard context menu handles empty state, boundary wrapping and first/last navigation', () => {
  assert.equal(contextMenuIndex(0, -1, 'ArrowDown'), -1); assert.equal(contextMenuIndex(3, -1, 'ArrowDown'), 0); assert.equal(contextMenuIndex(3, -1, 'ArrowUp'), 2);
  assert.equal(contextMenuIndex(3, 0, 'ArrowUp'), 2); assert.equal(contextMenuIndex(3, 2, 'ArrowDown'), 0); assert.equal(contextMenuIndex(3, 1, 'Home'), 0); assert.equal(contextMenuIndex(3, 0, 'End'), 2);
});
