import {sha256} from '@noble/hashes/sha2.js';
import {capturePreservationEvidence} from './preservation.ts';

type OutlineHeadN011 = Readonly<{
  attr: number;
  char_shape_id: 4294967295;
  number_format: number;
  text_distance: number;
  width_adjust: number;
}>;

type OutlineDefinitionN011 = Readonly<{
  heads: readonly OutlineHeadN011[];
  level_formats: readonly string[];
  level_start_numbers: readonly number[];
  start_number: number;
}>;

export type OutlineBindingPackageN011 = Readonly<{
  format: 'jueony-outline-binding';
  version: 1;
  sourceDefinitionId: number;
  level: number;
  definition: OutlineDefinitionN011;
  definitionSha256: string;
}>;

type ArtifactN011 = Readonly<{hwp: string; hwpx: string}>;

export type OutlineTransferPlanN011 = Readonly<{
  package: OutlineBindingPackageN011;
  section: number;
  paragraph: number;
  targetDefinitionId: number;
  targetToken: string;
  before: ArtifactN011;
}>;

export type OutlineTransferTransitionN011 = {
  readonly before: ArtifactN011;
  readonly after: ArtifactN011;
  undo(): void;
  redo(): void;
  dispose(): void;
};

type HostN011 = {
  exportHwp(): Uint8Array;
  exportHwpx(): Uint8Array;
  getSectionCount(): number;
  getParagraphCount(section: number): number;
  getAgentListDefinitions(): unknown;
  getAgentOutlineDefinition(section: number): unknown;
  getAgentParagraphOutline(section: number, paragraph: number): unknown;
  getParaPropertiesAt(section: number, paragraph: number): unknown;
  setAgentParagraphOutline(section: number, paragraph: number, json: string): unknown;
  saveSnapshot(): number;
  restoreSnapshot(token: number): unknown;
  discardSnapshot(token: number): void;
};

const HEX = /^[0-9a-f]{64}$/u;
const UINT32_MAX = 4294967295;
const HEAD_KEYS = ['attr', 'char_shape_id', 'number_format', 'text_distance', 'width_adjust'] as const;
const DEFINITION_KEYS = ['heads', 'level_formats', 'level_start_numbers', 'start_number'] as const;

function parsed(value: unknown): unknown {
  return typeof value === 'string' ? JSON.parse(value) : value;
}

function object(value: unknown, label: string): Record<string, unknown> {
  const result = parsed(value);
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error(`${label}가 올바르지 않습니다.`);
  return result as Record<string, unknown>;
}

function exact(value: Record<string, unknown>, keys: readonly string[], label: string): void {
  const actual = Object.keys(value).sort(), expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error(`${label}에 해석되지 않은 속성이 있습니다.`);
  }
}

