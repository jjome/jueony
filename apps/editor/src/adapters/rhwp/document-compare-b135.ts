import {sha256} from '@noble/hashes/sha2.js';

export interface DocumentComparePortB135 {
  identity(): unknown;
  revision(): unknown;
  getSectionCount(): number;
  getParagraphCount(section: number): number;
  getParagraphLength(section: number, paragraph: number): number;
  getTextRange(section: number, paragraph: number, start: number, count: number): string;
}

export type ComparedParagraphB135 = Readonly<{
  section: number;
  paragraph: number;
  text: string;
  scalarLength: number;
  fingerprint: string;
}>;

export type ScalarChangeB135 = Readonly<{
  beforeStart: number;
  beforeEnd: number;
  afterStart: number;
  afterEnd: number;
}>;

export type DocumentDiffHunkB135 = Readonly<{
  kind: 'equal' | 'insert' | 'delete' | 'replace';
  beforeStart: number;
  beforeEnd: number;
  afterStart: number;
  afterEnd: number;
  before: readonly ComparedParagraphB135[];
  after: readonly ComparedParagraphB135[];
  scalarChange?: ScalarChangeB135;
}>;

export type DocumentCompareResultB135 = Readonly<{
  schemaVersion: 1;
  beforeIdentity: string;
  beforeRevision: string;
  afterIdentity: string;
  afterRevision: string;
  beforeSourceFingerprint: string;
  afterSourceFingerprint: string;
  hunks: readonly DocumentDiffHunkB135[];
  fingerprint: string;
}>;

const TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,255}$/u;
const MAX_SECTIONS = 128;
const MAX_PARAGRAPHS = 512;
const MAX_TEXT_SCALARS = 200_000;
const MAX_PARAGRAPH_SCALARS = 65_536;

