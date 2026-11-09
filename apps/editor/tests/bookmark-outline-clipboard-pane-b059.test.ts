import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import type {HwpDocument as HwpDocumentType} from '@rhwp/core';
import {
  navigateTaskPaneItemB059,
  readTaskPaneStateB059,
  type ClipboardSnapshotB059,
  type PaneDocumentPortB059,
} from '../src/adapters/browser/bookmark-outline-clipboard-pane-b059.ts';

const enginePackage = process.env.JUEONY_ENGINE_PACKAGE
  ? resolve(process.env.JUEONY_ENGINE_PACKAGE)
  : fileURLToPath(new URL('../node_modules/@rhwp/core/', import.meta.url));
const engine = await import(pathToFileURL(resolve(enginePackage, 'rhwp.js')).href);
const {HwpDocument} = engine as typeof import('@rhwp/core');
await engine.default({module_or_path: await readFile(resolve(enginePackage, 'rhwp_bg.wasm'))});

const clipboard = (revision = 'clip-r1'): ClipboardSnapshotB059 => ({
  workspaceId: 'workspace-a',
  revision,
  entries: [
    {id: 'clip-1', workspaceId: 'workspace-a', label: '최근 문구', kind: 'text', createdAt: 20},
    {id: 'clip-2', workspaceId: 'workspace-a', label: '문서 조각', kind: 'document-fragment', createdAt: 10},
  ],
});

function fake(overrides: Partial<PaneDocumentPortB059> = {}): PaneDocumentPortB059 {
  const paragraphs = ['첫째 제목', '본문', '둘째 제목'];
  return {
    identity: () => 'document-a',
    revision: () => 'doc-r1',
    getSectionCount: () => 1,
    getParagraphCount: () => paragraphs.length,
    getParagraphLength: (_section, paragraph) => paragraphs[paragraph].length,
    getTextRange: (_section, paragraph, start, end) => paragraphs[paragraph].slice(start, end),
    getParaPropertiesAt: (_section, paragraph) => JSON.stringify(paragraph === 0 ? {headType: 'Outline', paraLevel: 0} : paragraph === 2 ? {headType: 'Outline', paraLevel: 1} : {headType: 'None', paraLevel: 0}),
    getBookmarks: () => JSON.stringify([{name: '검토', sec: 0, para: 1, ctrlIdx: 0, charPos: 1}]),
    getControls: () => JSON.stringify([{list: 0, para: 1, controlIndex: 0, ctrlId: 'bokm'}]),
    ...overrides,
  };
}

test('B059 read-only state combines validated bookmarks, outlines and workspace-scoped clipboard history', () => {
  const state = readTaskPaneStateB059(fake(), 'workspace-a', clipboard());
  assert.deepEqual(state.bookmarks.map(item => ({kind: item.kind, label: item.label, target: item.target})), [
    {kind: 'bookmark', label: '검토', target: {section: 0, paragraph: 1, offset: 1, story: 'body'}},
  ]);
  assert.deepEqual(state.outlines.map(item => [item.label, item.target.paragraph]), [['첫째 제목', 0], ['둘째 제목', 2]]);
  assert.deepEqual(state.clipboard.map(item => item.id), ['clip-1', 'clip-2']);
  for (const fingerprint of [state.documentFingerprint, state.clipboardFingerprint, state.fingerprint]) assert.match(fingerprint, /^[a-f0-9]{64}$/u);
  assert.equal(Object.isFrozen(state), true);
});

test('B059 rejects malformed, duplicate, cross-workspace and special-story inventories without exposing partial state', () => {
  const cases: Array<() => unknown> = [
    () => readTaskPaneStateB059(fake({getBookmarks: () => '{'}), 'workspace-a', clipboard()),
    () => readTaskPaneStateB059(fake({getBookmarks: () => JSON.stringify([
      {name: '같음', sec: 0, para: 1, ctrlIdx: 0, charPos: 0},
      {name: '같음', sec: 0, para: 1, ctrlIdx: 0, charPos: 1},
    ])}), 'workspace-a', clipboard()),
    () => readTaskPaneStateB059(fake({getControls: () => JSON.stringify([{list: 3, para: 0, controlIndex: 0, ctrlId: 'bokm'}])}), 'workspace-a', clipboard()),
    () => readTaskPaneStateB059(fake(), 'workspace-b', clipboard()),
    () => readTaskPaneStateB059(fake(), 'workspace-a', {...clipboard(), entries: [
      {id: 'clip-1', workspaceId: 'workspace-b', label: '누출', kind: 'text', createdAt: 1},
    ]}),
    () => readTaskPaneStateB059(fake(), 'workspace-a', {...clipboard(), entries: [
      {id: 'same', workspaceId: 'workspace-a', label: 'A', kind: 'text', createdAt: 2},
      {id: 'same', workspaceId: 'workspace-a', label: 'B', kind: 'text', createdAt: 1},
    ]}),
  ];
  for (const run of cases) assert.throws(run);
});

