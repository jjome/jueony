import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import test from 'node:test';
import type {HwpDocument as HwpDocumentType} from '@rhwp/core';
import {
  applyOfflineTranslationB139,
  captureOfflineTranslationB139,
  type OfflineTranslationProviderB139,
  type TranslationContextB139,
  type TranslationRequestB139,
} from '../src/adapters/rhwp/offline-translation-b139.ts';

const enginePackage = process.env.JUEONY_ENGINE_PACKAGE
  ? resolve(process.env.JUEONY_ENGINE_PACKAGE)
  : fileURLToPath(new URL('../node_modules/@rhwp/core/', import.meta.url));
const engine = await import(pathToFileURL(resolve(enginePackage, 'rhwp.js')).href);
const {HwpDocument} = engine as typeof import('@rhwp/core');
await engine.default({module_or_path: await readFile(resolve(enginePackage, 'rhwp_bg.wasm'))});
const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const body = (document: HwpDocumentType) => document.getTextRange(0, 0, 0, document.getParagraphLength(0, 0));

function provider(overrides: Partial<OfflineTranslationProviderB139> = {}): OfflineTranslationProviderB139 {
  return {
    id: () => 'offline-translation-test', version: () => '2026.11', offline: () => true,
    translate: (request: TranslationRequestB139) => ({providerId: 'offline-translation-test', version: '2026.11',
      requestFingerprint: request.requestFingerprint, candidates: ['Annual plan', 'Yearly plan']}),
    ...overrides,
  };
}

function fixture(text = '연간 계획') {
  const document: HwpDocumentType = HwpDocument.createEmpty(); document.createBlankDocument(); document.insertText(0, 0, 0, text);
  let selected: unknown = {sectionIndex: 0, paragraphIndex: 0, startOffset: 0, endOffset: Array.from(text).length};
  let identity = 'document-b139', story = 'body', protectedDocument = false, revisionOverride: string | undefined;
  const context: TranslationContextB139 = {
    documentIdentity: () => identity, revision: () => revisionOverride ?? digest(document.exportHwp()),
    story: () => story, editable: () => true, protected: () => protectedDocument, selection: () => selected,
  };
  return {document, context, setSelection(value: unknown) { selected = value; }, setIdentity(value: string) { identity = value; },
    setStory(value: string) { story = value; }, setProtected(value: boolean) { protectedDocument = value; },
    setRevision(value: string | undefined) { revisionOverride = value; }};
}

test('B139 applies one explicit offline translation with exact HWP/HWPX undo and redo', async () => {
  const f = fixture();
  try {
    let snapshots = 0;
    const host = new Proxy(f.document, {get(target, key) {
      if (key === 'saveSnapshot') return () => { snapshots += 1; return target.saveSnapshot(); };
      const value = Reflect.get(target, key, target); return typeof value === 'function' ? value.bind(target) : value;
    }});
    const beforeHwp = f.document.exportHwp(), beforeHwpx = f.document.exportHwpx();
    const captured = await captureOfflineTranslationB139(host, f.context, provider(), 'ko-KR', 'en-US');
    assert.equal(captured.status, 'ready'); if (captured.status !== 'ready') return;
    const applied = applyOfflineTranslationB139(host, f.context, provider(), captured.plan, 0);
    assert.equal(applied.status, 'applied'); if (applied.status !== 'applied') return;
    assert.equal(snapshots, 1); assert.equal(body(f.document), 'Annual plan');
    const afterHwp = f.document.exportHwp(), afterHwpx = f.document.exportHwpx();
    for (const bytes of [afterHwp, afterHwpx]) {
      const reopened = new HwpDocument(bytes); try { assert.equal(body(reopened), 'Annual plan'); } finally { reopened.free(); }
    }
    assert.equal(applied.command.undo().status, 'restored');
    assert.deepEqual(f.document.exportHwp(), beforeHwp); assert.deepEqual(f.document.exportHwpx(), beforeHwpx);
    assert.equal(applied.command.redo().status, 'restored');
    assert.deepEqual(f.document.exportHwp(), afterHwp); assert.deepEqual(f.document.exportHwpx(), afterHwpx);
    assert.equal(snapshots, 1); applied.command.dispose();
  } finally { f.document.free(); }
});

