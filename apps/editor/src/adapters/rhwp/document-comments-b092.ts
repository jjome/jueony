import {sha256} from '@noble/hashes/sha2.js';

type JsonRecord = Record<string, unknown>;
type CommentAction = 'create' | 'delete' | 'update';
type BlockReason =
  | 'api-unavailable'
  | 'invalid-context'
  | 'unsupported-story'
  | 'protected-document'
  | 'invalid-input'
  | 'invalid-comment-list'
  | 'stale-document'
  | 'stale-comments'
  | 'unsupported-range-comment'
  | 'mutation-rejected'
  | 'verification-failed'
  | 'history-unavailable'
  | 'history-state-mismatch'
  | 'rollback-failed';

export interface CommentHostB092 {
  getCommentListV1(): unknown;
  insertCommentAtCursorV1(section: number, paragraph: number, offset: number, text: string, author: string): unknown;
  removeCommentV1(fieldId: number): unknown;
  updateCommentTextV1?(fieldId: number, expected: string, text: string): unknown;
  saveSnapshot(): number;
  restoreSnapshot(token: number): unknown;
  discardSnapshot(token: number): void;
}

export interface CommentContextB092 {
  documentIdentity(): string;
  revision(): string;
  story(): string;
  editable(): boolean;
  protected(): boolean;
}

export interface CommentPointB092 {
  readonly section: number;
  readonly paragraph: number;
  readonly offset: number;
}

export interface DocumentCommentB092 {
  readonly fieldId: number;
  readonly memoIndex: number;
  readonly text: string;
  readonly author: string;
  readonly section: number;
  readonly paragraph: number;
  readonly start: number;
  readonly end: number;
  readonly pointComment: boolean;
  readonly nested?: true;
}

export interface CommentPlanB092 {
  readonly version: 1;
  readonly action: CommentAction;
  readonly documentIdentity: string;
  readonly revision: string;
  readonly commentsFingerprint: string;
  readonly point?: CommentPointB092;
  readonly text?: string;
  readonly author?: string;
  readonly fieldId?: number;
}

export type CommentCaptureB092 =
  | {status: 'ready'; plan: CommentPlanB092; comments: readonly DocumentCommentB092[]}
  | {status: 'blocked'; reason: BlockReason};

export type CommentTransitionB092 =
  | {status: 'applied'; comment?: DocumentCommentB092; command: CommentCommandB092}
  | {status: 'restored'; comments: readonly DocumentCommentB092[]}
  | {status: 'blocked'; reason: BlockReason}
  | {status: 'state-uncertain'; reason: 'history-state-mismatch' | 'rollback-failed'};

function record(value: unknown): JsonRecord | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  return value as JsonRecord;
}

function json(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  if (value.length > 1_000_000) return undefined;
  try { return JSON.parse(value); } catch { return undefined; }
}