function hash(value: unknown): string {
  return [...sha256(new TextEncoder().encode(JSON.stringify(value)))]
    .map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function integer(value: unknown, maximum: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= maximum;
}

function token(value: unknown, label: string): string {
  if (typeof value !== 'string' || !TOKEN.test(value)) throw new Error(`${label}가 올바르지 않습니다.`);
  return value;
}

function read(port: DocumentComparePortB135, label: string): {
  identity: string;
  revision: string;
  paragraphs: ComparedParagraphB135[];
  fingerprint: string;
} {
  const identity = token(port.identity(), `${label} 문서 식별자`);
  const revision = token(port.revision(), `${label} 문서 버전`);
  const sections = port.getSectionCount();
  if (!integer(sections, MAX_SECTIONS) || sections === 0) throw new Error(`${label} 문서 구역을 확인하지 못했습니다.`);
  const paragraphs: ComparedParagraphB135[] = [];
  let total = 0;
  for (let section = 0; section < sections; section += 1) {
    const count = port.getParagraphCount(section);
    if (!integer(count, MAX_PARAGRAPHS) || paragraphs.length + count > MAX_PARAGRAPHS) {
      throw new Error(`${label} 문서의 본문 문단이 너무 많습니다.`);
    }
    for (let paragraph = 0; paragraph < count; paragraph += 1) {
      const length = port.getParagraphLength(section, paragraph);
      if (!integer(length, MAX_PARAGRAPH_SCALARS) || total + length > MAX_TEXT_SCALARS) {
        throw new Error(`${label} 문서의 본문이 너무 큽니다.`);
      }
      const text = port.getTextRange(section, paragraph, 0, length);
      if (typeof text !== 'string' || Array.from(text).length !== length) {
        throw new Error(`${label} 문서의 본문 원문을 정확히 읽지 못했습니다.`);
      }
      total += length;
      paragraphs.push(Object.freeze({section, paragraph, text, scalarLength: length,
        fingerprint: hash({section, paragraph, text})}));
    }
  }
  const fingerprint = hash({identity, revision, paragraphs: paragraphs.map(value => value.fingerprint)});
  return {identity, revision, paragraphs, fingerprint};
}

function verifySeal(
  port: DocumentComparePortB135,
  expected: Readonly<{identity: string; revision: string}>,
  label: string,
): void {
  const identity = token(port.identity(), `${label} 문서 식별자`);
  const revision = token(port.revision(), `${label} 문서 버전`);
  if (identity !== expected.identity || revision !== expected.revision) {
    throw new Error(`${label} 문서가 비교 도중 바뀌었습니다. 다시 비교해 주세요.`);
  }
}

type Step = Readonly<{kind: 'equal' | 'insert' | 'delete'; before?: number; after?: number}>;

function steps(before: readonly ComparedParagraphB135[], after: readonly ComparedParagraphB135[]): Step[] {
  const rows = before.length + 1;
  const columns = after.length + 1;
  const table = new Uint16Array(rows * columns);
  const at = (row: number, column: number): number => row * columns + column;
  for (let row = before.length - 1; row >= 0; row -= 1) {
    for (let column = after.length - 1; column >= 0; column -= 1) {
      table[at(row, column)] = before[row].text === after[column].text
        ? table[at(row + 1, column + 1)] + 1
        : Math.max(table[at(row + 1, column)], table[at(row, column + 1)]);
    }
  }
  const output: Step[] = [];
  let row = 0;
  let column = 0;
  while (row < before.length || column < after.length) {
    if (row < before.length && column < after.length && before[row].text === after[column].text) {
      output.push(Object.freeze({kind: 'equal', before: row, after: column})); row += 1; column += 1;
    } else if (column < after.length && (row === before.length
      || table[at(row, column + 1)] > table[at(row + 1, column)])) {
      output.push(Object.freeze({kind: 'insert', after: column})); column += 1;
    } else {
      output.push(Object.freeze({kind: 'delete', before: row})); row += 1;
    }
  }
  return output;
}

function scalarChange(before: string, after: string): ScalarChangeB135 {
  const left = Array.from(before);
  const right = Array.from(after);
  let prefix = 0;
  while (prefix < left.length && prefix < right.length && left[prefix] === right[prefix]) prefix += 1;
  let suffix = 0;
  while (suffix < left.length - prefix && suffix < right.length - prefix
    && left[left.length - suffix - 1] === right[right.length - suffix - 1]) suffix += 1;
  return Object.freeze({beforeStart: prefix, beforeEnd: left.length - suffix,
    afterStart: prefix, afterEnd: right.length - suffix});
}

function hunks(before: readonly ComparedParagraphB135[], after: readonly ComparedParagraphB135[]): DocumentDiffHunkB135[] {
  const result: DocumentDiffHunkB135[] = [];
  let beforeCursor = 0;
  let afterCursor = 0;
  const sequence = steps(before, after);
  for (let index = 0; index < sequence.length;) {
    const equal = sequence[index].kind === 'equal';
    const startBefore = beforeCursor;
    const startAfter = afterCursor;
    const removed: ComparedParagraphB135[] = [];
    const inserted: ComparedParagraphB135[] = [];
    while (index < sequence.length && (sequence[index].kind === 'equal') === equal) {
      const step = sequence[index];
      if (step.kind === 'equal') {
        removed.push(before[step.before!]); inserted.push(after[step.after!]); beforeCursor += 1; afterCursor += 1;
      } else if (step.kind === 'delete') {
        removed.push(before[step.before!]); beforeCursor += 1;
      } else {
        inserted.push(after[step.after!]); afterCursor += 1;
      }
      index += 1;
    }
    const kind = equal ? 'equal' : removed.length && inserted.length ? 'replace' : removed.length ? 'delete' : 'insert';
    const singleScalarChange = kind === 'replace' && removed.length === 1 && inserted.length === 1
      ? scalarChange(removed[0].text, inserted[0].text) : undefined;
    result.push(Object.freeze({kind, beforeStart: startBefore, beforeEnd: beforeCursor,
      afterStart: startAfter, afterEnd: afterCursor, before: Object.freeze(removed), after: Object.freeze(inserted),
      ...(singleScalarChange ? {scalarChange: singleScalarChange} : {})}));
  }
  return result;
}

export function compareOpenDocumentsB135(
  beforePort: DocumentComparePortB135,
  afterPort: DocumentComparePortB135,
): DocumentCompareResultB135 {
  if (beforePort === afterPort) throw new Error('서로 다른 두 문서를 선택하세요.');
  const before = read(beforePort, '원본');
  const after = read(afterPort, '비교');
  verifySeal(beforePort, before, '원본');
  verifySeal(afterPort, after, '비교');
  const stable = {schemaVersion: 1 as const, beforeIdentity: before.identity, beforeRevision: before.revision,
    afterIdentity: after.identity, afterRevision: after.revision, beforeSourceFingerprint: before.fingerprint,
    afterSourceFingerprint: after.fingerprint, hunks: Object.freeze(hunks(before.paragraphs, after.paragraphs))};
  return Object.freeze({...stable, fingerprint: hash(stable)});
}

export function verifyDocumentComparisonB135(
  expected: DocumentCompareResultB135,
  beforePort: DocumentComparePortB135,
  afterPort: DocumentComparePortB135,
): DocumentCompareResultB135 {
  if (!expected || expected.schemaVersion !== 1 || !/^[0-9a-f]{64}$/u.test(expected.fingerprint)) {
    throw new Error('문서 비교 결과가 올바르지 않습니다.');
  }
  const current = compareOpenDocumentsB135(beforePort, afterPort);
  if (current.fingerprint !== expected.fingerprint || current.beforeSourceFingerprint !== expected.beforeSourceFingerprint
    || current.afterSourceFingerprint !== expected.afterSourceFingerprint) {
    throw new Error('비교한 문서가 바뀌었습니다. 다시 비교해 주세요.');
  }
  return current;
}
