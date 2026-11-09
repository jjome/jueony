import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import test from 'node:test';
import {
  computeObjectMoveGuidesB052,
  createObjectGuideSettingsB052,
  parseStoredObjectGuideSettingsB052,
} from '../src/adapters/browser/object-movement-guides-b052.ts';

const enginePackage = process.env.JUEONY_ENGINE_PACKAGE
  ? resolve(process.env.JUEONY_ENGINE_PACKAGE)
  : fileURLToPath(new URL('../node_modules/@rhwp/core/', import.meta.url));
const engine = await import(pathToFileURL(resolve(enginePackage, 'rhwp.js')).href);
const {HwpDocument} = engine as typeof import('@rhwp/core');
await engine.default({module_or_path: await readFile(resolve(enginePackage, 'rhwp_bg.wasm'))});

const page = {left: 0, top: 0, width: 600, height: 800};
const settings = {enabled: true, snap: true, thresholdPx: 5};

test('B052 deterministically snaps a move to page and peer anchors', () => {
  const value = computeObjectMoveGuidesB052({
    activeId: 'moving', proposed: {left: 297, top: 198, width: 100, height: 40}, page,
    peers: [{id: 'peer', rect: {left: 50, top: 200, width: 80, height: 60}}], zoom: 1, settings,
  });
  assert.deepEqual(value.rect, {left: 300, top: 200, width: 100, height: 40});
  assert.equal(value.deltaX, 3);
  assert.equal(value.deltaY, 2);
  assert.deepEqual(value.guides.map(guide => [guide.axis, guide.position, guide.source]), [
    ['vertical', 300, 'page'],
    ['horizontal', 200, 'object'],
  ]);
});

test('B052 zoom scales the hit threshold and snap can be disabled independently', () => {
  const input = {activeId: 'moving', proposed: {left: 296, top: 100, width: 100, height: 40}, page, peers: [], zoom: 2};
  assert.equal(computeObjectMoveGuidesB052({...input, settings}).guides.length, 0);
  const visible = computeObjectMoveGuidesB052({...input, zoom: 1, settings: {...settings, snap: false}});
  assert.equal(visible.deltaX, 0);
  assert.equal(visible.guides[0]?.position, 300);
  assert.deepEqual(visible.rect, input.proposed);
});

test('B052 settings are bounded, versioned, and fail closed to defaults on corrupt storage', () => {
  const rows = new Map<string, string>();
  const storage = {getItem: (key: string) => rows.get(key) ?? null, setItem: (key: string, value: string) => void rows.set(key, value)};
  const controller = createObjectGuideSettingsB052(storage);
  assert.deepEqual(controller.snapshot(), settings);
  assert.deepEqual(controller.commit({enabled: false, snap: false, thresholdPx: 12}), {enabled: false, snap: false, thresholdPx: 12});
  assert.deepEqual(parseStoredObjectGuideSettingsB052(rows.values().next().value), {enabled: false, snap: false, thresholdPx: 12});
  assert.throws(() => controller.commit({enabled: true, snap: true, thresholdPx: 25}));
  rows.set('jueony.user.object-movement-guides.v1', '{bad');
  assert.deepEqual(createObjectGuideSettingsB052(storage).snapshot(), settings);
});

test('B052 rejects unbounded geometry and never mutates peer or document state', () => {
  const document: any = HwpDocument.createEmpty();
  try {
    document.createBlankDocument();
    document.insertText(0, 0, 0, 'B052 bytes');
    const hwpBefore = Buffer.from(document.exportHwp());
    const hwpxBefore = Buffer.from(document.exportHwpx());
    const peers = Object.freeze([{id: 'peer', rect: Object.freeze({left: 10, top: 10, width: 20, height: 20})}]);
    const old = JSON.stringify(peers);
    computeObjectMoveGuidesB052({activeId: 'moving', proposed: {left: 12, top: 12, width: 10, height: 10}, page, peers, zoom: 1, settings});
    assert.equal(JSON.stringify(peers), old);
    assert.deepEqual(Buffer.from(document.exportHwp()), hwpBefore);
    assert.deepEqual(Buffer.from(document.exportHwpx()), hwpxBefore);
    assert.throws(() => computeObjectMoveGuidesB052({activeId: 'moving', proposed: {left: Number.NaN, top: 0, width: 1, height: 1}, page, peers: [], zoom: 1, settings}));
    assert.throws(() => computeObjectMoveGuidesB052({activeId: 'moving', proposed: {left: 0, top: 0, width: 1, height: 1}, page, peers: Array.from({length: 513}, (_, index) => ({id: String(index), rect: page})), zoom: 1, settings}));
  } finally { document.free(); }
});
