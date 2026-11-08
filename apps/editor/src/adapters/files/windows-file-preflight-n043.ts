export type WindowsFileTargetN043 = Readonly<{
  canonicalPath: string;
  identity: string;
}>;

export type WindowsFileEvidenceN043 = Readonly<{
  canonicalPath: string;
  identity: string;
  kind: 'file';
  size: number;
  modifiedTimeNs: string;
  contentHash: string;
  readable: boolean;
  writable: boolean;
  readOnly: boolean;
}>;

export type WindowsPickerResultN043 =
  | Readonly<{ status: 'cancelled' }>
  | Readonly<{ status: 'selected'; target: WindowsFileTargetN043 }>;

export type WindowsFileProbeN043 =
  | Readonly<{ status: 'ok'; evidence: WindowsFileEvidenceN043 }>
  | Readonly<{ status: 'not-found' | 'permission-denied' | 'not-file' | 'read-error' }>;

export type WindowsFileRejectionCodeN043 =
  | 'invalid-evidence'
  | 'not-found'
  | 'permission-denied'
  | 'not-file'
  | 'read-error'
  | 'selection-changed'
  | 'read-only'
  | 'write-permission-denied'
  | 'moved-or-replaced'
  | 'deleted'
  | 'externally-modified'
  | 'host-not-qualified';

export type WindowsFileRejectionN043 = Readonly<{
  status: 'rejected';
  code: WindowsFileRejectionCodeN043;
  message: string;
  diskWriteAllowed: false;
}>;

export type WindowsOpenBaselineN043 = Readonly<{
  evidence: WindowsFileEvidenceN043;
  writable: boolean;
}>;

export type WindowsOpenDecisionN043 =
  | Readonly<{ status: 'cancelled'; mutation: 'none'; diskWriteAllowed: false }>
  | WindowsFileRejectionN043
  | Readonly<{
      status: 'open-ready';
      baseline: WindowsOpenBaselineN043;
      diskWriteAllowed: false;
    }>;

export type WindowsSaveGrantN043 = Readonly<{
  expected: WindowsFileEvidenceN043;
  requiresFinalIdentityAndHashCheck: true;
  diskWriteAllowed: false;
}>;

export type WindowsSavePreflightDecisionN043 =
  | WindowsFileRejectionN043
  | Readonly<{
      status: 'save-preflight-ready';
      grant: WindowsSaveGrantN043;
      diskWriteAllowed: false;
    }>;

export type WindowsCommitCapabilityN043 = Readonly<{
  identityAndHashCheckedAtReplace: boolean;
  atomicReplaceOrNoClobber: boolean;
  committedBytesReadbackHash: boolean;
}>;

export type WindowsFinalReplaceDecisionN043 =
  | WindowsFileRejectionN043
  | Readonly<{
      status: 'final-revalidation-passed';
      guard: Readonly<{
        canonicalPath: string;
        identity: string;
        contentHash: string;
      }>;
      requiredHostOperation: 'atomic-compare-and-replace-then-readback';
      diskWriteAllowed: true;
      diskWritePerformed: false;
    }>;

const safeMessages: Readonly<Record<WindowsFileRejectionCodeN043, string>> = Object.freeze({
  'invalid-evidence': '파일 상태 증거를 확인할 수 없습니다. 파일을 다시 선택해 주세요.',
  'not-found': '선택한 파일을 찾을 수 없습니다. 이동 또는 삭제 여부를 확인해 주세요.',
  'permission-denied': '선택한 파일을 읽을 권한이 없습니다.',
  'not-file': '일반 파일만 열 수 있습니다.',
  'read-error': '선택한 파일의 상태를 안전하게 확인하지 못했습니다.',
  'selection-changed': '파일 선택 뒤 대상이 바뀌었습니다. 파일을 다시 선택해 주세요.',
  'read-only': '읽기 전용 파일은 원본에 저장할 수 없습니다. 다른 이름으로 저장해 주세요.',
  'write-permission-denied': '원본 파일에 쓸 권한이 없습니다. 다른 이름으로 저장해 주세요.',
  'moved-or-replaced': '원본 파일의 위치 또는 파일 정체성이 바뀌었습니다. 원본을 다시 열어 주세요.',
  'deleted': '원본 파일이 이동되거나 삭제됐습니다. 원본을 다시 선택해 주세요.',
  'externally-modified': '다른 프로그램에서 원본 파일을 변경했습니다. 원본을 덮어쓰지 않았습니다.',
  'host-not-qualified': '현재 파일 저장 계층은 안전한 최종 교체 검사를 보장하지 않습니다.',
});

