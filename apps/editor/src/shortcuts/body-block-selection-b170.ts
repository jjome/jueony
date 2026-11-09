import {inspectShortcutStoryContextN021} from './special-story-context-n021.ts';

type PositionB170 = Readonly<{
  sectionIndex: number;
  paragraphIndex: number;
  charOffset: number;
}>;

type SelectionB170 = Readonly<{
  anchor: PositionB170;
  focus: PositionB170;
}>;

type StageB170 = 0 | 1 | 3 | 5;

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const integer = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;

function invoke(target: Record<string, unknown>, name: string, ...args: unknown[]): unknown {
  const fn = target[name];
  if (typeof fn !== 'function') throw new Error(`${name} 기능을 확인하지 못했습니다.`);
  return fn.call(target, ...args);
}

function position(value: unknown): PositionB170 {
  if (!record(value) || !integer(value.sectionIndex) || !integer(value.paragraphIndex)
    || !integer(value.charOffset) || value.parentParaIndex !== undefined) {
    throw new Error('본문 선택 위치를 확인하지 못했습니다.');
  }
  return Object.freeze({
    sectionIndex: value.sectionIndex,
    paragraphIndex: value.paragraphIndex,
    charOffset: value.charOffset,
  });
}

function same(left: PositionB170, right: PositionB170): boolean {
  return left.sectionIndex === right.sectionIndex
    && left.paragraphIndex === right.paragraphIndex
    && left.charOffset === right.charOffset;
}

function compare(left: PositionB170, right: PositionB170): number {
  return left.sectionIndex - right.sectionIndex
    || left.paragraphIndex - right.paragraphIndex
    || left.charOffset - right.charOffset;
}

function selection(value: unknown): SelectionB170 | null {
  if (value === null) return null;
  if (!record(value)) throw new Error('본문 선택 범위를 확인하지 못했습니다.');
  return Object.freeze({anchor: position(value.anchor), focus: position(value.focus)});
}

function ordered(value: SelectionB170): Readonly<{start: PositionB170; end: PositionB170}> {
  return compare(value.anchor, value.focus) <= 0
    ? Object.freeze({start: value.anchor, end: value.focus})
    : Object.freeze({start: value.focus, end: value.anchor});
}

function phase(value: unknown): StageB170 | null | 'unsupported' {
  if (value === null) return null;
  return value === 0 || value === 1 || value === 3 || value === 5
    ? value
    : 'unsupported';
}

function cursor(input: Record<string, unknown>): Record<string, unknown> {
  if (!record(input.cursor)) throw new Error('본문 선택 커서를 확인하지 못했습니다.');
  const required = [
    'blockSelectionPhase', 'getPosition', 'getSelection', 'enterBlockSelectionMode',
    'exitBlockSelectionMode', 'expandSelection', 'selectRange', 'moveTo',
  ];
  if (required.some(name => typeof (input.cursor as Record<string, unknown>)[name] !== 'function')) {
    throw new Error('본문 선택 커서 기능을 확인하지 못했습니다.');
  }
  return input.cursor;
}

function snapshot(cursorValue: Record<string, unknown>): Readonly<{
  phase: StageB170 | null | 'unsupported';
  position: PositionB170;
  selection: SelectionB170 | null;
}> {
  return Object.freeze({
    phase: phase(invoke(cursorValue, 'blockSelectionPhase')),
    position: position(invoke(cursorValue, 'getPosition')),
    selection: selection(invoke(cursorValue, 'getSelection')),
  });
}

function restore(cursorValue: Record<string, unknown>, before: ReturnType<typeof snapshot>): void {
  if (before.phase === null) {
    invoke(cursorValue, 'exitBlockSelectionMode');
    invoke(cursorValue, 'moveTo', before.position);
  } else if (before.phase !== 'unsupported' && before.selection) {
    const restored = invoke(
      cursorValue,
      'selectRange',
      before.selection.anchor,
      before.selection.focus,
      before.phase,
    );
    if (restored !== true) throw new Error('본문 선택 상태를 되돌리지 못했습니다.');
  } else {
    throw new Error('본문 선택 상태를 되돌릴 수 없습니다.');
  }
  const after = snapshot(cursorValue);
  if (after.phase !== before.phase || !same(after.position, before.position)
    || JSON.stringify(after.selection) !== JSON.stringify(before.selection)) {
    throw new Error('본문 선택 상태가 정확히 복원되지 않았습니다.');
  }
}

