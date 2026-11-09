import {inspectShortcutStoryContextN021} from '../../shortcuts/special-story-context-n021.ts';
import {executePlainText, readPlainTextPlan} from './plain-text-native.ts';

export type SpellcheckIssueKindB137 = 'spelling' | 'spacing';

export type SpellcheckIssueB137 = Readonly<{
  kind: SpellcheckIssueKindB137;
  start: number;
  end: number;
  original: string;
  suggestions: readonly string[];
}>;

export type SpellcheckSessionB137 = Readonly<{
  requestId: string;
  locale: 'ko-KR';
  dictionaryVersion: string;
  issues: readonly SpellcheckIssueB137[];
}>;

export type SpellcheckProviderB137 = Readonly<{
  capabilities(): unknown;
  check(request: Readonly<{
    requestId: string;
    locale: 'ko-KR';
    dictionaryVersion: string;
    text: string;
  }>): Promise<unknown>;
}>;

export type SpellcheckEnvironmentB137 = Readonly<{
  input(): unknown;
  editor(): unknown;
  context(): unknown;
  provider?: SpellcheckProviderB137;
  createRequestId(): string;
}>;

export type SpellcheckCapabilityB137 = Readonly<{
  available: boolean;
  reason?:
    | 'provider-unavailable'
    | 'provider-invalid'
    | 'provider-online'
    | 'locale-unsupported'
    | 'dictionary-unavailable';
  dictionaryVersion?: string;
  maxCodePoints?: number;
}>;

type Position = Readonly<{
  sectionIndex: number;
  paragraphIndex: number;
  charOffset: number;
}>;

type Selection = Readonly<{start: Position; end: Position}>;

type Owner = Readonly<{
  input: Record<string, unknown>;
  document: Record<string, unknown>;
  identity: string;
  revision: string;
  selection: Selection;
  paragraphText: string;
  selectedText: string;
}>;

type SessionState = Readonly<{
  environment: SpellcheckEnvironmentB137;
  owner: Owner;
  session: SpellcheckSessionB137;
  consumed: {value: boolean};
}>;

const states = new WeakMap<object, SessionState>();

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const integer = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;

const exactString = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= max
  && !/[\u0000-\u001f\u007f]/u.test(value);

function position(value: unknown): Position {
  if (!record(value) || !integer(value.sectionIndex) || !integer(value.paragraphIndex)
    || !integer(value.charOffset) || value.parentParaIndex !== undefined || value.isTextBox === true
    || (Array.isArray(value.cellPath) && value.cellPath.length > 0)) {
    throw new Error('맞춤법 검사 선택 범위를 확인하지 못했습니다.');
  }
  return Object.freeze({
    sectionIndex: value.sectionIndex,
    paragraphIndex: value.paragraphIndex,
    charOffset: value.charOffset,
  });
}

function selection(value: unknown): Selection {
  if (!record(value)) throw new Error('맞춤법 검사할 글자를 선택해 주세요.');
  const start = position(value.start);
  const end = position(value.end);
  if (start.sectionIndex !== end.sectionIndex || start.paragraphIndex !== end.paragraphIndex
    || start.charOffset >= end.charOffset) {
    throw new Error('최상위 본문 한 문단 안에서 글자를 선택해 주세요.');
  }
  return Object.freeze({start, end});
}

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function documentOf(input: Record<string, unknown>): Record<string, unknown> {
  const wasm = input.wasm;
  if (!record(wasm) || wasm.requiresPasswordForSave === true
    || typeof wasm.borrowDocumentHandle !== 'function') {
    throw new Error('맞춤법 검사를 위한 문서 엔진 연결을 확인하지 못했습니다.');
  }
  const document = wasm.borrowDocumentHandle.call(wasm);
  if (!record(document)) throw new Error('맞춤법 검사를 위한 문서 엔진 연결을 확인하지 못했습니다.');
  return document;
}