function rejected(code: WindowsFileRejectionCodeN043): WindowsFileRejectionN043 {
  return Object.freeze({ status: 'rejected', code, message: safeMessages[code], diskWriteAllowed: false });
}

function validText(value: unknown, maximum: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maximum && value.trim() === value && !/[\u0000-\u001f\u007f]/u.test(value);
}

function validCanonicalWindowsPath(value: unknown): value is string {
  if (!validText(value, 32768) || !/^(?:[a-z]:\\|\\\\)/iu.test(value)) return false;
  return !value.split('\\').some(segment => segment === '.' || segment === '..');
}

function validTarget(value: unknown): value is WindowsFileTargetN043 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const target = value as Partial<WindowsFileTargetN043>;
  return validCanonicalWindowsPath(target.canonicalPath) && validText(target.identity, 1024);
}

function validEvidence(value: unknown): value is WindowsFileEvidenceN043 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const evidence = value as Partial<WindowsFileEvidenceN043>;
  return validCanonicalWindowsPath(evidence.canonicalPath)
    && validText(evidence.identity, 1024)
    && evidence.kind === 'file'
    && typeof evidence.size === 'number'
    && Number.isSafeInteger(evidence.size)
    && evidence.size >= 0
    && typeof evidence.modifiedTimeNs === 'string'
    && /^(?:0|[1-9][0-9]{0,29})$/u.test(evidence.modifiedTimeNs)
    && typeof evidence.contentHash === 'string'
    && /^[0-9a-f]{64}$/iu.test(evidence.contentHash)
    && typeof evidence.readable === 'boolean'
    && typeof evidence.writable === 'boolean'
    && typeof evidence.readOnly === 'boolean'
    && !(evidence.readOnly && evidence.writable);
}

function sealedEvidence(value: WindowsFileEvidenceN043): WindowsFileEvidenceN043 {
  return Object.freeze({ ...value, contentHash: value.contentHash.toLowerCase() });
}

function canonicalPathEqual(left: string, right: string): boolean {
  return left.normalize('NFC').toLocaleLowerCase('en-US') === right.normalize('NFC').toLocaleLowerCase('en-US');
}

function sameTarget(left: WindowsFileTargetN043, right: WindowsFileTargetN043): boolean {
  return canonicalPathEqual(left.canonicalPath, right.canonicalPath) && left.identity === right.identity;
}

function sameContentEvidence(left: WindowsFileEvidenceN043, right: WindowsFileEvidenceN043): boolean {
  return left.size === right.size
    && left.modifiedTimeNs === right.modifiedTimeNs
    && left.contentHash.toLowerCase() === right.contentHash.toLowerCase();
}

function probeFailure(probe: Exclude<WindowsFileProbeN043, { status: 'ok' }>, missingCode: 'not-found' | 'deleted'): WindowsFileRejectionN043 {
  switch (probe.status) {
    case 'not-found': return rejected(missingCode);
    case 'permission-denied': return rejected('permission-denied');
    case 'not-file': return rejected('not-file');
    case 'read-error': return rejected('read-error');
  }
}

function writableEvidence(evidence: WindowsFileEvidenceN043): WindowsFileRejectionN043 | undefined {
  if (!evidence.readable) return rejected('permission-denied');
  if (evidence.readOnly) return rejected('read-only');
  if (!evidence.writable) return rejected('write-permission-denied');
}

