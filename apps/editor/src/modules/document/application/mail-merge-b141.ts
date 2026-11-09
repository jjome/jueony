const MAX_ROWS_B141 = 100;
const MAX_COLUMNS_B141 = 32;
const MAX_CELL_SCALARS_B141 = 4_000;
const MAX_OUTPUT_BYTES_B141 = 32 * 1024 * 1024;

export type MailMergeFormatB141 = 'hwp' | 'hwpx';

export interface MailMergeTemplateStateB141 {
  revision: string;
  fingerprint: string;
  format: MailMergeFormatB141;
  placeholders: readonly string[];
}

export interface MailMergePlanInputB141 {
  template: MailMergeTemplateStateB141;
  columns: readonly string[];
  rows: readonly Readonly<Record<string, unknown>>[];
  outputNames: readonly string[];
}

export interface MailMergePlanB141 {
  version: 1;
  template: MailMergeTemplateStateB141;
  columns: readonly string[];
  rows: readonly Readonly<Record<string, string>>[];
  outputNames: readonly string[];
}

export interface MailMergeDocumentCopyB141 {
  readonly sourceFingerprint: string;
  setField(name: string, value: string): Promise<void>;
  readFields(names: readonly string[]): Promise<Readonly<Record<string, string>>>;
  export(format: MailMergeFormatB141): Promise<Uint8Array>;
  dispose(): void | Promise<void>;
}

/** Source port exposes observation and clone only; it deliberately has no mutate method. */
export interface MailMergeTemplatePortB141 {
  observe(): Promise<MailMergeTemplateStateB141>;
  clone(expectedFingerprint: string): Promise<MailMergeDocumentCopyB141>;
}

