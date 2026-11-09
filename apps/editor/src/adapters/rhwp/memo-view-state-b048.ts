import {sha256} from '@noble/hashes/sha2.js';
import {
  readDocumentCommentsB092,
  type DocumentCommentB092,
} from './document-comments-b092.ts';

type JsonRecord = Record<string, unknown>;
type MemoViewBlockReasonB048 =
  | 'api-unavailable'
  | 'invalid-context'
  | 'unsupported-story'
  | 'invalid-request'
  | 'invalid-comment-list'
  | 'unsupported-range-comment'
  | 'stale-document'
  | 'stale-comments';

export interface MemoViewHostB048 {
  getCommentListV1(): unknown;
}

export interface MemoViewContextB048 {
  documentIdentity(): unknown;
  revision(): unknown;
  story(): unknown;
}

export interface MemoViewRequestB048 {
  readonly visible: boolean;
  readonly guideLines: boolean;
}

export interface MemoViewPlanB048 extends MemoViewRequestB048 {
  readonly version: 1;
  readonly documentIdentity: string;
  readonly revision: string;
  readonly commentsFingerprint: string;
}

export interface MemoMarkerB048 {
  readonly fieldId: number;
  readonly memoIndex: number;
  readonly section: number;
  readonly paragraph: number;
  readonly offset: number;
  readonly text: string;
  readonly author: string;
}

export interface MemoGuideLineB048 {
  readonly fieldId: number;
  readonly section: number;
  readonly paragraph: number;
  readonly offset: number;
}

export interface MemoViewStateB048 extends MemoViewRequestB048 {
  readonly documentIdentity: string;
  readonly revision: string;
  readonly commentsFingerprint: string;
  readonly commentCount: number;
  readonly markers: readonly MemoMarkerB048[];
  readonly guideLineAnchors: readonly MemoGuideLineB048[];
}

export type MemoViewCaptureB048 =
  | {status: 'ready'; plan: MemoViewPlanB048}
  | {status: 'blocked'; reason: MemoViewBlockReasonB048};

export type MemoViewTransitionB048 =
  | {status: 'applied'; state: MemoViewStateB048}
  | {status: 'blocked'; reason: MemoViewBlockReasonB048};

interface ObservedMemoListB048 {
  readonly comments: readonly DocumentCommentB092[];
  readonly fingerprint: string;
}

function record(value: unknown): JsonRecord | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : undefined;
}

function boundedString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 1024;
}

function context(port: MemoViewContextB048): {identity: string; revision: string} | undefined {
  try {
    const identity = port.documentIdentity(), revision = port.revision();
    if (!boundedString(identity) || !boundedString(revision)) return undefined;
    return {identity, revision};
  } catch { return undefined; }
}

function safeStory(port: MemoViewContextB048): MemoViewBlockReasonB048 | undefined {
  try { return port.story() === 'body' ? undefined : 'unsupported-story'; }
  catch { return 'invalid-context'; }
}

function decodeList(value: unknown): readonly unknown[] | undefined {
  if (typeof value === 'string') {
    if (value.length > 1_000_000) return undefined;
    try { value = JSON.parse(value); } catch { return undefined; }
  }
  return Array.isArray(value) && value.length <= 10_000 ? value : undefined;
}

function hexDigest(value: unknown): string {
  return Array.from(sha256(new TextEncoder().encode(JSON.stringify(value))), byte => byte.toString(16).padStart(2, '0')).join('');
}

function observeComments(host: Partial<MemoViewHostB048>):
  | ObservedMemoListB048
  | {reason: MemoViewBlockReasonB048} {
  if (typeof host.getCommentListV1 !== 'function') return {reason: 'api-unavailable'};
  let raw: unknown;
  try { raw = host.getCommentListV1(); } catch { return {reason: 'invalid-comment-list'}; }
  const items = decodeList(raw);
  if (!items) return {reason: 'invalid-comment-list'};
  const comments = readDocumentCommentsB092({getCommentListV1: () => raw});
  if (!comments || comments.length !== items.length) return {reason: 'invalid-comment-list'};

  for (let index = 0; index < comments.length; index++) {
    const item = record(items[index]), location = record(item?.location);
    if (!item || !location) return {reason: 'invalid-comment-list'};
    const path = location.path;
    if (path !== undefined && (!Array.isArray(path) || path.length !== 0)) return {reason: 'unsupported-story'};
    if (!comments[index].pointComment) return {reason: 'unsupported-range-comment'};
  }
  return {comments, fingerprint: hexDigest(comments)};
}

