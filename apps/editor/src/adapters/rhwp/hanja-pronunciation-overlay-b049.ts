import {sha256} from '@noble/hashes/sha2.js';

export type PronunciationRangeB049 = Readonly<{
  section: number;
  startParagraph: number;
  endParagraph: number;
}>;

export type PronunciationParagraphB049 = Readonly<{
  section: number;
  paragraph: number;
  text: string;
  textFingerprint: string;
}>;

export type PronunciationCandidateB049 = Readonly<{
  section: number;
  paragraph: number;
  startOffset: number;
  endOffset: number;
  source: string;
  pronunciation: string;
}>;

export interface PronunciationDocumentPortB049 {
  identity(): unknown;
  revision(): unknown;
  getSectionCount(): number;
  getParagraphCount(section: number): number;
  getParagraphLength(section: number, paragraph: number): number;
  getTextRange(section: number, paragraph: number, start: number, count: number): string;
}

export interface OfflinePronunciationProviderB049 {
  readonly mode: 'offline';
  readonly id: string;
  readonly version: string;
  readonly locale: 'ko-KR';
  lookup(paragraphs: readonly PronunciationParagraphB049[]): unknown;
}

export type PronunciationOverlayB049 = Readonly<{
  schemaVersion: 1;
  documentIdentity: string;
  documentRevision: string;
  providerId: string;
  providerVersion: string;
  locale: 'ko-KR';
  range: PronunciationRangeB049;
  paragraphs: readonly PronunciationParagraphB049[];
  entries: readonly PronunciationCandidateB049[];
  sourceFingerprint: string;
  fingerprint: string;
}>;

const TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,255}$/u;
const MAX_PARAGRAPHS = 200;
const MAX_TEXT_SCALARS = 100_000;
const MAX_ENTRIES = 2_000;

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

function scalarSlice(value: string, start: number, end: number): string {
  return Array.from(value).slice(start, end).join('');
}

function normalizeRange(document: PronunciationDocumentPortB049, value: unknown): PronunciationRangeB049 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('표시 범위가 올바르지 않습니다.');
  const raw = value as Record<string, unknown>;
  if (Object.keys(raw).length !== 3 || Object.keys(raw).some(key => !['section', 'startParagraph', 'endParagraph'].includes(key))
    || !integer(raw.section, 255) || !integer(raw.startParagraph, 10_000) || !integer(raw.endParagraph, 10_000)
    || raw.startParagraph >= raw.endParagraph) throw new Error('표시 범위가 올바르지 않습니다.');
  const sections = document.getSectionCount();
  if (!integer(sections, 256) || sections === 0 || raw.section >= sections) throw new Error('문서 구역을 확인하지 못했습니다.');
  const paragraphs = document.getParagraphCount(raw.section);
  if (!integer(paragraphs, 10_000) || raw.endParagraph > paragraphs || raw.endParagraph - raw.startParagraph > MAX_PARAGRAPHS) {
    throw new Error('표시 문단 범위를 확인하지 못했습니다.');
  }
  return Object.freeze({section: raw.section, startParagraph: raw.startParagraph, endParagraph: raw.endParagraph});
}

function validateProvider(provider: OfflinePronunciationProviderB049): void {
  if (!provider || provider.mode !== 'offline' || provider.locale !== 'ko-KR' || typeof provider.lookup !== 'function') {
    throw new Error('검증된 오프라인 한자 발음 사전만 사용할 수 있습니다.');
  }
  token(provider.id, '사전 식별자');
  token(provider.version, '사전 버전');
}

function readParagraphs(document: PronunciationDocumentPortB049, range: PronunciationRangeB049): PronunciationParagraphB049[] {
  const result: PronunciationParagraphB049[] = [];
  let total = 0;
  for (let paragraph = range.startParagraph; paragraph < range.endParagraph; paragraph += 1) {
    const length = document.getParagraphLength(range.section, paragraph);
    if (!integer(length, MAX_TEXT_SCALARS) || total + length > MAX_TEXT_SCALARS) throw new Error('표시할 본문이 너무 큽니다.');
    const text = document.getTextRange(range.section, paragraph, 0, length);
    if (typeof text !== 'string' || scalarLength(text) !== length) throw new Error('본문 원문을 정확히 읽지 못했습니다.');
    const textFingerprint = hash({section: range.section, paragraph, text});
    result.push(Object.freeze({section: range.section, paragraph, text, textFingerprint}));
    total += length;
  }
  return result;
}

