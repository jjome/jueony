import {sha256} from '@noble/hashes/sha2.js';

export type LicenseMarkKindB016 =
  | 'ccl-by' | 'ccl-by-sa' | 'ccl-by-nd' | 'ccl-by-nc' | 'ccl-by-nc-sa' | 'ccl-by-nc-nd'
  | 'kogl-type-1' | 'kogl-type-2' | 'kogl-type-3' | 'kogl-type-4';

export type LicenseMarkPointB016 = Readonly<{
  sectionIndex: number;
  paragraphIndex: number;
  charOffset: number;
  parentParaIndex?: unknown;
  path?: unknown;
  isTextBox?: unknown;
  isHeaderFooter?: unknown;
  isFootnote?: unknown;
}>;

export type LicenseMarkSelectionB016 = Readonly<{start: LicenseMarkPointB016; end: LicenseMarkPointB016}>;

export interface LicenseMarkHostB016 {
  getParagraphLength(section: number, paragraph: number): number;
  getTextRange(section: number, paragraph: number, offset: number, count: number): string;
  insertText(section: number, paragraph: number, offset: number, text: string): unknown;
  deleteRange(section: number, startParagraph: number, startOffset: number, endParagraph: number, endOffset: number): unknown;
  saveSnapshot(): number;
  restoreSnapshot(token: number): unknown;
  discardSnapshot(token: number): void;
}

export interface LicenseMarkContextB016 {
  documentIdentity(): unknown;
  revision(): unknown;
  story(): unknown;
  editable(): unknown;
  protected(): unknown;
  selection(): unknown;
}

export type LicenseMarkPlanB016 = Readonly<{
  version: 1;
  documentIdentity: string;
  revision: string;
  kind: LicenseMarkKindB016;
  text: string;
  point: LicenseMarkPointB016;
  paragraphFingerprint: string;
}>;

export type LicenseMarkCaptureB016 =
  | {status: 'ready'; plan: LicenseMarkPlanB016}
  | {status: 'blocked'; reason: LicenseMarkBlockReasonB016};

export type LicenseMarkTransitionB016 =
  | {status: 'applied'; command: LicenseMarkCommandB016; text: string}
  | {status: 'restored'; text: string}
  | {status: 'blocked'; reason: LicenseMarkBlockReasonB016}
  | {status: 'state-uncertain'; reason: 'rollback-failed'};

export type LicenseMarkBlockReasonB016 =
  | 'api-unavailable' | 'invalid-context' | 'unsupported-story' | 'protected-document'
  | 'unsupported-selection' | 'unsupported-license' | 'stale-document' | 'stale-selection'
  | 'stale-original' | 'history-unavailable' | 'mutation-rejected' | 'verification-failed'
  | 'history-state-mismatch';

const MARKS: Readonly<Record<LicenseMarkKindB016, string>> = Object.freeze({
  'ccl-by': '[CC BY 4.0] 이 저작물은 저작자표시 4.0 국제 라이선스에 따라 이용할 수 있습니다.',
  'ccl-by-sa': '[CC BY-SA 4.0] 이 저작물은 저작자표시-동일조건변경허락 4.0 국제 라이선스에 따라 이용할 수 있습니다.',
  'ccl-by-nd': '[CC BY-ND 4.0] 이 저작물은 저작자표시-변경금지 4.0 국제 라이선스에 따라 이용할 수 있습니다.',
  'ccl-by-nc': '[CC BY-NC 4.0] 이 저작물은 저작자표시-비영리 4.0 국제 라이선스에 따라 이용할 수 있습니다.',
  'ccl-by-nc-sa': '[CC BY-NC-SA 4.0] 이 저작물은 저작자표시-비영리-동일조건변경허락 4.0 국제 라이선스에 따라 이용할 수 있습니다.',
  'ccl-by-nc-nd': '[CC BY-NC-ND 4.0] 이 저작물은 저작자표시-비영리-변경금지 4.0 국제 라이선스에 따라 이용할 수 있습니다.',
  'kogl-type-1': '[공공누리 제1유형] 출처표시 조건에 따라 이용할 수 있습니다.',
  'kogl-type-2': '[공공누리 제2유형] 출처표시 및 상업적 이용금지 조건에 따라 이용할 수 있습니다.',
  'kogl-type-3': '[공공누리 제3유형] 출처표시 및 변경금지 조건에 따라 이용할 수 있습니다.',
  'kogl-type-4': '[공공누리 제4유형] 출처표시·상업적 이용금지·변경금지 조건에 따라 이용할 수 있습니다.',
});

const required = ['getParagraphLength', 'getTextRange', 'insertText', 'deleteRange', 'saveSnapshot', 'restoreSnapshot', 'discardSnapshot'] as const;
const scalarLength = (value: string): number => Array.from(value).length;
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const bounded = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 1024;
const hash = (value: string): string => Array.from(sha256(new TextEncoder().encode(value)), byte => byte.toString(16).padStart(2, '0')).join('');

function accepted(value: unknown): boolean {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      && (parsed as Record<string, unknown>).ok === true;
  } catch { return false; }
}

