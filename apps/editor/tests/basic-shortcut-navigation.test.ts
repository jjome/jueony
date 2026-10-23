import test from 'node:test';
import assert from 'node:assert/strict';
import { deleteBodyByShortcut, isBodyNavigationContext, navigateBody } from '../src/shortcuts/body-navigation.ts';
import { HangulKeyResolver } from '../src/shortcuts/keymap.ts';

const context = { hasDocument: true, isEditable: true, isFormMode: false };
function harness() {
  let position = { sectionIndex: 0, paragraphIndex: 1, charOffset: 3 };
  let anchor: typeof position | null = null;
  let block = false;
  const calls: string[] = [];
  const cursor = {
    getPosition: () => ({ ...position }),
    setAnchor: () => { calls.push('anchor'); anchor ??= { ...position }; },
    clearSelection: () => { calls.push('clear'); anchor = null; },
    hasSelection: () => anchor !== null && JSON.stringify(anchor) !== JSON.stringify(position),
    isInBlockSelectionMode: () => block,
    isInHeaderFooter: () => false, isInFootnote: () => false, isInTextBox: () => false,
    moveTo: (next: typeof position) => { calls.push('move'); position = { ...next }; },
    moveToDocumentStart: () => { position = { sectionIndex: 0, paragraphIndex: 0, charOffset: 0 }; },
    moveToDocumentEnd: () => { position = { sectionIndex: 1, paragraphIndex: 2, charOffset: 7 }; },
    moveToHit: (hit: typeof position) => { calls.push('hit'); position = { ...hit }; },
    moveToLineStart: () => { calls.push('line-start'); position.charOffset = 0; },
    moveToLineEnd: () => { calls.push('line-end'); position.charOffset = 7; },
    moveHorizontal: () => { calls.push('horizontal'); position.paragraphIndex++; position.charOffset = 0; },
    moveToWordBoundary: () => { calls.push('word'); position.charOffset = 6; },
  };
  const input = {
    cursor, getCursorPosition: () => cursor.getPosition(),
    wasm: { getParagraphLength: () => 7 },
    container: { getBoundingClientRect: () => ({ left: 0, top: 0, bottom: 100, width: 100, height: 100 }) },
    hitTestFromClientPoint: (_x: number, _y: number): any => ({ sectionIndex: 0, paragraphIndex: 5, charOffset: 3 }),
    flushDeferredPaginationIfNeeded: () => { calls.push('flush'); },
    updateCaret: (skip?: boolean) => { calls.push(skip ? 'caret-without-scroll' : 'caret'); },
    focus: () => { calls.push('focus'); },
    deleteSelection: () => { calls.push('delete'); anchor = null; },
  };
  return { input, calls, cursor, get anchor() { return anchor; }, get position() { return position; }, setBlock: (value: boolean) => { block = value; } };
}
const key = (name: string, extra: Record<string, unknown> = {}) => ({ key: name, code: name.length === 1 ? 'Key' + name.toUpperCase() : name, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, repeat: false, isComposing: false, ...extra });
const keyContext = { table: false, cells: false, object: false };

