/**
 * B062 is a host-view feature.  A split must share one document owner and one
 * mutation coordinator; creating a second document engine would fork undo,
 * dirty state, revision and saving and is therefore rejected by this contract.
 */
export type DocumentSplitDirectionB062 = 'horizontal' | 'vertical';
export type DocumentSplitSlotB062 = 'primary' | 'secondary';

export type DocumentSplitLayoutB062 = Readonly<{
  split: boolean;
  direction: DocumentSplitDirectionB062;
  ratio: number;
  active: DocumentSplitSlotB062;
}>;

export type StoredDocumentSplitLayoutB062 = Readonly<{
  version: 1;
  split: boolean;
  direction: DocumentSplitDirectionB062;
  ratio: number;
  active: DocumentSplitSlotB062;
}>;

export type SharedDocumentDescriptorB062 = Readonly<{
  workspaceId: string;
  tabId: string;
  documentIdentity: string;
  documentInstance: string;
  revision: string;
  /** Object identity is significant: both views must dispatch through it. */
  mutationCoordinator: object;
}>;

export interface SharedDocumentOwnerB062 {
  current(): SharedDocumentDescriptorB062;
}

export interface DocumentSplitViewportB062 {
  readonly id: string;
  /** Bind a view to the existing owner. It must not open or clone a document. */
  attach(owner: SharedDocumentOwnerB062): void;
  binding(): SharedDocumentDescriptorB062;
  focus(): void;
  detach(): void;
}

export interface DocumentSplitLayoutStorageB062 {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type DocumentSplitViewportFactoryB062 = (
  owner: SharedDocumentOwnerB062,
) => DocumentSplitViewportB062;

export class DocumentSplitViewErrorB062 extends Error {
  readonly code: 'invalid-layout' | 'invalid-owner' | 'binding-mismatch' | 'storage-read' | 'storage-write' | 'already-split' | 'not-split';

  constructor(code: DocumentSplitViewErrorB062['code']) {
    super({
      'invalid-layout': '편집 화면 분할 설정이 올바르지 않습니다.',
      'invalid-owner': '분할할 문서의 소유 정보가 올바르지 않습니다.',
      'binding-mismatch': '두 편집 화면이 같은 문서 상태를 공유하지 않습니다.',
      'storage-read': '편집 화면 분할 설정을 읽지 못했습니다.',
      'storage-write': '편집 화면 분할 설정을 저장하지 못했습니다.',
      'already-split': '편집 화면이 이미 분할되어 있습니다.',
      'not-split': '분할된 보조 편집 화면이 없습니다.',
    }[code]);
    this.name = 'DocumentSplitViewErrorB062';
    this.code = code;
  }
}

export const DEFAULT_DOCUMENT_SPLIT_LAYOUT_B062: DocumentSplitLayoutB062 = Object.freeze({
  split: false,
  direction: 'horizontal',
  ratio: 0.5,
  active: 'primary',
});

const MIN_RATIO = 0.2;
const MAX_RATIO = 0.8;

function nonEmpty(value: unknown, max = 512): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max
    && !/[\u0000-\u001f\u007f]/.test(value);
}

function descriptor(value: unknown): value is SharedDocumentDescriptorB062 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return nonEmpty(item.workspaceId) && nonEmpty(item.tabId) && nonEmpty(item.documentIdentity)
    && nonEmpty(item.documentInstance) && nonEmpty(item.revision, 4096)
    && typeof item.mutationCoordinator === 'object' && item.mutationCoordinator !== null;
}

function ratio(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
    && value >= MIN_RATIO && value <= MAX_RATIO;
}

export function validateDocumentSplitLayoutB062(value: unknown): DocumentSplitLayoutB062 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new DocumentSplitViewErrorB062('invalid-layout');
  }
  const item = value as Record<string, unknown>;
  if (typeof item.split !== 'boolean'
    || (item.direction !== 'horizontal' && item.direction !== 'vertical')
    || !ratio(item.ratio)
    || (item.active !== 'primary' && item.active !== 'secondary')
    || (!item.split && item.active !== 'primary')) {
    throw new DocumentSplitViewErrorB062('invalid-layout');
  }
  return Object.freeze({
    split: item.split,
    direction: item.direction,
    ratio: item.ratio,
    active: item.active,
  });
}

export function parseStoredDocumentSplitLayoutB062(raw: string): DocumentSplitLayoutB062 {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new DocumentSplitViewErrorB062('invalid-layout'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || (value as Record<string, unknown>).version !== 1) {
    throw new DocumentSplitViewErrorB062('invalid-layout');
  }
  return validateDocumentSplitLayoutB062(value);
}

export function documentSplitLayoutStorageKeyB062(
  userId: string,
  workspaceId: string,
  tabId: string,
): string {
  if (![userId, workspaceId, tabId].every(value => nonEmpty(value))) {
    throw new DocumentSplitViewErrorB062('invalid-owner');
  }
  return `jueony.user.split-view.v1.${encodeURIComponent(userId)}.${encodeURIComponent(workspaceId)}.${encodeURIComponent(tabId)}`;
}

function sameBinding(expected: SharedDocumentDescriptorB062, actual: SharedDocumentDescriptorB062): boolean {
  return actual.workspaceId === expected.workspaceId
    && actual.tabId === expected.tabId
    && actual.documentIdentity === expected.documentIdentity
    && actual.documentInstance === expected.documentInstance
    && actual.revision === expected.revision
    && actual.mutationCoordinator === expected.mutationCoordinator;
}

function readOwner(owner: SharedDocumentOwnerB062): SharedDocumentDescriptorB062 {
  let value: unknown;
  try { value = owner.current(); } catch { throw new DocumentSplitViewErrorB062('invalid-owner'); }
  if (!descriptor(value)) throw new DocumentSplitViewErrorB062('invalid-owner');
  return value;
}

