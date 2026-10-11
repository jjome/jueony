import test from 'node:test';
import assert from 'node:assert/strict';
import { planEqualCells, planEqualHeights } from '../src/editor-actions/equal-cells.ts';
import { hitPosition, nextHitIndex, searchExcerpt } from '../src/editor-actions/search-model.ts';
import type { GeometryCell } from '../src/editor-actions/equal-cells.ts';
const cells = (): GeometryCell[] => Array.from({ length: 9 }, (_, i) => ({ cellIdx: i, row: Math.floor(i / 3), col: i % 3, rowSpan: 1, colSpan: 1, width: [1200, 2101, 3000][i % 3], height: [1200, 2100, 3000][Math.floor(i / 3)] }));
const state = { sec: 0, ppi: 0, ci: 0, anchor: { row: 0, col: 0 }, focus: { row: 2, col: 2 }, phase: 2, reason: 'manual', excluded: [] };
test('equal widths preserve selected sum including integer remainder and never change an unselected column', () => {
  const input = cells(), block = { ...state, focus: { row: 2, col: 1 } };
  const changes = planEqualCells(input, block, 3, 3, 'width');
  assert.equal(changes.length, 6);
  assert.equal(changes.reduce((sum, c) => sum + c.widthDelta!, 0), 0);
  assert.ok(changes.every(c => c.cellIdx % 3 < 2));
  assert.equal(input[0].width + changes[0].widthDelta!, 1651);
  assert.equal(input[1].width + changes[1].widthDelta!, 1650);
  assert.equal(input[0].width, 1200);
});
test('equal heights preserve table size and reversed cell selection', () => {
  const updates = planEqualCells(cells(), { ...state, anchor: state.focus, focus: state.anchor }, 3, 3, 'height');
  assert.equal(updates.length, 6);
  assert.equal(updates.reduce((sum, u) => sum + u.heightDelta!, 0), 0);
  const after = cells().map(c => ({ ...c, height: c.height + (updates.find(u => u.cellIdx === c.cellIdx)?.heightDelta ?? 0) }));
  assert.ok(after.every(c => c.height === 2100));
  assert.deepEqual(planEqualCells(after, state, 3, 3, 'height'), []);
});
test('refuse partial, merged, discontinuous, stale or protected geometry before mutation', () => {
  for (const input of [cells().slice(0, 8), cells().map((c,i) => i === 0 ? { ...c, rowSpan: 2 } : c), cells().map((c,i) => i === 0 ? { ...c, cellProtect: true } : c), cells().map((c,i) => i === 0 ? { ...c, width: 0 } : c), cells().map((c,i) => i === 0 ? { ...c, width: 1400 } : c), cells().map((c,i) => i === 0 ? { ...c, col: 1 } : c)]) {
    assert.throws(() => planEqualCells(input, state, 3, 3, 'width'));
  }
  assert.throws(() => planEqualCells(cells(), { ...state, focus: { row: 1, col: 2 } }, 3, 3, 'width'));
  assert.throws(() => planEqualCells(cells(), { ...state, excluded: ['0:1'] }, 3, 3, 'height'));
  assert.throws(() => planEqualCells(cells(), { ...state, focus: { row: 3, col: 2 } }, 3, 3, 'height'));
});
test('nested search location and path are preserved without sharing mutable arrays', () => {
  const path = [{ controlIndex: 2, cellIndex: 3, cellParaIndex: 0 }, { controlIndex: 0, cellIndex: 1, cellParaIndex: 2 }];
  const hit = { sec: 1, para: 4, charOffset: 7, length: 2, cellContext: { parentPara: 4, ctrlIdx: 0, cellIdx: 1, cellPara: 2 }, cellPath: path };
  const pos = hitPosition(hit)!;
  assert.deepEqual(pos.cellPath, path); assert.notEqual(pos.cellPath, path);
  assert.equal(pos.parentParaIndex, 4); assert.equal(pos.charOffset, 7);
  assert.equal(hitPosition({ ...hit, equationControl: 0 }), null);
  assert.equal(hitPosition({ ...hit, charOffset: -1 }), null);
});
test('result navigation wraps and excerpts use open nested-cell text', () => {
  assert.equal(nextHitIndex(-1, 3, -1), 2); assert.equal(nextHitIndex(2, 3, 1), 0); assert.equal(nextHitIndex(0, 0, 1), -1);
  const hit = { sec: 1, para: 4, charOffset: 7, length: 2, cellContext: { parentPara: 4, ctrlIdx: 0, cellIdx: 1, cellPara: 2 }, cellPath: [{ controlIndex: 0, cellIndex: 1, cellParaIndex: 2 }] };
  assert.equal(searchExcerpt({ getTextInCellByPath: (sec: number, para: number, path: string, start: number) => { assert.equal(sec, 1); assert.equal(para, 4); assert.equal(start, 0); assert.deepEqual(JSON.parse(path), hit.cellPath); return '저장 전 내용'; } }, hit), '저장 전 내용');
});

test('equal heights distribute control-height surplus instead of leaving the last visible row tall', () => {
  const input = cells(), changes = planEqualHeights(input, state, 3, 3, 9000);
  assert.ok(input.every(c => c.height + (changes.find(u => u.cellIdx === c.cellIdx)?.heightDelta ?? 0) === 3000));
  assert.throws(() => planEqualHeights(input, { ...state, focus: { row: 1, col: 2 } }, 3, 3, 9000));
});