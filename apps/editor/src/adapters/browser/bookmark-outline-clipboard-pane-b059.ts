import {sha256} from '@noble/hashes/sha2.js';

export type PaneStoryB059 = 'body' | 'table-cell' | 'header-footer' | 'footnote' | 'endnote' | 'textbox';
export type PaneTargetB059 = Readonly<{section: number; paragraph: number; offset: number; story: 'body'}>;

export type ClipboardEntryB059 = Readonly<{
  id: string;
  workspaceId: string;
  label: string;
  kind: 'text' | 'document-fragment';
  createdAt: number;
}>;

export type ClipboardSnapshotB059 = Readonly<{
  workspaceId: string;
  revision: string;
  entries: readonly ClipboardEntryB059[];
}>;

export interface PaneDocumentPortB059 {
  identity(): string;
  revision(): string;
  getSectionCount(): number;
  getParagraphCount(section: number): number;
  getParagraphLength(section: number, paragraph: number): number;
  getTextRange(section: number, paragraph: number, start: number, end: number): string;
  getParaPropertiesAt(section: number, paragraph: number): unknown;
  getBookmarks(): unknown;
  getControls(): unknown;
}

export type PaneItemB059 = Readonly<{
  id: string;
  kind: 'bookmark' | 'outline';
  label: string;
  target: PaneTargetB059;
}>;

export type TaskPaneStateB059 = Readonly<{
  schemaVersion: 1;
  documentIdentity: string;
  documentRevision: string;
  workspaceId: string;
  bookmarks: readonly PaneItemB059[];
  outlines: readonly PaneItemB059[];
  clipboard: readonly ClipboardEntryB059[];
  documentFingerprint: string;
  clipboardFingerprint: string;
  fingerprint: string;
}>;

type RawBookmark = {name?: unknown; sec?: unknown; para?: unknown; ctrlIdx?: unknown; charPos?: unknown};
type RawControl = {list?: unknown; para?: unknown; controlIndex?: unknown; ctrlId?: unknown};

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const REVISION = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,255}$/u;
const hex = (bytes: Uint8Array): string => [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
const hash = (value: unknown): string => hex(sha256(new TextEncoder().encode(JSON.stringify(value))));

function parse(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  return JSON.parse(value);
}

function integer(value: unknown, maximum = Number.MAX_SAFE_INTEGER): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= maximum;
}

function token(value: unknown, kind: 'identity' | 'revision'): string {
  if (typeof value !== 'string' || !(kind === 'identity' ? ID : REVISION).test(value)) {
    throw new Error(`${kind === 'identity' ? '문서/작업공간 식별자' : '목록 버전'}가 올바르지 않습니다.`);
  }
  return value;
}

function text(value: unknown, label: string, maximum: number): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > maximum || /[\u0000-\u001f\u007f-\u009f]/u.test(value)) {
    throw new Error(`${label}이 올바르지 않습니다.`);
  }
  return value;
}

function stableId(kind: PaneItemB059['kind'], target: PaneTargetB059, label: string): string {
  return `${kind}:${hash({target, label})}`;
}

