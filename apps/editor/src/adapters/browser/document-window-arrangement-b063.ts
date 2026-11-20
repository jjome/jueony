export type DocumentWindowArrangementModeB063 = 'tile-horizontal' | 'tile-vertical' | 'cascade';

export type DocumentWindowRectB063 = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;

export type DocumentWindowDescriptorB063 = Readonly<{
  windowId: string;
  documentId: string;
  revision: string;
  windowEpoch: string;
  visible: boolean;
  modal: boolean;
  movable: boolean;
  rect: DocumentWindowRectB063;
}>;

export type DocumentWindowPlacementB063 = Readonly<{
  windowId: string;
  rect: DocumentWindowRectB063;
}>;

export type DocumentWindowArrangementPlanB063 = Readonly<{
  schemaVersion: 1;
  mode: DocumentWindowArrangementModeB063;
  viewport: DocumentWindowRectB063;
  before: readonly DocumentWindowDescriptorB063[];
  target: readonly DocumentWindowPlacementB063[];
  evidenceStamp: string;
}>;

export type DocumentWindowArrangementBlockReasonB063 =
  | 'malformed'
  | 'one-window'
  | 'hidden-window'
  | 'modal-window'
  | 'unmovable-window'
  | 'duplicate-window'
  | 'duplicate-document';

export type DocumentWindowArrangementCaptureB063 =
  | Readonly<{status: 'ready'; plan: DocumentWindowArrangementPlanB063}>
  | Readonly<{status: 'blocked'; reason: DocumentWindowArrangementBlockReasonB063}>;

export interface DocumentWindowArrangementPortB063 {
  snapshot(): readonly DocumentWindowDescriptorB063[];
  applyBatch(placements: readonly DocumentWindowPlacementB063[]): boolean;
}

const MAX_WINDOWS = 16;
const MAX_COORDINATE = 100_000;

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function validRect(value: unknown): value is DocumentWindowRectB063 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const rect = value as Record<string, unknown>;
  return finite(rect.x) && finite(rect.y) && finite(rect.width) && finite(rect.height)
    && Math.abs(rect.x) <= MAX_COORDINATE && Math.abs(rect.y) <= MAX_COORDINATE
    && rect.width >= 120 && rect.height >= 80
    && rect.width <= MAX_COORDINATE && rect.height <= MAX_COORDINATE;
}

function validToken(value: unknown, max = 256): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max;
}

function normalized(value: readonly DocumentWindowDescriptorB063[]): readonly DocumentWindowDescriptorB063[] | undefined {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_WINDOWS) return undefined;
  const result: DocumentWindowDescriptorB063[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)
      || !validToken(item.windowId) || !validToken(item.documentId)
      || !validToken(item.revision, 512) || !validToken(item.windowEpoch, 512)
      || typeof item.visible !== 'boolean' || typeof item.modal !== 'boolean'
      || typeof item.movable !== 'boolean' || !validRect(item.rect)) return undefined;
    result.push(Object.freeze({...item, rect: Object.freeze({...item.rect})}));
  }
  return Object.freeze(result.sort((left, right) => left.windowId.localeCompare(right.windowId)));
}

function stamp(value: readonly DocumentWindowDescriptorB063[]): string {
  return JSON.stringify(value.map(item => [
    item.windowId, item.documentId, item.revision, item.windowEpoch,
    item.visible, item.modal, item.movable,
    item.rect.x, item.rect.y, item.rect.width, item.rect.height,
  ]));
}

function placement(windowId: string, rect: DocumentWindowRectB063): DocumentWindowPlacementB063 {
  return Object.freeze({windowId, rect: Object.freeze(rect)});
}

function targets(
  mode: DocumentWindowArrangementModeB063,
  windows: readonly DocumentWindowDescriptorB063[],
  viewport: DocumentWindowRectB063,
): readonly DocumentWindowPlacementB063[] | undefined {
  if (mode === 'tile-horizontal') {
    const width = viewport.width / windows.length;
    if (width < 120) return undefined;
    return Object.freeze(windows.map((item, index) => placement(item.windowId, {
      x: viewport.x + width * index, y: viewport.y, width, height: viewport.height,
    })));
  }
  if (mode === 'tile-vertical') {
    const height = viewport.height / windows.length;
    if (height < 80) return undefined;
    return Object.freeze(windows.map((item, index) => placement(item.windowId, {
      x: viewport.x, y: viewport.y + height * index, width: viewport.width, height,
    })));
  }
  if (mode === 'cascade') {
    const offset = 28;
    const width = viewport.width - offset * (windows.length - 1);
    const height = viewport.height - offset * (windows.length - 1);
    if (width < 120 || height < 80) return undefined;
    return Object.freeze(windows.map((item, index) => placement(item.windowId, {
      x: viewport.x + offset * index, y: viewport.y + offset * index, width, height,
    })));
  }
  return undefined;
}

