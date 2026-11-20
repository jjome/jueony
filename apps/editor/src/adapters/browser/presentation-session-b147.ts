import {sha256} from '@noble/hashes/sha2.js';

export type PresentationScopeB147 =
  | Readonly<{kind: 'document'}>
  | Readonly<{kind: 'section'; section: number}>;

export interface PresentationDocumentPortB147 {
  identity(): string;
  revision(): string;
  getSectionCount(): number;
  getParagraphCount(section: number): number;
  getPageCaretStarts(): unknown;
  getPageOfPosition(section: number, paragraph: number): unknown;
}

export interface PresentationViewPortB147 {
  enterFullscreen(): boolean;
  exitFullscreen(): boolean;
  isFullscreen(): boolean;
  showPage(page: number): boolean;
}

export type PresentationStateB147 = Readonly<{
  status: 'active' | 'ended';
  documentIdentity: string;
  documentRevision: string;
  scope: PresentationScopeB147;
  currentPage: number;
  firstPage: number;
  lastPage: number;
  pageCount: number;
  sectionCount: number;
  inventoryFingerprint: string;
}>;

export interface PresentationSessionB147 {
  state(): PresentationStateB147;
  next(): boolean;
  previous(): boolean;
  goTo(page: number): boolean;
  end(): void;
}

type Inventory = Readonly<{
  identity: string;
  revision: string;
  sectionCount: number;
  pageCount: number;
  sectionStarts: readonly number[];
  fingerprint: string;
}>;

const TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,255}$/u;
const MAX_SECTIONS = 1_024;
const MAX_PAGES = 16_384;

function parse(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { throw new Error('프레젠테이션 문서 정보를 읽지 못했습니다.'); }
}

function integer(value: unknown, maximum: number): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= maximum;
}

function token(value: unknown, label: string): string {
  if (typeof value !== 'string' || !TOKEN.test(value)) throw new Error(`${label}을 확인하지 못했습니다.`);
  return value;
}

