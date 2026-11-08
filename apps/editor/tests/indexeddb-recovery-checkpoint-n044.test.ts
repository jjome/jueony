import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createIndexedDbRecoveryCheckpointHostN044} from '../src/adapters/storage/indexeddb-recovery-checkpoint-n044.ts';
import {
  createRecoveryCheckpointTransactionCoordinatorN044,
  type RecoveryCheckpointHostPortN044,
  type RecoveryCheckpointRecordN044,
  type RecoveryCheckpointScopeN044,
  type WriteRecoveryCheckpointRequestN044,
} from '../src/adapters/storage/recovery-checkpoint-transaction-n044.ts';

type StoreState = {values: Map<string, unknown>};
type DatabaseState = {stores: Map<string, StoreState>; tail: Promise<void>};

class FakeTransaction {
  oncomplete: (() => void) | null = null;
  onabort: (() => void) | null = null;
  onerror: (() => void) | null = null;
  error: DOMException | null = null;
  private pending = 0;
  private aborted = false;
  private completed = false;
  private mutated = false;
  private staged: Map<string, unknown> | undefined;
  private readonly start: Promise<void>;
  private readonly release: () => void;
  private readonly owner: FakeIndexedDB;
  private readonly db: FakeDatabase;
  private readonly state: DatabaseState;
  private readonly storeName: string;
  private readonly mode: IDBTransactionMode;

  constructor(
    owner: FakeIndexedDB,
    db: FakeDatabase,
    state: DatabaseState,
    storeName: string,
    mode: IDBTransactionMode,
  ) {
    this.owner = owner;
    this.db = db;
    this.state = state;
    this.storeName = storeName;
    this.mode = mode;
    let release!: () => void;
    const done = new Promise<void>(resolve => { release = resolve; });
    this.start = state.tail;
    state.tail = state.tail.then(() => done);
    this.release = release;
  }

  objectStore(name: string) {
    if (name !== this.storeName) throw new DOMException('missing store', 'NotFoundError');
    return {
      get: (key: string) => this.request('get', key),
      put: (value: unknown, key: string) => this.request('put', key, value),
      delete: (key: string) => this.request('delete', key),
    } as unknown as IDBObjectStore;
  }

  abort() {
    if (this.completed || this.aborted) throw new DOMException('inactive', 'InvalidStateError');
    this.aborted = true;
    this.error = new DOMException('aborted', 'AbortError');
    queueMicrotask(() => { this.release(); this.onabort?.(); });
  }

  private request(kind: 'get' | 'put' | 'delete', key: string, value?: unknown): IDBRequest {
    if (this.completed || this.aborted) throw new DOMException('inactive', 'TransactionInactiveError');
    if (kind !== 'get' && this.mode !== 'readwrite') throw new DOMException('readonly', 'ReadOnlyError');
    const request: any = {result: undefined, error: null, onsuccess: null, onerror: null};
    this.pending += 1;
    queueMicrotask(async () => {
      await this.start;
      if (this.aborted || this.completed) return;
      const base = this.state.stores.get(this.storeName)?.values;
      if (!base) { request.error = new DOMException('missing store', 'NotFoundError'); request.onerror?.(); this.error = request.error; this.onerror?.(); this.abort(); return; }
      this.staged ??= new Map([...base].map(([storedKey, storedValue]) => [storedKey, structuredClone(storedValue)]));
      if (kind === 'get') request.result = this.staged.has(key) ? structuredClone(this.staged.get(key)) : undefined;
      else if (kind === 'put') { this.staged.set(key, structuredClone(value)); this.mutated = true; request.result = key; }
      else { this.staged.delete(key); this.mutated = true; request.result = undefined; }
      request.onsuccess?.();
      this.pending -= 1;
      queueMicrotask(() => this.finishIfIdle());
    });
    return request as IDBRequest;
  }

  private finishIfIdle() {
    if (this.pending !== 0 || this.aborted || this.completed) return;
    if (this.mutated && this.owner.abortNextMutation) {
      this.owner.abortNextMutation = false;
      this.abort();
      return;
    }
    if (this.mutated && this.owner.versionChangeAbortNextMutation) {
      this.owner.versionChangeAbortNextMutation = false;
      this.db.onversionchange?.(new Event('versionchange') as IDBVersionChangeEvent);
      this.abort();
      return;
    }
    if (this.mutated && this.owner.versionChangeCommitNextMutation) {
      this.owner.versionChangeCommitNextMutation = false;
      this.db.onversionchange?.(new Event('versionchange') as IDBVersionChangeEvent);
    }
    if (this.mode === 'readwrite' && this.staged) this.state.stores.get(this.storeName)!.values = this.staged;
    this.completed = true;
    this.release();
    this.oncomplete?.();
  }
}

