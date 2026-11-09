import {inspectShortcutStoryContextN021} from '../../shortcuts/special-story-context-n021.ts';

export type NumberFieldKindB116 = 'current-page' | 'total-pages';

type BodyPositionB116 = Readonly<{
  sectionIndex: number;
  paragraphIndex: number;
  charOffset: number;
}>;

type ControlEvidenceB116 = Readonly<{
  ctrlId: string;
  list: number;
  para: number;
  pos: number;
  controlIndex: number;
}>;

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const integer = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;

function parseBounded(value: unknown, label: string): unknown {
  if (typeof value !== 'string') return value;
  if (value.length > 4 * 1024 * 1024) throw new Error(`${label} 응답이 너무 큽니다.`);
  try { return JSON.parse(value); }
  catch { throw new Error(`${label} 응답을 읽지 못했습니다.`); }
}

function exactPosition(value: unknown): BodyPositionB116 {
  if (!record(value) || !integer(value.sectionIndex) || !integer(value.paragraphIndex)
    || !integer(value.charOffset)) {
    throw new Error('번호 필드를 넣을 본문 위치를 확인하지 못했습니다.');
  }
  return Object.freeze({
    sectionIndex: value.sectionIndex,
    paragraphIndex: value.paragraphIndex,
    charOffset: value.charOffset,
  });
}

function samePosition(left: BodyPositionB116, right: BodyPositionB116): boolean {
  return left.sectionIndex === right.sectionIndex
    && left.paragraphIndex === right.paragraphIndex
    && left.charOffset === right.charOffset;
}

function documentHandle(wasm: unknown): Record<string, unknown> {
  if (!record(wasm) || typeof wasm.borrowDocumentHandle !== 'function') {
    throw new Error('문서 엔진 연결을 확인하지 못했습니다.');
  }
  const document = wasm.borrowDocumentHandle.call(wasm);
  if (!record(document)) throw new Error('문서 엔진 연결을 확인하지 못했습니다.');
  return document;
}

function controls(document: Record<string, unknown>): readonly ControlEvidenceB116[] {
  if (typeof document.getControls !== 'function') {
    throw new Error('번호 필드 적용 결과를 확인할 수 없는 엔진입니다.');
  }
  const raw = parseBounded(document.getControls.call(document), '컨트롤 목록');
  if (!Array.isArray(raw)) throw new Error('컨트롤 목록을 확인하지 못했습니다.');
  return Object.freeze(raw.map((value): ControlEvidenceB116 => {
    if (!record(value) || typeof value.ctrlId !== 'string' || !integer(value.list)
      || !integer(value.para) || !integer(value.pos) || !integer(value.controlIndex)) {
      throw new Error('컨트롤 목록의 주소가 올바르지 않습니다.');
    }
    return Object.freeze({
      ctrlId: value.ctrlId,
      list: value.list,
      para: value.para,
      pos: value.pos,
      controlIndex: value.controlIndex,
    });
  }));
}

