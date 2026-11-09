import {sha256} from '@noble/hashes/sha2.js';

type JsonObject = Record<string, unknown>;
type NoteKind = 'footnote' | 'endnote';
type BlockReason =
  | 'unsupported-note-kind'
  | 'api-unavailable'
  | 'invalid-owner'
  | 'invalid-context'
  | 'invalid-shape'
  | 'stale-document'
  | 'stale-shape'
  | 'mutation-rejected'
  | 'verification-failed'
  | 'rollback-failed'
  | 'history-unavailable'
  | 'history-state-mismatch';

export interface EndnoteShapeHostB087 {
  getSectionCount(): number;
  getEndnoteShape(section: number): unknown;
  applyEndnoteShape(section: number, settings: string): unknown;
  saveSnapshot(): number;
  restoreSnapshot(token: number): unknown;
  discardSnapshot(token: number): void;
}

export interface EndnoteShapeContextB087 {
  documentIdentity(): string;
  revision(): string;
}

export interface EndnoteShapeSealB087 {
  readonly kind: 'endnote-content-number-size';
  readonly documentIdentity: string;
  readonly revision: string;
  readonly section: number;
  readonly shapeFingerprint: string;
  readonly small: boolean;
}

export type CaptureResultB087 =
  | {status: 'ready'; seal: EndnoteShapeSealB087}
  | {status: 'blocked'; reason: BlockReason};

export type CommandTransitionB087 =
  | {status: 'applied'; small: boolean; command: EndnoteShapeCommandB087}
  | {status: 'restored'; small: boolean}
  | {status: 'noop'; small: boolean}
  | {status: 'blocked'; reason: BlockReason}
  | {status: 'state-uncertain'; reason: 'rollback-failed' | 'history-state-mismatch'};

const shapeKeys = [
  'numberFormat', 'userChar', 'prefixChar', 'suffixChar', 'startNumber',
  'separatorEnabled', 'separatorLength', 'separatorMarginTop',
  'separatorMarginBottom', 'noteSpacing', 'separatorLineType',
  'separatorLineWidth', 'separatorColor', 'numberCodeSuperscript',
  'printInlineAfterText', 'numbering', 'placement',
] as const;

const stringKeys = new Set([
  'numberFormat', 'userChar', 'prefixChar', 'suffixChar', 'separatorColor',
  'numbering', 'placement',
]);
const booleanKeys = new Set(['separatorEnabled', 'numberCodeSuperscript', 'printInlineAfterText']);

function object(value: unknown): JsonObject | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  return value as JsonObject;
}

function parsed(value: unknown): JsonObject | undefined {
  if (typeof value === 'string') {
    if (value.length > 1_000_000) return undefined;
    try { return object(JSON.parse(value)); } catch { return undefined; }
  }
  return object(value);
}

function exactShape(value: unknown): JsonObject | undefined {
  const source = parsed(value);
  if (!source || (source.ok !== undefined && source.ok !== true)) return undefined;
  const allowed = new Set<string>(['ok', ...shapeKeys]);
  if (Object.keys(source).some(key => !allowed.has(key))) return undefined;
  const shape: JsonObject = {};
  for (const key of shapeKeys) {
    const item = source[key];
    if (stringKeys.has(key)) {
      if (typeof item !== 'string' || item.length > 1024) return undefined;
    } else if (booleanKeys.has(key)) {
      if (typeof item !== 'boolean') return undefined;
    } else if (typeof item !== 'number' || !Number.isSafeInteger(item)) return undefined;
    shape[key] = item;
  }
  return shape;
}

function canonical(value: JsonObject): string {
  return JSON.stringify(Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]])));
}

function fingerprint(shape: JsonObject): string {
  return Array.from(sha256(new TextEncoder().encode(canonical(shape))), value => value.toString(16).padStart(2, '0')).join('');
}

function hash(value: string): boolean { return /^[a-f0-9]{64}$/u.test(value); }
function section(value: number): boolean { return Number.isSafeInteger(value) && value >= 0; }

function context(port: EndnoteShapeContextB087): {identity: string; revision: string} | undefined {
  try {
    const identity = port.documentIdentity();
    const revision = port.revision();
    return hash(identity) && hash(revision) ? {identity, revision} : undefined;
  } catch { return undefined; }
}

function hasApi(host: Partial<EndnoteShapeHostB087>): host is EndnoteShapeHostB087 {
  return ['getSectionCount', 'getEndnoteShape', 'applyEndnoteShape', 'saveSnapshot', 'restoreSnapshot', 'discardSnapshot']
    .every(name => typeof (host as Record<string, unknown>)[name] === 'function');
}