class FakeDatabase {
  onversionchange: ((event: IDBVersionChangeEvent) => unknown) | null = null;
  readonly objectStoreNames: DOMStringList;
  private readonly owner: FakeIndexedDB;
  readonly state: DatabaseState;
  constructor(owner: FakeIndexedDB, state: DatabaseState) {
    this.owner = owner;
    this.state = state;
    this.objectStoreNames = {contains: (name: string) => state.stores.has(name)} as DOMStringList;
  }
  createObjectStore(name: string) {
    this.state.stores.set(name, {values: new Map()});
    return {} as IDBObjectStore;
  }
  transaction(name: string, mode: IDBTransactionMode, options?: IDBTransactionOptions) {
    this.owner.durabilities.push(options?.durability ?? 'default');
    if (!this.state.stores.has(name)) throw new DOMException('missing store', 'NotFoundError');
    return new FakeTransaction(this.owner, this, this.state, name, mode) as unknown as IDBTransaction;
  }
  close() {}
}

class FakeIndexedDB {
  private readonly databases = new Map<string, DatabaseState>();
  blockNextOpen = false;
  abortNextMutation = false;
  versionChangeAbortNextMutation = false;
  versionChangeCommitNextMutation = false;
  durabilities: IDBTransactionDurability[] = [];

  readonly factory = {open: (name: string, _version?: number) => {
    const request: any = {result: undefined, error: null, transaction: null, onupgradeneeded: null, onblocked: null, onerror: null, onsuccess: null};
    queueMicrotask(() => {
      if (this.blockNextOpen) { this.blockNextOpen = false; request.onblocked?.(); return; }
      let state = this.databases.get(name), upgrade = false;
      if (!state) { state = {stores: new Map(), tail: Promise.resolve()}; this.databases.set(name, state); upgrade = true; }
      request.result = new FakeDatabase(this, state);
      if (upgrade) request.onupgradeneeded?.();
      queueMicrotask(() => request.onsuccess?.());
    });
    return request as IDBOpenDBRequest;
  }} as IDBFactory;

  replaceOnlyValue(value: unknown) {
    const state = [...this.databases.values()][0];
    const store = state && [...state.stores.values()][0];
    const key = store && [...store.values.keys()][0];
    if (!store || key === undefined) throw new Error('no stored value');
    store.values.set(key, structuredClone(value));
  }

  onlyValue(): unknown {
    const state = [...this.databases.values()][0];
    const store = state && [...state.stores.values()][0];
    return store && structuredClone([...store.values.values()][0]);
  }
}

const scope: RecoveryCheckpointScopeN044 = {workspaceId: 'work-1', documentId: 'doc-1'};
const token1 = 'token_000000000001';
const token2 = 'token_000000000002';
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

function request(currentScope = scope, generation = 1, token = token1): WriteRecoveryCheckpointRequestN044 {
  const source = new Uint8Array([1, 2, 3]);
  return {
    scope: currentScope,
    source: {identity: 'document-identity', revision: `revision-${generation}`, bytes: source, bytesHash: sha(source)},
    checkpoint: {generation, token, bytes: new Uint8Array([9, generation, 7])},
  };
}

async function generatedRecord(currentScope = scope, generation = 1, token = token1): Promise<RecoveryCheckpointRecordN044> {
  let captured: RecoveryCheckpointRecordN044 | undefined;
  const capture: RecoveryCheckpointHostPortN044 = {
    read: async () => ({status: 'absent'}),
    compareAndSwap: async input => { captured = structuredClone(input.next); return {status: 'not-committed', code: 'cas-conflict'}; },
    compareAndDelete: async () => ({status: 'not-committed', code: 'cas-conflict'}),
  };
  await createRecoveryCheckpointTransactionCoordinatorN044(capture).writeCheckpoint(request(currentScope, generation, token));
  if (!captured) throw new Error('record capture failed');
  return captured;
}

test('IndexedDB host commits only after strict transaction completion and supports exact readback', async () => {
  const fake = new FakeIndexedDB(), host = createIndexedDbRecoveryCheckpointHostN044(fake.factory);
  const result = await createRecoveryCheckpointTransactionCoordinatorN044(host).writeCheckpoint(request());
  assert.deepEqual(result, {status: 'checkpointed', generation: 1});
  const read = await host.read(scope);
  assert.equal(read.status, 'found');
  assert.ok(fake.durabilities.includes('strict'));
});

