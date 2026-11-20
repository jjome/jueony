import {sha256} from '@noble/hashes/sha2.js';
import {createIndexedDbRecoveryCheckpointHostN044} from '../../src/adapters/storage/indexeddb-recovery-checkpoint-n044.ts';
import {createIndexedDbRecoveryCheckpointLifecycleN044} from '../../src/composition/recovery-checkpoint-lifecycle-n044.ts';
import type {RecoveryCheckpointRecordN044} from '../../src/adapters/storage/recovery-checkpoint-transaction-n044.ts';

const DATABASE = 'jueony-recovery-checkpoint-n044-v1';
const STORE = 'checkpoints';
const scope = Object.freeze({workspaceId: 'browser-n044', documentId: 'synthetic-document'});
const lease = 'browser_lease_00000001';
const sourceBytes = new Uint8Array([0x4a, 0x55, 0x45, 0x4f, 0x4e, 0x59]);
const source = Object.freeze({
  identity: 'synthetic-source-n044',
  revision: 'revision-1',
  bytes: sourceBytes,
  bytesHash: hex(sha256(sourceBytes)),
});
const expectedSource = Object.freeze({
  identity: source.identity,
  revision: source.revision,
  bytesHash: source.bytesHash,
});

type BrowserResult = Readonly<{
  status: 'passed' | 'failed';
  browser: string;
  results: readonly Readonly<{name: string; detail: Readonly<Record<string, unknown>>}>[];
  error?: string;
}>;

declare global {
  interface Window { __n044BrowserVerification?: BrowserResult; }
}

const results: Array<{name: string; detail: Readonly<Record<string, unknown>>}> = [];
const status = document.getElementById('status');

void run().then(() => {
  window.__n044BrowserVerification = Object.freeze({
    status: 'passed',
    browser: navigator.userAgent,
    results: Object.freeze(results.slice()),
  });
  if (status) status.textContent = 'passed';
}).catch((error: unknown) => {
  const message = safeError(error);
  window.__n044BrowserVerification = Object.freeze({
    status: 'failed',
    browser: navigator.userAgent,
    results: Object.freeze(results.slice()),
    error: message,
  });
  if (status) status.textContent = 'failed';
  throw error;
});

async function run(): Promise<void> {
  await deleteDatabase();
  try {
    await verifyCommitCasAndStrictCompletion();
    await verifyBlockedOpenClassification();
    await verifyNativeVersionchangeClassification();
  } finally {
    await deleteDatabase();
  }
}

async function verifyCommitCasAndStrictCompletion(): Promise<void> {
  await deleteDatabase();
  const trace = installTransactionTrace();
  try {
    const lifecycle = createIndexedDbRecoveryCheckpointLifecycleN044(indexedDB, {
      nextCheckpointToken: () => 'browser_checkpoint_000001',
    });
    equal(lifecycle.onDocumentOpen({lease, scope, source}), {status: 'opened'}, 'document open');
    const checkpoint = await lifecycle.onPeriodicCheckpoint({
      lease,
      expectedSource,
      checkpointBytes: new Uint8Array([9, 8, 7, 6]),
    });
    trace.markResolved();
    equal(checkpoint, {status: 'checkpointed', generation: 1}, 'checkpoint commit');

    const strictWrite = trace.entries.find(entry => entry.mode === 'readwrite');
    invariant(strictWrite?.durability === 'strict', 'readwrite transaction must request strict durability');
    invariant(typeof strictWrite.completeSequence === 'number', 'readwrite transaction must complete');
    invariant(strictWrite.completeSequence < trace.resolvedSequence, 'lifecycle must resolve only after transaction complete');

    const host = createIndexedDbRecoveryCheckpointHostN044(indexedDB);
    const read = await host.read(scope);
    invariant(read.status === 'found', 'committed record must be readable');
    const record = read.record as RecoveryCheckpointRecordN044;
    invariant(record.sourceIdentity === source.identity, 'source identity must survive IndexedDB clone');
    invariant(record.sourceRevision === source.revision, 'source revision must survive IndexedDB clone');
    invariant(record.sourceBytesHash === source.bytesHash, 'source hash must survive IndexedDB clone');
    invariant(record.generation === 1 && record.token === 'browser_checkpoint_000001', 'exact generation/token must survive commit');

    const conflict = await host.compareAndSwap({scope, expected: null, next: record});
    equal(conflict, {status: 'not-committed', code: 'cas-conflict'}, 'stale CAS');
    invariant(conflict.status === 'not-committed', 'stale CAS must be classified not-committed');
    const afterConflict = await host.read(scope);
    invariant(afterConflict.status === 'found', 'CAS conflict must preserve the committed record');
    invariant((afterConflict.record as RecoveryCheckpointRecordN044).recordHash === record.recordHash, 'CAS conflict must preserve exact record hash');

    pass('commit, strict transaction completion, and CAS conflict', {
      generation: record.generation,
      strictDurability: strictWrite.durability,
      completeBeforeResolve: true,
      conflict: conflict.code,
    });
  } finally {
    trace.restore();
  }
}