function assertCollapsedRootBody(input: Record<string, unknown>): BodyPositionB116 {
  if (input.isComposing !== false) throw new Error('한글 입력 조합 중에는 번호 필드를 넣을 수 없습니다.');
  if (!record(input.wasm) || input.wasm.requiresPasswordForSave === true) {
    throw new Error('암호 문서에는 번호 필드를 넣을 수 없습니다.');
  }
  if (typeof input.isFormMode !== 'function') throw new Error('문서 편집 상태를 확인하지 못했습니다.');
  let formMode: unknown;
  try { formMode = input.isFormMode.call(input); }
  catch { throw new Error('문서 편집 상태를 확인하지 못했습니다.'); }
  if (typeof formMode !== 'boolean') throw new Error('문서 편집 상태를 확인하지 못했습니다.');
  if (formMode) throw new Error('양식 모드에서는 번호 필드를 넣을 수 없습니다.');
  const story = inspectShortcutStoryContextN021(input);
  if (story.kind !== 'body' || !story.exact) {
    throw new Error('번호 필드는 최상위 본문에서만 넣을 수 있습니다.');
  }
  const cursor = input.cursor;
  if (!record(cursor) || typeof cursor.hasSelection !== 'function'
    || typeof cursor.isInTableObjectSelection !== 'function'
    || typeof cursor.isInPictureObjectSelection !== 'function') {
    throw new Error('현재 선택 상태를 확인하지 못했습니다.');
  }
  let selected: unknown;
  let tableObject: unknown;
  let pictureObject: unknown;
  try {
    selected = cursor.hasSelection.call(cursor);
    tableObject = cursor.isInTableObjectSelection.call(cursor);
    pictureObject = cursor.isInPictureObjectSelection.call(cursor);
  } catch {
    throw new Error('현재 선택 상태를 확인하지 못했습니다.');
  }
  if ([selected, tableObject, pictureObject].some(value => typeof value !== 'boolean')) {
    throw new Error('현재 선택 상태를 확인하지 못했습니다.');
  }
  if (selected || tableObject || pictureObject) {
    throw new Error('선택을 해제하고 본문 캐럿에서 번호 필드를 넣어 주세요.');
  }
  if (typeof input.getPosition !== 'function' || typeof input.getCursorPosition !== 'function') {
    throw new Error('현재 본문 위치를 확인하지 못했습니다.');
  }
  const position = exactPosition(input.getPosition.call(input));
  const cursorPosition = input.getCursorPosition.call(input);
  if (!record(cursorPosition) || cursorPosition.parentParaIndex !== undefined
    || (Array.isArray(cursorPosition.cellPath) && cursorPosition.cellPath.length > 0)
    || cursorPosition.isTextBox === true) {
    throw new Error('표·글상자 안에는 번호 필드를 넣을 수 없습니다.');
  }
  const observed = exactPosition(cursorPosition);
  if (!samePosition(position, observed)) throw new Error('현재 본문 위치가 일치하지 않습니다.');
  return position;
}

function assertDocumentTarget(document: Record<string, unknown>, position: BodyPositionB116): void {
  if (typeof document.getSectionCount !== 'function'
    || document.getSectionCount.call(document) !== 1) {
    throw new Error('다구역 번호 필드 삽입은 아직 지원하지 않습니다.');
  }
  if (position.sectionIndex !== 0 || typeof document.getParagraphCount !== 'function'
    || typeof document.getParagraphLength !== 'function') {
    throw new Error('번호 필드를 넣을 본문 위치를 확인하지 못했습니다.');
  }
  const count = document.getParagraphCount.call(document, 0);
  if (!integer(count) || position.paragraphIndex >= count) {
    throw new Error('번호 필드를 넣을 문단이 없습니다.');
  }
  const length = document.getParagraphLength.call(document, 0, position.paragraphIndex);
  if (!integer(length) || position.charOffset > length) {
    throw new Error('번호 필드를 넣을 글자 위치가 올바르지 않습니다.');
  }
}

function receipt(value: unknown): Record<string, unknown> {
  const parsed = parseBounded(value, '번호 필드 삽입');
  if (!record(parsed)) throw new Error('번호 필드 삽입 결과를 읽지 못했습니다.');
  return parsed;
}

function targetControls(
  items: readonly ControlEvidenceB116[],
  position: BodyPositionB116,
): readonly ControlEvidenceB116[] {
  return items.filter(item => item.list === 0 && item.para === position.paragraphIndex);
}

function targetIds(items: readonly ControlEvidenceB116[], position: BodyPositionB116): string {
  return JSON.stringify(targetControls(items, position).map(item => item.ctrlId).sort());
}

function outsideTarget(items: readonly ControlEvidenceB116[], paragraph: number): string {
  return JSON.stringify(items.filter(item => item.list !== 0 || item.para !== paragraph));
}

/**
 * Inserts the durable HWP/HWPX AutoNumber field through the public Rust/WASM
 * boundary. The field kind is deliberately limited to the two kinds whose
 * serializer contract already exists: Page and TotalPage.
 */
