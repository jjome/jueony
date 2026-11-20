import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import init, {HwpDocument} from '../node_modules/@rhwp/core/rhwp.js';
import {
  applyPersonalInfoConversionB146,
  capturePersonalInfoConversionB146,
  type PersonalInfoContextB146,
  type PersonalInfoSelectionB146,
} from '../src/adapters/rhwp/personal-info-conversion-b146.ts';

await init({module_or_path: await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm', import.meta.url))});
const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const allText = (document: HwpDocument) => document.getTextRange(0, 0, 0, document.getParagraphLength(0, 0));

function fixture(text: string) {
  const document = HwpDocument.createEmpty(); document.createBlankDocument(); document.insertText(0, 0, 0, text);
  let selection: unknown = {sectionIndex: 0, paragraphIndex: 0, startOffset: 0, endOffset: Array.from(text).length};
  let identity = 'document-b146', story = 'body', editable = true, protectedDocument = false, revisionOverride: string | undefined;
  const context: PersonalInfoContextB146 = {
    documentIdentity: () => identity,
    revision: () => revisionOverride ?? digest(document.exportHwp()),
    story: () => story, editable: () => editable, protected: () => protectedDocument, selection: () => selection,
  };
  return {document, context, setSelection(value: unknown) { selection = value; }, setIdentity(value: string) { identity = value; },
    setStory(value: string) { story = value; }, setProtected(value: boolean) { protectedDocument = value; },
    setEditable(value: boolean) { editable = value; }, setRevision(value: string | undefined) { revisionOverride = value; }};
}

test('B146 masks selected resident number, phone and email with one snapshot and exact undo/redo', () => {
  const source = '주민 900101-1234567 전화 010-1234-5678 메일 user.name@example.go.kr';
  const f = fixture(source);
  try {
    let snapshots = 0;
    const host = new Proxy(f.document, {get(target, key) {
      if (key === 'saveSnapshot') return () => { snapshots += 1; return target.saveSnapshot(); };
      const value = Reflect.get(target, key, target); return typeof value === 'function' ? value.bind(target) : value;
    }});
    const beforeHwp = f.document.exportHwp(), beforeHwpx = f.document.exportHwpx();
    const captured = capturePersonalInfoConversionB146(host, f.context, ['email', 'phone', 'resident-registration-number']);
    assert.equal(captured.status, 'ready'); if (captured.status !== 'ready') return;
    const applied = applyPersonalInfoConversionB146(host, f.context, captured.plan);
    assert.equal(applied.status, 'applied'); if (applied.status !== 'applied') return;
    assert.equal(snapshots, 1);
    assert.equal(allText(f.document), '주민 ******-******* 전화 ***-****-5678 메일 *********@example.go.kr');
    const afterHwp = f.document.exportHwp(), afterHwpx = f.document.exportHwpx();
    for (const bytes of [afterHwp, afterHwpx]) {
      const reopened = new HwpDocument(bytes); try { assert.equal(allText(reopened), allText(f.document)); } finally { reopened.free(); }
    }
    assert.equal(applied.command.undo().status, 'restored');
    assert.deepEqual(f.document.exportHwp(), beforeHwp); assert.deepEqual(f.document.exportHwpx(), beforeHwpx);
    assert.equal(applied.command.redo().status, 'restored');
    assert.deepEqual(f.document.exportHwp(), afterHwp); assert.deepEqual(f.document.exportHwpx(), afterHwpx);
    applied.command.dispose();
  } finally { f.document.free(); }
});

test('B146 preserves separators and final four phone digits without changing scalar length', () => {
  for (const [source, expected] of [['01012345678', '*******5678'], ['02 123 4567', '** *** 4567'], ['031-1234-5678', '***-****-5678']]) {
    const f = fixture(source);
    try {
      const captured = capturePersonalInfoConversionB146(f.document, f.context, ['phone']);
      assert.equal(captured.status, 'ready'); if (captured.status !== 'ready') continue;
      assert.equal(captured.plan.replacementText, expected);
      assert.equal(Array.from(captured.plan.originalText).length, Array.from(captured.plan.replacementText).length);
    } finally { f.document.free(); }
  }
});

test('B146 rejects malformed policies and unsafe contexts before snapshot', () => {
  const f = fixture('010-1234-5678');
  try {
    let snapshots = 0;
    const host = new Proxy(f.document, {get(target, key) {
      if (key === 'saveSnapshot') return () => { snapshots += 1; return target.saveSnapshot(); };
      const value = Reflect.get(target, key, target); return typeof value === 'function' ? value.bind(target) : value;
    }});
    assert.equal(capturePersonalInfoConversionB146(host, f.context, []).status, 'blocked');
    assert.equal(capturePersonalInfoConversionB146(host, f.context, ['phone', 'phone']).status, 'blocked');
    assert.equal(capturePersonalInfoConversionB146(host, f.context, ['unknown']).status, 'blocked');
    f.setStory('header'); assert.equal(capturePersonalInfoConversionB146(host, f.context, ['phone']).status, 'blocked');
    f.setStory('body'); f.setProtected(true); assert.equal(capturePersonalInfoConversionB146(host, f.context, ['phone']).status, 'blocked');
    f.setProtected(false); f.setSelection({sectionIndex: 0, paragraphIndex: 0, startOffset: 0, endOffset: 0});
    assert.equal(capturePersonalInfoConversionB146(host, f.context, ['phone']).status, 'blocked');
    assert.equal(snapshots, 0);
  } finally { f.document.free(); }
});

test('B146 rejects stale document, selection, source and forged plan before mutation and rolls back rejected writes', () => {
  const source = '연락처 010-1234-5678';
  for (const stale of ['identity', 'revision', 'selection', 'source', 'plan', 'write'] as const) {
    const f = fixture(source);
    try {
      const captured = capturePersonalInfoConversionB146(f.document, f.context, ['phone']);
      assert.equal(captured.status, 'ready'); if (captured.status !== 'ready') continue;
      if (stale === 'identity') f.setIdentity('other-document');
      if (stale === 'revision') f.setRevision('other-revision');
      if (stale === 'selection') f.setSelection({sectionIndex: 0, paragraphIndex: 0, startOffset: 0, endOffset: 4});
      let snapshots = 0;
      const host = new Proxy(f.document, {get(target, key) {
        if (key === 'saveSnapshot') return () => { snapshots += 1; return target.saveSnapshot(); };
        if (stale === 'source' && key === 'getTextRange') return () => '다른 원문';
        if (stale === 'write' && key === 'replaceText') return () => '{"ok":false}';
        const value = Reflect.get(target, key, target); return typeof value === 'function' ? value.bind(target) : value;
      }});
      const plan = stale === 'plan' ? {...captured.plan, replacementText: '위조'} : captured.plan;
      const beforeHwp = f.document.exportHwp(), beforeHwpx = f.document.exportHwpx();
      const result = applyPersonalInfoConversionB146(host, f.context, plan);
      assert.equal(result.status, 'blocked', stale);
      assert.deepEqual(f.document.exportHwp(), beforeHwp); assert.deepEqual(f.document.exportHwpx(), beforeHwpx);
      assert.equal(snapshots, stale === 'write' ? 1 : 0, stale);
    } finally { f.document.free(); }
  }
});
