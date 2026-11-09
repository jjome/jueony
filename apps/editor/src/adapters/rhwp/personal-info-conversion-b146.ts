import {sha256} from '@noble/hashes/sha2.js';

export type PersonalInfoKindB146 = 'resident-registration-number' | 'phone' | 'email';
export type PersonalInfoBlockReasonB146 =
  | 'api-unavailable' | 'invalid-context' | 'unsupported-story' | 'protected-document'
  | 'invalid-selection' | 'invalid-policy' | 'no-match' | 'stale-document'
  | 'stale-selection' | 'stale-original' | 'stale-plan' | 'history-unavailable'
  | 'mutation-rejected' | 'verification-failed' | 'history-state-mismatch';

export interface PersonalInfoSelectionB146 {
  readonly sectionIndex: number;
  readonly paragraphIndex: number;
  readonly startOffset: number;
  readonly endOffset: number;
}

export interface PersonalInfoHostB146 {
  getTextRange(section: number, paragraph: number, offset: number, count: number): string;
  replaceText(section: number, paragraph: number, offset: number, count: number, text: string): unknown;
  saveSnapshot(): number;
  restoreSnapshot(token: number): unknown;
  discardSnapshot(token: number): void;
}

export interface PersonalInfoContextB146 {
  documentIdentity(): unknown;
  revision(): unknown;
  story(): unknown;
  editable(): unknown;
  protected(): unknown;
  selection(): unknown;
}

export interface PersonalInfoPlanB146 {
  readonly version: 1;
  readonly documentIdentity: string;
  readonly revision: string;
  readonly selection: PersonalInfoSelectionB146;
  readonly originalText: string;
  readonly replacementText: string;
  readonly kinds: readonly PersonalInfoKindB146[];
  readonly fingerprint: string;
}

export type PersonalInfoCaptureB146 =
  | {status: 'ready'; plan: PersonalInfoPlanB146}
  | {status: 'blocked'; reason: PersonalInfoBlockReasonB146};

export type PersonalInfoTransitionB146 =
  | {status: 'applied'; command: PersonalInfoCommandB146; text: string}
  | {status: 'restored'; text: string}
  | {status: 'blocked'; reason: PersonalInfoBlockReasonB146}
  | {status: 'state-uncertain'; reason: 'rollback-failed'};

const requiredMethods = ['getTextRange', 'replaceText', 'saveSnapshot', 'restoreSnapshot', 'discardSnapshot'] as const;
const kindOrder: readonly PersonalInfoKindB146[] = ['resident-registration-number', 'phone', 'email'];
const identityPattern = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,255}$/u;

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function integer(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function accepted(value: unknown): boolean {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return record(parsed)?.ok === true;
  } catch { return false; }
}

function scalarLength(value: string): number { return Array.from(value).length; }

function hasApi(host: Partial<PersonalInfoHostB146>): host is PersonalInfoHostB146 {
  return requiredMethods.every(name => typeof (host as Record<string, unknown>)[name] === 'function');
}

function contextValue(port: PersonalInfoContextB146): {identity: string; revision: string} | undefined {
  try {
    const identity = port.documentIdentity(), revision = port.revision();
    if (typeof identity !== 'string' || typeof revision !== 'string'
      || !identityPattern.test(identity) || !identityPattern.test(revision)) return undefined;
    return {identity, revision};
  } catch { return undefined; }
}

function unsafeContext(port: PersonalInfoContextB146): PersonalInfoBlockReasonB146 | undefined {
  try {
    if (port.story() !== 'body') return 'unsupported-story';
    if (port.editable() !== true || port.protected() === true) return 'protected-document';
  } catch { return 'invalid-context'; }
  return undefined;
}

function normalizeSelection(value: unknown): PersonalInfoSelectionB146 | undefined {
  const raw = record(value);
  if (!raw || Object.keys(raw).some(key => !['sectionIndex', 'paragraphIndex', 'startOffset', 'endOffset'].includes(key))
    || !integer(raw.sectionIndex) || !integer(raw.paragraphIndex) || !integer(raw.startOffset) || !integer(raw.endOffset)
    || raw.startOffset === raw.endOffset) return undefined;
  const startOffset = Math.min(raw.startOffset, raw.endOffset), endOffset = Math.max(raw.startOffset, raw.endOffset);
  if (endOffset - startOffset > 100_000) return undefined;
  return {sectionIndex: raw.sectionIndex, paragraphIndex: raw.paragraphIndex, startOffset, endOffset};
}