export function applyNumberFieldB116(inputValue: unknown, kind: NumberFieldKindB116): void {
  if (!record(inputValue)) throw new Error('편집기 입력 연결을 확인하지 못했습니다.');
  if (kind !== 'current-page' && kind !== 'total-pages') {
    throw new Error('지원하지 않는 번호 필드입니다.');
  }
  const position = assertCollapsedRootBody(inputValue);
  if (typeof inputValue.executeOperation !== 'function') {
    throw new Error('편집기 명령 연결을 확인하지 못했습니다.');
  }
  const initialDocument = documentHandle(inputValue.wasm);
  assertDocumentTarget(initialDocument, position);
  if (typeof initialDocument.insertAutoNumberAtCursor !== 'function') {
    throw new Error('이 편집 엔진은 번호 필드 삽입을 지원하지 않습니다.');
  }
  const before = controls(initialDocument);
  const targetBefore = targetControls(before, position);
  if (targetBefore.some(item => !['secd', 'cold'].includes(item.ctrlId))) {
    throw new Error('필드나 개체가 있는 문단에는 번호 필드를 넣을 수 없습니다.');
  }
  const expectedTargetIds = JSON.stringify([...targetBefore.map(item => item.ctrlId), 'atno'].sort());
  const outside = outsideTarget(before, position.paragraphIndex);

  inputValue.executeOperation.call(inputValue, {
    kind: 'snapshot',
    operationType: 'jueonyNumberFieldB116',
    operation(wasm: unknown) {
      const livePosition = assertCollapsedRootBody(inputValue);
      if (!samePosition(position, livePosition)) {
        throw new Error('본문 위치가 바뀌었습니다. 다시 실행해 주세요.');
      }
      const document = documentHandle(wasm);
      assertDocumentTarget(document, position);
      const current = controls(document);
      if (JSON.stringify(current) !== JSON.stringify(before)) {
        throw new Error('문서 컨트롤 상태가 바뀌었습니다. 다시 실행해 주세요.');
      }
      if (typeof document.insertAutoNumberAtCursor !== 'function') {
        throw new Error('이 편집 엔진은 번호 필드 삽입을 지원하지 않습니다.');
      }
      const result = receipt(document.insertAutoNumberAtCursor.call(
        document,
        0,
        position.paragraphIndex,
        position.charOffset,
        kind === 'current-page' ? 'current' : 'total',
      ));
      if (result.ok !== true) throw new Error('번호 필드를 넣지 못했습니다.');
      const after = controls(document);
      // `getControls().pos` is the engine's stream position. The insertion API
      // accepts a character offset and converts it to that stream coordinate,
      // so the two values are not interchangeable around control characters.
      // The guarded paragraph, exact +1 control delta and id multiset prove
      // the durable AutoNumber insertion without making that false assumption.
      const inserted = targetControls(after, position)
        .filter(item => item.ctrlId === 'atno');
      if (after.length !== before.length + 1
        || inserted.length !== 1
        || targetIds(after, position) !== expectedTargetIds
        || outsideTarget(after, position.paragraphIndex) !== outside) {
        throw new Error('번호 필드 적용 결과를 확인하지 못했습니다.');
      }
      return position;
    },
    meta: Object.freeze({
      actionId: kind === 'current-page' ? 'insert:current-page-number' : 'insert:total-page-number',
      domain: 'insert',
      refresh: 'full',
      dirtyScope: 'document',
    }),
  });
}

type NumberFieldRegistryB116 = Readonly<{
  register(command: Readonly<{
    id: string;
    label: string;
    canExecute(context: unknown): boolean;
    execute(): void;
  }>): void;
}>;

function safeCommandContext(value: unknown): boolean {
  return record(value) && value.hasDocument === true && value.isEditable === true
    && value.isFormMode === false && value.inTable !== true
    && value.inCellSelectionMode !== true && value.inPictureObjectSelection !== true
    && value.inTableObjectSelection !== true;
}

function canApplyNumberFieldB116(inputValue: unknown): boolean {
  try {
    if (!record(inputValue)) return false;
    const position = assertCollapsedRootBody(inputValue);
    const document = documentHandle(inputValue.wasm);
    assertDocumentTarget(document, position);
    if (typeof document.insertAutoNumberAtCursor !== 'function') return false;
    return targetControls(controls(document), position)
      .every(item => ['secd', 'cold'].includes(item.ctrlId));
  } catch { return false; }
}

/**
 * Registers explicit commands without inventing a Hancom shortcut. The pinned
 * Studio build hook remains a separate composition concern while its shared
 * patch file is under concurrent modification.
 */
export function installNumberFieldCommandsB116(
  registry: NumberFieldRegistryB116,
  input: () => unknown,
): void {
  for (const [id, label, kind] of [
    ['insert:current-page-number', '현재 쪽 번호 필드', 'current-page'],
    ['insert:total-page-number', '전체 쪽수 필드', 'total-pages'],
  ] as const) {
    registry.register(Object.freeze({
      id,
      label,
      canExecute: (context: unknown) => safeCommandContext(context)
        && canApplyNumberFieldB116(input()),
      execute: () => {
        const current = input();
        applyNumberFieldB116(current, kind);
        if (record(current) && typeof current.focus === 'function') current.focus.call(current);
      },
    }));
  }
}

