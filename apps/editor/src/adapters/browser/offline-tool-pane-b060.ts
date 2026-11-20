/**
 * B060 is a browser-side view contract only.  It deliberately keeps provider
 * data, document bytes and edit history outside persisted pane preferences.
 */
export type OfflineToolKindB060 = 'dictionary' | 'translation' | 'script-macro';

export type OfflineToolCapabilityB060 = Readonly<{
  kind: OfflineToolKindB060;
  id: string;
  label: string;
  version: string;
  offline: true;
}>;

export type OfflineToolPaneOwnerB060 = Readonly<{
  identity: string;
  instance: string;
  revision: string;
  active: true;
}>;

export type OfflineToolPanePreferenceB060 = Readonly<{
  version: 1;
  open: boolean;
  activeTool: OfflineToolKindB060;
}>;

export type OfflineToolPaneViewB060 = Readonly<{
  version: 1;
  owner: OfflineToolPaneOwnerB060;
  open: boolean;
  activeTool: OfflineToolKindB060;
  tools: readonly OfflineToolCapabilityB060[];
}>;

export interface OfflineToolPaneStorageB060 {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface OfflineToolPaneOptionsB060 {
  capabilities: readonly unknown[];
  readOwner(): unknown;
  storage: OfflineToolPaneStorageB060;
  project(view: OfflineToolPaneViewB060): void;
  key?: string;
}

type ErrorCode =
  | 'invalid-capability' | 'invalid-owner' | 'inactive-document' | 'stale-document'
  | 'invalid-preference' | 'unknown-tool' | 'pane-closed' | 'read' | 'write';

export class OfflineToolPaneErrorB060 extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode) {
    super({
      'invalid-capability': '오프라인 작업 창 기능 등록이 올바르지 않습니다.',
      'invalid-owner': '작업 창의 문서 소유권을 확인하지 못했습니다.',
      'inactive-document': '현재 활성 문서의 작업 창이 아닙니다.',
      'stale-document': '문서가 바뀌었습니다. 작업 창을 다시 여세요.',
      'invalid-preference': '저장된 오프라인 작업 창 설정이 올바르지 않습니다.',
      'unknown-tool': '등록되지 않은 오프라인 도구입니다.',
      'pane-closed': '이미 끝난 오프라인 작업 창 세션입니다.',
      read: '오프라인 작업 창 설정을 읽지 못했습니다.',
      write: '오프라인 작업 창 설정을 저장하지 못했습니다.',
    }[code]);
    this.name = 'OfflineToolPaneErrorB060';
    this.code = code;
  }
}

export const OFFLINE_TOOL_PANE_KEY_B060 = 'jueony.user.offline-tool-pane.v1';

const KINDS = Object.freeze(['dictionary', 'translation', 'script-macro'] as const);
const KIND_SET = new Set<string>(KINDS);
const TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,127}$/u;
const MAX_LABEL_SCALARS = 80;
const MAX_STORED_BYTES = 1024;

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : undefined;
}

function exact(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const current = Object.keys(value).sort();
  const expected = [...keys].sort();
  return current.length === expected.length && current.every((key, index) => key === expected[index]);
}

function toolKind(value: unknown): value is OfflineToolKindB060 {
  return typeof value === 'string' && KIND_SET.has(value);
}

function cleanLabel(value: unknown): value is string {
  return typeof value === 'string' && value.trim() === value && value.length > 0
    && Array.from(value).length <= MAX_LABEL_SCALARS && !/[\p{Cc}\p{Cf}]/u.test(value);
}

function freezeCapability(value: OfflineToolCapabilityB060): OfflineToolCapabilityB060 {
  return Object.freeze({...value});
}

function capabilities(input: readonly unknown[]): readonly OfflineToolCapabilityB060[] {
  if (!Array.isArray(input) || input.length < 1 || input.length > KINDS.length) {
    throw new OfflineToolPaneErrorB060('invalid-capability');
  }
  const seen = new Set<OfflineToolKindB060>();
  const values: OfflineToolCapabilityB060[] = [];
  for (const item of input) {
    const value = record(item);
    if (!value || !exact(value, ['kind', 'id', 'label', 'version', 'offline'])
      || !toolKind(value.kind) || seen.has(value.kind) || value.offline !== true
      || typeof value.id !== 'string' || !TOKEN.test(value.id)
      || typeof value.version !== 'string' || !TOKEN.test(value.version)
      || !cleanLabel(value.label)) {
      throw new OfflineToolPaneErrorB060('invalid-capability');
    }
    seen.add(value.kind);
    values.push(freezeCapability({kind: value.kind, id: value.id, label: value.label,
      version: value.version, offline: true}));
  }
  values.sort((left, right) => KINDS.indexOf(left.kind) - KINDS.indexOf(right.kind));
  return Object.freeze(values);
}

