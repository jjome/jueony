import {sha256} from '@noble/hashes/sha2.js';

export type RomanizationModeB083 = 'korean-to-roman' | 'foreign-to-hangul';
export type RomanizationBlockReasonB083 =
  | 'api-unavailable' | 'invalid-context' | 'unsupported-story' | 'protected-document'
  | 'invalid-selection' | 'invalid-provider' | 'provider-failed' | 'invalid-response'
  | 'no-candidate' | 'stale-document' | 'stale-selection' | 'stale-original'
  | 'stale-provider' | 'stale-plan' | 'history-unavailable' | 'mutation-rejected'
  | 'verification-failed' | 'history-state-mismatch';

export interface RomanizationSelectionB083 {
  readonly sectionIndex: number;
  readonly paragraphIndex: number;
  readonly startOffset: number;
  readonly endOffset: number;
}

export interface RomanizationHostB083 {
  getTextRange(section: number, paragraph: number, offset: number, count: number): string;
  replaceText(section: number, paragraph: number, offset: number, count: number, text: string): unknown;
  saveSnapshot(): number;
  restoreSnapshot(token: number): unknown;
  discardSnapshot(token: number): void;
}

export interface RomanizationContextB083 {
  documentIdentity(): unknown;
  revision(): unknown;
  story(): unknown;
  editable(): unknown;
  protected(): unknown;
  selection(): unknown;
}

export interface RomanizationRequestB083 {
  readonly mode: RomanizationModeB083;
  readonly source: string;
  readonly locale: 'ko-KR';
  readonly requestFingerprint: string;
}

export interface OfflineRomanizationProviderB083 {
  id(): unknown;
  version(): unknown;
  convert(request: RomanizationRequestB083): unknown | Promise<unknown>;
}

export interface RomanizationPlanB083 {
  readonly version: 1;
  readonly documentIdentity: string;
  readonly revision: string;
  readonly selection: RomanizationSelectionB083;
  readonly originalText: string;
  readonly mode: RomanizationModeB083;
  readonly providerId: string;
  readonly providerVersion: string;
  readonly requestFingerprint: string;
  readonly candidates: readonly string[];
  readonly planFingerprint: string;
}

export type RomanizationCaptureB083 =
  | {status: 'ready'; plan: RomanizationPlanB083}
  | {status: 'blocked'; reason: RomanizationBlockReasonB083};

export type RomanizationTransitionB083 =
  | {status: 'applied'; command: RomanizationCommandB083; text: string}
  | {status: 'restored'; text: string}
  | {status: 'blocked'; reason: RomanizationBlockReasonB083}
  | {status: 'state-uncertain'; reason: 'rollback-failed'};

const requiredMethods = ['getTextRange', 'replaceText', 'saveSnapshot', 'restoreSnapshot', 'discardSnapshot'] as const;
const identifier = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,255}$/u;

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function integer(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function scalarLength(value: string): number { return Array.from(value).length; }

function safeText(value: unknown, maximum = 1024): value is string {
  return typeof value === 'string' && value.length > 0 && scalarLength(value) <= maximum && !/\p{Cc}/u.test(value);
}

function accepted(value: unknown): boolean {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return record(parsed)?.ok === true;
  } catch { return false; }
}

