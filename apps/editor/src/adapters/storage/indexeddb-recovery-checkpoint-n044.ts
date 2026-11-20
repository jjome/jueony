import type {
  RecoveryCheckpointHostPortN044,
  RecoveryCheckpointMutationN044,
  RecoveryCheckpointReadN044,
  RecoveryCheckpointRecordN044,
  RecoveryCheckpointReferenceN044,
  RecoveryCheckpointScopeN044,
} from './recovery-checkpoint-transaction-n044.ts';

const DATABASE = 'jueony-recovery-checkpoint-n044-v1';
const DATABASE_VERSION = 1;
const STORE = 'checkpoints';
const SCHEMA = 'jueony.recovery-checkpoint';
const SAFE_ID = /^[\p{L}\p{N}._:@+-]{1,256}$/u;
const HEX_256 = /^[0-9a-f]{64}$/u;
const TOKEN = /^[A-Za-z0-9_-]{16,256}$/u;

type OpenedDatabase = Readonly<{
  db: IDBDatabase;
  versionChanged(): boolean;
}>;

type OpenResult =
  | Readonly<{status: 'opened'; value: OpenedDatabase}>
  | Readonly<{status: 'not-opened'; code: 'permission-denied' | 'io-failure'}>;

function validScope(scope: RecoveryCheckpointScopeN044): boolean {
  return Boolean(scope && SAFE_ID.test(scope.workspaceId) && SAFE_ID.test(scope.documentId));
}

function scopeKey(scope: RecoveryCheckpointScopeN044): string {
  return JSON.stringify([scope.workspaceId, scope.documentId]);
}

function safeOpaque(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 512 && !/[\u0000-\u001f\u007f]/u.test(value);
}

function validRecordShape(value: unknown, scope: RecoveryCheckpointScopeN044): value is RecoveryCheckpointRecordN044 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Partial<RecoveryCheckpointRecordN044>;
  return record.schema === SCHEMA
    && record.version === 1
    && record.workspaceId === scope.workspaceId
    && record.documentId === scope.documentId
    && safeOpaque(record.sourceIdentity)
    && safeOpaque(record.sourceRevision)
    && typeof record.sourceBytesHash === 'string'
    && HEX_256.test(record.sourceBytesHash)
    && Number.isSafeInteger(record.generation)
    && Number(record.generation) >= 1
    && typeof record.token === 'string'
    && TOKEN.test(record.token)
    && record.checkpointBytes instanceof Uint8Array
    && record.checkpointBytes.byteLength > 0
    && typeof record.checkpointBytesHash === 'string'
    && HEX_256.test(record.checkpointBytesHash)
    && typeof record.recordHash === 'string'
    && HEX_256.test(record.recordHash);
}

function validReference(value: RecoveryCheckpointReferenceN044): boolean {
  return Boolean(value
    && Number.isSafeInteger(value.generation)
    && value.generation >= 1
    && TOKEN.test(value.token)
    && HEX_256.test(value.recordHash));
}

function currentMatches(
  current: unknown,
  expected: RecoveryCheckpointReferenceN044 | null,
  scope: RecoveryCheckpointScopeN044,
): boolean {
  if (expected === null) return current === undefined;
  if (!validReference(expected) || !validRecordShape(current, scope)) return false;
  return current.generation === expected.generation
    && current.token === expected.token
    && current.recordHash === expected.recordHash;
}

function openFailureCode(error: unknown): 'permission-denied' | 'io-failure' {
  const name = error instanceof DOMException || error instanceof Error ? error.name : '';
  return ['SecurityError', 'NotAllowedError', 'InvalidStateError'].includes(name) ? 'permission-denied' : 'io-failure';
}

function mutationFailureCode(error: unknown, mutationRequested: boolean): Extract<RecoveryCheckpointMutationN044, {status: 'not-committed'}>['code'] {
  const name = error instanceof DOMException || error instanceof Error ? error.name : '';
  if (name === 'QuotaExceededError') return 'disk-full';
  if (['SecurityError', 'NotAllowedError', 'ReadOnlyError', 'InvalidStateError'].includes(name)) return 'permission-denied';
  if (['DataCloneError', 'DataError', 'ConstraintError'].includes(name)) return 'serialization-failed';
  return mutationRequested ? 'partial-write-rolled-back' : 'serialization-failed';
}

function notCommitted(code: Extract<RecoveryCheckpointMutationN044, {status: 'not-committed'}>['code']): RecoveryCheckpointMutationN044 {
  return Object.freeze({status: 'not-committed', code});
}

function uncertain(): RecoveryCheckpointMutationN044 {
  return Object.freeze({status: 'state-uncertain', code: 'commit-status-unknown'});
}