function parsedArray(value: unknown, label: string): readonly unknown[] {
  let parsed = value;
  if (typeof value === 'string') {
    if (value.length > 4 * 1024 * 1024) throw new Error(`${label} 응답이 너무 큽니다.`);
    try { parsed = JSON.parse(value); }
    catch { throw new Error(`${label} 응답을 읽지 못했습니다.`); }
  }
  if (!Array.isArray(parsed)) throw new Error(`${label} 응답을 확인하지 못했습니다.`);
  return parsed;
}

function invoke(target: Record<string, unknown>, name: string, ...args: unknown[]): unknown {
  const method = target[name];
  if (typeof method !== 'function') throw new Error('본문 검사 API를 확인하지 못했습니다.');
  return method.call(target, ...args);
}

function safeContext(value: unknown): boolean {
  return record(value) && value.hasDocument === true && value.isEditable === true
    && value.isFormMode === false && value.inField !== true && value.inTable !== true
    && value.inCellSelectionMode !== true && value.inTableObjectSelection !== true
    && value.inPictureObjectSelection !== true;
}

function owner(environment: SpellcheckEnvironmentB137, allowOwnedMutation = false): Owner {
  if (!safeContext(environment.context())) throw new Error('현재 문맥에서는 맞춤법 검사를 실행할 수 없습니다.');
  const inputValue = environment.input();
  if (!record(inputValue) || inputValue.isComposing !== false) {
    throw new Error('한글 조합을 마친 뒤 맞춤법 검사를 실행해 주세요.');
  }
  const story = inspectShortcutStoryContextN021(inputValue);
  if (story.kind !== 'body' || !story.exact) {
    throw new Error('맞춤법 검사는 최상위 본문 선택에서만 실행할 수 있습니다.');
  }
  if (typeof inputValue.getSelection !== 'function') throw new Error('맞춤법 검사할 글자를 선택해 주세요.');
  const selected = selection(inputValue.getSelection.call(inputValue));
  const editor = environment.editor();
  if (!record(editor) || typeof editor.busy !== 'function'
    || (!allowOwnedMutation && editor.busy.call(editor))
    || typeof editor.documentIdentity !== 'function' || typeof editor.revision !== 'function') {
    throw new Error('문서 identity와 revision을 확인하지 못했습니다.');
  }
  const identity = editor.documentIdentity.call(editor);
  const revision = editor.revision.call(editor);
  if (!exactString(identity, 1024)
    || (!exactString(revision, 1024) && !(typeof revision === 'number' && Number.isSafeInteger(revision)))) {
    throw new Error('문서 identity와 revision을 확인하지 못했습니다.');
  }
  const document = documentOf(inputValue);
  for (const method of ['getSectionCount', 'getParagraphCount', 'getParagraphLength', 'getTextRange', 'getControls']) {
    if (typeof document[method] !== 'function') throw new Error('본문 검사 API를 확인하지 못했습니다.');
  }
  const {sectionIndex, paragraphIndex, charOffset: start} = selected.start;
  const end = selected.end.charOffset;
  const sectionCount = invoke(document, 'getSectionCount');
  if (!integer(sectionCount) || sectionIndex >= sectionCount) throw new Error('선택한 구역을 확인하지 못했습니다.');
  const paragraphCount = invoke(document, 'getParagraphCount', sectionIndex);
  if (!integer(paragraphCount) || paragraphIndex >= paragraphCount) throw new Error('선택한 문단을 확인하지 못했습니다.');
  const paragraphLength = invoke(document, 'getParagraphLength', sectionIndex, paragraphIndex);
  if (!integer(paragraphLength) || end > paragraphLength) throw new Error('선택 범위가 바뀌었습니다.');
  const paragraphText = invoke(document, 'getTextRange', sectionIndex, paragraphIndex, 0, paragraphLength);
  if (typeof paragraphText !== 'string' || Array.from(paragraphText).length !== paragraphLength) {
    throw new Error('문단 원문을 정확히 읽지 못했습니다.');
  }
  let flatParagraph = paragraphIndex;
  for (let section = 0; section < sectionIndex; section++) {
    const count = invoke(document, 'getParagraphCount', section);
    if (!integer(count)) throw new Error('본문 문단 주소를 확인하지 못했습니다.');
    flatParagraph += count;
  }
  const controls = parsedArray(invoke(document, 'getControls'), '컨트롤 목록');
  if (controls.some(value => record(value) && value.list === 0 && value.para === flatParagraph
    && !['secd', 'cold'].includes(String(value.ctrlId)))) {
    throw new Error('필드나 개체가 있는 문단은 맞춤법 교정을 지원하지 않습니다.');
  }
  const selectedText = Array.from(paragraphText).slice(start, end).join('');
  if (!selectedText) throw new Error('맞춤법 검사할 글자를 선택해 주세요.');
  return Object.freeze({
    input: inputValue,
    document,
    identity,
    revision: String(revision),
    selection: selected,
    paragraphText,
    selectedText,
  });
}

