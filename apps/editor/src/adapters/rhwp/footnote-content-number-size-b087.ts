import {
  applyEndnoteContentNumberSizeB087,
  captureEndnoteContentNumberSizeB087,
  type CommandTransitionB087,
  type EndnoteShapeContextB087,
  type EndnoteShapeHostB087,
  type EndnoteShapeSealB087,
} from './endnote-content-number-size-b087.ts';

export interface FootnoteShapeHostB087 {
  getSectionCount(): number;
  getFootnoteShape(section: number): unknown;
  applyFootnoteContentNumberSize(section: number, small: boolean): unknown;
  saveSnapshot(): number;
  restoreSnapshot(token: number): unknown;
  discardSnapshot(token: number): void;
}

export interface FootnoteShapeSealB087 {
  readonly kind: 'footnote-content-number-size';
  readonly documentIdentity: string;
  readonly revision: string;
  readonly section: number;
  readonly shapeFingerprint: string;
  readonly small: boolean;
}

export type FootnoteCaptureResultB087 =
  | {status: 'ready'; seal: FootnoteShapeSealB087}
  | {status: 'blocked'; reason: string};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseObject(value: unknown): Record<string, unknown> | undefined {
  if (isObject(value)) return value;
  if (typeof value !== 'string' || value.length > 1_000_000) return undefined;
  try {
    const parsed = JSON.parse(value);
    return isObject(parsed) ? parsed : undefined;
  } catch { return undefined; }
}

function stable(value: Record<string, unknown>): string {
  return JSON.stringify(Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]])));
}

function hasFootnoteApi(host: Partial<FootnoteShapeHostB087>): host is FootnoteShapeHostB087 {
  return ['getSectionCount', 'getFootnoteShape', 'applyFootnoteContentNumberSize', 'saveSnapshot', 'restoreSnapshot', 'discardSnapshot']
    .every(name => typeof (host as Record<string, unknown>)[name] === 'function');
}

function proxy(host: FootnoteShapeHostB087): EndnoteShapeHostB087 {
  return {
    getSectionCount: () => host.getSectionCount(),
    getEndnoteShape: section => host.getFootnoteShape(section),
    applyEndnoteShape: (section, settings) => {
      const desired = parseObject(settings);
      const current = parseObject(host.getFootnoteShape(section));
      if (!desired || !current || typeof desired.numberCodeSuperscript !== 'boolean') return {ok: false};
      const requestedSmall = desired.numberCodeSuperscript;
      const {ok: _receipt, ...currentShape} = current;
      const desiredRest = {...desired, numberCodeSuperscript: currentShape.numberCodeSuperscript};
      if (stable(desiredRest) !== stable(currentShape)) return {ok: false};
      return host.applyFootnoteContentNumberSize(section, requestedSmall);
    },
    saveSnapshot: () => host.saveSnapshot(),
    restoreSnapshot: token => host.restoreSnapshot(token),
    discardSnapshot: token => host.discardSnapshot(token),
  };
}

export function auditFootnoteContentNumberSizeB087(host: Partial<FootnoteShapeHostB087>):
  {supported: true; scope: 'section'; option: 'content-number-small'} |
  {supported: false; reason: 'api-unavailable'} {
  return hasFootnoteApi(host)
    ? {supported: true, scope: 'section', option: 'content-number-small'}
    : {supported: false, reason: 'api-unavailable'};
}

export function captureFootnoteContentNumberSizeB087(
  host: Partial<FootnoteShapeHostB087>,
  port: EndnoteShapeContextB087,
  ownerSection: number,
): FootnoteCaptureResultB087 {
  if (!hasFootnoteApi(host)) return {status: 'blocked', reason: 'api-unavailable'};
  const result = captureEndnoteContentNumberSizeB087(proxy(host), port, ownerSection);
  if (result.status !== 'ready') return result;
  return {status: 'ready', seal: {...result.seal, kind: 'footnote-content-number-size'}};
}

export function applyFootnoteContentNumberSizeB087(
  host: Partial<FootnoteShapeHostB087>,
  port: EndnoteShapeContextB087,
  seal: FootnoteShapeSealB087,
  small: boolean,
): CommandTransitionB087 {
  if (!hasFootnoteApi(host)) return {status: 'blocked', reason: 'api-unavailable'};
  if (seal.kind !== 'footnote-content-number-size') return {status: 'blocked', reason: 'invalid-owner'};
  const translated: EndnoteShapeSealB087 = {...seal, kind: 'endnote-content-number-size'};
  return applyEndnoteContentNumberSizeB087(proxy(host), port, translated, small);
}