function assertStage(
  input: Record<string, unknown>,
  cursorValue: Record<string, unknown>,
  expected: StageB170,
  origin: PositionB170,
): void {
  const after = snapshot(cursorValue);
  if (after.phase !== expected || !after.selection) {
    throw new Error('본문 블록 선택 단계를 확인하지 못했습니다.');
  }
  const range = ordered(after.selection);
  if (expected === 0) {
    if (!same(range.start, origin) || !same(range.end, origin)) {
      throw new Error('본문 블록 선택 시작점을 확인하지 못했습니다.');
    }
    return;
  }
  if (compare(range.start, origin) > 0 || compare(range.end, origin) < 0
    || same(range.start, range.end)) {
    throw new Error('본문 블록 선택 범위를 확인하지 못했습니다.');
  }
  if (expected === 1 && (range.start.sectionIndex !== origin.sectionIndex
    || range.start.paragraphIndex !== origin.paragraphIndex
    || range.end.sectionIndex !== origin.sectionIndex
    || range.end.paragraphIndex !== origin.paragraphIndex)) {
    throw new Error('단어 선택이 현재 문단을 벗어났습니다.');
  }
  if (expected === 3) {
    if (!record(input.wasm) || typeof input.wasm.getParagraphLength !== 'function') {
      throw new Error('문단 길이를 확인하지 못했습니다.');
    }
    const length = invoke(
      input.wasm,
      'getParagraphLength',
      origin.sectionIndex,
      origin.paragraphIndex,
    );
    if (!integer(length) || !same(range.start, {...origin, charOffset: 0})
      || !same(range.end, {...origin, charOffset: length})) {
      throw new Error('문단 전체 선택을 확인하지 못했습니다.');
    }
  }
  if (expected === 5) {
    if (!record(input.wasm) || typeof input.wasm.getSectionCount !== 'function'
      || typeof input.wasm.getParagraphCount !== 'function'
      || typeof input.wasm.getParagraphLength !== 'function') {
      throw new Error('문서 범위를 확인하지 못했습니다.');
    }
    const sectionCount = invoke(input.wasm, 'getSectionCount');
    if (!integer(sectionCount) || sectionCount < 1) throw new Error('문서 범위를 확인하지 못했습니다.');
    const lastSection = sectionCount - 1;
    const paragraphCount = invoke(input.wasm, 'getParagraphCount', lastSection);
    if (!integer(paragraphCount) || paragraphCount < 1) throw new Error('문서 범위를 확인하지 못했습니다.');
    const lastParagraph = paragraphCount - 1;
    const length = invoke(input.wasm, 'getParagraphLength', lastSection, lastParagraph);
    if (!integer(length) || !same(range.start, {sectionIndex: 0, paragraphIndex: 0, charOffset: 0})
      || !same(range.end, {sectionIndex: lastSection, paragraphIndex: lastParagraph, charOffset: length})) {
      throw new Error('문서 전체 선택을 확인하지 못했습니다.');
    }
  }
}

/**
 * Maps Hancom 2024's four F3 presses onto the pinned engine's five internal
 * expansion phases: enter mode -> word -> paragraph -> document. Sentence and
 * section remain internal engine phases and are deliberately skipped.
 */
export function handleBodyBlockSelectionB170(inputValue: unknown, eventValue: unknown): boolean {
  if (!record(inputValue) || !record(eventValue) || eventValue.key !== 'F3'
    || eventValue.ctrlKey === true || eventValue.altKey === true
    || eventValue.shiftKey === true || eventValue.metaKey === true) return false;
  const story = inspectShortcutStoryContextN021(inputValue);
  if (story.kind !== 'body' || !story.exact) return false;
  if (typeof inputValue.getCursorPosition !== 'function') return false;
  let livePosition: unknown;
  try { livePosition = inputValue.getCursorPosition.call(inputValue); }
  catch { return false; }
  if (!record(livePosition) || livePosition.parentParaIndex !== undefined
    || (Array.isArray(livePosition.cellPath) && livePosition.cellPath.length > 0)
    || livePosition.isTextBox === true) return false;
  const cursorValue = cursor(inputValue);
  const before = snapshot(cursorValue);
  if (before.phase === 'unsupported') {
    if (typeof eventValue.preventDefault === 'function') eventValue.preventDefault.call(eventValue);
    return true;
  }
  if (eventValue.isComposing === true || eventValue.repeat === true) {
    if (typeof eventValue.preventDefault === 'function') eventValue.preventDefault.call(eventValue);
    return true;
  }
  if (typeof eventValue.preventDefault === 'function') eventValue.preventDefault.call(eventValue);
  const expected: StageB170 = before.phase === null ? 0
    : before.phase === 0 ? 1
      : before.phase === 1 ? 3 : 5;
  try {
    if (before.phase === null) invoke(cursorValue, 'enterBlockSelectionMode');
    else if (before.phase === 0) invoke(cursorValue, 'expandSelection');
    else if (before.phase === 1 || before.phase === 3) {
      invoke(cursorValue, 'expandSelection');
      invoke(cursorValue, 'expandSelection');
    }
    assertStage(inputValue, cursorValue, expected, before.position);
    if (typeof inputValue.updateSelection === 'function') inputValue.updateSelection.call(inputValue);
    if (typeof inputValue.focus === 'function') inputValue.focus.call(inputValue);
    return true;
  } catch (error) {
    restore(cursorValue, before);
    throw error;
  }
}

