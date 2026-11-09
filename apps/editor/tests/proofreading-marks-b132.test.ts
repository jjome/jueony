import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import test from 'node:test';
import type {HwpDocument as HwpDocumentType} from '@rhwp/core';
import {
  createProofreadingOverlayB132,
  verifyProofreadingOverlayB132,
  type LocalProofreadingSourceB132,
  type ProofreadingDocumentPortB132,
} from '../src/adapters/rhwp/proofreading-marks-b132.ts';

const enginePackage = process.env.JUEONY_ENGINE_PACKAGE
  ? resolve(process.env.JUEONY_ENGINE_PACKAGE)
  : fileURLToPath(new URL('../node_modules/@rhwp/core/', import.meta.url));
const engine = await import(pathToFileURL(resolve(enginePackage, 'rhwp.js')).href);
const {HwpDocument} = engine as typeof import('@rhwp/core');
await engine.default({module_or_path: await readFile(resolve(enginePackage, 'rhwp_bg.wasm'))});

const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const text = '업무 보고서 문장';

function source(version = 'marks-1', marks: readonly unknown[] = [
  {id: 'replace-report', kind: 'replace', section: 0, paragraph: 0, startOffset: 3, endOffset: 6,
    original: '보고서', note: '계획서로 바꾸기'},
  {id: 'insert-period', kind: 'insert', section: 0, paragraph: 0, startOffset: 9, endOffset: 9,
    original: '', note: '마침표 넣기'},
]): LocalProofreadingSourceB132 {
  return {mode: 'local', id: 'reviewer-a', version, marks};
}

function fake(value = text, revision = 'revision-1'): ProofreadingDocumentPortB132 {
  return {identity: () => 'document-b132', revision: () => revision, getSectionCount: () => 1,
    getParagraphCount: () => 1, getParagraphLength: () => Array.from(value).length,
    getTextRange: (_section, _paragraph, start, count) => Array.from(value).slice(start, start + count).join('')};
}

test('B132 creates deterministic body anchors for an explicit bounded local mark list', () => {
  const overlay = createProofreadingOverlayB132(fake(), source());
  assert.equal(overlay.entries.length, 2);
  assert.deepEqual(overlay.entries.map(entry => [entry.id, entry.kind, entry.original, entry.story]), [
    ['replace-report', 'replace', '보고서', 'body'], ['insert-period', 'insert', '', 'body'],
  ]);
  assert.match(overlay.entries[0].anchorId, /^[0-9a-f]{64}$/u);
  assert.match(overlay.fingerprint, /^[0-9a-f]{64}$/u);
  assert.equal(Object.isFrozen(overlay), true);
  assert.equal(verifyProofreadingOverlayB132(overlay, fake(), source()).fingerprint, overlay.fingerprint);
});

test('B132 rejects network-shaped, malformed, overlapping and source-mismatched marks', () => {
  assert.throws(() => createProofreadingOverlayB132(fake(), {...source(), mode: 'network'} as never), /로컬/);
  const invalid: readonly (readonly unknown[])[] = [
    [{id: 'bad-control', kind: 'replace', section: 0, paragraph: 0, startOffset: 3, endOffset: 6,
      original: '보고서', note: '나쁜\n설명'}],
    [{id: 'wrong-original', kind: 'replace', section: 0, paragraph: 0, startOffset: 3, endOffset: 6,
      original: '계획서', note: '바꾸기'}],
    [{id: 'bad-insert', kind: 'insert', section: 0, paragraph: 0, startOffset: 3, endOffset: 4,
      original: '보', note: '삽입'}],
    [
      {id: 'one', kind: 'delete', section: 0, paragraph: 0, startOffset: 3, endOffset: 6, original: '보고서', note: '지우기'},
      {id: 'two', kind: 'replace', section: 0, paragraph: 0, startOffset: 4, endOffset: 6, original: '고서', note: '바꾸기'},
    ],
  ];
  for (const marks of invalid) assert.throws(() => createProofreadingOverlayB132(fake(), source('marks-1', marks)));
});

test('B132 stale document, source version and local mark list fail closed', () => {
  const overlay = createProofreadingOverlayB132(fake(), source());
  assert.throws(() => verifyProofreadingOverlayB132(overlay, fake(text, 'revision-2'), source()), /바뀌었습니다/);
  assert.throws(() => verifyProofreadingOverlayB132(overlay, fake(), source('marks-2')), /바뀌었습니다/);
  assert.throws(() => verifyProofreadingOverlayB132(overlay, fake(), source('marks-1', [
    {id: 'replace-report', kind: 'replace', section: 0, paragraph: 0, startOffset: 3, endOffset: 6,
      original: '보고서', note: '다른 제안'},
  ])), /바뀌었습니다/);
  assert.throws(() => verifyProofreadingOverlayB132(overlay, fake('업무 계획서 문장'), source()), /원문|바뀌었습니다/);
});

function nativePort(document: HwpDocumentType, revision: string): ProofreadingDocumentPortB132 {
  return {identity: () => 'document-native-b132', revision: () => revision,
    getSectionCount: () => document.getSectionCount(), getParagraphCount: section => document.getParagraphCount(section),
    getParagraphLength: (section, paragraph) => document.getParagraphLength(section, paragraph),
    getTextRange: (section, paragraph, start, count) => document.getTextRange(section, paragraph, start, count)};
}

test('B132 actual HWP/HWPX overlays preserve export bytes and an existing undo snapshot', () => {
  const created = HwpDocument.createEmpty(); created.createBlankDocument(); created.insertText(0, 0, 0, text);
  const fixtures = [created.exportHwp(), created.exportHwpx()]; created.free();
  for (const fixture of fixtures) {
    const document = new HwpDocument(fixture);
    try {
      const beforeHwp = document.exportHwp(), beforeHwpx = document.exportHwpx(), snapshot = document.saveSnapshot();
      const port = nativePort(document, digest(beforeHwp));
      const overlay = createProofreadingOverlayB132(port, source());
      assert.equal(verifyProofreadingOverlayB132(overlay, port, source()).entries.length, 2);
      assert.deepEqual(document.exportHwp(), beforeHwp); assert.deepEqual(document.exportHwpx(), beforeHwpx);
      assert.notEqual(JSON.parse(document.restoreSnapshot(snapshot)).ok, false); document.discardSnapshot(snapshot);
      assert.deepEqual(document.exportHwp(), beforeHwp); assert.deepEqual(document.exportHwpx(), beforeHwpx);
      for (const bytes of [beforeHwp, beforeHwpx]) {
        const reopened = new HwpDocument(bytes);
        try {
          const result = createProofreadingOverlayB132(nativePort(reopened, digest(reopened.exportHwp())), source());
          assert.equal(result.entries[0].original, '보고서');
        } finally { reopened.free(); }
      }
    } finally { document.free(); }
  }
});
