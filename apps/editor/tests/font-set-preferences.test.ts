import test from 'node:test';
import assert from 'node:assert/strict';
import { FONT_SET_LANGUAGES, validateFontSet, prepareFontSetChange, commitFontSetChange } from '../src/modules/preferences/public/index.ts';
import type { FontSetDefinition } from '../src/modules/preferences/public/index.ts';

const fontSet = (name: string, family = '함초롬바탕'): FontSetDefinition => ({ name, ...Object.fromEntries(FONT_SET_LANGUAGES.map(key => [key, family])) } as FontSetDefinition);
const builtins = [fontSet('기본')];
const fixture = (raw: string | null) => {
  const writes: FontSetDefinition[][] = []; const storage = { getItem: () => raw, setItem: () => { throw new Error('settings owner must write'); } };
  return { storage, writes, write: (values: FontSetDefinition[]) => { writes.push(values); } };
};

test('valid seven-language definitions preserve stored family spelling', () => {
  const value = fontSet('  업무 글꼴  ', '미설치·외부 글꼴'); assert.equal(validateFontSet(value).name, '업무 글꼴');
  for (const key of FONT_SET_LANGUAGES) assert.equal(validateFontSet(value)[key], '미설치·외부 글꼴');
});
test('empty, control, overlong and missing language entries cannot be saved', () => {
  for (const value of [fontSet(''), fontSet('x\ny'), fontSet('x'.repeat(101)), { ...fontSet('x'), korean: '' }, { ...fontSet('x'), symbol: undefined }, fontSet('x', '__fontset__invalid')]) assert.throws(() => validateFontSet(value));
});
test('adding preserves latest unrelated definitions and extension fields without mutating its input', () => {
  const old = { ...fontSet('기존'), extension: { keep: true } }, current = [old], next = prepareFontSetChange(current, builtins, { kind: 'add', value: fontSet('추가') });
  assert.deepEqual(next, [old, fontSet('추가')]); assert.equal(current.length, 1); assert.notEqual(next[0], old);
});
test('renaming a set preserves extension fields and exact language values', () => {
  const old = { ...fontSet('이전'), extension: 7 }, updated = { ...fontSet('이후'), english: 'serif' };
  assert.deepEqual(prepareFontSetChange([old], builtins, { kind: 'edit', expected: old, value: updated }), [{ ...updated, extension: 7 }]);
});
test('edit targets the captured definition after a preceding array item is removed', () => {
  const target = fontSet('선택');
  assert.deepEqual(prepareFontSetChange([target], builtins, { kind: 'edit', expected: target, value: fontSet('수정') }), [fontSet('수정')]);
});
test('delete targets the captured definition after another window inserts an earlier item', () => {
  const target = fontSet('선택'), other = fontSet('새 항목');
  assert.deepEqual(prepareFontSetChange([other, target], builtins, { kind: 'delete', expected: target }), [other]);
});
test('stale edits and deletions reject externally modified or removed targets', () => {
  const expected = fontSet('선택'), changed = { ...expected, english: 'serif' };
  for (const current of [[], [changed]]) {
    assert.throws(() => prepareFontSetChange(current, builtins, { kind: 'edit', expected, value: fontSet('덮어쓰기') }), /다른 창/);
    assert.throws(() => prepareFontSetChange(current, builtins, { kind: 'delete', expected }), /다른 창/);
  }
});
test('builtin and normalized duplicate names cannot be created or used for rename', () => {
  const old = fontSet('다른이름');
  for (const duplicate of ['기본', 'ARIAL', 'cafe\u0301']) {
    const current = [fontSet('Arial'), fontSet('café'), old];
    assert.throws(() => prepareFontSetChange(current, builtins, { kind: 'add', value: fontSet(duplicate) }), /이미/);
    assert.throws(() => prepareFontSetChange(current, builtins, { kind: 'edit', expected: old, value: fontSet(duplicate) }), /이미/);
  }
});
test('full libraries reject additions but still allow valid updates and deletes', () => {
  const current = Array.from({ length: 100 }, (_, index) => fontSet(`세트${index}`));
  assert.throws(() => prepareFontSetChange(current, builtins, { kind: 'add', value: fontSet('추가') }), /100/);
  assert.equal(prepareFontSetChange(current, builtins, { kind: 'edit', expected: current[99], value: fontSet('마지막') }).length, 100);
  assert.equal(prepareFontSetChange(current, builtins, { kind: 'delete', expected: current[0] }).length, 99);
});
test('fresh and legacy sparse settings use the existing settings owner for one write', () => {
  for (const raw of [null, '{}', '{"version":1}', '{"version":1,"font":{}}']) {
    const f = fixture(raw); commitFontSetChange(f.storage, f.write, builtins, { kind: 'add', value: fontSet('업무') });
    assert.deepEqual(f.writes, [[fontSet('업무')]]);
  }
});
test('concurrent other-window additions are read immediately before the update', () => {
  const existing = fontSet('다른창'); const f = fixture(JSON.stringify({ version: 1, font: { fontSets: [existing] } }));
  commitFontSetChange(f.storage, f.write, builtins, { kind: 'add', value: fontSet('현재창') });
  assert.deepEqual(f.writes, [[existing, fontSet('현재창')]]);
});
test('corrupt, future, null or duplicate existing libraries never reach the writer', () => {
  for (const raw of ['{', 'null', '[]', '{"version":99}', '{"font":null}', '{"font":{"fontSets":null}}', '{"font":{"fontSets":{}}}', JSON.stringify({ font: { fontSets: [fontSet('a'), fontSet('A')] } })]) {
    const f = fixture(raw); assert.throws(() => commitFontSetChange(f.storage, f.write, builtins, { kind: 'add', value: fontSet('새 글꼴') })); assert.equal(f.writes.length, 0);
  }
});
test('read errors and settings-writer failures propagate instead of reporting success', () => {
  const f = fixture(null); assert.throws(() => commitFontSetChange({ ...f.storage, getItem() { throw new Error('read denied'); } }, f.write, builtins, { kind: 'add', value: fontSet('새 글꼴') })); assert.equal(f.writes.length, 0);
  assert.throws(() => commitFontSetChange(f.storage, () => { throw new Error('quota'); }, builtins, { kind: 'add', value: fontSet('새 글꼴') }), /quota/);
});
