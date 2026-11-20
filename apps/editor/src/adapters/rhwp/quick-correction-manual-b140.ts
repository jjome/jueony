import {sha256} from '@noble/hashes/sha2.js';

type JsonRecord = Record<string, unknown>;
type BlockReasonB140 =
  | 'api-unavailable'
  | 'invalid-context'
  | 'unsupported-story'
  | 'protected-document'
  | 'mixed-selection'
  | 'invalid-rules'
  | 'no-matching-rule'
  | 'stale-document'
  | 'stale-selection'
  | 'stale-original'
  | 'stale-rules'
  | 'history-unavailable'
  | 'mutation-rejected'
  | 'verification-failed'
  | 'history-state-mismatch';

export interface QuickCorrectionRuleB140 {
  readonly from: string;
  readonly to: string;
}

export interface BodyPointB140 {
  readonly sectionIndex: number;
  readonly paragraphIndex: number;
  readonly charOffset: number;
  readonly parentParaIndex?: unknown;
  readonly path?: unknown;
  readonly isTextBox?: unknown;
  readonly isHeaderFooter?: unknown;
  readonly isFootnote?: unknown;
}

export interface BodySelectionB140 {
  readonly start: BodyPointB140;
  readonly end: BodyPointB140;
}

export interface QuickCorrectionHostB140 {
  getTextRange(section: number, paragraph: number, offset: number, count: number): string;
  deleteRange(section: number, startParagraph: number, startOffset: number, endParagraph: number, endOffset: number): unknown;
  insertText(section: number, paragraph: number, offset: number, text: string): unknown;
  saveSnapshot(): number;
  restoreSnapshot(token: number): unknown;
  discardSnapshot(token: number): void;
}

export interface QuickCorrectionContextB140 {
  documentIdentity(): unknown;
  revision(): unknown;
  story(): unknown;
  editable(): unknown;
  protected(): unknown;
  selection(): unknown;
}

export interface QuickCorrectionPlanB140 {
  readonly version: 1;
  readonly documentIdentity: string;
  readonly revision: string;
  readonly selection: BodySelectionB140;
  readonly originalText: string;
  readonly replacementText: string;
  readonly rulesFingerprint: string;
}

export type QuickCorrectionCaptureB140 =
  | {status: 'ready'; plan: QuickCorrectionPlanB140}
  | {status: 'blocked'; reason: BlockReasonB140};

export type QuickCorrectionTransitionB140 =
  | {status: 'applied'; command: QuickCorrectionCommandB140; text: string}
  | {status: 'restored'; text: string}
  | {status: 'blocked'; reason: BlockReasonB140}
  | {status: 'state-uncertain'; reason: 'rollback-failed'};

const requiredMethods = ['getTextRange', 'deleteRange', 'insertText', 'saveSnapshot', 'restoreSnapshot', 'discardSnapshot'] as const;

function record(value: unknown): JsonRecord | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as JsonRecord : undefined;
}

