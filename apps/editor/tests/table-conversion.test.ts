import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTableText, joinTableText, tableTextDelimiter, sliceCharacterRuns } from '../src/modules/document/public/table-conversion.ts';
import { readFile } from 'node:fs/promises';
import init, { HwpDocument } from '../node_modules/@rhwp/core/rhwp.js';
import { readTextTablePlan, readTableTextPlan, executeTableConversion } from '../src/adapters/rhwp/table-conversion-native.ts';

test('literal table text preserves whitespace, empty and trailing cells and Unicode', () => {
  const rows = [[' 가😀 ', '', ''], ['나', '0', '끝']];
  assert.deepEqual(parseTableText([' 가😀 \t\t', '나\t0\t끝'], 'tab'), rows);
  assert.deepEqual(joinTableText(rows, 'tab'), [' 가😀 \t\t', '나\t0\t끝']);
  assert.deepEqual(parseTableText(['"가",나', '1,2'], 'comma'), [['"가"', '나'], ['1', '2']]);
  assert.equal(tableTextDelimiter('semicolon'), ';');
});

test('literal conversion rejects uneven, too large or ambiguous cells rather than drop content', () => {
  assert.throws(() => parseTableText(['가\t나', '하나'], 'tab'), /구분자 개수/);
  assert.throws(() => parseTableText([], 'tab'), /문단/);
  assert.throws(() => parseTableText(['가\n나'], 'tab'), /제어 문자/);
  assert.throws(() => parseTableText(['가\t나'], 'comma'), /제어 문자/);
  assert.throws(() => parseTableText(['a'.repeat(4001)], 'tab'), /4,000/);
  assert.throws(() => parseTableText(Array(11).fill(Array(100).fill('').join('\t')), 'tab'), /1,000셀/);
  assert.throws(() => joinTableText([['가,나']], 'comma'), /다른 구분자/);
  assert.throws(() => joinTableText([['가\n나']], 'tab'), /다른 구분자/);
  assert.throws(() => tableTextDelimiter('pipe'), /구분자/);
});

test('character runs are sliced in scalar coordinates with complete nonoverlapping coverage', () => {
  const runs = [{ startOffset: 0, endOffset: 2, charShapeId: 0 }, { startOffset: 2, endOffset: 5, charShapeId: 3 }];
  assert.deepEqual(sliceCharacterRuns(runs, 1, 4), [{ startOffset: 0, endOffset: 1, charShapeId: 0 }, { startOffset: 1, endOffset: 3, charShapeId: 3 }]);
  assert.deepEqual(sliceCharacterRuns(runs, 3, 3), []);
  assert.throws(() => sliceCharacterRuns([runs[1]], 0, 5), /빠지거나/);
  assert.throws(() => sliceCharacterRuns([runs[0], { ...runs[1], startOffset: 1 }], 0, 5), /겹칩니다/);
  assert.throws(() => sliceCharacterRuns(runs, 0, 6), /모두/);
});

