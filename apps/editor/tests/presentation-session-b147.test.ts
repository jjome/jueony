import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import type {HwpDocument as HwpDocumentType} from '@rhwp/core';
import {
  startPresentationSessionB147,
  type PresentationDocumentPortB147,
  type PresentationViewPortB147,
} from '../src/adapters/browser/presentation-session-b147.ts';

const enginePackage = process.env.JUEONY_ENGINE_PACKAGE
  ? resolve(process.env.JUEONY_ENGINE_PACKAGE)
  : fileURLToPath(new URL('../node_modules/@rhwp/core/', import.meta.url));
const engine = await import(pathToFileURL(resolve(enginePackage, 'rhwp.js')).href);
const {HwpDocument} = engine as typeof import('@rhwp/core');
await engine.default({module_or_path: await readFile(resolve(enginePackage, 'rhwp_bg.wasm'))});

function fakeDocument(overrides: Partial<PresentationDocumentPortB147> = {}): PresentationDocumentPortB147 {
  return {
    identity: () => 'document-a',
    revision: () => 'revision-1',
    getSectionCount: () => 2,
    getParagraphCount: () => 2,
    getPageCaretStarts: () => JSON.stringify([
      {list: 0, para: 0, pos: 0},
      {list: 0, para: 1, pos: 0},
      {list: 0, para: 2, pos: 0},
      {list: 0, para: 3, pos: 0},
    ]),
    getPageOfPosition: section => JSON.stringify({ok: true, page: section * 2}),
    ...overrides,
  };
}

function fakeView(options: {enter?: boolean; exit?: boolean; show?: (page: number) => boolean} = {}): PresentationViewPortB147 & {pages: number[]} {
  let active = false;
  const pages: number[] = [];
  return {
    pages,
    enterFullscreen: () => { active = options.enter ?? true; return active; },
    exitFullscreen: () => { if (options.exit === false) return false; active = false; return true; },
    isFullscreen: () => active,
    showPage: page => { const accepted = options.show?.(page) ?? true; if (accepted) pages.push(page); return accepted; },
  };
}

test('B147 section-scoped session stays inside its exact page range', () => {
  const view = fakeView();
  const session = startPresentationSessionB147({document: fakeDocument(), view, scope: {kind: 'section', section: 1}});
  assert.deepEqual(view.pages, [2]);
  assert.deepEqual({...session.state(), scope: session.state().scope}, {
    status: 'active', documentIdentity: 'document-a', documentRevision: 'revision-1', scope: {kind: 'section', section: 1},
    currentPage: 2, firstPage: 2, lastPage: 3, pageCount: 4, sectionCount: 2,
    inventoryFingerprint: session.state().inventoryFingerprint,
  });
  assert.equal(session.previous(), false);
  assert.equal(session.next(), true);
  assert.equal(session.next(), false);
  assert.equal(session.goTo(1), false);
  assert.deepEqual(view.pages, [2, 3]);
  session.end();
  assert.equal(session.state().status, 'ended');
});

test('B147 failed fullscreen or first-page presentation cleans up without returning a session', () => {
  const cannotEnter = fakeView({enter: false});
  assert.throws(() => startPresentationSessionB147({document: fakeDocument(), view: cannotEnter}), /전체 화면/);
  assert.equal(cannotEnter.isFullscreen(), false);
  const cannotShow = fakeView({show: () => false});
  assert.throws(() => startPresentationSessionB147({document: fakeDocument(), view: cannotShow}), /시작 쪽/);
  assert.equal(cannotShow.isFullscreen(), false);
});

test('B147 stale document and pagination block navigation before the view moves', () => {
  let revision = 'revision-1';
  let starts = [{list: 0, para: 0, pos: 0}, {list: 0, para: 1, pos: 0}];
  const document = fakeDocument({
    revision: () => revision,
    getSectionCount: () => 1,
    getPageCaretStarts: () => JSON.stringify(starts),
    getPageOfPosition: () => JSON.stringify({ok: true, page: 0}),
  });
  const view = fakeView();
  const session = startPresentationSessionB147({document, view});
  revision = 'revision-2';
  assert.throws(() => session.next(), /바뀌었습니다/);
  assert.deepEqual(view.pages, [0]);
  revision = 'revision-1';
  starts = [...starts, {list: 0, para: 2, pos: 0}];
  assert.throws(() => session.next(), /바뀌었습니다/);
  assert.deepEqual(view.pages, [0]);
});

test('B147 end always attempts fullscreen cleanup and reports stale or failed exit honestly', () => {
  let revision = 'revision-1';
  const document = fakeDocument({revision: () => revision});
  const view = fakeView();
  const session = startPresentationSessionB147({document, view});
  revision = 'revision-2';
  assert.throws(() => session.end(), /바뀌었습니다/);
  assert.equal(view.isFullscreen(), false);
  assert.equal(session.state().status, 'ended');

  const failedExitView = fakeView({exit: false});
  const failedExit = startPresentationSessionB147({document: fakeDocument(), view: failedExitView});
  assert.throws(() => failedExit.end(), /종료하지 못했습니다/);
  assert.equal(failedExit.state().status, 'active');
});

function nativePort(document: HwpDocumentType): PresentationDocumentPortB147 {
  return {
    identity: () => 'native-document',
    revision: () => 'native-revision-1',
    getSectionCount: () => document.getSectionCount(),
    getParagraphCount: section => document.getParagraphCount(section),
    getPageCaretStarts: () => document.getPageCaretStarts(),
    getPageOfPosition: (section, paragraph) => document.getPageOfPosition(section, paragraph),
  };
}

test('B147 actual HWP and HWPX sessions preserve both exports and an existing undo snapshot', () => {
  const source = HwpDocument.createEmpty();
  source.createBlankDocument();
  source.insertText(0, 0, 0, '프레젠테이션은 문서를 수정하지 않습니다.');
  const fixtures = [source.exportHwp(), source.exportHwpx()];
  source.free();

  for (const fixture of fixtures) {
    const document = new HwpDocument(fixture);
    try {
      const beforeHwp = document.exportHwp();
      const beforeHwpx = document.exportHwpx();
      const existingUndo = document.saveSnapshot();
      const view = fakeView();
      const session = startPresentationSessionB147({document: nativePort(document), view});
      assert.equal(session.state().pageCount >= 1, true);
      assert.equal(session.previous(), false);
      session.end();
      assert.deepEqual(document.exportHwp(), beforeHwp);
      assert.deepEqual(document.exportHwpx(), beforeHwpx);
      assert.notEqual(JSON.parse(document.restoreSnapshot(existingUndo)).ok, false);
      document.discardSnapshot(existingUndo);
      assert.deepEqual(document.exportHwp(), beforeHwp);
      assert.deepEqual(document.exportHwpx(), beforeHwpx);
      for (const exported of [beforeHwp, beforeHwpx]) {
        const reopened = new HwpDocument(exported);
        try {
          const reopenedSession = startPresentationSessionB147({document: nativePort(reopened), view: fakeView()});
          reopenedSession.end();
        } finally { reopened.free(); }
      }
    } finally { document.free(); }
  }
});