function integer(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function hash(value: string): string {
  return Array.from(sha256(new TextEncoder().encode(value)), byte => byte.toString(16).padStart(2, '0')).join('');
}

function digest(value: unknown): string { return hash(JSON.stringify(value)); }
function validRevision(value: unknown): value is string { return typeof value === 'string' && value.length > 0 && value.length <= 1024; }

function context(port: CommentContextB092): {identity: string; revision: string} | undefined {
  try {
    const identity = port.documentIdentity(), revision = port.revision();
    return validRevision(identity) && validRevision(revision) ? {identity, revision} : undefined;
  } catch { return undefined; }
}

function hasApi(host: Partial<CommentHostB092>): host is CommentHostB092 {
  return ['getCommentListV1', 'insertCommentAtCursorV1', 'removeCommentV1', 'saveSnapshot', 'restoreSnapshot', 'discardSnapshot']
    .every(name => typeof (host as Record<string, unknown>)[name] === 'function');
}

function accepted(value: unknown): JsonRecord | undefined {
  const result = record(json(value));
  return result?.ok === true ? result : undefined;
}

function parseComment(value: unknown): DocumentCommentB092 | undefined {
  const item = record(value), location = record(item?.location);
  if (!item || !location) return undefined;
  const allowed = new Set(['fieldId', 'memoIndex', 'text', 'author', 'location', 'startCharIdx', 'endCharIdx', 'pointComment']);
  const locationAllowed = new Set(['sectionIndex', 'paraIndex', 'path']);
  if (Object.keys(item).some(key => !allowed.has(key)) || Object.keys(location).some(key => !locationAllowed.has(key))) return undefined;
  if (!integer(item.fieldId) || !integer(item.memoIndex) || typeof item.text !== 'string' || item.text.length > 8000 ||
      typeof item.author !== 'string' || item.author.length > 256 || !integer(location.sectionIndex) ||
      !integer(location.paraIndex) || !integer(item.startCharIdx) || !integer(item.endCharIdx) ||
      typeof item.pointComment !== 'boolean' || item.pointComment !== (item.startCharIdx === item.endCharIdx)) return undefined;
  if (location.path !== undefined && (!Array.isArray(location.path) || location.path.length > 16)) return undefined;
  return {
    fieldId: item.fieldId,
    memoIndex: item.memoIndex,
    text: item.text,
    author: item.author,
    section: location.sectionIndex,
    paragraph: location.paraIndex,
    start: item.startCharIdx,
    end: item.endCharIdx,
    pointComment: item.pointComment,
    ...(Array.isArray(location.path) && location.path.length ? {nested: true as const} : {}),
  };
}

export function readDocumentCommentsB092(host: Pick<CommentHostB092, 'getCommentListV1'>): readonly DocumentCommentB092[] | undefined {
  let parsed: unknown;
  try { parsed = json(host.getCommentListV1()); } catch { return undefined; }
  if (!Array.isArray(parsed) || parsed.length > 10_000) return undefined;
  const comments = parsed.map(parseComment);
  if (comments.some(comment => comment === undefined)) return undefined;
  const result = comments as DocumentCommentB092[];
  if (new Set(result.map(comment => comment.fieldId)).size !== result.length) return undefined;
  return result;
}

function safeContext(port: CommentContextB092): BlockReason | undefined {
  try {
    if (port.story() !== 'body') return 'unsupported-story';
    if (!port.editable() || port.protected()) return 'protected-document';
  } catch { return 'invalid-context'; }
  return undefined;
}

function validPoint(point: CommentPointB092): boolean {
  return integer(point.section) && integer(point.paragraph) && integer(point.offset);
}

function validText(text: string): boolean {
  let units = 0;
  for (const character of text) units += (character.codePointAt(0) ?? 0) > 0xffff ? 2 : 1;
  return units > 0 && units <= 4000 && !/\p{Cc}/u.test(text);
}

function validAuthor(author: string): boolean {
  return author.length > 0 && author.length <= 128 && !/[\/\\;\p{Cc}]/u.test(author);
}

export function auditDocumentCommentsB092(host: Partial<CommentHostB092>):
  | {supported: true; model: 'rhwp-memo-field'; scope: 'body-point-comment'; formats: readonly ['hwp', 'hwpx']}
  | {supported: false; reason: 'api-unavailable'} {
  return hasApi(host)
    ? {supported: true, model: 'rhwp-memo-field', scope: 'body-point-comment', formats: ['hwp', 'hwpx']}
    : {supported: false, reason: 'api-unavailable'};
}

export function captureCreateCommentB092(
  host: Partial<CommentHostB092>, port: CommentContextB092, point: CommentPointB092, text: string, author: string,
): CommentCaptureB092 {
  if (!hasApi(host)) return {status: 'blocked', reason: 'api-unavailable'};
  const unsafe = safeContext(port); if (unsafe) return {status: 'blocked', reason: unsafe};
  const observed = context(port); if (!observed) return {status: 'blocked', reason: 'invalid-context'};
  if (!validPoint(point) || !validText(text) || !validAuthor(author)) return {status: 'blocked', reason: 'invalid-input'};
  const comments = readDocumentCommentsB092(host); if (!comments) return {status: 'blocked', reason: 'invalid-comment-list'};
  return {status: 'ready', comments, plan: {
    version: 1, action: 'create', documentIdentity: observed.identity, revision: observed.revision,
    commentsFingerprint: digest(comments), point: {...point}, text, author,
  }};
}

export function captureDeleteCommentB092(
  host: Partial<CommentHostB092>, port: CommentContextB092, fieldId: number,
): CommentCaptureB092 {
  return captureExistingComment(host, port, fieldId, 'delete');
}

export function captureUpdateCommentB092(
  host: Partial<CommentHostB092>, port: CommentContextB092, fieldId: number, text: string,
): CommentCaptureB092 {
  if (typeof host.updateCommentTextV1 !== 'function') return {status: 'blocked', reason: 'api-unavailable'};
  if (!validText(text)) return {status: 'blocked', reason: 'invalid-input'};
  return captureExistingComment(host, port, fieldId, 'update', text);
}

function captureExistingComment(
  host: Partial<CommentHostB092>, port: CommentContextB092, fieldId: number, action: 'delete' | 'update', text?: string,
): CommentCaptureB092 {
  if (!hasApi(host)) return {status: 'blocked', reason: 'api-unavailable'};
  const unsafe = safeContext(port); if (unsafe) return {status: 'blocked', reason: unsafe};
  const observed = context(port); if (!observed) return {status: 'blocked', reason: 'invalid-context'};
  if (!integer(fieldId)) return {status: 'blocked', reason: 'invalid-input'};
  const comments = readDocumentCommentsB092(host); if (!comments) return {status: 'blocked', reason: 'invalid-comment-list'};
  const target = comments.find(comment => comment.fieldId === fieldId);
  if (!target) return {status: 'blocked', reason: 'invalid-input'};
  if (!target.pointComment || target.nested) return {status: 'blocked', reason: 'unsupported-range-comment'};
  return {status: 'ready', comments, plan: {
    version: 1, action, documentIdentity: observed.identity, revision: observed.revision,
    commentsFingerprint: digest(comments), fieldId, ...(text !== undefined ? {text} : {}),
  }};
}

/** Call inside the editor's snapshot transaction so an exception rolls the document back. */
export function executeCommentPlanInSnapshotB092(
  host: Partial<CommentHostB092>, port: CommentContextB092, plan: CommentPlanB092,
): {applied?: DocumentCommentB092; remaining: readonly DocumentCommentB092[]} {
  if (!hasApi(host) || safeContext(port)) throw new Error('이 문서에서는 메모를 편집할 수 없습니다.');
  const current = context(port);
  const before = readDocumentCommentsB092(host);
  if (!current || current.identity !== plan.documentIdentity || current.revision !== plan.revision
      || !before || digest(before) !== plan.commentsFingerprint) throw new Error('문서나 메모가 바뀌었습니다. 목록을 다시 여세요.');

  const target = before.find(comment => comment.fieldId === plan.fieldId);
  let receipt: JsonRecord | undefined;
  if (plan.action === 'create' && plan.point && plan.text !== undefined && plan.author !== undefined) {
    receipt = accepted(host.insertCommentAtCursorV1(plan.point.section, plan.point.paragraph, plan.point.offset, plan.text, plan.author));
  } else if (target?.pointComment && !target.nested && plan.action === 'delete') {
    receipt = accepted(host.removeCommentV1(target.fieldId));
  } else if (target?.pointComment && !target.nested && plan.action === 'update' && plan.text !== undefined) {
    receipt = accepted(host.updateCommentTextV1?.(target.fieldId, target.text, plan.text));
  }
  if (!receipt || !integer(receipt.fieldId) || (plan.action !== 'create' && receipt.fieldId !== target?.fieldId)) {
    throw new Error('메모 편집을 적용하지 못했습니다. 본문 한 지점의 한 줄 메모를 확인하세요.');
  }
  const after = readDocumentCommentsB092(host);
  if (!after) throw new Error('편집 후 메모 목록을 읽을 수 없습니다.');
  let applied: DocumentCommentB092 | undefined;
  let unchanged: readonly DocumentCommentB092[] = before;
  switch (plan.action) {
    case 'create':
      applied = after.find(comment => comment.fieldId === receipt?.fieldId);
      if (!applied || applied.text !== plan.text || applied.author !== plan.author || !plan.point || applied.nested ||
          applied.section !== plan.point.section || applied.paragraph !== plan.point.paragraph || applied.start !== plan.point.offset || !applied.pointComment) {
        throw new Error('추가한 메모의 위치와 내용을 확인하지 못했습니다.');
      }
      break;
    case 'update':
      applied = after.find(comment => comment.fieldId === plan.fieldId);
      if (!applied || digest(applied) !== digest({...target, text: plan.text})) throw new Error('메모의 내용이나 원래 위치가 달라졌습니다.');
      unchanged = before.filter(comment => comment.fieldId !== plan.fieldId);
      break;
    case 'delete':
      unchanged = before.filter(comment => comment.fieldId !== plan.fieldId);
      break;
  }
  const remaining = applied ? after.filter(comment => comment.fieldId !== applied.fieldId) : after;
  if (digest(remaining) !== digest(unchanged)) throw new Error('다른 메모가 함께 변경되었습니다.');
  return {applied, remaining: after};
}

type SnapshotPair = {before: number; after: number};

export class CommentCommandB092 {
  #position: 'before' | 'after' | 'disposed' = 'after';
  readonly host: CommentHostB092;
  readonly port: CommentContextB092;
  readonly identity: string;
  readonly beforeRevision: string;
  readonly afterRevision: string;
  readonly beforeFingerprint: string;
  readonly afterFingerprint: string;
  readonly snapshots: SnapshotPair;
  constructor(
    host: CommentHostB092, port: CommentContextB092, identity: string,
    beforeRevision: string, afterRevision: string,
    beforeFingerprint: string, afterFingerprint: string, snapshots: SnapshotPair,
  ) {
    this.host = host;
    this.port = port;
    this.identity = identity;
    this.beforeRevision = beforeRevision;
    this.afterRevision = afterRevision;
    this.beforeFingerprint = beforeFingerprint;
    this.afterFingerprint = afterFingerprint;
    this.snapshots = snapshots;
  }
  undo(): CommentTransitionB092 { return this.#restore('after', 'before'); }
  redo(): CommentTransitionB092 { return this.#restore('before', 'after'); }
  dispose(): void {
    if (this.#position === 'disposed') return;
    this.#position = 'disposed';
    try { this.host.discardSnapshot(this.snapshots.before); } catch { /* release only */ }
    try { this.host.discardSnapshot(this.snapshots.after); } catch { /* release only */ }
  }
  #restore(expected: 'before' | 'after', next: 'before' | 'after'): CommentTransitionB092 {
    if (this.#position !== expected) return {status: 'blocked', reason: 'history-state-mismatch'};
    const current = context(this.port), list = readDocumentCommentsB092(this.host);
    const currentRevision = expected === 'before' ? this.beforeRevision : this.afterRevision;
    const currentFingerprint = expected === 'before' ? this.beforeFingerprint : this.afterFingerprint;
    if (!current || current.identity !== this.identity || current.revision !== currentRevision || !list || digest(list) !== currentFingerprint) {
      return {status: 'blocked', reason: 'history-state-mismatch'};
    }
    const token = next === 'before' ? this.snapshots.before : this.snapshots.after;
    if (!accepted(this.host.restoreSnapshot(token))) return {status: 'state-uncertain', reason: 'history-state-mismatch'};
    const restored = readDocumentCommentsB092(this.host), restoredContext = context(this.port);
    const desiredRevision = next === 'before' ? this.beforeRevision : this.afterRevision;
    const desiredFingerprint = next === 'before' ? this.beforeFingerprint : this.afterFingerprint;
    if (!restored || !restoredContext || restoredContext.identity !== this.identity || restoredContext.revision !== desiredRevision || digest(restored) !== desiredFingerprint) {
      return {status: 'state-uncertain', reason: 'history-state-mismatch'};
    }
    this.#position = next;
    return {status: 'restored', comments: restored};
  }
}

export function applyCommentPlanB092(
  host: Partial<CommentHostB092>, port: CommentContextB092, plan: CommentPlanB092,
): CommentTransitionB092 {
  if (!hasApi(host)) return {status: 'blocked', reason: 'api-unavailable'};
  const unsafe = safeContext(port); if (unsafe) return {status: 'blocked', reason: unsafe};
  const beforeContext = context(port); if (!beforeContext) return {status: 'blocked', reason: 'invalid-context'};
  if (beforeContext.identity !== plan.documentIdentity || beforeContext.revision !== plan.revision) return {status: 'blocked', reason: 'stale-document'};
  const before = readDocumentCommentsB092(host); if (!before) return {status: 'blocked', reason: 'invalid-comment-list'};
  if (digest(before) !== plan.commentsFingerprint) return {status: 'blocked', reason: 'stale-comments'};
  let beforeToken: number;
  try { beforeToken = host.saveSnapshot(); } catch { return {status: 'blocked', reason: 'history-unavailable'}; }
  if (!integer(beforeToken)) return {status: 'blocked', reason: 'history-unavailable'};
  let afterToken: number | undefined;
  try {
    const {applied, remaining: after} = executeCommentPlanInSnapshotB092(host, port, plan);
    const afterContext = context(port);
    if (!afterContext || afterContext.identity !== plan.documentIdentity || afterContext.revision === plan.revision) throw new Error('verification');
    afterToken = host.saveSnapshot(); if (!integer(afterToken)) throw new Error('history');
    return {status: 'applied', ...(applied ? {comment: applied} : {}), command: new CommentCommandB092(
      host, port, plan.documentIdentity, plan.revision, afterContext.revision,
      plan.commentsFingerprint, digest(after), {before: beforeToken, after: afterToken},
    )};
  } catch {
    if (afterToken !== undefined) { try { host.discardSnapshot(afterToken); } catch { /* release only */ } }
    try {
      if (!accepted(host.restoreSnapshot(beforeToken))) throw new Error('restore');
      const restored = readDocumentCommentsB092(host), restoredContext = context(port);
      if (!restored || digest(restored) !== plan.commentsFingerprint || !restoredContext ||
          restoredContext.identity !== plan.documentIdentity || restoredContext.revision !== plan.revision) throw new Error('mismatch');
      try { host.discardSnapshot(beforeToken); } catch { /* release only */ }
      return {status: 'blocked', reason: 'verification-failed'};
    } catch { return {status: 'state-uncertain', reason: 'rollback-failed'}; }
  }
}