function accepted(value: unknown): boolean {
  const result = parsed(value);
  return result?.ok === true;
}

export function auditNoteShapeCapabilityB087(host: Partial<EndnoteShapeHostB087>, kind: NoteKind):
  {supported: true; scope: 'section'; option: 'content-number-small'} |
  {supported: false; reason: 'unsupported-note-kind' | 'api-unavailable'} {
  if (kind !== 'endnote') return {supported: false, reason: 'unsupported-note-kind'};
  return hasApi(host)
    ? {supported: true, scope: 'section', option: 'content-number-small'}
    : {supported: false, reason: 'api-unavailable'};
}

export function captureEndnoteContentNumberSizeB087(
  host: Partial<EndnoteShapeHostB087>,
  port: EndnoteShapeContextB087,
  ownerSection: number,
): CaptureResultB087 {
  if (!hasApi(host)) return {status: 'blocked', reason: 'api-unavailable'};
  if (!section(ownerSection)) return {status: 'blocked', reason: 'invalid-owner'};
  let sectionCount: number;
  try { sectionCount = host.getSectionCount(); } catch { return {status: 'blocked', reason: 'invalid-owner'}; }
  if (!Number.isSafeInteger(sectionCount) || ownerSection >= sectionCount) return {status: 'blocked', reason: 'invalid-owner'};
  const observed = context(port);
  if (!observed) return {status: 'blocked', reason: 'invalid-context'};
  let shape: JsonObject | undefined;
  try { shape = exactShape(host.getEndnoteShape(ownerSection)); } catch { return {status: 'blocked', reason: 'invalid-shape'}; }
  if (!shape) return {status: 'blocked', reason: 'invalid-shape'};
  return {status: 'ready', seal: {
    kind: 'endnote-content-number-size',
    documentIdentity: observed.identity,
    revision: observed.revision,
    section: ownerSection,
    shapeFingerprint: fingerprint(shape),
    small: shape.numberCodeSuperscript as boolean,
  }};
}

type SnapshotPair = {before: number; after: number};

export class EndnoteShapeCommandB087 {
  #position: 'after' | 'before' | 'disposed' = 'after';
  readonly #host: EndnoteShapeHostB087;
  readonly #port: EndnoteShapeContextB087;
  readonly #identity: string;
  readonly #beforeRevision: string;
  readonly #afterRevision: string;
  readonly #section: number;
  readonly #beforeFingerprint: string;
  readonly #afterFingerprint: string;
  readonly #snapshots: SnapshotPair;
  constructor(
    host: EndnoteShapeHostB087,
    port: EndnoteShapeContextB087,
    identity: string,
    beforeRevision: string,
    afterRevision: string,
    section: number,
    beforeFingerprint: string,
    afterFingerprint: string,
    snapshots: SnapshotPair,
  ) {
    this.#host = host;
    this.#port = port;
    this.#identity = identity;
    this.#beforeRevision = beforeRevision;
    this.#afterRevision = afterRevision;
    this.#section = section;
    this.#beforeFingerprint = beforeFingerprint;
    this.#afterFingerprint = afterFingerprint;
    this.#snapshots = snapshots;
  }

  undo(): CommandTransitionB087 {
    return this.#restore('after', 'before', this.#afterRevision, this.#beforeRevision, this.#afterFingerprint, this.#beforeFingerprint);
  }

  redo(): CommandTransitionB087 {
    return this.#restore('before', 'after', this.#beforeRevision, this.#afterRevision, this.#beforeFingerprint, this.#afterFingerprint);
  }