test('concurrent compare-and-swap allows one writer and returns an exact CAS conflict for the other', async () => {
  const fake = new FakeIndexedDB(), host = createIndexedDbRecoveryCheckpointHostN044(fake.factory);
  const [first, second] = await Promise.all([
    host.compareAndSwap({scope, expected: null, next: await generatedRecord(scope, 1, token1)}),
    host.compareAndSwap({scope, expected: null, next: await generatedRecord(scope, 1, token2)}),
  ]);
  assert.deepEqual(new Set([first.status, second.status]), new Set(['committed', 'not-committed']));
  const conflict = [first, second].find(value => value.status === 'not-committed');
  assert.deepEqual(conflict, {status: 'not-committed', code: 'cas-conflict'});
  assert.equal((await host.read(scope)).status, 'found');
});

test('corrupt, future and foreign records are preserved even when reference fields are copied', async () => {
  const valid = await generatedRecord(), expected = {generation: valid.generation, token: valid.token, recordHash: valid.recordHash};
  const variants = [
    {...valid, checkpointBytes: new Uint8Array()},
    {...valid, version: 2},
    {...valid, workspaceId: 'other-workspace'},
  ];
  for (const variant of variants) {
    const fake = new FakeIndexedDB(), host = createIndexedDbRecoveryCheckpointHostN044(fake.factory);
    assert.equal((await host.compareAndSwap({scope, expected: null, next: valid})).status, 'committed');
    fake.replaceOnlyValue(variant);
    const before = fake.onlyValue();
    const result = await host.compareAndSwap({scope, expected, next: {...valid, generation: 2, token: token2}});
    assert.deepEqual(result, {status: 'not-committed', code: 'cas-conflict'});
    assert.deepEqual(fake.onlyValue(), before);
  }
});

test('compare-and-delete removes only the exact generation, token and record hash', async () => {
  const fake = new FakeIndexedDB(), host = createIndexedDbRecoveryCheckpointHostN044(fake.factory), record = await generatedRecord();
  assert.equal((await host.compareAndSwap({scope, expected: null, next: record})).status, 'committed');
  const wrong = await host.compareAndDelete({scope, expected: {generation: 1, token: token2, recordHash: record.recordHash}});
  assert.deepEqual(wrong, {status: 'not-committed', code: 'cas-conflict'});
  assert.equal((await host.read(scope)).status, 'found');
  const deleted = await host.compareAndDelete({scope, expected: {generation: 1, token: token1, recordHash: record.recordHash}});
  assert.deepEqual(deleted, {status: 'committed'});
  assert.deepEqual(await host.read(scope), {status: 'absent'});
});

test('blocked open and transaction abort prove not-committed without exposing host details', async () => {
  const fake = new FakeIndexedDB(), host = createIndexedDbRecoveryCheckpointHostN044(fake.factory), record = await generatedRecord();
  fake.blockNextOpen = true;
  const blocked = await host.compareAndSwap({scope, expected: null, next: record});
  assert.deepEqual(blocked, {status: 'not-committed', code: 'permission-denied'});
  fake.abortNextMutation = true;
  const aborted = await host.compareAndSwap({scope, expected: null, next: record});
  assert.deepEqual(aborted, {status: 'not-committed', code: 'partial-write-rolled-back'});
  assert.deepEqual(await host.read(scope), {status: 'absent'});
  assert.doesNotMatch(JSON.stringify([blocked, aborted]), /token_|9,1,7|document-identity/u);
});

test('versionchange abort is not-committed, while commit with unverifiable version state is uncertain', async () => {
  const fake = new FakeIndexedDB(), host = createIndexedDbRecoveryCheckpointHostN044(fake.factory), record = await generatedRecord();
  fake.versionChangeAbortNextMutation = true;
  const rolledBack = await host.compareAndSwap({scope, expected: null, next: record});
  assert.deepEqual(rolledBack, {status: 'not-committed', code: 'partial-write-rolled-back'});
  assert.deepEqual(await host.read(scope), {status: 'absent'});

  fake.versionChangeCommitNextMutation = true;
  const uncertain = await host.compareAndSwap({scope, expected: null, next: record});
  assert.deepEqual(uncertain, {status: 'state-uncertain', code: 'commit-status-unknown'});
  assert.equal((await host.read(scope)).status, 'found');
});
