import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findHitPosition, findHitPath, selectFindHit, readFindHits, replaceFindHit, replaceAllFindHits, navigateFindHit, findFromInput, type FindHit } from '../src/editor-actions/basic-find.ts';
import { hitPosition, searchExcerpt } from '../src/editor-actions/search-model.ts';
const body = (offset = 0, para = 0): FindHit => ({ sec: 0, para, charOffset: offset, length: 2 });
const cell = (cellIdx = 0, offset = 0): FindHit => ({ ...body(offset), cellContext: { parentPara: 0, ctrlIdx: 2, cellIdx, cellPara: 0 } });
const range = (hit: FindHit) => { const start = findHitPosition(hit)!; return { start, end: { ...start, charOffset: start.charOffset + hit.length } }; };
const nested: FindHit = { ...body(), cellPath: [{ controlIndex: 2, cellIndex: 0, cellParaIndex: 0 }, { controlIndex: 1, cellIndex: 1, cellParaIndex: 2 }] };

test('forward search includes the caret at the first scalar and next adjacent matches', () => {
  const hits = [body(), body(2), body(4)];
  assert.equal(selectFindHit(hits, findHitPosition(hits[0])!, null, true).charOffset, 0);
  assert.equal(selectFindHit(hits, range(hits[0]).end, range(hits[0]), true).charOffset, 2);
  assert.equal(selectFindHit(hits, range(hits[1]).end, range(hits[1]), false).charOffset, 0);
});
test('identical offsets in different cells remain independently reachable in both directions', () => {
  const hits = [cell(0), cell(1), cell(2)];
  assert.equal(selectFindHit(hits, range(hits[0]).end, range(hits[0]), true).cellContext?.cellIdx, 1);
  assert.equal(selectFindHit(hits, range(hits[1]).end, range(hits[1]), false).cellContext?.cellIdx, 0);
  const last = selectFindHit(hits, range(hits[0]).end, range(hits[0]), false); assert.equal(last.cellContext?.cellIdx, 2); assert.equal(last.wrapped, true);
});
test('a cell caret without selection advances to another cell instead of wrapping to the first', () => {
  const hits = [cell(0), cell(1)];
  const next = selectFindHit(hits, { ...findHitPosition(hits[0])!, charOffset: 4 }, null, true);
  assert.equal(next.cellContext?.cellIdx, 1); assert.equal(next.wrapped, false);
});
test('cellPath-only nested hits never become body positions or body excerpts', () => {
  const pos = hitPosition(nested)!; assert.equal(pos.parentParaIndex, 0); assert.deepEqual(pos.cellPath, nested.cellPath);
  assert.equal(searchExcerpt({ getTextInCellByPath: (_s: number, _p: number, path: string) => { assert.deepEqual(JSON.parse(path), nested.cellPath); return '중첩 원문'; }, getTextRange() { throw new Error('wrong body'); } }, nested), '중첩 원문');
});
test('navigating a nested hit exits object/cell block modes and retains its full selection path', () => {
  const calls: string[] = [], positions: unknown[] = [];
  navigateFindHit({ cursor: { exitCellSelectionMode() { calls.push('cells'); }, exitTableObjectSelection() { calls.push('table'); }, clearSelection() { calls.push('clear'); }, moveTo(p: unknown) { positions.push(p); }, setAnchor() { calls.push('anchor'); } }, updateCaret() { calls.push('caret'); } }, { ...nested, found: true, totalMatchCount: 1 });
  assert.deepEqual(calls, ['cells', 'table', 'clear', 'anchor', 'caret']); assert.deepEqual(positions, [range(nested).start, range(nested).end]);
});
test('invalid addresses, inconsistent flat/path axes and equation scripts are excluded', () => {
  for (const hit of [{ ...body(), charOffset: -1 }, { ...body(), length: 0 }, { ...body(), equationControl: 0 }, { ...nested, cellPath: [] }, { ...nested, cellPath: Array(9).fill(nested.cellPath![0]) }, { ...cell(0), cellPath: [{ controlIndex: 2, cellIndex: 3, cellParaIndex: 0 }] }]) assert.equal(findHitPosition(hit), null);
  assert.equal(findHitPath({ ...cell(), cellContext: { parentPara: 2, ctrlIdx: 2, cellIdx: 0, cellPara: 0 } }), null);
});
test('read search checks all ancestor tables, excludes text boxes/equations and duplicate hits', () => {
  const hit = cell(), textbox = { ...cell(), cellContext: { ...cell().cellContext!, ctrlIdx: 99 } };
  const doc = { searchAllText: () => [hit, hit, nested, textbox, { ...body(), equationControl: 0 }], getTableDimensionsByPath: (_s: number, _p: number, p: string) => { if (JSON.parse(p)[0].controlIndex === 99) throw new Error('shape'); return { cellCount: 3 }; }, getTextInCellByPath: () => '같은' };
  assert.deepEqual(readFindHits(doc, '같은', true), [hit, nested]);
});
test('ambiguous case-expansion offsets do not consume adjacent source characters', () => {
  const doc = { searchAllText: () => [{ ...body(), length: 2 }], getTextRange: () => 'İX' };
  assert.deepEqual(readFindHits(doc, 'i\u0307', false), []);
});
function editable(text = 'banana') {
  let value = text, edits = 0;
  return { doc: { searchAllText(query: string) { const out = []; for (let at = 0; at <= Array.from(value).length - Array.from(query).length; at++) if (Array.from(value).slice(at, at + Array.from(query).length).join('') === query) out.push({ sec: 0, para: 0, charOffset: at, length: Array.from(query).length }); return out; }, getTextRange(_s: number, _p: number, at: number, n: number) { return Array.from(value).slice(at, at + n).join(''); }, getControls: () => [], getParagraphLength: () => Array.from(value).length, replaceText(_s: number, _p: number, at: number, n: number, next: string) { value = Array.from(value).slice(0, at).join('') + next + Array.from(value).slice(at + n).join(''); edits++; return { ok: true }; } }, text: () => value, edits: () => edits };
}
test('replace-all chooses nonoverlapping original matches before reverse editing', () => {
  const model = editable(); assert.equal(replaceAllFindHits(model.doc, 'ana', true, 'X'), 1); assert.equal(model.text(), 'bXna');
});
test('replace-all reverse offsets safely handle longer Unicode replacements', () => {
  const model = editable('가😀가😀'); assert.equal(replaceAllFindHits(model.doc, '가', true, '새😀'), 2); assert.equal(model.text(), '새😀😀새😀😀');
});
test('same-value replacement is a no-op and stale hits refuse before any mutation', () => {
  const model = editable('aa'); assert.equal(replaceFindHit(model.doc, body(), 'aa', true, 'aa'), null); assert.equal(model.edits(), 0);
  assert.throws(() => replaceFindHit(model.doc, body(1), 'aa', true, 'B'), /변경/); assert.equal(model.edits(), 0);
});
test('control characters and excessive replacements refuse before any mutation', () => {
  const model = editable('aa'); for (const replacement of ['x\ny', '\u0000', 'x'.repeat(20001)]) assert.throws(() => replaceFindHit(model.doc, body(), 'aa', true, replacement)); assert.equal(model.edits(), 0);
});
test('fields and objects in the target body refuse without writes', () => {
  const model = editable('aa'); model.doc.getControls = () => [{ list: 0, para: 0, ctrlId: '%clk' }] as never;
  assert.throws(() => replaceFindHit(model.doc, body(), 'aa', true, 'B'), /필드/); assert.equal(model.edits(), 0);
});
test('protected ancestor cell blocks even nested replacement before deletion', () => {
  let mutated = false;
  const doc = { searchAllText: () => [nested], getTableDimensionsByPath: () => ({ cellCount: 3 }), getTextInCellByPath: () => '같은', getControls: () => [], getCellPropertiesByPath: () => ({ cellProtect: true }), deleteTextInCellByPath: () => { mutated = true; } };
  assert.throws(() => replaceFindHit(doc, nested, '같은', true, '다름'), /보호/); assert.equal(mutated, false);
});
test('empty search returns zero results and no replacement', () => {
  const model = editable(); assert.equal(replaceAllFindHits(model.doc, '', true, 'X'), 0); assert.equal(model.edits(), 0);
  assert.deepEqual(selectFindHit([], { sectionIndex: 0, paragraphIndex: 0, charOffset: 0 }, null, true), { found: false, totalMatchCount: 0 });
});
test('input navigation consumes the ordered selection contract, including reverse user selection', () => {
  const selected = range(cell(0)), next = findFromInput({ wasm: { searchAllText: () => [cell(0), cell(1)], getTableDimensionsByPath: () => ({ cellCount: 2 }), getTextInCellByPath: () => '같은' }, getCursorPosition: () => selected.start, cursor: { getSelection() { throw new Error('anchor/focus must not be mistaken for start/end'); }, getSelectionOrdered: () => selected } }, '같은', true, true);
  assert.equal(next.cellContext?.cellIdx, 1);
});
test('replace-all searches once even when each replacement contains the search text', () => {
  const model = editable('aa aa aa'), original = model.doc.searchAllText; let searches = 0;
  model.doc.searchAllText = function(query: string) { searches++; return original(query); };
  assert.equal(replaceAllFindHits(model.doc, 'aa', true, 'aaaa😀'), 3); assert.equal(searches, 1); assert.equal(model.text(), 'aaaa😀 aaaa😀 aaaa😀');
});
test('replace-all refuses oversized match sets before mutating any hit', () => {
  const model = editable('a'.repeat(1001)); assert.throws(() => replaceAllFindHits(model.doc, 'a', true, 'b'), /1,000/); assert.equal(model.edits(), 0);
});
test('header/footer, note and text-box editing cannot reinterpret a body search position', () => {
  for (const mode of ['isInHeaderFooter', 'isInFootnote', 'isInTextBox']) {
    let moved = false;
    const ih = { cursor: { [mode]: () => true, moveTo() { moved = true; } } };
    assert.throws(() => navigateFindHit(ih, { ...body(), found: true, totalMatchCount: 1 }), /편집을 닫은 뒤/);
    assert.throws(() => findFromInput(ih, '같은', true, true), /편집을 닫은 뒤/); assert.equal(moved, false);
  }
});
