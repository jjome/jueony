import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import init, { HwpDocument } from '../node_modules/@rhwp/core/rhwp.js';
import { collectDocumentStatistics, readDocumentStatistics, installDocumentInformation } from '../src/adapters/rhwp/document-info.ts';

test('document statistics count Unicode scalars and disclose extracted-text scope, not UTF-16 or control tokens', () => {
  const result = collectDocumentStatistics({
    name: '<未保存>.hwpx', info: { pageCount: 3, sectionCount: 2, encrypted: false, fontsUsed: ['바탕', '굴림', '바탕'] },
    text: '가 나😀\r\n\tA\u0002\ufffc', cursor: { root: { paraCount: 5 }, lists: [{ paraCount: 2 }, { paraCount: 3 }] },
    controls: [{ ctrlId: 'tbl' }, { ctrlId: 'tbl' }, { ctrlId: 'gso', userDesc: '그림' }, { ctrlId: 'gso', userDesc: '사각형' }, { ctrlId: 'gso', userDesc: '그리기' }, { ctrlId: 'eqed' }, { ctrlId: 'head' }, { ctrlId: '' }],
    fields: [{ cellField: false }, { cellField: true }, { cellField: false }],
  });
  assert.equal(result.charactersWithSpaces, 6); assert.equal(result.charactersWithoutSpaces, 4);
  assert.equal(result.tables, 2); assert.equal(result.pictures, 1); assert.equal(result.shapes, 2);
  assert.equal(result.equations, 1); assert.equal(result.fields, 2); assert.equal(result.namedCells, 1);
  assert.equal(result.unclassifiedControls, 1); assert.equal(result.bodyParagraphs, 5); assert.equal(result.nestedParagraphs, 5);
  assert.deepEqual(result.fonts, ['굴림', '바탕']);
});

test('document information stays available for a readonly document and requires an actual loaded document', () => {
  let command: any;
  installDocumentInformation({ registry: { register(value: any) { command = value; } }, input: () => null });
  assert.equal(command.id, 'file:document-info'); assert.equal(command.opensDialog, true);
  assert.equal(command.canExecute({ hasDocument: true, isEditable: false }), true);
  assert.equal(command.canExecute({ hasDocument: false, isEditable: true }), false);
});

test('pinned WASM reader includes current unsaved body and table text without changing the document', async () => {
  await init({ module_or_path: await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm', import.meta.url)) });
  const doc = HwpDocument.createEmpty();
  try {
    doc.createBlankDocument();
    doc.insertText(0, 0, 0, '가 나😀');
    const created = JSON.parse(doc.createTable(0, 0, 4, 2, 2));
    doc.insertTextInCell(0, created.paraIdx, created.controlIdx, 0, 0, 0, '셀 값');
    const before = doc.exportHwpx(), modelBefore = doc.getCursorModel(), textBefore = doc.getTextFileUnicode();
    const stats = readDocumentStatistics({ borrowDocumentHandle: () => doc, fileName: '저장 전.hwpx' });
    assert.equal(stats.name, '저장 전.hwpx'); assert.equal(stats.sections, 1);
    assert.equal(stats.tables, 1); assert.equal(stats.nestedParagraphs, 4);
    assert.equal(stats.charactersWithoutSpaces, 5); // 가, 나, 😀, 셀, 값
    assert.equal(stats.charactersWithSpaces, 7);
    assert.equal(stats.bodyParagraphs, doc.getParagraphCount(0));
    assert.deepEqual(doc.exportHwpx(), before);
    assert.equal(doc.getCursorModel(), modelBefore); assert.equal(doc.getTextFileUnicode(), textBefore);
    const reopened = new HwpDocument(before);
    try {
      const saved = readDocumentStatistics(reopened, '재열기.hwpx');
      assert.equal(saved.charactersWithoutSpaces, stats.charactersWithoutSpaces);
      assert.equal(saved.tables, stats.tables); assert.equal(saved.nestedParagraphs, stats.nestedParagraphs);
    } finally { reopened.free(); }
  } finally { doc.free(); }
});