function hasApi(host: Partial<LicenseMarkHostB016>): host is LicenseMarkHostB016 {
  return required.every(name => typeof (host as Record<string, unknown>)[name] === 'function');
}

function kind(value: unknown): value is LicenseMarkKindB016 {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(MARKS, value);
}

function point(value: unknown): LicenseMarkPointB016 | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const item = value as Record<string, unknown>;
  if (!integer(item.sectionIndex) || !integer(item.paragraphIndex) || !integer(item.charOffset)
    || item.parentParaIndex !== undefined || item.isTextBox === true || item.isHeaderFooter === true || item.isFootnote === true
    || (item.path !== undefined && (!Array.isArray(item.path) || item.path.length !== 0))) return undefined;
  return {sectionIndex: item.sectionIndex, paragraphIndex: item.paragraphIndex, charOffset: item.charOffset};
}

function collapsed(value: unknown): LicenseMarkPointB016 | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const range = value as Record<string, unknown>, start = point(range.start), end = point(range.end);
  if (!start || !end || start.sectionIndex !== end.sectionIndex || start.paragraphIndex !== end.paragraphIndex
    || start.charOffset !== end.charOffset) return undefined;
  return start;
}

function samePoint(left: LicenseMarkPointB016, right: LicenseMarkPointB016): boolean {
  return left.sectionIndex === right.sectionIndex && left.paragraphIndex === right.paragraphIndex && left.charOffset === right.charOffset;
}

function context(port: LicenseMarkContextB016): {identity: string; revision: string} | undefined {
  try {
    const identity = port.documentIdentity(), revision = port.revision();
    return bounded(identity) && bounded(revision) ? {identity, revision} : undefined;
  } catch { return undefined; }
}

function safe(port: LicenseMarkContextB016): LicenseMarkBlockReasonB016 | undefined {
  try {
    if (port.story() !== 'body') return 'unsupported-story';
    if (port.editable() !== true || port.protected() === true) return 'protected-document';
  } catch { return 'invalid-context'; }
  return undefined;
}

function paragraph(host: LicenseMarkHostB016, at: LicenseMarkPointB016): string | undefined {
  try {
    const length = host.getParagraphLength(at.sectionIndex, at.paragraphIndex);
    if (!integer(length) || at.charOffset > length || length > 1_000_000) return undefined;
    const text = host.getTextRange(at.sectionIndex, at.paragraphIndex, 0, length);
    return typeof text === 'string' && scalarLength(text) === length ? text : undefined;
  } catch { return undefined; }
}

export function licenseMarkTextB016(value: LicenseMarkKindB016): string { return MARKS[value]; }
export function licenseMarkKindsB016(): readonly LicenseMarkKindB016[] { return Object.freeze(Object.keys(MARKS) as LicenseMarkKindB016[]); }

export function captureLicenseMarkB016(
  host: Partial<LicenseMarkHostB016>, port: LicenseMarkContextB016, requestedKind: unknown,
): LicenseMarkCaptureB016 {
  if (!hasApi(host)) return {status: 'blocked', reason: 'api-unavailable'};
  const unsafe = safe(port); if (unsafe) return {status: 'blocked', reason: unsafe};
  if (!kind(requestedKind)) return {status: 'blocked', reason: 'unsupported-license'};
  const owner = context(port); if (!owner) return {status: 'blocked', reason: 'invalid-context'};
  let at: LicenseMarkPointB016 | undefined;
  try { at = collapsed(port.selection()); } catch { return {status: 'blocked', reason: 'invalid-context'}; }
  if (!at) return {status: 'blocked', reason: 'unsupported-selection'};
  const original = paragraph(host, at); if (original === undefined) return {status: 'blocked', reason: 'stale-original'};
  return {status: 'ready', plan: Object.freeze({
    version: 1, documentIdentity: owner.identity, revision: owner.revision, kind: requestedKind,
    text: MARKS[requestedKind], point: at, paragraphFingerprint: hash(original),
  })};
}