function openDatabase(factory: IDBFactory): Promise<OpenResult> {
  return new Promise(resolve => {
    let request: IDBOpenDBRequest;
    try { request = factory.open(DATABASE, DATABASE_VERSION); }
    catch (error) { resolve({status: 'not-opened', code: openFailureCode(error)}); return; }
    let settled = false;
    const finish = (result: OpenResult) => {
      if (settled) {
        if (result.status === 'opened') result.value.db.close();
        return;
      }
      settled = true;
      resolve(result);
    };
    request.onupgradeneeded = () => {
      try { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE); }
      catch { try { request.transaction?.abort(); } catch { /* no durable write was started */ } }
    };
    request.onblocked = () => finish({status: 'not-opened', code: 'permission-denied'});
    request.onerror = () => finish({status: 'not-opened', code: openFailureCode(request.error)});
    request.onsuccess = () => {
      const db = request.result;
      let changed = false;
      db.onversionchange = () => { changed = true; db.close(); };
      finish({status: 'opened', value: Object.freeze({db, versionChanged: () => changed})});
    };
  });
}

async function readRecord(factory: IDBFactory, scope: RecoveryCheckpointScopeN044): Promise<RecoveryCheckpointReadN044> {
  if (!validScope(scope)) return {status: 'unavailable', code: 'io-failure'};
  const opened = await openDatabase(factory);
  if (opened.status !== 'opened') return {status: 'unavailable', code: opened.code};
  const {db, versionChanged} = opened.value;
  return new Promise(resolve => {
    let transaction: IDBTransaction;
    try { transaction = db.transaction(STORE, 'readonly'); }
    catch (error) { db.close(); resolve({status: 'unavailable', code: openFailureCode(error)}); return; }
    let value: unknown;
    let requestFailed = false;
    const request = transaction.objectStore(STORE).get(scopeKey(scope));
    request.onsuccess = () => { value = request.result; };
    request.onerror = () => { requestFailed = true; };
    transaction.oncomplete = () => {
      db.close();
      if (requestFailed || versionChanged()) resolve({status: 'unavailable', code: 'io-failure'});
      else resolve(value === undefined ? {status: 'absent'} : {status: 'found', record: value});
    };
    transaction.onerror = () => { requestFailed = true; };
    transaction.onabort = () => { db.close(); resolve({status: 'unavailable', code: openFailureCode(transaction.error)}); };
  });
}

async function mutate(
  factory: IDBFactory,
  scope: RecoveryCheckpointScopeN044,
  expected: RecoveryCheckpointReferenceN044 | null,
  next: RecoveryCheckpointRecordN044 | null,
): Promise<RecoveryCheckpointMutationN044> {
  if (!validScope(scope) || expected !== null && !validReference(expected) || next !== null && !validRecordShape(next, scope)) {
    return notCommitted('serialization-failed');
  }
  const opened = await openDatabase(factory);
  if (opened.status !== 'opened') return notCommitted(opened.code === 'permission-denied' ? 'permission-denied' : 'serialization-failed');
  const {db, versionChanged} = opened.value;

  return new Promise(resolve => {
    let transaction: IDBTransaction;
    try { transaction = db.transaction(STORE, 'readwrite', {durability: 'strict'}); }
    catch (error) { db.close(); resolve(notCommitted(mutationFailureCode(error, false))); return; }
    const store = transaction.objectStore(STORE);
    let settled = false;
    let conflict = false;
    let mutationRequested = false;
    let failure: unknown;
    const finish = (result: RecoveryCheckpointMutationN044) => {
      if (settled) return;
      settled = true;
      db.close();
      resolve(result);
    };
    const abort = () => {
      try { transaction.abort(); }
      catch { finish(uncertain()); }
    };
    let read: IDBRequest;
    try { read = store.get(scopeKey(scope)); }
    catch (error) { failure = error; abort(); return; }
    read.onerror = () => { failure = read.error; };
    read.onsuccess = () => {
      if (!currentMatches(read.result, expected, scope)) {
        conflict = true;
        abort();
        return;
      }
      try {
        const write = next === null ? store.delete(scopeKey(scope)) : store.put(next, scopeKey(scope));
        mutationRequested = true;
        write.onerror = () => { failure = write.error; };
      } catch (error) {
        failure = error;
        abort();
      }
    };
    transaction.oncomplete = () => {
      if (versionChanged()) finish(uncertain());
      else finish(Object.freeze({status: 'committed'}));
    };
    transaction.onerror = () => { failure = transaction.error ?? failure; };
    transaction.onabort = () => {
      if (conflict) finish(notCommitted('cas-conflict'));
      else finish(notCommitted(mutationFailureCode(transaction.error ?? failure, mutationRequested)));
    };
  });
}

/**
 * IndexedDB implementation of the N044 CAS port. It opens no fallback store,
 * returns committed only from `transaction.oncomplete`, and never serializes
 * host errors, tokens, paths or checkpoint bytes into failure results.
 */
export function createIndexedDbRecoveryCheckpointHostN044(factory: IDBFactory): RecoveryCheckpointHostPortN044 {
  return Object.freeze({
    read: (scope: RecoveryCheckpointScopeN044) => readRecord(factory, scope),
    compareAndSwap: (input: Parameters<RecoveryCheckpointHostPortN044['compareAndSwap']>[0]) => mutate(factory, input.scope, input.expected, input.next),
    compareAndDelete: (input: Parameters<RecoveryCheckpointHostPortN044['compareAndDelete']>[0]) => mutate(factory, input.scope, input.expected, null),
  });
}
