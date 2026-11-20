import {sha256} from '@noble/hashes/sha2.js';
import {createIndexedDbRecoveryCheckpointHostN044} from '../adapters/storage/indexeddb-recovery-checkpoint-n044.ts';
import {
  createRecoveryCheckpointTransactionCoordinatorN044,
  type DiscardRecoveryCheckpointResultN044,
  type RecoveryCheckpointHostPortN044,
  type RecoveryCheckpointScopeN044,
  type WriteRecoveryCheckpointResultN044,
} from '../adapters/storage/recovery-checkpoint-transaction-n044.ts';

const SAFE_ID = /^[\p{L}\p{N}._:@+-]{1,256}$/u;
const TOKEN = /^[A-Za-z0-9_-]{16,256}$/u;
const HEX_256 = /^[0-9a-f]{64}$/u;

export type RecoveryCheckpointSourceN044 = Readonly<{
  identity: string;
  revision: string;
  bytes: Uint8Array;
  bytesHash: string;
}>;

export type RecoveryCheckpointExpectedSourceN044 = Readonly<{
  identity: string;
  revision: string;
  bytesHash: string;
}>;

export type RecoveryCheckpointLifecycleResultN044 =
  | Readonly<{status: 'opened'}>
  | Readonly<{status: 'checkpointed'; generation: number}>
  | Readonly<{status: 'save-rebased'}>
  | Readonly<{status: 'closed'}>
  | Readonly<{
      status: 'rejected';
      code:
        | 'invalid-request'
        | 'no-open-document'
        | 'document-already-open'
        | 'stale-document-lease'
        | 'stale-source'
        | 'operation-overlap'
        | 'lifecycle-blocked'
        | 'duplicate-close'
        | 'checkpoint-token-invalid'
        | 'checkpoint-token-reused';
    }>
  | Readonly<{
      status: 'checkpoint-not-written';
      code: Extract<WriteRecoveryCheckpointResultN044, {status: 'not-written'}>['code'];
      previousCheckpointPreserved: true;
    }>
  | Readonly<{
      status: 'save-recorded-checkpoint-retained';
      code: Extract<DiscardRecoveryCheckpointResultN044, {status: 'retained'}>['code'];
      checkpointPreserved: true;
      requiresRecoveryRescan: true;
    }>
  | Readonly<{
      status: 'close-blocked';
      code: Extract<DiscardRecoveryCheckpointResultN044, {status: 'retained'}>['code'];
      checkpointPreserved: true;
    }>
  | Readonly<{
      status: 'state-uncertain';
      operation: 'checkpoint' | 'verified-save' | 'clean-close';
      requiresRecoveryRescan: true;
    }>;

export type RecoveryCheckpointLifecycleSnapshotN044 = Readonly<{
  phase: 'empty' | 'active' | 'blocked' | 'closed';
  generation: number;
  hasExactCheckpoint: boolean;
  operationInFlight: boolean;
}>;

type Coordinator = ReturnType<typeof createRecoveryCheckpointTransactionCoordinatorN044>;

type OpenState = {
  phase: 'active' | 'blocked' | 'closed';
  lease: string;
  scope: RecoveryCheckpointScopeN044;
  source: RecoveryCheckpointSourceN044;
  generation: number;
  checkpointToken: string | null;
};

export interface RecoveryCheckpointLifecycleOptionsN044 {
  coordinator: Coordinator;
  nextCheckpointToken(): string;
}

export type RecoveryCheckpointLifecycleN044 = ReturnType<typeof createRecoveryCheckpointLifecycleN044>;

