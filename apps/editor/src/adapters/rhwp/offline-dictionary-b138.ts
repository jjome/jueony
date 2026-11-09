import {sha256} from '@noble/hashes/sha2.js';

export type DictionaryKindB138 = 'korean' | 'hanja' | 'thesaurus';

export type DictionarySelectionB138 = Readonly<{
  story: 'body';
  section: number;
  paragraph: number;
  start: number;
  end: number;
}>;

export interface DictionaryDocumentPortB138 {
  identity(): unknown;
  revision(): unknown;
  getSelection(): unknown;
  getSectionCount(): number;
  getParagraphCount(section: number): number;
  getParagraphLength(section: number, paragraph: number): number;
  getTextRange(section: number, paragraph: number, start: number, count: number): string;
}

export type DictionaryRequestB138 = Readonly<{
  schemaVersion: 1;
  kind: DictionaryKindB138;
  locale: 'ko-KR';
  query: string;
  queryFingerprint: string;
}>;

export interface OfflineDictionaryProviderB138 {
  readonly mode: 'offline';
  readonly id: string;
  readonly version: string;
  readonly locale: 'ko-KR';
  lookup(request: DictionaryRequestB138): unknown;
}

export type DictionaryEntryB138 = Readonly<{
  headword: string;
  partOfSpeech: string | null;
  definitions: readonly string[];
  synonyms: readonly string[];
}>;

export type DictionaryLookupB138 = Readonly<{
  schemaVersion: 1;
  documentIdentity: string;
  documentRevision: string;
  providerId: string;
  providerVersion: string;
  locale: 'ko-KR';
  kind: DictionaryKindB138;
  selection: DictionarySelectionB138;
  query: string;
  queryFingerprint: string;
  entries: readonly DictionaryEntryB138[];
  responseFingerprint: string;
  fingerprint: string;
}>;

const TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,255}$/u;
const WORD = /[\p{L}\p{N}]/u;
const MAX_QUERY_SCALARS = 128;
const MAX_ENTRIES = 32;
const MAX_DEFINITIONS = 16;
const MAX_SYNONYMS = 32;

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

function safeText(value: unknown, maximum: number, label: string): string {
  if (typeof value !== 'string' || scalarLength(value) === 0 || scalarLength(value) > maximum
    || value !== value.trim() || /[\p{Cc}\p{Cf}]/u.test(value)) throw new Error(`${label}가 올바르지 않습니다.`);
  return value;
}

function validateProvider(provider: OfflineDictionaryProviderB138): void {
  if (!provider || provider.mode !== 'offline' || provider.locale !== 'ko-KR' || typeof provider.lookup !== 'function') {
    throw new Error('검증된 오프라인 사전만 사용할 수 있습니다.');
  }
  token(provider.id, '사전 식별자');
  token(provider.version, '사전 버전');
}

function selection(document: DictionaryDocumentPortB138): DictionarySelectionB138 {
  const value = document.getSelection();
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('사전 조회 선택을 확인하지 못했습니다.');
  const raw = value as Record<string, unknown>;
  const keys = ['story', 'section', 'paragraph', 'start', 'end'];
  if (Object.keys(raw).length !== keys.length || Object.keys(raw).some(key => !keys.includes(key))
    || raw.story !== 'body' || !integer(raw.section, 255) || !integer(raw.paragraph, 100_000)
    || !integer(raw.start, 1_000_000) || !integer(raw.end, 1_000_000) || raw.start > raw.end) {
    throw new Error('최상위 본문의 한 위치만 사전에서 조회할 수 있습니다.');
  }
  const sectionCount = document.getSectionCount();
  if (!integer(sectionCount, 256) || sectionCount === 0 || raw.section >= sectionCount) throw new Error('문서 구역을 확인하지 못했습니다.');
  const paragraphCount = document.getParagraphCount(raw.section);
  if (!integer(paragraphCount, 100_000) || raw.paragraph >= paragraphCount) throw new Error('문서 문단을 확인하지 못했습니다.');
  const paragraphLength = document.getParagraphLength(raw.section, raw.paragraph);
  if (!integer(paragraphLength, 1_000_000) || raw.end > paragraphLength) throw new Error('사전 조회 범위가 본문을 벗어났습니다.');
  return Object.freeze({story: 'body', section: raw.section, paragraph: raw.paragraph, start: raw.start, end: raw.end});
}

function queryAt(document: DictionaryDocumentPortB138, selected: DictionarySelectionB138): {selection: DictionarySelectionB138; query: string} {
  const length = document.getParagraphLength(selected.section, selected.paragraph);
  const text = document.getTextRange(selected.section, selected.paragraph, 0, length);
  if (typeof text !== 'string' || scalarLength(text) !== length) throw new Error('사전 조회 원문을 정확히 읽지 못했습니다.');
  const scalars = Array.from(text);
  let start = selected.start, end = selected.end;
  if (start === end) {
    if (start === scalars.length && start > 0) start -= 1;
    if (!WORD.test(scalars[start] ?? '')) throw new Error('커서 위치에서 조회할 낱말을 찾지 못했습니다.');
    end = start + 1;
    while (start > 0 && WORD.test(scalars[start - 1])) start -= 1;
    while (end < scalars.length && WORD.test(scalars[end])) end += 1;
  }
  const query = scalars.slice(start, end).join('');
  safeText(query, MAX_QUERY_SCALARS, '사전 조회 낱말');
  return {selection: Object.freeze({...selected, start, end}), query};
}

