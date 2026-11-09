import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import test from 'node:test';
import type {HwpDocument as HwpDocumentType} from '@rhwp/core';
import {
  capturePartialClickHereSelectionN016,
  restorePartialClickHereSelectionN016,
  type PartialClickHereCursorPortN016,
  type PartialClickHereDocumentPortN016,
  type PartialClickHerePositionN016,
} from '../src/adapters/rhwp/special-selection-n016-clickhere-partial.ts';

const enginePackage = process.env.JUEONY_ENGINE_PACKAGE
  ? resolve(process.env.JUEONY_ENGINE_PACKAGE)
  : fileURLToPath(new URL('../node_modules/@rhwp/core/', import.meta.url));
const engine = await import(pathToFileURL(resolve(enginePackage, 'rhwp.js')).href);
const {HwpDocument} = engine as typeof import('@rhwp/core');
await engine.default({module_or_path: await readFile(resolve(enginePackage, 'rhwp_bg.wasm'))});

const digest = (value: Uint8Array): string => createHash('sha256').update(value).digest('hex');
const at = (offset: number): PartialClickHerePositionN016 => ({sectionIndex: 0, paragraphIndex: 0, charOffset: offset});

function createDocument(): HwpDocumentType {
  const document = HwpDocument.createEmpty();
  document.createBlankDocument();
  document.insertText(0, 0, 0, '앞뒤');
  document.insertClickHereField(0, 0, 1, '입력 안내', '설명', '성명', true);
  document.setFieldValueByName('성명', '김민수');
  return document;
}

function bytes(document: HwpDocumentType, format: 'hwp' | 'hwpx'): Uint8Array {
  return format === 'hwp' ? document.exportHwp() : document.exportHwpx();
}

function documentPort(document: HwpDocumentType, format: 'hwp' | 'hwpx'): PartialClickHereDocumentPortN016 {
  return {
    identity: () => `n016-partial-${format}`,
    revision: () => digest(bytes(document, format)),
    getSectionCount: () => document.getSectionCount(),
    getParagraphCount: section => document.getParagraphCount(section),
    getParagraphLength: (section, paragraph) => document.getParagraphLength(section, paragraph),
    getTextRange: (section, paragraph, offset, count) => document.getTextRange(section, paragraph, offset, count),
    getFieldList: () => document.getFieldList(),
    getFieldInfoAt: (section, paragraph, offset) => document.getFieldInfoAt(section, paragraph, offset),
    getFieldValue: fieldId => document.getFieldValue(fieldId),
    getCursorRect: (section, paragraph, offset) => document.getCursorRect(section, paragraph, offset),
  };
}

function cursor(initial: PartialClickHerePositionN016, initialAnchor?: PartialClickHerePositionN016) {
  let focus = structuredClone(initial);
  let anchor = initialAnchor ? structuredClone(initialAnchor) : undefined;
  let moves = 0;
  const value: PartialClickHereCursorPortN016 = {
    getPosition: () => structuredClone(focus),
    getSelection: () => anchor ? {anchor: structuredClone(anchor), focus: structuredClone(focus)} : null,
    hasSelection: () => anchor !== undefined,
    isInHeaderFooter: () => false,
    isInFootnote: () => false,
    isInEndnote: () => false,
    isInTextBox: () => false,
    isInTableObjectSelection: () => false,
    isInPictureObjectSelection: () => false,
    moveTo: next => { focus = structuredClone(next); moves += 1; },
    setAnchor: () => { anchor ??= structuredClone(focus); },
    clearSelection: () => { anchor = undefined; },
    resetPreferredX: () => {},
  };
  return {value, moves: () => moves};
}

function fieldRange(document: HwpDocumentType): {start: number; end: number; id: number} {
  const item = JSON.parse(document.getFieldList())[0];
  return {start: item.startCharIdx, end: item.endCharIdx, id: item.fieldId};
}

