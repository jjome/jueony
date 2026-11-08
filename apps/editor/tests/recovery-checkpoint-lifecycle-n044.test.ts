import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {
  createHostedRecoveryCheckpointLifecycleN044,
  type RecoveryCheckpointExpectedSourceN044,
  type RecoveryCheckpointSourceN044,
} from '../src/composition/recovery-checkpoint-lifecycle-n044.ts';
import type {
  RecoveryCheckpointHostPortN044,
  RecoveryCheckpointMutationN044,
  RecoveryCheckpointReadN044,
  RecoveryCheckpointRecordN044,
} from '../src/adapters/storage/recovery-checkpoint-transaction-n044.ts';

const scope = {workspaceId: 'workspace-1', documentId: 'document-1'};
const lease = 'lease_000000000001';
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const token = (value: number) => `checkpoint_${String(value).padStart(16, '0')}`;

function source(revision = 'revision-1', bytes = new Uint8Array([1, 2, 3]), identity = 'source-identity'): RecoveryCheckpointSourceN044 {
  return {identity, revision, bytes, bytesHash: sha(bytes)};
}

function expected(value: RecoveryCheckpointSourceN044): RecoveryCheckpointExpectedSourceN044 {
  return {identity: value.identity, revision: value.revision, bytesHash: value.bytesHash};
}

class MemoryHost implements RecoveryCheckpointHostPortN044 {
  record: RecoveryCheckpointRecordN044 | null = null;
  calls: string[] = [];
  swapResult: RecoveryCheckpointMutationN044 | null = null;
  deleteResult: RecoveryCheckpointMutationN044 | null = null;
  deferSwap: (() => void) | null = null;

  async read(): Promise<RecoveryCheckpointReadN044> {
    this.calls.push('read');
    return this.record ? {status: 'found', record: structuredClone(this.record)} : {status: 'absent'};
  }

  async compareAndSwap(input: Parameters<RecoveryCheckpointHostPortN044['compareAndSwap']>[0]): Promise<RecoveryCheckpointMutationN044> {
    this.calls.push('swap');
    if (this.deferSwap) await new Promise<void>(resolve => { this.deferSwap = resolve; });
    if (this.swapResult) return this.swapResult;
    const current = this.record;
    const matches = input.expected === null
      ? current === null
      : Boolean(current
        && current.generation === input.expected.generation
        && current.token === input.expected.token
        && current.recordHash === input.expected.recordHash);
    if (!matches) return {status: 'not-committed', code: 'cas-conflict'};
    this.record = structuredClone(input.next);
    return {status: 'committed'};
  }

  async compareAndDelete(input: Parameters<RecoveryCheckpointHostPortN044['compareAndDelete']>[0]): Promise<RecoveryCheckpointMutationN044> {
    this.calls.push('delete');
    if (this.deleteResult) return this.deleteResult;
    if (!this.record
      || this.record.generation !== input.expected.generation
      || this.record.token !== input.expected.token
      || this.record.recordHash !== input.expected.recordHash) return {status: 'not-committed', code: 'cas-conflict'};
    this.record = null;
    return {status: 'committed'};
  }
}

function lifecycle(host = new MemoryHost(), tokens = [token(1), token(2), token(3)]) {
  let index = 0;
  return {
    host,
    value: createHostedRecoveryCheckpointLifecycleN044(host, {nextCheckpointToken: () => tokens[index++] ?? token(100 + index)}),
  };
}

test('open and periodic checkpoints preserve source identity while advancing exact generation and token', async () => {
  const {host, value} = lifecycle(), opened = source();
  assert.deepEqual(value.onDocumentOpen({lease, scope, source: opened}), {status: 'opened'});
  assert.deepEqual(await value.onPeriodicCheckpoint({lease, expectedSource: expected(opened), checkpointBytes: new Uint8Array([9, 1])}), {status: 'checkpointed', generation: 1});
  assert.deepEqual(await value.onPeriodicCheckpoint({lease, expectedSource: expected(opened), checkpointBytes: new Uint8Array([9, 2])}), {status: 'checkpointed', generation: 2});
  assert.deepEqual(value.snapshot(), {phase: 'active', generation: 2, hasExactCheckpoint: true, operationInFlight: false});
  assert.equal(host.record?.sourceIdentity, opened.identity);
  assert.equal(host.record?.sourceRevision, opened.revision);
  assert.equal(host.record?.sourceBytesHash, opened.bytesHash);
  assert.equal(host.record?.generation, 2);
  assert.equal(host.record?.token, token(2));
});

