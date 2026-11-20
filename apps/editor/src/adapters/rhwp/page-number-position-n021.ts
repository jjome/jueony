import {inspectShortcutStoryContextN021} from '../../shortcuts/special-story-context-n021.ts';

export type PageNumberPositionN021 = Readonly<{
  format: number;
  position: number;
  sideChar: string;
}>;

type BodyPositionN021 = Readonly<{
  sectionIndex: number;
  paragraphIndex: number;
  charOffset: number;
}>;

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const integer = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;

function parsed(value: unknown): Record<string, unknown> {
  const result = typeof value === 'string' ? JSON.parse(value) : value;
  if (!record(result)) throw new Error('쪽 번호 위치 상태를 읽지 못했습니다.');
  return result;
}

export function validatePageNumberPositionN021(value: unknown): PageNumberPositionN021 {
  if (!record(value) || Object.keys(value).sort().join(',') !== 'format,position,sideChar') {
    throw new Error('쪽 번호 위치/모양 요청이 올바르지 않습니다.');
  }
  const {format, position, sideChar} = value;
  if (!integer(format) || format > 7) throw new Error('지원하지 않는 쪽 번호 모양입니다.');
  if (!integer(position) || position < 1 || position > 10) throw new Error('지원하지 않는 쪽 번호 위치입니다.');
  if (typeof sideChar !== 'string' || Array.from(sideChar).length !== 1
    || sideChar.codePointAt(0)! > 0xffff || /[\u0000-\u001f\u007f]/u.test(sideChar)) {
    throw new Error('쪽 번호 장식 문자는 BMP 한 글자여야 합니다.');
  }
  return Object.freeze({format, position, sideChar});
}

export function readPageNumberPositionN021(document: unknown, sectionIndex: number): Record<string, unknown> {
  if (!record(document) || typeof document.getPageNumberPosition !== 'function') {
    throw new Error('이 편집 엔진은 쪽 번호 매기기를 지원하지 않습니다.');
  }
  const result = parsed(document.getPageNumberPosition.call(document, sectionIndex));
  if (result.ok !== true || typeof result.exists !== 'boolean') {
    throw new Error('쪽 번호 위치 상태를 읽지 못했습니다.');
  }
  return result;
}

function exactBodyPosition(value: unknown): BodyPositionN021 {
  if (!record(value) || !integer(value.sectionIndex) || !integer(value.paragraphIndex)
    || !integer(value.charOffset)) {
    throw new Error('현재 본문 위치를 확인하지 못했습니다.');
  }
  return Object.freeze({
    sectionIndex: value.sectionIndex,
    paragraphIndex: value.paragraphIndex,
    charOffset: value.charOffset,
  });
}

function documentHandle(wasm: unknown): Record<string, unknown> {
  if (!record(wasm) || typeof wasm.borrowDocumentHandle !== 'function') {
    throw new Error('문서 엔진 연결을 확인하지 못했습니다.');
  }
  const document = wasm.borrowDocumentHandle.call(wasm);
  if (!record(document)) throw new Error('문서 엔진 연결을 확인하지 못했습니다.');
  return document;
}

function assertSingleSection(document: Record<string, unknown>): void {
  if (typeof document.getSectionCount !== 'function'
    || document.getSectionCount.call(document) !== 1) {
    throw new Error('다구역 쪽 번호 매기기는 아직 지원하지 않습니다.');
  }
}

/**
 * Routes the durable Rust mutation through exactly one Studio snapshot.
 * The core repeats all structural checks inside the snapshot operation, so a
 * stale preflight becomes a rollback rather than a partial document change.
 */
export function applyPageNumberPositionN021(input: unknown, requested: unknown): void {
  const next = validatePageNumberPositionN021(requested);
  if (!record(input)) throw new Error('편집기 입력 연결을 확인하지 못했습니다.');
  const story = inspectShortcutStoryContextN021(input);
  if (story.kind !== 'body' || !story.exact) {
    throw new Error('쪽 번호 매기기는 최상위 본문에서만 실행할 수 있습니다.');
  }
  if (typeof input.getPosition !== 'function' || typeof input.executeOperation !== 'function') {
    throw new Error('편집기 명령 연결을 확인하지 못했습니다.');
  }
  const position = exactBodyPosition(input.getPosition.call(input));
  const initialDocument = documentHandle(input.wasm);
  assertSingleSection(initialDocument);
  if (position.sectionIndex !== 0) throw new Error('현재 본문 구역을 확인하지 못했습니다.');
  if (readPageNumberPositionN021(initialDocument, position.sectionIndex).exists === true) {
    throw new Error('현재 구역에 이미 쪽 번호 위치 컨트롤이 있습니다.');
  }

  input.executeOperation.call(input, {
    kind: 'snapshot',
    operationType: 'jueonyPageNumberPositionN021',
    operation(wasm: unknown) {
      const currentDocument = documentHandle(wasm);
      assertSingleSection(currentDocument);
      if (readPageNumberPositionN021(currentDocument, position.sectionIndex).exists === true) {
        throw new Error('현재 구역의 쪽 번호 상태가 변경되었습니다. 다시 실행해 주세요.');
      }
      if (typeof currentDocument.insertPageNumberPosition !== 'function') {
        throw new Error('이 편집 엔진은 쪽 번호 매기기를 지원하지 않습니다.');
      }
      const receipt = parsed(currentDocument.insertPageNumberPosition.call(
        currentDocument,
        position.sectionIndex,
        position.paragraphIndex,
        JSON.stringify(next),
      ));
      if (receipt.ok !== true || receipt.inserted !== true) {
        throw new Error('쪽 번호 매기기를 적용하지 못했습니다.');
      }
      const observed = readPageNumberPositionN021(currentDocument, position.sectionIndex);
      if (observed.exists !== true || observed.paragraphIdx !== position.paragraphIndex
        || observed.format !== next.format || observed.position !== next.position
        || observed.sideChar !== next.sideChar) {
        throw new Error('쪽 번호 매기기 적용 결과를 확인하지 못했습니다.');
      }
      return position;
    },
    meta: Object.freeze({
      actionId: 'page:page-number-dialog',
      domain: 'page',
      refresh: 'full',
      dirtyScope: 'document',
    }),
  });
}