function validRequest(value: unknown): value is MemoViewRequestB048 {
  const item = record(value);
  return Boolean(item && Object.keys(item).length === 2
    && typeof item.visible === 'boolean' && typeof item.guideLines === 'boolean');
}

function validPlan(value: unknown): value is MemoViewPlanB048 {
  const item = record(value);
  if (!item || Object.keys(item).some(key => ![
    'version', 'documentIdentity', 'revision', 'commentsFingerprint', 'visible', 'guideLines',
  ].includes(key))) return false;
  return item.version === 1 && boundedString(item.documentIdentity) && boundedString(item.revision)
    && typeof item.commentsFingerprint === 'string' && /^[0-9a-f]{64}$/.test(item.commentsFingerprint)
    && typeof item.visible === 'boolean' && typeof item.guideLines === 'boolean';
}

export function captureMemoViewChangeB048(
  host: Partial<MemoViewHostB048>, port: MemoViewContextB048, request: MemoViewRequestB048,
): MemoViewCaptureB048 {
  if (typeof host.getCommentListV1 !== 'function') return {status: 'blocked', reason: 'api-unavailable'};
  const unsafeStory = safeStory(port); if (unsafeStory) return {status: 'blocked', reason: unsafeStory};
  const observedContext = context(port); if (!observedContext) return {status: 'blocked', reason: 'invalid-context'};
  if (!validRequest(request)) return {status: 'blocked', reason: 'invalid-request'};
  const observed = observeComments(host);
  if ('reason' in observed) return {status: 'blocked', reason: observed.reason};
  return {status: 'ready', plan: {
    version: 1,
    documentIdentity: observedContext.identity,
    revision: observedContext.revision,
    commentsFingerprint: observed.fingerprint,
    visible: request.visible,
    guideLines: request.guideLines,
  }};
}

export function applyMemoViewChangeB048(
  host: Partial<MemoViewHostB048>, port: MemoViewContextB048, plan: MemoViewPlanB048,
): MemoViewTransitionB048 {
  if (typeof host.getCommentListV1 !== 'function') return {status: 'blocked', reason: 'api-unavailable'};
  const unsafeStory = safeStory(port); if (unsafeStory) return {status: 'blocked', reason: unsafeStory};
  if (!validPlan(plan)) return {status: 'blocked', reason: 'invalid-request'};
  const observedContext = context(port); if (!observedContext) return {status: 'blocked', reason: 'invalid-context'};
  if (observedContext.identity !== plan.documentIdentity || observedContext.revision !== plan.revision) {
    return {status: 'blocked', reason: 'stale-document'};
  }
  const observed = observeComments(host);
  if ('reason' in observed) return {status: 'blocked', reason: observed.reason};
  if (observed.fingerprint !== plan.commentsFingerprint) return {status: 'blocked', reason: 'stale-comments'};

  const markers: MemoMarkerB048[] = plan.visible ? observed.comments.map(comment => ({
    fieldId: comment.fieldId,
    memoIndex: comment.memoIndex,
    section: comment.section,
    paragraph: comment.paragraph,
    offset: comment.start,
    text: comment.text,
    author: comment.author,
  })) : [];
  const guideLineAnchors: MemoGuideLineB048[] = plan.visible && plan.guideLines
    ? markers.map(marker => ({
      fieldId: marker.fieldId,
      section: marker.section,
      paragraph: marker.paragraph,
      offset: marker.offset,
    }))
    : [];
  return {status: 'applied', state: {
    documentIdentity: observedContext.identity,
    revision: observedContext.revision,
    commentsFingerprint: observed.fingerprint,
    visible: plan.visible,
    guideLines: plan.guideLines,
    commentCount: observed.comments.length,
    markers,
    guideLineAnchors,
  }};
}