function capabilities(provider: SpellcheckProviderB137 | undefined): SpellcheckCapabilityB137 {
  if (!provider) return Object.freeze({available: false, reason: 'provider-unavailable'});
  let value: unknown;
  try { value = provider.capabilities(); }
  catch { return Object.freeze({available: false, reason: 'provider-invalid'}); }
  if (!record(value) || value.available !== true || value.execution !== 'offline') {
    return Object.freeze({available: false, reason: value && record(value) && value.execution !== 'offline'
      ? 'provider-online' : 'provider-invalid'});
  }
  if (!Array.isArray(value.locales) || !value.locales.includes('ko-KR')) {
    return Object.freeze({available: false, reason: 'locale-unsupported'});
  }
  if (!exactString(value.dictionaryVersion, 128)) {
    return Object.freeze({available: false, reason: 'dictionary-unavailable'});
  }
  if (!integer(value.maxCodePoints) || value.maxCodePoints < 1 || value.maxCodePoints > 20_000) {
    return Object.freeze({available: false, reason: 'provider-invalid'});
  }
  return Object.freeze({
    available: true,
    dictionaryVersion: value.dictionaryVersion,
    maxCodePoints: value.maxCodePoints,
  });
}

export function spellcheckCapabilityB137(
  provider?: SpellcheckProviderB137,
): SpellcheckCapabilityB137 {
  return capabilities(provider);
}

function current(
  environment: SpellcheckEnvironmentB137,
  expected: Owner,
  allowOwnedMutation = false,
): Owner {
  const observed = owner(environment, allowOwnedMutation);
  if (observed.input !== expected.input || observed.document !== expected.document
    || observed.identity !== expected.identity || observed.revision !== expected.revision
    || !same(observed.selection, expected.selection) || observed.paragraphText !== expected.paragraphText
    || observed.selectedText !== expected.selectedText) {
    throw new Error('문서나 선택이 바뀌었습니다. 맞춤법 검사를 다시 실행해 주세요.');
  }
  return observed;
}

function validateIssues(value: unknown, requestId: string, dictionaryVersion: string, text: string): readonly SpellcheckIssueB137[] {
  if (!record(value) || value.requestId !== requestId || value.locale !== 'ko-KR'
    || value.dictionaryVersion !== dictionaryVersion || !Array.isArray(value.issues)
    || value.issues.length > 512) {
    throw new Error('맞춤법 검사기 응답을 확인하지 못했습니다.');
  }
  const chars = Array.from(text);
  let previousEnd = 0;
  return Object.freeze(value.issues.map((raw, index): SpellcheckIssueB137 => {
    if (!record(raw) || !['spelling', 'spacing'].includes(String(raw.kind))
      || !integer(raw.start) || !integer(raw.end) || raw.start >= raw.end
      || raw.end > chars.length || (index > 0 && raw.start < previousEnd)
      || !exactString(raw.original, 256) || raw.original !== chars.slice(raw.start, raw.end).join('')
      || !Array.isArray(raw.suggestions) || raw.suggestions.length < 1 || raw.suggestions.length > 10) {
      throw new Error('맞춤법 검사기 교정 범위를 확인하지 못했습니다.');
    }
    const suggestions = raw.suggestions.map(suggestion => {
      if (!exactString(suggestion, 256) || /[\r\n]/u.test(suggestion)) {
        throw new Error('맞춤법 검사기 제안을 확인하지 못했습니다.');
      }
      return suggestion;
    });
    previousEnd = raw.end;
    return Object.freeze({
      kind: raw.kind as SpellcheckIssueKindB137,
      start: raw.start,
      end: raw.end,
      original: raw.original,
      suggestions: Object.freeze(suggestions),
    });
  }));
}