  dispose(): void {
    if (this.#position === 'disposed') return;
    this.#position = 'disposed';
    try { this.#host.discardSnapshot(this.#snapshots.before); } catch { /* best-effort release only */ }
    try { this.#host.discardSnapshot(this.#snapshots.after); } catch { /* best-effort release only */ }
  }

  #restore(
    expectedPosition: 'before' | 'after',
    nextPosition: 'before' | 'after',
    expectedRevision: string,
    nextRevision: string,
    expectedFingerprint: string,
    nextFingerprint: string,
  ): CommandTransitionB087 {
    if (this.#position !== expectedPosition) return {status: 'blocked', reason: 'history-state-mismatch'};
    const current = context(this.#port);
    if (!current || current.identity !== this.#identity || current.revision !== expectedRevision) {
      return {status: 'blocked', reason: 'history-state-mismatch'};
    }
    let shape: JsonObject | undefined;
    try { shape = exactShape(this.#host.getEndnoteShape(this.#section)); } catch { /* handled below */ }
    if (!shape || fingerprint(shape) !== expectedFingerprint) return {status: 'blocked', reason: 'history-state-mismatch'};
    try {
      const token = nextPosition === 'before' ? this.#snapshots.before : this.#snapshots.after;
      if (!accepted(this.#host.restoreSnapshot(token))) return {status: 'state-uncertain', reason: 'history-state-mismatch'};
      const restoredContext = context(this.#port);
      const restoredShape = exactShape(this.#host.getEndnoteShape(this.#section));
      if (!restoredContext || restoredContext.identity !== this.#identity || restoredContext.revision !== nextRevision ||
          !restoredShape || fingerprint(restoredShape) !== nextFingerprint) {
        return {status: 'state-uncertain', reason: 'history-state-mismatch'};
      }
      this.#position = nextPosition;
      return {status: 'restored', small: restoredShape.numberCodeSuperscript as boolean};
    } catch { return {status: 'state-uncertain', reason: 'history-state-mismatch'}; }
  }
}

export function applyEndnoteContentNumberSizeB087(
  host: Partial<EndnoteShapeHostB087>,
  port: EndnoteShapeContextB087,
  seal: EndnoteShapeSealB087,
  small: boolean,
): CommandTransitionB087 {
  if (!hasApi(host)) return {status: 'blocked', reason: 'api-unavailable'};
  if (seal.kind !== 'endnote-content-number-size' || !section(seal.section) || !hash(seal.documentIdentity) ||
      !hash(seal.revision) || !hash(seal.shapeFingerprint)) return {status: 'blocked', reason: 'invalid-owner'};
  const beforeContext = context(port);
  if (!beforeContext) return {status: 'blocked', reason: 'invalid-context'};
  if (beforeContext.identity !== seal.documentIdentity || beforeContext.revision !== seal.revision) {
    return {status: 'blocked', reason: 'stale-document'};
  }
  let beforeShape: JsonObject | undefined;
  try { beforeShape = exactShape(host.getEndnoteShape(seal.section)); } catch { return {status: 'blocked', reason: 'invalid-shape'}; }
  if (!beforeShape) return {status: 'blocked', reason: 'invalid-shape'};
  if (fingerprint(beforeShape) !== seal.shapeFingerprint || beforeShape.numberCodeSuperscript !== seal.small) {
    return {status: 'blocked', reason: 'stale-shape'};
  }
  if (beforeShape.numberCodeSuperscript === small) return {status: 'noop', small};

  let beforeToken: number;
  try { beforeToken = host.saveSnapshot(); } catch { return {status: 'blocked', reason: 'history-unavailable'}; }
  if (!Number.isSafeInteger(beforeToken) || beforeToken < 0) return {status: 'blocked', reason: 'history-unavailable'};
  const desired = {...beforeShape, numberCodeSuperscript: small};
  let afterToken: number | undefined;
  try {
    if (!accepted(host.applyEndnoteShape(seal.section, JSON.stringify(desired)))) throw new Error('rejected');
    const afterShape = exactShape(host.getEndnoteShape(seal.section));
    if (!afterShape || canonical(afterShape) !== canonical(desired)) throw new Error('verification');
    const afterContext = context(port);
    if (!afterContext || afterContext.identity !== seal.documentIdentity || afterContext.revision === seal.revision) throw new Error('verification');
    afterToken = host.saveSnapshot();
    if (!Number.isSafeInteger(afterToken) || afterToken < 0) throw new Error('history');
    return {status: 'applied', small, command: new EndnoteShapeCommandB087(
      host, port, seal.documentIdentity, seal.revision, afterContext.revision, seal.section,
      seal.shapeFingerprint, fingerprint(afterShape), {before: beforeToken, after: afterToken},
    )};
  } catch {
    if (afterToken !== undefined) { try { host.discardSnapshot(afterToken); } catch { /* release only */ } }
    try {
      if (!accepted(host.restoreSnapshot(beforeToken))) throw new Error('restore rejected');
      const restored = exactShape(host.getEndnoteShape(seal.section));
      const restoredContext = context(port);
      if (!restored || fingerprint(restored) !== seal.shapeFingerprint || !restoredContext ||
          restoredContext.identity !== seal.documentIdentity || restoredContext.revision !== seal.revision) throw new Error('restore mismatch');
      try { host.discardSnapshot(beforeToken); } catch { /* release only */ }
      return {status: 'blocked', reason: 'verification-failed'};
    } catch { return {status: 'state-uncertain', reason: 'rollback-failed'}; }
  }
}
