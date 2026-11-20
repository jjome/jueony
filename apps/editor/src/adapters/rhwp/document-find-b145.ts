import {sha256} from '@noble/hashes/sha2.js';

export type DocumentFindRequestB145 = Readonly<{
  query: string;
  caseSensitive: boolean;
}>;

export type DocumentFindParagraphB145 = Readonly<{
  section: number;
  paragraph: number;
  textFingerprint: string;
}>;

export type DocumentFindMatchB145 = Readonly<{
  section: number;
  paragraph: number;
  startOffset: number;
  endOffset: number;
  match: string;
  snippetStartOffset: number;
  snippet: string;
}>;

export type DocumentFocusTargetB145 = Readonly<{
  story: 'body';
  section: number;
  paragraph: number;
  startOffset: number;
  endOffset: number;
}>;

export interface DocumentFindPortB145 {
  identity(): unknown;
  revision(): unknown;
  getSectionCount(): number;
  getParagraphCount(section: number): number;
  getParagraphLength(section: number, paragraph: number): number;
  getTextRange(section: number, paragraph: number, start: number, count: number): string;
  focusTarget?(target: DocumentFocusTargetB145): unknown;
}

export type DocumentFindResultB145 = Readonly<{
  schemaVersion: 1;
  documentIdentity: string;
  documentRevision: string;
  request: DocumentFindRequestB145;
  paragraphs: readonly DocumentFindParagraphB145[];
  matches: readonly DocumentFindMatchB145[];
  truncated: boolean;
  sourceFingerprint: string;
  fingerprint: string;
}>;

const TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,255}$/u;
const MAX_QUERY_SCALARS = 256;
const MAX_SECTIONS = 256;
const MAX_PARAGRAPHS = 10_000;
const MAX_TEXT_SCALARS = 1_000_000;
const MAX_RESULTS = 500;
const SNIPPET_CONTEXT = 24;

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

function normalizeRequest(value: unknown): DocumentFindRequestB145 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('찾기 요청이 올바르지 않습니다.');
  const raw = value as Record<string, unknown>;
  if (Object.keys(raw).length !== 2 || Object.keys(raw).some(key => !['query', 'caseSensitive'].includes(key))
    || typeof raw.query !== 'string' || typeof raw.caseSensitive !== 'boolean') {
    throw new Error('찾기 요청이 올바르지 않습니다.');
  }
  const length = Array.from(raw.query).length;
  if (length === 0 || length > MAX_QUERY_SCALARS || /[\p{Cc}\p{Cf}]/u.test(raw.query)) {
    throw new Error('찾을 문자열이 올바르지 않습니다.');
  }
  return Object.freeze({query: raw.query, caseSensitive: raw.caseSensitive});
}

function comparable(value: string, caseSensitive: boolean): string[] {
  return Array.from(value, scalar => caseSensitive ? scalar : scalar.toLocaleLowerCase('ko-KR'));
}

function findOffsets(text: string, request: DocumentFindRequestB145): Array<readonly [number, number]> {
  const haystack = comparable(text, request.caseSensitive);
  const needle = comparable(request.query, request.caseSensitive);
  const offsets: Array<readonly [number, number]> = [];
  for (let start = 0; start + needle.length <= haystack.length; start += 1) {
    let matched = true;
    for (let index = 0; index < needle.length; index += 1) {
      if (haystack[start + index] !== needle[index]) { matched = false; break; }
    }
    if (matched) offsets.push(Object.freeze([start, start + needle.length] as const));
  }
  return offsets;
}