test('N016 restores strict partial ClickHere selections in both directions after actual HWP/HWPX reopen', () => {
  const source = createDocument();
  try {
    for (const format of ['hwp', 'hwpx'] as const) {
      const reopened = new HwpDocument(bytes(source, format));
      try {
        const before = bytes(reopened, format);
        const snapshot = reopened.saveSnapshot();
        const range = fieldRange(reopened);
        const start = range.start + 1;
        const end = range.end;
        const anchor = format === 'hwp' ? at(start) : at(end);
        const focus = format === 'hwp' ? at(end) : at(start);
        const captured = cursor(focus, anchor);
        const saved = capturePartialClickHereSelectionN016(documentPort(reopened, format), captured.value);
        assert.ok(saved, format);
        assert.equal(saved?.direction, format === 'hwp' ? 'forward' : 'backward', format);
        assert.equal(saved?.selectionStart, start, format);
        assert.equal(saved?.selectionEnd, end, format);
        assert.doesNotMatch(JSON.stringify(saved), /김민수|민수|성명|입력 안내|설명/u);

        const live = cursor(at(0));
        assert.equal(restorePartialClickHereSelectionN016(documentPort(reopened, format), live.value, saved), true, format);
        assert.deepEqual(live.value.getPosition(), focus, format);
        assert.deepEqual(live.value.getSelection(), {anchor, focus}, format);
        assert.deepEqual(bytes(reopened, format), before, `${format} partial selection restore is byte-read-only`);
        assert.notEqual(JSON.parse(reopened.restoreSnapshot(snapshot)).ok, false, `${format} undo snapshot stays valid`);
        reopened.discardSnapshot(snapshot);
        assert.deepEqual(bytes(reopened, format), before, `${format} snapshot check stays byte-neutral`);
        const second = new HwpDocument(before);
        try {
          assert.deepEqual(fieldRange(second), range, `${format} field range survives a second reopen`);
        } finally {
          second.free();
        }
      } finally {
        reopened.free();
      }
    }
  } finally {
    source.free();
  }
});

test('N016 stale and tampered partial selections fail before cursor mutation', () => {
  const document = createDocument();
  try {
    const range = fieldRange(document);
    const captured = cursor(at(range.end), at(range.start + 1));
    const port = documentPort(document, 'hwp');
    const saved = capturePartialClickHereSelectionN016(port, captured.value);
    assert.ok(saved);

    const forged = {...saved, selectionStart: (saved?.selectionStart ?? 0) + 1};
    const forgedLive = cursor(at(0));
    assert.equal(restorePartialClickHereSelectionN016(port, forgedLive.value, forged), false);
    assert.equal(forgedLive.moves(), 0);

    document.setFieldValueByName('성명', '이순신');
    const staleLive = cursor(at(0));
    assert.equal(restorePartialClickHereSelectionN016(port, staleLive.value, saved), false);
    assert.equal(staleLive.moves(), 0);
  } finally {
    document.free();
  }
});

test('N016 full, empty, caption-like, overlapping and ambiguous cases fail closed', () => {
  const document = createDocument();
  try {
    const range = fieldRange(document);
    const port = documentPort(document, 'hwpx');
    const before = document.exportHwpx();
    assert.equal(capturePartialClickHereSelectionN016(port, cursor(at(range.end), at(range.start)).value), undefined);
    assert.equal(capturePartialClickHereSelectionN016(port, cursor(at(range.start + 1), at(range.start + 1)).value), undefined);

    const captionLike = cursor(at(range.end), at(range.start + 1));
    const captionLikeValue: PartialClickHereCursorPortN016 = {
      ...captionLike.value,
      getPosition: () => ({...at(range.end), parentParaIndex: 0}),
      getSelection: () => ({
        anchor: {...at(range.start + 1), parentParaIndex: 0},
        focus: {...at(range.end), parentParaIndex: 0},
      }),
    };
    assert.equal(capturePartialClickHereSelectionN016(port, captionLikeValue), undefined);
    assert.equal(captionLike.moves(), 0);

    const originalList = document.getFieldList.bind(document);
    const actual = JSON.parse(originalList());
    const partial = cursor(at(range.end), at(range.start + 1));
    const ambiguousPort = {...port, getFieldList: () => JSON.stringify([...actual, {...actual[0]}])};
    assert.equal(capturePartialClickHereSelectionN016(ambiguousPort, partial.value), undefined);
    const overlappingPort = {...port, getFieldList: () => JSON.stringify([
      ...actual,
      {...actual[0], fieldId: actual[0].fieldId + 1, startCharIdx: range.start + 1},
    ])};
    assert.equal(capturePartialClickHereSelectionN016(overlappingPort, partial.value), undefined);
    assert.deepEqual(document.exportHwpx(), before, 'all rejection paths are document-read-only');
  } finally {
    document.free();
  }
});