function safePronunciation(value: unknown): value is string {
  return typeof value === 'string' && scalarLength(value) > 0 && scalarLength(value) <= 128
    && !/[\p{Cc}\p{Cf}]/u.test(value) && /^[\p{Script=Hangul}0-9 .·'()-]+$/u.test(value);
}

function validateEntries(value: unknown, paragraphs: readonly PronunciationParagraphB049[]): PronunciationCandidateB049[] {
  if (!Array.isArray(value) || value.length > MAX_ENTRIES) throw new Error('사전 응답 목록이 올바르지 않습니다.');
  const byLocation = new Map(paragraphs.map(item => [`${item.section}:${item.paragraph}`, item]));
  const entries = value.map(candidate => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) throw new Error('사전 응답 항목이 올바르지 않습니다.');
    const raw = candidate as Record<string, unknown>;
    if (Object.keys(raw).length !== 6 || Object.keys(raw).some(key => !['section', 'paragraph', 'startOffset', 'endOffset', 'source', 'pronunciation'].includes(key))
      || !integer(raw.section, 255) || !integer(raw.paragraph, 10_000) || !integer(raw.startOffset, MAX_TEXT_SCALARS)
      || !integer(raw.endOffset, MAX_TEXT_SCALARS) || raw.startOffset >= raw.endOffset || typeof raw.source !== 'string'
      || !safePronunciation(raw.pronunciation)) throw new Error('사전 응답 항목이 올바르지 않습니다.');
    const paragraph = byLocation.get(`${raw.section}:${raw.paragraph}`);
    if (!paragraph || raw.endOffset > scalarLength(paragraph.text)) throw new Error('사전 응답 위치가 표시 범위를 벗어났습니다.');
    const source = scalarSlice(paragraph.text, raw.startOffset, raw.endOffset);
    if (source !== raw.source || !/\p{Script=Han}/u.test(source) || scalarLength(source) > 64) {
      throw new Error('사전 응답 원문이 현재 문서와 다릅니다.');
    }
    return Object.freeze({section: raw.section, paragraph: raw.paragraph, startOffset: raw.startOffset,
      endOffset: raw.endOffset, source, pronunciation: raw.pronunciation});
  });
  entries.sort((left, right) => left.section - right.section || left.paragraph - right.paragraph
    || left.startOffset - right.startOffset || left.endOffset - right.endOffset);
  for (let index = 0; index < entries.length; index += 1) {
    const current = entries[index], previous = entries[index - 1];
    if (previous && current.section === previous.section && current.paragraph === previous.paragraph
      && current.startOffset < previous.endOffset) throw new Error('사전 응답 위치가 겹칩니다.');
  }
  return entries;
}

export function createHanjaPronunciationOverlayB049(
  document: PronunciationDocumentPortB049,
  provider: OfflinePronunciationProviderB049,
  rangeInput: unknown,
): PronunciationOverlayB049 {
  validateProvider(provider);
  const documentIdentity = token(document.identity(), '문서 식별자');
  const documentRevision = token(document.revision(), '문서 버전');
  const range = normalizeRange(document, rangeInput);
  const paragraphs = readParagraphs(document, range);
  const sourceFingerprint = hash({documentIdentity, documentRevision, range, paragraphs});
  let response: unknown;
  try { response = provider.lookup(Object.freeze(paragraphs)); }
  catch { throw new Error('오프라인 한자 발음 사전을 조회하지 못했습니다.'); }
  const entries = validateEntries(response, paragraphs);
  const stable = {schemaVersion: 1 as const, documentIdentity, documentRevision, providerId: provider.id,
    providerVersion: provider.version, locale: provider.locale, range, paragraphs: Object.freeze(paragraphs),
    entries: Object.freeze(entries), sourceFingerprint};
  return Object.freeze({...stable, fingerprint: hash(stable)});
}

export function verifyHanjaPronunciationOverlayB049(
  expected: PronunciationOverlayB049,
  document: PronunciationDocumentPortB049,
  provider: OfflinePronunciationProviderB049,
): PronunciationOverlayB049 {
  if (!expected || expected.schemaVersion !== 1 || !/^[0-9a-f]{64}$/u.test(expected.fingerprint)) {
    throw new Error('표시 상태가 올바르지 않습니다.');
  }
  const current = createHanjaPronunciationOverlayB049(document, provider, expected.range);
  if (current.documentIdentity !== expected.documentIdentity || current.documentRevision !== expected.documentRevision
    || current.providerId !== expected.providerId || current.providerVersion !== expected.providerVersion
    || current.sourceFingerprint !== expected.sourceFingerprint || current.fingerprint !== expected.fingerprint) {
    throw new Error('문서 또는 발음 사전이 바뀌었습니다. 다시 조회해 주세요.');
  }
  return current;
}
