import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import init, { HwpDocument } from '../node_modules/@rhwp/core/rhwp.js';
import { readMultiParagraphPlainTextPlan, replaceMultiParagraphPlainText } from '../src/adapters/rhwp/multi-paragraph-plain-text.ts';

let initialized: Promise<unknown> | undefined;
const wasm = () => initialized ??= init({ module_or_path: readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm', import.meta.url)) as any });
const parsed = (value: any): any => typeof value === 'string' ? JSON.parse(value) : value;
const bytes = (document: any, format: 'hwp' | 'hwpx'): Uint8Array => document[format === 'hwp' ? 'exportHwp' : 'exportHwpx']();
const texts = (document: any): string[] => Array.from({ length: document.getParagraphCount(0) }, (_, paragraph) => document.getTextRange(0, paragraph, 0, document.getParagraphLength(0, paragraph)));

function fixture(): any {
  const document: any = HwpDocument.createEmpty(); document.createBlankDocument();
  document.insertText(0, 0, 0, 'PFXone');
  document.splitParagraph(0, 0, 6); document.insertText(0, 1, 0, 'middle');
  document.splitParagraph(0, 1, 6); document.insertText(0, 2, 0, 'tailSFX');
  document.applyCharFormat(0, 0, 0, 3, JSON.stringify({ bold: true }));
  document.applyCharFormat(0, 2, 4, 7, JSON.stringify({ italic: true }));
  return document;
}

const range = { start: { sectionIndex: 0, paragraphIndex: 0, charOffset: 3 }, end: { sectionIndex: 0, paragraphIndex: 2, charOffset: 4 } };

test('root-body multi-paragraph plain text replacement preserves boundaries, formats, both exports and exact undo', async () => {
  await wasm(); const document = fixture();
  try {
    const original = { hwp: bytes(document, 'hwp'), hwpx: bytes(document, 'hwpx') };
    let snapshots = 0; const target = document;
    const instrumented = new Proxy(document, { get(_object, key) {
      if (key === 'saveSnapshot') return () => { snapshots++; return target.saveSnapshot(); };
      const value = target[key as keyof typeof target]; return typeof value === 'function' ? value.bind(target) : value;
    } });
    const plan = readMultiParagraphPlainTextPlan(instrumented, range, '새1\r\n\r\n새3', 'revision-1');
    assert.equal(plan.source, 'one\nmiddle\ntail');
    const receipt = replaceMultiParagraphPlainText(instrumented, plan, () => 'revision-1', () => range);
    assert.equal(snapshots, 1);
    assert.deepEqual(receipt.caret, { sectionIndex: 0, paragraphIndex: 2, charOffset: 2 });
    assert.deepEqual(texts(document), ['PFX새1', '', '새3SFX']);
    assert.equal(parsed(document.getCharPropertiesAt(0, 0, 0)).bold, true);
    assert.equal(parsed(document.getCharPropertiesAt(0, 2, 2)).italic, true);
    for (const format of ['hwp', 'hwpx'] as const) {
      const reopened: any = new HwpDocument(bytes(document, format));
      try {
        assert.deepEqual(texts(reopened), ['PFX새1', '', '새3SFX']);
        assert.equal(parsed(reopened.getCharPropertiesAt(0, 0, 0)).bold, true);
        assert.equal(parsed(reopened.getCharPropertiesAt(0, 2, 2)).italic, true);
      } finally { reopened.free(); }
    }
    assert.equal(receipt.undo(), true);
    assert.deepEqual(bytes(document, 'hwp'), original.hwp);
    assert.deepEqual(bytes(document, 'hwpx'), original.hwpx);
    assert.equal(receipt.undo(), false);
  } finally { document.free(); }
});

test('multi-paragraph plain text replacement rejects stale revision and rolls back a partial engine failure', async () => {
  await wasm(); const stale = fixture();
  try {
    const plan = readMultiParagraphPlainTextPlan(stale, range, 'A\nB', 'revision-1'), before = bytes(stale, 'hwp');
    assert.throws(() => replaceMultiParagraphPlainText(stale, plan, () => 'revision-2', () => range), /revision/);
    const moved = { start: { ...range.start, charOffset: 2 }, end: range.end };
    assert.throws(() => replaceMultiParagraphPlainText(stale, plan, () => 'revision-1', () => moved), /선택/);
    assert.deepEqual(bytes(stale, 'hwp'), before);
  } finally { stale.free(); }
  const document = fixture();
  try {
    const before = { hwp: bytes(document, 'hwp'), hwpx: bytes(document, 'hwpx') }, target = document;
    const failing = new Proxy(document, { get(_object, key) {
      if (key === 'splitParagraph') return () => ({ ok: false });
      const value = target[key as keyof typeof target]; return typeof value === 'function' ? value.bind(target) : value;
    } });
    const plan = readMultiParagraphPlainTextPlan(failing, range, 'A\nB', 'revision-1');
    assert.throws(() => replaceMultiParagraphPlainText(failing, plan, () => 'revision-1', () => range), /거절/);
    assert.deepEqual(bytes(document, 'hwp'), before.hwp);
    assert.deepEqual(bytes(document, 'hwpx'), before.hwpx);
  } finally { document.free(); }
});

test('multi-paragraph plain text replacement revalidates source and mixed formatting before snapshot', async () => {
  await wasm();
  for (const mutate of [
    (document: any) => document.replaceText(0, 1, 0, 1, 'X'),
    (document: any) => document.applyCharFormat(0, 1, 0, 2, JSON.stringify({ underline: true })),
  ]) {
    const document = fixture();
    try {
      const plan = readMultiParagraphPlainTextPlan(document, range, 'A\nB', 'revision-1');
      mutate(document); const changed = bytes(document, 'hwp');
      assert.throws(() => replaceMultiParagraphPlainText(document, plan, () => 'revision-1', () => range), /바뀌었습니다/);
      assert.deepEqual(bytes(document, 'hwp'), changed);
    } finally { document.free(); }
  }
});

test('multi-paragraph plain text replacement fails closed for single paragraph and structured documents', async () => {
  await wasm(); const document = fixture();
  try {
    const one = { start: { sectionIndex: 0, paragraphIndex: 0, charOffset: 0 }, end: { sectionIndex: 0, paragraphIndex: 0, charOffset: 1 } };
    assert.throws(() => readMultiParagraphPlainTextPlan(document, one, 'x', 'r'), /둘 이상의 문단/);
    document.createTable(0, 0, 0, 1, 1);
    assert.throws(() => readMultiParagraphPlainTextPlan(document, range, 'x', 'r'), /표·필드·개체/);
  } finally { document.free(); }
});
