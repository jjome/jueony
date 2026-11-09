import {sha256} from '@noble/hashes/sha2.js';

export interface HanjaSelectionB091 {
  readonly sectionIndex: number;
  readonly paragraphIndex: number;
  readonly startOffset: number;
  readonly endOffset: number;
}

export interface HanjaCandidateB091 {
  readonly id: string;
  readonly text: string;
  readonly reading?: string;
  readonly meaning?: string;
}

export interface HanjaLookupRequestB091 {
  readonly text: string;
  readonly locale: 'ko-KR';
  readonly requestFingerprint: string;
}

export interface OfflineHanjaProviderB091 {
  readonly id: string;
  readonly version: string;
  readonly offline: true;
  lookup(request: HanjaLookupRequestB091): unknown | Promise<unknown>;
}

export interface HanjaInputHostB091 {
  getTextRange(section: number, paragraph: number, offset: number, count: number): string;
  replaceText(section: number, paragraph: number, offset: number, count: number, text: string): unknown;
  saveSnapshot(): number;
  restoreSnapshot(token: number): unknown;
  discardSnapshot(token: number): void;
}

export interface HanjaInputContextB091 {
  documentIdentity(): unknown;
  revision(): unknown;
  story(): unknown;
  editable(): unknown;
  protected(): unknown;
  selection(): unknown;
}

export interface HanjaInputPlanB091 {
  readonly version: 1;
  readonly documentIdentity: string;
  readonly revision: string;
  readonly selection: HanjaSelectionB091;
  readonly originalText: string;
  readonly providerId: string;
  readonly providerVersion: string;
  readonly requestFingerprint: string;
  readonly candidates: readonly HanjaCandidateB091[];
  readonly candidatesFingerprint: string;
  readonly fingerprint: string;
}

export type HanjaInputBlockReasonB091 =
  | 'api-unavailable' | 'invalid-context' | 'unsupported-story' | 'protected-document'
  | 'invalid-selection' | 'invalid-provider' | 'provider-failed' | 'invalid-candidates'
  | 'no-candidates' | 'stale-document' | 'stale-selection' | 'stale-original'
  | 'stale-plan' | 'unknown-candidate' | 'history-unavailable'
  | 'mutation-rejected' | 'verification-failed' | 'history-state-mismatch';

export type HanjaInputCaptureB091 =
  | {status: 'ready'; plan: HanjaInputPlanB091}
  | {status: 'blocked'; reason: HanjaInputBlockReasonB091};

export type HanjaInputTransitionB091 =
  | {status: 'applied'; command: HanjaInputCommandB091; text: string}
  | {status: 'restored'; text: string}
  | {status: 'blocked'; reason: HanjaInputBlockReasonB091}
  | {status: 'state-uncertain'; reason: 'rollback-failed'};

