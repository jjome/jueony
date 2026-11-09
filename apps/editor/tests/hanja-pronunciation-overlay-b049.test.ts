import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import test from 'node:test';
import type {HwpDocument as HwpDocumentType} from '@rhwp/core';
import {
  createHanjaPronunciationOverlayB049,
  verifyHanjaPronunciationOverlayB049,
  type OfflinePronunciationProviderB049,
  type PronunciationDocumentPortB049,
  type PronunciationParagraphB049,
} from '../src/adapters/rhwp/hanja-pronunciation-overlay-b049.ts';

const enginePackage = process.env.JUEONY_ENGINE_PACKAGE
  ? resolve(process.env.JUEONY_ENGINE_PACKAGE)
  : fileURLToPath(new URL('../node_modules/@rhwp/core/', import.meta.url));
const engine = await import(pathToFileURL(resolve(enginePackage, 'rhwp.js')).href);
const {HwpDocument} = engine as typeof import('@rhwp/core');
await engine.default({module_or_path: await readFile(resolve(enginePackage, 'rhwp_bg.wasm'))});

const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

function provider(version = 'dictionary-1', response?: (paragraphs: readonly PronunciationParagraphB049[]) => unknown): OfflinePronunciationProviderB049 {
  return {mode: 'offline', id: 'test-hanja-ko', version, locale: 'ko-KR', lookup: paragraphs => response?.(paragraphs) ?? [
    {section: 0, paragraph: 0, startOffset: 0, endOffset: 2, source: '漢字', pronunciation: '한자'},
  ]};
}

function fake(text = '漢字 문서', revision = 'revision-1'): PronunciationDocumentPortB049 {
  return {
    identity: () => 'document-b049', revision: () => revision, getSectionCount: () => 1,
    getParagraphCount: () => 1, getParagraphLength: () => Array.from(text).length,
    getTextRange: (_section, _paragraph, start, count) => Array.from(text).slice(start, start + count).join(''),
  };
}

const range = {section: 0, startParagraph: 0, endParagraph: 1};

test('B049 creates a deterministic read-only overlay from an explicit offline ko-KR provider', () => {
  const overlay = createHanjaPronunciationOverlayB049(fake(), provider(), range);
  assert.deepEqual(overlay.entries, [{section: 0, paragraph: 0, startOffset: 0, endOffset: 2, source: '漢字', pronunciation: '한자'}]);
  assert.match(overlay.sourceFingerprint, /^[0-9a-f]{64}$/u);
  assert.match(overlay.fingerprint, /^[0-9a-f]{64}$/u);
  assert.equal(Object.isFrozen(overlay), true);
  assert.equal(verifyHanjaPronunciationOverlayB049(overlay, fake(), provider()).fingerprint, overlay.fingerprint);
});

test('B049 rejects network-shaped, malformed, overlapping and source-mismatched provider output', () => {
  assert.throws(() => createHanjaPronunciationOverlayB049(fake(), {...provider(), mode: 'network'} as never, range), /오프라인/);
  const invalid = [
    () => provider('v1', () => [{section: 0, paragraph: 0, startOffset: 0, endOffset: 2, source: '漢字', pronunciation: 'hanja'}]),
    () => provider('v1', () => [{section: 0, paragraph: 0, startOffset: 0, endOffset: 2, source: '韓字', pronunciation: '한자'}]),
    () => provider('v1', () => [
      {section: 0, paragraph: 0, startOffset: 0, endOffset: 2, source: '漢字', pronunciation: '한자'},
      {section: 0, paragraph: 0, startOffset: 1, endOffset: 2, source: '字', pronunciation: '자'},
    ]),
    () => provider('v1', () => [{section: 2, paragraph: 0, startOffset: 0, endOffset: 2, source: '漢字', pronunciation: '한자'}]),
  ];
  for (const item of invalid) assert.throws(() => createHanjaPronunciationOverlayB049(fake(), item(), range));
});

test('B049 stale document, range, dictionary version and dictionary response fail closed', () => {
  const overlay = createHanjaPronunciationOverlayB049(fake(), provider(), range);
  assert.throws(() => verifyHanjaPronunciationOverlayB049(overlay, fake('漢字 문서', 'revision-2'), provider()), /바뀌었습니다/);
  assert.throws(() => verifyHanjaPronunciationOverlayB049(overlay, fake(), provider('dictionary-2')), /바뀌었습니다/);
  assert.throws(() => verifyHanjaPronunciationOverlayB049(overlay, fake(), provider('dictionary-1', () => [
    {section: 0, paragraph: 0, startOffset: 0, endOffset: 1, source: '漢', pronunciation: '한'},
  ])), /바뀌었습니다/);
  assert.throws(() => createHanjaPronunciationOverlayB049(fake(), provider(), {section: 0, startParagraph: 0, endParagraph: 2}));
});

function nativePort(document: HwpDocumentType, revision: string): PronunciationDocumentPortB049 {
  return {identity: () => 'document-native-b049', revision: () => revision,
    getSectionCount: () => document.getSectionCount(), getParagraphCount: section => document.getParagraphCount(section),
    getParagraphLength: (section, paragraph) => document.getParagraphLength(section, paragraph),
    getTextRange: (section, paragraph, start, count) => document.getTextRange(section, paragraph, start, count)};
}

test('B049 actual HWP/HWPX overlays preserve both export bytes and an existing undo snapshot', () => {
  const source = HwpDocument.createEmpty(); source.createBlankDocument(); source.insertText(0, 0, 0, '漢字 문서');
  const fixtures = [source.exportHwp(), source.exportHwpx()]; source.free();
  for (const fixture of fixtures) {
    const document = new HwpDocument(fixture);
    try {
      const beforeHwp = document.exportHwp(), beforeHwpx = document.exportHwpx(), snapshot = document.saveSnapshot();
      const revision = digest(beforeHwp), port = nativePort(document, revision);
      const overlay = createHanjaPronunciationOverlayB049(port, provider(), range);
      assert.equal(verifyHanjaPronunciationOverlayB049(overlay, port, provider()).entries[0].pronunciation, '한자');
      assert.deepEqual(document.exportHwp(), beforeHwp); assert.deepEqual(document.exportHwpx(), beforeHwpx);
      assert.notEqual(JSON.parse(document.restoreSnapshot(snapshot)).ok, false); document.discardSnapshot(snapshot);
      assert.deepEqual(document.exportHwp(), beforeHwp); assert.deepEqual(document.exportHwpx(), beforeHwpx);
      for (const bytes of [beforeHwp, beforeHwpx]) {
        const reopened = new HwpDocument(bytes);
        try {
          const state = createHanjaPronunciationOverlayB049(nativePort(reopened, digest(reopened.exportHwp())), provider(), range);
          assert.equal(state.entries[0].source, '漢字');
        } finally { reopened.free(); }
      }
    } finally { document.free(); }
  }
});