test('overlapping checkpoint is rejected before a second host operation', async () => {
  const {host, value} = lifecycle(), opened = source(), saved = source('revision-2', new Uint8Array([4]));
  value.onDocumentOpen({lease, scope, source: opened});
  host.deferSwap = () => {};
  const first = value.onPeriodicCheckpoint({lease, expectedSource: expected(opened), checkpointBytes: new Uint8Array([7])});
  await new Promise<void>(resolve => setImmediate(resolve));
  const overlap = await value.onPeriodicCheckpoint({lease, expectedSource: expected(opened), checkpointBytes: new Uint8Array([8])});
  const overlappingSave = await value.onVerifiedSave({lease, expectedSource: expected(opened), savedSource: saved});
  const overlappingClose = await value.onCleanClose({lease, expectedSource: expected(opened)});
  assert.deepEqual(overlap, {status: 'rejected', code: 'operation-overlap'});
  assert.deepEqual(overlappingSave, {status: 'rejected', code: 'operation-overlap'});
  assert.deepEqual(overlappingClose, {status: 'rejected', code: 'operation-overlap'});
  assert.deepEqual(host.calls, ['read', 'swap']);
  host.deferSwap?.();
  assert.deepEqual(await first, {status: 'checkpointed', generation: 1});
});

test('stale lease, stale source and invalid source hash perform no host mutation', async () => {
  const {host, value} = lifecycle(), opened = source();
  value.onDocumentOpen({lease, scope, source: opened});
  assert.deepEqual(await value.onPeriodicCheckpoint({lease: 'lease_000000000099', expectedSource: expected(opened), checkpointBytes: new Uint8Array([1])}), {status: 'rejected', code: 'stale-document-lease'});
  assert.deepEqual(await value.onPeriodicCheckpoint({lease, expectedSource: {...expected(opened), revision: 'stale'}, checkpointBytes: new Uint8Array([1])}), {status: 'rejected', code: 'stale-source'});
  const invalid = {...source('revision-2'), bytesHash: '0'.repeat(64)};
  assert.deepEqual(await value.onVerifiedSave({lease, expectedSource: expected(opened), savedSource: invalid}), {status: 'rejected', code: 'invalid-request'});
  assert.deepEqual(host.calls, []);
});

test('verified save exact-deletes old checkpoint, rebases source, and restarts generation at one', async () => {
  const {host, value} = lifecycle(), opened = source(), saved = source('revision-2', new Uint8Array([4, 5, 6]));
  value.onDocumentOpen({lease, scope, source: opened});
  await value.onPeriodicCheckpoint({lease, expectedSource: expected(opened), checkpointBytes: new Uint8Array([9])});
  const callsBeforeSave = host.calls.length;
  assert.deepEqual(await value.onVerifiedSave({lease, expectedSource: expected(opened), savedSource: saved}), {status: 'save-rebased'});
  assert.deepEqual(host.calls.slice(callsBeforeSave), ['read', 'delete', 'read']);
  assert.equal(host.record, null);
  assert.deepEqual(value.snapshot(), {phase: 'active', generation: 0, hasExactCheckpoint: false, operationInFlight: false});
  assert.deepEqual(await value.onPeriodicCheckpoint({lease, expectedSource: expected(saved), checkpointBytes: new Uint8Array([10])}), {status: 'checkpointed', generation: 1});
  assert.equal(host.record?.sourceRevision, 'revision-2');
});

