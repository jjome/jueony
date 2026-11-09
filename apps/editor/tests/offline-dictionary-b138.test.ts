import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import test from 'node:test';
import type {HwpDocument as HwpDocumentType} from '@rhwp/core';
import {
  lookupOfflineDictionaryB138,
  verifyOfflineDictionaryLookupB138,
  type DictionaryDocumentPortB138,
  type DictionaryRequestB138,
  type OfflineDictionaryProviderB138,
} from '../src/adapters/rhwp/offline-dictionary-b138.ts';

const enginePackage = process.env.JUEONY_ENGINE_PACKAGE
  ? resolve(process.env.JUEONY_ENGINE_PACKAGE)
  : fileURLToPath(new URL('../node_modules/@rhwp/core/', import.meta.url));
const engine = await import(pathToFileURL(resolve(enginePackage, 'rhwp.js')).href);
const {HwpDocument} = engine as typeof import('@rhwp/core');
await engine.default({module_or_path: await readFile(resolve(enginePackage, 'rhwp_bg.wasm'))});

const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

function provider(version = 'dictionary-1', change?: (request: DictionaryRequestB138) => unknown): OfflineDictionaryProviderB138 {
  return {mode: 'offline', id: 'test-korean-dictionary', version, locale: 'ko-KR', lookup: request => change?.(request) ?? ({
    requestFingerprint: request.queryFingerprint,
    entries: [{headword: request.query, partOfSpeech: '명사', definitions: ['업무를 처리하기 위한 기록.'], synonyms: ['기록']}],
  })};
}

function fake(text = '공문 문서', revision = 'revision-1', start = 0, end = 2): DictionaryDocumentPortB138 {
  return {identity: () => 'document-b138', revision: () => revision,
    getSelection: () => ({story: 'body', section: 0, paragraph: 0, start, end}), getSectionCount: () => 1,
    getParagraphCount: () => 1, getParagraphLength: () => Array.from(text).length,
    getTextRange: (_section, _paragraph, offset, count) => Array.from(text).slice(offset, offset + count).join('')};
}

test('B138 resolves a selected word and a caret word through an explicit offline dictionary', () => {
  const selected = lookupOfflineDictionaryB138(fake(), provider(), 'korean');
  assert.equal(selected.query, '공문');
  assert.equal(selected.entries[0].definitions[0], '업무를 처리하기 위한 기록.');
  assert.equal(verifyOfflineDictionaryLookupB138(selected, fake(), provider()).fingerprint, selected.fingerprint);
  const caret = lookupOfflineDictionaryB138(fake('앞 공문 뒤', 'revision-1', 3, 3), provider(), 'thesaurus');
  assert.equal(caret.query, '공문');
  assert.deepEqual(caret.selection, {story: 'body', section: 0, paragraph: 0, start: 2, end: 4});
});

test('B138 rejects online, special-story, malformed, stale and mismatched dictionary responses', () => {
  assert.throws(() => lookupOfflineDictionaryB138(fake(), {...provider(), mode: 'network'} as never, 'korean'), /오프라인/);
  const special = {...fake(), getSelection: () => ({story: 'header', section: 0, paragraph: 0, start: 0, end: 2})};
  assert.throws(() => lookupOfflineDictionaryB138(special, provider(), 'korean'), /최상위 본문/);
  assert.throws(() => lookupOfflineDictionaryB138(fake(), provider('v1', request => ({requestFingerprint: `${request.queryFingerprint}x`, entries: []})), 'korean'), /일치하지 않습니다/);
  assert.throws(() => lookupOfflineDictionaryB138(fake(), provider('v1', request => ({requestFingerprint: request.queryFingerprint,
    entries: [{headword: '공문', partOfSpeech: '명사', definitions: ['잘못된\n뜻'], synonyms: []}]})), 'korean'));
  const lookup = lookupOfflineDictionaryB138(fake(), provider(), 'korean');
  assert.throws(() => verifyOfflineDictionaryLookupB138(lookup, fake('공문 문서', 'revision-2'), provider()), /바뀌었습니다/);
  assert.throws(() => verifyOfflineDictionaryLookupB138(lookup, fake(), provider('dictionary-2')), /바뀌었습니다/);
});

function nativePort(document: HwpDocumentType, revision: string): DictionaryDocumentPortB138 {
  return {identity: () => 'document-native-b138', revision: () => revision,
    getSelection: () => ({story: 'body', section: 0, paragraph: 0, start: 0, end: 2}),
    getSectionCount: () => document.getSectionCount(), getParagraphCount: section => document.getParagraphCount(section),
    getParagraphLength: (section, paragraph) => document.getParagraphLength(section, paragraph),
    getTextRange: (section, paragraph, start, count) => document.getTextRange(section, paragraph, start, count)};
}

test('B138 actual HWP/HWPX lookup preserves exports and an existing undo snapshot', () => {
  const source = HwpDocument.createEmpty(); source.createBlankDocument(); source.insertText(0, 0, 0, '공문 문서');
  const fixtures = [source.exportHwp(), source.exportHwpx()]; source.free();
  for (const fixture of fixtures) {
    const document = new HwpDocument(fixture);
    try {
      const beforeHwp = document.exportHwp(), beforeHwpx = document.exportHwpx(), snapshot = document.saveSnapshot();
      const lookup = lookupOfflineDictionaryB138(nativePort(document, digest(beforeHwp)), provider(), 'korean');
      assert.equal(lookup.query, '공문');
      assert.deepEqual(document.exportHwp(), beforeHwp); assert.deepEqual(document.exportHwpx(), beforeHwpx);
      assert.notEqual(JSON.parse(document.restoreSnapshot(snapshot)).ok, false); document.discardSnapshot(snapshot);
      assert.deepEqual(document.exportHwp(), beforeHwp); assert.deepEqual(document.exportHwpx(), beforeHwpx);
      for (const bytes of [beforeHwp, beforeHwpx]) {
        const reopened = new HwpDocument(bytes);
        try { assert.equal(lookupOfflineDictionaryB138(nativePort(reopened, digest(reopened.exportHwp())), provider(), 'hanja').query, '공문'); }
        finally { reopened.free(); }
      }
    } finally { document.free(); }
  }
});
