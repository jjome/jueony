import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
const enginePackage=process.env.JUEONY_ENGINE_PACKAGE?resolve(process.env.JUEONY_ENGINE_PACKAGE):fileURLToPath(new URL('../node_modules/@rhwp/core/',import.meta.url));
const {default:init,HwpDocument}=await import(pathToFileURL(enginePackage+'/rhwp.js').href);
import { planParagraphSort } from '../src/modules/document/public/paragraph-sort.ts';
import { readParagraphSortPlan, executeParagraphSort, preflightParagraphSort } from '../src/adapters/rhwp/paragraph-sort-native.ts';
const options = { mode: 'number' as const, descending: false, keepFirst: true, column: 2 };

test('paragraph sorting uses exact signed decimal keys, stable ties, title exemption and explicit tab columns', () => {
  const rows = ['이름\t점수', '가\t9007199254740993', '나\t9007199254740992', '다\t-.2', '라\t-0.20', '마\t0', '바\t-0', '사\t+.02'];
  assert.deepEqual(planParagraphSort(rows, options), [0, 3, 4, 5, 6, 7, 2, 1]);
  assert.deepEqual(planParagraphSort(rows, { ...options, descending: true }), [0, 1, 2, 7, 5, 6, 3, 4]);
  assert.deepEqual(planParagraphSort(['항목10', '항목2', '항목1'], { mode: 'text', descending: false, keepFirst: false, column: 0 }), [2, 1, 0]);
  assert.throws(() => planParagraphSort(['제목', '값'], options), /탭 열/);
  assert.throws(() => planParagraphSort(['제목', '가\t1,000'], options), /숫자/);
  assert.throws(() => planParagraphSort(['한 문단'], options), /2~1,000/);
  assert.throws(() => planParagraphSort(['가', '나'], { ...options, column: -1 }), /설정/);
});

test('native sorting moves mixed runs, paragraph formats and styles together without changing surrounding text', async () => {
  await init({ module_or_path: await readFile(enginePackage+'/rhwp_bg.wasm') });
  for (const ext of ['Hwp', 'Hwpx']) {
    const doc: any = HwpDocument.createEmpty(); doc.createBlankDocument(); let reopened: any;
    try {
      const texts = ['앞 문단', '이름\t점수', '가😀\t20', '나\t3', '다\t-2', '뒤 문단'];
      texts.forEach((text, p) => { if (p) doc.splitParagraph(0, p - 1, doc.getParagraphLength(0, p - 1)); doc.insertText(0, p, 0, text); });
      doc.applyCharFormat(0, 2, 1, 2, JSON.stringify({ bold: true, textColor: '#ff0000' }));
      doc.applyParaFormat(0, 3, JSON.stringify({ alignment: 'center', spacingBefore: 283 }));
      const style = doc.createStyle(JSON.stringify({ name: '정렬 스타일', type: 0 })); doc.applyStyle(0, 4, style);
      const selection = { anchor: { sectionIndex: 0, paragraphIndex: 1, charOffset: 0 }, focus: { sectionIndex: 0, paragraphIndex: 5, charOffset: 0 } };
      const plan = readParagraphSortPlan(doc, selection, options), before = doc.exportHwpx();
      preflightParagraphSort({ fileName: 'sort.' + ext.toLowerCase(), borrowDocumentHandle: () => doc, getWasmModuleExports: () => ({ HwpDocument }) }, plan); assert.deepEqual(doc.exportHwpx(), before);
      executeParagraphSort(doc, plan);
      assert.deepEqual(Array.from({ length: doc.getParagraphCount(0) }, (_, p) => doc.getTextRange(0, p, 0, doc.getParagraphLength(0, p))), ['앞 문단', '이름\t점수', '다\t-2', '나\t3', '가😀\t20', '뒤 문단']);
      assert.equal(JSON.parse(doc.getCharPropertiesAt(0, 4, 1)).bold, true); assert.equal(JSON.parse(doc.getParaPropertiesAt(0, 3)).alignment, 'center'); assert.equal(JSON.parse(doc.getStyleAt(0, 2)).name, '정렬 스타일');
      reopened = new HwpDocument(doc['export' + ext]()); assert.equal(JSON.parse(reopened.getCharPropertiesAt(0, 4, 1)).textColor, '#ff0000');
    } finally { reopened?.free(); doc.free(); }
  }
});

test('stale source formatting and partial selections are refused before sorting', async () => {
  await init({ module_or_path: await readFile(enginePackage+'/rhwp_bg.wasm') });
  const doc: any = HwpDocument.createEmpty(); doc.createBlankDocument();
  try {
    doc.insertText(0, 0, 0, '2'); doc.splitParagraph(0, 0, 1); doc.insertText(0, 1, 0, '1');
    const selection = { anchor: { sectionIndex: 0, paragraphIndex: 0, charOffset: 0 }, focus: { sectionIndex: 0, paragraphIndex: 1, charOffset: 1 } };
    const plan = readParagraphSortPlan(doc, selection, { ...options, column: 0, keepFirst: false });
    doc.applyCharFormat(0, 1, 0, 1, JSON.stringify({ italic: true })); const before = doc.exportHwpx(); assert.throws(() => executeParagraphSort(doc, plan), /바뀌었습니다/); assert.deepEqual(doc.exportHwpx(), before);
    assert.throws(() => readParagraphSortPlan(doc, { ...selection, anchor: { ...selection.anchor, charOffset: 1 } }, options), /처음부터/);
  } finally { doc.free(); }
});
