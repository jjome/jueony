import {sha256} from '@noble/hashes/sha2.js';

const SCHEMA = 'jueony.recovery-checkpoint';
const VERSION = 1;
const HEX_256 = /^[0-9a-f]{64}$/;
const SAFE_ID = /^[\p{L}\p{N}._:@+-]{1,256}$/u;

export type RecoveryCheckpointScopeN044 = Readonly<{
  workspaceId: string;
  documentId: string;
}>;

export type RecoveryCheckpointRecordN044 = Readonly<{
  schema: typeof SCHEMA;
  version: typeof VERSION;
  workspaceId: string;
  documentId: string;
  sourceIdentity: string;
  sourceRevision: string;
  sourceBytesHash: string;
  generation: number;
  token: string;
  checkpointBytes: Uint8Array;
  checkpointBytesHash: string;
  recordHash: string;
}>;

export type RecoveryCheckpointReferenceN044 = Readonly<{
  generation: number;
  token: string;
  recordHash: string;
}>;

export type RecoveryCheckpointReadN044 =
  | Readonly<{status: 'absent'}>
  | Readonly<{status: 'found'; record: unknown}>
  | Readonly<{status: 'unavailable'; code: 'permission-denied' | 'io-failure'}>;

export type RecoveryCheckpointMutationN044 =
  | Readonly<{status: 'committed'}>
  | Readonly<{
      status: 'not-committed';
      code: 'cas-conflict' | 'disk-full' | 'permission-denied' | 'serialization-failed' | 'partial-write-rolled-back';
    }>
  | Readonly<{status: 'state-uncertain'; code: 'partial-write' | 'commit-status-unknown'}>;

/**
 * The host owns the physical transaction. A `not-committed` response is a
 * contractual proof that the expected recovery record is still intact. The
 * coordinator treats throws and `state-uncertain` as potentially committed.
 */
export interface RecoveryCheckpointHostPortN044 {
  read(scope: RecoveryCheckpointScopeN044): Promise<RecoveryCheckpointReadN044>;
  compareAndSwap(input: Readonly<{
    scope: RecoveryCheckpointScopeN044;
    expected: RecoveryCheckpointReferenceN044 | null;
    next: RecoveryCheckpointRecordN044;
  }>): Promise<RecoveryCheckpointMutationN044>;
  compareAndDelete(input: Readonly<{
    scope: RecoveryCheckpointScopeN044;
    expected: RecoveryCheckpointReferenceN044;
  }>): Promise<RecoveryCheckpointMutationN044>;
}

export type WriteRecoveryCheckpointRequestN044 = Readonly<{
  scope: RecoveryCheckpointScopeN044;
  source: Readonly<{
    identity: string;
    revision: string;
    bytes: Uint8Array;
    bytesHash: string;
  }>;
  checkpoint: Readonly<{
    generation: number;
    token: string;
    bytes: Uint8Array;
  }>;
}>;

type SafeFailureCode =
  | 'invalid-request'
  | 'source-hash-mismatch'
  | 'generation-mismatch'
  | 'source-identity-mismatch'
  | 'token-reused'
  | 'checkpoint-corrupt'
  | 'checkpoint-future-version'
  | 'checkpoint-foreign'
  | 'read-unavailable'
  | 'cas-conflict'
  | 'disk-full'
  | 'permission-denied'
  | 'serialization-failed'
  | 'partial-write-rolled-back';

export type WriteRecoveryCheckpointResultN044 =
  | Readonly<{status: 'checkpointed'; generation: number}>
  | Readonly<{
      status: 'not-written';
      code: SafeFailureCode;
      originalUnchanged: true;
      previousCheckpointPreserved: true;
    }>
  | Readonly<{
      status: 'state-uncertain';
      code: 'host-protocol-failure' | 'partial-write' | 'commit-status-unknown' | 'verification-unavailable' | 'verification-mismatch';
      requiresRecoveryRescan: true;
    }>;

export type DiscardRecoveryCheckpointRequestN044 = Readonly<{
  scope: RecoveryCheckpointScopeN044;
  expected: Readonly<{generation: number; token: string}>;
}>;

