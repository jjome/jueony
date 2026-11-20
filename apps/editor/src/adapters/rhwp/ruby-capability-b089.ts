/** B089 Ruby (덧말) capability audit. No plain-text emulation is permitted. */
export const RUBY_ENGINE_METHODS_B089 = [
  'getRubyContext',
  'insertRubyEx',
  'removeRubyEx',
] as const;

export type RubyEngineMethodB089 = typeof RUBY_ENGINE_METHODS_B089[number];

export type RubyCapabilityB089 = Readonly<{
  supported: boolean;
  missingMethods: readonly RubyEngineMethodB089[];
  limitations: readonly string[];
}>;

export interface RubyRequestTargetB089 {
  revision: string;
  story: 'body' | 'cell' | 'header' | 'footer' | 'footnote' | 'endnote' | 'textbox';
  section: number;
  paragraph: number;
  start: number;
  end: number;
  cellPath?: readonly unknown[];
  protected?: boolean;
  selectionKinds?: readonly string[];
}

export class RubyCapabilityErrorB089 extends Error {
  readonly code:
    | 'stale'
    | 'protected'
    | 'nonbody'
    | 'mixed'
    | 'range'
    | 'unavailable';

  constructor(code: RubyCapabilityErrorB089['code'], detail?: string) {
    super({
      stale: '문서 버전이 바뀌어 덧말 요청을 적용할 수 없습니다.',
      protected: '보호된 범위에는 덧말을 적용할 수 없습니다.',
      nonbody: '덧말은 현재 최상위 본문 단일 문단만 지원합니다.',
      mixed: '개체나 제어문자가 섞인 범위에는 덧말을 적용할 수 없습니다.',
      range: '덧말의 기준 글자 범위가 올바르지 않습니다.',
      unavailable: `현재 문서 엔진은 안전한 덧말 편집 API를 제공하지 않습니다${detail ? `: ${detail}` : '.'}`,
    }[code]);
    this.name = 'RubyCapabilityErrorB089';
    this.code = code;
  }
}

function method(value: unknown, name: RubyEngineMethodB089): boolean {
  if (!value || (typeof value !== 'object' && typeof value !== 'function')) return false;
  return typeof (value as Record<string, unknown>)[name] === 'function';
}

/**
 * All three operations are required as one atomic capability. Read-only Ruby
 * preservation in the file model is not enough to claim editing support.
 */
export function auditRubyCapabilityB089(engine: unknown): RubyCapabilityB089 {
  const missingMethods = RUBY_ENGINE_METHODS_B089.filter(name => !method(engine, name));
  return Object.freeze({
    supported: missingMethods.length === 0,
    missingMethods: Object.freeze([...missingMethods]),
    limitations: Object.freeze(missingMethods.length ? [
      'Rust 모델과 HWP/HWPX 코덱은 Ruby를 보존하지만 공개 WASM 편집 API가 완결되지 않았습니다.',
      '현재 렌더러에는 Control::Ruby를 본문과 덧말 두 줄로 배치하는 경로가 없습니다.',
      '본문 문자열에 괄호나 별도 줄을 삽입하는 대체 구현은 파일의 Ruby 의미를 만들지 않으므로 금지합니다.',
    ] : []),
  });
}

/** Validate the only future-safe first slice before an engine call is allowed. */
export function assertRubyRequestSupportedB089(
  engine: unknown,
  target: RubyRequestTargetB089,
  currentRevision: string,
): void {
  if (target.revision !== currentRevision) throw new RubyCapabilityErrorB089('stale');
  if (target.protected) throw new RubyCapabilityErrorB089('protected');
  if (target.story !== 'body' || (target.cellPath?.length ?? 0) !== 0) {
    throw new RubyCapabilityErrorB089('nonbody');
  }
  if (!Number.isSafeInteger(target.section) || target.section < 0
    || !Number.isSafeInteger(target.paragraph) || target.paragraph < 0
    || !Number.isSafeInteger(target.start) || !Number.isSafeInteger(target.end)
    || target.start < 0 || target.end <= target.start) {
    throw new RubyCapabilityErrorB089('range');
  }
  const kinds = target.selectionKinds ?? ['plain-text'];
  if (kinds.length !== 1 || kinds[0] !== 'plain-text') throw new RubyCapabilityErrorB089('mixed');
  const capability = auditRubyCapabilityB089(engine);
  if (!capability.supported) {
    throw new RubyCapabilityErrorB089('unavailable', capability.missingMethods.join(', '));
  }
}