export interface MailMergeOutputTransactionB141 {
  stage(name: string, bytes: Uint8Array): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export interface MailMergeOutputPortB141 {
  begin(expectedNames: readonly string[]): Promise<MailMergeOutputTransactionB141>;
}

export class MailMergeErrorB141 extends Error {
  readonly code: 'invalid' | 'stale' | 'capability' | 'verification' | 'cleanup';
  constructor(code: MailMergeErrorB141['code'], message: string) {
    super(message); this.name = 'MailMergeErrorB141'; this.code = code;
  }
}

const fail = (message: string): never => { throw new MailMergeErrorB141('invalid', message); };
const scalarLength = (value: string) => Array.from(value).length;
const fingerprint = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
const placeholder = (value: unknown): value is string => typeof value === 'string'
  && scalarLength(value) >= 1 && scalarLength(value) <= 64
  && !/[\u0000-\u001f<>:"/\\|?*]/u.test(value) && value.trim() === value;

function assertDense<T>(value: readonly T[], label: string): void {
  if (!Array.isArray(value) || Reflect.ownKeys(value).length !== value.length + 1) fail(`${label} 목록이 올바르지 않습니다.`);
}

function outputName(value: unknown, format: MailMergeFormatB141): value is string {
  if (typeof value !== 'string' || !value || value.length > 180 || value.trim() !== value
    || /[\u0000-\u001f<>:"/\\|?*]/u.test(value) || /[. ]$/u.test(value)) return false;
  const dot = value.lastIndexOf('.');
  if (dot <= 0 || value.slice(dot + 1).toLowerCase() !== format) return false;
  const stem = value.slice(0, dot).toUpperCase();
  return !/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/u.test(stem);
}

function exactKeys(record: Readonly<Record<string, unknown>>, columns: readonly string[]): boolean {
  const keys = Object.keys(record).sort();
  return keys.length === columns.length && keys.every((key, index) => key === [...columns].sort()[index]);
}

function freezeState(value: MailMergeTemplateStateB141): MailMergeTemplateStateB141 {
  return Object.freeze({ ...value, placeholders: Object.freeze([...value.placeholders]) });
}

export function createMailMergePlanB141(input: MailMergePlanInputB141): MailMergePlanB141 {
  const template = input?.template;
  if (!template || typeof template.revision !== 'string' || !template.revision || template.revision.length > 200
    || !fingerprint(template.fingerprint) || !['hwp', 'hwpx'].includes(template.format)) fail('템플릿 버전 또는 지문이 올바르지 않습니다.');
  assertDense(template.placeholders, '필드'); assertDense(input.columns, '열');
  assertDense(input.rows, '행'); assertDense(input.outputNames, '출력 이름');
  if (!template.placeholders.length || template.placeholders.length > MAX_COLUMNS_B141
    || input.columns.length !== template.placeholders.length) fail('메일 머지 열 수가 올바르지 않습니다.');
  if (template.placeholders.some(name => !placeholder(name))
    || new Set(template.placeholders).size !== template.placeholders.length
    || input.columns.some(name => !placeholder(name))
    || new Set(input.columns).size !== input.columns.length
    || input.columns.some((name, index) => name !== template.placeholders[index])) {
    fail('열 스키마가 검증된 템플릿 필드와 정확히 일치하지 않습니다.');
  }
  if (!input.rows.length || input.rows.length > MAX_ROWS_B141 || input.outputNames.length !== input.rows.length) {
    fail(`메일 머지는 1~${MAX_ROWS_B141}개 행만 지원합니다.`);
  }
  const rows = input.rows.map((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row) || !exactKeys(row, input.columns)) fail(`${index + 1}행의 열 스키마가 다릅니다.`);
    const result: Record<string, string> = {};
    for (const name of input.columns) {
      const value = row[name];
      if (typeof value !== 'string' || scalarLength(value) > MAX_CELL_SCALARS_B141 || /[\u0000\u000b\u000c]/u.test(value)) {
        fail(`${index + 1}행 '${name}' 값이 올바르지 않습니다.`);
      }
      result[name] = value as string;
    }
    return Object.freeze(result);
  });
  const seen = new Set<string>();
  for (const name of input.outputNames) {
    if (!outputName(name, template.format)) fail('출력 파일 이름 또는 확장자가 올바르지 않습니다.');
    const key = name.normalize('NFC').toLocaleLowerCase('ko-KR');
    if (seen.has(key)) fail('대소문자 또는 유니코드 정규화가 같은 출력 이름이 중복됩니다.');
    seen.add(key);
  }
  return Object.freeze({
    version: 1,
    template: freezeState(template),
    columns: Object.freeze([...input.columns]),
    rows: Object.freeze(rows),
    outputNames: Object.freeze([...input.outputNames]),
  });
}

export function auditMailMergeCapabilityB141(value: unknown): Readonly<{supported: boolean; missing: readonly string[]}> {
  const candidate = value as {template?: unknown; output?: unknown} | null;
  const missing: string[] = [];
  if (!candidate?.template || typeof (candidate.template as MailMergeTemplatePortB141).observe !== 'function'
    || typeof (candidate.template as MailMergeTemplatePortB141).clone !== 'function') missing.push('template-clone-field-port');
  if (!candidate?.output || typeof (candidate.output as MailMergeOutputPortB141).begin !== 'function') missing.push('transactional-output-port');
  return Object.freeze({ supported: missing.length === 0, missing: Object.freeze(missing) });
}

function sameState(a: MailMergeTemplateStateB141, b: MailMergeTemplateStateB141): boolean {
  return a.revision === b.revision && a.fingerprint === b.fingerprint && a.format === b.format
    && JSON.stringify(a.placeholders) === JSON.stringify(b.placeholders);
}

function assertObserved(plan: MailMergePlanB141, observed: MailMergeTemplateStateB141): void {
  if (!sameState(plan.template, observed)) throw new MailMergeErrorB141('stale', '템플릿 버전·지문·필드 스키마가 바뀌었습니다.');
}

export async function executeMailMergeB141(
  plan: MailMergePlanB141,
  ports: {template: MailMergeTemplatePortB141; output: MailMergeOutputPortB141},
): Promise<Readonly<{status: 'committed'; count: number; outputNames: readonly string[]}>> {
  if (plan?.version !== 1) throw new MailMergeErrorB141('invalid', '메일 머지 계획 버전이 올바르지 않습니다.');
  const capability = auditMailMergeCapabilityB141(ports);
  if (!capability.supported) throw new MailMergeErrorB141('capability', `메일 머지 실행 포트가 없습니다: ${capability.missing.join(', ')}`);
  assertObserved(plan, await ports.template.observe());
  const transaction = await ports.output.begin(plan.outputNames);
  let copy: MailMergeDocumentCopyB141 | undefined;
  try {
    for (let rowIndex = 0; rowIndex < plan.rows.length; rowIndex += 1) {
      assertObserved(plan, await ports.template.observe());
      copy = await ports.template.clone(plan.template.fingerprint);
      if (copy.sourceFingerprint !== plan.template.fingerprint) throw new MailMergeErrorB141('verification', '문서 사본의 원본 지문이 다릅니다.');
      const row = plan.rows[rowIndex];
      for (const name of plan.columns) await copy.setField(name, row[name]);
      const actual = await copy.readFields(plan.columns);
      if (!exactKeys(actual, plan.columns) || plan.columns.some(name => actual[name] !== row[name])) {
        throw new MailMergeErrorB141('verification', '행별 문서의 필드 치환 결과가 요청과 다릅니다.');
      }
      const bytes = await copy.export(plan.template.format);
      if (!(bytes instanceof Uint8Array) || !bytes.byteLength || bytes.byteLength > MAX_OUTPUT_BYTES_B141) {
        throw new MailMergeErrorB141('verification', '행별 문서 출력이 올바르지 않습니다.');
      }
      await transaction.stage(plan.outputNames[rowIndex], bytes.slice());
      await copy.dispose(); copy = undefined;
    }
    assertObserved(plan, await ports.template.observe());
    await transaction.commit();
    return Object.freeze({ status: 'committed', count: plan.rows.length, outputNames: Object.freeze([...plan.outputNames]) });
  } catch (error) {
    const cleanup: unknown[] = [];
    if (copy) { try { await copy.dispose(); } catch (disposeError) { cleanup.push(disposeError); } }
    try { await transaction.rollback(); } catch (rollbackError) { cleanup.push(rollbackError); }
    if (cleanup.length) throw new MailMergeErrorB141('cleanup', '메일 머지 실패 산출물을 완전히 정리하지 못했습니다.');
    throw error;
  }
}