function assertBound(owner: SharedDocumentOwnerB062, view: DocumentSplitViewportB062): SharedDocumentDescriptorB062 {
  const expected = readOwner(owner);
  let actual: unknown;
  try { actual = view.binding(); } catch { throw new DocumentSplitViewErrorB062('binding-mismatch'); }
  if (!descriptor(actual) || !sameBinding(expected, actual)) {
    throw new DocumentSplitViewErrorB062('binding-mismatch');
  }
  return expected;
}

function stored(value: DocumentSplitLayoutB062): StoredDocumentSplitLayoutB062 {
  return {version: 1, ...value};
}

export function createDocumentSplitViewControllerB062(options: {
  owner: SharedDocumentOwnerB062;
  primary: DocumentSplitViewportB062;
  storage: DocumentSplitLayoutStorageB062;
  storageKey: string;
}) {
  if (!nonEmpty(options.storageKey, 2048) || !nonEmpty(options.primary.id)) {
    throw new DocumentSplitViewErrorB062('invalid-owner');
  }
  try { options.primary.attach(options.owner); } catch { throw new DocumentSplitViewErrorB062('binding-mismatch'); }
  assertBound(options.owner, options.primary);

  let desired = DEFAULT_DOCUMENT_SPLIT_LAYOUT_B062;
  try {
    const raw = options.storage.getItem(options.storageKey);
    if (raw !== null) desired = parseStoredDocumentSplitLayoutB062(raw);
  } catch (error) {
    if (error instanceof DocumentSplitViewErrorB062) throw error;
    throw new DocumentSplitViewErrorB062('storage-read');
  }
  let layout: DocumentSplitLayoutB062 = Object.freeze({
    ...desired,
    split: false,
    active: 'primary',
  });
  let secondary: DocumentSplitViewportB062 | undefined;

  const snapshot = (): DocumentSplitLayoutB062 => Object.freeze({...layout});
  const ensureAllBound = (): void => {
    assertBound(options.owner, options.primary);
    if (secondary) assertBound(options.owner, secondary);
  };
  const persist = (next: DocumentSplitLayoutB062): void => {
    try { options.storage.setItem(options.storageKey, JSON.stringify(stored(next))); }
    catch { throw new DocumentSplitViewErrorB062('storage-write'); }
  };
  const attachSecondary = (factory: DocumentSplitViewportFactoryB062): DocumentSplitViewportB062 => {
    const before = readOwner(options.owner);
    let candidate: DocumentSplitViewportB062;
    try { candidate = factory(options.owner); } catch { throw new DocumentSplitViewErrorB062('binding-mismatch'); }
    if (!candidate || !nonEmpty(candidate.id) || candidate.id === options.primary.id) {
      throw new DocumentSplitViewErrorB062('binding-mismatch');
    }
    try {
      candidate.attach(options.owner);
      const after = assertBound(options.owner, candidate);
      if (!sameBinding(before, after)) throw new DocumentSplitViewErrorB062('binding-mismatch');
      return candidate;
    } catch (error) {
      try { candidate.detach(); } catch { /* detached best effort; document owner is untouched */ }
      if (error instanceof DocumentSplitViewErrorB062) throw error;
      throw new DocumentSplitViewErrorB062('binding-mismatch');
    }
  };

  return Object.freeze({
    snapshot,
    restorePending: () => desired.split,
    split(factory: DocumentSplitViewportFactoryB062, direction = layout.direction) {
      if (secondary) throw new DocumentSplitViewErrorB062('already-split');
      if (direction !== 'horizontal' && direction !== 'vertical') {
        throw new DocumentSplitViewErrorB062('invalid-layout');
      }
      ensureAllBound();
      const candidate = attachSecondary(factory);
      const next = validateDocumentSplitLayoutB062({...layout, split: true, direction, active: 'secondary'});
      try { persist(next); } catch (error) {
        try { candidate.detach(); } catch { /* preference failure remains authoritative */ }
        throw error;
      }
      secondary = candidate;
      layout = desired = next;
      candidate.focus();
      return snapshot();
    },
    restore(factory: DocumentSplitViewportFactoryB062) {
      if (!desired.split) return snapshot();
      if (secondary) throw new DocumentSplitViewErrorB062('already-split');
      ensureAllBound();
      secondary = attachSecondary(factory);
      layout = desired;
      (layout.active === 'secondary' ? secondary : options.primary).focus();
      return snapshot();
    },
    setDirection(direction: DocumentSplitDirectionB062) {
      ensureAllBound();
      const next = validateDocumentSplitLayoutB062({...layout, direction});
      persist(next);
      layout = desired = next;
      return snapshot();
    },
    setRatio(value: number) {
      ensureAllBound();
      const next = validateDocumentSplitLayoutB062({...layout, ratio: value});
      persist(next);
      layout = desired = next;
      return snapshot();
    },
    activate(slot: DocumentSplitSlotB062) {
      ensureAllBound();
      if (slot === 'secondary' && !secondary) throw new DocumentSplitViewErrorB062('not-split');
      const next = validateDocumentSplitLayoutB062({...layout, active: slot});
      persist(next);
      layout = desired = next;
      (slot === 'secondary' ? secondary! : options.primary).focus();
      return snapshot();
    },
    closeSecondary() {
      if (!secondary) throw new DocumentSplitViewErrorB062('not-split');
      ensureAllBound();
      const next = validateDocumentSplitLayoutB062({...layout, split: false, active: 'primary'});
      persist(next);
      const closing = secondary;
      secondary = undefined;
      layout = desired = next;
      try { closing.detach(); } catch { /* the shared document owner remains alive */ }
      options.primary.focus();
      return snapshot();
    },
  });
}
