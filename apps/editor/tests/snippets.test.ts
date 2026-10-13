import test from 'node:test';
import assert from 'node:assert/strict';
import { readSnippetLibrary, updateSnippetLibrary, validateSnippetLibrary, SNIPPETS_KEY } from '../src/modules/preferences/public/index.ts';
function storage() { const values = new Map<string, string>(); return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } }; }
test('shared snippets persist and support rename/delete without overwriting another window', () => {
  const store = storage(), empty = readSnippetLibrary(store), a = updateSnippetLibrary(store, empty, { kind: 'save', snippet: { name: ' 협조 요청 ', text: '확인해 주시기 바랍니다.\r\n감사합니다.' } }); assert.equal(a.snippets[0].name, '협조 요청'); assert.equal(readSnippetLibrary(store).snippets[0].text.includes('\r'), false);
  assert.throws(() => updateSnippetLibrary(store, empty, { kind: 'save', snippet: { name: '다른', text: '내용' } }), /다른 창/); assert.throws(() => updateSnippetLibrary(store, a, { kind: 'save', snippet: { name: '협조 요청', text: '중복' } }), /같은 이름/);
  const b = updateSnippetLibrary(store, a, { kind: 'save', previousName: '협조 요청', snippet: { name: '협조', text: '변경 내용' } }); assert.deepEqual(readSnippetLibrary(store), b); assert.deepEqual(updateSnippetLibrary(store, b, { kind: 'delete', name: '협조' }), empty);
});
test('corrupt/versioned libraries, bad names and oversized content do not overwrite storage', () => {
  const store = storage(); store.values.set(SNIPPETS_KEY, '{broken'); assert.throws(() => readSnippetLibrary(store), /손상/);
  for (const snippet of [{ name: '', text: 'x' }, { name: 'x', text: '' }, { name: 'x', text: 'x'.repeat(8001) }, { name: 'x', text: '\u0000' }]) assert.throws(() => validateSnippetLibrary({ version: 1, snippets: [snippet] }));
  assert.throws(() => validateSnippetLibrary({ version: 2, snippets: [] })); assert.throws(() => validateSnippetLibrary({ version: 1, snippets: [{ name: 'x', text: '1' }, { name: 'x', text: '2' }] }));
});
test('quota failure leaves saved snippets intact', () => {
  const store = storage(), before = readSnippetLibrary(store); store.setItem = () => { throw new Error('quota'); }; assert.throws(() => updateSnippetLibrary(store, before, { kind: 'save', snippet: { name: 'a', text: 'b' } }), /quota/); assert.deepEqual(readSnippetLibrary(store), before);
});
