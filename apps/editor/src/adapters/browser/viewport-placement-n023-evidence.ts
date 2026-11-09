import {
  placeViewportPopup,
  type AnchorRect,
  type PopupPlacement,
  type ViewportRect,
} from './viewport-placement.ts';

/**
 * N023 accepts browser-owned CSS-pixel geometry only. It deliberately does not
 * translate Windows desktop, native window, physical-pixel, or Hancom geometry.
 */
export type ViewportCoordinateSpaceN023 = 'visual-viewport-css-px';

export type ViewportOwnerN023 = Readonly<{
  identity: string;
  instance: string;
}>;

export type BrowserViewportEvidenceN023 = Readonly<{
  version: 1;
  surfaceId: string;
  owner: ViewportOwnerN023;
  active: boolean;
  coordinateSpace: ViewportCoordinateSpaceN023;
  source: 'window.visualViewport' | 'window.inner-size';
  sequence: number;
  viewport: ViewportRect;
}>;

export type BrowserAnchorEvidenceN023 = Readonly<{
  version: 1;
  surfaceId: string;
  owner: ViewportOwnerN023;
  coordinateSpace: ViewportCoordinateSpaceN023;
  source: 'element.getBoundingClientRect';
  sequence: number;
  rect: AnchorRect;
}>;

export type ViewportPlacementEvidenceN023 = Readonly<{
  version: 1;
  surfaceId: string;
  owner: ViewportOwnerN023;
  coordinateSpace: ViewportCoordinateSpaceN023;
  source: BrowserViewportEvidenceN023['source'];
  sequence: number;
  viewport: ViewportRect;
  anchor: AnchorRect;
  placement: PopupPlacement;
}>;

export type ViewportPlacementErrorCodeN023 =
  | 'invalid-request'
  | 'unsupported-coordinate-space'
  | 'no-active-surface'
  | 'ambiguous-surface'
  | 'stale-owner'
  | 'stale-geometry'
  | 'anchor-outside-viewport';

export class ViewportPlacementErrorN023 extends Error {
  readonly code: ViewportPlacementErrorCodeN023;

  constructor(code: ViewportPlacementErrorCodeN023) {
    super({
      'invalid-request': '화면 배치 증거가 올바르지 않습니다.',
      'unsupported-coordinate-space': '브라우저 CSS 좌표가 아닌 화면 좌표는 안전하게 변환할 수 없습니다.',
      'no-active-surface': '현재 문서의 활성 화면을 찾지 못했습니다.',
      'ambiguous-surface': '같은 문서 화면 증거가 중복되어 배치를 결정할 수 없습니다.',
      'stale-owner': '화면 증거가 현재 문서 인스턴스의 것이 아닙니다.',
      'stale-geometry': '화면과 기준점의 측정 시점이 다릅니다.',
      'anchor-outside-viewport': '기준점이 측정된 화면 밖에 있습니다.',
    }[code]);
    this.name = 'ViewportPlacementErrorN023';
    this.code = code;
  }
}

const TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,255}$/u;
const MAX_SURFACES = 16;
const MAX_COORDINATE = 1_000_000;
const MAX_MARGIN = 128;

type RecordValue = Record<string, unknown>;

function record(value: unknown): RecordValue | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as RecordValue
    : undefined;
}

