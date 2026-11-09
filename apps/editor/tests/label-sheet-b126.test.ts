import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import type {HwpDocument as HwpDocumentType} from '@rhwp/core';
import {applyLabelSheetB126, manuscriptPaperCapabilityB126, prepareLabelSheetB126, type LabelSheetDocumentB126} from '../src/adapters/rhwp/label-sheet-b126.ts';

const enginePackage = process.env.JUEONY_ENGINE_PACKAGE
  ? resolve(process.env.JUEONY_ENGINE_PACKAGE)
  : fileURLToPath(new URL('../node_modules/@rhwp/core/', import.meta.url));
const engine = await import(pathToFileURL(resolve(enginePackage, 'rhwp.js')).href);
const {HwpDocument} = engine as typeof import('@rhwp/core');
await engine.default({module_or_path: await readFile(resolve(enginePackage, 'rhwp_bg.wasm'))});

const request = {layout: {rows: 2, columns: 3, labelWidthMm: 30, labelHeightMm: 20}, labels: ['가😀나', '둘', '셋', '넷']};
const save = (document: HwpDocumentType, format: 'hwp' | 'hwpx') => format === 'hwp' ? document.exportHwp() : document.exportHwpx();

function table(document: HwpDocumentType) {
  const control = JSON.parse(document.getControls()).find((value: {ctrlId: string}) => value.ctrlId === 'tbl');
  assert.ok(control);
  return {paragraph: control.para as number, control: control.controlIndex as number};
}

function texts(document: HwpDocumentType): string[] {
  const at = table(document);
  return Array.from({length: 6}, (_, cell) => {
    const length = document.getCellParagraphLength(0, at.paragraph, at.control, cell, 0);
    return document.getTextInCell(0, at.paragraph, at.control, cell, 0, 0, length);
  });
}

test('B126 validates bounded label layouts and exposes manuscript paper as an explicit capability gap', () => {
  const document = HwpDocument.createEmpty(); document.createBlankDocument();
  try {
    assert.equal(manuscriptPaperCapabilityB126(document).supported, false);
    assert.throws(() => prepareLabelSheetB126(document, 'doc', 'r1', {...request, layout: {...request.layout, rows: 21}}));
    assert.throws(() => prepareLabelSheetB126(document, 'doc', 'r1', {...request, labels: Array(7).fill('초과')}));
    assert.throws(() => prepareLabelSheetB126(document, 'doc', 'r1', {...request, labels: ['제어\u0000문자']}));
  } finally { document.free(); }
});

test('B126 creates a bounded label grid and preserves cell text and dimensions through HWP/HWPX reopen plus exact undo/redo', () => {
  const fresh = HwpDocument.createEmpty(); fresh.createBlankDocument();
  const fixtures = [fresh.exportHwp(), fresh.exportHwpx()]; fresh.free();
  for (const fixture of fixtures) {
    const document = new HwpDocument(fixture);
    try {
      const beforeHwp = document.exportHwp(), beforeHwpx = document.exportHwpx();
      const plan = prepareLabelSheetB126(document, 'doc-label', 'revision-1', request);
      const history = applyLabelSheetB126(document, plan, 'doc-label', 'revision-1');
      assert.deepEqual(texts(document), ['가😀나', '둘', '셋', '넷', '', '']);
      const at = table(document), expectedWidth = Math.round(30 * 283.465), expectedHeight = Math.round(20 * 283.465);
      for (let cell = 0; cell < 6; cell += 1) {
        const properties = JSON.parse(document.getCellProperties(0, at.paragraph, at.control, cell));
        assert.equal(properties.width, expectedWidth); assert.equal(properties.height, expectedHeight);
      }
      const afterHwp = document.exportHwp(), afterHwpx = document.exportHwpx();
      for (const [format, bytes] of [['hwp', afterHwp], ['hwpx', afterHwpx]] as const) {
        const reopened = new HwpDocument(bytes);
        try {
          assert.deepEqual(texts(reopened), ['가😀나', '둘', '셋', '넷', '', ''], format);
          const location = table(reopened);
          const properties = JSON.parse(reopened.getCellProperties(0, location.paragraph, location.control, 0));
          assert.equal(properties.width, expectedWidth); assert.equal(properties.height, expectedHeight);
          const second = new HwpDocument(save(reopened, format));
          try { assert.deepEqual(texts(second), ['가😀나', '둘', '셋', '넷', '', '']); }
          finally { second.free(); }
        } finally { reopened.free(); }
      }
      assert.equal(history.undo(), true); assert.deepEqual(document.exportHwp(), beforeHwp); assert.deepEqual(document.exportHwpx(), beforeHwpx);
      assert.equal(history.undo(), false); assert.equal(history.redo(), true); assert.deepEqual(document.exportHwp(), afterHwp); assert.deepEqual(document.exportHwpx(), afterHwpx);
      assert.equal(history.redo(), false); history.dispose();
    } finally { document.free(); }
  }
});

