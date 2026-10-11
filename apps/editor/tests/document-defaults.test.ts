import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import init, { HwpDocument } from '@rhwp/core';
import { DOCUMENT_DEFAULTS_KEY, defaultDocumentDefaults, readDocumentDefaults, saveDocumentDefaults, resetDocumentDefaults, validateDocumentDefaults, applyNewDocumentDefaults } from '../src/preferences/document-defaults.ts';
await init({ module_or_path: await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm', import.meta.url)) });
const blank = () => { const doc = HwpDocument.createEmpty(); doc.createBlankDocument(); return doc; };
class Storage {
  raw: string | null = null; denied = false;
  getItem(key: string) { assert.equal(key, DOCUMENT_DEFAULTS_KEY); return this.raw; }
  setItem(key: string, value: string) { assert.equal(key, DOCUMENT_DEFAULTS_KEY); if (this.denied) throw new Error('denied'); this.raw = value; }
  removeItem(key: string) { assert.equal(key, DOCUMENT_DEFAULTS_KEY); if (this.denied) throw new Error('denied'); this.raw = null; }
}
function config() { const value = defaultDocumentDefaults(); value.enabled = true; value.page.landscape = true; value.page.marginLeftMm = 22; value.page.marginRightMm = 18; value.font = { family: '맑은 고딕', sizePt: 13 }; return value; }
const toHwp = (mm: number) => Math.round(mm * 7200 / 25.4);
test('missing setting preserves pinned blank document defaults without an implicit write', () => {
  const storage = new Storage(), value = readDocumentDefaults(storage), doc = blank();
  try { const before = doc.exportHwp(); assert.equal(value.enabled, false); assert.equal(applyNewDocumentDefaults(doc, value), false); assert.deepEqual(doc.exportHwp(), before); assert.equal(storage.raw, null); } finally { doc.free(); }
});
test('user defaults survive another store reader, preserve unknown fields and explicit reset', () => {
  const storage = new Storage(); const value = config();
  saveDocumentDefaults(storage, value); assert.deepEqual(readDocumentDefaults(storage), value);
  const raw = JSON.parse(storage.raw!); raw.extra = { retained: true }; raw.page.future = 17; storage.raw = JSON.stringify(raw);
  value.font.sizePt = 14; saveDocumentDefaults(storage, value);
  assert.equal(JSON.parse(storage.raw!).extra.retained, true); assert.equal(JSON.parse(storage.raw!).page.future, 17);
  resetDocumentDefaults(storage); assert.equal(storage.raw, null); assert.equal(readDocumentDefaults(storage).enabled, false);
});
test('invalid margins, font and versions cannot overwrite persisted preferences', () => {
  const storage = new Storage(); saveDocumentDefaults(storage, config()); const before = storage.raw;
  for (const mutate of [
    (v: any) => { v.version = 2; }, (v: any) => { v.page.widthMm = NaN; }, (v: any) => { v.page.landscape = 'true'; },
    (v: any) => { v.page.marginTopMm = 300; }, (v: any) => { v.font.family = ''; }, (v: any) => { v.font.sizePt = Infinity; },
  ]) { const v = config(); mutate(v); assert.throws(() => saveDocumentDefaults(storage, v)); assert.equal(storage.raw, before); }
  for (const raw of ['{invalid', 'null', JSON.stringify({ ...config(), version: 2 })]) {
    storage.raw = raw; assert.throws(() => readDocumentDefaults(storage)); assert.throws(() => saveDocumentDefaults(storage, config())); assert.equal(storage.raw, raw);
  }
});
test('write failure keeps previous default and explicit reset failure is reported', () => {
  const storage = new Storage(); saveDocumentDefaults(storage, config()); const before = storage.raw;
  storage.denied = true; assert.throws(() => saveDocumentDefaults(storage, defaultDocumentDefaults()), /저장하지/); assert.equal(storage.raw, before);
  assert.throws(() => resetDocumentDefaults(storage), /초기화하지/); assert.equal(storage.raw, before);
});
test('orientation validation uses physical rotated page dimensions', () => {
  const v = config(); v.page.marginLeftMm = 110; v.page.marginRightMm = 100;
  assert.doesNotThrow(() => validateDocumentDefaults(v));
  v.page.landscape = false; assert.throws(() => validateDocumentDefaults(v), /본문 영역/);
});
test('defaults are applied to new document only; changing settings leaves an existing document unchanged', () => {
  const storage = new Storage(), existing = blank(), next = blank();
  try {
    existing.insertText(0, 0, 0, '기존 문서');
    const before = existing.exportHwp(); saveDocumentDefaults(storage, config());
    assert.deepEqual(existing.exportHwp(), before);
    assert.throws(() => applyNewDocumentDefaults(existing, readDocumentDefaults(storage)), /빈 문서/);
    assert.deepEqual(existing.exportHwp(), before);
    assert.equal(applyNewDocumentDefaults(next, readDocumentDefaults(storage)), true);
    assert.equal(JSON.parse(next.getPageDef(0)).landscape, true);
  } finally { existing.free(); next.free(); }
});
for (const format of ['hwp', 'hwpx'] as const) {
  test(format + ': blank document default page, normal style and later typing survive serialization', () => {
    const doc = blank(); try {
      applyNewDocumentDefaults(doc, config());
      const bytes = format === 'hwp' ? doc.exportHwp() : doc.exportHwpx(), reopened = new HwpDocument(bytes);
      try {
        const page = JSON.parse(reopened.getPageDef(0)), properties = JSON.parse(reopened.getCharPropertiesAt(0, 0, 0));
        assert.equal(page.width, toHwp(210)); assert.equal(page.height, toHwp(297)); assert.equal(page.landscape, true);
        assert.equal(page.marginLeft, toHwp(22)); assert.equal(page.marginRight, toHwp(18));
        assert.equal(properties.fontFamily, '맑은 고딕'); assert.equal(properties.fontSize, 1300);
        const style = JSON.parse(reopened.getStyleAt(0, 0));
        assert.equal(JSON.parse(reopened.getStyleDetail(style.id)).charProps.fontSize, 1300);
        reopened.insertText(0, 0, 0, '신규 문서 기본값 검증');
        assert.equal(JSON.parse(reopened.getCharPropertiesAt(0, 0, 4)).fontFamily, '맑은 고딕');
      } finally { reopened.free(); }
    } finally { doc.free(); }
  });
}
test('prepare new-defaults HWP/HWPX fixtures for independent Hancom reopening', async () => {
  const destination = new URL('../../../docs/evidence/continuation-2026-10-11/state/', import.meta.url);
  await mkdir(destination, { recursive: true });
  const doc = blank(); try {
    applyNewDocumentDefaults(doc, config()); doc.insertText(0, 0, 0, '새 문서 기본값 검증: A4 가로 · 왼쪽 22mm · 오른쪽 18mm · 맑은 고딕 13pt');
    await writeFile(new URL('new-document-defaults.hwp', destination), doc.exportHwp());
    await writeFile(new URL('new-document-defaults.hwpx', destination), doc.exportHwpx());
  } finally { doc.free(); }
});