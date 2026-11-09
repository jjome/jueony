import {sha256} from '@noble/hashes/sha2.js';

export type BibliographyOperationB144 = 'citation' | 'bibliography';
export type BibliographyStyleB144 = 'jueony-korean-author-year-v1';
export type BibliographyBlockReasonB144 =
  | 'api-unavailable' | 'invalid-context' | 'unsupported-story' | 'protected-document'
  | 'unsupported-selection' | 'invalid-registry' | 'unknown-source' | 'invalid-operation'
  | 'stale-document' | 'stale-selection' | 'stale-original' | 'stale-registry'
  | 'stale-plan' | 'history-unavailable' | 'mutation-rejected' | 'verification-failed'
  | 'history-state-mismatch';

export interface BibliographySourceB144 {
  readonly id: string;
  readonly authors: readonly string[];
  readonly year: number;
  readonly title: string;
  readonly publisher?: string;
}

export interface BibliographyPointB144 {
  readonly sectionIndex: number;
  readonly paragraphIndex: number;
  readonly charOffset: number;
}

export interface BibliographyHostB144 {
  getParagraphLength(section: number, paragraph: number): number;
  getTextRange(section: number, paragraph: number, offset: number, count: number): string;
  insertText(section: number, paragraph: number, offset: number, text: string): unknown;
  splitParagraph(section: number, paragraph: number, offset: number): unknown;
  saveSnapshot(): number;
  restoreSnapshot(token: number): unknown;
  discardSnapshot(token: number): void;
}

export interface BibliographyContextB144 {
  documentIdentity(): unknown;
  revision(): unknown;
  story(): unknown;
  editable(): unknown;
  protected(): unknown;
  selection(): unknown;
}

export interface BibliographyPlanB144 {
  readonly version: 1;
  readonly style: BibliographyStyleB144;
  readonly operation: BibliographyOperationB144;
  readonly documentIdentity: string;
  readonly revision: string;
  readonly point: BibliographyPointB144;
  readonly paragraphFingerprint: string;
  readonly registryFingerprint: string;
  readonly sourceId: string;
  readonly sourceFingerprint: string;
  readonly renderedText: string;
  readonly planFingerprint: string;
}

export type BibliographyCaptureB144 =
  | {status: 'ready'; plan: BibliographyPlanB144}
  | {status: 'blocked'; reason: BibliographyBlockReasonB144};

export type BibliographyTransitionB144 =
  | {status: 'applied'; command: BibliographyCommandB144; text: string}
  | {status: 'restored'; text: string}
  | {status: 'blocked'; reason: BibliographyBlockReasonB144}
  | {status: 'state-uncertain'; reason: 'rollback-failed'};

const STYLE: BibliographyStyleB144 = 'jueony-korean-author-year-v1';
const required = ['getParagraphLength', 'getTextRange', 'insertText', 'splitParagraph', 'saveSnapshot', 'restoreSnapshot', 'discardSnapshot'] as const;
const identifier = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,127}$/u;
const scalarLength = (value: string): number => Array.from(value).length;
const integer = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const digest = (value: unknown): string => Array.from(
  sha256(new TextEncoder().encode(JSON.stringify(value))), byte => byte.toString(16).padStart(2, '0'),
).join('');

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function accepted(value: unknown): boolean {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return record(parsed)?.ok === true;
  } catch { return false; }
}

function safeText(value: unknown, maximum: number): value is string {
  return typeof value === 'string' && value.trim() === value && value.length > 0
    && scalarLength(value) <= maximum && !/[\p{Cc}\p{Cf}]/u.test(value);
}