async function verifyBlockedOpenClassification(): Promise<void> {
  await deleteDatabase();
  const blocker = await openRawDatabase(1);
  blocker.onversionchange = () => { /* keep the old connection open deliberately */ };
  const upgradeRequests: IDBOpenDBRequest[] = [];
  const upgradeFactory = Object.freeze({
    open(name: string, version?: number): IDBOpenDBRequest {
      const request = indexedDB.open(name, (version ?? 1) + 1);
      upgradeRequests.push(request);
      return request;
    },
  }) as unknown as IDBFactory;
  try {
    const host = createIndexedDbRecoveryCheckpointHostN044(upgradeFactory);
    const blocked = await host.read(scope);
    equal(blocked, {status: 'unavailable', code: 'permission-denied'}, 'blocked database open');
    invariant(blocked.status === 'unavailable', 'blocked open must be classified unavailable');
    pass('native blocked open is classified fail-closed', {status: blocked.status, code: blocked.code});
  } finally {
    blocker.close();
    for (const request of upgradeRequests) {
      request.addEventListener('success', () => request.result.close(), {once: true});
    }
    await delay(50);
  }
}

async function verifyNativeVersionchangeClassification(): Promise<void> {
  await deleteDatabase();
  const original = IDBDatabase.prototype.transaction;
  let upgrade: IDBOpenDBRequest | null = null;
  let upgradeTriggered = false;
  IDBDatabase.prototype.transaction = function transactionWithNativeUpgrade(
    storeNames: string | Iterable<string>,
    mode?: IDBTransactionMode,
    options?: IDBTransactionOptions,
  ): IDBTransaction {
    const transaction = original.call(this, storeNames, mode, options);
    if (!upgradeTriggered && this.name === DATABASE && mode === 'readwrite') {
      upgradeTriggered = true;
      upgrade = indexedDB.open(DATABASE, 2);
      upgrade.addEventListener('upgradeneeded', () => {
        if (!upgrade?.result.objectStoreNames.contains(STORE)) upgrade?.result.createObjectStore(STORE);
      });
      upgrade.addEventListener('success', () => upgrade?.result.close(), {once: true});
    }
    return transaction;
  };
  try {
    const lifecycle = createIndexedDbRecoveryCheckpointLifecycleN044(indexedDB, {
      nextCheckpointToken: () => 'browser_checkpoint_000002',
    });
    equal(lifecycle.onDocumentOpen({lease, scope, source}), {status: 'opened'}, 'versionchange document open');
    const checkpoint = await lifecycle.onPeriodicCheckpoint({
      lease,
      expectedSource,
      checkpointBytes: new Uint8Array(8 * 1024 * 1024).fill(0x5a),
    });
    invariant(upgradeTriggered, 'native version upgrade must be requested during readwrite transaction');
    equal(checkpoint, {status: 'state-uncertain', operation: 'checkpoint', requiresRecoveryRescan: true}, 'native versionchange result');
    invariant(lifecycle.snapshot().phase === 'blocked', 'versionchange uncertainty must block lifecycle');
    pass('native versionchange during transaction is classified state-uncertain', {
      result: checkpoint.status,
      lifecyclePhase: lifecycle.snapshot().phase,
      requiresRecoveryRescan: checkpoint.status === 'state-uncertain' && checkpoint.requiresRecoveryRescan,
    });
  } finally {
    IDBDatabase.prototype.transaction = original;
    if (upgrade) {
      const pending = upgrade as IDBOpenDBRequest;
      pending.addEventListener('success', () => pending.result.close(), {once: true});
    }
    await delay(50);
  }
}

function installTransactionTrace(): Readonly<{
  entries: Array<{mode: IDBTransactionMode; durability: IDBTransactionDurability | 'default'; completeSequence: number | null}>;
  readonly resolvedSequence: number;
  markResolved(): void;
  restore(): void;
}> {
  const original = IDBDatabase.prototype.transaction;
  const entries: Array<{mode: IDBTransactionMode; durability: IDBTransactionDurability | 'default'; completeSequence: number | null}> = [];
  let sequence = 0;
  let resolvedSequence = Number.POSITIVE_INFINITY;
  IDBDatabase.prototype.transaction = function tracedTransaction(
    storeNames: string | Iterable<string>,
    mode: IDBTransactionMode = 'readonly',
    options?: IDBTransactionOptions,
  ): IDBTransaction {
    const transaction = original.call(this, storeNames, mode, options);
    if (this.name === DATABASE) {
      const entry = {mode, durability: options?.durability ?? 'default', completeSequence: null as number | null};
      entries.push(entry);
      transaction.addEventListener('complete', () => { entry.completeSequence = ++sequence; }, {once: true});
    }
    return transaction;
  };
  return Object.freeze({
    entries,
    get resolvedSequence() { return resolvedSequence; },
    markResolved() { resolvedSequence = ++sequence; },
    restore() { IDBDatabase.prototype.transaction = original; },
  });
}

function openRawDatabase(version: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, version);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onerror = () => reject(request.error ?? new Error('raw IndexedDB open failed'));
    request.onsuccess = () => resolve(request.result);
  });
}

function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB delete failed'));
    request.onblocked = () => reject(new Error('IndexedDB cleanup was blocked'));
    request.onsuccess = () => resolve();
  });
}

function equal(actual: unknown, expected: unknown, label: string): void {
  const left = JSON.stringify(actual);
  const right = JSON.stringify(expected);
  if (left !== right) throw new Error(`${label}: expected ${right}, received ${left}`);
}

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function pass(name: string, detail: Readonly<Record<string, unknown>>): void {
  results.push(Object.freeze({name, detail: Object.freeze({...detail})}));
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
}

function delay(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function safeError(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return text.replace(/[\r\n\u0000-\u001f\u007f]/gu, ' ').slice(0, 500);
}
