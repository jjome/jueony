import {capturePreservationEvidence, verifyPreservedExport} from './preservation.ts';

export const DOCUMENT_METADATA_KEYS = ['title', 'subject', 'author', 'keywords', 'description'] as const;
export type DocumentMetadataValues = Record<typeof DOCUMENT_METADATA_KEYS[number], string>;
export type DocumentMetadata = {editable: boolean; values?: DocumentMetadataValues; fingerprint?: string; reason?: string};
const parse = (value: any): any => typeof value === 'string' ? JSON.parse(value) : value;
const native = (value: any): any => value.borrowDocumentHandle?.() ?? value;
const canonical = (v: any): any => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])])) : v;
const same = (a: unknown, b: unknown): boolean => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

/** Five summary strings, not revision history or arbitrary raw metadata. */
export function validateDocumentMetadataValues(value: unknown): DocumentMetadataValues {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 5 || !DOCUMENT_METADATA_KEYS.every(k => Object.hasOwn(value, k))) throw new Error('문서 속성의 다섯 항목을 읽지 못했습니다.');
  for (const item of Object.values(value)) {
    if (typeof item !== 'string' || item.length > 4096 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(item) || /[\ud800-\udfff]/u.test(item)) throw new Error('문서 속성은 항목별 4,096자 이내의 유효한 Unicode 문자로 입력하세요.');
  }
  return {...value} as DocumentMetadataValues;
}

export function readDocumentMetadata(wasm: any): DocumentMetadata {
  const d = native(wasm);
  if (typeof d.getDocumentMetadata !== 'function' || typeof d.setDocumentMetadata !== 'function') return {editable: false, reason: '현재 엔진은 문서 속성 편집 API를 지원하지 않습니다.'};
  try {
    const value = parse(d.getDocumentMetadata());
    if (!value || typeof value.editable !== 'boolean' || (value.reason != null && typeof value.reason !== 'string')) throw new Error('metadata response');
    const values = value.values === undefined ? undefined : validateDocumentMetadataValues(value.values);
    const fingerprint = typeof value.fingerprint === 'string' && /^[0-9a-f]{64}$/u.test(value.fingerprint) ? value.fingerprint : undefined;
    if (value.editable && (!values || !fingerprint)) throw new Error('metadata ownership');
    return {editable: value.editable, values, fingerprint, ...(value.reason ? {reason: value.reason} : {})};
  } catch { return {editable: false, reason: '문서 속성의 원본 소유 정보를 해석하지 못해 편집할 수 없습니다.'}; }
}

function portable<T>(d: any, action: () => T): T {
  const active = d.canvasMetricsActive();
  if (typeof active !== 'boolean') throw new Error('문서 속성 검사의 글꼴 측정 환경을 읽지 못했습니다.');
  try {
    if (active) d.selectCanvasMetrics(false);
    if (d.canvasMetricsActive() !== false) throw new Error('문서 속성 검사의 비교 측정 환경을 선택하지 못했습니다.');
    return action();
  } finally {
    if (active) { d.selectCanvasMetrics(true); if (d.canvasMetricsActive() !== true) throw new Error('문서 속성 검사 후 화면 측정 환경을 복원하지 못했습니다.'); }
  }
}

