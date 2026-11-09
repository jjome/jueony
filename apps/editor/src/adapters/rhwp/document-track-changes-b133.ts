const CONTRACT = 'jueony-document-track-changes';
const SOURCE = 'document-internal';
const TOKEN = /^[a-f0-9]{64}$/u;

export type DocumentTrackChangesDisplayB133 = 'all' | 'final' | 'original' | 'none';

export type DocumentTrackChangesCapabilityB133 = Readonly<{
  source: typeof SOURCE;
  status: 'unsupported' | 'inspect-only' | 'supported';
  inspect: boolean;
  setTracking: boolean;
  setDisplay: boolean;
  acceptReject: boolean;
  reason?: 'missing-native-contract' | 'invalid-native-contract';
}>;

export type DocumentTrackChangesStateB133 = Readonly<{
  source: typeof SOURCE;
  documentIdentity: string;
  revision: string;
  token: string;
  tracking: boolean;
  display: DocumentTrackChangesDisplayB133;
  changeCount: number;
}>;

export type DocumentTrackChangesCommandB133 =
  | Readonly<{ kind: 'set-tracking'; value: boolean; expectedRevision: string; expectedToken: string }>
  | Readonly<{ kind: 'set-display'; value: DocumentTrackChangesDisplayB133; expectedRevision: string; expectedToken: string }>
  | Readonly<{ kind: 'accept-all' | 'reject-all'; expectedRevision: string; expectedToken: string }>;

export type DocumentTrackChangesReadResultB133 =
  | Readonly<{ kind: 'ready'; value: DocumentTrackChangesStateB133 }>
  | Readonly<{ kind: 'blocked'; reason: 'unsupported' | 'invalid-contract' | 'read-failed' }>;

export type DocumentTrackChangesCommandResultB133 =
  | Readonly<{ kind: 'applied'; value: DocumentTrackChangesStateB133 }>
  | Readonly<{
      kind: 'blocked';
      reason: 'unsupported' | 'invalid-contract' | 'stale' | 'command-failed' | 'state-uncertain';
    }>;

type ContractV1 = Readonly<{
  contract: typeof CONTRACT;
  version: 1;
  source: typeof SOURCE;
  inspect: boolean;
  setTracking: boolean;
  setDisplay: boolean;
  acceptReject: boolean;
}>;

type NativePort = Readonly<{
  getDocumentTrackChangesContract?: () => unknown;
  getDocumentTrackChangesState?: () => unknown;
  applyDocumentTrackChangesCommand?: (request: string) => unknown;
}>;

const unsupported = (reason: 'missing-native-contract' | 'invalid-native-contract'):
  DocumentTrackChangesCapabilityB133 => ({
    source: SOURCE,
    status: 'unsupported',
    inspect: false,
    setTracking: false,
    setDisplay: false,
    acceptReject: false,
    reason,
  });

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function parseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  if (value.length > 64 * 1024) return null;
  try { return JSON.parse(value); } catch { return null; }
}

function contract(value: unknown): ContractV1 | null {
  const parsed = parseJson(value);
  if (!object(parsed) || !exactKeys(parsed, [
    'contract', 'version', 'source', 'inspect', 'setTracking', 'setDisplay', 'acceptReject',
  ])) return null;
  if (parsed.contract !== CONTRACT || parsed.version !== 1 || parsed.source !== SOURCE) return null;
  if (typeof parsed.inspect !== 'boolean' || typeof parsed.setTracking !== 'boolean'
    || typeof parsed.setDisplay !== 'boolean' || typeof parsed.acceptReject !== 'boolean') return null;
  return parsed as unknown as ContractV1;
}

/**
 * Audits only an explicit document-internal handshake. App/AI receipts,
 * compare-session diffs and opaque TRACKCHANGE preservation are deliberately
 * not treated as an implementation of file-internal revision tracking.
 */
export function inspectDocumentTrackChangesCapabilityB133(candidate: unknown): DocumentTrackChangesCapabilityB133 {
  if (!object(candidate)) return unsupported('missing-native-contract');
  const port = candidate as NativePort;
  if (typeof port.getDocumentTrackChangesContract !== 'function') {
    return unsupported('missing-native-contract');
  }
  let native: ContractV1 | null;
  try { native = contract(port.getDocumentTrackChangesContract()); } catch { native = null; }
  if (!native) return unsupported('invalid-native-contract');

  const hasRead = typeof port.getDocumentTrackChangesState === 'function';
  const hasWrite = typeof port.applyDocumentTrackChangesCommand === 'function';
  if (native.inspect !== hasRead) return unsupported('invalid-native-contract');
  if ((native.setTracking || native.setDisplay || native.acceptReject) && !hasWrite) {
    return unsupported('invalid-native-contract');
  }
  if (!native.inspect && (native.setTracking || native.setDisplay || native.acceptReject)) {
    return unsupported('invalid-native-contract');
  }
  const mutates = native.setTracking || native.setDisplay || native.acceptReject;
  return {
    source: SOURCE,
    status: native.inspect ? (mutates ? 'supported' : 'inspect-only') : 'unsupported',
    inspect: native.inspect,
    setTracking: native.setTracking,
    setDisplay: native.setDisplay,
    acceptReject: native.acceptReject,
    ...(!native.inspect ? { reason: 'missing-native-contract' as const } : {}),
  };
}