export function applyLicenseMarkB016(
  host: Partial<LicenseMarkHostB016>, port: LicenseMarkContextB016, plan: LicenseMarkPlanB016,
): LicenseMarkTransitionB016 {
  if (!hasApi(host)) return {status: 'blocked', reason: 'api-unavailable'};
  const unsafe = safe(port); if (unsafe) return {status: 'blocked', reason: unsafe};
  if (!plan || plan.version !== 1 || !bounded(plan.documentIdentity) || !bounded(plan.revision) || !kind(plan.kind)
    || plan.text !== MARKS[plan.kind] || !/^[0-9a-f]{64}$/u.test(plan.paragraphFingerprint) || !point(plan.point)) {
    return {status: 'blocked', reason: 'invalid-context'};
  }
  const owner = context(port); if (!owner) return {status: 'blocked', reason: 'invalid-context'};
  if (owner.identity !== plan.documentIdentity || owner.revision !== plan.revision) return {status: 'blocked', reason: 'stale-document'};
  let at: LicenseMarkPointB016 | undefined;
  try { at = collapsed(port.selection()); } catch { return {status: 'blocked', reason: 'invalid-context'}; }
  if (!at || !samePoint(at, plan.point)) return {status: 'blocked', reason: 'stale-selection'};
  const original = paragraph(host, plan.point);
  if (original === undefined || hash(original) !== plan.paragraphFingerprint) return {status: 'blocked', reason: 'stale-original'};

  let snapshot: number;
  try { snapshot = host.saveSnapshot(); } catch { return {status: 'blocked', reason: 'history-unavailable'}; }
  if (!integer(snapshot)) return {status: 'blocked', reason: 'history-unavailable'};
  try {
    if (!accepted(host.insertText(plan.point.sectionIndex, plan.point.paragraphIndex, plan.point.charOffset, plan.text))) {
      throw new Error('mutation');
    }
    const after = context(port);
    if (!after || after.identity !== plan.documentIdentity || after.revision === plan.revision
      || host.getTextRange(plan.point.sectionIndex, plan.point.paragraphIndex, plan.point.charOffset, scalarLength(plan.text)) !== plan.text) {
      throw new Error('verification');
    }
    return {status: 'applied', text: plan.text, command: new LicenseMarkCommandB016(host, port, plan, snapshot, after.revision)};
  } catch {
    try {
      if (!accepted(host.restoreSnapshot(snapshot))) throw new Error('restore');
      const restored = context(port), restoredParagraph = paragraph(host, plan.point);
      if (!restored || restored.identity !== plan.documentIdentity || restored.revision !== plan.revision
        || restoredParagraph === undefined || hash(restoredParagraph) !== plan.paragraphFingerprint) throw new Error('verify');
      host.discardSnapshot(snapshot);
      return {status: 'blocked', reason: 'verification-failed'};
    } catch { return {status: 'state-uncertain', reason: 'rollback-failed'}; }
  }
}

export class LicenseMarkCommandB016 {
  #position: 'before' | 'after' | 'disposed' = 'after';
  readonly #host: LicenseMarkHostB016;
  readonly #port: LicenseMarkContextB016;
  readonly #plan: LicenseMarkPlanB016;
  readonly #snapshot: number;
  readonly #afterRevision: string;
  constructor(
    host: LicenseMarkHostB016,
    port: LicenseMarkContextB016,
    plan: LicenseMarkPlanB016,
    snapshot: number,
    afterRevision: string,
  ) {
    this.#host = host;
    this.#port = port;
    this.#plan = plan;
    this.#snapshot = snapshot;
    this.#afterRevision = afterRevision;
  }

  undo(): LicenseMarkTransitionB016 {
    if (this.#position !== 'after') return {status: 'blocked', reason: 'history-state-mismatch'};
    const owner = context(this.#port), unsafe = safe(this.#port);
    if (unsafe || !owner || owner.identity !== this.#plan.documentIdentity || owner.revision !== this.#afterRevision) {
      return {status: 'blocked', reason: 'history-state-mismatch'};
    }
    try {
      if (!accepted(this.#host.restoreSnapshot(this.#snapshot))) throw new Error('restore');
      const restored = context(this.#port), original = paragraph(this.#host, this.#plan.point);
      if (!restored || restored.identity !== this.#plan.documentIdentity || restored.revision !== this.#plan.revision
        || original === undefined || hash(original) !== this.#plan.paragraphFingerprint) throw new Error('verify');
      this.#position = 'before';
      return {status: 'restored', text: ''};
    } catch { return {status: 'state-uncertain', reason: 'rollback-failed'}; }
  }

  redo(): LicenseMarkTransitionB016 {
    if (this.#position !== 'before') return {status: 'blocked', reason: 'history-state-mismatch'};
    const owner = context(this.#port), unsafe = safe(this.#port), original = paragraph(this.#host, this.#plan.point);
    if (unsafe || !owner || owner.identity !== this.#plan.documentIdentity || owner.revision !== this.#plan.revision
      || original === undefined || hash(original) !== this.#plan.paragraphFingerprint) return {status: 'blocked', reason: 'history-state-mismatch'};
    try {
      if (!accepted(this.#host.insertText(this.#plan.point.sectionIndex, this.#plan.point.paragraphIndex, this.#plan.point.charOffset, this.#plan.text))) {
        throw new Error('mutation');
      }
      const after = context(this.#port);
      if (!after || after.revision !== this.#afterRevision || after.identity !== this.#plan.documentIdentity
        || this.#host.getTextRange(this.#plan.point.sectionIndex, this.#plan.point.paragraphIndex,
          this.#plan.point.charOffset, scalarLength(this.#plan.text)) !== this.#plan.text) throw new Error('verify');
      this.#position = 'after';
      return {status: 'restored', text: this.#plan.text};
    } catch {
      try { if (!accepted(this.#host.restoreSnapshot(this.#snapshot))) throw new Error('restore'); }
      catch { return {status: 'state-uncertain', reason: 'rollback-failed'}; }
      return {status: 'blocked', reason: 'verification-failed'};
    }
  }

  dispose(): void {
    if (this.#position === 'disposed') return;
    this.#position = 'disposed';
    try { this.#host.discardSnapshot(this.#snapshot); } catch { /* release only */ }
  }
}
