import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import init, { HwpDocument } from '@rhwp/core';
import {
  DEFAULT_DOCUMENT_VIEW_COLORS_B053,
  DOCUMENT_VIEW_COLORS_KEY_B053,
  DocumentViewColorErrorB053,
  createCssDocumentViewColorTargetB053,
  createDocumentViewColorControllerB053,
  validateDocumentViewColorsB053,
} from '../src/adapters/browser/document-view-colors-b053.ts';

await init({ module_or_path: await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm', import.meta.url)) });

class MemoryStorageB053 {
  readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

test('B053 validates canonical opaque RGB colors and rejects CSS injection', () => {
  assert.deepEqual(validateDocumentViewColorsB053({ workspace: '#ABCDEF', paper: '#010203' }), {
    workspace: '#abcdef', paper: '#010203',
  });
  for (const invalid of [
    null,
    { workspace: 'red', paper: '#ffffff' },
    { workspace: '#fff', paper: '#ffffff' },
    { workspace: '#ffffff00', paper: '#ffffff' },
    { workspace: '#ffffff; color:red', paper: '#ffffff' },
  ]) assert.throws(() => validateDocumentViewColorsB053(invalid), DocumentViewColorErrorB053);
});

test('B053 previews, cancels, persists per-user values, and restores them', () => {
  const storage = new MemoryStorageB053();
  const applied: unknown[] = [];
  const first = createDocumentViewColorControllerB053({ storage, target: { apply: value => applied.push(value) } });
  assert.deepEqual(first.snapshot(), DEFAULT_DOCUMENT_VIEW_COLORS_B053);
  first.preview({ workspace: '#223344', paper: '#fffef8' });
  first.cancel();
  assert.equal(storage.getItem(DOCUMENT_VIEW_COLORS_KEY_B053), null);
  assert.deepEqual(applied.at(-1), DEFAULT_DOCUMENT_VIEW_COLORS_B053);
  assert.throws(() => first.preview(DEFAULT_DOCUMENT_VIEW_COLORS_B053), /이미 끝난/);

  const second = createDocumentViewColorControllerB053({ storage, target: { apply: value => applied.push(value) } });
  second.preview({ workspace: '#445566', paper: '#faf9f2' });
  assert.deepEqual(second.commit(), { workspace: '#445566', paper: '#faf9f2' });
  assert.equal(storage.getItem(DOCUMENT_VIEW_COLORS_KEY_B053),
    '{"version":1,"workspace":"#445566","paper":"#faf9f2"}');

  const restored: unknown[] = [];
  const third = createDocumentViewColorControllerB053({ storage, target: { apply: value => restored.push(value) } });
  assert.deepEqual(third.snapshot(), { workspace: '#445566', paper: '#faf9f2' });
  assert.deepEqual(restored, [{ workspace: '#445566', paper: '#faf9f2' }]);
});

test('B053 maps only the existing Studio workspace and paper CSS variables', () => {
  const properties = new Map<string, string>();
  const target = createCssDocumentViewColorTargetB053({ setProperty: (name, value) => { properties.set(name, value); } });
  target.apply({ workspace: '#102030', paper: '#fefdfc' });
  assert.deepEqual([...properties], [
    ['--doc-workspace', '#102030'],
    ['--doc-paper', '#fefdfc'],
  ]);
});

test('B053 storage failure rolls the preview back and never reports a commit', () => {
  const applied: unknown[] = [];
  const controller = createDocumentViewColorControllerB053({
    storage: { getItem: () => null, setItem: () => { throw new Error('quota'); } },
    target: { apply: value => applied.push(value) },
  });
  controller.preview({ workspace: '#111111', paper: '#eeeeee' });
  assert.throws(() => controller.commit(), (error: unknown) =>
    error instanceof DocumentViewColorErrorB053 && error.code === 'write');
  assert.deepEqual(applied.at(-1), DEFAULT_DOCUMENT_VIEW_COLORS_B053);
  assert.deepEqual(controller.snapshot(), DEFAULT_DOCUMENT_VIEW_COLORS_B053);
});

test('B053 preview, cancel, and persisted commit leave real HWP/HWPX export bytes unchanged', () => {
  const document = HwpDocument.createEmpty();
  document.createBlankDocument();
  document.insertText(0, 0, 0, '문서 보기 색은 파일 내용이 아닙니다.');
  try {
    const hwpBefore = document.exportHwp();
    const hwpxBefore = document.exportHwpx();
    const storage = new MemoryStorageB053();
    const target = createCssDocumentViewColorTargetB053({ setProperty() {} });

    const cancelled = createDocumentViewColorControllerB053({ storage, target });
    cancelled.preview({ workspace: '#1a2b3c', paper: '#fffdf5' });
    cancelled.cancel();

    const committed = createDocumentViewColorControllerB053({ storage, target });
    committed.preview({ workspace: '#334455', paper: '#f8f4e8' });
    committed.commit();

    assert.deepEqual(document.exportHwp(), hwpBefore);
    assert.deepEqual(document.exportHwpx(), hwpxBefore);
  } finally {
    document.free();
  }
});
