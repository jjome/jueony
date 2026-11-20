import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decideWindowsPickerOpenN043,
  preflightWindowsBoundSaveN043,
  revalidateWindowsFinalReplaceN043,
  type WindowsCommitCapabilityN043,
  type WindowsFileEvidenceN043,
  type WindowsFileProbeN043,
} from '../src/adapters/files/windows-file-preflight-n043.ts';

const hash = 'a'.repeat(64);
const evidence = (change: Partial<WindowsFileEvidenceN043> = {}): WindowsFileEvidenceN043 => ({
  canonicalPath: 'C:\\work\\plan.hwpx',
  identity: 'volume-3:file-9042',
  kind: 'file',
  size: 321,
  modifiedTimeNs: '1780000000000000000',
  contentHash: hash,
  readable: true,
  writable: true,
  readOnly: false,
  ...change,
});
const probe = (change: Partial<WindowsFileEvidenceN043> = {}): WindowsFileProbeN043 => ({ status: 'ok', evidence: evidence(change) });
const target = () => ({ canonicalPath: evidence().canonicalPath, identity: evidence().identity });
const capability: WindowsCommitCapabilityN043 = {
  identityAndHashCheckedAtReplace: true,
  atomicReplaceOrNoClobber: true,
  committedBytesReadbackHash: true,
};

function opened(change: Partial<WindowsFileEvidenceN043> = {}) {
  const current = evidence(change);
  const result = decideWindowsPickerOpenN043(
    { status: 'selected', target: { canonicalPath: current.canonicalPath, identity: current.identity } },
    { status: 'ok', evidence: current },
  );
  assert.equal(result.status, 'open-ready');
  if (result.status !== 'open-ready') throw new Error('fixture failed');
  return result.baseline;
}

test('picker cancellation is a no-op and does not inspect host evidence', () => {
  const result = decideWindowsPickerOpenN043({ status: 'cancelled' });
  assert.deepEqual(result, { status: 'cancelled', mutation: 'none', diskWriteAllowed: false });
});

test('open captures canonical path, identity, size, mtime and content hash without enabling a write', () => {
  const result = decideWindowsPickerOpenN043({ status: 'selected', target: target() }, probe());
  assert.equal(result.status, 'open-ready');
  if (result.status !== 'open-ready') return;
  assert.deepEqual(result.baseline.evidence, evidence());
  assert.equal(result.baseline.writable, true);
  assert.equal(result.diskWriteAllowed, false);
  assert.ok(Object.isFrozen(result.baseline.evidence));
});

test('open rejects a changed selection and non-canonical path without exposing either target', () => {
  const changed = decideWindowsPickerOpenN043(
    { status: 'selected', target: target() },
    probe({ identity: 'volume-3:file-replaced-at-open' }),
  );
  assert.equal(changed.status, 'rejected');
  assert.equal(changed.code, 'selection-changed');

  const relative = decideWindowsPickerOpenN043(
    { status: 'selected', target: { canonicalPath: '..\\secret.hwpx', identity: 'secret-id' } },
    probe(),
  );
  assert.equal(relative.status, 'rejected');
  assert.equal(relative.code, 'invalid-evidence');
  assert.doesNotMatch(JSON.stringify(relative), /secret/u);
});

test('read-only files may open but cannot pass save preflight', () => {
  const baseline = opened({ writable: false, readOnly: true });
  assert.equal(baseline.writable, false);
  const result = preflightWindowsBoundSaveN043(baseline, probe({ writable: false, readOnly: true }));
  assert.deepEqual(result, {
    status: 'rejected', code: 'read-only',
    message: '읽기 전용 파일은 원본에 저장할 수 없습니다. 다른 이름으로 저장해 주세요.',
    diskWriteAllowed: false,
  });
});

test('permission, non-file, deletion and read failures are typed and write-free', () => {
  const baseline = opened();
  for (const [input, code] of [
    [{ status: 'permission-denied' }, 'permission-denied'],
    [{ status: 'not-file' }, 'not-file'],
    [{ status: 'read-error' }, 'read-error'],
    [{ status: 'not-found' }, 'deleted'],
  ] as const) {
    const result = preflightWindowsBoundSaveN043(baseline, input);
    assert.equal(result.status, 'rejected');
    assert.equal(result.code, code);
    assert.equal(result.diskWriteAllowed, false);
  }
  assert.equal(preflightWindowsBoundSaveN043(baseline, probe({ writable: false })).status, 'rejected');
});

