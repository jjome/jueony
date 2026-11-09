import {sha256} from '@noble/hashes/sha2.js';

export type DocumentHistoryOperationB134 =
  | 'insert-text'
  | 'replace-text'
  | 'delete-text'
  | 'format-text'
  | 'structure-edit'
  | 'document-setting';

export type DocumentHistoryArtifactB134 = Readonly<{
  hwpSha256: string;
  hwpxSha256: string;
}>;

export type DocumentHistoryOwnerInputB134 = Readonly<{
  documentIdentity: unknown;
  documentInstance: unknown;
  revision: unknown;
  hwpBytes: unknown;
  hwpxBytes: unknown;
}>;

export type DocumentHistoryOwnerB134 = Readonly<{
  documentIdentity: string;
  documentInstance: string;
  revision: string;
  artifact: DocumentHistoryArtifactB134;
}>;

export type VerifiedHistoryReceiptB134 = Readonly<{
  version: 1;
  documentIdentity: string;
  documentInstance: string;
  beforeRevision: string;
  afterRevision: string;
  operation: DocumentHistoryOperationB134;
  mutationCount: number;
  before: DocumentHistoryArtifactB134;
  after: DocumentHistoryArtifactB134;
  fingerprint: string;
}>;

export type DocumentHistoryEntryB134 = Readonly<{
  sequence: number;
  timestampMs: number;
  operation: DocumentHistoryOperationB134;
  mutationCount: number;
  beforeRevision: string;
  afterRevision: string;
  before: DocumentHistoryArtifactB134;
  after: DocumentHistoryArtifactB134;
  receiptFingerprint: string;
  previousFingerprint: string;
  entryFingerprint: string;
}>;

export type DocumentHistoryViewB134 = Readonly<{
  version: 1;
  documentIdentity: string;
  documentInstance: string;
  root: DocumentHistoryOwnerB134;
  entries: readonly DocumentHistoryEntryB134[];
  head: DocumentHistoryOwnerB134;
  chainFingerprint: string;
}>;

const TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,255}$/u;
const HEX = /^[0-9a-f]{64}$/u;
const MAX_ARTIFACT_BYTES = 128 * 1024 * 1024;
const MAX_ENTRIES = 256;
const MAX_MUTATIONS = 64;
const OPERATIONS = new Set<DocumentHistoryOperationB134>([
  'insert-text', 'replace-text', 'delete-text', 'format-text', 'structure-edit', 'document-setting',
]);

const digest = (value: unknown): string => Array.from(
  sha256(value instanceof Uint8Array ? value : new TextEncoder().encode(JSON.stringify(value))),
  byte => byte.toString(16).padStart(2, '0'),
).join('');

function token(value: unknown, label: string): string {
  if (typeof value !== 'string' || !TOKEN.test(value)) throw new Error(`${label}가 올바르지 않습니다.`);
  return value;
}

function bytes(value: unknown, label: string): Uint8Array {
  if (!(value instanceof Uint8Array) || value.byteLength === 0 || value.byteLength > MAX_ARTIFACT_BYTES) {
    throw new Error(`${label}가 올바르지 않습니다.`);
  }
  return value;
}

function artifact(value: unknown): value is DocumentHistoryArtifactB134 {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    && Object.keys(value).length === 2
    && HEX.test((value as DocumentHistoryArtifactB134).hwpSha256)
    && HEX.test((value as DocumentHistoryArtifactB134).hwpxSha256);
}

function sameArtifact(left: DocumentHistoryArtifactB134, right: DocumentHistoryArtifactB134): boolean {
  return left.hwpSha256 === right.hwpSha256 && left.hwpxSha256 === right.hwpxSha256;
}

function sameOwner(left: DocumentHistoryOwnerB134, right: DocumentHistoryOwnerB134): boolean {
  return left.documentIdentity === right.documentIdentity
    && left.documentInstance === right.documentInstance
    && left.revision === right.revision
    && sameArtifact(left.artifact, right.artifact);
}

function receiptUnsigned(value: Omit<VerifiedHistoryReceiptB134, 'fingerprint'>): Omit<VerifiedHistoryReceiptB134, 'fingerprint'> {
  return {version: 1, documentIdentity: value.documentIdentity, documentInstance: value.documentInstance,
    beforeRevision: value.beforeRevision, afterRevision: value.afterRevision, operation: value.operation,
    mutationCount: value.mutationCount, before: value.before, after: value.after};
}

