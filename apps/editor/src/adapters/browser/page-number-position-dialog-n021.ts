import {
  applyPageNumberPositionN021,
  pageNumberSectionCountN021,
  readStoredPageNumberPositionN021,
  type PageNumberPositionN021,
  type StoredPageNumberPositionN021,
} from '../rhwp/page-number-position-n021.ts';
import {inspectShortcutStoryContextN021} from '../../shortcuts/special-story-context-n021.ts';

type JsonRecord = Record<string, unknown>;

export type PageNumberPositionDialogEnvironmentN021 = Readonly<{
  input(): unknown;
  editor(): unknown;
  context(): unknown;
}>;

export type PageNumberPositionDialogTargetN021 = Readonly<{
  input: JsonRecord;
  document: JsonRecord;
  revision: string;
  identity: string;
  sectionCount: number;
  position: Readonly<{sectionIndex: number; paragraphIndex: number; charOffset: number}>;
  existing?:StoredPageNumberPositionN021;
}>;

const record = (value: unknown): value is JsonRecord =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const integer = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;

function safeContext(value: unknown): value is JsonRecord {
  return record(value)
    && value.hasDocument === true
    && value.isEditable === true
    && value.isFormMode === false
    && value.inTable !== true
    && value.inCellSelectionMode !== true
    && value.inPictureObjectSelection !== true
    && value.inTableObjectSelection !== true;
}

