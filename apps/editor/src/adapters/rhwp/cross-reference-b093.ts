import {sha256} from '@noble/hashes/sha2.js';

type JsonRecord = Record<string, unknown>;

export type CrossReferenceBookmarkB093 = Readonly<{
  name: string;
  section: number;
  paragraph: number;
  controlIndex: number;
  charOffset: number;
}>;

export type CrossReferenceFieldB093 = Readonly<{
  fieldId: number;
  targetName: string;
  command: string;
  displayText: string;
  section: number;
  paragraph: number;
  start: number;
  end: number;
}>;

export type CrossReferenceSnapshotB093 = Readonly<{
  schemaVersion: 1;
  documentIdentity: string;
  revision: string;
  sourceFormat: 'hwp' | 'hwpx';
  fingerprint: string;
  bookmarks: readonly CrossReferenceBookmarkB093[];
  fields: readonly CrossReferenceFieldB093[];
  paragraphLengths: readonly (readonly number[])[];
}>;

export type CrossReferencePlanB093 = Readonly<{
  schemaVersion: 1;
  kind: 'insert' | 'update-display';
  expectedDocumentIdentity: string;
  expectedRevision: string;
  expectedFingerprint: string;
  bookmark: CrossReferenceBookmarkB093;
  section: number;
  paragraph: number;
  charOffset: number;
  displayText: string;
  fieldId?: number;
  expectedOldDisplayText?: string;
}>;

export interface CrossReferenceDocumentB093 {
  getSourceFormat(): unknown;
  getSectionCount(): number;
  getParagraphCount(section: number): number;
  getParagraphLength(section: number, paragraph: number): number;
  getBookmarks(): unknown;
  getControls(): unknown;
  getFieldList(): unknown;
  insertCrossReferenceB093(
    section: number,
    paragraph: number,
    charOffset: number,
    bookmarkName: string,
    bookmarkSection: number,
    bookmarkParagraph: number,
    bookmarkControlIndex: number,
    bookmarkCharOffset: number,
    displayText: string,
  ): unknown;
  setFieldValue(fieldId: number, value: string): unknown;
  saveSnapshot(): number;
  restoreSnapshot(id: number): unknown;
  discardSnapshot(id: number): void;
  exportHwp(): Uint8Array;
  exportHwpx(): Uint8Array;
  free?(): void;
}

export type CrossReferenceOwnerB093 = Readonly<{
  documentIdentity(): string;
  revision(): string;
  editable(): boolean;
  protected(): boolean;
  story(): string;
}>;

export type CrossReferenceReceiptB093 = Readonly<{
  fieldId: number;
  beforeRevision: string;
  afterRevision: string;
  undo(): void;
  redo(): void;
  dispose(): void;
}>;

export type CrossReferenceCapabilityAuditB093 = Readonly<{
  status: 'partial' | 'ready';
  storedFieldQuery: boolean;
  storedDisplayUpdate: boolean;
  namedBodyInsertion: boolean;
  automaticTargetResolution: false;
  reason: string;
}>;

