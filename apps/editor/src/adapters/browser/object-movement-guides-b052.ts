export type ObjectGuideRectB052 = Readonly<{
  left: number;
  top: number;
  width: number;
  height: number;
}>;

export type ObjectGuidePeerB052 = Readonly<{
  id: string;
  rect: ObjectGuideRectB052;
}>;

export type ObjectGuideSettingsB052 = Readonly<{
  enabled: boolean;
  snap: boolean;
  thresholdPx: number;
}>;

export type ObjectGuideLineB052 = Readonly<{
  axis: 'horizontal' | 'vertical';
  position: number;
  start: number;
  end: number;
  source: 'page' | 'object';
  sourceId?: string;
}>;

export type ObjectGuideResultB052 = Readonly<{
  rect: ObjectGuideRectB052;
  deltaX: number;
  deltaY: number;
  guides: readonly ObjectGuideLineB052[];
}>;

export type StoredObjectGuideSettingsB052 = Readonly<{
  version: 1;
  enabled: boolean;
  snap: boolean;
  thresholdPx: number;
}>;

export interface ObjectGuideSettingsStorageB052 {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ObjectGuideOverlayTargetB052 {
  render(value: ObjectGuideResultB052): void;
  clear(): void;
}

export const OBJECT_GUIDE_SETTINGS_KEY_B052 = 'jueony.user.object-movement-guides.v1';
export const DEFAULT_OBJECT_GUIDE_SETTINGS_B052: ObjectGuideSettingsB052 = Object.freeze({
  enabled: true,
  snap: true,
  thresholdPx: 5,
});

const MAX_PEERS = 512;
const MAX_COORDINATE = 10_000_000;

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function validRect(value: ObjectGuideRectB052): boolean {
  return finite(value.left) && finite(value.top) && finite(value.width) && finite(value.height)
    && Math.abs(value.left) <= MAX_COORDINATE && Math.abs(value.top) <= MAX_COORDINATE
    && value.width >= 0 && value.height >= 0
    && value.width <= MAX_COORDINATE && value.height <= MAX_COORDINATE;
}

function validateSettings(value: unknown): ObjectGuideSettingsB052 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('B052 개체 이동 안내선 설정이 올바르지 않습니다.');
  }
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.enabled !== 'boolean' || typeof candidate.snap !== 'boolean'
    || !finite(candidate.thresholdPx) || candidate.thresholdPx < 0 || candidate.thresholdPx > 24) {
    throw new Error('B052 개체 이동 안내선 설정이 올바르지 않습니다.');
  }
  return Object.freeze({
    enabled: candidate.enabled,
    snap: candidate.snap,
    thresholdPx: candidate.thresholdPx,
  });
}

export function parseStoredObjectGuideSettingsB052(raw: string): ObjectGuideSettingsB052 {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error('B052 개체 이동 안내선 설정을 읽지 못했습니다.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || (value as Record<string, unknown>).version !== 1) {
    throw new Error('B052 개체 이동 안내선 설정을 읽지 못했습니다.');
  }
  return validateSettings(value);
}

export function createObjectGuideSettingsB052(
  storage: ObjectGuideSettingsStorageB052,
  key = OBJECT_GUIDE_SETTINGS_KEY_B052,
) {
  let current: ObjectGuideSettingsB052;
  try {
    const raw = storage.getItem(key);
    current = raw === null ? DEFAULT_OBJECT_GUIDE_SETTINGS_B052 : parseStoredObjectGuideSettingsB052(raw);
  } catch {
    current = DEFAULT_OBJECT_GUIDE_SETTINGS_B052;
  }
  return {
    snapshot: (): ObjectGuideSettingsB052 => ({...current}),
    commit(value: unknown): ObjectGuideSettingsB052 {
      const next = validateSettings(value);
      storage.setItem(key, JSON.stringify({version: 1, ...next} satisfies StoredObjectGuideSettingsB052));
      current = next;
      return {...current};
    },
  };
}

type AxisCandidate = Readonly<{
  delta: number;
  target: number;
  source: 'page' | 'object';
  sourceId?: string;
  spanStart: number;
  spanEnd: number;
  priority: number;
}>;

function anchors(start: number, size: number): readonly number[] {
  return [start, start + size / 2, start + size];
}

function best(candidates: readonly AxisCandidate[], threshold: number): AxisCandidate | undefined {
  return candidates
    .filter(candidate => Math.abs(candidate.delta) <= threshold)
    .sort((left, right) => Math.abs(left.delta) - Math.abs(right.delta)
      || left.priority - right.priority
      || left.target - right.target)[0];
}

function axisCandidates(
  movingAnchors: readonly number[],
  targetAnchors: readonly number[],
  source: 'page' | 'object',
  priorityBase: number,
  spanStart: number,
  spanEnd: number,
  sourceId?: string,
): AxisCandidate[] {
  const result: AxisCandidate[] = [];
  for (let targetIndex = 0; targetIndex < targetAnchors.length; targetIndex += 1) {
    for (let movingIndex = 0; movingIndex < movingAnchors.length; movingIndex += 1) {
      result.push({
        delta: targetAnchors[targetIndex] - movingAnchors[movingIndex],
        target: targetAnchors[targetIndex],
        source,
        sourceId,
        spanStart,
        spanEnd,
        priority: priorityBase + targetIndex * 3 + movingIndex,
      });
    }
  }
  return result;
}