function state(value: unknown): DocumentTrackChangesStateB133 | null {
  const parsed = parseJson(value);
  if (!object(parsed) || !exactKeys(parsed, [
    'contract', 'version', 'source', 'documentIdentity', 'revision', 'token',
    'tracking', 'display', 'changeCount',
  ])) return null;
  if (parsed.contract !== CONTRACT || parsed.version !== 1 || parsed.source !== SOURCE) return null;
  if (typeof parsed.documentIdentity !== 'string' || !TOKEN.test(parsed.documentIdentity)) return null;
  if (typeof parsed.revision !== 'string' || !TOKEN.test(parsed.revision)) return null;
  if (typeof parsed.token !== 'string' || !TOKEN.test(parsed.token)) return null;
  if (typeof parsed.tracking !== 'boolean') return null;
  if (!['all', 'final', 'original', 'none'].includes(String(parsed.display))) return null;
  if (!Number.isSafeInteger(parsed.changeCount) || Number(parsed.changeCount) < 0) return null;
  return {
    source: SOURCE,
    documentIdentity: parsed.documentIdentity,
    revision: parsed.revision,
    token: parsed.token,
    tracking: parsed.tracking,
    display: parsed.display as DocumentTrackChangesDisplayB133,
    changeCount: Number(parsed.changeCount),
  };
}

export function readDocumentTrackChangesB133(candidate: unknown): DocumentTrackChangesReadResultB133 {
  const capability = inspectDocumentTrackChangesCapabilityB133(candidate);
  if (!capability.inspect) return { kind: 'blocked', reason: 'unsupported' };
  const port = candidate as NativePort;
  try {
    const value = state(port.getDocumentTrackChangesState?.());
    return value ? { kind: 'ready', value } : { kind: 'blocked', reason: 'invalid-contract' };
  } catch {
    return { kind: 'blocked', reason: 'read-failed' };
  }
}

function commandAllowed(
  capability: DocumentTrackChangesCapabilityB133,
  command: DocumentTrackChangesCommandB133,
): boolean {
  if (command.kind === 'set-tracking') return capability.setTracking;
  if (command.kind === 'set-display') return capability.setDisplay;
  return capability.acceptReject;
}

function postcondition(command: DocumentTrackChangesCommandB133, after: DocumentTrackChangesStateB133): boolean {
  if (command.kind === 'set-tracking') return after.tracking === command.value;
  if (command.kind === 'set-display') return after.display === command.value;
  return after.changeCount === 0;
}

/**
 * Executes a future native command only after an exact capability+state CAS
 * handshake. Current rhwp does not expose that handshake, so this function
 * returns `unsupported` without invoking any similarly named app/AI API.
 */
export function executeDocumentTrackChangesCommandB133(
  candidate: unknown,
  command: DocumentTrackChangesCommandB133,
): DocumentTrackChangesCommandResultB133 {
  const capability = inspectDocumentTrackChangesCapabilityB133(candidate);
  if (!commandAllowed(capability, command)) return { kind: 'blocked', reason: 'unsupported' };
  if (!TOKEN.test(command.expectedRevision) || !TOKEN.test(command.expectedToken)) {
    return { kind: 'blocked', reason: 'invalid-contract' };
  }
  const before = readDocumentTrackChangesB133(candidate);
  if (before.kind !== 'ready') return { kind: 'blocked', reason: 'invalid-contract' };
  if (before.value.revision !== command.expectedRevision || before.value.token !== command.expectedToken) {
    return { kind: 'blocked', reason: 'stale' };
  }

  const port = candidate as NativePort;
  let response: unknown;
  try {
    response = parseJson(port.applyDocumentTrackChangesCommand?.(JSON.stringify({
      contract: CONTRACT,
      version: 1,
      source: SOURCE,
      command,
    })));
  } catch {
    return { kind: 'blocked', reason: 'command-failed' };
  }
  if (!object(response) || !exactKeys(response, ['contract', 'version', 'source', 'ok'])
    || response.contract !== CONTRACT || response.version !== 1 || response.source !== SOURCE
    || response.ok !== true) {
    return { kind: 'blocked', reason: 'state-uncertain' };
  }

  const after = readDocumentTrackChangesB133(candidate);
  if (after.kind !== 'ready'
    || after.value.documentIdentity !== before.value.documentIdentity
    || after.value.revision === before.value.revision
    || after.value.token === before.value.token
    || !postcondition(command, after.value)) {
    return { kind: 'blocked', reason: 'state-uncertain' };
  }
  return { kind: 'applied', value: after.value };
}