function sameSelection(left: PersonalInfoSelectionB146, right: PersonalInfoSelectionB146): boolean {
  return left.sectionIndex === right.sectionIndex && left.paragraphIndex === right.paragraphIndex
    && left.startOffset === right.startOffset && left.endOffset === right.endOffset;
}

function normalizeKinds(value: unknown): readonly PersonalInfoKindB146[] | undefined {
  if (!Array.isArray(value) || value.length === 0 || value.length > kindOrder.length) return undefined;
  const chosen = new Set(value);
  if (chosen.size !== value.length || [...chosen].some(kind => !kindOrder.includes(kind as PersonalInfoKindB146))) return undefined;
  return kindOrder.filter(kind => chosen.has(kind));
}

function maskDigits(value: string, keepLast: number): string {
  let remaining = [...value].filter(character => /\d/u.test(character)).length - keepLast;
  return [...value].map(character => /\d/u.test(character) && remaining-- > 0 ? '*' : character).join('');
}

function transform(original: string, kinds: readonly PersonalInfoKindB146[]): string {
  let result = original;
  if (kinds.includes('resident-registration-number')) {
    result = result.replace(/(?<!\d)\d{6}([ -]?)\d{7}(?!\d)/gu, match => maskDigits(match, 0));
  }
  if (kinds.includes('phone')) {
    result = result.replace(/(?<!\d)(?:01[016789]|02|0[3-6][1-5]?)(?:[ -]?\d){7,8}(?!\d)/gu,
      match => maskDigits(match, 4));
  }
  if (kinds.includes('email')) {
    result = result.replace(/[A-Z0-9._%+-]{1,64}@[A-Z0-9.-]{1,190}\.[A-Z]{2,24}/giu, match => {
      const at = match.indexOf('@');
      return '*'.repeat(at) + match.slice(at);
    });
  }
  return result;
}

