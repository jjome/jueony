import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import test from 'node:test';
import type {HwpDocument as HwpDocumentType} from '@rhwp/core';
import {
  compareOpenDocumentsB135,
  type DocumentComparePortB135,
} from '../src/adapters/rhwp/document-compare-b135.ts';
import {
  createTrackedChangeViewB133,
  verifyTrackedChangeViewB133,
} from '../src/adapters/rhwp/tracked-changes-b133.ts';

const enginePackage = process.env.JUEONY_ENGINE_PACKAGE
  ? resolve(process.env.JUEONY_ENGINE_PACKAGE)
  : fileURLToPath(new URL('../node_modules/@rhwp/core/', import.meta.url));
const engine = await import(pathToFileURL(resolve(enginePackage, 'rhwp.js')).href);
const {HwpDocument} = engine as typeof import('@rhwp/core');
await engine.default({module_or_path: await readFile(resolve(enginePackage, 'rhwp_bg.wasm'))});

const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

function fake(texts: string[][], identity: string, revision = 'revision-1'): DocumentComparePortB135 {
  return {
    identity: () => identity,
    revision: () => revision,
    getSectionCount: () => texts.length,
    getParagraphCount: section => texts[section]?.length ?? 0,
    getParagraphLength: (section, paragraph) => Array.from(texts[section]?.[paragraph] ?? '').length,
    getTextRange: (section, paragraph, start, count) => Array.from(texts[section]?.[paragraph] ?? '')
      .slice(start, start + count).join(''),
  };
}

test('B133 projects deterministic insert, delete and replace marks without equal paragraphs', () => {
  const before = fake([['같음', '가😀나다', '삭제']], 'before');
  const after = fake([['같음', '가😀라마', '추가']], 'after');
  const comparison = compareOpenDocumentsB135(before, after);
  const view = createTrackedChangeViewB133(comparison, before, after);
  assert.equal(view.mode, 'comparison-snapshot');
  assert.deepEqual(view.changes.map(value => value.kind), ['replace']);
  assert.deepEqual(view.changes[0].beforeText, ['가😀나다', '삭제']);
  assert.deepEqual(view.changes[0].afterText, ['가😀라마', '추가']);
  assert.match(view.changes[0].id, /^[0-9a-f]{64}$/u);
  assert.equal(verifyTrackedChangeViewB133(view, comparison, before, after).fingerprint, view.fingerprint);

  const insertedBefore = fake([['앞', '뒤']], 'insert-before');
  const insertedAfter = fake([['앞', '새 문단', '뒤']], 'insert-after');
  const insertedComparison = compareOpenDocumentsB135(insertedBefore, insertedAfter);
  assert.deepEqual(createTrackedChangeViewB133(insertedComparison, insertedBefore, insertedAfter)
    .changes.map(value => value.kind), ['insert']);

  const deletedBefore = fake([['앞', '삭제', '뒤']], 'delete-before');
  const deletedAfter = fake([['앞', '뒤']], 'delete-after');
  const deletedComparison = compareOpenDocumentsB135(deletedBefore, deletedAfter);
  assert.deepEqual(createTrackedChangeViewB133(deletedComparison, deletedBefore, deletedAfter)
    .changes.map(value => value.kind), ['delete']);
});

test('B133 rejects stale documents and tampered display evidence', () => {
  const before = fake([['원문']], 'before');
  const after = fake([['변경']], 'after');
  const comparison = compareOpenDocumentsB135(before, after);
  const view = createTrackedChangeViewB133(comparison, before, after);
  assert.throws(() => verifyTrackedChangeViewB133(
    {...view, fingerprint: '0'.repeat(64)}, comparison, before, after,
  ), /바뀌었습니다/);
  assert.throws(() => createTrackedChangeViewB133(
    comparison, fake([['원문']], 'before', 'revision-2'), after,
  ), /바뀌었습니다/);
  assert.throws(() => verifyTrackedChangeViewB133(
    {...view, mode: 'live-editing'} as never, comparison, before, after,
  ), /올바르지 않습니다/);
});

function authored(lines: string[]): HwpDocumentType {
  const document = HwpDocument.createEmpty();
  document.createBlankDocument();
  document.insertText(0, 0, 0, lines[0]);
  for (let index = 1; index < lines.length; index += 1) {
    document.insertParagraph(0, index - 1);
    document.insertText(0, index, 0, lines[index]);
  }
  return document;
}

function nativePort(document: HwpDocumentType, identity: string): DocumentComparePortB135 {
  return {
    identity: () => identity,
    revision: () => digest(document.exportHwp()),
    getSectionCount: () => document.getSectionCount(),
    getParagraphCount: section => document.getParagraphCount(section),
    getParagraphLength: (section, paragraph) => document.getParagraphLength(section, paragraph),
    getTextRange: (section, paragraph, start, count) => document.getTextRange(section, paragraph, start, count),
  };
}

test('B133 reads mixed real HWP/HWPX documents without mutating bytes or undo snapshots', () => {
  const beforeSource = authored(['기존 문단', '삭제']);
  const afterSource = authored(['변경 문단', '추가']);
  const before = new HwpDocument(beforeSource.exportHwp());
  const after = new HwpDocument(afterSource.exportHwpx());
  beforeSource.free();
  afterSource.free();
  try {
    const beforeHwp = before.exportHwp();
    const beforeHwpx = before.exportHwpx();
    const afterHwp = after.exportHwp();
    const afterHwpx = after.exportHwpx();
    const beforeSnapshot = before.saveSnapshot();
    const afterSnapshot = after.saveSnapshot();
    const beforePort = nativePort(before, 'native-before-b133');
    const afterPort = nativePort(after, 'native-after-b133');
    const comparison = compareOpenDocumentsB135(beforePort, afterPort);
    const view = createTrackedChangeViewB133(comparison, beforePort, afterPort);
    assert.equal(view.changes.length, 1);
    assert.equal(verifyTrackedChangeViewB133(view, comparison, beforePort, afterPort).fingerprint, view.fingerprint);
    assert.deepEqual(before.exportHwp(), beforeHwp);
    assert.deepEqual(before.exportHwpx(), beforeHwpx);
    assert.deepEqual(after.exportHwp(), afterHwp);
    assert.deepEqual(after.exportHwpx(), afterHwpx);
    assert.notEqual(JSON.parse(before.restoreSnapshot(beforeSnapshot)).ok, false);
    assert.notEqual(JSON.parse(after.restoreSnapshot(afterSnapshot)).ok, false);
    before.discardSnapshot(beforeSnapshot);
    after.discardSnapshot(afterSnapshot);
    for (const bytes of [beforeHwp, beforeHwpx, afterHwp, afterHwpx]) {
      const reopened = new HwpDocument(bytes);
      try { assert.ok(reopened.getParagraphCount(0) >= 2); } finally { reopened.free(); }
    }
  } finally {
    before.free();
    after.free();
  }
});
