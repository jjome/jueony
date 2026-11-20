import {sha256} from '@noble/hashes/sha2.js';

export type ProofreadingMarkKindB132 = 'insert' | 'delete' | 'replace' | 'transpose' | 'spacing' | 'punctuation';

export type ProofreadingMarkInputB132 = Readonly<{
  id: string;
  kind: ProofreadingMarkKindB132;
  section: number;
  paragraph: number;
  startOffset: number;
  endOffset: number;
  original: string;
  note: string;
}>;

export interface LocalProofreadingSourceB132 {
  readonly mode: 'local';
  readonly id: string;
  readonly version: string;
  readonly marks: readonly unknown[];
}

export interface ProofreadingDocumentPortB132 {
  identity(): unknown;
  revision(): unknown;
  getSectionCount(): number;
  getParagraphCount(section: number): number;
  getParagraphLength(section: number, paragraph: number): number;
  getTextRange(section: number, paragraph: number, start: number, count: number): string;
}

export type ProofreadingParagraphB132 = Readonly<{
  section: number;
  paragraph: number;
  textFingerprint: string;
}>;

export type ProofreadingOverlayEntryB132 = ProofreadingMarkInputB132 & Readonly<{
  story: 'body';
  anchorId: string;
}>;

export type ProofreadingOverlayB132 = Readonly<{
  schemaVersion: 1;
  documentIdentity: string;
  documentRevision: string;
  sourceId: string;
  sourceVersion: string;
  paragraphs: readonly ProofreadingParagraphB132[];
  entries: readonly ProofreadingOverlayEntryB132[];
  sourceFingerprint: string;
  fingerprint: string;
}>;

const TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,255}$/u;
const KINDS = new Set<ProofreadingMarkKindB132>(['insert', 'delete', 'replace', 'transpose', 'spacing', 'punctuation']);
const MAX_MARKS = 500;
const MAX_PARAGRAPHS = 10_000;
const MAX_PARAGRAPH_SCALARS = 100_000;
const MAX_NOTE_SCALARS = 512;
const MAX_ORIGINAL_SCALARS = 4_000;

function hash(value: unknown): string {
  return [...sha256(new TextEncoder().encode(JSON.stringify(value)))]
    .map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function integer(value: unknown, maximum = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= maximum;
}

function token(value: unknown, label: string): string {
  if (typeof value !== 'string' || !TOKEN.test(value)) throw new Error(`${label}가 올바르지 않습니다.`);
  return value;
}

function scalarLength(value: string): number { return Array.from(value).length; }
function scalarSlice(value: string, start: number, end: number): string { return Array.from(value).slice(start, end).join(''); }

function safeText(value: unknown, maximum: number, empty = false): value is string {
  return typeof value === 'string' && (empty || scalarLength(value) > 0) && scalarLength(value) <= maximum
    && !/[\p{Cc}\p{Cf}]/u.test(value);
}

function validateSource(source: LocalProofreadingSourceB132): void {
  if (!source || source.mode !== 'local' || !Array.isArray(source.marks) || source.marks.length > MAX_MARKS) {
    throw new Error('명시적인 로컬 교정 부호 목록만 표시할 수 있습니다.');
  }
  token(source.id, '표식 출처 식별자');
  token(source.version, '표식 출처 버전');
}

function readParagraph(
  document: ProofreadingDocumentPortB132,
  section: number,
  paragraph: number,
): {text: string; proof: ProofreadingParagraphB132} {
  const sections = document.getSectionCount();
  if (!integer(sections, 256) || sections === 0 || section >= sections) throw new Error('교정 부호 구역을 확인하지 못했습니다.');
  const paragraphs = document.getParagraphCount(section);
  if (!integer(paragraphs, MAX_PARAGRAPHS) || paragraph >= paragraphs) throw new Error('교정 부호 문단을 확인하지 못했습니다.');
  const length = document.getParagraphLength(section, paragraph);
  if (!integer(length, MAX_PARAGRAPH_SCALARS)) throw new Error('교정 부호 문단이 너무 큽니다.');
  const text = document.getTextRange(section, paragraph, 0, length);
  if (typeof text !== 'string' || scalarLength(text) !== length) throw new Error('교정 부호 원문을 정확히 읽지 못했습니다.');
  return {text, proof: Object.freeze({section, paragraph, textFingerprint: hash({section, paragraph, text})})};
}

function parseMark(value: unknown): ProofreadingMarkInputB132 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('교정 부호 항목이 올바르지 않습니다.');
  const raw = value as Record<string, unknown>;
  const keys = ['id', 'kind', 'section', 'paragraph', 'startOffset', 'endOffset', 'original', 'note'];
  if (Object.keys(raw).length !== keys.length || Object.keys(raw).some(key => !keys.includes(key))) {
    throw new Error('교정 부호 항목이 올바르지 않습니다.');
  }
  const id = token(raw.id, '교정 부호 식별자');
  if (typeof raw.kind !== 'string' || !KINDS.has(raw.kind as ProofreadingMarkKindB132)
    || !integer(raw.section, 255) || !integer(raw.paragraph, MAX_PARAGRAPHS - 1)
    || !integer(raw.startOffset, MAX_PARAGRAPH_SCALARS) || !integer(raw.endOffset, MAX_PARAGRAPH_SCALARS)
    || raw.endOffset < raw.startOffset || !safeText(raw.original, MAX_ORIGINAL_SCALARS, true)
    || !safeText(raw.note, MAX_NOTE_SCALARS)) throw new Error('교정 부호 항목이 올바르지 않습니다.');
  const kind = raw.kind as ProofreadingMarkKindB132;
  if ((kind === 'insert') !== (raw.startOffset === raw.endOffset) || (kind === 'insert') !== (raw.original === '')) {
    throw new Error('삽입 교정 부호의 원문 범위가 올바르지 않습니다.');
  }
  return Object.freeze({id, kind, section: raw.section, paragraph: raw.paragraph,
    startOffset: raw.startOffset, endOffset: raw.endOffset, original: raw.original, note: raw.note});
}