function clipboardState(snapshot: ClipboardSnapshotB059, expectedWorkspaceId: string): {items: ClipboardEntryB059[]; fingerprint: string} {
  const workspaceId = token(snapshot.workspaceId, 'identity');
  if (workspaceId !== expectedWorkspaceId) throw new Error('다른 업무의 클립보드 기록은 표시하지 않습니다.');
  token(snapshot.revision, 'revision');
  if (!Array.isArray(snapshot.entries) || snapshot.entries.length > 100) throw new Error('클립보드 기록을 확인하지 못했습니다.');
  const ids = new Set<string>();
  const items = snapshot.entries.map(entry => {
    if (!entry || typeof entry !== 'object') throw new Error('클립보드 기록을 확인하지 못했습니다.');
    const id = token(entry.id, 'identity');
    if (ids.has(id)) throw new Error('중복된 클립보드 기록이 있습니다.');
    ids.add(id);
    if (entry.workspaceId !== workspaceId) throw new Error('다른 업무의 클립보드 기록은 표시하지 않습니다.');
    const label = text(entry.label, '클립보드 표시 이름', 500);
    if (entry.kind !== 'text' && entry.kind !== 'document-fragment') throw new Error('지원하지 않는 클립보드 기록입니다.');
    if (!Number.isSafeInteger(entry.createdAt) || entry.createdAt < 0) throw new Error('클립보드 기록 시각이 올바르지 않습니다.');
    return Object.freeze({id, workspaceId, label, kind: entry.kind, createdAt: entry.createdAt});
  });
  items.sort((left, right) => right.createdAt - left.createdAt || left.id.localeCompare(right.id));
  return {items, fingerprint: hash({workspaceId, revision: snapshot.revision, items})};
}

export function readTaskPaneStateB059(
  document: PaneDocumentPortB059,
  workspaceIdValue: string,
  clipboardSnapshot: ClipboardSnapshotB059,
): TaskPaneStateB059 {
  const documentIdentity = token(document.identity(), 'identity');
  const documentRevision = token(document.revision(), 'revision');
  const workspaceId = token(workspaceIdValue, 'identity');
  const sectionCount = document.getSectionCount();
  if (!integer(sectionCount, 256) || sectionCount === 0) throw new Error('문서 구역을 확인하지 못했습니다.');

  const paragraphCounts: number[] = [];
  const outlines: PaneItemB059[] = [];
  let flatParagraphCount = 0;
  for (let section = 0; section < sectionCount; section += 1) {
    const count = document.getParagraphCount(section);
    if (!integer(count, 10_000) || flatParagraphCount + count > 10_000) throw new Error('본문 문단 목록을 확인하지 못했습니다.');
    paragraphCounts.push(count);
    for (let paragraph = 0; paragraph < count; paragraph += 1) {
      const length = document.getParagraphLength(section, paragraph);
      if (!integer(length, 1_000_000)) throw new Error('본문 문단 길이를 확인하지 못했습니다.');
      const properties = parse(document.getParaPropertiesAt(section, paragraph));
      if (!properties || typeof properties !== 'object') throw new Error('문단 개요 정보를 확인하지 못했습니다.');
      const record = properties as {headType?: unknown; paraLevel?: unknown};
      if (record.headType === 'Outline') {
        if (!integer(record.paraLevel, 6)) throw new Error('개요 수준을 확인하지 못했습니다.');
        const label = text(document.getTextRange(section, paragraph, 0, length), '개요 표시 문구', 4_000);
        const target: PaneTargetB059 = Object.freeze({section, paragraph, offset: 0, story: 'body'});
        outlines.push(Object.freeze({id: stableId('outline', target, label), kind: 'outline', label, target}));
      }
    }
    flatParagraphCount += count;
  }

  const controls = parse(document.getControls());
  const bookmarks = parse(document.getBookmarks());
  if (!Array.isArray(controls) || controls.length > 20_000 || !Array.isArray(bookmarks) || bookmarks.length > 200) {
    throw new Error('책갈피 또는 제어 목록을 확인하지 못했습니다.');
  }
  const rootControls: RawControl[] = controls.map(control => {
    if (!control || typeof control !== 'object') throw new Error('문서 제어 목록을 확인하지 못했습니다.');
    const raw = control as RawControl;
    if (!integer(raw.list, 100_000) || !integer(raw.para, 10_000) || !integer(raw.controlIndex, 20_000) || typeof raw.ctrlId !== 'string') {
      throw new Error('문서 제어 위치를 확인하지 못했습니다.');
    }
    if (raw.list !== 0) throw new Error('특수 영역의 항목은 작업 창에 표시하지 않습니다.');
    return raw;
  });

  const bookmarkNames = new Set<string>();
  const bookmarkItems: PaneItemB059[] = bookmarks.map(value => {
    if (!value || typeof value !== 'object') throw new Error('책갈피 목록을 확인하지 못했습니다.');
    const raw = value as RawBookmark;
    const name = text(raw.name, '책갈피 이름', 40);
    if (bookmarkNames.has(name)) throw new Error('중복된 책갈피 이름이 있습니다.');
    bookmarkNames.add(name);
    if (!integer(raw.sec, sectionCount - 1) || !integer(raw.para, paragraphCounts[raw.sec] - 1) ||
        !integer(raw.ctrlIdx, 20_000) || !integer(raw.charPos, document.getParagraphLength(raw.sec, raw.para))) {
      throw new Error('책갈피 본문 위치를 확인하지 못했습니다.');
    }
    const flat = paragraphCounts.slice(0, raw.sec).reduce((sum, count) => sum + count, 0) + raw.para;
    if (!rootControls.some(control => control.para === flat && control.controlIndex === raw.ctrlIdx && control.ctrlId === 'bokm')) {
      throw new Error('책갈피의 안정된 본문 제어를 확인하지 못했습니다.');
    }
    const target: PaneTargetB059 = Object.freeze({section: raw.sec, paragraph: raw.para, offset: raw.charPos, story: 'body'});
    return Object.freeze({id: stableId('bookmark', target, name), kind: 'bookmark', label: name, target});
  });

  bookmarkItems.sort((left, right) => left.target.section - right.target.section || left.target.paragraph - right.target.paragraph || left.target.offset - right.target.offset || left.label.localeCompare(right.label));
  outlines.sort((left, right) => left.target.section - right.target.section || left.target.paragraph - right.target.paragraph);
  const itemIds = [...bookmarkItems, ...outlines].map(item => item.id);
  if (new Set(itemIds).size !== itemIds.length) throw new Error('중복된 작업 창 대상이 있습니다.');
  const clipboard = clipboardState(clipboardSnapshot, workspaceId);
  const documentFingerprint = hash({documentIdentity, documentRevision, paragraphCounts, bookmarks: bookmarkItems, outlines});
  const fingerprint = hash({documentFingerprint, clipboardFingerprint: clipboard.fingerprint, workspaceId});
  return Object.freeze({schemaVersion: 1, documentIdentity, documentRevision, workspaceId,
    bookmarks: Object.freeze(bookmarkItems), outlines: Object.freeze(outlines), clipboard: Object.freeze(clipboard.items),
    documentFingerprint, clipboardFingerprint: clipboard.fingerprint, fingerprint});
}

