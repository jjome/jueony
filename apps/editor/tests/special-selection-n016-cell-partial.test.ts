import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import test from 'node:test';
import type {HwpDocument as HwpDocumentType} from '@rhwp/core';
import {
  captureCellPartialClickHereSelectionN016,
  restoreCellPartialClickHereSelectionN016,
  type CellPartialCursorPortN016,
  type CellPartialDocumentPortN016,
  type CellPartialPositionN016,
} from '../src/adapters/rhwp/special-selection-n016-cell-partial.ts';

const enginePackage = process.env.JUEONY_ENGINE_PACKAGE
  ? resolve(process.env.JUEONY_ENGINE_PACKAGE)
  : fileURLToPath(new URL('../node_modules/@rhwp/core/', import.meta.url));
const engine = await import(pathToFileURL(resolve(enginePackage, 'rhwp.js')).href);
const {HwpDocument} = engine as typeof import('@rhwp/core');
await engine.default({module_or_path: await readFile(resolve(enginePackage, 'rhwp_bg.wasm'))});

const digest = (value: Uint8Array): string => createHash('sha256').update(value).digest('hex');

function createDocument(): HwpDocumentType {
  const document = HwpDocument.createEmpty();
  document.createBlankDocument();
  document.insertText(0, 0, 0, '본문');
  document.splitParagraph(0, 0, 2);
  document.createTable(0, 1, 0, 1, 1);
  document.insertTextInCell(0, 1, 0, 0, 0, 0, '앞뒤');
  document.insertClickHereFieldInCell(0, 1, 0, 0, 0, 1, false, '입력 안내', '설명', '셀 성명', true);
  document.setFieldValueByName('셀 성명', '김민수');
  return document;
}

function bytes(document: HwpDocumentType, format: 'hwp' | 'hwpx'): Uint8Array {
  return format === 'hwp' ? document.exportHwp() : document.exportHwpx();
}

function port(document: HwpDocumentType, format: 'hwp' | 'hwpx'): CellPartialDocumentPortN016 {
  return {
    identity: () => `n016-cell-partial-${format}`,
    revision: () => digest(bytes(document, format)),
    getSectionCount: () => document.getSectionCount(),
    getParagraphCount: section => document.getParagraphCount(section),
    getControls: () => document.getControls(),
    getCursorModel: () => document.getCursorModel(),
    getFieldList: () => document.getFieldList(),
    getCellParagraphLengthByPath: (section, parent, path) =>
      document.getCellParagraphLengthByPath(section, parent, path),
    getTextInCellByPath: (section, parent, path, start, count) =>
      document.getTextInCellByPath(section, parent, path, start, count),
    getFieldInfoAtByPath: (section, parent, path, offset) =>
      document.getFieldInfoAtByPath(section, parent, path, offset),
    getFieldValue: fieldId => document.getFieldValue(fieldId),
    getCursorRectByPath: (section, parent, path, offset) =>
      document.getCursorRectByPath(section, parent, path, offset),
  };
}

function fieldState(document: HwpDocumentType) {
  const item = JSON.parse(document.getFieldList()).find((entry: any) => entry.location?.path?.length === 1);
  const step = item.location.path[0];
  const path = [{controlIndex: step.controlIndex, cellIndex: step.cellIndex, cellParaIndex: step.paraIndex}];
  return {item, path};
}

function at(state: ReturnType<typeof fieldState>, offset: number): CellPartialPositionN016 {
  const step = state.path[0];
  return {
    sectionIndex: state.item.location.sectionIndex,
    parentParaIndex: state.item.location.paraIndex,
    paragraphIndex: step.cellParaIndex,
    charOffset: offset,
    controlIndex: step.controlIndex,
    cellIndex: step.cellIndex,
    cellParaIndex: step.cellParaIndex,
    cellPath: state.path as [typeof step],
    isTextBox: false,
  };
}