function hex(bytes: Uint8Array): string {
  return [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
}

function fingerprint(value: unknown): string {
  return hex(sha256(new TextEncoder().encode(JSON.stringify(value))));
}

function readPageStart(value: unknown): {list: number; para: number; pos: number} | null {
  if (value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('쪽 시작 위치를 확인하지 못했습니다.');
  const record = value as Record<string, unknown>;
  if (Object.keys(record).sort().join(',') !== 'list,para,pos'
    || !integer(record.list, Number.MAX_SAFE_INTEGER)
    || !integer(record.para, Number.MAX_SAFE_INTEGER)
    || !integer(record.pos, Number.MAX_SAFE_INTEGER)) {
    throw new Error('쪽 시작 위치를 확인하지 못했습니다.');
  }
  return {list: record.list, para: record.para, pos: record.pos};
}

function pageOfPosition(value: unknown, pageCount: number): number {
  const parsed = parse(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('구역의 쪽 위치를 확인하지 못했습니다.');
  const record = parsed as Record<string, unknown>;
  if (record.ok !== true || !integer(record.page, pageCount - 1)) throw new Error('구역의 쪽 위치를 확인하지 못했습니다.');
  return record.page;
}

function capture(document: PresentationDocumentPortB147): Inventory {
  const identity = token(document.identity(), '문서 식별자');
  const revision = token(document.revision(), '문서 버전');
  const sectionCount = document.getSectionCount();
  if (!integer(sectionCount, MAX_SECTIONS) || sectionCount < 1) throw new Error('문서 구역을 확인하지 못했습니다.');

  const rawPageStarts = parse(document.getPageCaretStarts());
  if (!Array.isArray(rawPageStarts) || rawPageStarts.length < 1 || rawPageStarts.length > MAX_PAGES) {
    throw new Error('문서 쪽 범위를 확인하지 못했습니다.');
  }
  const pageStarts = rawPageStarts.map(readPageStart);
  const paragraphCounts: number[] = [];
  const sectionStarts: number[] = [];
  for (let section = 0; section < sectionCount; section += 1) {
    const paragraphs = document.getParagraphCount(section);
    if (!integer(paragraphs, 100_000) || paragraphs < 1) throw new Error('구역 문단 범위를 확인하지 못했습니다.');
    paragraphCounts.push(paragraphs);
    const start = pageOfPosition(document.getPageOfPosition(section, 0), pageStarts.length);
    if (section > 0 && start < sectionStarts[section - 1]) throw new Error('구역의 쪽 순서를 확인하지 못했습니다.');
    sectionStarts.push(start);
  }
  return Object.freeze({
    identity,
    revision,
    sectionCount,
    pageCount: pageStarts.length,
    sectionStarts: Object.freeze(sectionStarts),
    fingerprint: fingerprint({identity, revision, sectionCount, paragraphCounts, sectionStarts, pageStarts}),
  });
}

function bounds(scope: PresentationScopeB147, inventory: Inventory): {firstPage: number; lastPage: number} {
  if (scope.kind === 'document') return {firstPage: 0, lastPage: inventory.pageCount - 1};
  if (!integer(scope.section, inventory.sectionCount - 1)) throw new Error('프레젠테이션 구역을 확인하지 못했습니다.');
  return {
    firstPage: inventory.sectionStarts[scope.section],
    lastPage: scope.section + 1 < inventory.sectionCount
      ? inventory.sectionStarts[scope.section + 1] - 1
      : inventory.pageCount - 1,
  };
}

function sameInventory(left: Inventory, right: Inventory): boolean {
  return left.identity === right.identity
    && left.revision === right.revision
    && left.sectionCount === right.sectionCount
    && left.pageCount === right.pageCount
    && left.fingerprint === right.fingerprint;
}

function cleanupFailedStart(view: PresentationViewPortB147): void {
  try { if (view.isFullscreen()) view.exitFullscreen(); } catch { /* best-effort cleanup */ }
}

export function startPresentationSessionB147(args: {
  document: PresentationDocumentPortB147;
  view: PresentationViewPortB147;
  scope?: PresentationScopeB147;
  startPage?: number;
}): PresentationSessionB147 {
  const scope: PresentationScopeB147 = args.scope ?? Object.freeze({kind: 'document'});
  const initial = capture(args.document);
  const range = bounds(scope, initial);
  const startPage = args.startPage ?? range.firstPage;
  if (!integer(startPage, range.lastPage) || startPage < range.firstPage) throw new Error('시작 쪽이 프레젠테이션 범위를 벗어났습니다.');

  try {
    if (args.view.enterFullscreen() !== true || args.view.isFullscreen() !== true) {
      throw new Error('전체 화면을 시작하지 못했습니다.');
    }
    if (args.view.showPage(startPage) !== true) throw new Error('시작 쪽을 표시하지 못했습니다.');
  } catch (error) {
    cleanupFailedStart(args.view);
    throw error;
  }

  let status: PresentationStateB147['status'] = 'active';
  let currentPage = startPage;

  const state = (): PresentationStateB147 => Object.freeze({
    status,
    documentIdentity: initial.identity,
    documentRevision: initial.revision,
    scope: Object.freeze({...scope}),
    currentPage,
    firstPage: range.firstPage,
    lastPage: range.lastPage,
    pageCount: initial.pageCount,
    sectionCount: initial.sectionCount,
    inventoryFingerprint: initial.fingerprint,
  });

  const assertActiveAndFresh = (): void => {
    if (status !== 'active') throw new Error('종료된 프레젠테이션입니다.');
    if (args.view.isFullscreen() !== true) throw new Error('전체 화면 프레젠테이션이 종료되었습니다.');
    if (!sameInventory(initial, capture(args.document))) throw new Error('문서 또는 쪽 구성이 바뀌었습니다. 프레젠테이션을 다시 시작하세요.');
  };

  const goTo = (page: number): boolean => {
    assertActiveAndFresh();
    if (!integer(page, range.lastPage) || page < range.firstPage) return false;
    if (page === currentPage) return true;
    if (args.view.showPage(page) !== true) throw new Error('프레젠테이션 쪽을 표시하지 못했습니다.');
    currentPage = page;
    return true;
  };

  const end = (): void => {
    if (status !== 'active') return;
    let stale: Error | undefined;
    try {
      if (!sameInventory(initial, capture(args.document))) stale = new Error('문서 또는 쪽 구성이 바뀌었습니다.');
    } catch {
      stale = new Error('문서 또는 쪽 구성을 다시 확인하지 못했습니다.');
    }
    let exited = false;
    try { exited = args.view.exitFullscreen() === true && args.view.isFullscreen() === false; } catch { exited = false; }
    if (!exited) throw new Error('전체 화면을 종료하지 못했습니다.');
    status = 'ended';
    if (stale) throw stale;
  };

  return Object.freeze({
    state,
    next: () => currentPage < range.lastPage ? goTo(currentPage + 1) : (assertActiveAndFresh(), false),
    previous: () => currentPage > range.firstPage ? goTo(currentPage - 1) : (assertActiveAndFresh(), false),
    goTo,
    end,
  });
}