test('path move, identity replacement and metadata/hash changes never receive a save grant', () => {
  const baseline = opened();
  const cases: [Partial<WindowsFileEvidenceN043>, string][] = [
    [{ canonicalPath: 'C:\\work\\moved.hwpx' }, 'moved-or-replaced'],
    [{ identity: 'volume-3:file-9999' }, 'moved-or-replaced'],
    [{ size: 322 }, 'externally-modified'],
    [{ modifiedTimeNs: '1780000000000000001' }, 'externally-modified'],
    [{ contentHash: 'b'.repeat(64) }, 'externally-modified'],
  ];
  for (const [change, code] of cases) {
    const result = preflightWindowsBoundSaveN043(baseline, probe(change));
    assert.equal(result.status, 'rejected');
    assert.equal(result.code, code);
    assert.equal(result.diskWriteAllowed, false);
  }
});

test('save preflight is not write authority and final replace repeats identity/hash evidence', () => {
  const preflight = preflightWindowsBoundSaveN043(opened(), probe());
  assert.equal(preflight.status, 'save-preflight-ready');
  if (preflight.status !== 'save-preflight-ready') return;
  assert.equal(preflight.grant.diskWriteAllowed, false);
  assert.equal(preflight.grant.requiresFinalIdentityAndHashCheck, true);

  for (const change of [
    { identity: 'volume-3:file-raced' },
    { contentHash: 'c'.repeat(64) },
    { modifiedTimeNs: '1780000000000000002' },
  ]) {
    const result = revalidateWindowsFinalReplaceN043(preflight.grant, probe(change), capability);
    assert.equal(result.status, 'rejected');
    assert.equal(result.diskWriteAllowed, false);
  }

  const ready = revalidateWindowsFinalReplaceN043(preflight.grant, probe(), capability);
  assert.equal(ready.status, 'final-revalidation-passed');
  if (ready.status !== 'final-revalidation-passed') return;
  assert.equal(ready.requiredHostOperation, 'atomic-compare-and-replace-then-readback');
  assert.equal(ready.diskWriteAllowed, true);
  assert.equal(ready.diskWritePerformed, false);
});

test('missing any atomic host guarantee fails closed before final replace', () => {
  const preflight = preflightWindowsBoundSaveN043(opened(), probe());
  assert.equal(preflight.status, 'save-preflight-ready');
  if (preflight.status !== 'save-preflight-ready') return;
  for (const key of Object.keys(capability) as (keyof WindowsCommitCapabilityN043)[]) {
    const result = revalidateWindowsFinalReplaceN043(preflight.grant, probe(), { ...capability, [key]: false });
    assert.equal(result.status, 'rejected');
    assert.equal(result.code, 'host-not-qualified');
  }
});

test('malformed or conflicting evidence returns only safe codes and messages', () => {
  const secretPath = 'C:\\private\\resident-number\\api-key.hwpx';
  const secretIdentity = 'secret-identity-token';
  const selected = { status: 'selected' as const, target: { canonicalPath: secretPath, identity: secretIdentity } };
  const malformed = { status: 'ok' as const, evidence: evidence({ canonicalPath: secretPath, identity: secretIdentity, contentHash: 'not-a-hash' }) };
  const invalid = decideWindowsPickerOpenN043(selected, malformed);
  assert.equal(invalid.status, 'rejected');
  assert.equal(invalid.code, 'invalid-evidence');
  assert.doesNotMatch(JSON.stringify(invalid), /private|resident|api-key|secret-identity/u);

  const conflict = preflightWindowsBoundSaveN043(opened(), probe({ contentHash: 'd'.repeat(64) }));
  assert.equal(conflict.status, 'rejected');
  assert.doesNotMatch(JSON.stringify(conflict), /C:\\\\work|volume-3|a{32}/u);
});