function cursor(initial: CellPartialPositionN016, initialAnchor?: CellPartialPositionN016) {
  let focus = structuredClone(initial);
  let anchor = initialAnchor ? structuredClone(initialAnchor) : undefined;
  let moves = 0;
  const value: CellPartialCursorPortN016 = {
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

test('N016 restores a strict partial top-level cell ClickHere selection in both directions after HWP/HWPX reopen', () => {
  const source = createDocument();
  try {
    for (const format of ['hwp', 'hwpx'] as const) {
      const reopened = new HwpDocument(bytes(source, format));
      try {
        const before = bytes(reopened, format);
        const snapshot = reopened.saveSnapshot();
        const state = fieldState(reopened);
        const start = state.item.startCharIdx + 1;
        const end = state.item.endCharIdx;
        const anchor = format === 'hwp' ? at(state, start) : at(state, end);
        const focus = format === 'hwp' ? at(state, end) : at(state, start);
        const captured = cursor(focus, anchor);
        const saved = captureCellPartialClickHereSelectionN016(port(reopened, format), captured.value);
        assert.ok(saved, format);
        assert.equal(saved?.direction, format === 'hwp' ? 'forward' : 'backward', format);
        assert.equal(saved?.path.length, 1, format);
        assert.doesNotMatch(JSON.stringify(saved), /김민수|민수|셀 성명|입력 안내|설명/u);

        const live = cursor(at(state, 0));
        assert.equal(restoreCellPartialClickHereSelectionN016(port(reopened, format), live.value, saved), true, format);
        assert.deepEqual(live.value.getPosition(), focus, format);
        assert.deepEqual(live.value.getSelection(), {anchor, focus}, format);
        assert.deepEqual(bytes(reopened, format), before, `${format} restore is byte-read-only`);
        assert.notEqual(JSON.parse(reopened.restoreSnapshot(snapshot)).ok, false, `${format} undo snapshot remains valid`);
        reopened.discardSnapshot(snapshot);
        assert.deepEqual(bytes(reopened, format), before, `${format} snapshot check remains byte-neutral`);
        const second = new HwpDocument(before);
        try {
          assert.equal(fieldState(second).item.value, state.item.value, `${format} field survives second reopen`);
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

test('N016 stale and tampered cell partial seals fail before cursor mutation', () => {
  const document = createDocument();
  try {
    const state = fieldState(document);
    const captured = cursor(at(state, state.item.endCharIdx), at(state, state.item.startCharIdx + 1));
    const documentPort = port(document, 'hwp');
    const saved = captureCellPartialClickHereSelectionN016(documentPort, captured.value);
    assert.ok(saved);
    const forged = {...saved, path: [{...saved!.path[0], cellIndex: 1}]};
    const forgedLive = cursor(at(state, 0));
    assert.equal(restoreCellPartialClickHereSelectionN016(documentPort, forgedLive.value, forged), false);
    assert.equal(forgedLive.moves(), 0);

    const rollbackLive = cursor(at(state, 0));
    let positionReads = 0;
    const badReadback: CellPartialCursorPortN016 = {
      ...rollbackLive.value,
      getPosition: () => {
        const current = rollbackLive.value.getPosition() as CellPartialPositionN016;
        positionReads += 1;
        return positionReads === 2 ? {...current, charOffset: current.charOffset + 1} : current;
      },
    };
    assert.equal(restoreCellPartialClickHereSelectionN016(documentPort, badReadback, saved), false);
    assert.deepEqual(rollbackLive.value.getPosition(), at(state, 0), 'failed readback rolls the live caret back');
    assert.equal(rollbackLive.value.getSelection(), null, 'failed readback removes the tentative range');

    document.setFieldValueByName('셀 성명', '이순신');
    const staleLive = cursor(at(state, 0));
    assert.equal(restoreCellPartialClickHereSelectionN016(documentPort, staleLive.value, saved), false);
    assert.equal(staleLive.moves(), 0);
  } finally {
    document.free();
  }
});

test('N016 nested, empty, full, caption-like, overlapping, ambiguous and other field cases fail closed', () => {
  const document = createDocument();
  try {
    const state = fieldState(document);
    const documentPort = port(document, 'hwpx');
    const before = document.exportHwpx();
    assert.equal(captureCellPartialClickHereSelectionN016(
      documentPort, cursor(at(state, state.item.endCharIdx), at(state, state.item.startCharIdx)).value), undefined);
    assert.equal(captureCellPartialClickHereSelectionN016(
      documentPort, cursor(at(state, state.item.startCharIdx + 1), at(state, state.item.startCharIdx + 1)).value), undefined);

    const nestedFocus = {...at(state, state.item.endCharIdx), cellPath: [
      state.path[0],
      {controlIndex: 1, cellIndex: 0, cellParaIndex: 0},
    ]};
    const nestedAnchor = {...nestedFocus, charOffset: state.item.startCharIdx + 1};
    assert.equal(captureCellPartialClickHereSelectionN016(
      documentPort,
      cursor(nestedFocus as unknown as CellPartialPositionN016, nestedAnchor as unknown as CellPartialPositionN016).value,
    ), undefined);

    const captionBase = cursor(at(state, state.item.endCharIdx), at(state, state.item.startCharIdx + 1));
    const captionLike: CellPartialCursorPortN016 = {...captionBase.value, isInTextBox: () => true};
    assert.equal(captureCellPartialClickHereSelectionN016(documentPort, captionLike), undefined);
    assert.equal(captionBase.moves(), 0);

    const actual = JSON.parse(document.getFieldList());
    const partial = cursor(at(state, state.item.endCharIdx), at(state, state.item.startCharIdx + 1));
    const ambiguous = {...documentPort, getFieldList: () => JSON.stringify([...actual, {...actual[0]}])};
    assert.equal(captureCellPartialClickHereSelectionN016(ambiguous, partial.value), undefined);
    const overlap = {...documentPort, getFieldList: () => JSON.stringify([
      ...actual,
      {...actual[0], fieldId: actual[0].fieldId + 1, startCharIdx: actual[0].startCharIdx + 1},
    ])};
    assert.equal(captureCellPartialClickHereSelectionN016(overlap, partial.value), undefined);
    const otherField = {...documentPort, getFieldList: () => JSON.stringify([
      ...actual,
      {...actual[0], fieldId: actual[0].fieldId + 1, fieldType: 'hyperlink'},
    ])};
    assert.equal(captureCellPartialClickHereSelectionN016(otherField, partial.value), undefined);
    assert.deepEqual(document.exportHwpx(), before, 'all rejection paths remain document-read-only');
  } finally {
    document.free();
  }
});
