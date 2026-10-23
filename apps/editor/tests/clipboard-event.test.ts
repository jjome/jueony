import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateClipboardSelection, writeCutClipboardEvent } from '../src/editor-actions/clipboard-event.ts';
const p = (charOffset = 0) => ({ sectionIndex: 0, paragraphIndex: 0, charOffset });
test('event clipboard requires both original text and rich HTML accepted verbatim', () => {
  const values = new Map<string, string>(); const data = { setData: (type: string, value: string) => { values.set(type, value); }, getData: (type: string) => values.get(type) ?? '' };
  writeCutClipboardEvent(data, '가😀', '<b>가😀</b>'); assert.equal(values.get('text/plain'), '가😀'); assert.equal(values.get('text/html'), '<b>가😀</b>');
});
test('missing, throwing or silently read-only clipboard never grants permission to delete', () => {
  assert.throws(() => writeCutClipboardEvent(null, '원문', '<b>원문</b>'));
  assert.throws(() => writeCutClipboardEvent({ setData() { throw new Error('denied'); }, getData: () => '' }, '원문', '<b>원문</b>'), /denied/);
  assert.throws(() => writeCutClipboardEvent({ setData() {}, getData: () => '' }, '원문', '<b>원문</b>'));
  assert.throws(() => writeCutClipboardEvent({ setData() {}, getData: () => '' }, '원문', ''), /서식/);
});
test('partially accepted plain text cannot stand in for full rich selection', () => {
  assert.throws(() => writeCutClipboardEvent({ setData() {}, getData: type => type === 'text/plain' ? '원문' : '' }, '원문', '<b>원문</b>'), /모두 기록/);
});
test('same section body and same leaf-cell multiparagraph selections are addressable', () => {
  validateClipboardSelection(p(1), p(3)); validateClipboardSelection(p(1), { ...p(), paragraphIndex: 2 });
  const a = { ...p(1), parentParaIndex: 0, cellPath: [{ controlIndex: 2, cellIndex: 1, cellParaIndex: 0 }, { controlIndex: 0, cellIndex: 0, cellParaIndex: 0 }] };
  validateClipboardSelection(a, { ...a, charOffset: 2, cellPath: [a.cellPath[0], { ...a.cellPath[1], cellParaIndex: 1 }] });
});
test('cross-section, cross-cell, stale paths and empty ranges fail before any clipboard mutation', () => {
  assert.throws(() => validateClipboardSelection(p(), { ...p(2), sectionIndex: 1 }), /구역/); assert.throws(() => validateClipboardSelection(p(2), p(2)));
  const cell = { ...p(), parentParaIndex: 0, controlIndex: 2, cellIndex: 0, cellParaIndex: 0 };
  assert.throws(() => validateClipboardSelection(cell, { ...cell, charOffset: 2, cellIndex: 1 }), /서로 다른/); assert.throws(() => validateClipboardSelection(cell, p(2)));
  assert.throws(() => validateClipboardSelection({ ...cell, cellPath: [] }, { ...cell, charOffset: 2 }));
});
