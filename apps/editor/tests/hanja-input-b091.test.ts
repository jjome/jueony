import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import init, {HwpDocument} from '../node_modules/@rhwp/core/rhwp.js';
import {
  applyHanjaInputB091,
  captureHanjaInputB091,
  type HanjaInputContextB091,
  type OfflineHanjaProviderB091,
} from '../src/adapters/rhwp/hanja-input-b091.ts';

await init({module_or_path: await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm', import.meta.url))});
const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const text = (document: HwpDocument) => document.getTextRange(0, 0, 0, document.getParagraphLength(0, 0));
const provider = (lookup: OfflineHanjaProviderB091['lookup']): OfflineHanjaProviderB091 =>
  ({id: 'test-hanja', version: '2026.11', offline: true, lookup});

function fixture(source = '오늘 학교에 간다') {
  const document = HwpDocument.createEmpty(); document.createBlankDocument(); document.insertText(0, 0, 0, source);
  let identity = 'document-b091', story = 'body', editable = true, protectedDocument = false;
  let selection: unknown = {sectionIndex: 0, paragraphIndex: 0, startOffset: 3, endOffset: 5};
  let revisionOverride: string | undefined;
  const context: HanjaInputContextB091 = {
    documentIdentity: () => identity, revision: () => revisionOverride ?? digest(document.exportHwp()),
    story: () => story, editable: () => editable, protected: () => protectedDocument, selection: () => selection,
  };
  return {document, context, setIdentity(value: string) { identity = value; }, setStory(value: string) { story = value; },
    setProtected(value: boolean) { protectedDocument = value; }, setEditable(value: boolean) { editable = value; },
    setSelection(value: unknown) { selection = value; }, setRevision(value: string | undefined) { revisionOverride = value; }};
}

test('B091 applies one chosen offline Hanja candidate with exact HWP/HWPX undo and redo', async () => {
  const f = fixture();
  try {
    let snapshots = 0, requestText = '';
    const host = new Proxy(f.document, {get(target, key) {
      if (key === 'saveSnapshot') return () => { snapshots += 1; return target.saveSnapshot(); };
      const value = Reflect.get(target, key, target); return typeof value === 'function' ? value.bind(target) : value;
    }});
    const sourceProvider = provider(request => { requestText = request.text; return [
      {id: 'school', text: '學校', reading: '학교', meaning: '배우는 곳'},
      {id: 'academy', text: '學敎', reading: '학교'},
    ]; });
    const beforeHwp = f.document.exportHwp(), beforeHwpx = f.document.exportHwpx();
    const captured = await captureHanjaInputB091(host, f.context, sourceProvider);
    assert.equal(captured.status, 'ready'); assert.equal(requestText, '학교'); if (captured.status !== 'ready') return;
    const applied = applyHanjaInputB091(host, f.context, captured.plan, 'school');
    assert.equal(applied.status, 'applied'); if (applied.status !== 'applied') return;
    assert.equal(snapshots, 1); assert.equal(text(f.document), '오늘 學校에 간다');
    const afterHwp = f.document.exportHwp(), afterHwpx = f.document.exportHwpx();
    for (const bytes of [afterHwp, afterHwpx]) {
      const reopened = new HwpDocument(bytes); try { assert.equal(text(reopened), '오늘 學校에 간다'); } finally { reopened.free(); }
    }
    assert.equal(applied.command.undo().status, 'restored');
    assert.deepEqual(f.document.exportHwp(), beforeHwp); assert.deepEqual(f.document.exportHwpx(), beforeHwpx);
    assert.equal(applied.command.redo().status, 'restored');
    assert.deepEqual(f.document.exportHwp(), afterHwp); assert.deepEqual(f.document.exportHwpx(), afterHwpx);
    applied.command.dispose();
  } finally { f.document.free(); }
});

test('B091 rejects online, malformed, duplicate and unsafe candidate providers', async () => {
  const invalid: unknown[] = [
    {id: 'network', version: '1', offline: false, lookup: () => []},
    provider(() => []),
    provider(() => [{id: 'one', text: '학교'}]),
    provider(() => [{id: 'one', text: '學校'}, {id: 'one', text: '學敎'}]),
    provider(() => [{id: 'one', text: '學校'}, {id: 'two', text: '學校'}]),
    provider(() => [{id: 'one', text: '學\n校'}]),
  ];
  for (const value of invalid) {
    const f = fixture();
    try { assert.equal((await captureHanjaInputB091(f.document, f.context, value)).status, 'blocked'); }
    finally { f.document.free(); }
  }
});

test('B091 rejects protected/special/mixed and every stale seal before snapshot', async () => {
  const f = fixture(), dictionary = provider(() => [{id: 'school', text: '學校'}]);
  try {
    let snapshots = 0;
    const host = new Proxy(f.document, {get(target, key) {
      if (key === 'saveSnapshot') return () => { snapshots += 1; return target.saveSnapshot(); };
      const value = Reflect.get(target, key, target); return typeof value === 'function' ? value.bind(target) : value;
    }});
    f.setStory('header'); assert.equal((await captureHanjaInputB091(host, f.context, dictionary)).status, 'blocked');
    f.setStory('body'); f.setProtected(true); assert.equal((await captureHanjaInputB091(host, f.context, dictionary)).status, 'blocked');
    f.setProtected(false); f.setSelection({sectionIndex: 0, paragraphIndex: 0, startOffset: 3, endOffset: 3});
    assert.equal((await captureHanjaInputB091(host, f.context, dictionary)).status, 'blocked');
    f.setSelection({sectionIndex: 0, paragraphIndex: 0, startOffset: 3, endOffset: 5});
    const captured = await captureHanjaInputB091(host, f.context, dictionary);
    assert.equal(captured.status, 'ready'); if (captured.status !== 'ready') return;
    for (const stale of ['identity', 'revision', 'selection', 'source', 'plan', 'candidate'] as const) {
      const beforeIdentity = stale === 'identity' ? 'other-document' : 'document-b091'; f.setIdentity(beforeIdentity);
      f.setRevision(stale === 'revision' ? 'other-revision' : undefined);
      f.setSelection(stale === 'selection' ? {sectionIndex: 0, paragraphIndex: 0, startOffset: 0, endOffset: 2}
        : {sectionIndex: 0, paragraphIndex: 0, startOffset: 3, endOffset: 5});
      const callHost = stale === 'source' ? new Proxy(host, {get(target, key) {
        if (key === 'getTextRange') return () => '다름'; return Reflect.get(target, key, target);
      }}) : host;
      const plan = stale === 'plan' ? {...captured.plan, providerVersion: 'forged'} : captured.plan;
      const result = applyHanjaInputB091(callHost, f.context, plan, stale === 'candidate' ? 'missing' : 'school');
      assert.equal(result.status, 'blocked', stale);
    }
    assert.equal(snapshots, 0);
  } finally { f.document.free(); }
});

test('B091 provider-time staleness and rejected writes leave both formats unchanged', async () => {
  const f = fixture();
  try {
    const staleProvider = provider(() => { f.setRevision('changed-during-provider'); return [{id: 'school', text: '學校'}]; });
    assert.deepEqual(await captureHanjaInputB091(f.document, f.context, staleProvider), {status: 'blocked', reason: 'stale-document'});
    f.setRevision(undefined);
    const captured = await captureHanjaInputB091(f.document, f.context, provider(() => [{id: 'school', text: '學校'}]));
    assert.equal(captured.status, 'ready'); if (captured.status !== 'ready') return;
    const beforeHwp = f.document.exportHwp(), beforeHwpx = f.document.exportHwpx();
    const host = new Proxy(f.document, {get(target, key) {
      if (key === 'replaceText') return () => '{"ok":false}';
      const value = Reflect.get(target, key, target); return typeof value === 'function' ? value.bind(target) : value;
    }});
    assert.deepEqual(applyHanjaInputB091(host, f.context, captured.plan, 'school'),
      {status: 'blocked', reason: 'verification-failed'});
    assert.deepEqual(f.document.exportHwp(), beforeHwp); assert.deepEqual(f.document.exportHwpx(), beforeHwpx);
  } finally { f.document.free(); }
});
