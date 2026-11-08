import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {
  createRecoveryCheckpointTransactionCoordinatorN044,
  type RecoveryCheckpointHostPortN044,
  type RecoveryCheckpointMutationN044,
  type RecoveryCheckpointReadN044,
  type RecoveryCheckpointRecordN044,
  type RecoveryCheckpointScopeN044,
  type WriteRecoveryCheckpointRequestN044,
} from '../src/adapters/storage/recovery-checkpoint-transaction-n044.ts';

const scope: RecoveryCheckpointScopeN044 = {workspaceId: 'work-1', documentId: 'doc-1'};
const token1 = 'token_000000000001';
const token2 = 'token_000000000002';
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

function request(generation = 1, token = token1): WriteRecoveryCheckpointRequestN044 {
  const sourceBytes = new Uint8Array([1, 2, 3, 4]);
  return {
    scope,
    source: {identity: 'opaque-document-identity', revision: `revision-${generation}`, bytes: sourceBytes, bytesHash: sha(sourceBytes)},
    checkpoint: {generation, token, bytes: new Uint8Array([9, generation, 7])},
  };
}

class MemoryPort implements RecoveryCheckpointHostPortN044 {
  record: unknown = null;
  calls: string[] = [];
  swapResult: RecoveryCheckpointMutationN044 = {status: 'committed'};
  deleteResult: RecoveryCheckpointMutationN044 = {status: 'committed'};
  queuedReads: RecoveryCheckpointReadN044[] = [];
  throwSwap = false;
  throwDelete = false;
  lastSwap: Parameters<RecoveryCheckpointHostPortN044['compareAndSwap']>[0] | null = null;
  lastDelete: Parameters<RecoveryCheckpointHostPortN044['compareAndDelete']>[0] | null = null;

  async read(_scope: RecoveryCheckpointScopeN044): Promise<RecoveryCheckpointReadN044> {
    this.calls.push('read');
    if (this.queuedReads.length) return structuredClone(this.queuedReads.shift()!);
    return this.record === null ? {status: 'absent'} : {status: 'found', record: structuredClone(this.record)};
  }

  async compareAndSwap(input: Parameters<RecoveryCheckpointHostPortN044['compareAndSwap']>[0]): Promise<RecoveryCheckpointMutationN044> {
    this.calls.push('swap');
    this.lastSwap = structuredClone(input);
    if (this.throwSwap) throw new Error('host detail /secret/path');
    if (this.swapResult.status === 'committed') this.record = structuredClone(input.next);
    return this.swapResult;
  }

  async compareAndDelete(input: Parameters<RecoveryCheckpointHostPortN044['compareAndDelete']>[0]): Promise<RecoveryCheckpointMutationN044> {
    this.calls.push('delete');
    this.lastDelete = structuredClone(input);
    if (this.throwDelete) throw new Error('host detail /secret/path');
    if (this.deleteResult.status === 'committed') this.record = null;
    return this.deleteResult;
  }
}

async function savedRecord(port = new MemoryPort()): Promise<{port: MemoryPort; record: RecoveryCheckpointRecordN044}> {
  const result = await createRecoveryCheckpointTransactionCoordinatorN044(port).writeCheckpoint(request());
  assert.deepEqual(result, {status: 'checkpointed', generation: 1});
  return {port, record: structuredClone(port.record) as RecoveryCheckpointRecordN044};
}

test('writes generation one by CAS and verifies the exact readback without exposing bytes or token', async () => {
  const port = new MemoryPort();
  const result = await createRecoveryCheckpointTransactionCoordinatorN044(port).writeCheckpoint(request());
  assert.deepEqual(result, {status: 'checkpointed', generation: 1});
  assert.deepEqual(port.calls, ['read', 'swap', 'read']);
  assert.equal(port.lastSwap!.expected, null);
  assert.equal((port.record as RecoveryCheckpointRecordN044).checkpointBytesHash, sha(new Uint8Array([9, 1, 7])));
  assert.doesNotMatch(JSON.stringify(result), /token|opaque-document|9,1,7/);
});

