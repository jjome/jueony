import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import test from 'node:test';
import type {HwpDocument as HwpDocumentType} from '@rhwp/core';
import {
  captureRootTextBoxSelectionN014,
  restoreRootTextBoxSelectionN014,
  type TextBoxRootPositionN014,
  type TextBoxRootSelectionCursorPortN014,
  type TextBoxRootSelectionDocumentPortN014,
} from '../src/adapters/rhwp/textbox-selection-restore-n014-root-story.ts';

const enginePackage = process.env.JUEONY_ENGINE_PACKAGE
  ? resolve(process.env.JUEONY_ENGINE_PACKAGE)
  : fileURLToPath(new URL('../node_modules/@rhwp/core/', import.meta.url));
const engine = await import(pathToFileURL(resolve(enginePackage, 'rhwp.js')).href);
const {HwpDocument} = engine as typeof import('@rhwp/core');
await engine.default({module_or_path: await readFile(resolve(enginePackage, 'rhwp_bg.wasm'))});

const digest = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const path = (controlIndex: number, paragraph: number) => [{controlIndex, cellIndex: 0, cellParaIndex: paragraph}];

function point(paragraph: number, offset: number, controlIndex = 0): TextBoxRootPositionN014 {
  return {
    sectionIndex: 0,
    paragraphIndex: paragraph,
    charOffset: offset,
    parentParaIndex: 1,
    controlIndex,
    cellIndex: 0,
    cellParaIndex: paragraph,
    cellPath: path(controlIndex, paragraph),
    isTextBox: true,
  };
}

function cursor(initial: TextBoxRootPositionN014, initialAnchor?: TextBoxRootPositionN014) {
  let position = structuredClone(initial);
  let anchor = initialAnchor ? structuredClone(initialAnchor) : undefined;
  let moves = 0;
  const value: TextBoxRootSelectionCursorPortN014 = {
    getPosition: () => structuredClone(position),
    getSelection: () => anchor ? {anchor: structuredClone(anchor), focus: structuredClone(position)} : null,
    hasSelection: () => anchor !== undefined,
    moveTo: next => { position = structuredClone(next); moves += 1; },
    setAnchor: () => { anchor ??= structuredClone(position); },
    clearSelection: () => { anchor = undefined; },
    resetPreferredX: () => {},
    exitHeaderFooterMode: () => {},
    exitFootnoteMode: () => {},
    exitCellSelectionMode: () => {},
    exitBlockSelectionMode: () => {},
    exitTableObjectSelection: () => {},
    exitPictureObjectSelection: () => {},
  };
  return {value, moves: () => moves};
}

function createThreeParagraphTextBox(): HwpDocumentType {
  const document = HwpDocument.createEmpty();
  document.createBlankDocument();
  document.splitParagraph(0, 0, 0);
  const made = JSON.parse(document.createShapeControl(JSON.stringify({
    sectionIdx: 0,
    paraIdx: 1,
    charOffset: 0,
    width: 9_000,
    height: 4_000,
    treatAsChar: true,
    shapeType: 'textbox',
  })));
  assert.equal(made.ok, true);
  assert.equal(made.controlIdx, 0);
  document.insertTextInCell(0, 1, 0, 0, 0, 0, '첫😀둘째');
  assert.equal(JSON.parse(document.splitParagraphInCell(0, 1, 0, 0, 0, 2)).ok, true);
  assert.equal(JSON.parse(document.splitParagraphInCell(0, 1, 0, 0, 1, 2)).ok, true);
  assert.equal(document.getCellParagraphCount(0, 1, 0, 0), 3);
  return document;
}

function port(document: HwpDocumentType, format: 'hwp' | 'hwpx', revisionOverride?: () => string): TextBoxRootSelectionDocumentPortN014 {
  const exportBytes = (): Uint8Array => format === 'hwp' ? document.exportHwp() : document.exportHwpx();
  return {
    identity: () => `n014-${format}-document`,
    revision: () => revisionOverride?.() ?? digest(exportBytes()),
    getSectionCount: () => document.getSectionCount(),
    getParagraphCount: section => document.getParagraphCount(section),
    getControls: () => document.getControls(),
    getCursorModel: () => document.getCursorModel(),
    getShapeProperties: (section, parent, control) => document.getShapeProperties(section, parent, control),
    getCursorRectByPath: (section, parent, pathJson, offset) =>
      document.getCursorRectByPath(section, parent, pathJson, offset),
    getCellParagraphCount: (section, parent, control, cell) =>
      document.getCellParagraphCount(section, parent, control, cell),
    getCellParagraphLengthByPath: (section, parent, pathJson) =>
      document.getCellParagraphLengthByPath(section, parent, pathJson),
    getTextInCellByPath: (section, parent, pathJson, start, count) =>
      document.getTextInCellByPath(section, parent, pathJson, start, count),
  };
}

function bytes(document: HwpDocumentType, format: 'hwp' | 'hwpx'): Uint8Array {
  return format === 'hwp' ? document.exportHwp() : document.exportHwpx();
}

