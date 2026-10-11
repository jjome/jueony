import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDocumentViewAdapter, validateDocumentView } from '../src/preferences/document-view.ts';
import type { DocumentFitMode, DocumentViewState } from '../src/preferences/document-view.ts';
const saved = (overrides: Partial<DocumentViewState> = {}): DocumentViewState => ({ version: 1, zoom: 1.5, fitMode: 'none', scrollX: 42, scrollY: 640, ...overrides });
function fixture() {
  let identity = 'doc1', visible = true, zoom = 1, fit: DocumentFitMode = 'none', x = 0, y = 0, fitZoom = 0.85;
  let settle = async () => {};
  const calls: string[] = [];
  const viewport = {
    getZoom: () => zoom, getZoomFitMode: () => fit, getScrollX: () => x, getScrollY: () => y,
    setZoom(value: number, _anchor?: {x: number; y: number}, mode: DocumentFitMode = 'none') { zoom = value; fit = mode; calls.push('zoom:' + value); },
    setScrollLeft(value: number) { x = Math.min(500, value); calls.push('x:' + x); },
    setScrollTop(value: number) { y = Math.min(2000, value); calls.push('y:' + y); },
  };
  const adapter = createDocumentViewAdapter({ viewport: () => viewport, identity: () => identity, visible: () => visible, applyFit(mode) { viewport.setZoom(fitZoom, undefined, mode); }, settle: () => settle() });
  return { adapter, viewport, calls, identity(value: string) { identity = value; }, visible(value: boolean) { visible = value; }, fitZoom(value: number) { fitZoom = value; }, settle(value: () => Promise<void>) { settle = value; } };
}
test('view validator accepts only supported finite state without mutating input', () => {
  const source: any = { ...saved(), future: 9 }; assert.deepEqual(validateDocumentView(source), saved()); assert.equal(source.future, 9);
  for (const value of [null, undefined, [], { ...saved(), version: 2 }, { ...saved(), zoom: 0 }, { ...saved(), zoom: NaN }, { ...saved(), zoom: 6 }, { ...saved(), fitMode: 'page' }, { ...saved(), scrollY: -1 }]) assert.equal(validateDocumentView(value), undefined);
});
test('numeric zoom is applied before layout settles and scroll restoration follows it', async () => {
  const f = fixture(); let release!: () => void; f.settle(() => new Promise<void>(resolve => { release = resolve; }));
  const pending = f.adapter.restore(saved()); assert.equal(f.adapter.isRestoring(), true); assert.deepEqual(f.calls, ['zoom:1.5']);
  assert.deepEqual(f.adapter.capture(), saved());
  release(); assert.equal(await pending, 'applied'); assert.deepEqual(f.calls, ['zoom:1.5', 'x:42', 'y:640']);
  assert.equal(f.adapter.isRestoring(), false); assert.deepEqual(f.adapter.capture(), saved());
});
test('fit mode recomputes using current viewport rather than reusing obsolete numeric zoom', async () => {
  const f = fixture(); f.fitZoom(0.63); assert.equal(await f.adapter.restore(saved({ zoom: 1.9, fitMode: 'fitWidth' })), 'applied');
  assert.deepEqual(f.adapter.capture(), saved({ zoom: 0.63, fitMode: 'fitWidth' }));
});
test('hidden iframe retains pending view and applies it when made visible', async () => {
  const f = fixture(); f.visible(false);
  assert.equal(await f.adapter.restore(saved({ fitMode: 'fitPage' })), 'deferred'); assert.equal(f.calls.length, 0);
  assert.deepEqual(f.adapter.capture(), saved({ fitMode: 'fitPage' })); assert.equal(f.adapter.hasPending(), true);
  f.visible(true); assert.equal(await f.adapter.retry(), 'applied'); assert.equal(f.adapter.hasPending(), false);
  assert.equal(f.adapter.capture()?.fitMode, 'fitPage');
});
test('hiding a tab preserves its last captured scroll offset', () => {
  const f = fixture(); f.viewport.setScrollTop(300); assert.equal(f.adapter.capture()?.scrollY, 300);
  f.visible(false); f.viewport.setScrollTop(0);
  assert.equal(f.adapter.capture()?.scrollY, 300);
});
test('different adapters do not mix documents and captures are defensive copies', async () => {
  const a = fixture(), b = fixture(); await a.adapter.restore(saved()); await b.adapter.restore(saved({ zoom: 0.7, scrollY: 55 }));
  const changed = a.adapter.capture()!; changed.scrollY = 999;
  assert.equal(a.adapter.capture()?.scrollY, 640); assert.equal(b.adapter.capture()?.scrollY, 55);
  assert.equal(b.adapter.capture()?.zoom, 0.7);
});
test('a document swap during layout cancels stale scroll restoration', async () => {
  const f = fixture(); let release!: () => void; f.settle(() => new Promise<void>(resolve => { release = resolve; }));
  const pending = f.adapter.restore(saved()); f.identity('doc2'); release();
  assert.equal(await pending, 'ignored'); assert.equal(f.calls.some(value => value.startsWith('y:')), false);
  assert.equal(f.adapter.hasPending(), false);
});
test('restoration deferred by hiding during layout completes on next visible retry', async () => {
  const f = fixture(); let release!: () => void; f.settle(() => new Promise<void>(resolve => { release = resolve; }));
  const pending = f.adapter.restore(saved()); f.visible(false); release();
  assert.equal(await pending, 'deferred'); assert.equal(f.adapter.capture()?.scrollY, 640);
  f.visible(true); f.settle(async () => {}); assert.equal(await f.adapter.retry(), 'applied');
});
test('invalid optional view does not throw or change document viewport', async () => {
  const f = fixture(); assert.equal(await f.adapter.restore({ version: 2 }), 'invalid'); assert.equal(await f.adapter.restore(undefined), 'ignored');
  assert.equal(f.calls.length, 0);
});
test('current scroll range clamps obsolete offset after page count or window size changes', async () => {
  const f = fixture(); await f.adapter.restore(saved({ scrollX: 1200, scrollY: 6000 }));
  assert.equal(f.adapter.capture()?.scrollX, 500); assert.equal(f.adapter.capture()?.scrollY, 2000);
});
test('explicit clear drops only view cache, not file contents or engine state', async () => {
  const f = fixture(); f.visible(false); await f.adapter.restore(saved());
  f.adapter.clear(); assert.equal(f.adapter.hasPending(), false); assert.equal(f.adapter.capture(), undefined); assert.equal(f.calls.length, 0);
});
test('renderer failure ends restore guard and keeps snapshot available for explicit retry', async () => {
  const f = fixture(); f.settle(async () => { throw new Error('layout failed'); });
  await assert.rejects(f.adapter.restore(saved()), /layout failed/);
  assert.equal(f.adapter.isRestoring(), false); assert.deepEqual(f.adapter.capture(), saved());
  f.settle(async () => {}); assert.equal(await f.adapter.retry(), 'applied');
});
test('suspend restores actual viewport offsets after hiding collapses iframe scroll', async () => {
  const f = fixture(); await f.adapter.restore(saved());
  assert.deepEqual(f.adapter.suspend(), saved()); assert.equal(f.adapter.hasPending(), true);
  f.visible(false); f.viewport.setScrollTop(0); f.viewport.setScrollLeft(0);
  assert.deepEqual(f.adapter.capture(), saved()); assert.equal(await f.adapter.retry(), 'deferred');
  f.visible(true); assert.equal(await f.adapter.retry(), 'applied');
  assert.equal(f.viewport.getScrollY(), 640); assert.equal(f.viewport.getScrollX(), 42);
  assert.equal(f.adapter.hasPending(), false);
});

test('rapid hide and show during a restore retains the original settle task', async () => {
  const f = fixture(); let release!: () => void; f.settle(() => new Promise<void>(resolve => { release = resolve; }));
  const pending = f.adapter.restore(saved()); f.adapter.suspend(); f.visible(false);
  f.viewport.setScrollTop(0); f.visible(true);
  assert.equal(await f.adapter.retry(), 'deferred'); release();
  assert.equal(await pending, 'applied'); assert.equal(f.viewport.getScrollY(), 640);
  assert.equal(f.adapter.hasPending(), false);
});

test('suspended previous document cannot restore into a replacement document', async () => {
  const f = fixture(); await f.adapter.restore(saved()); f.adapter.suspend(); f.identity('doc2');
  f.viewport.setScrollTop(0); const count = f.calls.length;
  assert.equal(await f.adapter.retry(), 'ignored'); assert.equal(f.calls.length, count);
  assert.equal(f.viewport.getScrollY(), 0);
});