export function createRecoveryCheckpointLifecycleN044(options: RecoveryCheckpointLifecycleOptionsN044) {
  let state: OpenState | null = null;
  let operationInFlight = false;

  function snapshot(): RecoveryCheckpointLifecycleSnapshotN044 {
    return {
      phase: state?.phase ?? 'empty',
      generation: state?.generation ?? 0,
      hasExactCheckpoint: Boolean(state?.checkpointToken),
      operationInFlight,
    };
  }

  function onDocumentOpen(input: Readonly<{
    lease: string;
    scope: RecoveryCheckpointScopeN044;
    source: RecoveryCheckpointSourceN044;
  }>): RecoveryCheckpointLifecycleResultN044 {
    if (operationInFlight) return rejected('operation-overlap');
    if (state && state.phase !== 'closed') return rejected('document-already-open');
    if (!validLease(input.lease) || !validScope(input.scope) || !validSource(input.source)) return rejected('invalid-request');
    state = {
      phase: 'active',
      lease: input.lease,
      scope: {...input.scope},
      source: copySource(input.source),
      generation: 0,
      checkpointToken: null,
    };
    return {status: 'opened'};
  }

  async function onPeriodicCheckpoint(input: Readonly<{
    lease: string;
    expectedSource: RecoveryCheckpointExpectedSourceN044;
    checkpointBytes: Uint8Array;
  }>): Promise<RecoveryCheckpointLifecycleResultN044> {
    const current = eligible(input.lease, input.expectedSource);
    if ('result' in current) return current.result;
    if (!(input.checkpointBytes instanceof Uint8Array) || input.checkpointBytes.byteLength < 1) return rejected('invalid-request');
    if (operationInFlight) return rejected('operation-overlap');

    let token: string;
    try { token = options.nextCheckpointToken(); } catch { return rejected('checkpoint-token-invalid'); }
    if (!TOKEN.test(token)) return rejected('checkpoint-token-invalid');
    if (token === current.state.checkpointToken) {
      current.state.phase = 'blocked';
      return rejected('checkpoint-token-reused');
    }

    operationInFlight = true;
    try {
      const generation = current.state.generation + 1;
      const result = await options.coordinator.writeCheckpoint({
        scope: current.state.scope,
        source: current.state.source,
        checkpoint: {generation, token, bytes: new Uint8Array(input.checkpointBytes)},
      });
      if (result.status === 'checkpointed') {
        current.state.generation = result.generation;
        current.state.checkpointToken = token;
        return result;
      }
      if (result.status === 'state-uncertain') {
        current.state.phase = 'blocked';
        return uncertain('checkpoint');
      }
      if (staleCheckpointFailure(result.code)) current.state.phase = 'blocked';
      return {status: 'checkpoint-not-written', code: result.code, previousCheckpointPreserved: true};
    } finally {
      operationInFlight = false;
    }
  }

  async function onVerifiedSave(input: Readonly<{
    lease: string;
    expectedSource: RecoveryCheckpointExpectedSourceN044;
    savedSource: RecoveryCheckpointSourceN044;
  }>): Promise<RecoveryCheckpointLifecycleResultN044> {
    const current = eligible(input.lease, input.expectedSource);
    if ('result' in current) return current.result;
    if (!validSource(input.savedSource)) return rejected('invalid-request');
    if (operationInFlight) return rejected('operation-overlap');

    operationInFlight = true;
    try {
      const prior = current.state.checkpointToken === null ? null : {
        generation: current.state.generation,
        token: current.state.checkpointToken,
      };
      // The caller reports an already verified durable save. Record that new
      // source even when recovery cleanup fails, then block instead of writing
      // a new-source checkpoint over the old-source recovery record.
      current.state.source = copySource(input.savedSource);
      if (prior === null) {
        current.state.generation = 0;
        return {status: 'save-rebased'};
      }
      const discarded = await options.coordinator.discardOnCleanClose({scope: current.state.scope, expected: prior});
      if (discarded.status === 'discarded') {
        current.state.generation = 0;
        current.state.checkpointToken = null;
        return {status: 'save-rebased'};
      }
      current.state.phase = 'blocked';
      if (discarded.status === 'state-uncertain') return uncertain('verified-save');
      return {
        status: 'save-recorded-checkpoint-retained',
        code: discarded.code,
        checkpointPreserved: true,
        requiresRecoveryRescan: true,
      };
    } finally {
      operationInFlight = false;
    }
  }

  async function onCleanClose(input: Readonly<{
    lease: string;
    expectedSource: RecoveryCheckpointExpectedSourceN044;
  }>): Promise<RecoveryCheckpointLifecycleResultN044> {
    if (!state) return rejected('no-open-document');
    if (state.phase === 'closed') return rejected('duplicate-close');
    const current = eligible(input.lease, input.expectedSource);
    if ('result' in current) return current.result;
    if (operationInFlight) return rejected('operation-overlap');

    const prior = current.state.checkpointToken === null ? null : {
      generation: current.state.generation,
      token: current.state.checkpointToken,
    };
    if (prior === null) {
      current.state.phase = 'closed';
      return {status: 'closed'};
    }

    operationInFlight = true;
    try {
      const discarded = await options.coordinator.discardOnCleanClose({scope: current.state.scope, expected: prior});
      if (discarded.status === 'discarded') {
        current.state.generation = 0;
        current.state.checkpointToken = null;
        current.state.phase = 'closed';
        return {status: 'closed'};
      }
      if (discarded.status === 'state-uncertain') {
        current.state.phase = 'blocked';
        return uncertain('clean-close');
      }
      if (staleDiscardFailure(discarded.code)) current.state.phase = 'blocked';
      return {status: 'close-blocked', code: discarded.code, checkpointPreserved: true};
    } finally {
      operationInFlight = false;
    }
  }

  function eligible(lease: string, expected: RecoveryCheckpointExpectedSourceN044):
    | {state: OpenState}
    | {result: RecoveryCheckpointLifecycleResultN044} {
    if (!state) return {result: rejected('no-open-document')};
    if (state.phase === 'closed') return {result: rejected('duplicate-close')};
    if (state.phase === 'blocked') return {result: rejected('lifecycle-blocked')};
    if (lease !== state.lease) return {result: rejected('stale-document-lease')};
    if (!validExpectedSource(expected) || !sameSource(expected, state.source)) return {result: rejected('stale-source')};
    return {state};
  }

  return {onDocumentOpen, onPeriodicCheckpoint, onVerifiedSave, onCleanClose, snapshot};
}