function owner(input: unknown): OfflineToolPaneOwnerB060 {
  const value = record(input);
  if (!value || !exact(value, ['identity', 'instance', 'revision', 'active'])
    || typeof value.identity !== 'string' || !TOKEN.test(value.identity)
    || typeof value.instance !== 'string' || !TOKEN.test(value.instance)
    || typeof value.revision !== 'string' || !TOKEN.test(value.revision)
    || value.active !== true) {
    throw new OfflineToolPaneErrorB060(value?.active === false ? 'inactive-document' : 'invalid-owner');
  }
  return Object.freeze({identity: value.identity, instance: value.instance, revision: value.revision, active: true});
}

function sameOwner(left: OfflineToolPaneOwnerB060, right: OfflineToolPaneOwnerB060): boolean {
  return left.identity === right.identity && left.instance === right.instance
    && left.revision === right.revision && right.active === true;
}

function preference(value: unknown, allowed: ReadonlySet<OfflineToolKindB060>): OfflineToolPanePreferenceB060 {
  const item = record(value);
  if (!item || !exact(item, ['version', 'open', 'activeTool']) || item.version !== 1
    || typeof item.open !== 'boolean' || !toolKind(item.activeTool) || !allowed.has(item.activeTool)) {
    throw new OfflineToolPaneErrorB060('invalid-preference');
  }
  return Object.freeze({version: 1, open: item.open, activeTool: item.activeTool});
}

function parse(raw: string, allowed: ReadonlySet<OfflineToolKindB060>): OfflineToolPanePreferenceB060 {
  if (new TextEncoder().encode(raw).length > MAX_STORED_BYTES) {
    throw new OfflineToolPaneErrorB060('invalid-preference');
  }
  let value: unknown;
  try { value = JSON.parse(raw); }
  catch { throw new OfflineToolPaneErrorB060('invalid-preference'); }
  return preference(value, allowed);
}

function view(
  paneOwner: OfflineToolPaneOwnerB060,
  state: OfflineToolPanePreferenceB060,
  tools: readonly OfflineToolCapabilityB060[],
): OfflineToolPaneViewB060 {
  return Object.freeze({version: 1, owner: paneOwner, open: state.open, activeTool: state.activeTool, tools});
}

export function createOfflineToolPaneControllerB060(options: OfflineToolPaneOptionsB060) {
  const tools = capabilities(options.capabilities);
  const allowed = new Set(tools.map(item => item.kind));
  const paneOwner = owner(options.readOwner());
  const key = options.key ?? OFFLINE_TOOL_PANE_KEY_B060;
  if (!TOKEN.test(key)) throw new OfflineToolPaneErrorB060('invalid-preference');
  let state: OfflineToolPanePreferenceB060;
  try {
    const raw = options.storage.getItem(key);
    state = raw === null
      ? Object.freeze({version: 1, open: false, activeTool: tools[0].kind})
      : parse(raw, allowed);
  } catch (error) {
    if (error instanceof OfflineToolPaneErrorB060) throw error;
    throw new OfflineToolPaneErrorB060('read');
  }
  let ended = false;

  const currentOwner = (): OfflineToolPaneOwnerB060 => {
    if (ended) throw new OfflineToolPaneErrorB060('pane-closed');
    let current: OfflineToolPaneOwnerB060;
    try { current = owner(options.readOwner()); }
    catch (error) {
      if (error instanceof OfflineToolPaneErrorB060 && error.code === 'inactive-document') throw error;
      throw new OfflineToolPaneErrorB060('stale-document');
    }
    if (!sameOwner(paneOwner, current)) throw new OfflineToolPaneErrorB060('stale-document');
    return current;
  };
  const project = () => options.project(view(paneOwner, state, tools));
  const replace = (next: OfflineToolPanePreferenceB060): OfflineToolPaneViewB060 => {
    currentOwner();
    const before = state;
    try {
      options.storage.setItem(key, JSON.stringify(next));
      const raw = options.storage.getItem(key);
      if (raw === null || JSON.stringify(parse(raw, allowed)) !== JSON.stringify(next)) throw new Error('readback');
    } catch {
      state = before;
      project();
      throw new OfflineToolPaneErrorB060('write');
    }
    currentOwner();
    state = next;
    project();
    return view(paneOwner, state, tools);
  };

  currentOwner();
  project();

  return Object.freeze({
    snapshot(): OfflineToolPaneViewB060 { currentOwner(); return view(paneOwner, state, tools); },
    open(kind: OfflineToolKindB060 = state.activeTool): OfflineToolPaneViewB060 {
      if (!allowed.has(kind)) throw new OfflineToolPaneErrorB060('unknown-tool');
      return replace(Object.freeze({version: 1, open: true, activeTool: kind}));
    },
    select(kind: OfflineToolKindB060): OfflineToolPaneViewB060 {
      currentOwner();
      if (!state.open) throw new OfflineToolPaneErrorB060('pane-closed');
      if (!allowed.has(kind)) throw new OfflineToolPaneErrorB060('unknown-tool');
      return replace(Object.freeze({version: 1, open: true, activeTool: kind}));
    },
    close(): OfflineToolPaneViewB060 {
      return replace(Object.freeze({version: 1, open: false, activeTool: state.activeTool}));
    },
    dispose(): void { ended = true; },
  });
}