function verifyReceipt(value: unknown): VerifiedHistoryReceiptB134 {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('편집 영수증이 올바르지 않습니다.');
  const raw = value as Record<string, unknown>;
  const keys = ['version', 'documentIdentity', 'documentInstance', 'beforeRevision', 'afterRevision', 'operation',
    'mutationCount', 'before', 'after', 'fingerprint'];
  if (Object.keys(raw).length !== keys.length || Object.keys(raw).some(key => !keys.includes(key)) || raw.version !== 1
    || typeof raw.operation !== 'string' || !OPERATIONS.has(raw.operation as DocumentHistoryOperationB134)
    || typeof raw.mutationCount !== 'number' || !Number.isSafeInteger(raw.mutationCount)
    || raw.mutationCount < 1 || raw.mutationCount > MAX_MUTATIONS || !artifact(raw.before) || !artifact(raw.after)
    || typeof raw.fingerprint !== 'string' || !HEX.test(raw.fingerprint)) {
    throw new Error('편집 영수증이 올바르지 않습니다.');
  }
  const checked: Omit<VerifiedHistoryReceiptB134, 'fingerprint'> = receiptUnsigned({
    version: 1,
    documentIdentity: token(raw.documentIdentity, '문서 식별자'),
    documentInstance: token(raw.documentInstance, '문서 인스턴스'),
    beforeRevision: token(raw.beforeRevision, '편집 전 버전'),
    afterRevision: token(raw.afterRevision, '편집 후 버전'),
    operation: raw.operation as DocumentHistoryOperationB134,
    mutationCount: raw.mutationCount,
    before: raw.before,
    after: raw.after,
  });
  if (checked.beforeRevision === checked.afterRevision || sameArtifact(checked.before, checked.after)
    || digest(checked) !== raw.fingerprint) throw new Error('편집 영수증 검증에 실패했습니다.');
  return Object.freeze({...checked, fingerprint: raw.fingerprint});
}

export function sealDocumentHistoryOwnerB134(input: DocumentHistoryOwnerInputB134): DocumentHistoryOwnerB134 {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) throw new Error('문서 상태가 올바르지 않습니다.');
  const hwp = bytes(input.hwpBytes, 'HWP 저장 결과'), hwpx = bytes(input.hwpxBytes, 'HWPX 저장 결과');
  return Object.freeze({
    documentIdentity: token(input.documentIdentity, '문서 식별자'),
    documentInstance: token(input.documentInstance, '문서 인스턴스'),
    revision: token(input.revision, '문서 버전'),
    artifact: Object.freeze({hwpSha256: digest(hwp), hwpxSha256: digest(hwpx)}),
  });
}

export function createVerifiedHistoryReceiptB134(
  beforeInput: DocumentHistoryOwnerInputB134,
  afterInput: DocumentHistoryOwnerInputB134,
  operation: unknown,
  mutationCount: unknown = 1,
): VerifiedHistoryReceiptB134 {
  const before = sealDocumentHistoryOwnerB134(beforeInput), after = sealDocumentHistoryOwnerB134(afterInput);
  if (before.documentIdentity !== after.documentIdentity || before.documentInstance !== after.documentInstance) {
    throw new Error('같은 열린 문서의 편집만 기록할 수 있습니다.');
  }
  if (before.revision === after.revision || sameArtifact(before.artifact, after.artifact)) {
    throw new Error('문서 변경을 확인하지 못했습니다.');
  }
  if (typeof operation !== 'string' || !OPERATIONS.has(operation as DocumentHistoryOperationB134)
    || typeof mutationCount !== 'number' || !Number.isSafeInteger(mutationCount)
    || mutationCount < 1 || mutationCount > MAX_MUTATIONS) throw new Error('편집 종류가 올바르지 않습니다.');
  const unsigned = receiptUnsigned({version: 1, documentIdentity: before.documentIdentity,
    documentInstance: before.documentInstance, beforeRevision: before.revision, afterRevision: after.revision,
    operation: operation as DocumentHistoryOperationB134, mutationCount,
    before: before.artifact, after: after.artifact});
  return Object.freeze({...unsigned, fingerprint: digest(unsigned)});
}

function entryUnsigned(value: Omit<DocumentHistoryEntryB134, 'entryFingerprint'>): Omit<DocumentHistoryEntryB134, 'entryFingerprint'> {
  return {sequence: value.sequence, timestampMs: value.timestampMs, operation: value.operation,
    mutationCount: value.mutationCount, beforeRevision: value.beforeRevision, afterRevision: value.afterRevision,
    before: value.before, after: value.after, receiptFingerprint: value.receiptFingerprint,
    previousFingerprint: value.previousFingerprint};
}

function rootFingerprint(owner: DocumentHistoryOwnerB134): string {
  return digest({version: 1, root: owner});
}

function immutableOwner(owner: DocumentHistoryOwnerB134): DocumentHistoryOwnerB134 {
  return Object.freeze({...owner, artifact: Object.freeze({...owner.artifact})});
}

function immutableEntry(entry: DocumentHistoryEntryB134): DocumentHistoryEntryB134 {
  return Object.freeze({...entry, before: Object.freeze({...entry.before}), after: Object.freeze({...entry.after})});
}