export type DiscardRecoveryCheckpointResultN044 =
  | Readonly<{status: 'discarded'; generation: number}>
  | Readonly<{
      status: 'retained';
      code: 'invalid-request' | 'checkpoint-absent' | 'checkpoint-corrupt' | 'checkpoint-future-version' | 'checkpoint-foreign' | 'token-mismatch' | 'generation-mismatch' | 'read-unavailable' | 'cas-conflict' | 'disk-full' | 'permission-denied' | 'serialization-failed' | 'partial-write-rolled-back';
      checkpointPreserved: true;
    }>
  | Readonly<{
      status: 'state-uncertain';
      code: 'host-protocol-failure' | 'partial-write' | 'commit-status-unknown' | 'verification-unavailable' | 'verification-mismatch';
      requiresRecoveryRescan: true;
    }>;

type ClassifiedRecord =
  | Readonly<{kind: 'valid'; record: RecoveryCheckpointRecordN044}>
  | Readonly<{kind: 'corrupt' | 'future' | 'foreign'}>;

export function createRecoveryCheckpointTransactionCoordinatorN044(host: RecoveryCheckpointHostPortN044) {
  return {
    writeCheckpoint: (request: WriteRecoveryCheckpointRequestN044) => writeCheckpoint(host, request),
    discardOnCleanClose: (request: DiscardRecoveryCheckpointRequestN044) => discardOnCleanClose(host, request),
  };
}

async function writeCheckpoint(
  host: RecoveryCheckpointHostPortN044,
  request: WriteRecoveryCheckpointRequestN044,
): Promise<WriteRecoveryCheckpointResultN044> {
  if (!validWriteRequest(request)) return notWritten('invalid-request');
  if (digest(request.source.bytes) !== request.source.bytesHash) return notWritten('source-hash-mismatch');

  const before = await safeRead(host, request.scope);
  if (before.kind === 'threw') return notWritten('read-unavailable');
  if (before.value.status === 'unavailable') return notWritten('read-unavailable');

  let expected: RecoveryCheckpointReferenceN044 | null = null;
  if (before.value.status === 'found') {
    const classified = classify(before.value.record, request.scope);
    if (classified.kind !== 'valid') return notWritten(classificationCode(classified.kind));
    const current = classified.record;
    if (current.sourceIdentity !== request.source.identity) return notWritten('source-identity-mismatch');
    if (request.checkpoint.generation !== current.generation + 1) return notWritten('generation-mismatch');
    if (request.checkpoint.token === current.token) return notWritten('token-reused');
    expected = reference(current);
  } else if (request.checkpoint.generation !== 1) {
    return notWritten('generation-mismatch');
  }

  const next = makeRecord(request);
  let mutation: RecoveryCheckpointMutationN044;
  try {
    mutation = await host.compareAndSwap({scope: request.scope, expected, next});
  } catch {
    return uncertain('commit-status-unknown');
  }
  if (!validMutation(mutation)) return uncertain('host-protocol-failure');
  if (mutation.status === 'not-committed') return notWritten(mutation.code);
  if (mutation.status === 'state-uncertain') return uncertain(mutation.code);

  const readback = await safeRead(host, request.scope);
  if (readback.kind === 'threw' || readback.value.status === 'unavailable') return uncertain('verification-unavailable');
  if (readback.value.status !== 'found') return uncertain('verification-mismatch');
  const verified = classify(readback.value.record, request.scope);
  if (verified.kind !== 'valid' || !sameRecord(verified.record, next)) return uncertain('verification-mismatch');
  return {status: 'checkpointed', generation: next.generation};
}

