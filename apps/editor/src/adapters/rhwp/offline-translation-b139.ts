import {sha256} from '@noble/hashes/sha2.js';

export type TranslationBlockReasonB139 =
  | 'api-unavailable' | 'invalid-context' | 'unsupported-story' | 'protected-document'
  | 'invalid-selection' | 'mixed-formatting' | 'invalid-locale' | 'invalid-provider'
  | 'provider-failed' | 'invalid-response' | 'stale-document' | 'stale-selection'
  | 'stale-original' | 'stale-provider' | 'stale-plan' | 'history-unavailable'
  | 'mutation-rejected' | 'verification-failed' | 'history-state-mismatch';

export interface TranslationSelectionB139 {
  readonly sectionIndex: number;
  readonly paragraphIndex: number;
  readonly startOffset: number;
  readonly endOffset: number;
}

export interface TranslationHostB139 {
  getTextRange(section: number, paragraph: number, offset: number, count: number): string;
  getCharShapeRuns(section: number, paragraph: number, offset: number, count: number): unknown;
  replaceText(section: number, paragraph: number, offset: number, count: number, text: string): unknown;
  saveSnapshot(): number;
  restoreSnapshot(token: number): unknown;
  discardSnapshot(token: number): void;
}

export interface TranslationContextB139 {
  documentIdentity(): unknown;
  revision(): unknown;
  story(): unknown;
  editable(): unknown;
  protected(): unknown;
  selection(): unknown;
}

export interface TranslationRequestB139 {
  readonly sourceLocale: string;
  readonly targetLocale: string;
  readonly source: string;
  readonly requestFingerprint: string;
}

export interface OfflineTranslationProviderB139 {
  id(): unknown;
  version(): unknown;
  offline(): unknown;
  translate(request: TranslationRequestB139): unknown | Promise<unknown>;
}

export interface TranslationPlanB139 {
  readonly version: 1;
  readonly documentIdentity: string;
  readonly revision: string;
  readonly selection: TranslationSelectionB139;
  readonly originalText: string;
  readonly charShapeId: number;
  readonly sourceLocale: string;
  readonly targetLocale: string;
  readonly providerId: string;
  readonly providerVersion: string;
  readonly requestFingerprint: string;
  readonly candidates: readonly string[];
  readonly planFingerprint: string;
}

export type TranslationCaptureB139 =
  | {status: 'ready'; plan: TranslationPlanB139}
  | {status: 'blocked'; reason: TranslationBlockReasonB139};

export type TranslationTransitionB139 =
  | {status: 'applied'; command: TranslationCommandB139; text: string}
  | {status: 'restored'; text: string}
  | {status: 'blocked'; reason: TranslationBlockReasonB139}
  | {status: 'state-uncertain'; reason: 'rollback-failed'};

const required = ['getTextRange', 'getCharShapeRuns', 'replaceText', 'saveSnapshot', 'restoreSnapshot', 'discardSnapshot'] as const;
const identifier = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,255}$/u;
const locale = /^[a-z]{2,3}(?:-[A-Z][a-z]{3})?(?:-(?:[A-Z]{2}|[0-9]{3}))?$/u;
const scalarLength = (value: string): number => Array.from(value).length;
const integer = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function parsed(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return undefined; }
}

function accepted(value: unknown): boolean { return record(parsed(value))?.ok === true; }

function safeText(value: unknown, maximum = 4_000): value is string {
  return typeof value === 'string' && scalarLength(value) > 0 && scalarLength(value) <= maximum
    && !/[\p{Cc}\p{Cf}]/u.test(value);
}

function digest(value: unknown): string {
  return Array.from(sha256(new TextEncoder().encode(JSON.stringify(value))), byte => byte.toString(16).padStart(2, '0')).join('');
}

function hasApi(host: Partial<TranslationHostB139>): host is TranslationHostB139 {
  return required.every(name => typeof (host as Record<string, unknown>)[name] === 'function');
}

function owner(port: TranslationContextB139): {identity: string; revision: string} | undefined {
  try {
    const identity = port.documentIdentity(), revision = port.revision();
    return typeof identity === 'string' && typeof revision === 'string' && identifier.test(identity) && identifier.test(revision)
      ? {identity, revision} : undefined;
  } catch { return undefined; }
}