test('mixed Unicode character formatting survives text to table and table to text in both formats', async () => {
  await init({ module_or_path: await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm', import.meta.url)) });
  for (const ext of ['Hwp', 'Hwpx']) {
    const doc: any = HwpDocument.createEmpty(); doc.createBlankDocument(); let reopened: any;
    try {
      doc.insertText(0, 0, 0, '가😀나\t\t끝글');
      doc.applyCharFormat(0, 0, 1, 3, JSON.stringify({ bold: true, textColor: '#ff0000' }));
      doc.applyCharFormat(0, 0, 3, 5, JSON.stringify({ italic: true }));
      doc.applyCharFormat(0, 0, 6, 7, JSON.stringify({ underline: 'Bottom' }));
      const before = [0, 1, 2, 5, 6].map(offset => JSON.parse(doc.getCharPropertiesAt(0, 0, offset)));
      const plan = readTextTablePlan(doc, { anchor: { sectionIndex: 0, paragraphIndex: 0, charOffset: 0 }, focus: { sectionIndex: 0, paragraphIndex: 0, charOffset: 7 } }, 'tab');
      executeTableConversion(doc, plan);
      const table = JSON.parse(doc.getControls()).find((c: any) => c.ctrlId === 'tbl'), ref = { sec: 0, ppi: table.para, ci: table.controlIndex };
      assert.equal(JSON.parse(doc.getCellCharPropertiesAt(0, ref.ppi, ref.ci, 0, 0, 0)).bold, false);
      assert.equal(JSON.parse(doc.getCellCharPropertiesAt(0, ref.ppi, ref.ci, 0, 0, 1)).bold, true);
      assert.equal(JSON.parse(doc.getCellCharPropertiesAt(0, ref.ppi, ref.ci, 1, 0, 0)).italic, true);
      const savedTable: any = new HwpDocument(doc['export' + ext]());
      try { assert.equal(JSON.parse(savedTable.getCellCharPropertiesAt(0, ref.ppi, ref.ci, 0, 0, 2)).textColor, '#ff0000'); }
      finally { savedTable.free(); }
      const inverse = readTableTextPlan(doc, ref, 'tab'); executeTableConversion(doc, inverse);
      assert.equal(doc.getTextRange(0, 0, 0, 7), '가😀나\t\t끝글');
      [0, 1, 2, 5, 6].forEach((offset, index) => assert.deepEqual(JSON.parse(doc.getCharPropertiesAt(0, 0, offset)), before[index]));
      reopened = new HwpDocument(doc['export' + ext]());
      assert.equal(JSON.parse(reopened.getCharPropertiesAt(0, 0, 1)).bold, true);
      assert.equal(JSON.parse(reopened.getCharPropertiesAt(0, 0, 5)).bold, false);
    } finally { reopened?.free(); doc.free(); }
  }
});

test('native body conversion preserves surrounding paragraphs, cells, Unicode and row styles; stale plan is refused', async () => {
  await init({ module_or_path: await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm', import.meta.url)) });
  const doc: any = HwpDocument.createEmpty(); doc.createBlankDocument();
  try {
    const rows = ['앞 문단', ' 가😀 \t\t끝', '둘\t셋\t넷', '뒤 문단'];
    for (let p = 0; p < rows.length; p++) { if (p) doc.splitParagraph(0, p - 1, doc.getParagraphLength(0, p - 1)); doc.insertText(0, p, 0, rows[p]); }
    doc.applyCharFormat(0, 1, 0, doc.getParagraphLength(0, 1), JSON.stringify({ bold: true }));
    const selection = { anchor: { sectionIndex: 0, paragraphIndex: 3, charOffset: 0 }, focus: { sectionIndex: 0, paragraphIndex: 1, charOffset: 0 } };
    const plan = readTextTablePlan(doc, selection, 'tab'); assert.equal(plan.first, 1); assert.equal(plan.last, 2);
    const stale = structuredClone(plan); stale.texts[0] = '바뀜';
    const before = doc.exportHwpx(); assert.throws(() => executeTableConversion(doc, stale), /바뀌었습니다/); assert.deepEqual(doc.exportHwpx(), before);
    executeTableConversion(doc, plan);
    const controls = JSON.parse(doc.getControls()), table = controls.find((c: any) => c.ctrlId === 'tbl');
    const inverse = readTableTextPlan(doc, { sec: 0, ppi: table.para, ci: table.controlIndex }, 'tab');
    assert.deepEqual(inverse.rows, [[' 가😀 ', '', '끝'], ['둘', '셋', '넷']]);
    assert.equal(JSON.parse(doc.getCellCharPropertiesAt(0, table.para, table.controlIndex, 0, 0, 0)).bold, true);
    executeTableConversion(doc, inverse);
    const texts = Array.from({ length: doc.getParagraphCount(0) }, (_, p) => doc.getTextRange(0, p, 0, doc.getParagraphLength(0, p)));
    assert.deepEqual(texts, rows);
    assert.equal(JSON.parse(doc.getCharPropertiesAt(0, 1, 0)).bold, true);
    for (const method of ['exportHwp', 'exportHwpx']) {
      const reopened = new HwpDocument(doc[method]());
      try { assert.deepEqual(Array.from({ length: reopened.getParagraphCount(0) }, (_, p) => reopened.getTextRange(0, p, 0, reopened.getParagraphLength(0, p))), rows); }
      finally { reopened.free(); }
    }
  } finally { doc.free(); }
});

test('native preflight rejects partial selection, controls, merged and protected cells without mutation', async () => {
  await init({ module_or_path: await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm', import.meta.url)) });
  const doc: any = HwpDocument.createEmpty(); doc.createBlankDocument();
  try {
    doc.insertText(0, 0, 0, '가\t나');
    assert.throws(() => readTextTablePlan(doc, { anchor: { sectionIndex: 0, paragraphIndex: 0, charOffset: 1 }, focus: { sectionIndex: 0, paragraphIndex: 0, charOffset: 3 } }, 'tab'), /처음부터/);
    const table = JSON.parse(doc.createTable(0, 0, 3, 1, 2));
    const before = doc.exportHwpx();
    assert.throws(() => readTextTablePlan(doc, { anchor: { sectionIndex: 0, paragraphIndex: table.paraIdx, charOffset: 0 }, focus: { sectionIndex: 0, paragraphIndex: table.paraIdx, charOffset: doc.getParagraphLength(0, table.paraIdx) } }, 'tab'), /개체/);
    assert.deepEqual(doc.exportHwpx(), before);
    doc.deleteText(0, 0, 0, 3);
    doc.setCellProperties(0, table.paraIdx, table.controlIdx, 0, JSON.stringify({ cellProtect: true }));
    assert.throws(() => readTableTextPlan(doc, { sec: 0, ppi: table.paraIdx, ci: table.controlIdx }, 'tab'), /보호/);
  } finally { doc.free(); }
});

test('native text conversion refuses forced page boundaries and multi-column sources before mutation', async () => {
  await init({ module_or_path: await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm', import.meta.url)) });
  const doc: any = HwpDocument.createEmpty(); doc.createBlankDocument();
  try {
    doc.insertText(0, 0, 0, '가\t나'); doc.insertPageBreak(0, 0, 3); doc.insertText(0, 1, 0, '다\t라');
    const selection = { anchor: { sectionIndex: 0, paragraphIndex: 0, charOffset: 0 }, focus: { sectionIndex: 0, paragraphIndex: 1, charOffset: 3 } };
    const before = doc.exportHwpx(); assert.throws(() => readTextTablePlan(doc, selection, 'tab'), /쪽 경계/); assert.deepEqual(doc.exportHwpx(), before);
    doc.setColumnDef(0, 2, 0, 1, 0);
    assert.throws(() => readTextTablePlan(doc, selection, 'tab'), /다단/);
  } finally { doc.free(); }
});

test('native conversion retains each row paragraph style and each cell single-format run', async () => {
  await init({ module_or_path: await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm', import.meta.url)) });
  const doc: any = HwpDocument.createEmpty(); doc.createBlankDocument();
  try {
    const id = doc.createStyle(JSON.stringify({ name: '변환 제목', type: 0 }));
    doc.insertText(0, 0, 0, '제목\t내용'); doc.applyStyle(0, 0, id); doc.splitParagraph(0, 0, 5); doc.insertText(0, 1, 0, '둘\t셋'); doc.applyStyle(0, 1, 0);
    const plan = readTextTablePlan(doc, { anchor: { sectionIndex: 0, paragraphIndex: 0, charOffset: 0 }, focus: { sectionIndex: 0, paragraphIndex: 1, charOffset: 3 } }, 'tab');
    executeTableConversion(doc, plan); const table = JSON.parse(doc.getControls()).find((c: any) => c.ctrlId === 'tbl'), ref = { sec: 0, ppi: table.para, ci: table.controlIndex };
    assert.equal(JSON.parse(doc.getCellStyleAt(0, ref.ppi, ref.ci, 0, 0)).id, id); assert.equal(JSON.parse(doc.getCellStyleAt(0, ref.ppi, ref.ci, 2, 0)).id, 0);
    doc.applyCharFormatInCell(0, ref.ppi, ref.ci, 1, 0, 0, 2, JSON.stringify({ italic: true }));
    const inverse = readTableTextPlan(doc, ref, 'tab'); executeTableConversion(doc, inverse);
    assert.equal(JSON.parse(doc.getStyleAt(0, 0)).id, id); assert.equal(JSON.parse(doc.getStyleAt(0, 1)).id, 0);
    assert.equal(JSON.parse(doc.getCharPropertiesAt(0, 0, 3)).italic, true); assert.equal(JSON.parse(doc.getCharPropertiesAt(0, 0, 0)).italic, false);
    const reopened: any = new HwpDocument(doc.exportHwpx());
    try { assert.equal(JSON.parse(reopened.getStyleAt(0, 0)).name, '변환 제목'); assert.equal(JSON.parse(reopened.getCharPropertiesAt(0, 0, 3)).italic, true); }
    finally { reopened.free(); }
  } finally { doc.free(); }
});
