import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import init, {HwpDocument} from '../node_modules/@rhwp/core/rhwp.js';
import {
  applyLicenseMarkB016,
  captureLicenseMarkB016,
  licenseMarkKindsB016,
  licenseMarkTextB016,
  type LicenseMarkContextB016,
  type LicenseMarkSelectionB016,
} from '../src/adapters/rhwp/license-mark-b016.ts';

await init({module_or_path: await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm', import.meta.url))});

const digest = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const position = (offset: number): LicenseMarkSelectionB016 => ({
  start: {sectionIndex: 0, paragraphIndex: 0, charOffset: offset},
  end: {sectionIndex: 0, paragraphIndex: 0, charOffset: offset},
});

function fixture(text = '공공 문서\n') {
  const document = HwpDocument.createEmpty();
  document.createBlankDocument();
  document.insertText(0, 0, 0, text);
  let identity = 'document-b016', selection: unknown = position(Array.from(text).length);
  let story = 'body', editable = true, protectedDocument = false;
  const context: LicenseMarkContextB016 = {
    documentIdentity: () => identity,
    revision: () => digest(document.exportHwp()),
    story: () => story,
    editable: () => editable,
    protected: () => protectedDocument,
    selection: () => selection,
  };
  return {
    document, context,
    setIdentity(value: string) { identity = value; },
    setSelection(value: unknown) { selection = value; },
    setStory(value: string) { story = value; },
    setEditable(value: boolean) { editable = value; },
    setProtected(value: boolean) { protectedDocument = value; },
  };
}

test('B016 exposes only ten bounded offline text marks without control characters or external resources', () => {
  const kinds = licenseMarkKindsB016();
  assert.equal(kinds.length, 10);
  assert.equal(new Set(kinds).size, kinds.length);
  for (const kind of kinds) {
    const text = licenseMarkTextB016(kind);
    assert.match(text, /^\[(?:CC|공공누리)/u);
    assert.doesNotMatch(text, /[\p{Cc}]|https?:|<img|data:/u);
    assert.ok(Array.from(text).length <= 256);
  }
});

test('B016 inserts one explicit public-license text mark with one snapshot and exactly undo/redoes both formats', () => {
  const f = fixture();
  try {
    let snapshots = 0;
    const host = new Proxy(f.document, {get(target, key) {
      if (key === 'saveSnapshot') return () => { snapshots += 1; return target.saveSnapshot(); };
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    }});
    const beforeHwp = f.document.exportHwp(), beforeHwpx = f.document.exportHwpx();
    const captured = captureLicenseMarkB016(host, f.context, 'kogl-type-1');
    assert.equal(captured.status, 'ready');
    if (captured.status !== 'ready') return;
    const applied = applyLicenseMarkB016(host, f.context, captured.plan);
    assert.equal(applied.status, 'applied');
    if (applied.status !== 'applied') return;
    assert.equal(snapshots, 1);
    const expected = `공공 문서\n${licenseMarkTextB016('kogl-type-1')}`;
    assert.equal(f.document.getTextRange(0, 0, 0, 1000), expected);
    const afterHwp = f.document.exportHwp(), afterHwpx = f.document.exportHwpx();
    for (const bytes of [afterHwp, afterHwpx]) {
      const reopened = new HwpDocument(bytes);
      try { assert.equal(reopened.getTextRange(0, 0, 0, 1000), expected); }
      finally { reopened.free(); }
    }
    assert.deepEqual(applied.command.undo(), {status: 'restored', text: ''});
    assert.deepEqual(f.document.exportHwp(), beforeHwp);
    assert.deepEqual(f.document.exportHwpx(), beforeHwpx);
    assert.deepEqual(applied.command.redo(), {status: 'restored', text: licenseMarkTextB016('kogl-type-1')});
    assert.deepEqual(f.document.exportHwp(), afterHwp);
    assert.deepEqual(f.document.exportHwpx(), afterHwpx);
    assert.equal(snapshots, 1);
    applied.command.dispose();
  } finally { f.document.free(); }
});

test('B016 blocks logo requests, range/nested selections, protected stories, and every stale seal before a snapshot', () => {
  const base = fixture();
  try {
    let snapshots = 0;
    const host = new Proxy(base.document, {get(target, key) {
      if (key === 'saveSnapshot') return () => { snapshots += 1; return target.saveSnapshot(); };
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    }});
    assert.deepEqual(captureLicenseMarkB016(host, base.context, 'ccl-logo-by'), {status: 'blocked', reason: 'unsupported-license'});
    base.setSelection({start: position(0).start, end: position(1).end});
    assert.deepEqual(captureLicenseMarkB016(host, base.context, 'ccl-by'), {status: 'blocked', reason: 'unsupported-selection'});
    base.setSelection({start: {...position(0).start, path: ['cell', 0]}, end: position(0).end});
    assert.deepEqual(captureLicenseMarkB016(host, base.context, 'ccl-by'), {status: 'blocked', reason: 'unsupported-selection'});
    base.setSelection(position(0)); base.setStory('header');
    assert.deepEqual(captureLicenseMarkB016(host, base.context, 'ccl-by'), {status: 'blocked', reason: 'unsupported-story'});
    base.setStory('body'); base.setProtected(true);
    assert.deepEqual(captureLicenseMarkB016(host, base.context, 'ccl-by'), {status: 'blocked', reason: 'protected-document'});
    assert.equal(snapshots, 0);
  } finally { base.document.free(); }

  for (const stale of ['identity', 'revision', 'selection', 'original'] as const) {
    const f = fixture();
    try {
      let snapshots = 0, fakeRevision: string | undefined;
      const context = new Proxy(f.context, {get(target, key) {
        if (key === 'revision' && fakeRevision) return () => fakeRevision;
        return Reflect.get(target, key, target);
      }});
      const captured = captureLicenseMarkB016(f.document, context, 'ccl-by-sa');
      assert.equal(captured.status, 'ready');
      if (captured.status !== 'ready') continue;
      if (stale === 'identity') f.setIdentity('other-document');
      if (stale === 'revision') fakeRevision = 'other-revision';
      if (stale === 'selection') f.setSelection(position(0));
      const host = new Proxy(f.document, {get(target, key) {
        if (key === 'saveSnapshot') return () => { snapshots += 1; return target.saveSnapshot(); };
        if (stale === 'original' && key === 'getTextRange') return () => 'changed';
        const value = Reflect.get(target, key, target);
        return typeof value === 'function' ? value.bind(target) : value;
      }});
      assert.equal(applyLicenseMarkB016(host, context, captured.plan).status, 'blocked');
      assert.equal(snapshots, 0, stale);
    } finally { f.document.free(); }
  }
});

test('B016 restores exact HWP/HWPX bytes when the engine rejects insertion', () => {
  const f = fixture();
  try {
    const captured = captureLicenseMarkB016(f.document, f.context, 'ccl-by-nc-nd');
    assert.equal(captured.status, 'ready');
    if (captured.status !== 'ready') return;
    const beforeHwp = f.document.exportHwp(), beforeHwpx = f.document.exportHwpx();
    const host = new Proxy(f.document, {get(target, key) {
      if (key === 'insertText') return () => '{"ok":false}';
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    }});
    assert.deepEqual(applyLicenseMarkB016(host, f.context, captured.plan), {status: 'blocked', reason: 'verification-failed'});
    assert.deepEqual(f.document.exportHwp(), beforeHwp);
    assert.deepEqual(f.document.exportHwpx(), beforeHwpx);
  } finally { f.document.free(); }
});
