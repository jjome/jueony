import test from 'node:test';
import assert from 'node:assert/strict';
import { selectedObjectPropertyTarget, selectedObjectPropertiesAllowed, guardSelectedObjectConfirmation } from '../src/adapters/rhwp/selected-object-properties.ts';
const context = { hasDocument: true, isEditable: true, isFormMode: false };
const input = (ref: any) => ({ getSelectedPictureRef: () => ref, cursor: { isMultiPictureSelection: () => false }, wasm: {} });
test('canonical table object address is sufficient; no unrelated cursor cell is required', () => {
  const ref = { sec: 2, ppi: 3, ci: 4 }, ih = { getSelectedTableRef: () => ref, getCursorPosition: () => ({ sectionIndex: 0, paragraphIndex: 0, charOffset: 0 }), wasm: {} };
  assert.deepEqual(selectedObjectPropertyTarget(ih), { kind: 'table', ref }); assert.equal(selectedObjectPropertiesAllowed(context, ih), true);
  assert.notEqual(selectedObjectPropertyTarget(ih).ref, ref);
});
test('picture, shape, line, group and equation route to existing dialog kinds and preserve full cell/HF/note identity', () => {
  for (const type of ['image', 'shape', 'line', 'group', 'equation']) assert.equal(selectedObjectPropertyTarget(input({ sec: 0, ppi: 1, ci: 2, type })).kind, type === 'equation' ? 'equation' : 'picture');
  const ref = { sec: 0, ppi: 3, ci: 1, type: 'image', cellIdx: 4, cellParaIdx: 2, outerTableControlIdx: 7 };
  assert.deepEqual(selectedObjectPropertyTarget(input(ref)).ref.cellPath, [{ controlIdx: 7, cellIdx: 4, cellParaIdx: 2 }]); assert.equal((ref as any).cellPath, undefined);
  const hf = { sec: 0, ppi: 1, ci: 0, type: 'image', headerFooter: { kind: 'header', outerParaIdx: 0, outerControlIdx: 2 } }; assert.deepEqual(selectedObjectPropertyTarget(input(hf)).ref, hf);
  const note = { sec: 0, ppi: 1, ci: 0, type: 'equation', noteRef: { sectionIndex: 0, paragraphIndex: 0, controlIndex: 3 } }; assert.deepEqual(selectedObjectPropertyTarget(input(note)).ref, note);
});
test('read-only/form/IME/encrypted/multiple/unsupported/ambiguous objects are unavailable and give explicit reasons', () => {
  const base = input({ sec: 0, ppi: 1, ci: 2, type: 'image' });
  for (const invalid of [{ ...context, hasDocument: false }, { ...context, isEditable: false }, { ...context, isFormMode: true }]) assert.equal(selectedObjectPropertiesAllowed(invalid, base), false);
  assert.equal(selectedObjectPropertiesAllowed(context, { ...base, isComposing: true }), false); assert.equal(selectedObjectPropertiesAllowed(context, { ...base, wasm: { requiresPasswordForSave: true } }), false);
  for (const ref of [null, { sec: 0, ppi: 1, ci: 2, type: 'ole' }, { sec: 0, ppi: 1, ci: 2, type: 'shape', headerFooter: {} }, { sec: 0, ppi: 1, ci: 2, type: 'image', cellIdx: 3 }, { sec: -1, ppi: 1, ci: 2, type: 'image' }]) { assert.equal(selectedObjectPropertiesAllowed(context, input(ref)), false); assert.throws(() => selectedObjectPropertyTarget(input(ref))); }
  assert.throws(() => selectedObjectPropertyTarget({ ...base, cursor: { isMultiPictureSelection: () => true } }), /하나만/);
  assert.throws(() => selectedObjectPropertyTarget({ getSelectedTableRef: () => ({ sec: 0, ppi: 1, ci: 2, cellPath: [{}] }) }), /중첩 표/);
});
test('dialog confirmation checks state before legacy mutation and keeps the dialog open on stale state', () => {
  let allowed = true, calls = 0, errors: string[] = []; const dialog = { onConfirm() { calls++; return 'native'; } };
  guardSelectedObjectConfirmation(dialog, 'onConfirm', () => { if (!allowed) throw new Error('문서가 바뀜'); }, (_, message) => errors.push(message));
  assert.equal(dialog.onConfirm(), 'native'); allowed = false; assert.equal(dialog.onConfirm(), false); assert.equal(calls, 1); assert.deepEqual(errors, ['문서가 바뀜']);
  assert.throws(() => guardSelectedObjectConfirmation({}, 'handleOk', () => {}, () => {}), /계약/);
});
