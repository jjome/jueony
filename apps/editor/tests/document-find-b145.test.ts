import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import test from 'node:test';
import type {HwpDocument as HwpDocumentType} from '@rhwp/core';
import {
  findInOpenDocumentB145,
  focusDocumentFindMatchB145,
  verifyDocumentFindResultB145,
  type DocumentFindPortB145,
  type DocumentFocusTargetB145,
} from '../src/adapters/rhwp/document-find-b145.ts';

const enginePackage = process.env.JUEONY_ENGINE_PACKAGE
  ? resolve(process.env.JUEONY_ENGINE_PACKAGE)
  : fileURLToPath(new URL('../node_modules/@rhwp/core/', import.meta.url));
const engine = await import(pathToFileURL(resolve(enginePackage, 'rhwp.js')).href);
const {HwpDocument} = engine as typeof import('@rhwp/core');
await engine.default({module_or_path: await readFile(resolve(enginePackage, 'rhwp_bg.wasm'))});

const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

function fake(paragraphs = [['보고서 보고', 'Second REPORT']], revision = 'revision-1', focus?: (target: DocumentFocusTargetB145) => unknown): DocumentFindPortB145 {
  return {
    identity: () => 'document-b145', revision: () => revision, getSectionCount: () => paragraphs.length,
    getParagraphCount: section => paragraphs[section]?.length ?? 0,
    getParagraphLength: (section, paragraph) => Array.from(paragraphs[section]?.[paragraph] ?? '').length,
    getTextRange: (section, paragraph, start, count) => Array.from(paragraphs[section]?.[paragraph] ?? '').slice(start, start + count).join(''),
    ...(focus ? {focusTarget: focus} : {}),
  };
}

test('B145 finds deterministic literal body ranges and bounded snippets', () => {
  const sensitive = findInOpenDocumentB145(fake(), {query: '보고', caseSensitive: true});
  assert.deepEqual(sensitive.matches.map(item => [item.section, item.paragraph, item.startOffset, item.endOffset, item.match]), [
    [0, 0, 0, 2, '보고'], [0, 0, 4, 6, '보고'],
  ]);
  assert.equal(sensitive.matches[0].snippetStartOffset, 0);
  assert.equal(sensitive.matches[0].snippet, '보고서 보고');
  const insensitive = findInOpenDocumentB145(fake(), {query: 'report', caseSensitive: false});
  assert.equal(insensitive.matches[0].match, 'REPORT');
  assert.match(insensitive.fingerprint, /^[0-9a-f]{64}$/u);
  assert.equal(Object.isFrozen(insensitive), true);
});

test('B145 rejects malformed requests and document budgets, and stale seals fail closed', () => {
  for (const request of [null, {query: '', caseSensitive: true}, {query: 'x\n', caseSensitive: true},
    {query: 'x', caseSensitive: true, regex: true}, {query: 'x'.repeat(257), caseSensitive: false}]) {
    assert.throws(() => findInOpenDocumentB145(fake(), request));
  }
  const result = findInOpenDocumentB145(fake(), {query: '보고', caseSensitive: true});
  assert.equal(verifyDocumentFindResultB145(result, fake()).matches.length, 2);
  assert.throws(() => verifyDocumentFindResultB145(result, fake(undefined, 'revision-2')), /바뀌었습니다/);
  assert.throws(() => verifyDocumentFindResultB145(result, fake([['보고서 변경']])), /바뀌었습니다/);
  const tooLarge = fake([['x'.repeat(1_000_001)]]);
  assert.throws(() => findInOpenDocumentB145(tooLarge, {query: 'x', caseSensitive: true}), /너무 큽니다/);
});

test('B145 revalidates before focus and uses an explicit body target contract', () => {
  const seen: DocumentFocusTargetB145[] = [];
  const port = fake(undefined, 'revision-1', target => { seen.push(target); return {ok: true}; });
  const result = findInOpenDocumentB145(port, {query: '보고', caseSensitive: true});
  assert.deepEqual(focusDocumentFindMatchB145(result, 1, port),
    {story: 'body', section: 0, paragraph: 0, startOffset: 4, endOffset: 6});
  assert.deepEqual(seen, [{story: 'body', section: 0, paragraph: 0, startOffset: 4, endOffset: 6}]);
  assert.throws(() => focusDocumentFindMatchB145(result, 2, port), /올바르지/);
  assert.throws(() => focusDocumentFindMatchB145(result, 0, fake()), /지원하지/);
  assert.throws(() => focusDocumentFindMatchB145(result, 0, fake(undefined, 'revision-2', () => ({ok: true}))), /바뀌었습니다/);
  assert.throws(() => focusDocumentFindMatchB145(result, 0, fake(undefined, 'revision-1', () => ({ok: false}))), /이동하지 못했습니다/);
});

function nativePort(document: HwpDocumentType, revision: string): DocumentFindPortB145 {
  return {identity: () => 'document-native-b145', revision: () => revision,
    getSectionCount: () => document.getSectionCount(), getParagraphCount: section => document.getParagraphCount(section),
    getParagraphLength: (section, paragraph) => document.getParagraphLength(section, paragraph),
    getTextRange: (section, paragraph, start, count) => document.getTextRange(section, paragraph, start, count)};
}

test('B145 actual HWP/HWPX search and verification preserve export bytes and undo snapshot', () => {
  const source = HwpDocument.createEmpty(); source.createBlankDocument(); source.insertText(0, 0, 0, '업무 보고서 보고');
  const fixtures = [source.exportHwp(), source.exportHwpx()]; source.free();
  for (const fixture of fixtures) {
    const document = new HwpDocument(fixture);
    try {
      const beforeHwp = document.exportHwp(), beforeHwpx = document.exportHwpx(), snapshot = document.saveSnapshot();
      const port = nativePort(document, digest(beforeHwp));
      const result = findInOpenDocumentB145(port, {query: '보고', caseSensitive: true});
      assert.equal(result.matches.length, 2);
      assert.equal(verifyDocumentFindResultB145(result, port).fingerprint, result.fingerprint);
      assert.deepEqual(document.exportHwp(), beforeHwp); assert.deepEqual(document.exportHwpx(), beforeHwpx);
      assert.notEqual(JSON.parse(document.restoreSnapshot(snapshot)).ok, false); document.discardSnapshot(snapshot);
      assert.deepEqual(document.exportHwp(), beforeHwp); assert.deepEqual(document.exportHwpx(), beforeHwpx);
      for (const bytes of [beforeHwp, beforeHwpx]) {
        const reopened = new HwpDocument(bytes);
        try {
          assert.equal(findInOpenDocumentB145(nativePort(reopened, digest(reopened.exportHwp())),
            {query: '보고', caseSensitive: true}).matches.length, 2);
        } finally { reopened.free(); }
      }
    } finally { document.free(); }
  }
});
