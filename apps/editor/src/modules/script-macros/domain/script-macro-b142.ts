export const SCRIPT_MACRO_B142_SCHEMA = 'jueony.script-macro' as const;
export const SCRIPT_MACRO_B142_VERSION = 1 as const;
export const SCRIPT_MACRO_BODY_TEXT_COMMAND = 'edit:body-text' as const;

export const SCRIPT_MACRO_B142_LIMITS = Object.freeze({
  maximumSteps: 64,
  maximumSerializedBytes: 65_536,
  maximumArgumentsBytes: 4_096,
  maximumArgumentDepth: 8,
  maximumArgumentNodes: 256,
  maximumStringLength: 2_048,
  maximumNameLength: 100,
  maximumIdentityLength: 512,
  maximumRevisionLength: 128,
});

export type ScriptMacroJsonScalarB142 = null | boolean | number | string;
export type ScriptMacroJsonValueB142 =
  | ScriptMacroJsonScalarB142
  | ScriptMacroJsonValueB142[]
  | { [key: string]: ScriptMacroJsonValueB142 };
export type ScriptMacroArgumentsB142 = { [key: string]: ScriptMacroJsonValueB142 };

export interface ScriptMacroDocumentVersionB142 {
  documentIdentity: string;
  revision: string;
}

export interface ScriptMacroStepB142 {
  sequence: number;
  commandId: string;
  arguments: ScriptMacroArgumentsB142;
}

export interface ScriptMacroB142 {
  schema: typeof SCRIPT_MACRO_B142_SCHEMA;
  version: typeof SCRIPT_MACRO_B142_VERSION;
  name: string;
  recordedFrom: {
    documentIdentity: string;
    startRevision: string;
    endRevision: string;
  };
  steps: ScriptMacroStepB142[];
}

export class ScriptMacroValidationErrorB142 extends Error {
  readonly code = 'SCRIPT_MACRO_B142_INVALID' as const;

  constructor(message: string) {
    super(message);
    this.name = 'ScriptMacroValidationErrorB142';
  }
}

const unsafeKeys = new Set(['__proto__', 'constructor', 'prototype']);
const commandIdPattern = /^[a-z][a-z0-9-]{0,31}:[a-z0-9][a-z0-9-]{0,63}$/;

function fail(message: string): never {
  throw new ScriptMacroValidationErrorB142(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertExactKeys(value: Record<string, unknown>, keys: readonly string[], label: string): void {
  const expected = new Set(keys);
  if (Object.keys(value).some(key => !expected.has(key))) fail(`${label}에 알 수 없는 항목이 있습니다.`);
  if (keys.some(key => !Object.hasOwn(value, key))) fail(`${label}에 필수 항목이 없습니다.`);
}

function assertBoundedText(value: unknown, maximum: number, label: string): asserts value is string {
  if (typeof value !== 'string' || value.length < 1 || value.length > maximum || /[\u0000-\u001f\u007f]/.test(value)) {
    fail(`${label} 형식이 잘못되었습니다.`);
  }
}

export function assertScriptMacroDocumentVersionB142(
  value: unknown,
  label = '문서 버전',
): asserts value is ScriptMacroDocumentVersionB142 {
  if (!isRecord(value)) fail(`${label} 형식이 잘못되었습니다.`);
  assertExactKeys(value, ['documentIdentity', 'revision'], label);
  assertBoundedText(value.documentIdentity, SCRIPT_MACRO_B142_LIMITS.maximumIdentityLength, `${label} ID`);
  assertBoundedText(value.revision, SCRIPT_MACRO_B142_LIMITS.maximumRevisionLength, `${label} revision`);
}

function cloneJsonValue(
  value: unknown,
  depth: number,
  count: { value: number },
): ScriptMacroJsonValueB142 {
  count.value += 1;
  if (count.value > SCRIPT_MACRO_B142_LIMITS.maximumArgumentNodes) fail('명령 인자가 너무 복잡합니다.');
  if (depth > SCRIPT_MACRO_B142_LIMITS.maximumArgumentDepth) fail('명령 인자의 중첩이 너무 깊습니다.');
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    if (typeof value === 'string' && value.length > SCRIPT_MACRO_B142_LIMITS.maximumStringLength) {
      fail('명령 인자 문자열이 너무 깁니다.');
    }
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('명령 인자 숫자는 유한해야 합니다.');
    return value;
  }
  if (Array.isArray(value)) return value.map(item => cloneJsonValue(item, depth + 1, count));
  if (!isRecord(value)) fail('명령 인자는 JSON 값이어야 합니다.');
  const copy: { [key: string]: ScriptMacroJsonValueB142 } = Object.create(null);
  for (const key of Object.keys(value).sort()) {
    if (!key || key.length > 64 || unsafeKeys.has(key) || /[\u0000-\u001f\u007f]/.test(key)) {
      fail('명령 인자 이름이 안전하지 않습니다.');
    }
    copy[key] = cloneJsonValue(value[key], depth + 1, count);
  }
  return copy;
}

function stableJson(value: ScriptMacroJsonValueB142): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
}

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length) {
      const low = value.charCodeAt(index + 1);
      if (low >= 0xdc00 && low <= 0xdfff) { bytes += 4; index += 1; }
      else bytes += 3;
    } else bytes += 3;
  }
  return bytes;
}