test('advances an existing valid record using its exact generation, token, and record hash as CAS expectation', async () => {
  const {port, record} = await savedRecord();
  port.calls.length = 0;
  const result = await createRecoveryCheckpointTransactionCoordinatorN044(port).writeCheckpoint(request(2, token2));
  assert.deepEqual(result, {status: 'checkpointed', generation: 2});
  assert.deepEqual(port.lastSwap!.expected, {generation: 1, token: token1, recordHash: record.recordHash});
  assert.deepEqual(port.calls, ['read', 'swap', 'read']);
});

test('rejects invalid source evidence, generation, and reused token before mutating recovery storage', async () => {
  const port = new MemoryPort();
  const original = request();
  const badHash = {...original, source: {...original.source, bytesHash: '0'.repeat(64)}};
  const coordinator = createRecoveryCheckpointTransactionCoordinatorN044(port);
  assert.equal((await coordinator.writeCheckpoint(badHash)).status, 'not-written');
  assert.equal(port.calls.length, 0);
  assert.equal((await coordinator.writeCheckpoint(request(2))).status, 'not-written');
  assert.deepEqual(port.calls, ['read']);

  const saved = await savedRecord();
  saved.port.calls.length = 0;
  const reused = await createRecoveryCheckpointTransactionCoordinatorN044(saved.port).writeCheckpoint(request(2, token1));
  assert.deepEqual(reused, {status: 'not-written', code: 'token-reused', originalUnchanged: true, previousCheckpointPreserved: true});
  assert.deepEqual(saved.port.calls, ['read']);
});

test('explicit not-committed failure matrix proves both original and previous checkpoint were preserved', async () => {
  const codes = ['cas-conflict', 'disk-full', 'permission-denied', 'serialization-failed', 'partial-write-rolled-back'] as const;
  for (const code of codes) {
    const port = new MemoryPort();
    port.swapResult = {status: 'not-committed', code};
    const result = await createRecoveryCheckpointTransactionCoordinatorN044(port).writeCheckpoint(request());
    assert.deepEqual(result, {status: 'not-written', code, originalUnchanged: true, previousCheckpointPreserved: true});
    assert.equal(port.record, null);
    assert.deepEqual(port.calls, ['read', 'swap']);
  }
});

test('a thrown or explicitly uncertain CAS never claims checkpoint preservation', async () => {
  for (const setup of ['throw', 'partial'] as const) {
    const port = new MemoryPort();
    if (setup === 'throw') port.throwSwap = true;
    else port.swapResult = {status: 'state-uncertain', code: 'partial-write'};
    const result = await createRecoveryCheckpointTransactionCoordinatorN044(port).writeCheckpoint(request());
    assert.equal(result.status, 'state-uncertain');
    assert.equal(Object.hasOwn(result, 'previousCheckpointPreserved'), false);
    assert.equal(Object.hasOwn(result, 'originalUnchanged'), false);
  }
});

test('committed writes with unavailable, absent, corrupt, or mismatched readback are state-uncertain', async () => {
  const variants: RecoveryCheckpointReadN044[] = [
    {status: 'unavailable', code: 'io-failure'},
    {status: 'absent'},
    {status: 'found', record: {malformed: true}},
    {status: 'found', record: {...(await savedRecord()).record, generation: 99}},
  ];
  for (const readback of variants) {
    const port = new MemoryPort();
    port.queuedReads = [{status: 'absent'}, readback];
    const result = await createRecoveryCheckpointTransactionCoordinatorN044(port).writeCheckpoint(request());
    assert.equal(result.status, 'state-uncertain');
    assert.equal(Object.hasOwn(result, 'previousCheckpointPreserved'), false);
    assert.deepEqual(port.calls, ['read', 'swap', 'read']);
  }
});

test('malformed host mutation response is fail-closed as state-uncertain', async () => {
  const port = new MemoryPort();
  port.swapResult = {status: 'committed', extra: 'bad'} as never;
  const result = await createRecoveryCheckpointTransactionCoordinatorN044(port).writeCheckpoint(request());
  assert.deepEqual(result, {status: 'state-uncertain', code: 'host-protocol-failure', requiresRecoveryRescan: true});
});