function integer(value: unknown, minimum: number, maximum: number, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${label}가 올바르지 않습니다.`);
  }
  return value;
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 500
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\ud800-\udfff]/u.test(value)) {
    throw new Error(`${label}가 올바르지 않습니다.`);
  }
  return value;
}

function frozenDefinition(value: unknown): OutlineDefinitionN011 {
  const raw = object(value, '개요 정의'); exact(raw, DEFINITION_KEYS, '개요 정의');
  if (!Array.isArray(raw.heads) || raw.heads.length !== 7
    || !Array.isArray(raw.level_formats) || raw.level_formats.length !== 7
    || !Array.isArray(raw.level_start_numbers) || raw.level_start_numbers.length !== 7) {
    throw new Error('개요 정의는 정확히 7수준이어야 합니다.');
  }
  const heads = raw.heads.map((entry, index) => {
    const head = object(entry, `${index + 1}수준 머리`); exact(head, HEAD_KEYS, `${index + 1}수준 머리`);
    const charShape = integer(head.char_shape_id, 0, UINT32_MAX, '개요 글자 모양 참조');
    if (charShape !== UINT32_MAX) {
      throw new Error('CharShape·글꼴·BorderFill 참조 그래프가 있는 개요 정의는 아직 안전하게 이식할 수 없습니다.');
    }
    return Object.freeze({
      attr: integer(head.attr, 0, UINT32_MAX, '개요 머리 속성'),
      char_shape_id: UINT32_MAX as 4294967295,
      number_format: integer(head.number_format, 0, UINT32_MAX, '번호 형식'),
      text_distance: integer(head.text_distance, -2147483648, 2147483647, '번호와 본문 거리'),
      width_adjust: integer(head.width_adjust, -2147483648, 2147483647, '번호 너비 보정'),
    });
  });
  const formats = raw.level_formats.map((entry, index) => text(entry, `${index + 1}수준 번호 문자열`));
  const starts = raw.level_start_numbers.map((entry, index) => integer(entry, 0, UINT32_MAX, `${index + 1}수준 시작 번호`));
  return Object.freeze({heads: Object.freeze(heads), level_formats: Object.freeze(formats),
    level_start_numbers: Object.freeze(starts), start_number: integer(raw.start_number, 0, UINT32_MAX, '개요 시작 번호')});
}

function canonicalDefinition(value: OutlineDefinitionN011): string {
  return JSON.stringify({heads: value.heads.map(head => ({attr: head.attr, char_shape_id: head.char_shape_id,
    number_format: head.number_format, text_distance: head.text_distance, width_adjust: head.width_adjust})),
  level_formats: [...value.level_formats], level_start_numbers: [...value.level_start_numbers],
  start_number: value.start_number});
}

function digest(value: Uint8Array | string): string {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  return Array.from(sha256(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

function artifact(document: HostN011): ArtifactN011 {
  const hwp = document.exportHwp(), hwpx = document.exportHwpx();
  if (!(hwp instanceof Uint8Array) || hwp.length === 0 || !(hwpx instanceof Uint8Array) || hwpx.length === 0) {
    throw new Error('HWP/HWPX 현재 상태를 확인하지 못했습니다.');
  }
  return Object.freeze({hwp: digest(hwp), hwpx: digest(hwpx)});
}

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function host(value: unknown): HostN011 {
  const candidate = value as {borrowDocumentHandle?: () => unknown};
  const result = typeof candidate?.borrowDocumentHandle === 'function' ? candidate.borrowDocumentHandle() : value;
  if (!result || typeof result !== 'object') throw new Error('문서 엔진을 사용할 수 없습니다.');
  for (const name of ['exportHwp', 'exportHwpx', 'getSectionCount', 'getParagraphCount', 'getAgentListDefinitions',
    'getAgentOutlineDefinition', 'getAgentParagraphOutline', 'getParaPropertiesAt', 'setAgentParagraphOutline',
    'saveSnapshot', 'restoreSnapshot', 'discardSnapshot'] as const) {
    if (typeof (result as Record<string, unknown>)[name] !== 'function') throw new Error(`필수 문서 엔진 기능이 없습니다: ${name}`);
  }
  return result as HostN011;
}

function definitions(document: HostN011): unknown[] {
  const raw = object(document.getAgentListDefinitions(), '번호 정의 목록');
  if (!Array.isArray(raw.numberings) || raw.numberings.length === 0 || raw.numberings.length > 200) {
    throw new Error('번호 정의 목록이 올바르지 않습니다.');
  }
  return raw.numberings;
}

function binding(document: HostN011, section: number): number {
  return integer(object(document.getAgentOutlineDefinition(section), '구역 개요 연결').definitionId,
    1, 200, '구역 개요 정의 식별자');
}

function paragraphOutline(document: HostN011, section: number, paragraph: number): {definitionId: number; token: string; levelFormats: string[]} {
  const raw = object(document.getAgentParagraphOutline(section, paragraph), '문단 개요 연결');
  if (raw.editable !== true || typeof raw.token !== 'string' || !HEX.test(raw.token)
    || !Array.isArray(raw.levelFormats) || raw.levelFormats.length !== 7) {
    throw new Error('문단 개요 연결의 검증 토큰 또는 전체 7수준 정보를 확인하지 못했습니다.');
  }
  return {definitionId: integer(raw.definitionId, 1, 200, '문단 개요 정의 식별자'), token: raw.token,
    levelFormats: raw.levelFormats.map((entry, index) => text(entry, `${index + 1}수준 번호 문자열`))};
}

function coordinates(document: HostN011, section: number, paragraph: number): void {
  const sectionCount = integer(document.getSectionCount(), 1, 4096, '구역 수');
  if (!Number.isSafeInteger(section) || section < 0 || section >= sectionCount) throw new Error('대상 구역이 올바르지 않습니다.');
  const paragraphCount = integer(document.getParagraphCount(section), 1, 100000, '문단 수');
  if (!Number.isSafeInteger(paragraph) || paragraph < 0 || paragraph >= paragraphCount) throw new Error('대상 문단이 올바르지 않습니다.');
}

export function parseOutlineBindingPackageN011(value: unknown): OutlineBindingPackageN011 {
  const raw = object(value, '개요 연결 패키지');
  exact(raw, ['format', 'version', 'sourceDefinitionId', 'level', 'definition', 'definitionSha256'], '개요 연결 패키지');
  if (raw.format !== 'jueony-outline-binding' || raw.version !== 1 || typeof raw.definitionSha256 !== 'string'
    || !HEX.test(raw.definitionSha256)) throw new Error('개요 연결 패키지 형식이 올바르지 않습니다.');
  const definition = frozenDefinition(raw.definition);
  if (digest(canonicalDefinition(definition)) !== raw.definitionSha256) throw new Error('개요 정의 지문이 일치하지 않습니다.');
  return Object.freeze({format: 'jueony-outline-binding', version: 1,
    sourceDefinitionId: integer(raw.sourceDefinitionId, 1, 200, '원본 개요 정의 식별자'),
    level: integer(raw.level, 0, 6, '개요 수준'), definition, definitionSha256: raw.definitionSha256});
}

export function exportOutlineBindingN011(value: unknown, section: number, paragraph: number): OutlineBindingPackageN011 {
  const document = host(value); coordinates(document, section, paragraph);
  const properties = object(document.getParaPropertiesAt(section, paragraph), '문단 모양');
  if (properties.headType !== 'Outline' || properties.numberingId !== 0) throw new Error('내보낼 문단은 구역 개요 번호를 사용해야 합니다.');
  const level = integer(properties.paraLevel, 0, 6, '개요 수준'), definitionId = binding(document, section);
  const outline = paragraphOutline(document, section, paragraph);
  if (outline.definitionId !== definitionId) throw new Error('문단과 구역의 개요 정의 연결이 다릅니다.');
  const all = definitions(document), definition = frozenDefinition(all[definitionId - 1]);
  if (!same(outline.levelFormats, definition.level_formats)) throw new Error('문단 개요 수준 정보가 원본 정의와 다릅니다.');
  const definitionSha256 = digest(canonicalDefinition(definition));
  return Object.freeze({format: 'jueony-outline-binding', version: 1, sourceDefinitionId: definitionId,
    level, definition, definitionSha256});
}

function targetDefinition(document: HostN011, packageValue: OutlineBindingPackageN011): number {
  const matches: number[] = [];
  for (const [index, raw] of definitions(document).entries()) {
    try {
      const definition = frozenDefinition(raw);
      if (canonicalDefinition(definition) === canonicalDefinition(packageValue.definition)) matches.push(index + 1);
    } catch { /* Unsupported target definitions cannot be inferred as equivalent. */ }
  }
  if (matches.length === 0) throw new Error('대상 문서에 완전히 같은 개요 정의가 없습니다. 새 정의 생성은 지원하지 않습니다.');
  if (matches.length > 1) throw new Error('대상 문서에 같은 개요 정의가 여러 개 있어 충돌을 안전하게 해결할 수 없습니다.');
  return matches[0];
}

export function planOutlineTransferN011(value: unknown, packageInput: unknown,
  section: number, paragraph: number): OutlineTransferPlanN011 {
  const document = host(value), packageValue = parseOutlineBindingPackageN011(packageInput);
  coordinates(document, section, paragraph);
  const targetDefinitionId = targetDefinition(document, packageValue);
  if (binding(document, section) !== targetDefinitionId) {
    throw new Error('대상 구역의 개요 정의 연결을 바꾸는 공개 포트가 없어 이 문단에 안전하게 적용할 수 없습니다.');
  }
  const outline = paragraphOutline(document, section, paragraph);
  if (outline.definitionId !== targetDefinitionId || !same(outline.levelFormats, packageValue.definition.level_formats)) {
    throw new Error('대상 문단의 개요 정의 연결이 패키지와 다릅니다.');
  }
  return Object.freeze({package: packageValue, section, paragraph, targetDefinitionId,
    targetToken: outline.token, before: artifact(document)});
}

function withoutInferredRestart(values: Record<string, unknown>): Record<string, unknown> {
  const copy = structuredClone(values) as Record<string, unknown>;
  for (const [key, value] of Object.entries(copy)) {
    if (!/^section\/\d+\/paragraph\/\d+$/u.test(key) || !value || typeof value !== 'object' || Array.isArray(value)) continue;
    const paragraph = (value as {paragraph?: Record<string, unknown>}).paragraph;
    if (paragraph) { delete paragraph.numberingRestartMode; delete paragraph.numberingStartNum; }
  }
  return copy;
}

function restore(document: HostN011, token: number, expected: ArtifactN011): void {
  const result = object(document.restoreSnapshot(token), '문서 복원 결과');
  if (result.ok === false || !same(artifact(document), expected)) throw new Error('문서 snapshot을 정확히 복원하지 못했습니다.');
}

class TransitionN011 implements OutlineTransferTransitionN011 {
  readonly before: ArtifactN011;
  readonly after: ArtifactN011;
  readonly #document: HostN011;
  readonly #beforeToken: number;
  readonly #afterToken: number;
  #state: 'before' | 'after' | 'disposed' = 'after';

  constructor(document: HostN011, beforeToken: number, afterToken: number, before: ArtifactN011, after: ArtifactN011) {
    this.#document = document; this.#beforeToken = beforeToken; this.#afterToken = afterToken;
    this.before = before; this.after = after;
  }

  undo(): void {
    if (this.#state !== 'after' || !same(artifact(this.#document), this.after)) throw new Error('적용 후 문서 상태가 아니어서 되돌릴 수 없습니다.');
    restore(this.#document, this.#beforeToken, this.before); this.#state = 'before';
  }

  redo(): void {
    if (this.#state !== 'before' || !same(artifact(this.#document), this.before)) throw new Error('되돌린 문서 상태가 아니어서 다시 실행할 수 없습니다.');
    restore(this.#document, this.#afterToken, this.after); this.#state = 'after';
  }

  dispose(): void {
    if (this.#state === 'disposed') return;
    this.#document.discardSnapshot(this.#beforeToken); this.#document.discardSnapshot(this.#afterToken);
    this.#state = 'disposed';
  }
}

export function applyOutlineTransferN011(value: unknown, plan: OutlineTransferPlanN011): OutlineTransferTransitionN011 {
  const document = host(value);
  if (!same(artifact(document), plan.before)) throw new Error('대상 문서가 계획 이후 바뀌었습니다.');
  const refreshed = planOutlineTransferN011(document, plan.package, plan.section, plan.paragraph);
  if (refreshed.targetDefinitionId !== plan.targetDefinitionId || refreshed.targetToken !== plan.targetToken
    || !same(refreshed.before, plan.before)) throw new Error('대상 개요 정의 또는 문단 연결이 계획 이후 바뀌었습니다.');
  const beforeEvidence = capturePreservationEvidence(document);
  if (beforeEvidence.issues.length) throw new Error('적용 전 문서 보존 정보를 완전히 확인하지 못했습니다.');
  const expected = withoutInferredRestart(beforeEvidence.values), key = `section/${plan.section}/paragraph/${plan.paragraph}`;
  const target = expected[key] as {paragraph?: Record<string, unknown>} | undefined;
  if (!target?.paragraph) throw new Error('대상 문단의 보존 정보를 확인하지 못했습니다.');
  Object.assign(target.paragraph, {headType: 'Outline', numberingId: 0, paraLevel: plan.package.level});
  const beforeToken = document.saveSnapshot();
  if (!Number.isSafeInteger(beforeToken) || beforeToken < 0) throw new Error('적용 전 snapshot을 만들지 못했습니다.');
  let afterToken: number | undefined;
  try {
    const response = object(document.setAgentParagraphOutline(plan.section, plan.paragraph,
      JSON.stringify({enabled: true, level: plan.package.level, token: plan.targetToken})), '문단 개요 적용 결과');
    if (response.editable !== true || response.definitionId !== plan.targetDefinitionId) throw new Error('문서 엔진이 개요 연결을 적용하지 못했습니다.');
    const properties = object(document.getParaPropertiesAt(plan.section, plan.paragraph), '적용 후 문단 모양');
    if (properties.headType !== 'Outline' || properties.numberingId !== 0 || properties.paraLevel !== plan.package.level) {
      throw new Error('적용 후 문단의 개요 연결이 계획과 다릅니다.');
    }
    const afterEvidence = capturePreservationEvidence(document);
    if (afterEvidence.issues.length || !same(withoutInferredRestart(afterEvidence.values), expected)) {
      throw new Error('개요 연결 이외의 문서 내용·서식·정의가 바뀌었습니다.');
    }
    const after = artifact(document);
    if (same(after, plan.before)) throw new Error('개요 연결 적용 결과가 저장 형식에 반영되지 않았습니다.');
    afterToken = document.saveSnapshot();
    if (!Number.isSafeInteger(afterToken) || afterToken < 0) throw new Error('적용 후 snapshot을 만들지 못했습니다.');
    return new TransitionN011(document, beforeToken, afterToken, plan.before, after);
  } catch (error) {
    try { restore(document, beforeToken, plan.before); } finally {
      if (afterToken !== undefined) document.discardSnapshot(afterToken);
      document.discardSnapshot(beforeToken);
    }
    throw error;
  }
}
