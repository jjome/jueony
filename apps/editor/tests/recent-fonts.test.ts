import test from 'node:test';
import assert from 'node:assert/strict';
import { RECENT_FONTS_KEY, readRecentFonts, rememberRecentFont, visibleRecentFonts, validateRecentFonts } from '../src/modules/preferences/public/index.ts';

function fixture(raw?: string) {
  const data = new Map<string, string>(raw === undefined ? [] : [[RECENT_FONTS_KEY, raw]]);
  let readsDenied = false, writesDenied = false, writes = 0;
  const storage = {
    getItem(key: string) { if (readsDenied) throw new Error('denied'); return data.get(key) ?? null; },
    setItem(key: string, value: string) { if (writesDenied) throw new Error('quota'); data.set(key, value); writes++; },
  };
  return { data, storage, writes: () => writes, denyRead: () => { readsDenied = true; }, denyWrite: () => { writesDenied = true; } };
}

test('opening the recent list is read only and starts empty', () => {
  const f = fixture(); assert.deepEqual(readRecentFonts(f.storage), { version: 1, names: [] }); assert.equal(f.writes(), 0);
});
test('successive fonts are recent-first, bounded, and restored by a new reader', () => {
  const f = fixture();
  for (const name of ['바탕', '돋움', '궁서', 'Arial', '나눔고딕', '맑은 고딕']) rememberRecentFont(f.storage, name);
  assert.deepEqual(readRecentFonts(f.storage).names, ['맑은 고딕', '나눔고딕', 'Arial', '궁서', '돋움']);
});
test('reuse moves a font to the front without a case-insensitive duplicate', () => {
  const f = fixture(); for (const name of ['Arial', '돋움', '바탕', 'arial']) rememberRecentFont(f.storage, name);
  assert.deepEqual(readRecentFonts(f.storage).names, ['arial', '바탕', '돋움']);
  const count = f.writes(); rememberRecentFont(f.storage, 'arial'); assert.equal(f.writes(), count);
});
test('visible count and disable do not delete persisted history', () => {
  const f = fixture(); for (const name of ['바탕', '돋움', '궁서', 'Arial']) rememberRecentFont(f.storage, name);
  const stored = f.data.get(RECENT_FONTS_KEY), value = readRecentFonts(f.storage);
  assert.deepEqual(visibleRecentFonts(value, false, 3), []);
  assert.deepEqual(visibleRecentFonts(value, true, 2), ['Arial', '궁서']);
  assert.equal(visibleRecentFonts(value, true, 5).length, 4); assert.equal(f.data.get(RECENT_FONTS_KEY), stored);
});
test('invalid display limits are bounded to the existing default of three', () => {
  const value = { version: 1 as const, names: ['a', 'b', 'c', 'd', 'e'] };
  for (const count of [0, -1, Infinity, NaN, 99, 1.5]) assert.deepEqual(visibleRecentFonts(value, true, count), ['a', 'b', 'c']);
});
test('sequential editor windows always append to the latest history', () => {
  const f = fixture(); const first = readRecentFonts(f.storage), second = readRecentFonts(f.storage);
  assert.deepEqual(first, second); rememberRecentFont(f.storage, '바탕'); rememberRecentFont(f.storage, '돋움');
  assert.deepEqual(readRecentFonts(f.storage).names, ['돋움', '바탕']);
});
test('unrecognized fields survive a valid update', () => {
  const f = fixture(JSON.stringify({ version: 1, names: ['바탕'], futureMetadata: { keep: true } }));
  rememberRecentFont(f.storage, '돋움'); assert.deepEqual(JSON.parse(f.data.get(RECENT_FONTS_KEY)!).futureMetadata, { keep: true });
});
test('corrupt and future history is never overwritten by a font change', () => {
  for (const raw of ['{', 'null', '{"version":99,"names":[]}', '{"version":1,"names":["a","A"]}', '{"version":1,"names":["__fontset__x"]}']) {
    const f = fixture(raw); assert.throws(() => readRecentFonts(f.storage)); assert.throws(() => rememberRecentFont(f.storage, '바탕'));
    assert.equal(f.data.get(RECENT_FONTS_KEY), raw); assert.equal(f.writes(), 0);
  }
});
test('failed reads and writes preserve the old record', () => {
  const raw = '{"version":1,"names":["바탕"]}', a = fixture(raw), b = fixture(raw);
  a.denyRead(); b.denyWrite(); assert.throws(() => rememberRecentFont(a.storage, '돋움')); assert.throws(() => rememberRecentFont(b.storage, '돋움'));
  assert.equal(a.data.get(RECENT_FONTS_KEY), raw); assert.equal(b.data.get(RECENT_FONTS_KEY), raw);
});
test('invalid or reserved names fail without writes; normalized Unicode names coalesce', () => {
  const f = fixture(); for (const name of ['', '  ', null, '__fontset__대표', 'a\nb', 'a'.repeat(241)]) assert.throws(() => rememberRecentFont(f.storage, name));
  assert.equal(f.writes(), 0); rememberRecentFont(f.storage, ' café '); rememberRecentFont(f.storage, 'cafe\u0301');
  assert.deepEqual(readRecentFonts(f.storage).names, ['cafe\u0301']);
});
test('history shape rejects invalid version, non-array, excessive entries and non-font values', () => {
  for (const value of [{ names: [] }, { version: 1, names: '바탕' }, { version: 1, names: ['a', 'b', 'c', 'd', 'e', 'f'] }, { version: 1, names: [42] }]) assert.throws(() => validateRecentFonts(value));
});