function unsafe(port: TranslationContextB139): TranslationBlockReasonB139 | undefined {
  try {
    if (port.story() !== 'body') return 'unsupported-story';
    if (port.editable() !== true || port.protected() === true) return 'protected-document';
  } catch { return 'invalid-context'; }
  return undefined;
}

function selection(value: unknown): TranslationSelectionB139 | undefined {
  const raw = record(value);
  if (!raw || Object.keys(raw).sort().join(',') !== 'endOffset,paragraphIndex,sectionIndex,startOffset'
    || !integer(raw.sectionIndex) || !integer(raw.paragraphIndex) || !integer(raw.startOffset) || !integer(raw.endOffset)
    || raw.startOffset === raw.endOffset) return undefined;
  const startOffset = Math.min(raw.startOffset, raw.endOffset), endOffset = Math.max(raw.startOffset, raw.endOffset);
  return endOffset - startOffset <= 4_000 ? {sectionIndex: raw.sectionIndex, paragraphIndex: raw.paragraphIndex, startOffset, endOffset} : undefined;
}

function sameSelection(left: TranslationSelectionB139, right: TranslationSelectionB139): boolean {
  return left.sectionIndex === right.sectionIndex && left.paragraphIndex === right.paragraphIndex
    && left.startOffset === right.startOffset && left.endOffset === right.endOffset;
}

function providerIdentity(provider: OfflineTranslationProviderB139): {id: string; version: string} | undefined {
  try {
    const id = provider.id(), version = provider.version();
    return provider.offline() === true && typeof id === 'string' && typeof version === 'string'
      && identifier.test(id) && identifier.test(version) ? {id, version} : undefined;
  } catch { return undefined; }
}

function read(host: TranslationHostB139, at: TranslationSelectionB139, length?: number): string | undefined {
  try {
    const count = length ?? at.endOffset - at.startOffset;
    const value = host.getTextRange(at.sectionIndex, at.paragraphIndex, at.startOffset, count);
    return typeof value === 'string' && scalarLength(value) === count ? value : undefined;
  } catch { return undefined; }
}

function uniformCharShape(host: TranslationHostB139, at: TranslationSelectionB139): number | undefined {
  try {
    const value = parsed(host.getCharShapeRuns(at.sectionIndex, at.paragraphIndex, at.startOffset, at.endOffset));
    if (!Array.isArray(value) || value.length !== 1) return undefined;
    const ids = new Set<number>();
    for (const item of value) {
      const row = record(item);
      if (!row || !integer(row.charShapeId) || row.startOffset !== at.startOffset || row.endOffset !== at.endOffset) return undefined;
      ids.add(row.charShapeId);
    }
    return ids.size === 1 ? [...ids][0] : undefined;
  } catch { return undefined; }
}

function replace(host: TranslationHostB139, at: TranslationSelectionB139, count: number, text: string): boolean {
  try { return accepted(host.replaceText(at.sectionIndex, at.paragraphIndex, at.startOffset, count, text)); }
  catch { return false; }
}

function response(value: unknown, provider: {id: string; version: string}, requestFingerprint: string): readonly string[] | undefined {
  const raw = record(value);
  if (!raw || Object.keys(raw).sort().join(',') !== 'candidates,providerId,requestFingerprint,version'
    || raw.providerId !== provider.id || raw.version !== provider.version || raw.requestFingerprint !== requestFingerprint
    || !Array.isArray(raw.candidates) || raw.candidates.length === 0 || raw.candidates.length > 8) return undefined;
  const candidates: string[] = [], seen = new Set<string>();
  for (const candidate of raw.candidates) {
    if (!safeText(candidate) || seen.has(candidate)) return undefined;
    seen.add(candidate); candidates.push(candidate);
  }
  return Object.freeze(candidates);
}

function unsigned(plan: TranslationPlanB139): Omit<TranslationPlanB139, 'planFingerprint'> {
  return {version: 1, documentIdentity: plan.documentIdentity, revision: plan.revision, selection: plan.selection,
    originalText: plan.originalText, charShapeId: plan.charShapeId, sourceLocale: plan.sourceLocale,
    targetLocale: plan.targetLocale, providerId: plan.providerId, providerVersion: plan.providerVersion,
    requestFingerprint: plan.requestFingerprint, candidates: plan.candidates};
}

