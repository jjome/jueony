import {sha256} from '@noble/hashes/sha2.js';
import {
  verifyDocumentComparisonB135,
  type DocumentComparePortB135,
  type DocumentCompareResultB135,
  type DocumentDiffHunkB135,
  type ScalarChangeB135,
} from './document-compare-b135.ts';

export type TrackedChangeKindB133 = 'insert' | 'delete' | 'replace';

export type TrackedChangeB133 = Readonly<{
  id: string;
  kind: TrackedChangeKindB133;
  beforeStart: number;
  beforeEnd: number;
  afterStart: number;
  afterEnd: number;
  beforeText: readonly string[];
  afterText: readonly string[];
  scalarChange?: ScalarChangeB135;
}>;

export type TrackedChangeViewB133 = Readonly<{
  schemaVersion: 1;
  mode: 'comparison-snapshot';
  beforeIdentity: string;
  beforeRevision: string;
  afterIdentity: string;
  afterRevision: string;
  comparisonFingerprint: string;
  changes: readonly TrackedChangeB133[];
  fingerprint: string;
}>;

const DIGEST = /^[0-9a-f]{64}$/u;
const MAX_CHANGES = 512;

function hash(value: unknown): string {
  return [...sha256(new TextEncoder().encode(JSON.stringify(value)))]
    .map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function change(hunk: DocumentDiffHunkB135, index: number, comparisonFingerprint: string): TrackedChangeB133 {
  if (hunk.kind === 'equal') throw new Error('같은 문단은 변경 표시 대상이 아닙니다.');
  const stable = {
    kind: hunk.kind,
    beforeStart: hunk.beforeStart,
    beforeEnd: hunk.beforeEnd,
    afterStart: hunk.afterStart,
    afterEnd: hunk.afterEnd,
    beforeText: Object.freeze(hunk.before.map(paragraph => paragraph.text)),
    afterText: Object.freeze(hunk.after.map(paragraph => paragraph.text)),
    ...(hunk.scalarChange ? {scalarChange: hunk.scalarChange} : {}),
  };
  return Object.freeze({id: hash({comparisonFingerprint, index, ...stable}), ...stable});
}

/**
 * Produces a read-only change-mark projection from two explicitly selected,
 * still-open documents. This is deliberately not a live editing tracker: it
 * never mutates either document and it refuses stale comparison evidence.
 */
export function createTrackedChangeViewB133(
  comparison: DocumentCompareResultB135,
  beforePort: DocumentComparePortB135,
  afterPort: DocumentComparePortB135,
): TrackedChangeViewB133 {
  const verified = verifyDocumentComparisonB135(comparison, beforePort, afterPort);
  const changed = verified.hunks.filter(hunk => hunk.kind !== 'equal');
  if (changed.length > MAX_CHANGES) throw new Error('표시할 변경 항목이 너무 많습니다.');
  const changes = Object.freeze(changed.map((hunk, index) => change(hunk, index, verified.fingerprint)));
  const stable = {
    schemaVersion: 1 as const,
    mode: 'comparison-snapshot' as const,
    beforeIdentity: verified.beforeIdentity,
    beforeRevision: verified.beforeRevision,
    afterIdentity: verified.afterIdentity,
    afterRevision: verified.afterRevision,
    comparisonFingerprint: verified.fingerprint,
    changes,
  };
  return Object.freeze({...stable, fingerprint: hash(stable)});
}

export function verifyTrackedChangeViewB133(
  expected: TrackedChangeViewB133,
  comparison: DocumentCompareResultB135,
  beforePort: DocumentComparePortB135,
  afterPort: DocumentComparePortB135,
): TrackedChangeViewB133 {
  if (!expected || expected.schemaVersion !== 1 || expected.mode !== 'comparison-snapshot'
    || !DIGEST.test(expected.fingerprint) || !DIGEST.test(expected.comparisonFingerprint)) {
    throw new Error('변경 내용 표시 결과가 올바르지 않습니다.');
  }
  const current = createTrackedChangeViewB133(comparison, beforePort, afterPort);
  if (current.fingerprint !== expected.fingerprint
    || current.comparisonFingerprint !== expected.comparisonFingerprint) {
    throw new Error('비교 문서 또는 변경 내용 표시 결과가 바뀌었습니다.');
  }
  return current;
}