function exact(value: RecordValue, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function token(value: unknown): value is string {
  return typeof value === 'string' && TOKEN.test(value);
}

function bounded(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= MAX_COORDINATE;
}

function natural(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function coordinateSpace(value: unknown): ViewportCoordinateSpaceN023 {
  if (value !== 'visual-viewport-css-px') {
    throw new ViewportPlacementErrorN023('unsupported-coordinate-space');
  }
  return value;
}

function parseOwner(value: unknown): ViewportOwnerN023 {
  const item = record(value);
  if (!item || !exact(item, ['identity', 'instance']) || !token(item.identity) || !token(item.instance)) {
    throw new ViewportPlacementErrorN023('invalid-request');
  }
  return Object.freeze({identity: item.identity, instance: item.instance});
}

function parseViewport(value: unknown): ViewportRect {
  const item = record(value);
  if (!item || !exact(item, ['left', 'top', 'width', 'height'])
    || !bounded(item.left) || !bounded(item.top) || !bounded(item.width) || !bounded(item.height)
    || item.width <= 0 || item.height <= 0) {
    throw new ViewportPlacementErrorN023('invalid-request');
  }
  return Object.freeze({left: item.left, top: item.top, width: item.width, height: item.height});
}

function parseAnchor(value: unknown): AnchorRect {
  const item = record(value);
  if (!item || !exact(item, ['left', 'top', 'right', 'bottom'])
    || !bounded(item.left) || !bounded(item.top) || !bounded(item.right) || !bounded(item.bottom)
    || item.right < item.left || item.bottom < item.top) {
    throw new ViewportPlacementErrorN023('invalid-request');
  }
  return Object.freeze({left: item.left, top: item.top, right: item.right, bottom: item.bottom});
}

function parseSurface(value: unknown): BrowserViewportEvidenceN023 {
  const item = record(value);
  if (!item || !exact(item, [
    'version', 'surfaceId', 'owner', 'active', 'coordinateSpace', 'source', 'sequence', 'viewport',
  ]) || item.version !== 1 || !token(item.surfaceId) || typeof item.active !== 'boolean'
    || (item.source !== 'window.visualViewport' && item.source !== 'window.inner-size')
    || !natural(item.sequence)) {
    throw new ViewportPlacementErrorN023('invalid-request');
  }
  return Object.freeze({
    version: 1,
    surfaceId: item.surfaceId,
    owner: parseOwner(item.owner),
    active: item.active,
    coordinateSpace: coordinateSpace(item.coordinateSpace),
    source: item.source,
    sequence: item.sequence,
    viewport: parseViewport(item.viewport),
  });
}

function parseAnchorEvidence(value: unknown): BrowserAnchorEvidenceN023 {
  const item = record(value);
  if (!item || !exact(item, [
    'version', 'surfaceId', 'owner', 'coordinateSpace', 'source', 'sequence', 'rect',
  ]) || item.version !== 1 || !token(item.surfaceId)
    || item.source !== 'element.getBoundingClientRect' || !natural(item.sequence)) {
    throw new ViewportPlacementErrorN023('invalid-request');
  }
  return Object.freeze({
    version: 1,
    surfaceId: item.surfaceId,
    owner: parseOwner(item.owner),
    coordinateSpace: coordinateSpace(item.coordinateSpace),
    source: 'element.getBoundingClientRect',
    sequence: item.sequence,
    rect: parseAnchor(item.rect),
  });
}

function inside(anchor: AnchorRect, viewport: ViewportRect): boolean {
  const right = viewport.left + viewport.width;
  const bottom = viewport.top + viewport.height;
  return anchor.left >= viewport.left && anchor.right <= right
    && anchor.top >= viewport.top && anchor.bottom <= bottom;
}

/**
 * Selects one active browser surface using explicit public geometry evidence.
 * DPR is intentionally absent: DOMRect and visualViewport are already CSS px.
 */
export function placePopupFromViewportEvidenceN023(request: unknown): ViewportPlacementEvidenceN023 {
  const item = record(request);
  if (!item || !exact(item, ['version', 'surfaces', 'anchor', 'popup', 'margin']) || item.version !== 1
    || !Array.isArray(item.surfaces) || item.surfaces.length === 0 || item.surfaces.length > MAX_SURFACES) {
    throw new ViewportPlacementErrorN023('invalid-request');
  }
  const anchor = parseAnchorEvidence(item.anchor);
  const surfaces = item.surfaces.map(parseSurface);
  const matches = surfaces.filter(surface => surface.active && surface.surfaceId === anchor.surfaceId);
  if (matches.length === 0) throw new ViewportPlacementErrorN023('no-active-surface');
  if (matches.length !== 1) throw new ViewportPlacementErrorN023('ambiguous-surface');
  const surface = matches[0]!;
  if (surface.owner.identity !== anchor.owner.identity || surface.owner.instance !== anchor.owner.instance) {
    throw new ViewportPlacementErrorN023('stale-owner');
  }
  if (surface.sequence !== anchor.sequence) throw new ViewportPlacementErrorN023('stale-geometry');
  if (!inside(anchor.rect, surface.viewport)) throw new ViewportPlacementErrorN023('anchor-outside-viewport');

  const popup = record(item.popup);
  if (!popup || !exact(popup, ['width', 'height']) || !bounded(popup.width) || !bounded(popup.height)
    || popup.width <= 0 || popup.height <= 0 || !bounded(item.margin)
    || item.margin < 0 || item.margin > MAX_MARGIN) {
    throw new ViewportPlacementErrorN023('invalid-request');
  }
  const placement = placeViewportPopup(anchor.rect, {width: popup.width, height: popup.height}, surface.viewport, item.margin);
  return Object.freeze({
    version: 1,
    surfaceId: surface.surfaceId,
    owner: surface.owner,
    coordinateSpace: surface.coordinateSpace,
    source: surface.source,
    sequence: surface.sequence,
    viewport: surface.viewport,
    anchor: anchor.rect,
    placement: Object.freeze(placement),
  });
}