function hash(value: unknown): string {
  return [...sha256(new TextEncoder().encode(JSON.stringify(value)))]
    .map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function hasApi(host: Partial<RomanizationHostB083>): host is RomanizationHostB083 {
  return requiredMethods.every(name => typeof (host as Record<string, unknown>)[name] === 'function');
}

function contextValue(port: RomanizationContextB083): {identity: string; revision: string} | undefined {
  try {
    const identity = port.documentIdentity(), revision = port.revision();
    if (typeof identity !== 'string' || typeof revision !== 'string'
      || !identifier.test(identity) || !identifier.test(revision)) return undefined;
    return {identity, revision};
  } catch { return undefined; }
}

function unsafeContext(port: RomanizationContextB083): RomanizationBlockReasonB083 | undefined {
  try {
    if (port.story() !== 'body') return 'unsupported-story';
    if (port.editable() !== true || port.protected() === true) return 'protected-document';
  } catch { return 'invalid-context'; }
  return undefined;
}

function normalizeSelection(value: unknown): RomanizationSelectionB083 | undefined {
  const raw = record(value);
  if (!raw || Object.keys(raw).some(key => !['sectionIndex', 'paragraphIndex', 'startOffset', 'endOffset'].includes(key))
    || !integer(raw.sectionIndex) || !integer(raw.paragraphIndex) || !integer(raw.startOffset) || !integer(raw.endOffset)
    || raw.startOffset === raw.endOffset) return undefined;
  const startOffset = Math.min(raw.startOffset, raw.endOffset), endOffset = Math.max(raw.startOffset, raw.endOffset);
  if (endOffset - startOffset > 1024) return undefined;
  return {sectionIndex: raw.sectionIndex, paragraphIndex: raw.paragraphIndex, startOffset, endOffset};
}

function sameSelection(left: RomanizationSelectionB083, right: RomanizationSelectionB083): boolean {
  return left.sectionIndex === right.sectionIndex && left.paragraphIndex === right.paragraphIndex
    && left.startOffset === right.startOffset && left.endOffset === right.endOffset;
}

function providerIdentity(provider: OfflineRomanizationProviderB083): {id: string; version: string} | undefined {
  try {
    const id = provider.id(), version = provider.version();
    if (typeof id !== 'string' || typeof version !== 'string' || !identifier.test(id) || !identifier.test(version)) return undefined;
    return {id, version};
  } catch { return undefined; }
}

function read(host: RomanizationHostB083, selection: RomanizationSelectionB083, length?: number): string | undefined {
  try {
    const count = length ?? selection.endOffset - selection.startOffset;
    const value = host.getTextRange(selection.sectionIndex, selection.paragraphIndex, selection.startOffset, count);
    return typeof value === 'string' && scalarLength(value) === count ? value : undefined;
  } catch { return undefined; }
}

function replace(host: RomanizationHostB083, selection: RomanizationSelectionB083, remove: number, text: string): boolean {
  try {
    return accepted(host.replaceText(selection.sectionIndex, selection.paragraphIndex, selection.startOffset, remove, text));
  } catch { return false; }
}

function normalizeCandidates(value: unknown, identity: {id: string; version: string}, requestFingerprint: string): readonly string[] | undefined {
  const response = record(value);
  if (!response || Object.keys(response).sort().join(',') !== 'candidates,providerId,requestFingerprint,version'
    || response.providerId !== identity.id || response.version !== identity.version || response.requestFingerprint !== requestFingerprint
    || !Array.isArray(response.candidates) || response.candidates.length === 0 || response.candidates.length > 16) return undefined;
  const candidates: string[] = [];
  const seen = new Set<string>();
  for (const candidate of response.candidates) {
    if (!safeText(candidate) || seen.has(candidate)) return undefined;
    seen.add(candidate); candidates.push(candidate);
  }
  return Object.freeze(candidates);
}

function unsigned(plan: RomanizationPlanB083): Omit<RomanizationPlanB083, 'planFingerprint'> {
  return {version: 1, documentIdentity: plan.documentIdentity, revision: plan.revision, selection: plan.selection,
    originalText: plan.originalText, mode: plan.mode, providerId: plan.providerId, providerVersion: plan.providerVersion,
    requestFingerprint: plan.requestFingerprint, candidates: plan.candidates};
}

export async function captureRomanizationB083(
  host: Partial<RomanizationHostB083>, port: RomanizationContextB083,
  provider: OfflineRomanizationProviderB083, mode: RomanizationModeB083,
): Promise<RomanizationCaptureB083> {
  if (!hasApi(host)) return {status: 'blocked', reason: 'api-unavailable'};
  const unsafe = unsafeContext(port); if (unsafe) return {status: 'blocked', reason: unsafe};
  if (mode !== 'korean-to-roman' && mode !== 'foreign-to-hangul') return {status: 'blocked', reason: 'invalid-context'};
  const current = contextValue(port); if (!current) return {status: 'blocked', reason: 'invalid-context'};
  let selection: RomanizationSelectionB083 | undefined;
  try { selection = normalizeSelection(port.selection()); } catch { return {status: 'blocked', reason: 'invalid-selection'}; }
  if (!selection) return {status: 'blocked', reason: 'invalid-selection'};
  const originalText = read(host, selection); if (!safeText(originalText)) return {status: 'blocked', reason: 'stale-original'};
  const identity = providerIdentity(provider); if (!identity || typeof provider.convert !== 'function') return {status: 'blocked', reason: 'invalid-provider'};
  const requestFingerprint = hash({mode, source: originalText, locale: 'ko-KR', providerId: identity.id, providerVersion: identity.version});
  const request = Object.freeze({mode, source: originalText, locale: 'ko-KR' as const, requestFingerprint});
  let response: unknown;
  try { response = await provider.convert(request); } catch { return {status: 'blocked', reason: 'provider-failed'}; }
  const candidates = normalizeCandidates(response, identity, requestFingerprint);
  if (!candidates) return {status: 'blocked', reason: 'invalid-response'};
  const base = {version: 1 as const, documentIdentity: current.identity, revision: current.revision, selection,
    originalText, mode, providerId: identity.id, providerVersion: identity.version, requestFingerprint, candidates};
  return {status: 'ready', plan: Object.freeze({...base, planFingerprint: hash(base)})};
}

export function applyRomanizationB083(
  host: Partial<RomanizationHostB083>, port: RomanizationContextB083,
  provider: OfflineRomanizationProviderB083, plan: RomanizationPlanB083, candidateIndex: number,
): RomanizationTransitionB083 {
  if (!hasApi(host)) return {status: 'blocked', reason: 'api-unavailable'};
  const unsafe = unsafeContext(port); if (unsafe) return {status: 'blocked', reason: unsafe};
  const identity = providerIdentity(provider); if (!identity || identity.id !== plan.providerId || identity.version !== plan.providerVersion) {
    return {status: 'blocked', reason: 'stale-provider'};
  }
  const selection = normalizeSelection(plan?.selection);
  if (!selection || plan.version !== 1 || !safeText(plan.originalText) || !Array.isArray(plan.candidates)
    || plan.candidates.length === 0 || plan.candidates.length > 16 || !plan.candidates.every(value => safeText(value))
    || new Set(plan.candidates).size !== plan.candidates.length || !integer(candidateIndex) || candidateIndex >= plan.candidates.length
    || !/^[0-9a-f]{64}$/u.test(plan.requestFingerprint) || !/^[0-9a-f]{64}$/u.test(plan.planFingerprint)
    || hash(unsigned(plan)) !== plan.planFingerprint) return {status: 'blocked', reason: 'stale-plan'};
  const current = contextValue(port); if (!current) return {status: 'blocked', reason: 'invalid-context'};
  if (current.identity !== plan.documentIdentity || current.revision !== plan.revision) return {status: 'blocked', reason: 'stale-document'};
  let liveSelection: RomanizationSelectionB083 | undefined;
  try { liveSelection = normalizeSelection(port.selection()); } catch { return {status: 'blocked', reason: 'stale-selection'}; }
  if (!liveSelection || !sameSelection(liveSelection, selection)) return {status: 'blocked', reason: 'stale-selection'};
  if (read(host, selection) !== plan.originalText) return {status: 'blocked', reason: 'stale-original'};
  const replacement = plan.candidates[candidateIndex];
  let token: number;
  try { token = host.saveSnapshot(); } catch { return {status: 'blocked', reason: 'history-unavailable'}; }
  if (!integer(token)) return {status: 'blocked', reason: 'history-unavailable'};
  try {
    if (!replace(host, selection, scalarLength(plan.originalText), replacement)) throw new Error('mutation');
    const changed = contextValue(port);
    if (!changed || changed.identity !== plan.documentIdentity || changed.revision === plan.revision
      || read(host, selection, scalarLength(replacement)) !== replacement) throw new Error('verify');
    return {status: 'applied', text: replacement,
      command: new RomanizationCommandB083(host, port, plan, candidateIndex, token, changed.revision)};
  } catch {
    try {
      if (!accepted(host.restoreSnapshot(token))) throw new Error('rollback');
      const restored = contextValue(port);
      if (!restored || restored.revision !== plan.revision || read(host, selection) !== plan.originalText) throw new Error('rollback');
      host.discardSnapshot(token);
      return {status: 'blocked', reason: 'verification-failed'};
    } catch { return {status: 'state-uncertain', reason: 'rollback-failed'}; }
  }
}

export class RomanizationCommandB083 {
  #position: 'before' | 'after' | 'disposed' = 'after';
  private readonly replacement: string;
  constructor(
    privateHost: RomanizationHostB083, privatePort: RomanizationContextB083, privatePlan: RomanizationPlanB083,
    candidateIndex: number, privateToken: number, privateAfterRevision: string,
  ) {
    this.host = privateHost; this.port = privatePort; this.plan = privatePlan; this.token = privateToken;
    this.afterRevision = privateAfterRevision; this.replacement = privatePlan.candidates[candidateIndex];
  }
  private readonly host: RomanizationHostB083;
  private readonly port: RomanizationContextB083;
  private readonly plan: RomanizationPlanB083;
  private readonly token: number;
  private readonly afterRevision: string;
  undo(): RomanizationTransitionB083 {
    const current = contextValue(this.port);
    if (this.#position !== 'after' || !current || current.identity !== this.plan.documentIdentity
      || current.revision !== this.afterRevision) return {status: 'blocked', reason: 'history-state-mismatch'};
    try {
      if (!accepted(this.host.restoreSnapshot(this.token))) throw new Error('restore');
      const restored = contextValue(this.port);
      if (!restored || restored.revision !== this.plan.revision || read(this.host, this.plan.selection) !== this.plan.originalText) throw new Error('verify');
      this.#position = 'before'; return {status: 'restored', text: this.plan.originalText};
    } catch { return {status: 'state-uncertain', reason: 'rollback-failed'}; }
  }
  redo(): RomanizationTransitionB083 {
    const current = contextValue(this.port);
    if (this.#position !== 'before' || !current || current.identity !== this.plan.documentIdentity
      || current.revision !== this.plan.revision || read(this.host, this.plan.selection) !== this.plan.originalText) {
      return {status: 'blocked', reason: 'history-state-mismatch'};
    }
    if (!replace(this.host, this.plan.selection, scalarLength(this.plan.originalText), this.replacement)) {
      return {status: 'blocked', reason: 'mutation-rejected'};
    }
    const changed = contextValue(this.port);
    if (!changed || changed.revision !== this.afterRevision || read(this.host, this.plan.selection, scalarLength(this.replacement)) !== this.replacement) {
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
