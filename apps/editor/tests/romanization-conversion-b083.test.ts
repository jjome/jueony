import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import init, {HwpDocument} from '../node_modules/@rhwp/core/rhwp.js';
import {
  applyRomanizationB083,
  captureRomanizationB083,
  type OfflineRomanizationProviderB083,
  type RomanizationContextB083,
  type RomanizationRequestB083,
} from '../src/adapters/rhwp/romanization-conversion-b083.ts';

await init({module_or_path: await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm', import.meta.url))});
const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const body = (document: HwpDocument) => document.getTextRange(0, 0, 0, document.getParagraphLength(0, 0));

function provider(overrides: Partial<OfflineRomanizationProviderB083> = {}): OfflineRomanizationProviderB083 {
  return {
    id: () => 'offline-test-dictionary', version: () => '2026.11',
    convert: (request: RomanizationRequestB083) => ({providerId: 'offline-test-dictionary', version: '2026.11',
      requestFingerprint: request.requestFingerprint, candidates: request.mode === 'korean-to-roman' ? ['Hanguk', 'Han-guk'] : ['한국']}),
    ...overrides,
  };
}

function fixture(text = '한국') {
  const document = HwpDocument.createEmpty(); document.createBlankDocument(); document.insertText(0, 0, 0, text);
  let selection: unknown = {sectionIndex: 0, paragraphIndex: 0, startOffset: 0, endOffset: Array.from(text).length};
  let identity = 'document-b083', story = 'body', protectedDocument = false, revisionOverride: string | undefined;
  const context: RomanizationContextB083 = {
    documentIdentity: () => identity, revision: () => revisionOverride ?? digest(document.exportHwp()),
    story: () => story, editable: () => true, protected: () => protectedDocument, selection: () => selection,
  };
  return {document, context, setSelection(value: unknown) { selection = value; }, setIdentity(value: string) { identity = value; },
    setStory(value: string) { story = value; }, setProtected(value: boolean) { protectedDocument = value; },
    setRevision(value: string | undefined) { revisionOverride = value; }};
}

test('B083 applies one explicit offline candidate with one snapshot and exact HWP/HWPX undo/redo', async () => {
  const f = fixture();
  try {
    let snapshots = 0;
    const host = new Proxy(f.document, {get(target, key) {
      if (key === 'saveSnapshot') return () => { snapshots += 1; return target.saveSnapshot(); };
      const value = Reflect.get(target, key, target); return typeof value === 'function' ? value.bind(target) : value;
    }});
    const beforeHwp = f.document.exportHwp(), beforeHwpx = f.document.exportHwpx();
    const captured = await captureRomanizationB083(host, f.context, provider(), 'korean-to-roman');
    assert.equal(captured.status, 'ready'); if (captured.status !== 'ready') return;
    const applied = applyRomanizationB083(host, f.context, provider(), captured.plan, 1);
    assert.equal(applied.status, 'applied'); if (applied.status !== 'applied') return;
    assert.equal(snapshots, 1); assert.equal(body(f.document), 'Han-guk');
    const afterHwp = f.document.exportHwp(), afterHwpx = f.document.exportHwpx();
    for (const bytes of [afterHwp, afterHwpx]) {
      const reopened = new HwpDocument(bytes); try { assert.equal(body(reopened), 'Han-guk'); } finally { reopened.free(); }
    }
    assert.equal(applied.command.undo().status, 'restored');
    assert.deepEqual(f.document.exportHwp(), beforeHwp); assert.deepEqual(f.document.exportHwpx(), beforeHwpx);
    assert.equal(applied.command.redo().status, 'restored');
    assert.deepEqual(f.document.exportHwp(), afterHwp); assert.deepEqual(f.document.exportHwpx(), afterHwpx);
    assert.equal(snapshots, 1); applied.command.dispose();
  } finally { f.document.free(); }
});

test('B083 validates provider identity, response seal, candidates and limits', async () => {
  const f = fixture();
  try {
    assert.equal((await captureRomanizationB083(f.document, f.context, provider({id: () => 'bad id'}), 'korean-to-roman')).status, 'blocked');
    assert.equal((await captureRomanizationB083(f.document, f.context, provider({convert: () => { throw new Error('offline failure'); }}), 'korean-to-roman')).status, 'blocked');
    for (const candidates of [[], ['same', 'same'], ['bad\nvalue'], Array.from({length: 17}, (_, index) => `v${index}`)]) {
      const result = await captureRomanizationB083(f.document, f.context, provider({convert: request => ({
        providerId: 'offline-test-dictionary', version: '2026.11', requestFingerprint: request.requestFingerprint, candidates,
      })}), 'korean-to-roman');
      assert.deepEqual(result, {status: 'blocked', reason: 'invalid-response'});
    }
    const wrongSeal = await captureRomanizationB083(f.document, f.context, provider({convert: () => ({
      providerId: 'offline-test-dictionary', version: '2026.11', requestFingerprint: '0'.repeat(64), candidates: ['Hanguk'],
    })}), 'korean-to-roman');
    assert.deepEqual(wrongSeal, {status: 'blocked', reason: 'invalid-response'});
  } finally { f.document.free(); }
});

test('B083 blocks protected, non-body, malformed and every stale seal before snapshot', async () => {
  for (const stale of ['identity', 'revision', 'selection', 'source', 'provider', 'plan'] as const) {
    const f = fixture();
    try {
      const captured = await captureRomanizationB083(f.document, f.context, provider(), 'korean-to-roman');
      assert.equal(captured.status, 'ready'); if (captured.status !== 'ready') continue;
      if (stale === 'identity') f.setIdentity('other-document');
      if (stale === 'revision') f.setRevision('other-revision');
      if (stale === 'selection') f.setSelection({sectionIndex: 0, paragraphIndex: 0, startOffset: 0, endOffset: 1});
      let snapshots = 0;
      const host = new Proxy(f.document, {get(target, key) {
        if (key === 'saveSnapshot') return () => { snapshots += 1; return target.saveSnapshot(); };
        if (stale === 'source' && key === 'getTextRange') return () => '다른';
        const value = Reflect.get(target, key, target); return typeof value === 'function' ? value.bind(target) : value;
      }});
      const plan = stale === 'plan' ? {...captured.plan, candidates: ['forged']} : captured.plan;
      const result = applyRomanizationB083(host, f.context,
        stale === 'provider' ? provider({version: () => '2027.1'}) : provider(), plan, 0);
      assert.equal(result.status, 'blocked', stale); assert.equal(snapshots, 0, stale);
    } finally { f.document.free(); }
  }
  const f = fixture();
  try {
    f.setStory('header'); assert.equal((await captureRomanizationB083(f.document, f.context, provider(), 'korean-to-roman')).status, 'blocked');
    f.setStory('body'); f.setProtected(true); assert.equal((await captureRomanizationB083(f.document, f.context, provider(), 'korean-to-roman')).status, 'blocked');
    f.setProtected(false); f.setSelection({sectionIndex: 0, paragraphIndex: 0, startOffset: 0, endOffset: 0});
    assert.equal((await captureRomanizationB083(f.document, f.context, provider(), 'korean-to-roman')).status, 'blocked');
  } finally { f.document.free(); }
});

test('B083 restores exact bytes when replacement is rejected after snapshot', async () => {
  const f = fixture();
  try {
    const captured = await captureRomanizationB083(f.document, f.context, provider(), 'korean-to-roman');
    assert.equal(captured.status, 'ready'); if (captured.status !== 'ready') return;
    const beforeHwp = f.document.exportHwp(), beforeHwpx = f.document.exportHwpx();
    const host = new Proxy(f.document, {get(target, key) {
      if (key === 'replaceText') return () => '{"ok":false}';
      const value = Reflect.get(target, key, target); return typeof value === 'function' ? value.bind(target) : value;
    }});
    assert.deepEqual(applyRomanizationB083(host, f.context, provider(), captured.plan, 0),
      {status: 'blocked', reason: 'verification-failed'});
    assert.deepEqual(f.document.exportHwp(), beforeHwp); assert.deepEqual(f.document.exportHwpx(), beforeHwpx);
  } finally { f.document.free(); }
});