test('boundary selection holds its original anchor through extension, reversal and repeated events', () => {
  const h = harness(), initial = h.position;
  assert.equal(navigateBody(h.input, 'document-end', true), true);
  assert.deepEqual(h.anchor, initial);
  assert.equal(navigateBody(h.input, 'document-start', true), true);
  assert.deepEqual(h.anchor, initial); assert.equal(h.position.paragraphIndex, 0);
  assert.equal(navigateBody(h.input, 'paragraph-end', true), true);
  assert.deepEqual(h.anchor, initial); assert.equal(h.position.charOffset, 7);
  assert.equal(navigateBody(h.input, 'paragraph-start'), true);
  assert.equal(h.anchor, null); assert.equal(h.position.charOffset, 0);
});
test('F3 selection extends through unmodified movement instead of losing its anchor', () => {
  const h = harness(), initial = h.position; h.setBlock(true); h.cursor.setAnchor();
  assert.equal(navigateBody(h.input, 'document-end'), true);
  assert.deepEqual(h.anchor, initial); assert.ok(!h.calls.includes('clear'));
});
test('screen-edge selection uses live hit testing and does not scroll the screen away', () => {
  const h = harness(), initial = h.position;
  assert.equal(navigateBody(h.input, 'screen-start', true), true);
  assert.deepEqual(h.anchor, initial); assert.equal(h.position.paragraphIndex, 5); assert.equal(h.position.charOffset, 0);
  assert.ok(h.calls.includes('caret-without-scroll'));
});
test('missing body hit or malformed arguments keep prior cursor and selection intact', () => {
  const h = harness(); h.cursor.setAnchor(); h.cursor.moveTo({ ...h.position, charOffset: 5 });
  const before = { anchor: h.anchor, position: h.position };
  h.input.hitTestFromClientPoint = () => ({ parentParaIndex: 0 });
  assert.equal(navigateBody(h.input, 'screen-end', true), false);
  assert.equal(navigateBody(h.input, 'garbage', true), false);
  assert.equal(navigateBody(h.input, 'document-end', 'true'), false);
  assert.deepEqual({ anchor: h.anchor, position: h.position }, before);
});
test('read-only body navigation stays available while table, object and special-story paths are excluded', () => {
  const h = harness();
  assert.equal(isBodyNavigationContext({ ...context, isEditable: false }, h.input), true);
  for (const field of ['isFormMode', 'inTable', 'inCellSelectionMode', 'inPictureObjectSelection', 'inTableObjectSelection']) assert.equal(isBodyNavigationContext({ ...context, [field]: true }, h.input), false, field);
  assert.equal(isBodyNavigationContext({ ...context, hasDocument: false }, h.input), false);
  for (const method of ['isInHeaderFooter', 'isInFootnote', 'isInTextBox'] as const) {
    h.cursor[method] = () => true; assert.equal(isBodyNavigationContext(context, h.input), false, method); h.cursor[method] = () => false;
  }
});
test('Ctrl+T deletes an existing selection without discarding it or extending to another word', () => {
  const h = harness(); h.cursor.setAnchor(); h.cursor.moveTo({ ...h.position, charOffset: 1 }); h.calls.length = 0;
  deleteBodyByShortcut(h.input, 'word');
  assert.deepEqual(h.calls, ['flush', 'delete', 'caret', 'focus']);
});
test('Ctrl+T at a caret still deletes the next word; line deletion still includes its paragraph break', () => {
  const h = harness(); deleteBodyByShortcut(h.input, 'word'); assert.ok(h.calls.includes('word')); assert.ok(h.calls.includes('delete'));
  h.calls.length = 0; deleteBodyByShortcut(h.input, 'line'); assert.ok(h.calls.includes('line-start')); assert.ok(h.calls.includes('horizontal')); assert.ok(h.calls.includes('delete'));
});
test('Shift boundary variants resolve to the same navigation contract with an explicit selection flag', () => {
  const r = new HangulKeyResolver();
  for (const [keyName, edge] of [['PageUp', 'document-start'], ['PageDown', 'document-end'], ['Home', 'screen-start'], ['End', 'screen-end']]) {
    const found = r.resolve(key(keyName, { ctrlKey: true, shiftKey: true }), keyContext).binding;
    assert.equal(found?.params?.edge, edge); assert.equal(found?.params?.extend, true);
  }
  for (const [keyName, edge] of [['Home', 'paragraph-start'], ['End', 'paragraph-end']]) assert.equal(r.resolve(key(keyName, { altKey: true, shiftKey: true }), keyContext).binding?.params?.edge, edge);
});
test('held relative edits and deletion repeat while toggles and file actions run only once', () => {
  const r = new HangulKeyResolver();
  for (const [letter, modifiers, expected] of [
    ['E', { altKey: true, shiftKey: true }, 'format:font-size-increase'],
    ['W', { altKey: true, shiftKey: true }, 'format:char-spacing-increase'],
    ['J', { altKey: true, shiftKey: true }, 'format:char-ratio-decrease'],
    ['Z', { altKey: true, shiftKey: true }, 'format:line-spacing-increase'],
    ['T', { ctrlKey: true }, 'ext:jueony-delete-word'],
  ] as const) assert.equal(r.resolve(key(letter, { ...modifiers, repeat: true }), keyContext).binding?.command, expected);
  for (const letter of ['B', 'S']) assert.equal(r.resolve(key(letter, { ctrlKey: true, repeat: true }), keyContext).binding, undefined);
});
test('AltGr text input is not misinterpreted as Ctrl+Alt and cancels a pending chord', () => {
  const r = new HangulKeyResolver(); r.resolve(key('N', { ctrlKey: true }), keyContext);
  assert.equal(r.resolve(key('V', { ctrlKey: true, altKey: true, getModifierState: (modifier: string) => modifier === 'AltGraph' }), keyContext).handled, false);
  assert.equal(r.resolve(key('T'), keyContext).handled, false);
  assert.equal(r.resolve(key('V', { ctrlKey: true, altKey: true }), keyContext).binding?.command, 'edit:paste-special');
});
