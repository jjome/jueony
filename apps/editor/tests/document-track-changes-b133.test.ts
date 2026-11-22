import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  executeDocumentTrackChangesCommandB133,
  inspectDocumentTrackChangesCapabilityB133,
  readDocumentTrackChangesB133,
} from '../src/adapters/rhwp/document-track-changes-b133.ts';

const hex = (char: string) => char.repeat(64);
const validContract = {
  contract: 'jueony-document-track-changes', version: 1, source: 'document-internal',
  inspect: true, setTracking: true, setDisplay: true, acceptReject: true,
};

function host(capability: Record<string, unknown> = validContract) {
  let current = {
    contract: 'jueony-document-track-changes', version: 1, source: 'document-internal',
    documentIdentity: hex('a'), revision: hex('b'), token: hex('c'),
    tracking: false, display: 'all', changeCount: 2,
  };
  let writes = 0;
  return {
    get writes() { return writes; },
    getDocumentTrackChangesContract: () => structuredClone(capability),
    getDocumentTrackChangesState: () => JSON.stringify(current),
    applyDocumentTrackChangesCommand: (request: string) => {
      writes += 1;
      const parsed = JSON.parse(request);
      const command = parsed.command;
      current = {
        ...current,
        revision: hex('d'), token: hex('e'),
        ...(command.kind === 'set-tracking' ? { tracking: command.value } : {}),
        ...(command.kind === 'set-display' ? { display: command.value } : {}),
        ...(['accept-all', 'reject-all'].includes(command.kind) ? { changeCount: 0 } : {}),
      };
      return JSON.stringify({
        contract: 'jueony-document-track-changes', version: 1,
        source: 'document-internal', ok: true,
      });
    },
  };
}

test('current rhwp public surface is reported unsupported rather than inferred from preservation metadata', () => {
  const currentPublicSurface = {
    getDocumentInfo: () => '{}',
    exportHwp: () => new Uint8Array(),
    exportHwpx: () => new Uint8Array(),
  };
  assert.deepEqual(inspectDocumentTrackChangesCapabilityB133(currentPublicSurface), {
    source: 'document-internal', status: 'unsupported', inspect: false,
    setTracking: false, setDisplay: false, acceptReject: false,
    reason: 'missing-native-contract',
  });
  assert.deepEqual(readDocumentTrackChangesB133(currentPublicSurface),
    { kind: 'blocked', reason: 'unsupported' });
});

test('AI receipts and compare-session diffs cannot masquerade as document-internal tracking', () => {
  for (const value of [
    { contract: 'jueony-agent-receipt', source: 'agent-receipt', inspect: true },
    { contract: 'jueony-document-track-changes', version: 1, source: 'compare-session', inspect: true },
  ]) {
    const candidate = { getDocumentTrackChangesContract: () => value };
    assert.equal(inspectDocumentTrackChangesCapabilityB133(candidate).status, 'unsupported');
  }
});

test('an exact native handshake exposes inspect-only separately from mutation support', () => {
  const candidate = host({ ...validContract, setTracking: false, setDisplay: false, acceptReject: false });
  delete (candidate as { applyDocumentTrackChangesCommand?: unknown }).applyDocumentTrackChangesCommand;
  assert.deepEqual(inspectDocumentTrackChangesCapabilityB133(candidate), {
    source: 'document-internal', status: 'inspect-only', inspect: true,
    setTracking: false, setDisplay: false, acceptReject: false,
  });
  assert.equal(readDocumentTrackChangesB133(candidate).kind, 'ready');
});

test('unsupported commands perform zero writes', () => {
  const candidate = host({ ...validContract, setTracking: false, setDisplay: false, acceptReject: false });
  const result = executeDocumentTrackChangesCommandB133(candidate, {
    kind: 'set-tracking', value: true, expectedRevision: hex('b'), expectedToken: hex('c'),
  });
  assert.deepEqual(result, { kind: 'blocked', reason: 'unsupported' });
  assert.equal(candidate.writes, 0);
});

test('a supported native command is CAS-checked and its post-state is verified', () => {
  const candidate = host();
  const result = executeDocumentTrackChangesCommandB133(candidate, {
    kind: 'set-display', value: 'final', expectedRevision: hex('b'), expectedToken: hex('c'),
  });
  assert.equal(result.kind, 'applied');
  if (result.kind === 'applied') {
    assert.equal(result.value.display, 'final');
    assert.equal(result.value.revision, hex('d'));
    assert.equal(result.value.token, hex('e'));
  }
  assert.equal(candidate.writes, 1);
});

test('stale state, malformed response, and unverifiable post-state never report success', () => {
  const stale = host();
  assert.deepEqual(executeDocumentTrackChangesCommandB133(stale, {
    kind: 'accept-all', expectedRevision: hex('f'), expectedToken: hex('c'),
  }), { kind: 'blocked', reason: 'stale' });
  assert.equal(stale.writes, 0);

  const malformed = host();
  malformed.applyDocumentTrackChangesCommand = () => ({ ok: true });
  assert.deepEqual(executeDocumentTrackChangesCommandB133(malformed, {
    kind: 'reject-all', expectedRevision: hex('b'), expectedToken: hex('c'),
  }), { kind: 'blocked', reason: 'state-uncertain' });
});

test('audit locks current Rust/WASM support to preservation-only evidence, not public commands', async () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const root = resolve(here, '../../..');
  const wasmDeclaration = await readFile(resolve(root, 'upstream/rhwp-source/rhwp-studio/public/rhwp.d.ts'), 'utf8');
  const wasmApi = await readFile(resolve(root, 'upstream/rhwp-source/src/wasm_api.rs'), 'utf8');
  const hwpxHeader = await readFile(resolve(root, 'upstream/rhwp-source/src/serializer/hwpx/header.rs'), 'utf8');
  assert.doesNotMatch(wasmDeclaration, /DocumentTrackChanges|TrackedChanges|TrackChanges/);
  assert.doesNotMatch(wasmApi, /getDocumentTrackChanges|applyDocumentTrackChanges/);
  assert.match(hwpxHeader, /fn track_change_flags\(/, 'opaque track-change config is preserved');
  assert.match(hwpxHeader, /HWPTAG_TRACKCHANGE/, 'preservation code must not be mistaken for edit support');
});