export async function captureOfflineTranslationB139(
  host: Partial<TranslationHostB139>, port: TranslationContextB139, provider: OfflineTranslationProviderB139,
  sourceLocale: unknown, targetLocale: unknown,
): Promise<TranslationCaptureB139> {
  if (!hasApi(host)) return {status: 'blocked', reason: 'api-unavailable'};
  const blocked = unsafe(port); if (blocked) return {status: 'blocked', reason: blocked};
  if (typeof sourceLocale !== 'string' || typeof targetLocale !== 'string' || !locale.test(sourceLocale)
    || !locale.test(targetLocale) || sourceLocale === targetLocale) return {status: 'blocked', reason: 'invalid-locale'};
  const current = owner(port); if (!current) return {status: 'blocked', reason: 'invalid-context'};
  let at: TranslationSelectionB139 | undefined;
  try { at = selection(port.selection()); } catch { return {status: 'blocked', reason: 'invalid-selection'}; }
  if (!at) return {status: 'blocked', reason: 'invalid-selection'};
  const originalText = read(host, at); if (!safeText(originalText)) return {status: 'blocked', reason: 'stale-original'};
  const charShapeId = uniformCharShape(host, at); if (charShapeId === undefined) return {status: 'blocked', reason: 'mixed-formatting'};
  const providerId = providerIdentity(provider);
  if (!providerId || typeof provider.translate !== 'function') return {status: 'blocked', reason: 'invalid-provider'};
  const requestFingerprint = digest({sourceLocale, targetLocale, source: originalText,
    providerId: providerId.id, providerVersion: providerId.version});
  const request = Object.freeze({sourceLocale, targetLocale, source: originalText, requestFingerprint});
  let raw: unknown;
  try { raw = await provider.translate(request); } catch { return {status: 'blocked', reason: 'provider-failed'}; }
  const candidates = response(raw, providerId, requestFingerprint);
  if (!candidates) return {status: 'blocked', reason: 'invalid-response'};
  const base = {version: 1 as const, documentIdentity: current.identity, revision: current.revision, selection: at,
    originalText, charShapeId, sourceLocale, targetLocale, providerId: providerId.id,
    providerVersion: providerId.version, requestFingerprint, candidates};
  return {status: 'ready', plan: Object.freeze({...base, planFingerprint: digest(base)})};
}

export function applyOfflineTranslationB139(
  host: Partial<TranslationHostB139>, port: TranslationContextB139, provider: OfflineTranslationProviderB139,
  plan: TranslationPlanB139, candidateIndex: unknown,
): TranslationTransitionB139 {
  if (!hasApi(host)) return {status: 'blocked', reason: 'api-unavailable'};
  const blocked = unsafe(port); if (blocked) return {status: 'blocked', reason: blocked};
  const providerId = providerIdentity(provider);
  if (!providerId || providerId.id !== plan?.providerId || providerId.version !== plan.providerVersion) {
    return {status: 'blocked', reason: 'stale-provider'};
  }
  const at = selection(plan?.selection);
  if (!at || plan.version !== 1 || !safeText(plan.originalText) || !integer(plan.charShapeId)
    || !locale.test(plan.sourceLocale) || !locale.test(plan.targetLocale) || plan.sourceLocale === plan.targetLocale
    || !Array.isArray(plan.candidates) || plan.candidates.length === 0 || plan.candidates.length > 8
    || !plan.candidates.every(candidate => safeText(candidate)) || new Set(plan.candidates).size !== plan.candidates.length
    || !integer(candidateIndex) || candidateIndex >= plan.candidates.length
    || !/^[0-9a-f]{64}$/u.test(plan.requestFingerprint) || !/^[0-9a-f]{64}$/u.test(plan.planFingerprint)
    || digest(unsigned(plan)) !== plan.planFingerprint) return {status: 'blocked', reason: 'stale-plan'};
  const current = owner(port); if (!current) return {status: 'blocked', reason: 'invalid-context'};
  if (current.identity !== plan.documentIdentity || current.revision !== plan.revision) return {status: 'blocked', reason: 'stale-document'};
  let live: TranslationSelectionB139 | undefined;
  try { live = selection(port.selection()); } catch { return {status: 'blocked', reason: 'stale-selection'}; }
  if (!live || !sameSelection(live, at)) return {status: 'blocked', reason: 'stale-selection'};
  if (read(host, at) !== plan.originalText || uniformCharShape(host, at) !== plan.charShapeId) {
    return {status: 'blocked', reason: 'stale-original'};
  }
  const replacement = plan.candidates[candidateIndex];
  let token: number;
  try { token = host.saveSnapshot(); } catch { return {status: 'blocked', reason: 'history-unavailable'}; }
  if (!integer(token)) return {status: 'blocked', reason: 'history-unavailable'};
  try {
    if (!replace(host, at, scalarLength(plan.originalText), replacement)) throw new Error('mutation');
    const changed = owner(port);
    if (!changed || changed.identity !== plan.documentIdentity || changed.revision === plan.revision
      || read(host, at, scalarLength(replacement)) !== replacement) throw new Error('verify');
    return {status: 'applied', text: replacement,
      command: new TranslationCommandB139(host, port, plan, replacement, token, changed.revision)};
  } catch {
    try {
      if (!accepted(host.restoreSnapshot(token))) throw new Error('rollback');
      const restored = owner(port);
      if (!restored || restored.revision !== plan.revision || read(host, at) !== plan.originalText) throw new Error('rollback');
      host.discardSnapshot(token);
      return {status: 'blocked', reason: 'verification-failed'};
    } catch { return {status: 'state-uncertain', reason: 'rollback-failed'}; }
  }
}