export function navigateTaskPaneItemB059(
  expected: TaskPaneStateB059,
  itemId: string,
  readCurrent: () => TaskPaneStateB059,
  navigate: (target: PaneTargetB059) => boolean,
): void {
  token(itemId, 'identity');
  const matches = [...expected.bookmarks, ...expected.outlines].filter(item => item.id === itemId);
  if (matches.length !== 1) throw new Error('탐색 대상을 다시 선택해 주세요.');
  const current = readCurrent();
  if (current.documentIdentity !== expected.documentIdentity || current.documentRevision !== expected.documentRevision ||
      current.workspaceId !== expected.workspaceId || current.documentFingerprint !== expected.documentFingerprint ||
      current.clipboardFingerprint !== expected.clipboardFingerprint || current.fingerprint !== expected.fingerprint) {
    throw new Error('문서 또는 작업 창 목록이 바뀌었습니다. 다시 조회해 주세요.');
  }
  const live = [...current.bookmarks, ...current.outlines].filter(item => item.id === itemId);
  if (live.length !== 1 || JSON.stringify(live[0].target) !== JSON.stringify(matches[0].target)) {
    throw new Error('안정된 탐색 위치를 확인하지 못했습니다.');
  }
  if (navigate(Object.freeze({...live[0].target})) !== true) throw new Error('편집기가 탐색 위치를 확인하지 못했습니다.');
}