function safeList(value: unknown, maximumItems: number, maximumLength: number, label: string): readonly string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > maximumItems) throw new Error(`${label} 목록이 올바르지 않습니다.`);
  const result = value.map(item => safeText(item, maximumLength, label));
  if (new Set(result).size !== result.length) throw new Error(`${label} 목록에 중복이 있습니다.`);
  return Object.freeze(result);
}

function entries(value: unknown, requestFingerprint: string): readonly DictionaryEntryB138[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('사전 응답이 올바르지 않습니다.');
  const raw = value as Record<string, unknown>;
  if (Object.keys(raw).length !== 2 || Object.keys(raw).some(key => !['requestFingerprint', 'entries'].includes(key))
    || raw.requestFingerprint !== requestFingerprint || !Array.isArray(raw.entries) || raw.entries.length > MAX_ENTRIES) {
    throw new Error('사전 응답이 현재 요청과 일치하지 않습니다.');
  }
  const result = raw.entries.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('사전 표제어가 올바르지 않습니다.');
    const entry = item as Record<string, unknown>;
    const keys = ['headword', 'partOfSpeech', 'definitions', 'synonyms'];
    if (Object.keys(entry).length !== keys.length || Object.keys(entry).some(key => !keys.includes(key))) {
      throw new Error('사전 표제어가 올바르지 않습니다.');
    }
    const headword = safeText(entry.headword, 128, '표제어');
    const partOfSpeech = entry.partOfSpeech === null ? null : safeText(entry.partOfSpeech, 64, '품사');
    const definitions = safeList(entry.definitions, MAX_DEFINITIONS, 1_024, '뜻풀이');
    const synonyms = entry.synonyms === null ? Object.freeze([]) : safeList(entry.synonyms, MAX_SYNONYMS, 128, '유의어');
    return Object.freeze({headword, partOfSpeech, definitions, synonyms});
  });
  const duplicateKey = result.map(item => `${item.headword}\u0000${item.partOfSpeech ?? ''}`);
  if (new Set(duplicateKey).size !== duplicateKey.length) throw new Error('사전 응답에 중복 표제어가 있습니다.');
  return Object.freeze(result);
}

export function lookupOfflineDictionaryB138(
  document: DictionaryDocumentPortB138,
  provider: OfflineDictionaryProviderB138,
  kind: DictionaryKindB138,
): DictionaryLookupB138 {
  validateProvider(provider);
  if (!['korean', 'hanja', 'thesaurus'].includes(kind)) throw new Error('사전 종류가 올바르지 않습니다.');
  const documentIdentity = token(document.identity(), '문서 식별자');
  const documentRevision = token(document.revision(), '문서 버전');
  const resolved = queryAt(document, selection(document));
  const queryFingerprint = hash({documentIdentity, documentRevision, selection: resolved.selection, query: resolved.query,
    providerId: provider.id, providerVersion: provider.version, kind, locale: provider.locale});
  const request = Object.freeze({schemaVersion: 1 as const, kind, locale: provider.locale, query: resolved.query, queryFingerprint});
  let response: unknown;
  try { response = provider.lookup(request); }
  catch { throw new Error('오프라인 사전을 조회하지 못했습니다.'); }
  const validatedEntries = entries(response, queryFingerprint);
  const responseFingerprint = hash({requestFingerprint: queryFingerprint, entries: validatedEntries});
  const stable = {schemaVersion: 1 as const, documentIdentity, documentRevision, providerId: provider.id,
    providerVersion: provider.version, locale: provider.locale, kind, selection: resolved.selection, query: resolved.query,
    queryFingerprint, entries: validatedEntries, responseFingerprint};
  return Object.freeze({...stable, fingerprint: hash(stable)});
}

export function verifyOfflineDictionaryLookupB138(
  expected: DictionaryLookupB138,
  document: DictionaryDocumentPortB138,
  provider: OfflineDictionaryProviderB138,
): DictionaryLookupB138 {
  if (!expected || expected.schemaVersion !== 1 || !/^[0-9a-f]{64}$/u.test(expected.fingerprint)) {
    throw new Error('사전 조회 상태가 올바르지 않습니다.');
  }
  const current = lookupOfflineDictionaryB138(document, provider, expected.kind);
  if (current.documentIdentity !== expected.documentIdentity || current.documentRevision !== expected.documentRevision
    || current.providerId !== expected.providerId || current.providerVersion !== expected.providerVersion
    || current.selection.start !== expected.selection.start || current.selection.end !== expected.selection.end
    || current.queryFingerprint !== expected.queryFingerprint || current.responseFingerprint !== expected.responseFingerprint
    || current.fingerprint !== expected.fingerprint) throw new Error('문서 또는 오프라인 사전이 바뀌었습니다. 다시 조회해 주세요.');
  return current;
}
