import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import init, { HwpDocument } from '@rhwp/core';
import {
  ClearCharacterStyleCommand,
  installClearCharacterStyle,
  readClearCharacterStylePlan,
} from '../src/adapters/rhwp/clear-character-style.ts';

await init({ module_or_path: await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm', import.meta.url)) });

const parse = (value: unknown): any => typeof value === 'string' ? JSON.parse(value) : value;
const range = { start: { sectionIndex: 0, paragraphIndex: 0, charOffset: 0 }, end: { sectionIndex: 0, paragraphIndex: 0, charOffset: 3 } };
const blank = () => { const doc = HwpDocument.createEmpty(); doc.createBlankDocument(); doc.insertText(0, 0, 0, '가나다'); return doc; };

test('Ctrl+- command clears one exact direct-format run, supports undo/redo, and preserves HWP/HWPX', () => {
  const doc = blank();
  try {
    assert.deepEqual(parse(doc.applyCharFormat(0, 0, 0, 3, JSON.stringify({ bold: true, italic: true }))), { ok: true });
    const plan = readClearCharacterStylePlan(doc, range), command = new ClearCharacterStyleCommand(plan);
    assert.notEqual(plan.sourceCharShapeId, plan.targetCharShapeId);
    command.execute(doc);
    assert.equal(parse(doc.getCharPropertiesAt(0, 0, 1)).charShapeId, plan.targetCharShapeId);
    assert.equal(parse(doc.getCharPropertiesAt(0, 0, 1)).bold, false);
    for (const bytes of [doc.exportHwp(), doc.exportHwpx()]) {
      const reopened = new HwpDocument(bytes);
      try {
        assert.equal(reopened.getTextRange(0, 0, 0, 3), '가나다');
        assert.equal(parse(reopened.getCharPropertiesAt(0, 0, 1)).charShapeId, plan.targetCharShapeId);
        assert.equal(parse(reopened.getStyleAt(0, 0)).id, plan.styleId);
      } finally { reopened.free(); }
    }
    command.undo(doc);
    assert.equal(parse(doc.getCharPropertiesAt(0, 0, 1)).charShapeId, plan.sourceCharShapeId);
    assert.equal(parse(doc.getCharPropertiesAt(0, 0, 1)).bold, true);
    command.execute(doc);
    assert.equal(parse(doc.getCharPropertiesAt(0, 0, 1)).charShapeId, plan.targetCharShapeId);
  } finally { doc.free(); }
});

test('mixed formats, stale source, multi-paragraph and cell-like ranges fail before mutation', () => {
  const doc = blank();
  try {
    doc.applyCharFormat(0, 0, 0, 1, JSON.stringify({ bold: true }));
    doc.applyCharFormat(0, 0, 1, 3, JSON.stringify({ italic: true }));
    const before = doc.exportHwpx();
    assert.throws(() => readClearCharacterStylePlan(doc, range), /섞인/);
    assert.deepEqual(doc.exportHwpx(), before);

    assert.throws(() => readClearCharacterStylePlan(doc, {
      start: range.start, end: { ...range.end, paragraphIndex: 1 },
    }), /한 문단/);
    assert.throws(() => readClearCharacterStylePlan(doc, {
      start: { ...range.start, parentParaIndex: 0 }, end: { ...range.end, parentParaIndex: 0 },
    }), /한 문단/);
  } finally { doc.free(); }

  const stale = blank();
  try {
    stale.applyCharFormat(0, 0, 0, 3, JSON.stringify({ bold: true }));
    const plan = readClearCharacterStylePlan(stale, range), command = new ClearCharacterStyleCommand(plan);
    stale.replaceText(0, 0, 0, 3, '라마바');
    const before = stale.exportHwpx();
    assert.throws(() => command.execute(stale), /바뀌었습니다/);
    assert.deepEqual(stale.exportHwpx(), before);
  } finally { stale.free(); }
});

test('registry command refuses a changed revision before executing the engine command', () => {
  const doc = blank();
  let registered: any, executed = 0, revision = '1:0';
  const selection = structuredClone(range);
  const cursor = { hasSelection: () => true, isInHeaderFooter: () => false, isInFootnote: () => false, isInTextBox: () => false };
  const input = { wasm: doc, cursor, isComposing: false, getSelection: () => structuredClone(selection), executeOperation: () => { executed++; } };
  const context = { hasDocument: true, isEditable: true, isFormMode: false, inField: false, inTable: false, inCellSelectionMode: false, inTableObjectSelection: false, inPictureObjectSelection: false };
  const prior = Object.getOwnPropertyDescriptor(globalThis, 'window');
  try {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: {
      jueonyEditor: { busy: () => false, revision: () => revision, documentIdentity: () => 'doc' },
      rhwpStudio: { automation: { getContext: () => context } },
    } });
    installClearCharacterStyle({ register: (value: any) => { registered = value; } }, () => input, { emit() {} });
    assert.equal(registered.id, 'ext:jueony-clear-char-style');
    const original = doc.getStyleList.bind(doc);
    doc.getStyleList = () => { const value = original(); revision = '1:1'; return value; };
    assert.throws(() => registered.execute(), /바뀌었습니다/);
    assert.equal(executed, 0);
  } finally {
    doc.free();
    if (prior) Object.defineProperty(globalThis, 'window', prior); else Reflect.deleteProperty(globalThis, 'window');
  }
});