test('B059 navigation invokes the callback once only for the exact stable target', () => {
  const state = readTaskPaneStateB059(fake(), 'workspace-a', clipboard());
  const calls: unknown[] = [];
  navigateTaskPaneItemB059(state, state.bookmarks[0].id, () => readTaskPaneStateB059(fake(), 'workspace-a', clipboard()), target => {
    calls.push(target);
    return true;
  });
  assert.deepEqual(calls, [{section: 0, paragraph: 1, offset: 1, story: 'body'}]);
});

test('B059 stale document/list/workspace state and rejected host navigation fail before any accepted navigation', () => {
  const state = readTaskPaneStateB059(fake(), 'workspace-a', clipboard());
  let calls = 0;
  const invoke = (readCurrent: () => ReturnType<typeof readTaskPaneStateB059>, accept = true) => () =>
    navigateTaskPaneItemB059(state, state.outlines[0].id, readCurrent, () => { calls += 1; return accept; });
  assert.throws(invoke(() => readTaskPaneStateB059(fake({revision: () => 'doc-r2'}), 'workspace-a', clipboard())), /바뀌었습니다/);
  assert.throws(invoke(() => readTaskPaneStateB059(fake(), 'workspace-a', clipboard('clip-r2'))), /바뀌었습니다/);
  assert.throws(invoke(() => readTaskPaneStateB059(fake(), 'workspace-a', clipboard()), false), /확인하지 못했습니다/);
  assert.equal(calls, 1, 'only the explicit host rejection reaches the callback');
  assert.throws(() => navigateTaskPaneItemB059(state, 'missing', () => state, () => { calls += 1; return true; }));
  assert.equal(calls, 1);
});

function nativePort(document: HwpDocumentType, revision: string): PaneDocumentPortB059 {
  return {
    identity: () => 'document-native',
    revision: () => revision,
    getSectionCount: () => document.getSectionCount(),
    getParagraphCount: section => document.getParagraphCount(section),
    getParagraphLength: (section, paragraph) => document.getParagraphLength(section, paragraph),
    getTextRange: (section, paragraph, start, end) => document.getTextRange(section, paragraph, start, end),
    getParaPropertiesAt: (section, paragraph) => document.getParaPropertiesAt(section, paragraph),
    getBookmarks: () => document.getBookmarks(),
    getControls: () => document.getControls(),
  };
}

test('B059 inventory and navigation preserve actual HWP/HWPX bytes and an existing undo snapshot', () => {
  const source = HwpDocument.createEmpty();
  source.createBlankDocument();
  source.insertText(0, 0, 0, 'B059 본문');
  const added = JSON.parse(source.addBookmark(0, 0, 2, '검토점'));
  assert.equal(added.ok, true);
  const fixtures = [source.exportHwp(), source.exportHwpx()];
  source.free();

  for (const fixture of fixtures) {
    const document = new HwpDocument(fixture);
    try {
      const beforeHwp = document.exportHwp();
      const beforeHwpx = document.exportHwpx();
      const undo = document.saveSnapshot();
      const state = readTaskPaneStateB059(nativePort(document, 'native-r1'), 'workspace-a', clipboard());
      assert.equal(state.bookmarks.length, 1);
      let navigated = false;
      navigateTaskPaneItemB059(state, state.bookmarks[0].id,
        () => readTaskPaneStateB059(nativePort(document, 'native-r1'), 'workspace-a', clipboard()),
        target => { navigated = target.story === 'body' && target.offset === 2; return navigated; });
      assert.equal(navigated, true);
      assert.deepEqual(document.exportHwp(), beforeHwp);
      assert.deepEqual(document.exportHwpx(), beforeHwpx);
      assert.notEqual(JSON.parse(document.restoreSnapshot(undo)).ok, false, 'the pre-existing undo snapshot remains valid');
      document.discardSnapshot(undo);
      assert.deepEqual(document.exportHwp(), beforeHwp);
      assert.deepEqual(document.exportHwpx(), beforeHwpx);
      for (const bytes of [beforeHwp, beforeHwpx]) {
        const reopened = new HwpDocument(bytes);
        try {
          const reopenedState = readTaskPaneStateB059(nativePort(reopened, 'native-r1'), 'workspace-a', clipboard());
          assert.equal(reopenedState.bookmarks[0].label, '검토점');
          const stableHwp = reopened.exportHwp(), stableHwpx = reopened.exportHwpx();
          assert.deepEqual(reopened.exportHwp(), stableHwp);
          assert.deepEqual(reopened.exportHwpx(), stableHwpx);
        } finally {
          reopened.free();
        }
      }
    } finally {
      document.free();
    }
  }
});