function overlaps(left: ProofreadingMarkInputB132, right: ProofreadingMarkInputB132): boolean {
  if (left.section !== right.section || left.paragraph !== right.paragraph) return false;
  const leftPoint = left.startOffset === left.endOffset, rightPoint = right.startOffset === right.endOffset;
  if (leftPoint && rightPoint) return left.startOffset === right.startOffset;
  if (leftPoint) return left.startOffset > right.startOffset && left.startOffset < right.endOffset;
  if (rightPoint) return right.startOffset > left.startOffset && right.startOffset < left.endOffset;
  return left.startOffset < right.endOffset && right.startOffset < left.endOffset;
}

export function createProofreadingOverlayB132(
  document: ProofreadingDocumentPortB132,
  source: LocalProofreadingSourceB132,
): ProofreadingOverlayB132 {
  validateSource(source);
  const documentIdentity = token(document.identity(), '문서 식별자');
  const documentRevision = token(document.revision(), '문서 버전');
  const marks = source.marks.map(parseMark);
  const ids = new Set<string>();
  for (const mark of marks) {
    if (ids.has(mark.id)) throw new Error('교정 부호 식별자가 중복됩니다.');
    ids.add(mark.id);
  }
  marks.sort((left, right) => left.section - right.section || left.paragraph - right.paragraph
    || left.startOffset - right.startOffset || left.endOffset - right.endOffset || left.id.localeCompare(right.id));
  for (let index = 1; index < marks.length; index += 1) {
    if (overlaps(marks[index - 1], marks[index])) throw new Error('교정 부호 원문 범위가 겹칩니다.');
  }
  const paragraphCache = new Map<string, {text: string; proof: ProofreadingParagraphB132}>();
  const entries = marks.map(mark => {
    const key = `${mark.section}:${mark.paragraph}`;
    let paragraph = paragraphCache.get(key);
    if (!paragraph) { paragraph = readParagraph(document, mark.section, mark.paragraph); paragraphCache.set(key, paragraph); }
    if (mark.endOffset > scalarLength(paragraph.text) || scalarSlice(paragraph.text, mark.startOffset, mark.endOffset) !== mark.original) {
      throw new Error('교정 부호 원문이 현재 문서와 다릅니다.');
    }
    const anchor = {story: 'body' as const, section: mark.section, paragraph: mark.paragraph,
      startOffset: mark.startOffset, endOffset: mark.endOffset, kind: mark.kind, id: mark.id};
    return Object.freeze({...mark, story: 'body' as const, anchorId: hash(anchor)});
  });
  const paragraphs = [...paragraphCache.values()].map(value => value.proof)
    .sort((left, right) => left.section - right.section || left.paragraph - right.paragraph);
  const sourceFingerprint = hash({documentIdentity, documentRevision, sourceId: source.id,
    sourceVersion: source.version, paragraphs, marks});
  const stable = {schemaVersion: 1 as const, documentIdentity, documentRevision, sourceId: source.id,
    sourceVersion: source.version, paragraphs: Object.freeze(paragraphs), entries: Object.freeze(entries), sourceFingerprint};
  return Object.freeze({...stable, fingerprint: hash(stable)});
}

export function verifyProofreadingOverlayB132(
  expected: ProofreadingOverlayB132,
  document: ProofreadingDocumentPortB132,
  source: LocalProofreadingSourceB132,
): ProofreadingOverlayB132 {
  if (!expected || expected.schemaVersion !== 1 || !/^[0-9a-f]{64}$/u.test(expected.fingerprint)) {
    throw new Error('교정 부호 표시 상태가 올바르지 않습니다.');
  }
  const current = createProofreadingOverlayB132(document, source);
  if (current.documentIdentity !== expected.documentIdentity || current.documentRevision !== expected.documentRevision
    || current.sourceId !== expected.sourceId || current.sourceVersion !== expected.sourceVersion
    || current.sourceFingerprint !== expected.sourceFingerprint || current.fingerprint !== expected.fingerprint) {
    throw new Error('문서 또는 교정 부호 목록이 바뀌었습니다. 다시 표시해 주세요.');
  }
  return current;
}