export class TranslationCommandB139 {
  #position: 'before' | 'after' | 'disposed' = 'after';
  private readonly host: TranslationHostB139;
  private readonly port: TranslationContextB139;
  private readonly plan: TranslationPlanB139;
  private readonly replacement: string;
  private readonly token: number;
  private readonly afterRevision: string;
  constructor(
    host: TranslationHostB139, port: TranslationContextB139, plan: TranslationPlanB139,
    replacement: string, token: number, afterRevision: string,
  ) {
    this.host = host; this.port = port; this.plan = plan; this.replacement = replacement;
    this.token = token; this.afterRevision = afterRevision;
  }
  undo(): TranslationTransitionB139 {
    const current = owner(this.port);
    if (this.#position !== 'after' || !current || current.identity !== this.plan.documentIdentity
      || current.revision !== this.afterRevision) return {status: 'blocked', reason: 'history-state-mismatch'};
    try {
      if (!accepted(this.host.restoreSnapshot(this.token))) throw new Error('restore');
      const restored = owner(this.port);
      if (!restored || restored.revision !== this.plan.revision || read(this.host, this.plan.selection) !== this.plan.originalText) {
        throw new Error('verify');
      }
      this.#position = 'before'; return {status: 'restored', text: this.plan.originalText};
    } catch { return {status: 'state-uncertain', reason: 'rollback-failed'}; }
  }
  redo(): TranslationTransitionB139 {
    const current = owner(this.port);
    if (this.#position !== 'before' || !current || current.identity !== this.plan.documentIdentity
      || current.revision !== this.plan.revision || read(this.host, this.plan.selection) !== this.plan.originalText) {
      return {status: 'blocked', reason: 'history-state-mismatch'};
    }
    if (!replace(this.host, this.plan.selection, scalarLength(this.plan.originalText), this.replacement)) {
      return {status: 'blocked', reason: 'mutation-rejected'};
    }
    const changed = owner(this.port);
    if (!changed || changed.revision !== this.afterRevision
      || read(this.host, this.plan.selection, scalarLength(this.replacement)) !== this.replacement) {
      try { this.host.restoreSnapshot(this.token); } catch { return {status: 'state-uncertain', reason: 'rollback-failed'}; }
      return {status: 'blocked', reason: 'verification-failed'};
    }
    this.#position = 'after'; return {status: 'restored', text: this.replacement};
  }
  dispose(): void {
    if (this.#position === 'disposed') return;
    this.#position = 'disposed'; try { this.host.discardSnapshot(this.token); } catch { /* release only */ }
  }
}
