import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import init, {HwpDocument} from '../node_modules/@rhwp/core/rhwp.js';
import {
  applyBibliographyB144,
  captureBibliographyB144,
  createBibliographyRegistryB144,
  formatBibliographyB144,
  type BibliographyContextB144,
} from '../src/adapters/rhwp/bibliography-b144.ts';

await init({module_or_path: await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm', import.meta.url))});
const digest = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const source = {id: 'gov-writing-2024', authors: ['홍길동', '김영희'], year: 2024,
  title: '행정문서 작성법', publisher: '공공출판사'} as const;

function registry(extra: readonly unknown[] = []) {
  const value = createBibliographyRegistryB144([source, ...extra]);
  assert.ok(value); return value;
}

function point(offset: number) {
  return {start: {sectionIndex: 0, paragraphIndex: 0, charOffset: offset},
    end: {sectionIndex: 0, paragraphIndex: 0, charOffset: offset}};
}

function fixture(text = '올해 계획') {
  const document = HwpDocument.createEmpty(); document.createBlankDocument(); document.insertText(0, 0, 0, text);
  let identity = 'document-b144', selection: unknown = point(Array.from(text).length), story = 'body';
  let editable = true, protectedDocument = false, revisionOverride: string | undefined;
  const context: BibliographyContextB144 = {
    documentIdentity: () => identity, revision: () => revisionOverride ?? digest(document.exportHwp()),
    story: () => story, editable: () => editable, protected: () => protectedDocument, selection: () => selection,
  };
  return {document, context, setIdentity(value: string) { identity = value; }, setSelection(value: unknown) { selection = value; },
    setStory(value: string) { story = value; }, setEditable(value: boolean) { editable = value; },
    setProtected(value: boolean) { protectedDocument = value; }, setRevision(value?: string) { revisionOverride = value; }};
}

test('B144 validates a bounded local registry and exposes only the documented Korean author-year style', () => {
  const created = registry([{id: 'later', authors: ['박민수'], year: 2025, title: '후속 보고서'}]);
  assert.deepEqual(created.list().map(item => item.id), ['gov-writing-2024', 'later']);
  assert.equal(formatBibliographyB144(source, 'citation'), '(홍길동·김영희, 2024)');
  assert.equal(formatBibliographyB144(source, 'bibliography'), '홍길동·김영희. (2024). 행정문서 작성법. 공공출판사.');
  assert.equal(createBibliographyRegistryB144([]), undefined);
  assert.equal(createBibliographyRegistryB144([source, source]), undefined);
  assert.equal(createBibliographyRegistryB144([{...source, title: '잘못된\n제목'}]), undefined);
  assert.equal(createBibliographyRegistryB144([{...source, year: 24}]), undefined);
  assert.equal(createBibliographyRegistryB144([{...source, authors: []}]), undefined);
});

test('B144 inserts one static citation with one snapshot and exactly undo/redoes HWP and HWPX', () => {
  const f = fixture();
  try {
    let snapshots = 0;
    const host = new Proxy(f.document, {get(target, key) {
      if (key === 'saveSnapshot') return () => { snapshots += 1; return target.saveSnapshot(); };
      const value = Reflect.get(target, key, target); return typeof value === 'function' ? value.bind(target) : value;
    }});
    const beforeHwp = f.document.exportHwp(), beforeHwpx = f.document.exportHwpx();
    const captured = captureBibliographyB144(host, f.context, registry(), source.id, 'citation');
    assert.equal(captured.status, 'ready'); if (captured.status !== 'ready') return;
    const applied = applyBibliographyB144(host, f.context, registry(), captured.plan);
    assert.equal(applied.status, 'applied'); if (applied.status !== 'applied') return;
    assert.equal(snapshots, 1); assert.equal(f.document.getTextRange(0, 0, 0, 100), `올해 계획${applied.text}`);
    const afterHwp = f.document.exportHwp(), afterHwpx = f.document.exportHwpx();
    for (const bytes of [afterHwp, afterHwpx]) {
      const reopened = new HwpDocument(bytes); try {
        assert.equal(reopened.getTextRange(0, 0, 0, reopened.getParagraphLength(0, 0)), `올해 계획${applied.text}`);
      } finally { reopened.free(); }
    }
    assert.equal(applied.command.undo().status, 'restored');
    assert.deepEqual(f.document.exportHwp(), beforeHwp); assert.deepEqual(f.document.exportHwpx(), beforeHwpx);
    assert.equal(applied.command.redo().status, 'restored');
    assert.deepEqual(f.document.exportHwp(), afterHwp); assert.deepEqual(f.document.exportHwpx(), afterHwpx);
    assert.equal(snapshots, 1); applied.command.dispose();
  } finally { f.document.free(); }
});

test('B144 inserts one bibliography entry as a new paragraph and reopens both formats', () => {
  const f = fixture();
  try {
    const beforeHwp = f.document.exportHwp(), beforeHwpx = f.document.exportHwpx();
    const captured = captureBibliographyB144(f.document, f.context, registry(), source.id, 'bibliography');
    assert.equal(captured.status, 'ready'); if (captured.status !== 'ready') return;
    const applied = applyBibliographyB144(f.document, f.context, registry(), captured.plan);
    assert.equal(applied.status, 'applied'); if (applied.status !== 'applied') return;
    assert.equal(f.document.getParagraphCount(0), 2);
    assert.equal(f.document.getTextRange(0, 1, 0, f.document.getParagraphLength(0, 1)), applied.text);
    const afterHwp = f.document.exportHwp(), afterHwpx = f.document.exportHwpx();
    for (const bytes of [afterHwp, afterHwpx]) {
      const reopened = new HwpDocument(bytes); try {
        assert.equal(reopened.getParagraphCount(0), 2);
        assert.equal(reopened.getTextRange(0, 1, 0, reopened.getParagraphLength(0, 1)), applied.text);
      } finally { reopened.free(); }
    }
    assert.equal(applied.command.undo().status, 'restored');
    assert.deepEqual(f.document.exportHwp(), beforeHwp); assert.deepEqual(f.document.exportHwpx(), beforeHwpx);
    assert.equal(applied.command.redo().status, 'restored');
    assert.deepEqual(f.document.exportHwp(), afterHwp); assert.deepEqual(f.document.exportHwpx(), afterHwpx);
    applied.command.dispose();
  } finally { f.document.free(); }
});

test('B144 rejects unsafe and stale plans before snapshot and rolls back a rejected mutation', () => {
  const f = fixture();
  try {
    let snapshots = 0;
    const counted = new Proxy(f.document, {get(target, key) {
      if (key === 'saveSnapshot') return () => { snapshots += 1; return target.saveSnapshot(); };
      const value = Reflect.get(target, key, target); return typeof value === 'function' ? value.bind(target) : value;
    }});
    f.setStory('header'); assert.equal(captureBibliographyB144(counted, f.context, registry(), source.id, 'citation').status, 'blocked');
    f.setStory('body'); f.setProtected(true); assert.equal(captureBibliographyB144(counted, f.context, registry(), source.id, 'citation').status, 'blocked');
    f.setProtected(false); f.setSelection({start: point(0).start, end: point(1).end});
    assert.equal(captureBibliographyB144(counted, f.context, registry(), source.id, 'citation').status, 'blocked');
    f.setSelection(point(0)); assert.equal(captureBibliographyB144(counted, f.context, registry(), source.id, 'bibliography').status, 'blocked');
    assert.equal(snapshots, 0);
  } finally { f.document.free(); }

  for (const stale of ['identity', 'revision', 'selection', 'source', 'registry', 'plan'] as const) {
    const item = fixture();
    try {
      const firstRegistry = registry();
      const captured = captureBibliographyB144(item.document, item.context, firstRegistry, source.id, 'citation');
      assert.equal(captured.status, 'ready'); if (captured.status !== 'ready') continue;
      if (stale === 'identity') item.setIdentity('other-document');
      if (stale === 'revision') item.setRevision('other-revision');
      if (stale === 'selection') item.setSelection(point(0));
      let snapshots = 0;
      const host = new Proxy(item.document, {get(target, key) {
        if (key === 'saveSnapshot') return () => { snapshots += 1; return target.saveSnapshot(); };
        if (stale === 'source' && key === 'getTextRange') return () => '다른 문단';
        const value = Reflect.get(target, key, target); return typeof value === 'function' ? value.bind(target) : value;
      }});
      const liveRegistry = stale === 'registry'
        ? registry([{id: 'new-source', authors: ['이민수'], year: 2023, title: '새 자료'}]) : firstRegistry;
      const plan = stale === 'plan' ? {...captured.plan, renderedText: '(위조, 2024)'} : captured.plan;
      assert.equal(applyBibliographyB144(host, item.context, liveRegistry, plan).status, 'blocked', stale);
      assert.equal(snapshots, 0, stale);
    } finally { item.document.free(); }
  }

  const rejected = fixture();
  try {
    const created = registry();
    const captured = captureBibliographyB144(rejected.document, rejected.context, created, source.id, 'citation');
    assert.equal(captured.status, 'ready'); if (captured.status !== 'ready') return;
    const beforeHwp = rejected.document.exportHwp(), beforeHwpx = rejected.document.exportHwpx();
    const host = new Proxy(rejected.document, {get(target, key) {
      if (key === 'insertText') return () => '{"ok":false}';
      const value = Reflect.get(target, key, target); return typeof value === 'function' ? value.bind(target) : value;
    }});
    assert.deepEqual(applyBibliographyB144(host, rejected.context, created, captured.plan),
      {status: 'blocked', reason: 'verification-failed'});
    assert.deepEqual(rejected.document.exportHwp(), beforeHwp); assert.deepEqual(rejected.document.exportHwpx(), beforeHwpx);
  } finally { rejected.document.free(); }
});
