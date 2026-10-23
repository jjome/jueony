import test from 'node:test';
import assert from 'node:assert/strict';
import { adjacentToolbarFont, canCycleCharacter, nextScriptProperties } from '../src/shortcuts/character-cycle.ts';
import { HangulKeyResolver } from '../src/shortcuts/keymap.ts';

test('script shortcut cycles normal → superscript → subscript → normal without touching other formatting', () => {
  const normal = { superscript: false, subscript: false };
  const superValue = nextScriptProperties(normal), subValue = nextScriptProperties(superValue);
  assert.deepEqual(superValue, { superscript: true, subscript: false });
  assert.deepEqual(subValue, { superscript: false, subscript: true });
  assert.deepEqual(nextScriptProperties(subValue), normal);
  assert.deepEqual(normal, { superscript: false, subscript: false });
  assert.deepEqual(Object.keys(superValue), ['superscript', 'subscript']);
  assert.throws(() => nextScriptProperties({})); assert.throws(() => nextScriptProperties({ superscript: true, subscript: true }));
});
test('font cycle uses toolbar order, wraps and skips pseudo sets and duplicate options', () => {
  const fonts = ['함초롬바탕', '__fontset__대표', '맑은 고딕', '함초롬돋움', '맑은 고딕'];
  assert.equal(adjacentToolbarFont(fonts, '함초롬바탕', 1), '맑은 고딕');
  assert.equal(adjacentToolbarFont(fonts, '함초롬바탕', -1), '함초롬돋움');
  assert.equal(adjacentToolbarFont(fonts, '함초롬돋움', 1), '함초롬바탕');
  assert.equal(adjacentToolbarFont(['단일'], '단일', 1), '단일');
  assert.throws(() => adjacentToolbarFont(fonts, '미등록 글꼴', 1));
  assert.throws(() => adjacentToolbarFont(fonts, '함초롬바탕', 0));
  assert.throws(() => adjacentToolbarFont([], '', 1));
});
test('font/script actions reject readonly, composing, busy, password, inactive, object and cell-block contexts', () => {
  const context = { hasDocument: true, isEditable: true }, input = { active: true, isComposing: false, wasm: {} }, state = { fontEnabled: true };
  assert.equal(canCycleCharacter(context, input, state, false), true);
  for (const patch of [{ hasDocument: false }, { isEditable: false }, { isFormMode: true }, { inPictureObjectSelection: true }, { inTableObjectSelection: true }, { inCellSelectionMode: true }]) assert.equal(canCycleCharacter({ ...context, ...patch }, input, state, false), false);
  for (const patch of [{ active: false }, { isComposing: true }, { wasm: { requiresPasswordForSave: true } }, { isFormMode: () => true }]) assert.equal(canCycleCharacter(context, { ...input, ...patch }, state, false), false);
  assert.equal(canCycleCharacter(context, input, state, true), false); assert.equal(canCycleCharacter(context, input, { fontEnabled: false }, false), false);
});
test('official script/font keys resolve distinctly; held font advances and held script does not toggle repeatedly', () => {
  const resolver = new HangulKeyResolver(), context = { table: false, cells: false, object: false };
  const key = (letter: string, ctrlKey: boolean, shiftKey: boolean, repeat = false) => ({ key: letter, code: 'Key' + letter, altKey: true, ctrlKey, shiftKey, repeat, isComposing: false, metaKey: false });
  assert.equal(resolver.resolve(key('A', true, false), context).binding?.command, 'ext:jueony-cycle-script');
  assert.equal(resolver.resolve(key('A', true, false, true), context).binding, undefined);
  assert.equal(resolver.resolve(key('F', false, true, true), context).binding?.params?.direction, 1);
  assert.equal(resolver.resolve(key('G', false, true), context).binding?.params?.direction, -1);
});