const requiredMethods = ['getTextRange', 'replaceText', 'saveSnapshot', 'restoreSnapshot', 'discardSnapshot'] as const;
const tokenPattern = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,255}$/u;

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function integer(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function scalarLength(value: string): number { return Array.from(value).length; }

function boundedText(value: unknown, maximum: number, allowEmpty = false): value is string {
  return typeof value === 'string' && (allowEmpty || value.length > 0) && scalarLength(value) <= maximum
    && !/[\p{Cc}\p{Cs}]/u.test(value);
}

function hash(value: unknown): string {
  return [...sha256(new TextEncoder().encode(JSON.stringify(value)))]
    .map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function accepted(value: unknown): boolean {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return record(parsed)?.ok === true;
  } catch { return false; }
}

function hasApi(host: Partial<HanjaInputHostB091>): host is HanjaInputHostB091 {
  return requiredMethods.every(name => typeof (host as Record<string, unknown>)[name] === 'function');
}

function safeContext(port: HanjaInputContextB091): HanjaInputBlockReasonB091 | undefined {
  try {
    if (port.story() !== 'body') return 'unsupported-story';
    if (port.editable() !== true || port.protected() === true) return 'protected-document';
  } catch { return 'invalid-context'; }
  return undefined;
}

function documentState(port: HanjaInputContextB091): {identity: string; revision: string} | undefined {
  try {
    const identity = port.documentIdentity(), revision = port.revision();
    return typeof identity === 'string' && typeof revision === 'string'
      && tokenPattern.test(identity) && tokenPattern.test(revision) ? {identity, revision} : undefined;
  } catch { return undefined; }
}

function selection(value: unknown): HanjaSelectionB091 | undefined {
  const raw = record(value);
  if (!raw || Object.keys(raw).some(key => !['sectionIndex', 'paragraphIndex', 'startOffset', 'endOffset'].includes(key))
    || !integer(raw.sectionIndex) || !integer(raw.paragraphIndex) || !integer(raw.startOffset) || !integer(raw.endOffset)
    || raw.startOffset === raw.endOffset) return undefined;
  const startOffset = Math.min(raw.startOffset, raw.endOffset), endOffset = Math.max(raw.startOffset, raw.endOffset);
  return endOffset - startOffset <= 64
    ? {sectionIndex: raw.sectionIndex, paragraphIndex: raw.paragraphIndex, startOffset, endOffset}
    : undefined;
}

function sameSelection(left: HanjaSelectionB091, right: HanjaSelectionB091): boolean {
  return left.sectionIndex === right.sectionIndex && left.paragraphIndex === right.paragraphIndex
    && left.startOffset === right.startOffset && left.endOffset === right.endOffset;
}

function read(host: HanjaInputHostB091, target: HanjaSelectionB091): string | undefined {
  try {
    const count = target.endOffset - target.startOffset;
    const text = host.getTextRange(target.sectionIndex, target.paragraphIndex, target.startOffset, count);
    return boundedText(text, 64) && scalarLength(text) === count ? text : undefined;
  } catch { return undefined; }
}

function providerInfo(provider: unknown): {provider: OfflineHanjaProviderB091; id: string; version: string} | undefined {
  const raw = record(provider);
  if (!raw || raw.offline !== true || typeof raw.lookup !== 'function'
    || typeof raw.id !== 'string' || typeof raw.version !== 'string'
    || !tokenPattern.test(raw.id) || !tokenPattern.test(raw.version)) return undefined;
  return {provider: provider as OfflineHanjaProviderB091, id: raw.id, version: raw.version};
}

function candidates(value: unknown): readonly HanjaCandidateB091[] | undefined {
  if (!Array.isArray(value) || value.length === 0 || value.length > 32) return undefined;
  const ids = new Set<string>(), texts = new Set<string>();
  const result: HanjaCandidateB091[] = [];
  for (const item of value) {
    const raw = record(item), keys = raw ? Object.keys(raw) : [];
    if (!raw || keys.some(key => !['id', 'text', 'reading', 'meaning'].includes(key))
      || typeof raw.id !== 'string' || !tokenPattern.test(raw.id)
      || !boundedText(raw.text, 64) || !/\p{Script=Han}/u.test(raw.text)
      || (raw.reading !== undefined && !boundedText(raw.reading, 128))
      || (raw.meaning !== undefined && !boundedText(raw.meaning, 256, true))
      || ids.has(raw.id) || texts.has(raw.text)) return undefined;
    ids.add(raw.id); texts.add(raw.text);
    result.push(Object.freeze({id: raw.id, text: raw.text,
      ...(raw.reading === undefined ? {} : {reading: raw.reading as string}),
      ...(raw.meaning === undefined ? {} : {meaning: raw.meaning as string})}));
  }
  return Object.freeze(result);
}

function planFingerprint(plan: Omit<HanjaInputPlanB091, 'fingerprint'>): string { return hash(plan); }

function validPlan(plan: HanjaInputPlanB091): boolean {
  const normalizedSelection = selection(plan?.selection), normalizedCandidates = candidates(plan?.candidates);
  if (!normalizedSelection || !normalizedCandidates || plan.version !== 1
    || !tokenPattern.test(plan.documentIdentity) || !tokenPattern.test(plan.revision)
    || !tokenPattern.test(plan.providerId) || !tokenPattern.test(plan.providerVersion)
    || !boundedText(plan.originalText, 64) || !/^[0-9a-f]{64}$/u.test(plan.requestFingerprint)
    || !/^[0-9a-f]{64}$/u.test(plan.candidatesFingerprint) || !/^[0-9a-f]{64}$/u.test(plan.fingerprint)) return false;
  const unsigned = {version: 1 as const, documentIdentity: plan.documentIdentity, revision: plan.revision,
    selection: normalizedSelection, originalText: plan.originalText, providerId: plan.providerId,
    providerVersion: plan.providerVersion, requestFingerprint: plan.requestFingerprint,
    candidates: normalizedCandidates, candidatesFingerprint: plan.candidatesFingerprint};
  return hash(normalizedCandidates) === plan.candidatesFingerprint && planFingerprint(unsigned) === plan.fingerprint;
}

export async function captureHanjaInputB091(
  host: Partial<HanjaInputHostB091>, port: HanjaInputContextB091, providerValue: unknown,
): Promise<HanjaInputCaptureB091> {
  if (!hasApi(host)) return {status: 'blocked', reason: 'api-unavailable'};
  const unsafe = safeContext(port); if (unsafe) return {status: 'blocked', reason: unsafe};
  const state = documentState(port); if (!state) return {status: 'blocked', reason: 'invalid-context'};
  let target: HanjaSelectionB091 | undefined;
  try { target = selection(port.selection()); } catch { return {status: 'blocked', reason: 'invalid-selection'}; }
  if (!target) return {status: 'blocked', reason: 'invalid-selection'};
  const originalText = read(host, target); if (!originalText) return {status: 'blocked', reason: 'stale-original'};
  const info = providerInfo(providerValue); if (!info) return {status: 'blocked', reason: 'invalid-provider'};
  const requestFingerprint = hash({documentIdentity: state.identity, revision: state.revision, selection: target,
    originalText, providerId: info.id, providerVersion: info.version, locale: 'ko-KR'});
  let response: unknown;
  try { response = await info.provider.lookup({text: originalText, locale: 'ko-KR', requestFingerprint}); }
  catch { return {status: 'blocked', reason: 'provider-failed'}; }
  const normalized = candidates(response); if (!normalized) return {status: 'blocked', reason: Array.isArray(response) && response.length === 0 ? 'no-candidates' : 'invalid-candidates'};
  const liveState = documentState(port);
  let liveSelection: HanjaSelectionB091 | undefined;
  try { liveSelection = selection(port.selection()); } catch { return {status: 'blocked', reason: 'stale-selection'}; }
  if (!liveState || liveState.identity !== state.identity || liveState.revision !== state.revision) return {status: 'blocked', reason: 'stale-document'};
  if (!liveSelection || !sameSelection(liveSelection, target)) return {status: 'blocked', reason: 'stale-selection'};
  if (read(host, target) !== originalText) return {status: 'blocked', reason: 'stale-original'};
  const unsigned = {version: 1 as const, documentIdentity: state.identity, revision: state.revision,
    selection: target, originalText, providerId: info.id, providerVersion: info.version,
    requestFingerprint, candidates: normalized, candidatesFingerprint: hash(normalized)};
  return {status: 'ready', plan: Object.freeze({...unsigned, fingerprint: planFingerprint(unsigned)})};
}

export function applyHanjaInputB091(
  host: Partial<HanjaInputHostB091>, port: HanjaInputContextB091, plan: HanjaInputPlanB091, candidateId: string,
): HanjaInputTransitionB091 {
  if (!hasApi(host)) return {status: 'blocked', reason: 'api-unavailable'};
  const unsafe = safeContext(port); if (unsafe) return {status: 'blocked', reason: unsafe};
  if (!validPlan(plan)) return {status: 'blocked', reason: 'stale-plan'};
  const chosen = plan.candidates.filter(candidate => candidate.id === candidateId);
  if (chosen.length !== 1) return {status: 'blocked', reason: 'unknown-candidate'};
  const state = documentState(port);
  if (!state || state.identity !== plan.documentIdentity || state.revision !== plan.revision) return {status: 'blocked', reason: 'stale-document'};
  let liveSelection: HanjaSelectionB091 | undefined;
  try { liveSelection = selection(port.selection()); } catch { return {status: 'blocked', reason: 'stale-selection'}; }
  if (!liveSelection || !sameSelection(liveSelection, plan.selection)) return {status: 'blocked', reason: 'stale-selection'};
  if (read(host, plan.selection) !== plan.originalText) return {status: 'blocked', reason: 'stale-original'};
  let snapshot: number;
  try { snapshot = host.saveSnapshot(); } catch { return {status: 'blocked', reason: 'history-unavailable'}; }
  if (!integer(snapshot)) return {status: 'blocked', reason: 'history-unavailable'};
  try {
    if (!accepted(host.replaceText(plan.selection.sectionIndex, plan.selection.paragraphIndex,
      plan.selection.startOffset, plan.selection.endOffset - plan.selection.startOffset, chosen[0].text))) throw new Error('mutation');
    const changed = documentState(port);
    const changedSelection = {...plan.selection, endOffset: plan.selection.startOffset + scalarLength(chosen[0].text)};
    if (!changed || changed.identity !== plan.documentIdentity || changed.revision === plan.revision
      || read(host, changedSelection) !== chosen[0].text) throw new Error('verification');
    return {status: 'applied', text: chosen[0].text,
      command: new HanjaInputCommandB091(host, port, plan, chosen[0], snapshot, changed.revision)};
  } catch {
    try {
      if (!accepted(host.restoreSnapshot(snapshot))) throw new Error('rollback');
      const restored = documentState(port);
      if (!restored || restored.revision !== plan.revision || read(host, plan.selection) !== plan.originalText) throw new Error('rollback');
      host.discardSnapshot(snapshot);
      return {status: 'blocked', reason: 'verification-failed'};
    } catch { return {status: 'state-uncertain', reason: 'rollback-failed'}; }
  }
}

export class HanjaInputCommandB091 {
  #position: 'before' | 'after' | 'disposed' = 'after';
  private readonly host: HanjaInputHostB091;
  private readonly port: HanjaInputContextB091;
  private readonly plan: HanjaInputPlanB091;
  private readonly candidate: HanjaCandidateB091;
  private readonly snapshot: number;
  private readonly afterRevision: string;
  constructor(host: HanjaInputHostB091, port: HanjaInputContextB091, plan: HanjaInputPlanB091,
    candidate: HanjaCandidateB091, snapshot: number, afterRevision: string) {
    this.host = host; this.port = port; this.plan = plan; this.candidate = candidate;
    this.snapshot = snapshot; this.afterRevision = afterRevision;
  }
  undo(): HanjaInputTransitionB091 {
    const state = documentState(this.port);
    if (this.#position !== 'after' || !state || state.identity !== this.plan.documentIdentity
      || state.revision !== this.afterRevision) return {status: 'blocked', reason: 'history-state-mismatch'};
    try {
      if (!accepted(this.host.restoreSnapshot(this.snapshot))) throw new Error('restore');
      const restored = documentState(this.port);
      if (!restored || restored.revision !== this.plan.revision || read(this.host, this.plan.selection) !== this.plan.originalText) throw new Error('verify');
      this.#position = 'before'; return {status: 'restored', text: this.plan.originalText};
    } catch { return {status: 'state-uncertain', reason: 'rollback-failed'}; }
  }
  redo(): HanjaInputTransitionB091 {
    const state = documentState(this.port);
    if (this.#position !== 'before' || !state || state.identity !== this.plan.documentIdentity
      || state.revision !== this.plan.revision || read(this.host, this.plan.selection) !== this.plan.originalText) {
      return {status: 'blocked', reason: 'history-state-mismatch'};
    }
    try {
      if (!accepted(this.host.replaceText(this.plan.selection.sectionIndex, this.plan.selection.paragraphIndex,
        this.plan.selection.startOffset, this.plan.selection.endOffset - this.plan.selection.startOffset, this.candidate.text))) throw new Error('replace');
      const changed = documentState(this.port), changedSelection = {...this.plan.selection,
        endOffset: this.plan.selection.startOffset + scalarLength(this.candidate.text)};
      if (!changed || changed.revision !== this.afterRevision || read(this.host, changedSelection) !== this.candidate.text) throw new Error('verify');
      this.#position = 'after'; return {status: 'restored', text: this.candidate.text};
    } catch {
      try { if (!accepted(this.host.restoreSnapshot(this.snapshot))) throw new Error('restore'); }
      catch { return {status: 'state-uncertain', reason: 'rollback-failed'}; }
      return {status: 'blocked', reason: 'verification-failed'};
    }
  }
  dispose(): void {
    if (this.#position === 'disposed') return;
    this.#position = 'disposed';
    try { this.host.discardSnapshot(this.snapshot); } catch { /* release only */ }
  }
}
