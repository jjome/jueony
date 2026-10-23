import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deleteForwardWordWithinCellBoundary, sameDeletionCell } from '../src/shortcuts/cell-word-deletion.ts';
import { patchCellWordDeletion } from '../scripts/integration/cell-word-deletion-patches.mjs';

const cell = { sectionIndex: 0, parentParaIndex: 1, paragraphIndex: 0, charOffset: 3, controlIndex: 0, cellIndex: 2, cellParaIndex: 0,
  cellPath: [{ controlIndex: 0, cellIndex: 2, cellParaIndex: 0 }] };

test('cell identity compares every nested table and cell while permitting paragraphs of the same cell', () => {
  assert.equal(sameDeletionCell(cell, { ...cell, paragraphIndex: 1, charOffset: 0, cellParaIndex: 1, cellPath: [{ controlIndex: 0, cellIndex: 2, cellParaIndex: 1 }] }), true);
  assert.equal(sameDeletionCell(cell, { ...cell, cellPath: undefined }), true);
  for (const end of [{ sectionIndex: 0, paragraphIndex: 1, charOffset: 0 }, { ...cell, sectionIndex: 1 }, { ...cell, parentParaIndex: 2 }, { ...cell, cellPath: [{ controlIndex: 0, cellIndex: 3 }] }, { ...cell, cellPath: [{ controlIndex: 0, cellIndex: 2 }, { controlIndex: 0, cellIndex: 0 }] }]) assert.equal(sameDeletionCell(cell, end), false);
  const nested = { ...cell, cellPath: [...cell.cellPath, { controlIndex: 1, cellIndex: 0, cellParaIndex: 0 }] };
  assert.equal(sameDeletionCell(nested, { ...nested, cellPath: [nested.cellPath[0], { controlIndex: 1, cellIndex: 1, cellParaIndex: 0 }] }), false);
});

test('automatic word deletion at a cell edge restores the caret without a deletion command', () => {
  for (const destination of [{ ...cell, cellIndex: 3, cellPath: [{ controlIndex: 0, cellIndex: 3, cellParaIndex: 0 }], charOffset: 0 }, { sectionIndex: 0, paragraphIndex: 2, charOffset: 0 }]) {
    let position: any = cell, selected = false, deleted = false, repainted = false;
    deleteForwardWordWithinCellBoundary({ cursor: { hasSelection: () => selected, isInCell: () => true, isInTextBox: () => false, getPosition: () => position, setAnchor: () => { selected = true; }, moveToWordBoundary: () => { position = destination; }, clearSelection: () => { selected = false; }, moveTo: (next: any) => { position = next; } }, deleteSelection: () => { deleted = true; }, updateCaret: () => { repainted = true; } });
    assert.equal(deleted, false); assert.equal(selected, false); assert.deepEqual(position, cell); assert.equal(repainted, true);
  }
});

test('nested cell identity retains ancestor paragraph indices but allows leaf paragraph changes', () => {
  const nested = { ...cell, cellPath: [{ controlIndex: 0, cellIndex: 2, cellParaIndex: 0 }, { controlIndex: 0, cellIndex: 0, cellParaIndex: 0 }] };
  assert.equal(sameDeletionCell(nested, { ...nested, cellPath: [{ ...nested.cellPath[0], cellParaIndex: 1 }, nested.cellPath[1]] }), false);
  assert.equal(sameDeletionCell(nested, { ...nested, cellPath: [nested.cellPath[0], { ...nested.cellPath[1], cellParaIndex: 1 }] }), true);
  for (const invalid of [undefined, -1, 0.5, NaN]) {
    assert.equal(sameDeletionCell(nested, { ...nested, cellPath: [{ ...nested.cellPath[0], cellParaIndex: invalid }, nested.cellPath[1]] }), false);
  }
});

test('same-cell and body words use the existing delete path; explicit selections are not reinterpreted', () => {
  for (const initial of [cell, { sectionIndex: 0, paragraphIndex: 0, charOffset: 0 }]) {
    let selected = false, deleted = 0;
    const cursor = { hasSelection: () => selected, isInCell: () => initial === cell, isInTextBox: () => false, getPosition: () => initial, setAnchor: () => { selected = true; }, moveToWordBoundary: () => {} };
    deleteForwardWordWithinCellBoundary({ cursor, deleteSelection: () => { deleted++; } }); assert.equal(deleted, 1);
  }
  let deleted = 0;
  deleteForwardWordWithinCellBoundary({ cursor: { hasSelection: () => true, getPosition: () => { throw Error('selection must not be moved'); } }, deleteSelection: () => { deleted++; } }); assert.equal(deleted, 1);
});

test('cell boundary patch is scoped to Ctrl+Delete and refuses an upstream seam change', () => {
  const source = readFileSync(new URL('../../../upstream/rhwp-source/rhwp-studio/src/engine/input-handler-keyboard.ts', import.meta.url), 'utf8');
  const patched = patchCellWordDeletion(source);
  assert.match(patched, /case 'delete': \{[\s\S]*?if \(this\.isFormMode\?\.\(\)\) return;\n      deleteForwardWordWithinCellBoundary\(this\);/);
  assert.throws(() => patchCellWordDeletion(source.replace('// Ctrl+Delete (Win/Linux): 다음 단어 경계까지 삭제', '// moved')), /drift/);
});