test('verified save records the new source but blocks when exact recovery deletion is retained or uncertain', async () => {
  for (const result of [
    {status: 'not-committed', code: 'permission-denied'},
    {status: 'state-uncertain', code: 'commit-status-unknown'},
  ] as const) {
    const {host, value} = lifecycle(), opened = source(), saved = source('revision-2', new Uint8Array([4]));
    value.onDocumentOpen({lease, scope, source: opened});
    await value.onPeriodicCheckpoint({lease, expectedSource: expected(opened), checkpointBytes: new Uint8Array([9])});
    host.deleteResult = result;
    const save = await value.onVerifiedSave({lease, expectedSource: expected(opened), savedSource: saved});
    assert.equal(save.status, result.status === 'not-committed' ? 'save-recorded-checkpoint-retained' : 'state-uncertain');
    assert.equal(value.snapshot().phase, 'blocked');
    assert.deepEqual(await value.onPeriodicCheckpoint({lease, expectedSource: expected(saved), checkpointBytes: new Uint8Array([10])}), {status: 'rejected', code: 'lifecycle-blocked'});
    assert.notEqual(host.record, null);
  }
});

test('clean close removes only the exact local checkpoint and duplicate close is a no-op', async () => {
  const {host, value} = lifecycle(), opened = source();
  value.onDocumentOpen({lease, scope, source: opened});
  await value.onPeriodicCheckpoint({lease, expectedSource: expected(opened), checkpointBytes: new Uint8Array([9])});
  const before = host.calls.length;
  assert.deepEqual(await value.onCleanClose({lease, expectedSource: expected(opened)}), {status: 'closed'});
  assert.deepEqual(host.calls.slice(before), ['read', 'delete', 'read']);
  const after = host.calls.length;
  assert.deepEqual(await value.onCleanClose({lease, expectedSource: expected(opened)}), {status: 'rejected', code: 'duplicate-close'});
  assert.equal(host.calls.length, after);
  assert.deepEqual(value.snapshot(), {phase: 'closed', generation: 0, hasExactCheckpoint: false, operationInFlight: false});
});

test('clean close with stale expected source or stale lease never deletes', async () => {
  const {host, value} = lifecycle(), opened = source();
  value.onDocumentOpen({lease, scope, source: opened});
  await value.onPeriodicCheckpoint({lease, expectedSource: expected(opened), checkpointBytes: new Uint8Array([9])});
  const before = host.calls.length;
  assert.deepEqual(await value.onCleanClose({lease, expectedSource: {...expected(opened), bytesHash: '0'.repeat(64)}}), {status: 'rejected', code: 'stale-source'});
  assert.deepEqual(await value.onCleanClose({lease: 'lease_000000000099', expectedSource: expected(opened)}), {status: 'rejected', code: 'stale-document-lease'});
  assert.equal(host.calls.length, before);
  assert.notEqual(host.record, null);
});

test('uncertain checkpoint blocks every later lifecycle mutation without preservation claims', async () => {
  const {host, value} = lifecycle(), opened = source();
  value.onDocumentOpen({lease, scope, source: opened});
  host.swapResult = {status: 'state-uncertain', code: 'partial-write'};
  const result = await value.onPeriodicCheckpoint({lease, expectedSource: expected(opened), checkpointBytes: new Uint8Array([9])});
  assert.deepEqual(result, {status: 'state-uncertain', operation: 'checkpoint', requiresRecoveryRescan: true});
  assert.equal(Object.hasOwn(result, 'previousCheckpointPreserved'), false);
  const calls = host.calls.length;
  assert.deepEqual(await value.onCleanClose({lease, expectedSource: expected(opened)}), {status: 'rejected', code: 'lifecycle-blocked'});
  assert.equal(host.calls.length, calls);
});

test('host-safe results do not expose identity, lease, token, path, or checkpoint bytes', async () => {
  const {host, value} = lifecycle(), opened = source('secret-revision', new Uint8Array([3, 1, 4]), 'secret-path-document');
  value.onDocumentOpen({lease, scope, source: opened});
  host.swapResult = {status: 'not-committed', code: 'permission-denied'};
  const result = await value.onPeriodicCheckpoint({lease, expectedSource: expected(opened), checkpointBytes: new Uint8Array([9, 8, 7])});
  assert.doesNotMatch(JSON.stringify(result), /secret|lease_|checkpoint_|9,8,7|path/u);
});