/**
 * Pure picker/open decision. Cancellation does not inspect a probe and cannot
 * mutate document or disk state. The host must supply canonical path and file
 * identity captured by an OS-backed observation.
 */
export function decideWindowsPickerOpenN043(
  picker: WindowsPickerResultN043,
  probe?: WindowsFileProbeN043,
): WindowsOpenDecisionN043 {
  if (picker.status === 'cancelled') {
    return Object.freeze({ status: 'cancelled', mutation: 'none', diskWriteAllowed: false });
  }
  if (!validTarget(picker.target) || !probe) return rejected('invalid-evidence');
  if (probe.status !== 'ok') return probeFailure(probe, 'not-found');
  if (!validEvidence(probe.evidence)) return rejected('invalid-evidence');
  if (!sameTarget(picker.target, probe.evidence)) return rejected('selection-changed');
  if (!probe.evidence.readable) return rejected('permission-denied');
  const evidence = sealedEvidence(probe.evidence);
  return Object.freeze({
    status: 'open-ready',
    baseline: Object.freeze({ evidence, writable: evidence.writable && !evidence.readOnly }),
    diskWriteAllowed: false,
  });
}

/**
 * Revalidates the complete opening evidence immediately before a save. It does
 * not open a stream and does not grant the final replace by itself.
 */
export function preflightWindowsBoundSaveN043(
  baseline: WindowsOpenBaselineN043,
  probe: WindowsFileProbeN043,
): WindowsSavePreflightDecisionN043 {
  if (!baseline || !validEvidence(baseline.evidence)) return rejected('invalid-evidence');
  if (probe.status !== 'ok') return probeFailure(probe, 'deleted');
  if (!validEvidence(probe.evidence)) return rejected('invalid-evidence');
  if (!sameTarget(baseline.evidence, probe.evidence)) return rejected('moved-or-replaced');
  const blocked = writableEvidence(probe.evidence);
  if (blocked) return blocked;
  if (!sameContentEvidence(baseline.evidence, probe.evidence)) return rejected('externally-modified');
  const expected = sealedEvidence(probe.evidence);
  return Object.freeze({
    status: 'save-preflight-ready',
    grant: Object.freeze({ expected, requiresFinalIdentityAndHashCheck: true, diskWriteAllowed: false }),
    diskWriteAllowed: false,
  });
}

/**
 * Last pure decision before an OS commit. Passing this check still performs no
 * write: an integrated host must compare identity+hash at replace time, use an
 * atomic replace/no-clobber primitive, and verify committed bytes by readback.
 */
export function revalidateWindowsFinalReplaceN043(
  grant: WindowsSaveGrantN043,
  probe: WindowsFileProbeN043,
  capability: WindowsCommitCapabilityN043,
): WindowsFinalReplaceDecisionN043 {
  if (!grant || !validEvidence(grant.expected) || grant.requiresFinalIdentityAndHashCheck !== true) return rejected('invalid-evidence');
  if (!capability?.identityAndHashCheckedAtReplace || !capability.atomicReplaceOrNoClobber || !capability.committedBytesReadbackHash) {
    return rejected('host-not-qualified');
  }
  if (probe.status !== 'ok') return probeFailure(probe, 'deleted');
  if (!validEvidence(probe.evidence)) return rejected('invalid-evidence');
  if (!sameTarget(grant.expected, probe.evidence)) return rejected('moved-or-replaced');
  const blocked = writableEvidence(probe.evidence);
  if (blocked) return blocked;
  if (!sameContentEvidence(grant.expected, probe.evidence)) return rejected('externally-modified');
  return Object.freeze({
    status: 'final-revalidation-passed',
    guard: Object.freeze({
      canonicalPath: grant.expected.canonicalPath,
      identity: grant.expected.identity,
      contentHash: grant.expected.contentHash.toLowerCase(),
    }),
    requiredHostOperation: 'atomic-compare-and-replace-then-readback',
    diskWriteAllowed: true,
    diskWritePerformed: false,
  });
}