function layout(d: any): unknown[] {
  const pages = d.pageCount();
  if (!Number.isSafeInteger(pages) || pages < 1 || pages > 200) throw new Error('문서 속성의 지면 검사 한도를 넘었습니다.');
  let nodes = 0, bytes = 0;
  const check = (v: any): void => {
    if (++nodes > 100000) throw new Error('문서 속성의 배치 검사 한도를 넘었습니다.');
    if (typeof v === 'number') { if (!Number.isFinite(v)) throw new Error('유효하지 않은 문서 배치 수치입니다.'); return; }
    if (v === null || ['string', 'boolean'].includes(typeof v)) return;
    if (!v || typeof v !== 'object') throw new Error('문서 배치 응답 형식이 맞지 않습니다.');
    Object.values(v).forEach(check);
  };
  return Array.from({length: pages}, (_, page) => {
    const value = {controls: parse(d.getPageControlLayout(page)), text: parse(d.getPageTextLayout(page))};
    if (!Array.isArray(value.controls?.controls) || !Array.isArray(value.text?.runs)) throw new Error('문서 배치의 전체 필드를 읽지 못했습니다.');
    check(value); bytes += JSON.stringify(value).length;
    if (bytes > 8 * 1024 * 1024) throw new Error('문서 속성의 배치 자료 한도를 넘었습니다.');
    return value;
  });
}
function sameLayout(a: any, b: any): boolean {
  if (typeof a === 'number' && typeof b === 'number') return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 0.2;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => sameLayout(v, b[i]));
  if (a && b && typeof a === 'object' && typeof b === 'object') return Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(k => Object.hasOwn(b, k) && sameLayout(a[k], b[k]));
  return a === b;
}
function assertCurrent(d: any, expected: DocumentMetadata): void {
  const now = readDocumentMetadata(d);
  if (!now.editable || !expected.editable || now.fingerprint !== expected.fingerprint || !same(now.values, expected.values)) throw new Error('문서 속성이 바뀌었습니다. 문서 정보 창을 다시 여세요.');
}
function checkedExport(d: any, format: 'hwp' | 'hwpx', wanted: DocumentMetadataValues, expectedLayout: unknown[]): Uint8Array {
  const artifact = d[format === 'hwp' ? 'exportHwpWithReport' : 'exportHwpxWithReport']();
  let reopened: any;
  try {
    const bytes = artifact.takeBytes();
    verifyPreservedExport(d, bytes, format, artifact.contentLoss(), value => new d.constructor(value));
    reopened = new d.constructor(bytes);
    if (reopened.canvasMetricsActive() !== false || !sameLayout(expectedLayout, layout(reopened))) throw new Error('문서 속성 저장 재열기의 전체 지면이 달라졌습니다.');
    if (!same(readDocumentMetadata(reopened).values, wanted)) throw new Error('문서 속성이 저장 재열기에서 보존되지 않았습니다.');
    return bytes;
  } finally { try { reopened?.free(); } finally { artifact.free(); } }
}

/** Must run inside the caller's snapshot transaction; any failed check rolls back. */
export function applyDocumentMetadata(wasm: any, expected: DocumentMetadata, input: unknown): boolean {
  const d = native(wasm), values = validateDocumentMetadataValues(input);
  return portable(d, () => {
    assertCurrent(d, expected);
    if (same(expected.values, values)) return false;
    const before = capturePreservationEvidence(d), beforeLayout = layout(d);
    if (before.issues.length) throw new Error('문서 속성 편집 전 본문·서식 보존 정보를 읽지 못했습니다.');
    const result = parse(d.setDocumentMetadata(expected.fingerprint, JSON.stringify(values)));
    const after = readDocumentMetadata(d), evidence = capturePreservationEvidence(d);
    const expectedEvidence = {...before.values, 'summary-metadata': values};
    if (result?.changed !== true || !same(result.metadata, parse(d.getDocumentMetadata())) || !after.editable || !same(after.values, values) || evidence.issues.length || !same(expectedEvidence, evidence.values) || !sameLayout(beforeLayout, layout(d))) throw new Error('문서 속성 편집이 본문·서식·지면을 변경했습니다.');
    for (const format of ['hwp', 'hwpx'] as const) checkedExport(d, format, values, beforeLayout);
    return true;
  });
}

/** Saved copy and both output formats must pass before the live undo transaction. */
export function preflightDocumentMetadata(wasm: any, expected: DocumentMetadata, input: unknown): void {
  const d = native(wasm), values = validateDocumentMetadataValues(input);
  portable(d, () => {
    assertCurrent(d, expected);
    if (same(expected.values, values)) return;
    const format = d.getSourceFormat();
    if (!['hwp', 'hwpx'].includes(format)) throw new Error('이 문서 형식의 속성 편집은 지원하지 않습니다.');
    const bytes = checkedExport(d, format, expected.values!, layout(d));
    const scratch = new d.constructor(bytes);
    try {
      const current = readDocumentMetadata(scratch);
      if (!current.editable || !same(current.values, expected.values)) throw new Error('저장 사본의 문서 속성이 원본과 다릅니다.');
      applyDocumentMetadata(scratch, current, values);
    } finally { scratch.free(); }
  });
}
