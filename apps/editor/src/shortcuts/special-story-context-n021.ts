export type ShortcutStoryKindN021 =
  | 'body'
  | 'header'
  | 'footer'
  | 'footnote'
  | 'endnote'
  | 'textbox'
  | 'unknown';

export type ShortcutStoryUnknownReasonN021 =
  | 'input-unavailable'
  | 'cursor-unavailable'
  | 'cursor-signal-unavailable'
  | 'cursor-signal-failed'
  | 'cursor-signal-conflict'
  | 'header-footer-mode-mismatch'
  | 'textbox-position-mismatch'
  | 'note-address-unavailable'
  | 'note-observer-unavailable'
  | 'note-observer-failed'
  | 'note-observer-invalid';

export type ShortcutStoryContextN021 = Readonly<{
  kind: ShortcutStoryKindN021;
  exact: boolean;
  reason?: ShortcutStoryUnknownReasonN021;
}>;

export type ShortcutKeyContextN021 = Readonly<{
  table: boolean;
  cells: boolean;
  object: boolean;
  story: ShortcutStoryContextN021;
}>;

type ShortcutEventN021 = Readonly<{
  key: string;
  code?: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
  repeat: boolean;
  isComposing: boolean;
  getModifierState?(key: string): boolean;
}>;

type ShortcutResolverPortN021<Result> = Readonly<{
  resolve(event: ShortcutEventN021, context: ShortcutKeyContextN021, now?: number): Result;
}>;

type BoolRead = Readonly<{
  ok: boolean;
  value?: boolean;
  failed?: boolean;
}>;

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const integer = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;

const unknown = (reason: ShortcutStoryUnknownReasonN021): ShortcutStoryContextN021 =>
  Object.freeze({kind: 'unknown', exact: false, reason});

function readBoolean(target: Record<string, unknown>, name: string): BoolRead {
  const method = target[name];
  if (typeof method !== 'function') return {ok: false};
  try {
    const value = method.call(target);
    return typeof value === 'boolean' ? {ok: true, value} : {ok: false};
  } catch {
    return {ok: false, failed: true};
  }
}

function parseBounded(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  if (value.length > 1024 * 1024) return undefined;
  try { return JSON.parse(value); }
  catch { return undefined; }
}

function noteKind(input: Record<string, unknown>, cursor: Record<string, unknown>): ShortcutStoryContextN021 {
  const section = cursor.fnSectionIdx;
  const paragraph = cursor.fnParaIdx;
  const control = cursor.fnControlIdx;
  if (![section, paragraph, control].every(integer)) return unknown('note-address-unavailable');

  const wasm = input.wasm;
  if (!record(wasm)) return unknown('note-observer-unavailable');
  let document: Record<string, unknown> = wasm;
  if (typeof wasm.borrowDocumentHandle === 'function') {
    try {
      const borrowed = wasm.borrowDocumentHandle.call(wasm);
      if (!record(borrowed)) return unknown('note-observer-unavailable');
      document = borrowed;
    } catch {
      return unknown('note-observer-failed');
    }
  }
  if (typeof document.getNoteEditInfo !== 'function') return unknown('note-observer-unavailable');
  let observed: unknown;
  try { observed = parseBounded(document.getNoteEditInfo.call(document, section, paragraph, control)); }
  catch { return unknown('note-observer-failed'); }
  if (!record(observed) || observed.ok !== true || !['footnote', 'endnote'].includes(String(observed.kind))) {
    return unknown('note-observer-invalid');
  }
  return Object.freeze({kind: observed.kind as 'footnote' | 'endnote', exact: true});
}

/**
 * Reads only bounded cursor identity signals. It never guesses a body story
 * from a missing/throwing cursor method, and it never exposes note contents.
 */
export function inspectShortcutStoryContextN021(inputValue: unknown): ShortcutStoryContextN021 {
  if (!record(inputValue)) return unknown('input-unavailable');
  const cursor = inputValue.cursor;
  if (!record(cursor)) return unknown('cursor-unavailable');

  const headerFooter = readBoolean(cursor, 'isInHeaderFooter');
  const note = readBoolean(cursor, 'isInFootnote');
  const textbox = readBoolean(cursor, 'isInTextBox');
  const signals = [headerFooter, note, textbox];
  if (signals.some(signal => signal.failed)) return unknown('cursor-signal-failed');
  if (signals.some(signal => !signal.ok)) return unknown('cursor-signal-unavailable');

  const mode = cursor.headerFooterMode;
  if (headerFooter.value === true && mode !== 'header' && mode !== 'footer') {
    return unknown('header-footer-mode-mismatch');
  }
  if (headerFooter.value === false && (mode === 'header' || mode === 'footer')) {
    return unknown('header-footer-mode-mismatch');
  }

  if (typeof inputValue.getCursorPosition === 'function') {
    try {
      const position = inputValue.getCursorPosition.call(inputValue);
      if (record(position) && typeof position.isTextBox === 'boolean' && position.isTextBox !== textbox.value) {
        return unknown('textbox-position-mismatch');
      }
    } catch {
      return unknown('cursor-signal-failed');
    }
  }

  const active = [headerFooter.value, note.value, textbox.value].filter(Boolean).length;
  if (active > 1) return unknown('cursor-signal-conflict');
  if (headerFooter.value) return Object.freeze({kind: mode as 'header' | 'footer', exact: true});
  if (note.value) return noteKind(inputValue, cursor);
  if (textbox.value) return Object.freeze({kind: 'textbox', exact: true});
  return Object.freeze({kind: 'body', exact: true});
}

export function shortcutKeyContextN021(automationContext: unknown, input: unknown): ShortcutKeyContextN021 {
  const context = record(automationContext) ? automationContext : {};
  const story = inspectShortcutStoryContextN021(input);
  let structural = {table: false, cells: false, object: false};
  if (story.kind === 'body' && record(input) && record(input.cursor)) {
    structural = {
      table: context.inTable === true || context.inCellSelectionMode === true,
      cells: context.inCellSelectionMode === true,
      object: context.inPictureObjectSelection === true || context.inTableObjectSelection === true,
    };
  } else if (story.kind === 'textbox' && record(input) && record(input.cursor)) {
    // The upstream cursor models a plain textbox as a one-level cell-like
    // list. Only depth 2+ is an actual table nested in that textbox.
    let depth: number | undefined;
    const nestingDepth = input.cursor.nestingDepth;
    if (typeof nestingDepth === 'function') {
      try {
        const value = nestingDepth.call(input.cursor);
        if (integer(value)) depth = value;
      } catch { /* retain fail-closed structural flags */ }
    }
    if (depth === undefined && typeof input.getCursorPosition === 'function') {
      try {
        const position = input.getCursorPosition.call(input);
        if (record(position) && Array.isArray(position.cellPath)) depth = position.cellPath.length;
      } catch { /* story inspection already classified signal failure */ }
    }
    const nestedTable = depth !== undefined && depth >= 2;
    structural = {
      table: nestedTable && (context.inTable === true || context.inCellSelectionMode === true),
      cells: nestedTable && context.inCellSelectionMode === true,
      object: false,
    };
  }
  return Object.freeze({
    ...structural,
    story,
  });
}

/** Connects the live InputHandler evidence to the resolver without a body default. */
export function resolveShortcutAtInputBoundaryN021<Result>(
  resolver: ShortcutResolverPortN021<Result>,
  event: ShortcutEventN021,
  automationContext: unknown,
  input: unknown,
  now?: number,
): Result {
  return resolver.resolve(event, shortcutKeyContextN021(automationContext, input), now);
}