/** Checks only the user's explicit, single-paragraph selection. */
export async function startSpellcheckB137(
  environment: SpellcheckEnvironmentB137,
): Promise<SpellcheckSessionB137> {
  const capability = capabilities(environment.provider);
  if (!capability.available || !capability.dictionaryVersion || !capability.maxCodePoints) {
    throw new Error('사용 가능한 오프라인 한국어 맞춤법 사전이 없습니다.');
  }
  const initial = owner(environment);
  if (Array.from(initial.selectedText).length > capability.maxCodePoints) {
    throw new Error('선택 범위가 맞춤법 검사기의 허용 길이를 넘었습니다.');
  }
  const requestId = environment.createRequestId();
  if (!exactString(requestId, 128) || requestId.length < 8) {
    throw new Error('맞춤법 검사 요청 식별자를 만들지 못했습니다.');
  }
  let response: unknown;
  try {
    response = await environment.provider!.check(Object.freeze({
      requestId,
      locale: 'ko-KR',
      dictionaryVersion: capability.dictionaryVersion,
      text: initial.selectedText,
    }));
  } catch {
    throw new Error('맞춤법 검사기를 실행하지 못했습니다.');
  }
  current(environment, initial);
  const issues = validateIssues(
    response,
    requestId,
    capability.dictionaryVersion,
    initial.selectedText,
  );
  const session: SpellcheckSessionB137 = Object.freeze({
    requestId,
    locale: 'ko-KR',
    dictionaryVersion: capability.dictionaryVersion,
    issues,
  });
  states.set(session, Object.freeze({
    environment,
    owner: initial,
    session,
    consumed: {value: false},
  }));
  return session;
}

/** Applies one verified suggestion through one Studio snapshot. */
export function applySpellcheckSuggestionB137(
  session: SpellcheckSessionB137,
  issueIndex: number,
  suggestionIndex: number,
): void {
  const state = states.get(session);
  if (!state || state.consumed.value) throw new Error('맞춤법 검사 결과가 만료되었습니다.');
  if (!integer(issueIndex) || !integer(suggestionIndex)) throw new Error('교정 제안을 확인하지 못했습니다.');
  const issue = state.session.issues[issueIndex];
  const suggestion = issue?.suggestions[suggestionIndex];
  if (!issue || suggestion === undefined) throw new Error('교정 제안을 확인하지 못했습니다.');
  const observed = current(state.environment, state.owner);
  if (typeof observed.input.executeOperation !== 'function') {
    throw new Error('편집기 명령 연결을 확인하지 못했습니다.');
  }
  const range = Object.freeze({
    start: Object.freeze({
      ...observed.selection.start,
      charOffset: observed.selection.start.charOffset + issue.start,
    }),
    end: Object.freeze({
      ...observed.selection.start,
      charOffset: observed.selection.start.charOffset + issue.end,
    }),
  });
  const plan = readPlainTextPlan(observed.input.wasm, range, suggestion);
  if (Array.from(plan.source).slice(plan.start, plan.end).join('') !== issue.original) {
    throw new Error('교정할 원문이 바뀌었습니다. 맞춤법 검사를 다시 실행해 주세요.');
  }
  current(state.environment, state.owner);
  observed.input.executeOperation.call(observed.input, {
    kind: 'snapshot',
    operationType: 'jueonySpellcheckCorrectionB137',
    operation(wasm: unknown) {
      current(state.environment, state.owner, true);
      return executePlainText(wasm, plan);
    },
    meta: Object.freeze({
      actionId: 'tools:spellcheck',
      domain: 'tools',
      refresh: 'full',
      dirtyScope: 'document',
    }),
  });
  state.consumed.value = true;
}