function fingerprint(plan: Omit<PersonalInfoPlanB146, 'fingerprint'>): string {
  return [...sha256(new TextEncoder().encode(JSON.stringify(plan)))]
    .map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function read(host: PersonalInfoHostB146, selection: PersonalInfoSelectionB146): string | undefined {
  try {
    const count = selection.endOffset - selection.startOffset;
    const text = host.getTextRange(selection.sectionIndex, selection.paragraphIndex, selection.startOffset, count);
    return typeof text === 'string' && scalarLength(text) === count ? text : undefined;
  } catch { return undefined; }
}

function replace(host: PersonalInfoHostB146, selection: PersonalInfoSelectionB146, text: string): boolean {
  try {
    return accepted(host.replaceText(selection.sectionIndex, selection.paragraphIndex, selection.startOffset,
      selection.endOffset - selection.startOffset, text));
  } catch { return false; }
}

export function capturePersonalInfoConversionB146(
  host: Partial<PersonalInfoHostB146>, port: PersonalInfoContextB146, kindsInput: unknown,
): PersonalInfoCaptureB146 {
  if (!hasApi(host)) return {status: 'blocked', reason: 'api-unavailable'};
  const unsafe = unsafeContext(port); if (unsafe) return {status: 'blocked', reason: unsafe};
  const current = contextValue(port); if (!current) return {status: 'blocked', reason: 'invalid-context'};
  let selection: PersonalInfoSelectionB146 | undefined;
  try { selection = normalizeSelection(port.selection()); } catch { return {status: 'blocked', reason: 'invalid-selection'}; }
  if (!selection) return {status: 'blocked', reason: 'invalid-selection'};
  const kinds = normalizeKinds(kindsInput); if (!kinds) return {status: 'blocked', reason: 'invalid-policy'};
  const originalText = read(host, selection); if (originalText === undefined) return {status: 'blocked', reason: 'stale-original'};
  const replacementText = transform(originalText, kinds);
  if (replacementText === originalText) return {status: 'blocked', reason: 'no-match'};
  const unsigned = {version: 1 as const, documentIdentity: current.identity, revision: current.revision,
    selection, originalText, replacementText, kinds};
  return {status: 'ready', plan: {...unsigned, fingerprint: fingerprint(unsigned)}};
}

export function applyPersonalInfoConversionB146(
  host: Partial<PersonalInfoHostB146>, port: PersonalInfoContextB146, plan: PersonalInfoPlanB146,
): PersonalInfoTransitionB146 {
  if (!hasApi(host)) return {status: 'blocked', reason: 'api-unavailable'};
  const unsafe = unsafeContext(port); if (unsafe) return {status: 'blocked', reason: unsafe};
  const current = contextValue(port); if (!current) return {status: 'blocked', reason: 'invalid-context'};
  const selection = normalizeSelection(plan?.selection), kinds = normalizeKinds(plan?.kinds);
  if (!selection || !kinds || plan.version !== 1 || !identityPattern.test(plan.documentIdentity)
    || !identityPattern.test(plan.revision) || !/^[0-9a-f]{64}$/u.test(plan.fingerprint)
    || typeof plan.originalText !== 'string' || typeof plan.replacementText !== 'string') return {status: 'blocked', reason: 'stale-plan'};
  const unsigned = {version: 1 as const, documentIdentity: plan.documentIdentity, revision: plan.revision,
    selection, originalText: plan.originalText, replacementText: plan.replacementText, kinds};
  if (fingerprint(unsigned) !== plan.fingerprint || transform(plan.originalText, kinds) !== plan.replacementText
    || scalarLength(plan.originalText) !== scalarLength(plan.replacementText)) return {status: 'blocked', reason: 'stale-plan'};
  if (current.identity !== plan.documentIdentity || current.revision !== plan.revision) return {status: 'blocked', reason: 'stale-document'};
  let liveSelection: PersonalInfoSelectionB146 | undefined;
  try { liveSelection = normalizeSelection(port.selection()); } catch { return {status: 'blocked', reason: 'stale-selection'}; }
  if (!liveSelection || !sameSelection(liveSelection, selection)) return {status: 'blocked', reason: 'stale-selection'};
  if (read(host, selection) !== plan.originalText) return {status: 'blocked', reason: 'stale-original'};
  let token: number;
  try { token = host.saveSnapshot(); } catch { return {status: 'blocked', reason: 'history-unavailable'}; }
  if (!integer(token)) return {status: 'blocked', reason: 'history-unavailable'};
  try {
    if (!replace(host, selection, plan.replacementText)) throw new Error('mutation');
    const changed = contextValue(port);
    if (!changed || changed.identity !== plan.documentIdentity || changed.revision === plan.revision
      || read(host, selection) !== plan.replacementText) throw new Error('verification');
    return {status: 'applied', text: plan.replacementText,
      command: new PersonalInfoCommandB146(host, port, plan, token, changed.revision)};
  } catch {
    try {
      if (!accepted(host.restoreSnapshot(token))) throw new Error('rollback');
      const restored = contextValue(port);
      if (!restored || restored.identity !== plan.documentIdentity || restored.revision !== plan.revision
        || read(host, selection) !== plan.originalText) throw new Error('rollback');
      host.discardSnapshot(token);
      return {status: 'blocked', reason: 'verification-failed'};
    } catch { return {status: 'state-uncertain', reason: 'rollback-failed'}; }
  }
}

export class PersonalInfoCommandB146 {
  #position: 'before' | 'after' | 'disposed' = 'after';
  private readonly host: PersonalInfoHostB146;
  private readonly port: PersonalInfoContextB146;
  private readonly plan: PersonalInfoPlanB146;
  private readonly token: number;
  private readonly afterRevision: string;
  constructor(
    host: PersonalInfoHostB146,
    port: PersonalInfoContextB146,
    plan: PersonalInfoPlanB146,
    token: number,
    afterRevision: string,
  ) {
    this.host = host;
    this.port = port;
    this.plan = plan;
    this.token = token;
    this.afterRevision = afterRevision;
  }
  undo(): PersonalInfoTransitionB146 {
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
  redo(): PersonalInfoTransitionB146 {
    const current = contextValue(this.port);
    if (this.#position !== 'before' || !current || current.identity !== this.plan.documentIdentity
      || current.revision !== this.plan.revision || read(this.host, this.plan.selection) !== this.plan.originalText) {
      return {status: 'blocked', reason: 'history-state-mismatch'};
    }
    if (!replace(this.host, this.plan.selection, this.plan.replacementText)) return {status: 'blocked', reason: 'mutation-rejected'};
    const changed = contextValue(this.port);
    if (!changed || changed.revision !== this.afterRevision || read(this.host, this.plan.selection) !== this.plan.replacementText) {
      try { this.host.restoreSnapshot(this.token); } catch { return {status: 'state-uncertain', reason: 'rollback-failed'}; }
      return {status: 'blocked', reason: 'verification-failed'};
    }
    this.#position = 'after'; return {status: 'restored', text: this.plan.replacementText};
  }
  dispose(): void {
    if (this.#position === 'disposed') return;
    this.#position = 'disposed';
    try { this.host.discardSnapshot(this.token); } catch { /* release only */ }
  }
}
