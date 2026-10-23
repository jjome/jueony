import test from 'node:test';
import assert from 'node:assert/strict';
import { findSentenceAt, findWordAt, findWordBoundaryBackward, findWordBoundaryForward } from '../src/shortcuts/word-boundaries.ts';
import { patchBlockSelectionNavigation, patchEmptySelectionDeletion, patchScalarWordBoundaries } from '../scripts/integration/word-boundary-patches.mjs';
import { readFileSync } from 'node:fs';
import { HangulKeyResolver } from '../src/shortcuts/keymap.ts';
import { deleteBodyByShortcut } from '../src/shortcuts/body-navigation.ts';

test('word deletion/movement returns model scalar offsets around astral characters', () => {
  assert.equal(findWordBoundaryForward('😀 tail'), 2);
  assert.equal(findWordBoundaryBackward('😀alpha'), 1);
  assert.equal(findWordBoundaryForward('😀🧪 다음'), 3);
  assert.equal(findWordBoundaryBackward('앞 😀🧪 '), 2);
  for (const text of ['', 'one two', '한글 단어', '12 next', '! 다음', '😀alpha', 'a'.repeat(4000)]) {
    const length = Array.from(text).length;
    for (const boundary of [findWordBoundaryForward(text), findWordBoundaryBackward(text)]) assert.ok(boundary >= 0 && boundary <= length);
  }
});

test('long words and spaces have no artificial fifty-character boundary', () => {
  assert.equal(findWordBoundaryForward('a'.repeat(80) + ' '.repeat(80) + 'tail'), 160);
  assert.equal(findWordBoundaryBackward('head ' + '가'.repeat(80)), 5);
  assert.equal(findWordBoundaryForward(' '.repeat(81) + 'word'), 81);
  assert.equal(findWordBoundaryBackward('word' + ' '.repeat(81)), 0);
  assert.equal(findWordBoundaryForward('\t\u00a0a'), 2);
});

test('block word and sentence selection share scalar coordinates without changing grouping policy', () => {
  assert.deepEqual(findWordAt('😀word tail', 2), { start: 1, end: 5 });
  assert.deepEqual(findWordAt('😀🧪 한글', 1), { start: 0, end: 3 });
  assert.deepEqual(findSentenceAt('😀 첫째. 🧪 둘째!', 8), { start: 6, end: 11 });
  assert.deepEqual(findWordAt('abc', 3), { start: 3, end: 3 });
  assert.deepEqual(findSentenceAt('', 0), { start: 0, end: 0 });
});

test('pinned cursor patch replaces every bounded window and refuses changed source seams', () => {
  const source = readFileSync(new URL('../../../upstream/rhwp-source/rhwp-studio/src/engine/cursor.ts', import.meta.url), 'utf8');
  const result = patchScalarWordBoundaries(source);
  assert.match(result, /from '\.\.\/jueony\/shortcuts\/word-boundaries\.ts'/);
  assert.doesNotMatch(result, /Math\.min\(remaining, 50\)|charOffset - 50|_hfCharOffset - 50/);
  assert.throws(() => patchScalarWordBoundaries(source.replace('const start = Math.max(0, pos.charOffset - 50);', 'const start = 1;')), /drift/);
});

test('F3 movement patch extends only body/cell navigation code and refuses a moved boundary', () => {
  const source = readFileSync(new URL('../../../upstream/rhwp-source/rhwp-studio/src/engine/input-handler-keyboard.ts', import.meta.url), 'utf8');
  const result = patchBlockSelectionNavigation(source);
  assert.match(result, /shiftKey \|\|= this\.cursor\.isInBlockSelectionMode\(\)/);
  assert.match(result, /case 'Home':[\s\S]*?e\.shiftKey \|\| this\.cursor\.isInBlockSelectionMode\(\)/);
  assert.throws(() => patchBlockSelectionNavigation(source.replace("    case 'Tab':", "    case 'unexpected':")), /drift|missing/);
});

test('Ctrl+Backspace retains the Hancom table-row shortcut and restores previous-word deletion in body', () => {
  const resolver = new HangulKeyResolver();
  const key = { key: 'Backspace', code: 'Backspace', ctrlKey: true, altKey: false, shiftKey: false, metaKey: false, repeat: false, isComposing: false };
  assert.equal(resolver.resolve(key, { table: false, cells: false, object: false }).binding?.command, 'ext:jueony-delete-previous-word');
  assert.equal(resolver.resolve({ ...key, repeat: true }, { table: false, cells: false, object: false }).binding?.command, 'ext:jueony-delete-previous-word');
  assert.equal(resolver.resolve(key, { table: true, cells: false, object: false }).binding?.command, 'table:delete-row');
  assert.equal(resolver.resolve({ ...key, repeat: true }, { table: true, cells: false, object: false }).binding, undefined);
});

test('previous-word deletion never discards an existing selected range', () => {
  const calls: unknown[] = [];
  const input = { flushDeferredPaginationIfNeeded() {}, cursor: {
    hasSelection: () => true, clearSelection: () => { throw Error('must retain selection'); },
    setAnchor: () => { throw Error('must retain anchor'); }, moveToWordBoundary: () => { throw Error('must retain range'); },
  }, deleteSelection: () => calls.push('delete'), updateCaret() {}, focus() {} };
  deleteBodyByShortcut(input, 'previous-word'); assert.deepEqual(calls, ['delete']);
});

test('empty selection deletion guard precedes command creation while preserving form protection', () => {
  const source = readFileSync(new URL('../../../upstream/rhwp-source/rhwp-studio/src/engine/input-handler.ts', import.meta.url), 'utf8');
  const result = patchEmptySelectionDeletion(source), start = result.indexOf('private deleteSelection('), end = result.indexOf('/** Undo 처리 */', start);
  const method = result.slice(start, end);
  assert.ok(method.indexOf('CursorState.comparePositions(sel.start, sel.end) === 0') < method.indexOf('new DeleteSelectionCommand'));
  assert.match(method, /if \(!this\.canDeleteSelectionInFormMode\(\)\) return;/);
  assert.throws(() => patchEmptySelectionDeletion(source.replace('    if (!this.canDeleteSelectionInFormMode()) return;', '    return;')), /drift/);
});
