import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import init, { HwpDocument } from '../node_modules/@rhwp/core/rhwp.js';
import { transformText } from '../src/modules/document/public/text-transform.ts';
import { readTextTransformPlan, executeTextTransform } from '../src/adapters/rhwp/text-transform-native.ts';
import { readPlainTextPlan, executePlainText } from '../src/adapters/rhwp/plain-text-native.ts';

test('Unicode case expansion and printable ASCII width conversion leave Hangul and emoji intact', () => {
  assert.equal(transformText('ab ß 한글😀', 'upper').text, 'AB SS 한글😀');
  assert.equal(transformText('ＡＢ１２！　한글😀', 'half-width').text, 'AB12! 한글😀');
  assert.equal(transformText('AB12! 한글😀', 'full-width').text, 'ＡＢ１２！　한글😀');
  assert.throws(() => transformText('a', 'unknown' as any));
});
test('native body selection expansion preserves mixed character formatting and text outside selection in both formats', async () => {
  await init({ module_or_path: await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm', import.meta.url)) });
  const doc: any = HwpDocument.createEmpty(); doc.createBlankDocument();
  try {
    doc.insertText(0, 0, 0, '앞aß😀b뒤'); doc.applyCharFormat(0, 0, 2, 3, JSON.stringify({ bold: true })); doc.applyCharFormat(0, 0, 5, 6, JSON.stringify({ italic: true }));
    const range = { start: { sectionIndex: 0, paragraphIndex: 0, charOffset: 1 }, end: { sectionIndex: 0, paragraphIndex: 0, charOffset: 5 } }, plan = readTextTransformPlan(doc, range, 'upper');
    executeTextTransform(doc, plan); assert.equal(doc.getTextRange(0, 0, 0, 7), '앞ASS😀B뒤');
    assert.throws(() => executeTextTransform(doc, plan), /바뀌었습니다/);
    for (const method of ['exportHwp', 'exportHwpx']) {
      const reopened: any = new HwpDocument(doc[method]());
      try {
        assert.equal(reopened.getTextRange(0, 0, 0, 7), '앞ASS😀B뒤');
        for (const at of [2, 3]) assert.equal(JSON.parse(reopened.getCharPropertiesAt(0, 0, at)).bold, true);
        assert.equal(JSON.parse(reopened.getCharPropertiesAt(0, 0, 4)).bold, false);
        assert.equal(JSON.parse(reopened.getCharPropertiesAt(0, 0, 6)).italic, true);
      } finally { reopened.free(); }
    }
  } finally { doc.free(); }
});
test('native same-cell case conversion keeps table geometry and neighbours', async () => {
  await init({ module_or_path: await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm', import.meta.url)) });
  const doc: any = HwpDocument.createEmpty(); doc.createBlankDocument();
  try {
    const t = JSON.parse(doc.createTable(0, 0, 0, 1, 2)); doc.insertTextInCell(0, t.paraIdx, t.controlIdx, 0, 0, 0, 'aß😀z'); doc.insertTextInCell(0, t.paraIdx, t.controlIdx, 1, 0, 0, '유지');
    const position = { sectionIndex: 0, paragraphIndex: 0, parentParaIndex: t.paraIdx, controlIndex: t.controlIdx, cellIndex: 0, cellParaIndex: 0, cellPath: [{ controlIndex: t.controlIdx, cellIndex: 0, cellParaIndex: 0 }] }, geometry = doc.getTableDimensions(0, t.paraIdx, t.controlIdx);
    const plan = readTextTransformPlan(doc, { start: { ...position, charOffset: 0 }, end: { ...position, charOffset: 4 } }, 'upper'); executeTextTransform(doc, plan);
    assert.equal(doc.getTextInCell(0, t.paraIdx, t.controlIdx, 0, 0, 0, 5), 'ASS😀Z'); assert.equal(doc.getTextInCell(0, t.paraIdx, t.controlIdx, 1, 0, 0, 2), '유지'); assert.equal(doc.getTableDimensions(0, t.paraIdx, t.controlIdx), geometry);
    doc.setCellProperties(0, t.paraIdx, t.controlIdx, 0, JSON.stringify({ cellProtect: true })); assert.throws(() => readTextTransformPlan(doc, plan.range, 'lower'), /보호/);
  } finally { doc.free(); }
});
test('native plain multiline replacement keeps suffix formatting, blank lines and Unicode through HWP/HWPX', async () => {
  await init({ module_or_path: await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm', import.meta.url)) });
  const doc: any = HwpDocument.createEmpty(); doc.createBlankDocument();
  try {
    doc.insertText(0, 0, 0, '앞바꿀뒤'); doc.applyCharFormat(0, 0, 3, 4, JSON.stringify({ italic: true }));
    const range = { start: { sectionIndex: 0, paragraphIndex: 0, charOffset: 1 }, end: { sectionIndex: 0, paragraphIndex: 0, charOffset: 3 } }, plan = readPlainTextPlan(doc, range, '첫😀\r\n\r\n끝');
    assert.deepEqual(executePlainText(doc, plan), { sectionIndex: 0, paragraphIndex: 2, charOffset: 1 });
    for (const method of ['exportHwp', 'exportHwpx']) {
      const reopened: any = new HwpDocument(doc[method]());
      try { assert.deepEqual(Array.from({ length: 3 }, (_, p) => reopened.getTextRange(0, p, 0, reopened.getParagraphLength(0, p))), ['앞첫😀', '', '끝뒤']); assert.equal(JSON.parse(reopened.getCharPropertiesAt(0, 2, 1)).italic, true); } finally { reopened.free(); }
    }
    assert.throws(() => readPlainTextPlan(doc, range, '\u0001'), /제어/);
  } finally { doc.free(); }
});
test('special Unicode spaces and soft hyphen remain exact characters after both native exports', async () => {
  await init({ module_or_path: await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm', import.meta.url)) });
  const doc: any = HwpDocument.createEmpty(); doc.createBlankDocument();
  try {
    const position = { sectionIndex: 0, paragraphIndex: 0, charOffset: 0 }, text = 'A\u00a0B\u2007C\u00adD'; executePlainText(doc, readPlainTextPlan(doc, { start: position, end: position }, text));
    for (const method of ['exportHwp', 'exportHwpx']) { const reopened: any = new HwpDocument(doc[method]()); try { assert.equal(reopened.getTextRange(0, 0, 0, 7), text); } finally { reopened.free(); } }
  } finally { doc.free(); }
});