function positionOf(input: JsonRecord): PageNumberPositionDialogTargetN021['position'] {
  if (typeof input.getPosition !== 'function') throw new Error('현재 본문 위치를 확인하지 못했습니다.');
  const value = input.getPosition.call(input);
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

function documentOf(input: JsonRecord): JsonRecord {
  const wasm = input.wasm;
  if (!record(wasm) || typeof wasm.borrowDocumentHandle !== 'function') {
    throw new Error('문서 엔진 연결을 확인하지 못했습니다.');
  }
  const document = wasm.borrowDocumentHandle.call(wasm);
  if (!record(document) || typeof document.insertPageNumberPosition !== 'function') {
    throw new Error('이 편집 엔진은 쪽 번호 매기기를 지원하지 않습니다.');
  }
  return document;
}

function stringCall(value: JsonRecord, name: string, message: string): string {
  const method = value[name];
  if (typeof method !== 'function') throw new Error(message);
  const result = method.call(value);
  if (typeof result !== 'string' || result.length === 0) throw new Error(message);
  return result;
}

function defaultEnvironment(): PageNumberPositionDialogEnvironmentN021 {
  return {
    input: () => (window as any).rhwpStudio?.services?.getInputHandler?.()
      ?? (window as any).rhwpStudio?.inputHandler,
    editor: () => (window as any).jueonyEditor,
    context: () => (window as any).rhwpStudio?.automation?.getContext?.(),
  };
}

/** Captures the exact document/caret owner before the modal opens. */
export function capturePageNumberPositionDialogTargetN021(
  environment: PageNumberPositionDialogEnvironmentN021,
  context: unknown = environment.context(),
): PageNumberPositionDialogTargetN021 {
  if (!safeContext(context)) throw new Error('현재 문맥에서는 쪽 번호 매기기를 열 수 없습니다.');
  const input = environment.input();
  if (!record(input) || input.isComposing !== false) {
    throw new Error('한글 조합을 마친 뒤 다시 실행해 주세요.');
  }
  const story = inspectShortcutStoryContextN021(input);
  if (story.kind !== 'body' || !story.exact) {
    throw new Error('쪽 번호 매기기는 최상위 본문에서만 실행할 수 있습니다.');
  }
  const document = documentOf(input);
  const position = positionOf(input);
  const sectionCount = pageNumberSectionCountN021(document, position.sectionIndex);
  const existing=readStoredPageNumberPositionN021(document,position.sectionIndex);
  if(existing&&typeof document.updatePageNumberPosition!=='function'){
    throw new Error('이 편집 엔진은 기존 쪽 번호 위치 변경을 지원하지 않습니다.');
  }
  const editor = environment.editor();
  if (!record(editor) || typeof editor.busy !== 'function' || editor.busy.call(editor)) {
    throw new Error('다른 문서 작업이 끝난 뒤 다시 실행해 주세요.');
  }
  return Object.freeze({
    input,
    document,
    revision: stringCall(editor, 'revision', '문서 버전을 확인하지 못했습니다.'),
    identity: stringCall(editor, 'documentIdentity', '문서 identity를 확인하지 못했습니다.'),
    sectionCount,
    position,
    ...(existing?{existing}:{}),
  });
}

/** Revalidates every captured owner signal immediately before the snapshot. */
export function assertPageNumberPositionDialogTargetN021(
  environment: PageNumberPositionDialogEnvironmentN021,
  target: PageNumberPositionDialogTargetN021,
  ownedDialog?: HTMLDialogElement,
): void {
  if (!safeContext(environment.context()) || environment.input() !== target.input
    || target.input.isComposing !== false) {
    throw new Error('문서나 편집 문맥이 바뀌었습니다. 창을 다시 여세요.');
  }
  const editor = environment.editor();
  if (!record(editor) || typeof editor.busy !== 'function'
    || editor.busy.call(editor, ownedDialog)
    || stringCall(editor, 'revision', '문서 버전을 확인하지 못했습니다.') !== target.revision
    || stringCall(editor, 'documentIdentity', '문서 identity를 확인하지 못했습니다.') !== target.identity) {
    throw new Error('문서가 바뀌었습니다. 창을 다시 여세요.');
  }
  const story = inspectShortcutStoryContextN021(target.input);
  if (story.kind !== 'body' || !story.exact
    || documentOf(target.input) !== target.document
    || JSON.stringify(positionOf(target.input)) !== JSON.stringify(target.position)
    || pageNumberSectionCountN021(target.document, target.position.sectionIndex) !== target.sectionCount
    || JSON.stringify(readStoredPageNumberPositionN021(target.document,target.position.sectionIndex))!==JSON.stringify(target.existing)) {
    throw new Error('본문 위치나 쪽 번호 상태가 바뀌었습니다. 창을 다시 여세요.');
  }
}

/** Testable confirmation seam; the adapter owns the one snapshot and readback. */
export function commitPageNumberPositionDialogN021(
  environment: PageNumberPositionDialogEnvironmentN021,
  target: PageNumberPositionDialogTargetN021,
  value: PageNumberPositionN021,
  options: Readonly<{dialog?: HTMLDialogElement; composing?: boolean}> = {},
): void {
  if (options.composing) throw new Error('대화상자 입력 조합을 마친 뒤 적용해 주세요.');
  assertPageNumberPositionDialogTargetN021(environment, target, options.dialog);
  applyPageNumberPositionN021(target.input,value,target.existing);
}

export function canOpenPageNumberPositionDialogN021(
  context: unknown,
  environment: PageNumberPositionDialogEnvironmentN021,
): boolean {
  try {
    capturePageNumberPositionDialogTargetN021(environment, context);
    return true;
  } catch {
    return false;
  }
}

const formats = Object.freeze([
  '아라비아 숫자', '원 숫자', '로마 대문자', '로마 소문자',
  '영문 대문자', '영문 소문자', '한글', '한자',
]);
const positions = Object.freeze([
  '위 왼쪽', '위 가운데', '위 오른쪽', '아래 왼쪽', '아래 가운데',
  '아래 오른쪽', '바깥쪽 위', '바깥쪽 아래', '안쪽 위', '안쪽 아래',
]);

function select(values: readonly string[], initial: number): HTMLSelectElement {
  const element = document.createElement('select');
  values.forEach((label, index) => element.add(new Option(label, String(index + initial))));
  return element;
}

export function showPageNumberPositionDialogN021(
  environment: PageNumberPositionDialogEnvironmentN021 = defaultEnvironment(),
): HTMLDialogElement {
  if (document.getElementById('jueony-page-number-position-n021')) {
    throw new Error('쪽 번호 매기기 창이 이미 열려 있습니다.');
  }
  const target = capturePageNumberPositionDialogTargetN021(environment);
  const dialog = document.createElement('dialog');
  dialog.id = 'jueony-page-number-position-n021';
  dialog.className = 'jueony-page-dialog';
  dialog.style.maxWidth = 'min(520px,calc(100vw - 32px))';
  const title = document.createElement('h2'); title.textContent = '쪽 번호 매기기';
  const scope = document.createElement('p');
  const section = target.sectionCount === 1 ? '현재 구역' : `${target.position.sectionIndex + 1}구역`;
  scope.textContent = target.existing
    ? `${section}의 기존 쪽 번호 위치와 모양을 바꿉니다.`
    : `${section}에 쪽 번호 위치와 모양을 지정합니다.`;
  if (target.position.sectionIndex + 1 < target.sectionCount) {
    scope.append(' 뒤에 쪽 번호 설정이 없는 구역은 앞 구역의 설정을 이어받습니다.');
  }
  const format = select(formats, 0);
  format.value=String(target.existing?.properties.format??0);
  const position = select(positions, 1); position.value = String(target.existing?.properties.position??5);
  const side = document.createElement('input'); side.value = target.existing?.properties.sideChar??'-'; side.maxLength = 1;
  side.setAttribute('aria-label', '쪽 번호 장식 문자');
  let composing = false;
  side.addEventListener('compositionstart', () => { composing = true; });
  side.addEventListener('compositionend', () => { composing = false; });
  const error = document.createElement('p'); error.setAttribute('role', 'alert');
  const form = document.createElement('form'); form.method = 'dialog';
  const row = (label: string, control: HTMLElement) => {
    const wrapper = document.createElement('label'); wrapper.textContent = label; wrapper.append(control); return wrapper;
  };
  const apply = document.createElement('button'); apply.type = 'submit'; apply.textContent = '설정';
  const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = '취소';
  cancel.onclick = () => dialog.close('cancel');
  form.append(row('번호 모양 ', format), row('위치 ', position), row('장식 문자 ', side), error, apply, cancel);
  form.onsubmit = event => {
    event.preventDefault(); error.textContent = '';
    try {
      commitPageNumberPositionDialogN021(environment, target, {
        format: Number(format.value), position: Number(position.value), sideChar: side.value,
      }, {dialog, composing});
      dialog.close('applied');
    } catch (cause) {
      error.textContent = cause instanceof Error ? cause.message : '쪽 번호 매기기를 적용하지 못했습니다.';
    }
  };
  dialog.append(title, scope, form);
  dialog.addEventListener('cancel', event => { if (composing) event.preventDefault(); });
  dialog.addEventListener('close', () => dialog.remove(), {once: true});
  document.body.append(dialog); dialog.showModal(); format.focus();
  return dialog;
}

export function installPageNumberPositionDialogN021(options: Readonly<{
  registry: {register(definition: JsonRecord): void};
  input: () => unknown;
  environment?: PageNumberPositionDialogEnvironmentN021;
}>): void {
  const environment = options.environment ?? {
    ...defaultEnvironment(),
    input: options.input,
  };
  options.registry.register({
    id: 'page:page-number-dialog',
    label: '쪽 번호 매기기',
    shortcutLabel: 'Ctrl+N,P',
    opensDialog: true,
    canExecute: (context: unknown) => canOpenPageNumberPositionDialogN021(context, environment),
    execute: () => { showPageNumberPositionDialogN021(environment); },
  });
}
