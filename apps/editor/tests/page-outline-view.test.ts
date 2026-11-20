import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import init, { HwpDocument } from '@rhwp/core';
import { normalizePageOutlineView, togglePageOutlineView } from '../src/adapters/browser/page-outline-view-state.ts';
import { applyPageOutlinePatches } from '../scripts/integration/page-outline-patches.mjs';

await init({ module_or_path: await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm', import.meta.url)) });

test('page outline toggle owns only preference and renderer transaction', () => {
  let stored: unknown = true;
  const publications: unknown[] = [];
  const document = { revision: 17, dirty: false, bytes: new Uint8Array([1, 2, 3]), undo: 4 };
  const before = structuredClone(document);
  assert.equal(togglePageOutlineView({
    read: () => stored,
    write: value => { stored = value; },
    publish: change => publications.push(change),
  }), false);
  assert.equal(stored, false);
  assert.deepEqual(publications, [{ pageOutline: false }]);
  assert.deepEqual(document, before);
  assert.equal(normalizePageOutlineView(undefined), true);
  assert.equal(normalizePageOutlineView(undefined, false), false);
});

test('page outline toggle leaves actual HWP/HWPX bytes and reopen state unchanged', () => {
  const document = HwpDocument.createEmpty();
  document.createBlankDocument();
  try {
    const beforeHwp = document.exportHwp(), beforeHwpx = document.exportHwpx();
    let stored = true;
    togglePageOutlineView({ read: () => stored, write: value => { stored = value; }, publish: () => {} });
    assert.deepEqual(document.exportHwp(), beforeHwp);
    assert.deepEqual(document.exportHwpx(), beforeHwpx);
    for (const bytes of [beforeHwp, beforeHwpx]) {
      const reopened = new HwpDocument(bytes);
      try { assert.equal(reopened.getTextFileUnicode(), document.getTextFileUnicode()); }
      finally { reopened.free(); }
    }
  } finally { document.free(); }
});

test('generated Studio patch keeps geometry, outline CSS, app preference, and command in one fail-closed seam', async () => {
  const root = await mkdtemp(join(tmpdir(), 'jueony-page-outline-'));
  const repo = fileURLToPath(new URL('../../../', import.meta.url));
  const studio = join(repo, 'upstream/rhwp-source/rhwp-studio');
  const files = [
    'src/view/page-gap.ts', 'src/view/virtual-scroll.ts', 'src/view/page-view-settings-change.ts',
    'src/view/canvas-view.ts', 'src/core/user-settings.ts', 'src/command/commands/view.ts',
    'src/main.ts', 'src/styles/editor.css',
  ];
  try {
    for (const file of files) {
      await mkdir(join(root, file, '..'), { recursive: true });
      await copyFile(join(studio, file), join(root, file));
    }
    await writeFile(join(root, 'editor.html'), await readFile(join(studio, 'index.html')));
    await applyPageOutlinePatches({ root });
    const gap = await readFile(join(root, 'src/view/page-gap.ts'), 'utf8');
    const scroll = await readFile(join(root, 'src/view/virtual-scroll.ts'), 'utf8');
    const canvas = await readFile(join(root, 'src/view/canvas-view.ts'), 'utf8');
    const command = await readFile(join(root, 'src/command/commands/view.ts'), 'utf8');
    const settings = await readFile(join(root, 'src/core/user-settings.ts'), 'utf8');
    const css = await readFile(join(root, 'src/styles/editor.css'), 'utf8');
    assert.match(gap, /if \(!pageOutline\) return 0/);
    assert.match(scroll, /setPageOutlineVisible/);
    assert.match(canvas, /const outlineChanged = next\.pageOutline/);
    assert.match(canvas, /const layoutChanged = viewChanged \|\| outlineChanged \|\| zoomChanged/);
    assert.match(command, /id: 'view:page-outline'/);
    assert.doesNotMatch(command.match(/id: 'view:page-outline'[\s\S]*?\n  },/)?.[0] ?? '', /document-changed|document-mutated|services\.wasm/);
    assert.match(settings, /pageOutline: normalizePageOutlineView/);
    assert.match(css, /page-outline-hidden[\s\S]*box-shadow: none/);
    await assert.rejects(() => applyPageOutlinePatches({ root }), /쪽 윤곽 통합 기준 불일치/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
