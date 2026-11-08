import assert from 'node:assert/strict';
import test from 'node:test';
import {HangulKeyResolver} from '../src/shortcuts/keymap.ts';
import {
  inspectShortcutStoryContextN021,
  resolveShortcutAtInputBoundaryN021,
  shortcutKeyContextN021,
} from '../src/shortcuts/special-story-context-n021.ts';

const key = (code: string, mods: Record<string, unknown> = {}) => ({
  key: code.startsWith('Key') ? code.slice(3).toLowerCase() : code,
  code,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  metaKey: false,
  repeat: false,
  isComposing: false,
  ...mods,
});

function input(story: 'body' | 'header' | 'footer' | 'footnote' | 'endnote' | 'textbox') {
  const note = story === 'footnote' || story === 'endnote';
  const cursor = {
    isInHeaderFooter: () => story === 'header' || story === 'footer',
    headerFooterMode: story === 'header' || story === 'footer' ? story : 'none',
    isInFootnote: () => note,
    isInTextBox: () => story === 'textbox',
    nestingDepth: () => story === 'textbox' ? 1 : 0,
    fnSectionIdx: 1,
    fnParaIdx: 2,
    fnControlIdx: 3,
  };
  return {
    cursor,
    getCursorPosition: () => ({isTextBox: story === 'textbox'}),
    wasm: {getNoteEditInfo: () => JSON.stringify({ok: true, kind: story})},
  };
}

test('body, header, footer and textbox use exact cursor signals without guessing', () => {
  for (const story of ['body', 'header', 'footer', 'textbox'] as const) {
    assert.deepEqual(inspectShortcutStoryContextN021(input(story)), {kind: story, exact: true});
  }
});

test('the shared note mode is split into footnote and endnote by the bounded document observer', () => {
  assert.deepEqual(inspectShortcutStoryContextN021(input('footnote')), {kind: 'footnote', exact: true});
  const borrowed = input('endnote');
  borrowed.wasm = {borrowDocumentHandle: () => ({getNoteEditInfo: () => ({ok: true, kind: 'endnote', text: 'not exposed'})})} as never;
  assert.deepEqual(inspectShortcutStoryContextN021(borrowed), {kind: 'endnote', exact: true});
});

test('missing, throwing, contradictory and malformed signals fail closed as unknown', () => {
  assert.equal(inspectShortcutStoryContextN021(undefined).kind, 'unknown');
  assert.equal(inspectShortcutStoryContextN021({cursor: {}}).reason, 'cursor-signal-unavailable');
  const throwing = input('body'); throwing.cursor.isInTextBox = () => { throw new Error('boom'); };
  assert.equal(inspectShortcutStoryContextN021(throwing).reason, 'cursor-signal-failed');
  const conflict = input('header'); conflict.cursor.isInTextBox = () => true;
  conflict.getCursorPosition = () => ({isTextBox: true});
  assert.equal(inspectShortcutStoryContextN021(conflict).reason, 'cursor-signal-conflict');
  const badNote = input('endnote'); badNote.wasm = {getNoteEditInfo: () => ({ok: true, kind: 'comment'})} as never;
  assert.equal(inspectShortcutStoryContextN021(badNote).reason, 'note-observer-invalid');
});

test('flat textbox cell-like sentinel does not become a table/object shortcut scope', () => {
  assert.deepEqual(shortcutKeyContextN021({inTable: true, inCellSelectionMode: true, inPictureObjectSelection: true}, input('textbox')), {
    table: false,
    cells: false,
    object: false,
    story: {kind: 'textbox', exact: true},
  });
});

test('document body fallback is handled without a binding in every special story and unknown state', () => {
  for (const story of ['header', 'footer', 'footnote', 'endnote', 'textbox'] as const) {
    const result = resolveShortcutAtInputBoundaryN021(new HangulKeyResolver(), key('Enter', {ctrlKey: true}), {}, input(story));
    assert.equal(result.handled, true, story);
    assert.equal(result.binding, undefined, story);
    assert.match(result.hint ?? '', /본문 단축키/);
  }
  const result = resolveShortcutAtInputBoundaryN021(new HangulKeyResolver(), key('F7'), {}, {cursor: {}});
  assert.equal(result.handled, true);
  assert.equal(result.binding, undefined);
  assert.match(result.hint ?? '', /확인하지 못해/);
});

test('body fallback resolves only in body while a verified nested textbox table keeps its explicit table scope', () => {
  const body = resolveShortcutAtInputBoundaryN021(new HangulKeyResolver(), key('Enter', {ctrlKey: true}), {}, input('body'));
  assert.equal(body.binding?.command, 'page:break');
  const flatTextbox = resolveShortcutAtInputBoundaryN021(new HangulKeyResolver(), key('Enter', {ctrlKey: true}), {inTable: true}, input('textbox'));
  assert.equal(flatTextbox.binding, undefined);
  const nested = input('textbox'); nested.cursor.nestingDepth = () => 2;
  const table = resolveShortcutAtInputBoundaryN021(new HangulKeyResolver(), key('Enter', {ctrlKey: true}), {inTable: true}, nested);
  assert.equal(table.binding?.command, 'table:insert-row-below');
});

test('trusted native clipboard bindings remain delegated instead of becoming a body fallback', () => {
  const result = resolveShortcutAtInputBoundaryN021(new HangulKeyResolver(), key('KeyC', {ctrlKey: true}), {}, input('endnote'));
  assert.equal(result.binding?.command, 'edit:copy');
  assert.equal(result.binding?.nativeClipboard, true);
});

test('chord follow-up cannot escape from a special story into a document binding', () => {
  const resolver = new HangulKeyResolver(), current = input('header');
  const prefix = resolveShortcutAtInputBoundaryN021(resolver, key('KeyN', {ctrlKey: true}), {}, current, 0);
  assert.equal(prefix.handled, true);
  const result = resolveShortcutAtInputBoundaryN021(resolver, key('KeyT'), {}, current, 1);
  assert.equal(result.handled, true);
  assert.equal(result.binding, undefined);
  assert.match(result.hint ?? '', /본문 단축키/);
});