export function verifyDocumentHistoryViewB134(view: unknown): view is DocumentHistoryViewB134 {
  try {
    if (typeof view !== 'object' || view === null || Array.isArray(view)) return false;
    const value = view as DocumentHistoryViewB134;
    if (value.version !== 1 || !Array.isArray(value.entries) || value.entries.length > MAX_ENTRIES
      || !HEX.test(value.chainFingerprint) || !artifact(value.root?.artifact) || !artifact(value.head?.artifact)
      || token(value.documentIdentity, '문서 식별자') !== value.root.documentIdentity
      || token(value.documentInstance, '문서 인스턴스') !== value.root.documentInstance) return false;
    let previous = rootFingerprint(value.root), head = value.root, lastTimestamp = -1;
    for (let index = 0; index < value.entries.length; index += 1) {
      const entry = value.entries[index];
      if (!entry || entry.sequence !== index + 1 || !Number.isSafeInteger(entry.timestampMs)
        || entry.timestampMs < 0 || entry.timestampMs < lastTimestamp
        || !OPERATIONS.has(entry.operation) || !Number.isSafeInteger(entry.mutationCount)
        || entry.mutationCount < 1 || entry.mutationCount > MAX_MUTATIONS || !artifact(entry.before)
        || !artifact(entry.after) || !HEX.test(entry.receiptFingerprint) || entry.previousFingerprint !== previous
        || entry.beforeRevision !== head.revision || !sameArtifact(entry.before, head.artifact)) return false;
      const unsigned = entryUnsigned(entry);
      if (digest(unsigned) !== entry.entryFingerprint) return false;
      previous = entry.entryFingerprint; lastTimestamp = entry.timestampMs;
      head = {documentIdentity: value.documentIdentity, documentInstance: value.documentInstance,
        revision: entry.afterRevision, artifact: entry.after};
    }
    return sameOwner(head, value.head) && previous === value.chainFingerprint;
  } catch { return false; }
}

export class DocumentHistoryLedgerB134 {
  readonly #root: DocumentHistoryOwnerB134;
  readonly #clock: () => unknown;
  readonly #entries: DocumentHistoryEntryB134[] = [];
  #head: DocumentHistoryOwnerB134;

  constructor(rootInput: DocumentHistoryOwnerInputB134, trustedClock: () => unknown) {
    if (typeof trustedClock !== 'function') throw new Error('신뢰할 수 있는 시계가 필요합니다.');
    this.#root = immutableOwner(sealDocumentHistoryOwnerB134(rootInput));
    this.#head = this.#root;
    this.#clock = trustedClock;
  }

  append(receiptInput: unknown, currentInput: DocumentHistoryOwnerInputB134): DocumentHistoryEntryB134 {
    if (this.#entries.length >= MAX_ENTRIES) throw new Error('세션 문서 이력 한도를 초과했습니다.');
    const receipt = verifyReceipt(receiptInput), current = sealDocumentHistoryOwnerB134(currentInput);
    if (receipt.documentIdentity !== this.#root.documentIdentity
      || receipt.documentInstance !== this.#root.documentInstance
      || current.documentIdentity !== this.#root.documentIdentity
      || current.documentInstance !== this.#root.documentInstance) throw new Error('다른 열린 문서의 이력은 기록할 수 없습니다.');
    if (receipt.beforeRevision !== this.#head.revision || !sameArtifact(receipt.before, this.#head.artifact)) {
      throw new Error('문서 이력에서 갈라진 편집은 기록할 수 없습니다.');
    }
    const expectedCurrent: DocumentHistoryOwnerB134 = {documentIdentity: receipt.documentIdentity,
      documentInstance: receipt.documentInstance, revision: receipt.afterRevision, artifact: receipt.after};
    if (!sameOwner(current, expectedCurrent)) throw new Error('현재 문서 상태가 편집 영수증과 다릅니다.');
    const timestampMs = this.#clock();
    const previousTimestamp = this.#entries.at(-1)?.timestampMs ?? -1;
    if (typeof timestampMs !== 'number' || !Number.isSafeInteger(timestampMs) || timestampMs < 0
      || timestampMs < previousTimestamp) throw new Error('문서 이력 시각이 올바르지 않습니다.');
    const previousFingerprint = this.#entries.at(-1)?.entryFingerprint ?? rootFingerprint(this.#root);
    const unsigned = entryUnsigned({sequence: this.#entries.length + 1, timestampMs,
      operation: receipt.operation, mutationCount: receipt.mutationCount,
      beforeRevision: receipt.beforeRevision, afterRevision: receipt.afterRevision,
      before: receipt.before, after: receipt.after, receiptFingerprint: receipt.fingerprint, previousFingerprint});
    const entry = immutableEntry({...unsigned, entryFingerprint: digest(unsigned)});
    this.#entries.push(entry); this.#head = immutableOwner(current);
    return entry;
  }

  view(): DocumentHistoryViewB134 {
    const entries = Object.freeze(this.#entries.map(immutableEntry));
    const view = Object.freeze({version: 1 as const, documentIdentity: this.#root.documentIdentity,
      documentInstance: this.#root.documentInstance, root: immutableOwner(this.#root), entries,
      head: immutableOwner(this.#head), chainFingerprint: entries.at(-1)?.entryFingerprint ?? rootFingerprint(this.#root)});
    if (!verifyDocumentHistoryViewB134(view)) throw new Error('문서 이력 체인을 확인하지 못했습니다.');
    return view;
  }
}
