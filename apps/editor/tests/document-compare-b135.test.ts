import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import test from 'node:test';
import type {HwpDocument as HwpDocumentType} from '@rhwp/core';
import {compareOpenDocumentsB135, verifyDocumentComparisonB135,
  type DocumentComparePortB135} from '../src/adapters/rhwp/document-compare-b135.ts';

const enginePackage = process.env.JUEONY_ENGINE_PACKAGE
  ? resolve(process.env.JUEONY_ENGINE_PACKAGE)
  : fileURLToPath(new URL('../node_modules/@rhwp/core/', import.meta.url));
const engine = await import(pathToFileURL(resolve(enginePackage, 'rhwp.js')).href);
const {HwpDocument} = engine as typeof import('@rhwp/core');
await engine.default({module_or_path: await readFile(resolve(enginePackage, 'rhwp_bg.wasm'))});

const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

function fake(texts: string[][], identity = 'document-b135', revision = 'revision-1'): DocumentComparePortB135 {
  return {identity: () => identity, revision: () => revision, getSectionCount: () => texts.length,
    getParagraphCount: section => texts[section]?.length ?? 0,
    getParagraphLength: (section, paragraph) => Array.from(texts[section]?.[paragraph] ?? '').length,
    getTextRange: (section, paragraph, start, count) => Array.from(texts[section]?.[paragraph] ?? '').slice(start, start + count).join('')};
}

test('B135 emits deterministic equal, replace, insert and delete paragraph hunks', () => {
  const before = fake([['같음', '가😀나다', '삭제', '끝']], 'before');
  const after = fake([['같음', '가😀라마', '추가', '끝']], 'after');
  const result = compareOpenDocumentsB135(before, after);
  assert.deepEqual(result.hunks.map(value => value.kind), ['equal', 'replace', 'equal']);
  const changed = result.hunks[1];
  assert.deepEqual(changed.before.map(value => value.text), ['가😀나다', '삭제']);
  assert.deepEqual(changed.after.map(value => value.text), ['가😀라마', '추가']);
  assert.equal(changed.scalarChange, undefined);
  const scalar = compareOpenDocumentsB135(fake([['가😀나다']], 'scalar-a'), fake([['가😀라마']], 'scalar-b')).hunks[0];
  assert.equal(scalar.kind, 'replace');
  assert.deepEqual(scalar.scalarChange, {beforeStart: 2, beforeEnd: 4, afterStart: 2, afterEnd: 4});
  assert.match(result.fingerprint, /^[0-9a-f]{64}$/u);
});

test('B135 classifies one-sided changes exactly and preserves section addresses', () => {
  const inserted = compareOpenDocumentsB135(fake([['앞', '뒤']], 'a'), fake([['앞', '새 문단', '뒤']], 'b'));
  assert.deepEqual(inserted.hunks.map(value => value.kind), ['equal', 'insert', 'equal']);
  assert.deepEqual(inserted.hunks[1].after.map(value => [value.section, value.paragraph, value.text]), [[0, 1, '새 문단']]);
  const deleted = compareOpenDocumentsB135(fake([['앞'], ['삭제', '뒤']], 'c'), fake([['앞'], ['뒤']], 'd'));
  assert.deepEqual(deleted.hunks.map(value => value.kind), ['equal', 'delete', 'equal']);
  assert.deepEqual(deleted.hunks[1].before.map(value => [value.section, value.paragraph, value.text]), [[1, 0, '삭제']]);
});

test('B135 fails closed on invalid budgets, same ports and stale documents', () => {
  const before = fake([['원문']], 'before');
  const after = fake([['변경']], 'after');
  const result = compareOpenDocumentsB135(before, after);
  assert.equal(verifyDocumentComparisonB135(result, before, after).fingerprint, result.fingerprint);
  assert.throws(() => compareOpenDocumentsB135(before, before), /서로 다른/);
  assert.throws(() => verifyDocumentComparisonB135(result, fake([['원문']], 'before', 'revision-2'), after), /바뀌었습니다/);
  assert.throws(() => compareOpenDocumentsB135(fake([['x'.repeat(65_537)]], 'large'), after), /너무 큽니다/);
  assert.throws(() => compareOpenDocumentsB135(fake(Array.from({length: 513}, () => ['x']), 'many'), after), /구역/);
  assert.throws(() => compareOpenDocumentsB135(fake([['x']], 'bad identity!'), after), /식별자/);
  let mutableRevision = 'revision-1';
  const mutable = {...fake([['원문']], 'mutable'), revision: () => mutableRevision};
  const mutator = {...fake([['비교']], 'mutator'), getSectionCount: () => { mutableRevision = 'revision-2'; return 1; }};
  assert.throws(() => compareOpenDocumentsB135(mutable, mutator), /비교 도중 바뀌었습니다/);
});

function nativePort(document: HwpDocumentType, identity: string): DocumentComparePortB135 {
  return {identity: () => identity, revision: () => digest(document.exportHwp()),
    getSectionCount: () => document.getSectionCount(), getParagraphCount: section => document.getParagraphCount(section),
    getParagraphLength: (section, paragraph) => document.getParagraphLength(section, paragraph),
    getTextRange: (section, paragraph, start, count) => document.getTextRange(section, paragraph, start, count)};
}

function authored(lines: string[]): HwpDocumentType {
  const document = HwpDocument.createEmpty(); document.createBlankDocument();
  document.insertText(0, 0, 0, lines[0]);
  for (let index = 1; index < lines.length; index += 1) {
    document.insertParagraph(0, index - 1); document.insertText(0, index, 0, lines[index]);
  }
  return document;
}

test('B135 compares mixed real HWP/HWPX documents without changing exports or undo snapshots', () => {
  const leftSource = authored(['업무 😀', '기존 문단']);
  const rightSource = authored(['업무 😀', '변경 문단', '추가']);
  const left = new HwpDocument(leftSource.exportHwp());
  const right = new HwpDocument(rightSource.exportHwpx());
  leftSource.free(); rightSource.free();
  try {
    const leftHwp = left.exportHwp(), leftHwpx = left.exportHwpx(), rightHwp = right.exportHwp(), rightHwpx = right.exportHwpx();
    const leftSnapshot = left.saveSnapshot(), rightSnapshot = right.saveSnapshot();
    const before = nativePort(left, 'native-before-b135'), after = nativePort(right, 'native-after-b135');
    const result = compareOpenDocumentsB135(before, after);
    assert.deepEqual(result.hunks.map(value => value.kind), ['equal', 'replace']);
    assert.equal(verifyDocumentComparisonB135(result, before, after).fingerprint, result.fingerprint);
    assert.deepEqual(left.exportHwp(), leftHwp); assert.deepEqual(left.exportHwpx(), leftHwpx);
    assert.deepEqual(right.exportHwp(), rightHwp); assert.deepEqual(right.exportHwpx(), rightHwpx);
    assert.notEqual(JSON.parse(left.restoreSnapshot(leftSnapshot)).ok, false);
    assert.notEqual(JSON.parse(right.restoreSnapshot(rightSnapshot)).ok, false);
    left.discardSnapshot(leftSnapshot); right.discardSnapshot(rightSnapshot);
    assert.deepEqual(left.exportHwp(), leftHwp); assert.deepEqual(right.exportHwpx(), rightHwpx);
    for (const bytes of [leftHwp, leftHwpx, rightHwp, rightHwpx]) {
      const reopened = new HwpDocument(bytes);
      try { assert.ok(reopened.getParagraphCount(0) >= 2); } finally { reopened.free(); }
    }
  } finally { left.free(); right.free(); }
});