function normalizeSource(value: unknown): Readonly<BibliographySourceB144> | undefined {
  const item = record(value);
  if (!item || Object.keys(item).some(key => !['id', 'authors', 'year', 'title', 'publisher'].includes(key))
    || !safeText(item.id, 128) || !identifier.test(item.id)
    || !Array.isArray(item.authors) || item.authors.length === 0 || item.authors.length > 8
    || !item.authors.every(author => safeText(author, 128)) || new Set(item.authors).size !== item.authors.length
    || !integer(item.year) || item.year < 1000 || item.year > 9999 || !safeText(item.title, 512)
    || (item.publisher !== undefined && !safeText(item.publisher, 256))) return undefined;
  const source: BibliographySourceB144 = item.publisher === undefined
    ? {id: item.id, authors: Object.freeze([...item.authors]), year: item.year, title: item.title}
    : {id: item.id, authors: Object.freeze([...item.authors]), year: item.year, title: item.title, publisher: item.publisher};
  return Object.freeze(source);
}

function sourceFingerprint(source: BibliographySourceB144): string { return digest(source); }

export class BibliographyRegistryB144 {
  readonly #sources: ReadonlyMap<string, Readonly<BibliographySourceB144>>;
  readonly fingerprint: string;
  constructor(sources: readonly Readonly<BibliographySourceB144>[], fingerprint: string) {
    this.#sources = new Map(sources.map(source => [source.id, source]));
    this.fingerprint = fingerprint;
  }
  get(sourceId: string): Readonly<BibliographySourceB144> | undefined { return this.#sources.get(sourceId); }
  list(): readonly Readonly<BibliographySourceB144>[] { return Object.freeze([...this.#sources.values()]); }
}

export function createBibliographyRegistryB144(value: unknown): BibliographyRegistryB144 | undefined {
  if (!Array.isArray(value) || value.length === 0 || value.length > 128) return undefined;
  const sources: Readonly<BibliographySourceB144>[] = [];
  const ids = new Set<string>();
  for (const raw of value) {
    const source = normalizeSource(raw);
    if (!source || ids.has(source.id)) return undefined;
    ids.add(source.id); sources.push(source);
  }
  sources.sort((left, right) => left.id.localeCompare(right.id, 'en'));
  return new BibliographyRegistryB144(Object.freeze(sources), digest(sources));
}

function authors(source: BibliographySourceB144, citation: boolean): string {
  if (citation && source.authors.length > 2) return `${source.authors[0]} 외`;
  return source.authors.join('·');
}

export function formatBibliographyB144(
  source: BibliographySourceB144, operation: BibliographyOperationB144,
): string {
  if (operation === 'citation') return `(${authors(source, true)}, ${source.year})`;
  const publisher = source.publisher ? ` ${source.publisher}.` : '';
  return `${authors(source, false)}. (${source.year}). ${source.title}.${publisher}`;
}

function hasApi(host: Partial<BibliographyHostB144>): host is BibliographyHostB144 {
  return required.every(name => typeof (host as Record<string, unknown>)[name] === 'function');
}

function point(value: unknown): BibliographyPointB144 | undefined {
  const item = record(value);
  if (!item || !integer(item.sectionIndex) || !integer(item.paragraphIndex) || !integer(item.charOffset)
    || item.parentParaIndex !== undefined || item.isTextBox === true || item.isHeaderFooter === true || item.isFootnote === true
    || (item.path !== undefined && (!Array.isArray(item.path) || item.path.length !== 0))) return undefined;
  return {sectionIndex: item.sectionIndex, paragraphIndex: item.paragraphIndex, charOffset: item.charOffset};
}

function collapsed(value: unknown): BibliographyPointB144 | undefined {
  const range = record(value), start = point(range?.start), end = point(range?.end);
  if (!start || !end || start.sectionIndex !== end.sectionIndex || start.paragraphIndex !== end.paragraphIndex
    || start.charOffset !== end.charOffset) return undefined;
  return start;
}

function samePoint(left: BibliographyPointB144, right: BibliographyPointB144): boolean {
  return left.sectionIndex === right.sectionIndex && left.paragraphIndex === right.paragraphIndex
    && left.charOffset === right.charOffset;
}

function owner(port: BibliographyContextB144): {identity: string; revision: string} | undefined {
  try {
    const identity = port.documentIdentity(), revision = port.revision();
    if (!safeText(identity, 1024) || !safeText(revision, 1024)) return undefined;
    return {identity, revision};
  } catch { return undefined; }
}

function unsafe(port: BibliographyContextB144): BibliographyBlockReasonB144 | undefined {
  try {
    if (port.story() !== 'body') return 'unsupported-story';
    if (port.editable() !== true || port.protected() === true) return 'protected-document';
  } catch { return 'invalid-context'; }
  return undefined;
}

function paragraph(host: BibliographyHostB144, at: BibliographyPointB144): string | undefined {
  try {
    const length = host.getParagraphLength(at.sectionIndex, at.paragraphIndex);
    if (!integer(length) || length > 1_000_000 || at.charOffset > length) return undefined;
    const text = host.getTextRange(at.sectionIndex, at.paragraphIndex, 0, length);
    return typeof text === 'string' && scalarLength(text) === length ? text : undefined;
  } catch { return undefined; }
}

function unsigned(plan: BibliographyPlanB144): Omit<BibliographyPlanB144, 'planFingerprint'> {
  return {version: 1, style: plan.style, operation: plan.operation, documentIdentity: plan.documentIdentity,
    revision: plan.revision, point: plan.point, paragraphFingerprint: plan.paragraphFingerprint,
    registryFingerprint: plan.registryFingerprint, sourceId: plan.sourceId, sourceFingerprint: plan.sourceFingerprint,
    renderedText: plan.renderedText};
}

function validPlan(plan: BibliographyPlanB144): boolean {
  return plan?.version === 1 && plan.style === STYLE && (plan.operation === 'citation' || plan.operation === 'bibliography')
    && safeText(plan.documentIdentity, 1024) && safeText(plan.revision, 1024) && point(plan.point) !== undefined
    && /^[0-9a-f]{64}$/u.test(plan.paragraphFingerprint) && /^[0-9a-f]{64}$/u.test(plan.registryFingerprint)
    && identifier.test(plan.sourceId) && /^[0-9a-f]{64}$/u.test(plan.sourceFingerprint)
    && safeText(plan.renderedText, 2048) && /^[0-9a-f]{64}$/u.test(plan.planFingerprint)
    && digest(unsigned(plan)) === plan.planFingerprint;
}

export function captureBibliographyB144(
  host: Partial<BibliographyHostB144>, port: BibliographyContextB144, registry: BibliographyRegistryB144,
  sourceId: unknown, operation: unknown,
): BibliographyCaptureB144 {
  if (!hasApi(host)) return {status: 'blocked', reason: 'api-unavailable'};
  const unsafeReason = unsafe(port); if (unsafeReason) return {status: 'blocked', reason: unsafeReason};
  if (!(registry instanceof BibliographyRegistryB144)) return {status: 'blocked', reason: 'invalid-registry'};
  if (operation !== 'citation' && operation !== 'bibliography') return {status: 'blocked', reason: 'invalid-operation'};
  const bibliographyOperation: BibliographyOperationB144 = operation;
  if (typeof sourceId !== 'string' || !identifier.test(sourceId)) return {status: 'blocked', reason: 'unknown-source'};
  const source = registry.get(sourceId); if (!source) return {status: 'blocked', reason: 'unknown-source'};
  const current = owner(port); if (!current) return {status: 'blocked', reason: 'invalid-context'};
  let at: BibliographyPointB144 | undefined;
  try { at = collapsed(port.selection()); } catch { return {status: 'blocked', reason: 'unsupported-selection'}; }
  if (!at) return {status: 'blocked', reason: 'unsupported-selection'};
  const original = paragraph(host, at); if (original === undefined) return {status: 'blocked', reason: 'stale-original'};
  if (operation === 'bibliography' && at.charOffset !== scalarLength(original)) {
    return {status: 'blocked', reason: 'unsupported-selection'};
  }
  const base = {version: 1 as const, style: STYLE, operation: bibliographyOperation, documentIdentity: current.identity,
    revision: current.revision, point: at, paragraphFingerprint: digest(original),
    registryFingerprint: registry.fingerprint, sourceId, sourceFingerprint: sourceFingerprint(source),
    renderedText: formatBibliographyB144(source, bibliographyOperation)};
  return {status: 'ready', plan: Object.freeze({...base, planFingerprint: digest(base)})};
}

function insert(host: BibliographyHostB144, plan: BibliographyPlanB144): boolean {
  if (plan.operation === 'citation') {
    return accepted(host.insertText(plan.point.sectionIndex, plan.point.paragraphIndex, plan.point.charOffset, plan.renderedText));
  }
  return accepted(host.splitParagraph(plan.point.sectionIndex, plan.point.paragraphIndex, plan.point.charOffset))
    && accepted(host.insertText(plan.point.sectionIndex, plan.point.paragraphIndex + 1, 0, plan.renderedText));
}

function inserted(host: BibliographyHostB144, plan: BibliographyPlanB144): boolean {
  try {
    if (plan.operation === 'citation') {
      return host.getTextRange(plan.point.sectionIndex, plan.point.paragraphIndex, plan.point.charOffset,
        scalarLength(plan.renderedText)) === plan.renderedText;
    }
    const length = host.getParagraphLength(plan.point.sectionIndex, plan.point.paragraphIndex + 1);
    return length === scalarLength(plan.renderedText)
      && host.getTextRange(plan.point.sectionIndex, plan.point.paragraphIndex + 1, 0, length) === plan.renderedText;
  } catch { return false; }
}

export function applyBibliographyB144(
  host: Partial<BibliographyHostB144>, port: BibliographyContextB144, registry: BibliographyRegistryB144,
  plan: BibliographyPlanB144,
): BibliographyTransitionB144 {
  if (!hasApi(host)) return {status: 'blocked', reason: 'api-unavailable'};
  const unsafeReason = unsafe(port); if (unsafeReason) return {status: 'blocked', reason: unsafeReason};
  if (!(registry instanceof BibliographyRegistryB144) || registry.fingerprint !== plan?.registryFingerprint) {
    return {status: 'blocked', reason: 'stale-registry'};
  }
  if (!validPlan(plan)) return {status: 'blocked', reason: 'stale-plan'};
  const source = registry.get(plan.sourceId);
  if (!source || sourceFingerprint(source) !== plan.sourceFingerprint
    || formatBibliographyB144(source, plan.operation) !== plan.renderedText) return {status: 'blocked', reason: 'stale-registry'};
  const current = owner(port); if (!current) return {status: 'blocked', reason: 'invalid-context'};
  if (current.identity !== plan.documentIdentity || current.revision !== plan.revision) {
    return {status: 'blocked', reason: 'stale-document'};
  }
  let livePoint: BibliographyPointB144 | undefined;
  try { livePoint = collapsed(port.selection()); } catch { return {status: 'blocked', reason: 'stale-selection'}; }
  if (!livePoint || !samePoint(livePoint, plan.point)) return {status: 'blocked', reason: 'stale-selection'};
  const original = paragraph(host, plan.point);
  if (original === undefined || digest(original) !== plan.paragraphFingerprint) return {status: 'blocked', reason: 'stale-original'};
  if (plan.operation === 'bibliography' && plan.point.charOffset !== scalarLength(original)) {
    return {status: 'blocked', reason: 'stale-original'};
  }
  let snapshot: number;
  try { snapshot = host.saveSnapshot(); } catch { return {status: 'blocked', reason: 'history-unavailable'}; }
  if (!integer(snapshot)) return {status: 'blocked', reason: 'history-unavailable'};
  try {
    if (!insert(host, plan)) throw new Error('mutation');
    const after = owner(port);
    if (!after || after.identity !== plan.documentIdentity || after.revision === plan.revision || !inserted(host, plan)) {
      throw new Error('verification');
    }
    return {status: 'applied', text: plan.renderedText,
      command: new BibliographyCommandB144(host, port, registry, plan, snapshot, after.revision)};
  } catch {
    try {
      if (!accepted(host.restoreSnapshot(snapshot))) throw new Error('restore');
      const restored = owner(port), restoredParagraph = paragraph(host, plan.point);
      if (!restored || restored.identity !== plan.documentIdentity || restored.revision !== plan.revision
        || restoredParagraph === undefined || digest(restoredParagraph) !== plan.paragraphFingerprint) throw new Error('verify');
      host.discardSnapshot(snapshot);
      return {status: 'blocked', reason: 'verification-failed'};
    } catch { return {status: 'state-uncertain', reason: 'rollback-failed'}; }
  }
}

export class BibliographyCommandB144 {
  #position: 'before' | 'after' | 'disposed' = 'after';
  readonly #host: BibliographyHostB144;
  readonly #port: BibliographyContextB144;
  readonly #registry: BibliographyRegistryB144;
  readonly #plan: BibliographyPlanB144;
  readonly #snapshot: number;
  readonly #afterRevision: string;
  constructor(
    host: BibliographyHostB144, port: BibliographyContextB144,
    registry: BibliographyRegistryB144, plan: BibliographyPlanB144,
    snapshot: number, afterRevision: string,
  ) {
    this.#host = host; this.#port = port; this.#registry = registry;
    this.#plan = plan; this.#snapshot = snapshot; this.#afterRevision = afterRevision;
  }
  undo(): BibliographyTransitionB144 {
    const current = owner(this.#port);
    if (this.#position !== 'after' || !current || current.identity !== this.#plan.documentIdentity
      || current.revision !== this.#afterRevision) return {status: 'blocked', reason: 'history-state-mismatch'};
    try {
      if (!accepted(this.#host.restoreSnapshot(this.#snapshot))) throw new Error('restore');
      const restored = owner(this.#port), original = paragraph(this.#host, this.#plan.point);
      if (!restored || restored.identity !== this.#plan.documentIdentity || restored.revision !== this.#plan.revision
        || original === undefined || digest(original) !== this.#plan.paragraphFingerprint) throw new Error('verify');
      this.#position = 'before'; return {status: 'restored', text: ''};
    } catch { return {status: 'state-uncertain', reason: 'rollback-failed'}; }
  }
  redo(): BibliographyTransitionB144 {
    const current = owner(this.#port), unsafeReason = unsafe(this.#port), original = paragraph(this.#host, this.#plan.point);
    if (this.#position !== 'before' || unsafeReason || !current || current.identity !== this.#plan.documentIdentity
      || current.revision !== this.#plan.revision || this.#registry.fingerprint !== this.#plan.registryFingerprint
      || original === undefined || digest(original) !== this.#plan.paragraphFingerprint) {
      return {status: 'blocked', reason: 'history-state-mismatch'};
    }
    if (!insert(this.#host, this.#plan)) return {status: 'blocked', reason: 'mutation-rejected'};
    const after = owner(this.#port);
    if (!after || after.identity !== this.#plan.documentIdentity || after.revision !== this.#afterRevision || !inserted(this.#host, this.#plan)) {
      try { this.#host.restoreSnapshot(this.#snapshot); } catch { return {status: 'state-uncertain', reason: 'rollback-failed'}; }
      return {status: 'blocked', reason: 'verification-failed'};
    }
    this.#position = 'after'; return {status: 'restored', text: this.#plan.renderedText};
  }
  dispose(): void {
    if (this.#position === 'disposed') return;
    this.#position = 'disposed'; try { this.#host.discardSnapshot(this.#snapshot); } catch { /* release only */ }
  }
}