async function discardOnCleanClose(
  host: RecoveryCheckpointHostPortN044,
  request: DiscardRecoveryCheckpointRequestN044,
): Promise<DiscardRecoveryCheckpointResultN044> {
  if (!validScope(request.scope) || !Number.isSafeInteger(request.expected.generation) || request.expected.generation < 1 || !validToken(request.expected.token)) {
    return retained('invalid-request');
  }
  const before = await safeRead(host, request.scope);
  if (before.kind === 'threw' || before.value.status === 'unavailable') return retained('read-unavailable');
  if (before.value.status === 'absent') return retained('checkpoint-absent');
  const classified = classify(before.value.record, request.scope);
  if (classified.kind !== 'valid') return retained(classificationCode(classified.kind));
  const current = classified.record;
  if (current.generation !== request.expected.generation) return retained('generation-mismatch');
  if (current.token !== request.expected.token) return retained('token-mismatch');

  let mutation: RecoveryCheckpointMutationN044;
  try {
    mutation = await host.compareAndDelete({scope: request.scope, expected: reference(current)});
  } catch {
    return uncertain('commit-status-unknown');
  }
  if (!validMutation(mutation)) return uncertain('host-protocol-failure');
  if (mutation.status === 'not-committed') return retained(mutation.code);
  if (mutation.status === 'state-uncertain') return uncertain(mutation.code);

  const readback = await safeRead(host, request.scope);
  if (readback.kind === 'threw' || readback.value.status === 'unavailable') return uncertain('verification-unavailable');
  if (readback.value.status !== 'absent') return uncertain('verification-mismatch');
  return {status: 'discarded', generation: current.generation};
}

function validWriteRequest(request: WriteRecoveryCheckpointRequestN044): boolean {
  return validScope(request.scope)
    && validOpaque(request.source.identity)
    && validOpaque(request.source.revision)
    && request.source.bytes instanceof Uint8Array
    && request.source.bytes.byteLength > 0
    && HEX_256.test(request.source.bytesHash)
    && Number.isSafeInteger(request.checkpoint.generation)
    && request.checkpoint.generation >= 1
    && validToken(request.checkpoint.token)
    && request.checkpoint.bytes instanceof Uint8Array
    && request.checkpoint.bytes.byteLength > 0;
}

function validScope(scope: RecoveryCheckpointScopeN044): boolean {
  return Boolean(scope && SAFE_ID.test(scope.workspaceId) && SAFE_ID.test(scope.documentId));
}

function validOpaque(value: string): boolean {
  return typeof value === 'string' && value.length >= 1 && value.length <= 512 && !/[\u0000-\u001f\u007f]/u.test(value);
}

function validToken(value: string): boolean {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{16,256}$/.test(value);
}

function makeRecord(request: WriteRecoveryCheckpointRequestN044): RecoveryCheckpointRecordN044 {
  const checkpointBytes = new Uint8Array(request.checkpoint.bytes);
  const base = {
    schema: SCHEMA,
    version: VERSION,
    workspaceId: request.scope.workspaceId,
    documentId: request.scope.documentId,
    sourceIdentity: request.source.identity,
    sourceRevision: request.source.revision,
    sourceBytesHash: request.source.bytesHash,
    generation: request.checkpoint.generation,
    token: request.checkpoint.token,
    checkpointBytes,
    checkpointBytesHash: digest(checkpointBytes),
  } as const;
  return {...base, recordHash: recordDigest(base)};
}

function classify(value: unknown, scope: RecoveryCheckpointScopeN044): ClassifiedRecord {
  if (!value || typeof value !== 'object') return {kind: 'corrupt'};
  const candidate = value as Partial<RecoveryCheckpointRecordN044>;
  if (candidate.schema === SCHEMA && Number.isSafeInteger(candidate.version) && Number(candidate.version) > VERSION) return {kind: 'future'};
  if (candidate.schema !== SCHEMA || candidate.version !== VERSION) return {kind: 'corrupt'};
  if (typeof candidate.workspaceId === 'string' && typeof candidate.documentId === 'string'
      && (candidate.workspaceId !== scope.workspaceId || candidate.documentId !== scope.documentId)) return {kind: 'foreign'};
  if (!SAFE_ID.test(candidate.workspaceId ?? '') || !SAFE_ID.test(candidate.documentId ?? '')
      || !validOpaque(candidate.sourceIdentity ?? '') || !validOpaque(candidate.sourceRevision ?? '')
      || !HEX_256.test(candidate.sourceBytesHash ?? '')
      || !Number.isSafeInteger(candidate.generation) || Number(candidate.generation) < 1
      || !validToken(candidate.token ?? '') || !(candidate.checkpointBytes instanceof Uint8Array)
      || candidate.checkpointBytes.byteLength < 1 || !HEX_256.test(candidate.checkpointBytesHash ?? '')
      || !HEX_256.test(candidate.recordHash ?? '')) return {kind: 'corrupt'};
  const record = candidate as RecoveryCheckpointRecordN044;
  if (digest(record.checkpointBytes) !== record.checkpointBytesHash || recordDigest(record) !== record.recordHash) return {kind: 'corrupt'};
  return {kind: 'valid', record};
}

