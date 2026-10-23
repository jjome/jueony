import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runGuardedObjectCut, validateObjectCutTarget } from '../src/editor-actions/safe-object-cut.ts';
function harness() {
  const owner = {}, doc = {}; let stamp = { document: doc, generation: 1, revision: '1:1', selection: 'table:1' }, commits = 0, writes = 0, listeners = new Set<() => void>();
  let resolve!: () => void, reject!: (e: Error) => void;
  const wait = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { owner, get stamp() { return stamp; }, set stamp(value) { stamp = value; }, get commits() { return commits; }, get writes() { return writes; }, get listeners() { return listeners.size; }, invalidate: () => listeners.forEach(fn => fn()), resolve, reject,
    ports: { owner, readStamp: () => stamp, writeClipboard: () => { writes++; return wait; }, commit: () => { commits++; }, onInvalidated: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; } } };
}
test('object deletion waits for OS clipboard acknowledgement and commits once', async () => {
  const h = harness(), result = runGuardedObjectCut(h.ports); assert.equal(h.commits, 0); assert.equal(h.writes, 1); h.resolve(); assert.equal(await result, 'cut'); assert.equal(h.commits, 1); assert.equal(h.listeners, 0);
});
test('clipboard denial preserves document and unsubscribes without destructive fallback', async () => {
  const h = harness(), result = runGuardedObjectCut(h.ports); h.reject(new Error('clipboard denied')); await assert.rejects(result, /clipboard denied/); assert.equal(h.commits, 0); assert.equal(h.listeners, 0);
  assert.equal(await runGuardedObjectCut({ ...h.ports, writeClipboard: async () => {} }), 'cut');
});
test('document identity, generation, revision and selection independently invalidate the cut', async () => {
  for (const delta of [{ document: {} }, { generation: 2 }, { revision: '1:2' }, { selection: 'table:2' }]) {
    const h = harness(), result = runGuardedObjectCut(h.ports); h.stamp = { ...h.stamp, ...delta }; h.resolve(); assert.equal(await result, 'stale'); assert.equal(h.commits, 0); assert.equal(h.listeners, 0);
  }
});
test('mutation and back-to-original selection still invalidate via the event fence', async () => {
  const h = harness(), result = runGuardedObjectCut(h.ports); h.invalidate(); h.resolve(); assert.equal(await result, 'stale'); assert.equal(h.commits, 0);
});
test('rapid repeated cut cannot duplicate the pending clipboard write or deletion', async () => {
  const h = harness(), first = runGuardedObjectCut(h.ports); assert.equal(await runGuardedObjectCut(h.ports), 'pending'); assert.equal(h.writes, 1); h.resolve(); assert.equal(await first, 'cut'); assert.equal(h.commits, 1);
});
test('snapshot failure propagates and releases pending transaction for retry', async () => {
  const h = harness(); h.resolve(); await assert.rejects(runGuardedObjectCut({ ...h.ports, commit: () => { throw new Error('engine refused'); } }), /engine refused/); assert.equal(h.listeners, 0); assert.equal(await runGuardedObjectCut(h.ports), 'cut');
});
test('missing revision never sends a copy or starts a destructive edit', async () => {
  const h = harness(); h.stamp.revision = ''; await assert.rejects(runGuardedObjectCut(h.ports), /버전/); assert.equal(h.commits, 0); assert.equal(h.writes, 0);
});
test('target validation preserves unsupported nested/multi/special-story objects', () => {
  const ref = { sec: 0, ppi: 0, ci: 2, type: 'image' }, path = [{ controlIndex: 2, cellIndex: 0, cellParaIndex: 0 }];
  validateObjectCutTarget('picture', ref, 1); validateObjectCutTarget('picture', { ...ref, cellPath: path }, 1); validateObjectCutTarget('table', { ...ref, cellPath: path }, 1);
  for (const bad of [{ ...ref, sec: -1 }, { ...ref, noteRef: {} }, { ...ref, headerFooter: {} }, { ...ref, cellIdx: 0 }, { ...ref, cellPath: [{ ...path[0], cellIndex: NaN }] }, { ...ref, type: 'shape', cellPath: path }]) assert.throws(() => validateObjectCutTarget('picture', bad, 1));
  assert.throws(() => validateObjectCutTarget('picture', ref, 2)); assert.throws(() => validateObjectCutTarget('table', { ...ref, cellPath: [...path, ...path] }, 1));
});