test('N014 restores multi-paragraph forward and reverse root textbox ranges after actual HWP/HWPX reopen', () => {
  const source = createThreeParagraphTextBox();
  try {
    for (const format of ['hwp', 'hwpx'] as const) {
      const reopened = new HwpDocument(bytes(source, format));
      try {
        const before = bytes(reopened, format);
        const snapshot = reopened.saveSnapshot();
        const anchor = format === 'hwp' ? point(0, 1) : point(1, 2);
        const focus = format === 'hwp' ? point(1, 2) : point(0, 1);
        const capturedCursor = cursor(focus, anchor);
        const saved = captureRootTextBoxSelectionN014(port(reopened, format), capturedCursor.value);
        assert.ok(saved, format);
        assert.equal(saved?.anchor?.paragraphIndex, anchor.paragraphIndex, format);
        const live = cursor(point(2, 0));
        assert.equal(restoreRootTextBoxSelectionN014(port(reopened, format), live.value, saved), true, format);
        assert.deepEqual(live.value.getPosition(), focus, format);
        assert.deepEqual(live.value.getSelection(), {anchor, focus}, format);
        assert.deepEqual(bytes(reopened, format), before, `${format} selection restore must not change document bytes`);
        assert.notEqual(JSON.parse(reopened.restoreSnapshot(snapshot)).ok, false, `${format} undo snapshot remains valid`);
        reopened.discardSnapshot(snapshot);
        assert.deepEqual(bytes(reopened, format), before, `${format} snapshot validation remains byte-neutral`);
        const secondReopen = new HwpDocument(bytes(reopened, format));
        try {
          assert.equal(secondReopen.getCellParagraphCount(0, 1, 0, 0), 3, format);
        } finally {
          secondReopen.free();
        }
      } finally {
        reopened.free();
      }
    }
  } finally {
    source.free();
  }
});

test('N014 restores an actual empty root textbox paragraph caret without inventing a range', () => {
  const source = createThreeParagraphTextBox();
  try {
    const reopened = new HwpDocument(source.exportHwpx());
    try {
      const before = reopened.exportHwpx();
      const capturedCursor = cursor(point(2, 0));
      const saved = captureRootTextBoxSelectionN014(port(reopened, 'hwpx'), capturedCursor.value);
      assert.ok(saved);
      assert.equal(saved?.anchor, undefined);
      const live = cursor(point(0, 0));
      assert.equal(restoreRootTextBoxSelectionN014(port(reopened, 'hwpx'), live.value, saved), true);
      assert.deepEqual(live.value.getPosition(), point(2, 0));
      assert.equal(live.value.getSelection(), null);
      assert.deepEqual(reopened.exportHwpx(), before);
    } finally {
      reopened.free();
    }
  } finally {
    source.free();
  }
});

test('N014 caption, nested owner paths, stale revisions and forged seals fail before cursor mutation', () => {
  const source = createThreeParagraphTextBox();
  try {
    const clean = new HwpDocument(source.exportHwp());
    try {
      const cleanCursor = cursor(point(1, 1), point(0, 0));
      const saved = captureRootTextBoxSelectionN014(port(clean, 'hwp'), cleanCursor.value);
      assert.ok(saved);

      const nested = cursor({
        ...point(0, 0),
        paragraphIndex: 0,
        cellParaIndex: 0,
        cellPath: [path(0, 0)[0], {controlIndex: 1, cellIndex: 0, cellParaIndex: 0}],
      } as TextBoxRootPositionN014);
      assert.equal(captureRootTextBoxSelectionN014(port(clean, 'hwp'), nested.value), undefined);

      let staleRevision = 'stale-revision-1';
      const stalePort = port(clean, 'hwp', () => staleRevision);
      const staleSaved = captureRootTextBoxSelectionN014(stalePort, cleanCursor.value);
      assert.ok(staleSaved);
      staleRevision = 'stale-revision-2';
      const staleLive = cursor(point(2, 0));
      assert.equal(restoreRootTextBoxSelectionN014(stalePort, staleLive.value, staleSaved), false);
      assert.equal(staleLive.moves(), 0);

      const forged = {...saved, storyFingerprint: '0'.repeat(64)};
      const forgedLive = cursor(point(2, 0));
      assert.equal(restoreRootTextBoxSelectionN014(port(clean, 'hwp'), forgedLive.value, forged), false);
      assert.equal(forgedLive.moves(), 0);
    } finally {
      clean.free();
    }

    assert.equal(JSON.parse(source.setShapeProperties(0, 1, 0, JSON.stringify({
      hasCaption: true,
      captionText: '캡션',
    }))).ok, true);
    for (const format of ['hwp', 'hwpx'] as const) {
      const captioned = new HwpDocument(bytes(source, format));
      try {
        const before = bytes(captioned, format);
        const captionCursor = cursor(point(1, 1), point(0, 0));
        assert.equal(captureRootTextBoxSelectionN014(port(captioned, format), captionCursor.value), undefined, format);
        assert.equal(captionCursor.moves(), 0, format);
        assert.deepEqual(bytes(captioned, format), before, `${format} caption rejection is read-only`);
      } finally {
        captioned.free();
      }
    }
  } finally {
    source.free();
  }
});