function recordDigest(record: Omit<RecoveryCheckpointRecordN044, 'recordHash'> | RecoveryCheckpointRecordN044): string {
  const tuple = [
    SCHEMA,
    VERSION,
    record.workspaceId,
    record.documentId,
    record.sourceIdentity,
    record.sourceRevision,
    record.sourceBytesHash,
    record.generation,
    record.token,
    record.checkpointBytesHash,
    record.checkpointBytes.byteLength,
  ];
  const hash = sha256.create();
  hash.update(new TextEncoder().encode(JSON.stringify(tuple)));
  hash.update(record.checkpointBytes);
  return hex(hash.digest());
}

function digest(bytes: Uint8Array): string {
  return hex(sha256(bytes));
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

function reference(record: RecoveryCheckpointRecordN044): RecoveryCheckpointReferenceN044 {
  return {generation: record.generation, token: record.token, recordHash: record.recordHash};
}

function sameRecord(left: RecoveryCheckpointRecordN044, right: RecoveryCheckpointRecordN044): boolean {
  return left.recordHash === right.recordHash
    && left.generation === right.generation
    && left.token === right.token
    && left.sourceBytesHash === right.sourceBytesHash
    && left.checkpointBytesHash === right.checkpointBytesHash;
}

async function safeRead(host: RecoveryCheckpointHostPortN044, scope: RecoveryCheckpointScopeN044): Promise<Readonly<{kind: 'ok'; value: RecoveryCheckpointReadN044}> | Readonly<{kind: 'threw'}>> {
  try {
    const value = await host.read(scope);
    if (!validRead(value)) return {kind: 'threw'};
    return {kind: 'ok', value};
  } catch {
    return {kind: 'threw'};
  }
}

function validRead(value: unknown): value is RecoveryCheckpointReadN044 {
  if (!value || typeof value !== 'object' || typeof (value as {status?: unknown}).status !== 'string') return false;
  const read = value as RecoveryCheckpointReadN044;
  if (read.status === 'absent') return Object.keys(read).length === 1;
  if (read.status === 'found') return Object.hasOwn(read, 'record');
  return read.status === 'unavailable' && (read.code === 'permission-denied' || read.code === 'io-failure');
}

function validMutation(value: unknown): value is RecoveryCheckpointMutationN044 {
  if (!value || typeof value !== 'object') return false;
  const mutation = value as RecoveryCheckpointMutationN044;
  const keys = Object.keys(value).sort();
  if (mutation.status === 'committed') return keys.length === 1 && keys[0] === 'status';
  if (mutation.status === 'state-uncertain') return keys.length === 2 && keys[0] === 'code' && keys[1] === 'status'
    && (mutation.code === 'partial-write' || mutation.code === 'commit-status-unknown');
  return mutation.status === 'not-committed' && keys.length === 2 && keys[0] === 'code' && keys[1] === 'status'
    && ['cas-conflict', 'disk-full', 'permission-denied', 'serialization-failed', 'partial-write-rolled-back'].includes(mutation.code);
}

function notWritten(code: SafeFailureCode): WriteRecoveryCheckpointResultN044 {
  return {status: 'not-written', code, originalUnchanged: true, previousCheckpointPreserved: true};
}

function retained(code: Extract<DiscardRecoveryCheckpointResultN044, {status: 'retained'}>['code']): DiscardRecoveryCheckpointResultN044 {
  return {status: 'retained', code, checkpointPreserved: true};
}

function uncertain(code: Extract<WriteRecoveryCheckpointResultN044, {status: 'state-uncertain'}>['code']): Extract<WriteRecoveryCheckpointResultN044, {status: 'state-uncertain'}> {
  return {status: 'state-uncertain', code, requiresRecoveryRescan: true};
}

function classificationCode(kind: Exclude<ClassifiedRecord['kind'], 'valid'>): 'checkpoint-corrupt' | 'checkpoint-future-version' | 'checkpoint-foreign' {
  if (kind === 'future') return 'checkpoint-future-version';
  if (kind === 'foreign') return 'checkpoint-foreign';
  return 'checkpoint-corrupt';
}