test('corrupt, future-version, and foreign records are neither replaced nor deleted', async () => {
  const base = (await savedRecord()).record;
  const records = [
    {...base, checkpointBytes: new Uint8Array([0])},
    {...base, version: 2},
    {...base, workspaceId: 'other-workspace'},
  ];
  for (const record of records) {
    const port = new MemoryPort();
    port.record = structuredClone(record);
    const copy = structuredClone(port.record);
    const coordinator = createRecoveryCheckpointTransactionCoordinatorN044(port);
    const write = await coordinator.writeCheckpoint(request(2, token2));
    assert.equal(write.status, 'not-written');
    const discard = await coordinator.discardOnCleanClose({scope, expected: {generation: 1, token: token1}});
    assert.equal(discard.status, 'retained');
    assert.equal(port.calls.includes('swap'), false);
    assert.equal(port.calls.includes('delete'), false);
    assert.deepEqual(port.record, copy);
  }
});

test('clean close deletes only the exact validated generation and token, then verifies absence', async () => {
  const {port, record} = await savedRecord();
  port.calls.length = 0;
  const result = await createRecoveryCheckpointTransactionCoordinatorN044(port).discardOnCleanClose({scope, expected: {generation: 1, token: token1}});
  assert.deepEqual(result, {status: 'discarded', generation: 1});
  assert.deepEqual(port.calls, ['read', 'delete', 'read']);
  assert.deepEqual(port.lastDelete!.expected, {generation: 1, token: token1, recordHash: record.recordHash});
});

test('wrong generation or token retains the checkpoint without invoking delete', async () => {
  for (const expected of [{generation: 2, token: token1}, {generation: 1, token: token2}]) {
    const {port, record} = await savedRecord();
    port.calls.length = 0;
    const result = await createRecoveryCheckpointTransactionCoordinatorN044(port).discardOnCleanClose({scope, expected});
    assert.equal(result.status, 'retained');
    assert.deepEqual(port.calls, ['read']);
    assert.deepEqual(port.record, record);
  }
});

test('explicitly failed delete preserves the checkpoint, while uncertain delete makes no preservation claim', async () => {
  const failed = await savedRecord();
  failed.port.deleteResult = {status: 'not-committed', code: 'permission-denied'};
  const retained = await createRecoveryCheckpointTransactionCoordinatorN044(failed.port).discardOnCleanClose({scope, expected: {generation: 1, token: token1}});
  assert.deepEqual(retained, {status: 'retained', code: 'permission-denied', checkpointPreserved: true});
  assert.deepEqual(failed.port.record, failed.record);

  const uncertainPort = await savedRecord();
  uncertainPort.port.deleteResult = {status: 'state-uncertain', code: 'partial-write'};
  const uncertainResult = await createRecoveryCheckpointTransactionCoordinatorN044(uncertainPort.port).discardOnCleanClose({scope, expected: {generation: 1, token: token1}});
  assert.equal(uncertainResult.status, 'state-uncertain');
  assert.equal(Object.hasOwn(uncertainResult, 'checkpointPreserved'), false);
});

test('committed delete with unverifiable or still-present readback is state-uncertain', async () => {
  for (const readback of [{status: 'unavailable', code: 'io-failure'}, {status: 'found', record: {unexpected: true}}] as RecoveryCheckpointReadN044[]) {
    const {port, record} = await savedRecord();
    port.queuedReads = [{status: 'found', record}, readback];
    const result = await createRecoveryCheckpointTransactionCoordinatorN044(port).discardOnCleanClose({scope, expected: {generation: 1, token: token1}});
    assert.equal(result.status, 'state-uncertain');
    assert.equal(Object.hasOwn(result, 'checkpointPreserved'), false);
  }
});

test('typed failures do not leak host error text, document identity, checkpoint bytes, path, or token', async () => {
  const port = new MemoryPort();
  port.throwSwap = true;
  const result = await createRecoveryCheckpointTransactionCoordinatorN044(port).writeCheckpoint(request());
  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /secret|path|opaque-document|token_000|9,1,7/);
});