test('B126 refuses stale, nonblank, replaced-owner and tampered plans without changing bytes', () => {
  const document = HwpDocument.createEmpty(); document.createBlankDocument();
  const other = HwpDocument.createEmpty(); other.createBlankDocument();
  try {
    const plan = prepareLabelSheetB126(document, 'doc', 'r1', request), before = document.exportHwpx();
    assert.throws(() => applyLabelSheetB126(document, plan, 'doc', 'r2'), /버전/); assert.deepEqual(document.exportHwpx(), before);
    assert.throws(() => applyLabelSheetB126(other, plan, 'doc', 'r1'), /다릅니다/); assert.deepEqual(JSON.parse(other.getControls()).map((item: {ctrlId: string}) => item.ctrlId), ['secd', 'cold']);
    assert.throws(() => applyLabelSheetB126(document, {...plan, fingerprint: '0'.repeat(64)}, 'doc', 'r1'), /계획/); assert.deepEqual(document.exportHwpx(), before);
    document.insertText(0, 0, 0, '본문');
    assert.throws(() => applyLabelSheetB126(document, plan, 'doc', 'r1'), /새 문서|바뀌었습니다/);
  } finally { document.free(); other.free(); }
});

test('B126 restores both formats exactly when a label write fails after table creation', () => {
  const document = HwpDocument.createEmpty(); document.createBlankDocument();
  try {
    const forward = <K extends keyof LabelSheetDocumentB126>(name: K) => (document[name] as Function).bind(document);
    let insertions = 0;
    const faulty: LabelSheetDocumentB126 = {
      getSectionCount: forward('getSectionCount'), getParagraphCount: forward('getParagraphCount'), getParagraphLength: forward('getParagraphLength'),
      getControls: forward('getControls'), createTable: forward('createTable'), setCellProperties: forward('setCellProperties'),
      getCellParagraphLength: forward('getCellParagraphLength'), getTextInCell: forward('getTextInCell'), getCellProperties: forward('getCellProperties'),
      saveSnapshot: forward('saveSnapshot'), restoreSnapshot: forward('restoreSnapshot'), discardSnapshot: forward('discardSnapshot'),
      exportHwp: forward('exportHwp'), exportHwpx: forward('exportHwpx'),
      insertTextInCell: (...args) => { if (++insertions === 2) throw new Error('fault'); return document.insertTextInCell(...args); },
    };
    const beforeHwp = document.exportHwp(), beforeHwpx = document.exportHwpx();
    const plan = prepareLabelSheetB126(faulty, 'doc', 'r1', request);
    assert.throws(() => applyLabelSheetB126(faulty, plan, 'doc', 'r1'), /fault/);
    assert.deepEqual(document.exportHwp(), beforeHwp); assert.deepEqual(document.exportHwpx(), beforeHwpx);
    assert.deepEqual(JSON.parse(document.getControls()).map((item: {ctrlId: string}) => item.ctrlId), ['secd', 'cold']);
  } finally { document.free(); }
});