export function captureDocumentWindowArrangementB063(input: Readonly<{
  mode: DocumentWindowArrangementModeB063;
  viewport: DocumentWindowRectB063;
  windows: readonly DocumentWindowDescriptorB063[];
}>): DocumentWindowArrangementCaptureB063 {
  if (!validRect(input.viewport)) return {status: 'blocked', reason: 'malformed'};
  const windows = normalized(input.windows);
  if (!windows) return {status: 'blocked', reason: 'malformed'};
  if (windows.length < 2) return {status: 'blocked', reason: 'one-window'};
  if (new Set(windows.map(item => item.windowId)).size !== windows.length) return {status: 'blocked', reason: 'duplicate-window'};
  if (new Set(windows.map(item => item.documentId)).size !== windows.length) return {status: 'blocked', reason: 'duplicate-document'};
  if (windows.some(item => !item.visible)) return {status: 'blocked', reason: 'hidden-window'};
  if (windows.some(item => item.modal)) return {status: 'blocked', reason: 'modal-window'};
  if (windows.some(item => !item.movable)) return {status: 'blocked', reason: 'unmovable-window'};
  const target = targets(input.mode, windows, input.viewport);
  if (!target) return {status: 'blocked', reason: 'malformed'};
  return {status: 'ready', plan: Object.freeze({
    schemaVersion: 1,
    mode: input.mode,
    viewport: Object.freeze({...input.viewport}),
    before: windows,
    target,
    evidenceStamp: stamp(windows),
  })};
}

function sameOwner(left: readonly DocumentWindowDescriptorB063[], right: readonly DocumentWindowDescriptorB063[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((item, index) => {
    const current = right[index];
    return item.windowId === current.windowId && item.documentId === current.documentId
      && item.revision === current.revision && item.windowEpoch === current.windowEpoch
      && item.visible === current.visible && item.modal === current.modal && item.movable === current.movable;
  });
}

function sameRect(left: DocumentWindowRectB063, right: DocumentWindowRectB063): boolean {
  return Math.abs(left.x - right.x) < 0.01 && Math.abs(left.y - right.y) < 0.01
    && Math.abs(left.width - right.width) < 0.01 && Math.abs(left.height - right.height) < 0.01;
}

function originalPlacements(plan: DocumentWindowArrangementPlanB063): readonly DocumentWindowPlacementB063[] {
  return plan.before.map(item => placement(item.windowId, {...item.rect}));
}

/** Applies one complete batch and rolls the whole batch back on any rejection or readback mismatch. */
export function applyDocumentWindowArrangementB063(
  port: DocumentWindowArrangementPortB063,
  plan: DocumentWindowArrangementPlanB063,
): readonly DocumentWindowPlacementB063[] {
  const current = normalized(port.snapshot());
  if (!current || plan.schemaVersion !== 1 || plan.evidenceStamp !== stamp(plan.before)
    || !sameOwner(plan.before, current) || stamp(current) !== plan.evidenceStamp) {
    throw new Error('B063 문서 창 상태가 계획 이후 변경되었습니다.');
  }
  const restore = originalPlacements(plan);
  const rollback = () => {
    let accepted = false;
    try { accepted = port.applyBatch(restore); } catch { accepted = false; }
    const restored = normalized(port.snapshot());
    if (!accepted || !restored || !sameOwner(plan.before, restored)
      || restored.some((item, index) => item.windowId !== restore[index].windowId
        || !sameRect(item.rect, restore[index].rect))) {
      throw new Error('B063 원래 문서 창 배치를 복원하지 못했습니다.');
    }
  };
  try {
    if (!port.applyBatch(plan.target)) throw new Error('B063 문서 창 일괄 배치를 적용하지 못했습니다.');
    const after = normalized(port.snapshot());
    if (!after || !sameOwner(plan.before, after)
      || after.some((item, index) => item.windowId !== plan.target[index].windowId
        || !sameRect(item.rect, plan.target[index].rect))) {
      throw new Error('B063 문서 창 일괄 배치 결과가 일치하지 않습니다.');
    }
    return plan.target.map(item => placement(item.windowId, {...item.rect}));
  } catch (error) {
    rollback();
    throw error;
  }
}