test('B139 rejects online, malformed, mixed-format and unsupported translation requests', async () => {
  const f = fixture();
  try {
    assert.deepEqual(await captureOfflineTranslationB139(f.document, f.context, provider({offline: () => false}), 'ko-KR', 'en-US'),
      {status: 'blocked', reason: 'invalid-provider'});
    for (const [sourceLocale, targetLocale] of [['ko-KR', 'ko-KR'], ['auto', 'en-US'], ['ko-KR', 'EN-us']] as const) {
      assert.deepEqual(await captureOfflineTranslationB139(f.document, f.context, provider(), sourceLocale, targetLocale),
        {status: 'blocked', reason: 'invalid-locale'});
    }
    for (const candidates of [[], ['same', 'same'], ['bad\nvalue'], Array.from({length: 9}, (_, index) => `v${index}`)]) {
      const result = await captureOfflineTranslationB139(f.document, f.context, provider({translate: request => ({
        providerId: 'offline-translation-test', version: '2026.11', requestFingerprint: request.requestFingerprint, candidates,
      })}), 'ko-KR', 'en-US');
      assert.deepEqual(result, {status: 'blocked', reason: 'invalid-response'});
    }
    f.document.applyCharFormat(0, 0, 1, 2, JSON.stringify({bold: true}));
    assert.deepEqual(await captureOfflineTranslationB139(f.document, f.context, provider(), 'ko-KR', 'en-US'),
      {status: 'blocked', reason: 'mixed-formatting'});
  } finally { f.document.free(); }
});

test('B139 rejects every stale seal before opening a history snapshot', async () => {
  for (const stale of ['identity', 'revision', 'selection', 'source', 'provider', 'plan'] as const) {
    const f = fixture();
    try {
      const captured = await captureOfflineTranslationB139(f.document, f.context, provider(), 'ko-KR', 'en-US');
      assert.equal(captured.status, 'ready'); if (captured.status !== 'ready') continue;
      if (stale === 'identity') f.setIdentity('other-document');
      if (stale === 'revision') f.setRevision('other-revision');
      if (stale === 'selection') f.setSelection({sectionIndex: 0, paragraphIndex: 0, startOffset: 0, endOffset: 1});
      let snapshots = 0;
      const host = new Proxy(f.document, {get(target, key) {
        if (key === 'saveSnapshot') return () => { snapshots += 1; return target.saveSnapshot(); };
        if (stale === 'source' && key === 'getTextRange') return () => '다른 원문';
        const value = Reflect.get(target, key, target); return typeof value === 'function' ? value.bind(target) : value;
      }});
      const plan = stale === 'plan' ? {...captured.plan, candidates: ['forged']} : captured.plan;
      const result = applyOfflineTranslationB139(host, f.context,
        stale === 'provider' ? provider({version: () => '2027.1'}) : provider(), plan, 0);
      assert.equal(result.status, 'blocked', stale); assert.equal(snapshots, 0, stale);
    } finally { f.document.free(); }
  }
  const f = fixture();
  try {
    f.setStory('header'); assert.equal((await captureOfflineTranslationB139(f.document, f.context, provider(), 'ko-KR', 'en-US')).status, 'blocked');
    f.setStory('body'); f.setProtected(true); assert.equal((await captureOfflineTranslationB139(f.document, f.context, provider(), 'ko-KR', 'en-US')).status, 'blocked');
    f.setProtected(false); f.setSelection({sectionIndex: 0, paragraphIndex: 0, startOffset: 0, endOffset: 0});
    assert.equal((await captureOfflineTranslationB139(f.document, f.context, provider(), 'ko-KR', 'en-US')).status, 'blocked');
  } finally { f.document.free(); }
});

test('B139 restores exact bytes when the replacement is rejected after snapshot', async () => {
  const f = fixture();
  try {
    const captured = await captureOfflineTranslationB139(f.document, f.context, provider(), 'ko-KR', 'en-US');
    assert.equal(captured.status, 'ready'); if (captured.status !== 'ready') return;
    const beforeHwp = f.document.exportHwp(), beforeHwpx = f.document.exportHwpx();
    const host = new Proxy(f.document, {get(target, key) {
      if (key === 'replaceText') return () => '{"ok":false}';
      const value = Reflect.get(target, key, target); return typeof value === 'function' ? value.bind(target) : value;
    }});
    assert.deepEqual(applyOfflineTranslationB139(host, f.context, provider(), captured.plan, 0),
      {status: 'blocked', reason: 'verification-failed'});
    assert.deepEqual(f.document.exportHwp(), beforeHwp); assert.deepEqual(f.document.exportHwpx(), beforeHwpx);
  } finally { f.document.free(); }
});