export function normalizeScriptMacroArgumentsB142(value: unknown): ScriptMacroArgumentsB142 {
  if (!isRecord(value)) fail('명령 인자는 객체여야 합니다.');
  const normalized = cloneJsonValue(value, 0, { value: 0 });
  if (Array.isArray(normalized) || normalized === null || typeof normalized !== 'object') {
    fail('명령 인자는 객체여야 합니다.');
  }
  if (utf8ByteLength(stableJson(normalized)) > SCRIPT_MACRO_B142_LIMITS.maximumArgumentsBytes) {
    fail('명령 인자가 너무 큽니다.');
  }
  return normalized;
}

export function assertScriptMacroCommandIdB142(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !commandIdPattern.test(value)) fail('명령 ID 형식이 잘못되었습니다.');
}

export function validateScriptMacroB142(value: unknown): ScriptMacroB142 {
  if (!isRecord(value)) fail('스크립트 매크로 형식이 잘못되었습니다.');
  assertExactKeys(value, ['schema', 'version', 'name', 'recordedFrom', 'steps'], '스크립트 매크로');
  if (value.schema !== SCRIPT_MACRO_B142_SCHEMA || value.version !== SCRIPT_MACRO_B142_VERSION) {
    fail('지원하지 않는 스크립트 매크로 버전입니다.');
  }
  assertBoundedText(value.name, SCRIPT_MACRO_B142_LIMITS.maximumNameLength, '매크로 이름');
  if (!isRecord(value.recordedFrom)) fail('기록 문서 정보가 잘못되었습니다.');
  assertExactKeys(value.recordedFrom, ['documentIdentity', 'startRevision', 'endRevision'], '기록 문서 정보');
  assertBoundedText(value.recordedFrom.documentIdentity, SCRIPT_MACRO_B142_LIMITS.maximumIdentityLength, '기록 문서 ID');
  assertBoundedText(value.recordedFrom.startRevision, SCRIPT_MACRO_B142_LIMITS.maximumRevisionLength, '시작 revision');
  assertBoundedText(value.recordedFrom.endRevision, SCRIPT_MACRO_B142_LIMITS.maximumRevisionLength, '종료 revision');
  if (!Array.isArray(value.steps) || value.steps.length < 1 || value.steps.length > SCRIPT_MACRO_B142_LIMITS.maximumSteps) {
    fail('스크립트 매크로 명령 수가 허용 범위를 벗어났습니다.');
  }
  const steps = value.steps.map((candidate, index): ScriptMacroStepB142 => {
    if (!isRecord(candidate)) fail('스크립트 매크로 명령 형식이 잘못되었습니다.');
    assertExactKeys(candidate, ['sequence', 'commandId', 'arguments'], '스크립트 매크로 명령');
    if (candidate.sequence !== index) fail('스크립트 매크로 실행 순서가 연속적이지 않습니다.');
    assertScriptMacroCommandIdB142(candidate.commandId);
    return {
      sequence: index,
      commandId: candidate.commandId,
      arguments: normalizeScriptMacroArgumentsB142(candidate.arguments),
    };
  });
  const normalized: ScriptMacroB142 = {
    schema: SCRIPT_MACRO_B142_SCHEMA,
    version: SCRIPT_MACRO_B142_VERSION,
    name: value.name,
    recordedFrom: {
      documentIdentity: value.recordedFrom.documentIdentity,
      startRevision: value.recordedFrom.startRevision,
      endRevision: value.recordedFrom.endRevision,
    },
    steps,
  };
  if (utf8ByteLength(stableJson(normalized as unknown as ScriptMacroJsonValueB142)) > SCRIPT_MACRO_B142_LIMITS.maximumSerializedBytes) {
    fail('스크립트 매크로가 너무 큽니다.');
  }
  return normalized;
}

export function serializeScriptMacroB142(value: ScriptMacroB142): string {
  const checked = validateScriptMacroB142(value);
  const serialized = stableJson(checked as unknown as ScriptMacroJsonValueB142);
  if (utf8ByteLength(serialized) > SCRIPT_MACRO_B142_LIMITS.maximumSerializedBytes) fail('스크립트 매크로가 너무 큽니다.');
  return serialized;
}

export function parseScriptMacroB142(serialized: string): ScriptMacroB142 {
  if (typeof serialized !== 'string' || serialized.length < 1 || utf8ByteLength(serialized) > SCRIPT_MACRO_B142_LIMITS.maximumSerializedBytes) {
    fail('저장된 스크립트 매크로 크기가 잘못되었습니다.');
  }
  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch {
    fail('저장된 스크립트 매크로 JSON을 읽을 수 없습니다.');
  }
  return validateScriptMacroB142(value);
}
