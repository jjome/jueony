import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import init, { HwpDocument } from '../node_modules/@rhwp/core/rhwp.js';
import { HangulKeyResolver } from '../src/shortcuts/keymap.ts';

await init({
  module_or_path: await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm', import.meta.url)),
});

const context = { table: false, cells: false, object: false };
const key = (name: string, ctrlKey = false) => ({
  key: name,
  code: `Key${name.toUpperCase()}`,
  ctrlKey,
  altKey: false,
  shiftKey: false,
  metaKey: false,
  repeat: false,
  isComposing: false,
});

function resolveChord(suffix: 'C' | 'T') {
  const resolver = new HangulKeyResolver();
  assert.equal(resolver.resolve(key('G', true), context).handled, true);
  return resolver.resolve(key(suffix), context).binding;
}

function renderTree(document: HwpDocument) {
  return JSON.parse(document.getPageLayerTreeWithProfile(0, 'screen', true, true));
}

function hasNode(value: unknown, predicate: (node: Record<string, unknown>) => boolean): boolean {
  if (Array.isArray(value)) return value.some((item) => hasNode(item, predicate));
  if (!value || typeof value !== 'object') return false;
  const node = value as Record<string, unknown>;
  return predicate(node) || Object.values(node).some((item) => hasNode(item, predicate));
}

test('B047 Hangul display-mark chords resolve to the real Studio command ids', () => {
  assert.equal(resolveChord('C')?.command, 'view:ctrl-mark');
  assert.equal(resolveChord('T')?.command, 'view:para-mark');
});

test('B047 paragraph and control mark flags reach the real render tree', () => {
  const document = HwpDocument.createEmpty();
  document.createBlankDocument();
  document.insertText(0, 0, 0, '표시 부호 검증');

  const plain = renderTree(document);
  assert.deepEqual(plain.outputOptions, {
    showParagraphMarks: false,
    showControlCodes: false,
    showTransparentBorders: false,
    clipEnabled: true,
    debugOverlay: false,
  });
  assert.equal(hasNode(plain, (node) => node.type === 'textControlMark'), false);

  document.setShowParagraphMarks(true);
  const paragraphMarks = renderTree(document);
  assert.equal(document.getShowParagraphMarks(), true);
  assert.equal(paragraphMarks.outputOptions.showParagraphMarks, true);
  assert.equal(paragraphMarks.outputOptions.showControlCodes, false);
  assert.equal(hasNode(paragraphMarks, (node) => node.type === 'textControlMark'), true);
  assert.equal(hasNode(paragraphMarks, (node) => node.kind === 'paragraphEnd' && node.text === '↵'), true);

  document.setShowControlCodes(true);
  const allMarks = renderTree(document);
  assert.equal(document.getShowControlCodes(), true);
  assert.equal(allMarks.outputOptions.showParagraphMarks, true);
  assert.equal(allMarks.outputOptions.showControlCodes, true);
  assert.equal(hasNode(allMarks, (node) => node.type === 'controlLabel'), true);

  document.setShowControlCodes(false);
  document.setShowParagraphMarks(false);
  assert.equal(document.getShowControlCodes(), false);
  assert.equal(document.getShowParagraphMarks(), false);
});

test('B047 Studio commands update WASM, persistent preferences and the rendered view', async () => {
  const source = await readFile(new URL(
    '../../../upstream/rhwp-source/rhwp-studio/src/command/commands/view.ts',
    import.meta.url,
  ), 'utf8');
  const controlCommand = source.slice(source.indexOf("id: 'view:ctrl-mark'"), source.indexOf("id: 'view:para-mark'"));
  const paragraphCommand = source.slice(source.indexOf("id: 'view:para-mark'"), source.indexOf("id: 'view:border-transparent'"));

  assert.match(controlCommand, /wasm\.setShowControlCodes\(next\)/);
  assert.match(controlCommand, /wasm\.setShowParagraphMarks\(next\)/);
  assert.match(controlCommand, /userSettings\.setShowControlCodes\(next\)/);
  assert.match(controlCommand, /userSettings\.setShowParagraphMarks\(next\)/);
  assert.match(controlCommand, /eventBus\.emit\('document-view-changed'\)/);

  assert.match(paragraphCommand, /wasm\.setShowParagraphMarks\(next\)/);
  assert.match(paragraphCommand, /userSettings\.setShowParagraphMarks\(next\)/);
  assert.match(paragraphCommand, /eventBus\.emit\('document-view-changed'\)/);
});