/**
 * Computes CSS-pixel drag guides without reading or mutating document data.
 * The caller owns pointer capture and applies the returned delta to the actual
 * shape command only after its normal revision/protection checks succeed.
 */
export function computeObjectMoveGuidesB052(input: Readonly<{
  activeId: string;
  proposed: ObjectGuideRectB052;
  page: ObjectGuideRectB052;
  peers: readonly ObjectGuidePeerB052[];
  zoom: number;
  settings: ObjectGuideSettingsB052;
}>): ObjectGuideResultB052 {
  const settings = validateSettings(input.settings);
  if (typeof input.activeId !== 'string' || input.activeId.length === 0 || input.activeId.length > 256
    || !validRect(input.proposed) || !validRect(input.page)
    || !finite(input.zoom) || input.zoom < 0.1 || input.zoom > 8
    || !Array.isArray(input.peers) || input.peers.length > MAX_PEERS
    || input.peers.some(peer => !peer || typeof peer.id !== 'string' || peer.id.length === 0
      || peer.id.length > 256 || !validRect(peer.rect))) {
    throw new Error('B052 개체 이동 안내선 입력이 올바르지 않습니다.');
  }
  if (!settings.enabled) return Object.freeze({rect: {...input.proposed}, deltaX: 0, deltaY: 0, guides: []});

  const xMoving = anchors(input.proposed.left, input.proposed.width);
  const yMoving = anchors(input.proposed.top, input.proposed.height);
  const xCandidates = axisCandidates(
    xMoving, anchors(input.page.left, input.page.width), 'page', 0,
    input.page.top, input.page.top + input.page.height,
  );
  const yCandidates = axisCandidates(
    yMoving, anchors(input.page.top, input.page.height), 'page', 0,
    input.page.left, input.page.left + input.page.width,
  );

  input.peers.forEach((peer, index) => {
    if (peer.id === input.activeId) return;
    xCandidates.push(...axisCandidates(
      xMoving, anchors(peer.rect.left, peer.rect.width), 'object', 100 + index * 10,
      Math.min(input.proposed.top, peer.rect.top),
      Math.max(input.proposed.top + input.proposed.height, peer.rect.top + peer.rect.height),
      peer.id,
    ));
    yCandidates.push(...axisCandidates(
      yMoving, anchors(peer.rect.top, peer.rect.height), 'object', 100 + index * 10,
      Math.min(input.proposed.left, peer.rect.left),
      Math.max(input.proposed.left + input.proposed.width, peer.rect.left + peer.rect.width),
      peer.id,
    ));
  });

  const threshold = settings.thresholdPx / input.zoom;
  const x = best(xCandidates, threshold);
  const y = best(yCandidates, threshold);
  const deltaX = settings.snap && x ? x.delta : 0;
  const deltaY = settings.snap && y ? y.delta : 0;
  const rect = Object.freeze({
    left: input.proposed.left + deltaX,
    top: input.proposed.top + deltaY,
    width: input.proposed.width,
    height: input.proposed.height,
  });
  const guides: ObjectGuideLineB052[] = [];
  if (x) guides.push(Object.freeze({
    axis: 'vertical', position: x.target, start: x.spanStart, end: x.spanEnd,
    source: x.source, ...(x.sourceId ? {sourceId: x.sourceId} : {}),
  }));
  if (y) guides.push(Object.freeze({
    axis: 'horizontal', position: y.target, start: y.spanStart, end: y.spanEnd,
    source: y.source, ...(y.sourceId ? {sourceId: y.sourceId} : {}),
  }));
  return Object.freeze({rect, deltaX, deltaY, guides: Object.freeze(guides)});
}

/** Creates a dedicated overlay; it never replaces children outside the supplied layer. */
export function createObjectGuideOverlayTargetB052(layer: HTMLElement): ObjectGuideOverlayTargetB052 {
  const clear = () => layer.replaceChildren();
  return {
    clear,
    render(value) {
      clear();
      for (const guide of value.guides) {
        const line = layer.ownerDocument.createElement('div');
        line.dataset.jueonyObjectGuide = guide.axis;
        line.dataset.source = guide.source;
        if (guide.sourceId) line.dataset.sourceId = guide.sourceId;
        Object.assign(line.style, {
          position: 'absolute',
          pointerEvents: 'none',
          background: '#2f80ed',
          zIndex: '6',
          ...(guide.axis === 'vertical'
            ? {left: `${guide.position}px`, top: `${guide.start}px`, width: '1px', height: `${guide.end - guide.start}px`}
            : {left: `${guide.start}px`, top: `${guide.position}px`, width: `${guide.end - guide.start}px`, height: '1px'}),
        });
        layer.append(line);
      }
    },
  };
}