const parsed = (value: unknown): unknown => typeof value === 'string' ? JSON.parse(value) : value;
const record = (value: unknown): value is JsonRecord => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const uint = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
const token = (value: unknown, limit = 512): value is string => typeof value === 'string' && value.length > 0 && value.length <= limit;
const safeName = (value: unknown): value is string => token(value, 100)
  && value.trim() === value && !/[;?#\u0000-\u001f\u007f-\u009f]/u.test(value)
  && new TextEncoder().encode(value).length <= 400;
const safeDisplay = (value: unknown): value is string => token(value, 1_000)
  && !/[\u0000-\u001f\u007f-\u009f]/u.test(value);
const commandFor = (name: string): string => `?${name};0;1;1;0;`;

/**
 * Reports the actual public engine surface.  Existing rhwp builds can query CrossRef fields and
 * replace their stored display range, but B093 insertion is not available until a separately
 * compiled engine exposes `insertCrossReferenceB093`.  Automatic bookmark evaluation is not
 * claimed: the current renderer displays the stored field range.
 */
export function auditCrossReferenceCapabilityB093(document: Partial<CrossReferenceDocumentB093>): CrossReferenceCapabilityAuditB093 {
  const storedFieldQuery = typeof document.getFieldList === 'function' && typeof document.getBookmarks === 'function';
  const storedDisplayUpdate = storedFieldQuery && typeof document.setFieldValue === 'function';
  const namedBodyInsertion = storedDisplayUpdate && typeof document.insertCrossReferenceB093 === 'function';
  return Object.freeze({
    status: namedBodyInsertion ? 'ready' : 'partial',
    storedFieldQuery,
    storedDisplayUpdate,
    namedBodyInsertion,
    automaticTargetResolution: false,
    reason: namedBodyInsertion
      ? '검증된 일반 본문 책갈피 삽입 API가 연결되었습니다. 표시 문자열 갱신은 명시적입니다.'
      : '현재 공개 엔진에는 상호참조 삽입 API가 없습니다. 일반 텍스트로 대체하지 않으며 조회·기존 표시값 갱신만 별도 검증 대상입니다.',
  });
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (!record(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
}

function digest(value: unknown): string {
  return Array.from(sha256(new TextEncoder().encode(JSON.stringify(canonical(value)))), byte => byte.toString(16).padStart(2, '0')).join('');
}

function readBookmarks(document: CrossReferenceDocumentB093): CrossReferenceBookmarkB093[] {
  const raw = parsed(document.getBookmarks());
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 200) throw new Error('B093 책갈피 목록을 확인할 수 없습니다.');
  const bookmarks = raw.map(value => {
    if (!record(value) || !safeName(value.name)
      || !uint(value.sec) || !uint(value.para) || !uint(value.ctrlIdx) || !uint(value.charPos)) {
      throw new Error('B093 책갈피 신원 또는 위치가 올바르지 않습니다.');
    }
    return Object.freeze({
      name: value.name,
      section: value.sec,
      paragraph: value.para,
      controlIndex: value.ctrlIdx,
      charOffset: value.charPos,
    });
  });
  if (new Set(bookmarks.map(item => item.name)).size !== bookmarks.length) throw new Error('B093 중복 책갈피 이름은 상호참조 대상으로 사용할 수 없습니다.');
  return bookmarks.sort((left, right) => left.section - right.section || left.paragraph - right.paragraph
    || left.controlIndex - right.controlIndex || left.name.localeCompare(right.name));
}

function readFields(document: CrossReferenceDocumentB093, bookmarks: readonly CrossReferenceBookmarkB093[]): CrossReferenceFieldB093[] {
  const raw = parsed(document.getFieldList());
  if (!Array.isArray(raw) || raw.length > 500) throw new Error('B093 필드 목록을 확인할 수 없습니다.');
  return raw.map(value => {
    if (!record(value) || value.fieldType !== 'crossref' || !uint(value.fieldId)
      || typeof value.command !== 'string' || typeof value.value !== 'string'
      || !record(value.location) || !uint(value.location.sectionIndex) || !uint(value.location.paraIndex)
      || 'path' in value.location || !uint(value.startCharIdx) || !uint(value.endCharIdx)) {
      throw new Error('B093은 일반 본문의 명명 책갈피 상호참조 필드만 지원합니다.');
    }
    const match = /^\?([^;?#\u0000-\u001f\u007f-\u009f]+);0;1;1;0;$/u.exec(value.command);
    if (!match || !safeName(match[1]) || !safeDisplay(value.value)
      || bookmarks.filter(bookmark => bookmark.name === match[1]).length !== 1
      || Number(value.endCharIdx) < Number(value.startCharIdx)) {
      throw new Error('B093 상호참조 대상 또는 표시 문자열을 검증하지 못했습니다.');
    }
    return Object.freeze({
      fieldId: value.fieldId,
      targetName: match[1],
      command: value.command,
      displayText: value.value,
      section: value.location.sectionIndex,
      paragraph: value.location.paraIndex,
      start: value.startCharIdx,
      end: value.endCharIdx,
    });
  }).sort((left, right) => left.section - right.section || left.paragraph - right.paragraph || left.start - right.start || left.fieldId - right.fieldId);
}

function validateControls(document: CrossReferenceDocumentB093, bookmarks: readonly CrossReferenceBookmarkB093[]): void {
  const raw = parsed(document.getControls());
  if (!Array.isArray(raw) || raw.length > 2_000) throw new Error('B093 컨트롤 목록을 확인할 수 없습니다.');
  const allowed = new Set(['secd', 'cold', 'bokm', '%xrf']);
  for (const value of raw) {
    if (!record(value) || !uint(value.list) || value.list !== 0 || !uint(value.para)
      || !uint(value.controlIndex) || typeof value.ctrlId !== 'string' || !allowed.has(value.ctrlId)) {
      throw new Error('B093 특수 영역·개체·다른 필드가 있는 문서는 편집하지 않습니다.');
    }
  }
  for (const bookmark of bookmarks) {
    const flatParagraph = Array.from({length: bookmark.section}, (_, section) => document.getParagraphCount(section))
      .reduce((total, count) => total + count, 0) + bookmark.paragraph;
    if (!raw.some(value => record(value) && value.list === 0 && value.para === flatParagraph
      && value.controlIndex === bookmark.controlIndex && value.ctrlId === 'bokm')) {
      throw new Error('B093 책갈피의 일반 본문 컨트롤 신원을 확인하지 못했습니다.');
    }
  }
}

function paragraphLengths(document: CrossReferenceDocumentB093): readonly (readonly number[])[] {
  const count = document.getSectionCount();
  if (!Number.isSafeInteger(count) || count < 1 || count > 1_000) throw new Error('B093 구역 수를 확인할 수 없습니다.');
  return Object.freeze(Array.from({length: count}, (_, section) => {
    const paragraphs = document.getParagraphCount(section);
    if (!Number.isSafeInteger(paragraphs) || paragraphs < 1 || paragraphs > 100_000) throw new Error('B093 문단 수를 확인할 수 없습니다.');
    return Object.freeze(Array.from({length: paragraphs}, (_, paragraph) => {
      const length = document.getParagraphLength(section, paragraph);
      if (!uint(length) || length > 4_000_000) throw new Error('B093 문단 길이를 확인할 수 없습니다.');
      return length;
    }));
  }));
}

export function captureCrossReferenceB093(document: CrossReferenceDocumentB093, owner: CrossReferenceOwnerB093): CrossReferenceSnapshotB093 {
  const documentIdentity = owner.documentIdentity();
  const revision = owner.revision();
  if (!token(documentIdentity) || !token(revision) || !owner.editable() || owner.protected() || owner.story() !== 'body') {
    throw new Error('B093 편집 가능한 일반 본문 문서 소유권을 확인하지 못했습니다.');
  }
  const rawSourceFormat = document.getSourceFormat();
  const sourceFormat: 'hwp' | 'hwpx' = rawSourceFormat === 'hwp' || rawSourceFormat === 'hwpx'
    ? rawSourceFormat
    : (() => { throw new Error('B093은 HWP/HWPX 문서만 지원합니다.'); })();
  for (const method of ['insertCrossReferenceB093', 'setFieldValue', 'saveSnapshot', 'restoreSnapshot', 'discardSnapshot', 'exportHwp', 'exportHwpx'] as const) {
    if (typeof document[method] !== 'function') throw new Error('B093 엔진 기능이 연결되지 않았습니다.');
  }
  const bookmarks = readBookmarks(document);
  validateControls(document, bookmarks);
  const fields = readFields(document, bookmarks);
  const lengths = paragraphLengths(document);
  for (const bookmark of bookmarks) {
    if (bookmark.section >= lengths.length || bookmark.paragraph >= lengths[bookmark.section].length
      || bookmark.charOffset > lengths[bookmark.section][bookmark.paragraph]) throw new Error('B093 책갈피 본문 위치가 범위를 벗어났습니다.');
  }
  const evidence = {documentIdentity, revision, sourceFormat, bookmarks, fields, paragraphLengths: lengths};
  return Object.freeze({schemaVersion: 1, ...evidence, fingerprint: digest(evidence)});
}

function targetBookmark(snapshot: CrossReferenceSnapshotB093, name: string): CrossReferenceBookmarkB093 {
  if (!safeName(name)) throw new Error('B093 책갈피 이름이 올바르지 않습니다.');
  const matches = snapshot.bookmarks.filter(bookmark => bookmark.name === name);
  if (matches.length !== 1) throw new Error('B093 상호참조 대상 책갈피가 없거나 중복되었습니다.');
  return matches[0];
}

function validInsertion(snapshot: CrossReferenceSnapshotB093, section: number, paragraph: number, charOffset: number): void {
  if (!uint(section) || !uint(paragraph) || !uint(charOffset)
    || section >= snapshot.paragraphLengths.length || paragraph >= snapshot.paragraphLengths[section].length
    || charOffset > snapshot.paragraphLengths[section][paragraph]) throw new Error('B093 상호참조 삽입 위치가 범위를 벗어났습니다.');
}

export function planCrossReferenceInsertB093(snapshot: CrossReferenceSnapshotB093, request: Readonly<{
  bookmarkName: string;
  section: number;
  paragraph: number;
  charOffset: number;
  displayText: string;
}>): CrossReferencePlanB093 {
  validInsertion(snapshot, request.section, request.paragraph, request.charOffset);
  if (!safeDisplay(request.displayText)) throw new Error('B093 표시 문자열이 올바르지 않습니다.');
  return Object.freeze({
    schemaVersion: 1,
    kind: 'insert',
    expectedDocumentIdentity: snapshot.documentIdentity,
    expectedRevision: snapshot.revision,
    expectedFingerprint: snapshot.fingerprint,
    bookmark: targetBookmark(snapshot, request.bookmarkName),
    section: request.section,
    paragraph: request.paragraph,
    charOffset: request.charOffset,
    displayText: request.displayText,
  });
}

export function planCrossReferenceDisplayUpdateB093(snapshot: CrossReferenceSnapshotB093, fieldId: number, displayText: string): CrossReferencePlanB093 {
  if (!uint(fieldId) || !safeDisplay(displayText)) throw new Error('B093 필드 또는 표시 문자열이 올바르지 않습니다.');
  const matches = snapshot.fields.filter(field => field.fieldId === fieldId);
  if (matches.length !== 1) throw new Error('B093 갱신할 상호참조 필드가 없거나 중복되었습니다.');
  const field = matches[0];
  return Object.freeze({
    schemaVersion: 1,
    kind: 'update-display',
    expectedDocumentIdentity: snapshot.documentIdentity,
    expectedRevision: snapshot.revision,
    expectedFingerprint: snapshot.fingerprint,
    bookmark: targetBookmark(snapshot, field.targetName),
    section: field.section,
    paragraph: field.paragraph,
    charOffset: field.start,
    displayText,
    fieldId,
    expectedOldDisplayText: field.displayText,
  });
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function assertPlanCurrent(snapshot: CrossReferenceSnapshotB093, plan: CrossReferencePlanB093): void {
  if (plan.schemaVersion !== 1 || snapshot.documentIdentity !== plan.expectedDocumentIdentity
    || snapshot.revision !== plan.expectedRevision || snapshot.fingerprint !== plan.expectedFingerprint
    || JSON.stringify(targetBookmark(snapshot, plan.bookmark.name)) !== JSON.stringify(plan.bookmark)) {
    throw new Error('B093 문서 또는 책갈피가 계획 뒤 바뀌었습니다.');
  }
  validInsertion(snapshot, plan.section, plan.paragraph, plan.charOffset);
  if (plan.kind === 'update-display') {
    const field = snapshot.fields.find(item => item.fieldId === plan.fieldId);
    if (!field || field.displayText !== plan.expectedOldDisplayText || field.command !== commandFor(plan.bookmark.name)) {
      throw new Error('B093 상호참조 필드가 계획 뒤 바뀌었습니다.');
    }
  }
}

function assertStored(
  document: CrossReferenceDocumentB093,
  fieldId: number,
  bookmark: CrossReferenceBookmarkB093,
  displayText: string,
  section: number,
  paragraph: number,
): void {
  const bookmarks = readBookmarks(document);
  validateControls(document, bookmarks);
  const foundBookmark = bookmarks.filter(item => item.name === bookmark.name);
  if (foundBookmark.length !== 1 || JSON.stringify(foundBookmark[0]) !== JSON.stringify(bookmark)) throw new Error('B093 저장 후 책갈피가 달라졌습니다.');
  const field = readFields(document, bookmarks).filter(item => item.fieldId === fieldId);
  if (field.length !== 1 || field[0].command !== commandFor(bookmark.name) || field[0].displayText !== displayText
    || field[0].section !== section || field[0].paragraph !== paragraph) {
    throw new Error('B093 저장 후 상호참조 필드가 달라졌습니다.');
  }
}

function assertRoundTrips(
  document: CrossReferenceDocumentB093,
  fieldId: number,
  bookmark: CrossReferenceBookmarkB093,
  displayText: string,
  section: number,
  paragraph: number,
): void {
  for (const bytes of [document.exportHwp(), document.exportHwpx()]) {
    let reopened: CrossReferenceDocumentB093 | undefined;
    try {
      const Constructor = document.constructor as unknown as new (data: Uint8Array) => CrossReferenceDocumentB093;
      reopened = new Constructor(bytes);
      assertStored(reopened, fieldId, bookmark, displayText, section, paragraph);
    } finally {
      reopened?.free?.();
    }
  }
}

export function applyCrossReferenceB093(
  document: CrossReferenceDocumentB093,
  owner: CrossReferenceOwnerB093,
  plan: CrossReferencePlanB093,
): CrossReferenceReceiptB093 {
  const current = captureCrossReferenceB093(document, owner);
  assertPlanCurrent(current, plan);
  const beforeBytes = current.sourceFormat === 'hwp' ? document.exportHwp() : document.exportHwpx();
  const beforeSnapshot = document.saveSnapshot();
  let afterSnapshot: number | undefined;
  let fieldId = plan.fieldId;
  try {
    if (plan.kind === 'insert') {
      const response = parsed(document.insertCrossReferenceB093(
        plan.section,
        plan.paragraph,
        plan.charOffset,
        plan.bookmark.name,
        plan.bookmark.section,
        plan.bookmark.paragraph,
        plan.bookmark.controlIndex,
        plan.bookmark.charOffset,
        plan.displayText,
      ));
      if (!record(response) || response.ok !== true || !uint(response.fieldId)
        || response.command !== commandFor(plan.bookmark.name)) throw new Error('B093 엔진 삽입 결과가 올바르지 않습니다.');
      fieldId = response.fieldId;
    } else {
      const response = parsed(document.setFieldValue(plan.fieldId!, plan.displayText));
      if (!record(response) || response.ok !== true || response.fieldId !== plan.fieldId
        || response.oldValue !== plan.expectedOldDisplayText || response.newValue !== plan.displayText) {
        throw new Error('B093 엔진 갱신 결과가 올바르지 않습니다.');
      }
    }
    if (!uint(fieldId)) throw new Error('B093 필드 ID를 확인할 수 없습니다.');
    assertStored(document, fieldId, plan.bookmark, plan.displayText, plan.section, plan.paragraph);
    assertRoundTrips(document, fieldId, plan.bookmark, plan.displayText, plan.section, plan.paragraph);
    afterSnapshot = document.saveSnapshot();
  } catch (error) {
    document.restoreSnapshot(beforeSnapshot);
    document.discardSnapshot(beforeSnapshot);
    if (afterSnapshot !== undefined) document.discardSnapshot(afterSnapshot);
    const restored = current.sourceFormat === 'hwp' ? document.exportHwp() : document.exportHwpx();
    if (!sameBytes(beforeBytes, restored)) throw new Error('B093 실패 뒤 원본 문서를 복원하지 못했습니다.', {cause: error});
    throw error;
  }

  let state: 'after' | 'before' | 'disposed' = 'after';
  const checkedFieldId = fieldId;
  const restore = (id: number, next: 'after' | 'before') => {
    if (state === 'disposed') throw new Error('B093 해제된 변경 기록입니다.');
    document.restoreSnapshot(id);
    state = next;
  };
  return Object.freeze({
    fieldId: checkedFieldId,
    beforeRevision: current.revision,
    afterRevision: owner.revision(),
    undo: () => restore(beforeSnapshot, 'before'),
    redo: () => restore(afterSnapshot!, 'after'),
    dispose: () => {
      if (state === 'disposed') return;
      document.discardSnapshot(beforeSnapshot);
      document.discardSnapshot(afterSnapshot!);
      state = 'disposed';
    },
  });
}

export function queryCrossReferencesB093(document: CrossReferenceDocumentB093, owner: CrossReferenceOwnerB093): readonly CrossReferenceFieldB093[] {
  return captureCrossReferenceB093(document, owner).fields;
}
