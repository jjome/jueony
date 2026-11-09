import {verifyPreservedExport} from '../rhwp/preservation.ts';

export type PasswordTransitionModeB128 = 'set' | 'change' | 'clear';
export type PasswordTransitionFormatB128 = 'hwp' | 'hwpx';

type ExportArtifact = Readonly<{
  takeBytes(): Uint8Array;
  contentLoss(): unknown;
  free(): void;
}>;

type ReopenedDocument = Readonly<{free(): void}>;

type PasswordExportDocument = Readonly<{
  exportHwpWithReport(): ExportArtifact;
  exportHwpxWithReport(): ExportArtifact;
  exportHwpWithPasswordAndReport(password: string): ExportArtifact;
  exportHwpxWithPasswordAndReport(password: string): ExportArtifact;
}>;

export type PasswordTransitionRequestB128 = Readonly<{
  mode: PasswordTransitionModeB128;
  format: PasswordTransitionFormatB128;
  currentProtected: boolean;
  nextPassword?: string;
  expectedIdentity: string;
  expectedRevision: string;
}>;

export type PasswordTransitionDependenciesB128 = Readonly<{
  source: PasswordExportDocument;
  currentIdentity(): string;
  currentRevision(): string;
  sourceFingerprint(): string;
  openPlain(bytes: Uint8Array): ReopenedDocument;
  openWithPassword(bytes: Uint8Array, password: string): ReopenedDocument;
}>;

export type PasswordTransitionResultB128 = Readonly<{
  bytes: Uint8Array;
  format: PasswordTransitionFormatB128;
  encrypted: boolean;
  mode: PasswordTransitionModeB128;
}>;

function exactText(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
    throw new Error(`${label}을 확인하지 못했습니다.`);
  }
  return value;
}

function password(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || value.includes('\0')) {
    throw new Error('새 문서 암호를 확인하지 못했습니다.');
  }
  const size = new TextEncoder().encode(value).byteLength;
  if (size > 255) throw new Error('새 문서 암호가 안전한 저장 범위를 초과했습니다.');
  return value;
}

function validateRequest(request: PasswordTransitionRequestB128): string | undefined {
  exactText(request.expectedIdentity, '문서 identity');
  exactText(request.expectedRevision, '문서 revision');
  if (request.format !== 'hwp' && request.format !== 'hwpx') throw new Error('저장 형식을 확인하지 못했습니다.');
  if (request.mode === 'set') {
    if (request.currentProtected) throw new Error('이미 암호가 있는 문서는 암호 변경을 사용해야 합니다.');
    return password(request.nextPassword);
  }
  if (request.mode === 'change') {
    if (!request.currentProtected) throw new Error('암호가 없는 문서는 암호 설정을 사용해야 합니다.');
    return password(request.nextPassword);
  }
  if (request.mode === 'clear') {
    if (!request.currentProtected) throw new Error('암호가 없는 문서에서는 암호를 해제할 수 없습니다.');
    if (request.nextPassword !== undefined) throw new Error('암호 해제 요청에는 새 암호를 포함할 수 없습니다.');
    return undefined;
  }
  throw new Error('지원하지 않는 문서 암호 전환입니다.');
}

function assertCurrent(
  dependencies: PasswordTransitionDependenciesB128,
  request: PasswordTransitionRequestB128,
  fingerprint: string,
): void {
  if (dependencies.currentIdentity() !== request.expectedIdentity
    || dependencies.currentRevision() !== request.expectedRevision
    || dependencies.sourceFingerprint() !== fingerprint) {
    throw new Error('암호 저장을 준비하는 동안 문서가 바뀌었습니다. 다시 시도해 주세요.');
  }
}

/**
 * Produces a verified save-as payload without mutating the open document.
 * Password material is used only for the synchronous export/reopen proof and is
 * deliberately absent from the returned receipt.
 */
export function exportPasswordTransitionB128(
  dependencies: PasswordTransitionDependenciesB128,
  request: PasswordTransitionRequestB128,
): PasswordTransitionResultB128 {
  const nextPassword = validateRequest(request);
  const fingerprint = exactText(dependencies.sourceFingerprint(), '원본 문서 지문');
  assertCurrent(dependencies, request, fingerprint);

  const encrypted = nextPassword !== undefined;
  const method = request.format === 'hwp'
    ? (encrypted ? 'exportHwpWithPasswordAndReport' : 'exportHwpWithReport')
    : (encrypted ? 'exportHwpxWithPasswordAndReport' : 'exportHwpxWithReport');
  const exporter = dependencies.source[method];
  if (typeof exporter !== 'function') throw new Error('현재 엔진은 요청한 문서 암호 저장을 지원하지 않습니다.');

  let artifact: ExportArtifact | undefined;
  try {
    artifact = encrypted
      ? (exporter as (password: string) => ExportArtifact).call(dependencies.source, nextPassword)
      : (exporter as () => ExportArtifact).call(dependencies.source);
    assertCurrent(dependencies, request, fingerprint);
    const bytes = artifact.takeBytes();
    const loss = artifact.contentLoss();
    if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0) throw new Error('암호 저장 결과가 비어 있습니다.');
    verifyPreservedExport(
      dependencies.source as never,
      bytes,
      request.format,
      loss,
      encrypted
        ? value => dependencies.openWithPassword(value, nextPassword)
        : value => dependencies.openPlain(value),
    );
    assertCurrent(dependencies, request, fingerprint);
    return {bytes, format: request.format, encrypted, mode: request.mode};
  } finally {
    artifact?.free();
  }
}
