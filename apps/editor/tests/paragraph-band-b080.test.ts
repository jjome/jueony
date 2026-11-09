import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import test from 'node:test';
import {
  discardParagraphBandUndoB080,
  insertParagraphBandB080,
  PARAGRAPH_BAND_HEIGHT_HWPUNIT_B080,
  undoParagraphBandB080,
} from '../src/adapters/rhwp/paragraph-band-b080.ts';

const packageRoot = resolve(process.env.JUEONY_ENGINE_PACKAGE ?? 'apps/editor/node_modules/@rhwp/core');
const engine: any = await import(pathToFileURL(resolve(packageRoot, 'rhwp.js')).href + `?b080=${Date.now()}`);
await engine.default({module_or_path: await readFile(resolve(packageRoot, 'rhwp_bg.wasm'))});
const HwpDocument = engine.HwpDocument;

const target = (revision = 'document:1') => ({
  sectionIndex: 0, paragraphIndex: 0, charOffset: 0, story: 'body' as const,
  selectionCollapsed: true as const, editable: true as const, protected: false as const, revision,
});
const properties = (document: any, controlIndex: number) => JSON.parse(document.getShapeProperties(0, 0, controlIndex));
const bytes = (document: any, format: 'Hwp'|'Hwpx') => document[`export${format}`]();

test('B080 creates the documented paragraph-relative black rectangle and guarded undo is byte exact', () => {
  const document: any = HwpDocument.createEmpty(); document.createBlankDocument(); document.insertText(0, 0, 0, '문단 띠 대상');
  const beforeHwp = bytes(document, 'Hwp'), beforeHwpx = bytes(document, 'Hwpx');
  try {
    const receipt = insertParagraphBandB080(document, target());
    assert.equal(receipt.width, 59_528 - 8_504 - 8_504);
    assert.equal(receipt.height, PARAGRAPH_BAND_HEIGHT_HWPUNIT_B080);
    const props = properties(document, receipt.controlIndex);
    assert.deepEqual(Object.fromEntries(Object.keys({
      width: receipt.width, height: 300, treatAsChar: false,
      vertRelTo: 'Para', vertAlign: 'Top', horzRelTo: 'Para', horzAlign: 'Left',
      vertOffset: 0, horzOffset: 0, textWrap: 'TopAndBottom', lineType: 0,
      fillType: 'solid', fillBgColor: 0, fillPatColor: 0, fillPatType: -1, fillAlpha: 0,
    }).map(key => [key, props[key]])), {
      width: receipt.width, height: 300, treatAsChar: false,
      vertRelTo: 'Para', vertAlign: 'Top', horzRelTo: 'Para', horzAlign: 'Left',
      vertOffset: 0, horzOffset: 0, textWrap: 'TopAndBottom', lineType: 0,
      fillType: 'solid', fillBgColor: 0, fillPatColor: 0, fillPatType: -1, fillAlpha: 0,
    });
    assert.equal(undoParagraphBandB080(receipt), true);
    assert.deepEqual(bytes(document, 'Hwp'), beforeHwp);
    assert.deepEqual(bytes(document, 'Hwpx'), beforeHwpx);
    assert.equal(undoParagraphBandB080(receipt), false);
  } finally { document.free(); }
});

test('B080 shape survives HWP and HWPX save-reopen without changing body text', () => {
  for (const format of ['Hwp', 'Hwpx'] as const) {
    const document: any = HwpDocument.createEmpty(); document.createBlankDocument(); document.insertText(0, 0, 0, '보존할 본문');
    let reopened: any;
    try {
      const receipt = insertParagraphBandB080(document, target(`document:${format}`));
      reopened = new HwpDocument(bytes(document, format));
      assert.equal(reopened.getTextRange(0, 0, 0, reopened.getParagraphLength(0, 0)), '보존할 본문');
      const props = properties(reopened, receipt.controlIndex);
      assert.equal(props.width, receipt.width); assert.equal(props.height, 300);
      assert.equal(props.vertRelTo, 'Para'); assert.equal(props.horzRelTo, 'Para');
      assert.equal(props.textWrap, 'TopAndBottom'); assert.equal(props.lineType, 0);
      assert.equal(props.fillType, 'solid'); assert.equal(props.fillBgColor, 0);
      assert.equal(props.fillPatColor, 0); assert.equal(props.fillPatType, -1); assert.equal(props.fillAlpha, 0);
      assert.equal(discardParagraphBandUndoB080(receipt), true);
    } finally { reopened?.free(); document.free(); }
  }
});

test('B080 rejects unsupported stories, multi-column geometry and stale undo without mutation', () => {
  const document: any = HwpDocument.createEmpty(); document.createBlankDocument();
  try {
    const original = bytes(document, 'Hwpx');
    assert.throws(() => insertParagraphBandB080(document, {...target(), story: 'cell'}), /최상위 본문/);
    assert.deepEqual(bytes(document, 'Hwpx'), original);
    assert.equal(JSON.parse(document.setColumnDef(0, 2, 0, 1, 1134)).ok, true);
    const columns = bytes(document, 'Hwpx');
    assert.throws(() => insertParagraphBandB080(document, target()), /여러 단/);
    assert.deepEqual(bytes(document, 'Hwpx'), columns);
    assert.equal(JSON.parse(document.setColumnDef(0, 1, 0, 1, 0)).ok, true);
    const receipt = insertParagraphBandB080(document, target('document:2'));
    document.insertText(0, 0, 0, '변경');
    assert.throws(() => undoParagraphBandB080(receipt), /문서가 바뀌어/);
    assert.match(document.getTextRange(0, 0, 0, document.getParagraphLength(0, 0)), /^변경/);
    assert.equal(discardParagraphBandUndoB080(receipt), true);
  } finally { document.free(); }
});