function readDocument(document: DocumentFindPortB145, request: DocumentFindRequestB145): {
  paragraphs: DocumentFindParagraphB145[];
  matches: DocumentFindMatchB145[];
  truncated: boolean;
} {
  const sections = document.getSectionCount();
  if (!integer(sections, MAX_SECTIONS) || sections === 0) throw new Error('문서 구역을 확인하지 못했습니다.');
  const paragraphs: DocumentFindParagraphB145[] = [];
  const matches: DocumentFindMatchB145[] = [];
  let paragraphTotal = 0;
  let textTotal = 0;
  let truncated = false;
  for (let section = 0; section < sections; section += 1) {
    const count = document.getParagraphCount(section);
    if (!integer(count, MAX_PARAGRAPHS) || paragraphTotal + count > MAX_PARAGRAPHS) {
      throw new Error('검색할 본문 문단이 너무 많습니다.');
    }
    paragraphTotal += count;
    for (let paragraph = 0; paragraph < count; paragraph += 1) {
      const length = document.getParagraphLength(section, paragraph);
      if (!integer(length, MAX_TEXT_SCALARS) || textTotal + length > MAX_TEXT_SCALARS) {
        throw new Error('검색할 본문이 너무 큽니다.');
      }
      const text = document.getTextRange(section, paragraph, 0, length);
      if (typeof text !== 'string' || Array.from(text).length !== length) throw new Error('본문 원문을 정확히 읽지 못했습니다.');
      textTotal += length;
      paragraphs.push(Object.freeze({section, paragraph, textFingerprint: hash({section, paragraph, text})}));
      if (truncated) continue;
      const scalars = Array.from(text);
      for (const [startOffset, endOffset] of findOffsets(text, request)) {
        if (matches.length >= MAX_RESULTS) { truncated = true; break; }
        const snippetStartOffset = Math.max(0, startOffset - SNIPPET_CONTEXT);
        const snippetEndOffset = Math.min(scalars.length, endOffset + SNIPPET_CONTEXT);
        matches.push(Object.freeze({section, paragraph, startOffset, endOffset,
          match: scalars.slice(startOffset, endOffset).join(''), snippetStartOffset,
          snippet: scalars.slice(snippetStartOffset, snippetEndOffset).join('')}));
      }
    }
  }
  return {paragraphs, matches, truncated};
}

export function findInOpenDocumentB145(document: DocumentFindPortB145, requestInput: unknown): DocumentFindResultB145 {
  const request = normalizeRequest(requestInput);
  const documentIdentity = token(document.identity(), '문서 식별자');
  const documentRevision = token(document.revision(), '문서 버전');
  const {paragraphs, matches, truncated} = readDocument(document, request);
  const sourceFingerprint = hash({documentIdentity, documentRevision, paragraphs});
  const stable = {schemaVersion: 1 as const, documentIdentity, documentRevision, request,
    paragraphs: Object.freeze(paragraphs), matches: Object.freeze(matches), truncated, sourceFingerprint};
  return Object.freeze({...stable, fingerprint: hash(stable)});
}

export function verifyDocumentFindResultB145(
  expected: DocumentFindResultB145,
  document: DocumentFindPortB145,
): DocumentFindResultB145 {
  if (!expected || expected.schemaVersion !== 1 || !/^[0-9a-f]{64}$/u.test(expected.fingerprint)) {
    throw new Error('찾기 결과가 올바르지 않습니다.');
  }
  const current = findInOpenDocumentB145(document, expected.request);
  if (current.documentIdentity !== expected.documentIdentity || current.documentRevision !== expected.documentRevision
    || current.sourceFingerprint !== expected.sourceFingerprint || current.fingerprint !== expected.fingerprint) {
    throw new Error('문서가 바뀌었습니다. 다시 찾아 주세요.');
  }
  return current;
}

export function focusDocumentFindMatchB145(
  expected: DocumentFindResultB145,
  matchIndex: unknown,
  document: DocumentFindPortB145,
): DocumentFocusTargetB145 {
  if (!integer(matchIndex, MAX_RESULTS - 1) || matchIndex >= expected.matches.length) throw new Error('이동할 찾기 결과가 올바르지 않습니다.');
  const verified = verifyDocumentFindResultB145(expected, document);
  if (typeof document.focusTarget !== 'function') throw new Error('현재 편집기는 찾기 결과 이동을 지원하지 않습니다.');
  const match = verified.matches[matchIndex];
  const target = Object.freeze({story: 'body' as const, section: match.section, paragraph: match.paragraph,
    startOffset: match.startOffset, endOffset: match.endOffset});
  let response: unknown;
  try { response = document.focusTarget(target); }
  catch { throw new Error('찾기 결과로 이동하지 못했습니다.'); }
  if (!response || typeof response !== 'object' || (response as Record<string, unknown>).ok !== true) {
    throw new Error('찾기 결과로 이동하지 못했습니다.');
  }
  if (token(document.identity(), '문서 식별자') !== verified.documentIdentity
    || token(document.revision(), '문서 버전') !== verified.documentRevision) {
    throw new Error('결과로 이동하는 동안 문서가 바뀌었습니다.');
  }
  return target;
}
