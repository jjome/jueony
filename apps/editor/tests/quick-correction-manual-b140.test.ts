import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import init, {HwpDocument} from '../node_modules/@rhwp/core/rhwp.js';
import {
  applyQuickCorrectionB140,
  captureQuickCorrectionB140,
  type BodySelectionB140,
  type QuickCorrectionContextB140,
} from '../src/adapters/rhwp/quick-correction-manual-b140.ts';

await init({module_or_path: await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm', import.meta.url))});

const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const body = (document: HwpDocument) => document.getTextRange(0, 0, 0, 1000);
const range = (start: number, end: number): BodySelectionB140 => ({
  start: {sectionIndex: 0, paragraphIndex: 0, charOffset: start},
  end: {sectionIndex: 0, paragraphIndex: 0, charOffset: end},
});

function fixture(text = '이 문장은 됬다.') {
  const document = HwpDocument.createEmpty();
  document.createBlankDocument();
  document.insertText(0, 0, 0, text);
  let currentSelection: unknown = range(6, 8), identity = 'document-b140', story = 'body', editable = true, protectedDocument = false;
  const context: QuickCorrectionContextB140 = {
    documentIdentity: () => identity,
    revision: () => digest(document.exportHwp()),
    story: () => story,
    editable: () => editable,
    protected: () => protectedDocument,
    selection: () => currentSelection,
  };
  return {
    document, context,
    setSelection(value: unknown) { currentSelection = value; },
    setIdentity(value: string) { identity = value; },
    setStory(value: string) { story = value; },
    setProtected(value: boolean) { protectedDocument = value; },
    setEditable(value: boolean) { editable = value; },
  };
}

test('B140 manually applies one explicit rule with one snapshot, survives both formats, and exactly undo/redoes', () => {
  const f = fixture(), rules = [{from: '됬다', to: '됐다'}];
  try {
    let snapshots = 0;
    const host = new Proxy(f.document, {get(target, key) {
      if (key === 'saveSnapshot') return () => { snapshots++; return target.saveSnapshot(); };
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    }});
    const beforeHwp = f.document.exportHwp(), beforeHwpx = f.document.exportHwpx();
    const captured = captureQuickCorrectionB140(host, f.context, rules);
    assert.equal(captured.status, 'ready');
    if (captured.status !== 'ready') return;
    const applied = applyQuickCorrectionB140(host, f.context, captured.plan, rules);
    assert.equal(applied.status, 'applied');
    if (applied.status !== 'applied') return;
    assert.equal(snapshots, 1);
    assert.equal(body(f.document), '이 문장은 됐다.');
    const afterHwp = f.document.exportHwp(), afterHwpx = f.document.exportHwpx();
    for (const bytes of [afterHwp, afterHwpx]) {
      const reopened = new HwpDocument(bytes);
      try { assert.equal(body(reopened), '이 문장은 됐다.'); } finally { reopened.free(); }
    }

    assert.deepEqual(applied.command.undo(), {status: 'restored', text: '됬다'});
    assert.deepEqual(f.document.exportHwp(), beforeHwp);
    assert.deepEqual(f.document.exportHwpx(), beforeHwpx);
    assert.deepEqual(applied.command.redo(), {status: 'restored', text: '됐다'});
    assert.deepEqual(f.document.exportHwp(), afterHwp);
    assert.deepEqual(f.document.exportHwpx(), afterHwpx);
    assert.equal(snapshots, 1, 'redo must reuse the original snapshot contract');
    applied.command.dispose();
  } finally { f.document.free(); }
});

test('B140 rejects duplicate/cyclic/control rules, protected/non-body and mixed selections before a snapshot', () => {
  const f = fixture();
  try {
    let snapshots = 0;
    const host = new Proxy(f.document, {get(target, key) {
      if (key === 'saveSnapshot') return () => { snapshots++; return target.saveSnapshot(); };
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    }});
    for (const rules of [
      [{from: '됬다', to: '됐다'}, {from: '됬다', to: '되었다'}],
      [{from: '가', to: '나'}, {from: '나', to: '가'}],
      [{from: '됬다', to: '됐\n다'}],
    ]) assert.deepEqual(captureQuickCorrectionB140(host, f.context, rules), {status: 'blocked', reason: 'invalid-rules'});
    f.setStory('header');
    assert.deepEqual(captureQuickCorrectionB140(host, f.context, [{from: '됬다', to: '됐다'}]), {status: 'blocked', reason: 'unsupported-story'});
    f.setStory('body'); f.setProtected(true);
    assert.deepEqual(captureQuickCorrectionB140(host, f.context, [{from: '됬다', to: '됐다'}]), {status: 'blocked', reason: 'protected-document'});
    f.setProtected(false); f.setSelection({start: range(6, 8).start, end: {sectionIndex: 0, paragraphIndex: 1, charOffset: 0}});
    assert.deepEqual(captureQuickCorrectionB140(host, f.context, [{from: '됬다', to: '됐다'}]), {status: 'blocked', reason: 'mixed-selection'});
    f.setSelection({start: {...range(6, 8).start, path: ['cell', 0]}, end: range(6, 8).end});
    assert.deepEqual(captureQuickCorrectionB140(host, f.context, [{from: '됬다', to: '됐다'}]), {status: 'blocked', reason: 'mixed-selection'});
    assert.equal(snapshots, 0);
  } finally { f.document.free(); }
});

test('B140 rechecks identity, revision, selection, original text and rule fingerprint before mutation', () => {
  const rules = [{from: '됬다', to: '됐다'}];
  for (const stale of ['identity', 'revision', 'selection', 'original', 'rules'] as const) {
    const f = fixture();
    try {
      let snapshots = 0, forgedRevision: string | undefined;
      const context = new Proxy(f.context, {get(target, key) {
        if (key === 'revision' && forgedRevision !== undefined) return () => forgedRevision;
        return Reflect.get(target, key, target);
      }});
      const captured = captureQuickCorrectionB140(f.document, context, rules);
      assert.equal(captured.status, 'ready');
      if (captured.status !== 'ready') continue;
      if (stale === 'identity') f.setIdentity('other-document');
      if (stale === 'revision') forgedRevision = 'other-revision';
      if (stale === 'selection') f.setSelection(range(0, 1));
      const host = new Proxy(f.document, {get(target, key) {
        if (key === 'saveSnapshot') return () => { snapshots++; return target.saveSnapshot(); };
        if (stale === 'original' && key === 'getTextRange') return () => '다른 원문';
        const value = Reflect.get(target, key, target);
        return typeof value === 'function' ? value.bind(target) : value;
      }});
      const result = applyQuickCorrectionB140(host, context, captured.plan,
        stale === 'rules' ? [{from: '됬다', to: '되었다'}] : rules);
      assert.equal(result.status, 'blocked', stale);
      assert.equal(snapshots, 0, stale);
      assert.equal(body(f.document), '이 문장은 됬다.');
    } finally { f.document.free(); }
  }
});

test('B140 restores exact bytes when insertion fails after deletion', () => {
  const f = fixture(), rules = [{from: '됬다', to: '됐다'}];
  try {
    const captured = captureQuickCorrectionB140(f.document, f.context, rules);
    assert.equal(captured.status, 'ready');
    if (captured.status !== 'ready') return;
    const beforeHwp = f.document.exportHwp(), beforeHwpx = f.document.exportHwpx();
    const host = new Proxy(f.document, {get(target, key) {
      if (key === 'insertText') return () => '{"ok":false}';
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    }});
    assert.deepEqual(applyQuickCorrectionB140(host, f.context, captured.plan, rules),
      {status: 'blocked', reason: 'verification-failed'});
    assert.deepEqual(f.document.exportHwp(), beforeHwp);
    assert.deepEqual(f.document.exportHwpx(), beforeHwpx);
  } finally { f.document.free(); }
});