function nonemptyBounded(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 1024;
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

function hasApi(host: Partial<QuickCorrectionHostB140>): host is QuickCorrectionHostB140 {
  return requiredMethods.every(name => typeof (host as unknown as Record<string, unknown>)[name] === 'function');
}

function scalarLength(value: string): number { return Array.from(value).length; }

function safeRuleText(value: unknown, allowEmpty: boolean): value is string {
  if (typeof value !== 'string' || scalarLength(value) > 256 || /\p{Cc}/u.test(value)) return false;
  return allowEmpty || value.length > 0;
}

function normalizeRules(rules: unknown): readonly QuickCorrectionRuleB140[] | undefined {
  if (!Array.isArray(rules) || rules.length === 0 || rules.length > 256) return undefined;
  const normalized: QuickCorrectionRuleB140[] = [];
  const sources = new Set<string>();
  for (const candidate of rules) {
    const item = record(candidate);
    if (!item || Object.keys(item).some(key => key !== 'from' && key !== 'to')
      || Object.keys(item).length !== 2 || !safeRuleText(item.from, false) || !safeRuleText(item.to, false)
      || sources.has(item.from) || item.from === item.to) return undefined;
    sources.add(item.from);
    normalized.push({from: item.from, to: item.to});
  }

  const edges = new Map(normalized.map(rule => [rule.from, rule.to]));
  for (const source of edges.keys()) {
    const seen = new Set<string>();
    let cursor: string | undefined = source;
    while (cursor !== undefined && edges.has(cursor)) {
      if (seen.has(cursor)) return undefined;
      seen.add(cursor);
      cursor = edges.get(cursor);
    }
  }
  return normalized.sort((left, right) => left.from.localeCompare(right.from) || left.to.localeCompare(right.to));
}

function fingerprint(rules: readonly QuickCorrectionRuleB140[]): string {
  return Array.from(sha256(new TextEncoder().encode(JSON.stringify(rules))), byte => byte.toString(16).padStart(2, '0')).join('');
}

function topLevelPoint(value: unknown): BodyPointB140 | undefined {
  const point = record(value);
  if (!point || !integer(point.sectionIndex) || !integer(point.paragraphIndex) || !integer(point.charOffset)) return undefined;
  if (point.parentParaIndex !== undefined || point.isTextBox === true || point.isHeaderFooter === true || point.isFootnote === true) return undefined;
  if (point.path !== undefined && (!Array.isArray(point.path) || point.path.length !== 0)) return undefined;
  return {sectionIndex: point.sectionIndex, paragraphIndex: point.paragraphIndex, charOffset: point.charOffset};
}

function selection(value: unknown): BodySelectionB140 | undefined {
  const range = record(value), first = topLevelPoint(range?.start), second = topLevelPoint(range?.end);
  if (!first || !second || first.sectionIndex !== second.sectionIndex || first.paragraphIndex !== second.paragraphIndex) return undefined;
  if (first.charOffset === second.charOffset) return undefined;
  return first.charOffset < second.charOffset
    ? {start: first, end: second}
    : {start: second, end: first};
}

function sameSelection(left: BodySelectionB140, right: BodySelectionB140): boolean {
  return left.start.sectionIndex === right.start.sectionIndex
    && left.start.paragraphIndex === right.start.paragraphIndex
    && left.start.charOffset === right.start.charOffset
    && left.end.charOffset === right.end.charOffset;
}

function observedContext(port: QuickCorrectionContextB140): {identity: string; revision: string} | undefined {
  try {
    const identity = port.documentIdentity(), revision = port.revision();
    return nonemptyBounded(identity) && nonemptyBounded(revision) ? {identity, revision} : undefined;
  } catch { return undefined; }
}

function safeContext(port: QuickCorrectionContextB140): BlockReasonB140 | undefined {
  try {
    if (port.story() !== 'body') return 'unsupported-story';
    if (port.editable() !== true || port.protected() === true) return 'protected-document';
  } catch { return 'invalid-context'; }
  return undefined;
}

function readSelectedText(host: QuickCorrectionHostB140, range: BodySelectionB140): string | undefined {
  try {
    const count = range.end.charOffset - range.start.charOffset;
    const text = host.getTextRange(range.start.sectionIndex, range.start.paragraphIndex, range.start.charOffset, count);
    return typeof text === 'string' && scalarLength(text) === count ? text : undefined;
  } catch { return undefined; }
}

function replace(host: QuickCorrectionHostB140, range: BodySelectionB140, text: string): boolean {
  try {
    return accepted(host.deleteRange(
      range.start.sectionIndex, range.start.paragraphIndex, range.start.charOffset,
      range.end.paragraphIndex, range.end.charOffset,
    )) && accepted(host.insertText(range.start.sectionIndex, range.start.paragraphIndex, range.start.charOffset, text));
  } catch { return false; }
}

export function captureQuickCorrectionB140(
  host: Partial<QuickCorrectionHostB140>, port: QuickCorrectionContextB140, rulesInput: unknown,
): QuickCorrectionCaptureB140 {
  if (!hasApi(host)) return {status: 'blocked', reason: 'api-unavailable'};
  const unsafe = safeContext(port); if (unsafe) return {status: 'blocked', reason: unsafe};
  const current = observedContext(port); if (!current) return {status: 'blocked', reason: 'invalid-context'};
  let range: BodySelectionB140 | undefined;
  try { range = selection(port.selection()); } catch { return {status: 'blocked', reason: 'invalid-context'}; }
  if (!range) return {status: 'blocked', reason: 'mixed-selection'};
  const rules = normalizeRules(rulesInput); if (!rules) return {status: 'blocked', reason: 'invalid-rules'};
  const originalText = readSelectedText(host, range); if (originalText === undefined) return {status: 'blocked', reason: 'stale-original'};
  const rule = rules.find(candidate => candidate.from === originalText);
  if (!rule) return {status: 'blocked', reason: 'no-matching-rule'};
  return {status: 'ready', plan: {
    version: 1,
    documentIdentity: current.identity,
    revision: current.revision,
    selection: range,
    originalText,
    replacementText: rule.to,
    rulesFingerprint: fingerprint(rules),
  }};
}

export function applyQuickCorrectionB140(
  host: Partial<QuickCorrectionHostB140>, port: QuickCorrectionContextB140,
  plan: QuickCorrectionPlanB140, rulesInput: unknown,
): QuickCorrectionTransitionB140 {
  if (!hasApi(host)) return {status: 'blocked', reason: 'api-unavailable'};
  const unsafe = safeContext(port); if (unsafe) return {status: 'blocked', reason: unsafe};
  if (!record(plan) || plan.version !== 1 || !nonemptyBounded(plan.documentIdentity) || !nonemptyBounded(plan.revision)
    || !/^[0-9a-f]{64}$/.test(plan.rulesFingerprint) || !safeRuleText(plan.originalText, false)
    || !safeRuleText(plan.replacementText, false) || !selection(plan.selection)) return {status: 'blocked', reason: 'invalid-context'};
  const rules = normalizeRules(rulesInput); if (!rules) return {status: 'blocked', reason: 'invalid-rules'};
  if (fingerprint(rules) !== plan.rulesFingerprint
    || !rules.some(rule => rule.from === plan.originalText && rule.to === plan.replacementText)) return {status: 'blocked', reason: 'stale-rules'};
  const current = observedContext(port); if (!current) return {status: 'blocked', reason: 'invalid-context'};
  if (current.identity !== plan.documentIdentity || current.revision !== plan.revision) return {status: 'blocked', reason: 'stale-document'};
  let liveSelection: BodySelectionB140 | undefined;
  try { liveSelection = selection(port.selection()); } catch { return {status: 'blocked', reason: 'invalid-context'}; }
  if (!liveSelection || !sameSelection(liveSelection, plan.selection)) return {status: 'blocked', reason: 'stale-selection'};
  if (readSelectedText(host, plan.selection) !== plan.originalText) return {status: 'blocked', reason: 'stale-original'};

  let token: number;
  try { token = host.saveSnapshot(); } catch { return {status: 'blocked', reason: 'history-unavailable'}; }
  if (!integer(token)) return {status: 'blocked', reason: 'history-unavailable'};
  try {
    if (!replace(host, plan.selection, plan.replacementText)) throw new Error('mutation');
    const changed = observedContext(port);
    if (!changed || changed.identity !== plan.documentIdentity || changed.revision === plan.revision
      || host.getTextRange(plan.selection.start.sectionIndex, plan.selection.start.paragraphIndex,
        plan.selection.start.charOffset, scalarLength(plan.replacementText)) !== plan.replacementText) throw new Error('verification');
    return {status: 'applied', text: plan.replacementText, command: new QuickCorrectionCommandB140(
      host, port, plan, token, changed.revision,
    )};
  } catch {
    try {
      if (!accepted(host.restoreSnapshot(token))) throw new Error('rollback');
      const restored = observedContext(port);
      if (!restored || restored.identity !== plan.documentIdentity || restored.revision !== plan.revision
        || readSelectedText(host, plan.selection) !== plan.originalText) throw new Error('rollback');
      host.discardSnapshot(token);
      return {status: 'blocked', reason: 'verification-failed'};
    } catch { return {status: 'state-uncertain', reason: 'rollback-failed'}; }
  }
}

export class QuickCorrectionCommandB140 {
  #position: 'before' | 'after' | 'disposed' = 'after';
  readonly #host: QuickCorrectionHostB140;
  readonly #port: QuickCorrectionContextB140;
  readonly #plan: QuickCorrectionPlanB140;
  readonly #token: number;
  readonly #afterRevision: string;
  constructor(host: QuickCorrectionHostB140, port: QuickCorrectionContextB140, plan: QuickCorrectionPlanB140, token: number, afterRevision: string) {
    this.#host = host; this.#port = port; this.#plan = plan; this.#token = token; this.#afterRevision = afterRevision;
  }
  undo(): QuickCorrectionTransitionB140 {
    if (this.#position !== 'after') return {status: 'blocked', reason: 'history-state-mismatch'};
    const unsafe = safeContext(this.#port), current = observedContext(this.#port);
    if (unsafe || !current || current.identity !== this.#plan.documentIdentity || current.revision !== this.#afterRevision) {
      return {status: 'blocked', reason: 'history-state-mismatch'};
    }
    try {
      if (!accepted(this.#host.restoreSnapshot(this.#token))) throw new Error('restore');
      const restored = observedContext(this.#port);
      if (!restored || restored.identity !== this.#plan.documentIdentity || restored.revision !== this.#plan.revision
        || readSelectedText(this.#host, this.#plan.selection) !== this.#plan.originalText) throw new Error('verify');
      this.#position = 'before';
      return {status: 'restored', text: this.#plan.originalText};
    } catch { return {status: 'state-uncertain', reason: 'rollback-failed'}; }
  }
  redo(): QuickCorrectionTransitionB140 {
    if (this.#position !== 'before') return {status: 'blocked', reason: 'history-state-mismatch'};
    const unsafe = safeContext(this.#port), current = observedContext(this.#port);
    if (unsafe || !current || current.identity !== this.#plan.documentIdentity || current.revision !== this.#plan.revision
      || readSelectedText(this.#host, this.#plan.selection) !== this.#plan.originalText) {
      return {status: 'blocked', reason: 'history-state-mismatch'};
    }
    try {
      if (!replace(this.#host, this.#plan.selection, this.#plan.replacementText)) throw new Error('replace');
      const changed = observedContext(this.#port);
      if (!changed || changed.identity !== this.#plan.documentIdentity || changed.revision !== this.#afterRevision
        || this.#host.getTextRange(this.#plan.selection.start.sectionIndex, this.#plan.selection.start.paragraphIndex,
          this.#plan.selection.start.charOffset, scalarLength(this.#plan.replacementText)) !== this.#plan.replacementText) throw new Error('verify');
      this.#position = 'after';
      return {status: 'restored', text: this.#plan.replacementText};
    } catch {
      try {
        if (!accepted(this.#host.restoreSnapshot(this.#token))) throw new Error('restore');
        const restored = observedContext(this.#port);
        if (!restored || restored.identity !== this.#plan.documentIdentity || restored.revision !== this.#plan.revision
          || readSelectedText(this.#host, this.#plan.selection) !== this.#plan.originalText) throw new Error('verify');
      } catch { return {status: 'state-uncertain', reason: 'rollback-failed'}; }
      return {status: 'blocked', reason: 'verification-failed'};
    }
  }
  dispose(): void {
    if (this.#position === 'disposed') return;
    this.#position = 'disposed';
    try { this.#host.discardSnapshot(this.#token); } catch { /* release only */ }
  }
}