export function createIndexedDbRecoveryCheckpointLifecycleN044(
  factory: IDBFactory,
  options: Readonly<{nextCheckpointToken(): string}>,
): RecoveryCheckpointLifecycleN044 {
  const host = createIndexedDbRecoveryCheckpointHostN044(factory);
  const coordinator = createRecoveryCheckpointTransactionCoordinatorN044(host);
  return createRecoveryCheckpointLifecycleN044({coordinator, nextCheckpointToken: options.nextCheckpointToken});
}

/** Host-port factory for non-browser composition roots and deterministic tests. */
export function createHostedRecoveryCheckpointLifecycleN044(
  host: RecoveryCheckpointHostPortN044,
  options: Readonly<{nextCheckpointToken(): string}>,
): RecoveryCheckpointLifecycleN044 {
  return createRecoveryCheckpointLifecycleN044({
    coordinator: createRecoveryCheckpointTransactionCoordinatorN044(host),
    nextCheckpointToken: options.nextCheckpointToken,
  });
}

function validScope(scope: RecoveryCheckpointScopeN044): boolean {
  return Boolean(scope && SAFE_ID.test(scope.workspaceId) && SAFE_ID.test(scope.documentId));
}

function validLease(lease: string): boolean {
  return typeof lease === 'string' && TOKEN.test(lease);
}

function validOpaque(value: string): boolean {
  return typeof value === 'string' && value.length >= 1 && value.length <= 512 && !/[\u0000-\u001f\u007f]/u.test(value);
}

function validSource(source: RecoveryCheckpointSourceN044): boolean {
  return Boolean(source
    && validOpaque(source.identity)
    && validOpaque(source.revision)
    && source.bytes instanceof Uint8Array
    && source.bytes.byteLength > 0
    && HEX_256.test(source.bytesHash)
    && digest(source.bytes) === source.bytesHash);
}

function validExpectedSource(source: RecoveryCheckpointExpectedSourceN044): boolean {
  return Boolean(source
    && validOpaque(source.identity)
    && validOpaque(source.revision)
    && HEX_256.test(source.bytesHash));
}

function sameSource(expected: RecoveryCheckpointExpectedSourceN044, current: RecoveryCheckpointSourceN044): boolean {
  return expected.identity === current.identity
    && expected.revision === current.revision
    && expected.bytesHash === current.bytesHash;
}

function copySource(source: RecoveryCheckpointSourceN044): RecoveryCheckpointSourceN044 {
  return {identity: source.identity, revision: source.revision, bytes: new Uint8Array(source.bytes), bytesHash: source.bytesHash};
}

function digest(bytes: Uint8Array): string {
  return Array.from(sha256(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

function rejected(code: Extract<RecoveryCheckpointLifecycleResultN044, {status: 'rejected'}>['code']): RecoveryCheckpointLifecycleResultN044 {
  return {status: 'rejected', code};
}

function uncertain(operation: Extract<RecoveryCheckpointLifecycleResultN044, {status: 'state-uncertain'}>['operation']): RecoveryCheckpointLifecycleResultN044 {
  return {status: 'state-uncertain', operation, requiresRecoveryRescan: true};
}

function staleCheckpointFailure(code: Extract<WriteRecoveryCheckpointResultN044, {status: 'not-written'}>['code']): boolean {
  return ['generation-mismatch', 'source-identity-mismatch', 'token-reused', 'checkpoint-corrupt', 'checkpoint-future-version', 'checkpoint-foreign', 'cas-conflict'].includes(code);
}

function staleDiscardFailure(code: Extract<DiscardRecoveryCheckpointResultN044, {status: 'retained'}>['code']): boolean {
  return ['checkpoint-corrupt', 'checkpoint-future-version', 'checkpoint-foreign', 'token-mismatch', 'generation-mismatch', 'cas-conflict'].includes(code);
}
