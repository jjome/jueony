/**
 * B004 is a host navigation feature. It must never replace or mutate the
 * active document. The host opens every accepted choice in a new document
 * owner after the catalog stamp has been revalidated.
 */
export type DocumentStartChoiceB004 =
  | Readonly<{kind: 'blank'}>
  | Readonly<{kind: 'recent'; id: string; fingerprint: string}>
  | Readonly<{kind: 'template'; id: string; fingerprint: string; format: 'hwp' | 'hwpx'}>;

export type DocumentStartCatalogB004 = Readonly<{
  workspaceId: string;
  stamp: string;
  blankSupported: boolean;
  recents: readonly Readonly<{id: string; label: string; fingerprint: string}>[];
  templates: readonly Readonly<{
    id: string;
    label: string;
    fingerprint: string;
    format: 'hwp' | 'hwpx' | 'hwt' | 'unknown';
    local: boolean;
    authorized: boolean;
  }>[];
}>;

export type DocumentStartOptionB004 = Readonly<{
  key: string;
  label: string;
  choice: DocumentStartChoiceB004;
}>;

export type DocumentStartOpenedB004 = Readonly<{
  status: 'opened';
  tabId: string;
  documentIdentity: string;
  /** Preference persistence is secondary and never changes open success. */
  preferenceSaved: boolean;
}>;

export interface DocumentStartHostB004 {
  snapshot(): DocumentStartCatalogB004;
  openBlank(): Promise<unknown>;
  openRecent(value: Readonly<{id: string; fingerprint: string}>): Promise<unknown>;
  openTemplate(value: Readonly<{
    id: string;
    fingerprint: string;
    format: 'hwp' | 'hwpx';
  }>): Promise<unknown>;
}

export interface DocumentStartPreferenceStorageB004 {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export class DocumentStartErrorB004 extends Error {
  readonly code:
    | 'invalid-catalog'
    | 'unsupported-choice'
    | 'stale-catalog'
    | 'invalid-result'
    | 'already-closed'
    | 'preference-read'
    | 'preference-write';

  constructor(code: DocumentStartErrorB004['code']) {
    super({
      'invalid-catalog': '문서 시작 목록이 올바르지 않습니다.',
      'unsupported-choice': '현재 환경에서 지원하지 않는 문서 시작 항목입니다.',
      'stale-catalog': '문서 시작 목록이 바뀌었습니다. 다시 선택하세요.',
      'invalid-result': '새 문서가 실제로 열렸는지 확인하지 못했습니다.',
      'already-closed': '이미 끝난 문서 시작 도우미입니다.',
      'preference-read': '문서 시작 설정을 읽지 못했습니다.',
      'preference-write': '문서 시작 설정을 저장하지 못했습니다.',
    }[code]);
    this.name = 'DocumentStartErrorB004';
    this.code = code;
  }
}

export const DOCUMENT_START_PREFERENCE_KEY_B004 = 'jueony.user.document-start-assistant.v1';
const SHA256 = /^[0-9a-f]{64}$/;
const ID = /^[a-z0-9][a-z0-9._:-]{0,159}$/i;
const MAX_ITEMS = 100;

function text(value: unknown, max = 512): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max
    && !/[\u0000-\u001f\u007f]/.test(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function catalog(value: unknown): DocumentStartCatalogB004 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new DocumentStartErrorB004('invalid-catalog');
  }
  const item = value as Record<string, unknown>;
  if (!exactKeys(item, ['workspaceId', 'stamp', 'blankSupported', 'recents', 'templates'])
    || !text(item.workspaceId) || !text(item.stamp, 4096) || typeof item.blankSupported !== 'boolean'
    || !Array.isArray(item.recents) || !Array.isArray(item.templates)
    || item.recents.length > MAX_ITEMS || item.templates.length > MAX_ITEMS) {
    throw new DocumentStartErrorB004('invalid-catalog');
  }
  const recentIds = new Set<string>();
  const recents = item.recents.map(value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new DocumentStartErrorB004('invalid-catalog');
    }
    const row = value as Record<string, unknown>;
    if (!exactKeys(row, ['id', 'label', 'fingerprint'])
      || typeof row.id !== 'string' || !ID.test(row.id) || recentIds.has(row.id)
      || !text(row.label) || typeof row.fingerprint !== 'string' || !SHA256.test(row.fingerprint)) {
      throw new DocumentStartErrorB004('invalid-catalog');
    }
    recentIds.add(row.id);
    return Object.freeze({id: row.id, label: row.label, fingerprint: row.fingerprint});
  });
  const templateIds = new Set<string>();
  const formats = new Set(['hwp', 'hwpx', 'hwt', 'unknown']);
  const templates = item.templates.map(value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new DocumentStartErrorB004('invalid-catalog');
    }
    const row = value as Record<string, unknown>;
    if (!exactKeys(row, ['id', 'label', 'fingerprint', 'format', 'local', 'authorized'])
      || typeof row.id !== 'string' || !ID.test(row.id) || templateIds.has(row.id)
      || !text(row.label) || typeof row.fingerprint !== 'string' || !SHA256.test(row.fingerprint)
      || typeof row.format !== 'string' || !formats.has(row.format)
      || typeof row.local !== 'boolean' || typeof row.authorized !== 'boolean') {
      throw new DocumentStartErrorB004('invalid-catalog');
    }
    templateIds.add(row.id);
    return Object.freeze({
      id: row.id,
      label: row.label,
      fingerprint: row.fingerprint,
      format: row.format as 'hwp' | 'hwpx' | 'hwt' | 'unknown',
      local: row.local,
      authorized: row.authorized,
    });
  });
  return Object.freeze({
    workspaceId: item.workspaceId,
    stamp: item.stamp,
    blankSupported: item.blankSupported,
    recents: Object.freeze(recents),
    templates: Object.freeze(templates),
  });
}

function optionKey(choice: DocumentStartChoiceB004): string {
  return choice.kind === 'blank' ? 'blank' : `${choice.kind}:${choice.id}`;
}

function options(value: DocumentStartCatalogB004): readonly DocumentStartOptionB004[] {
  const result: DocumentStartOptionB004[] = [];
  if (value.blankSupported) {
    const choice: DocumentStartChoiceB004 = Object.freeze({kind: 'blank'});
    result.push(Object.freeze({key: 'blank', label: '빈 문서', choice}));
  }
  for (const row of value.recents) {
    const choice: DocumentStartChoiceB004 = Object.freeze({kind: 'recent', id: row.id, fingerprint: row.fingerprint});
    result.push(Object.freeze({key: optionKey(choice), label: row.label, choice}));
  }
  for (const row of value.templates) {
    if (!row.local || !row.authorized || (row.format !== 'hwp' && row.format !== 'hwpx')) continue;
    const choice: DocumentStartChoiceB004 = Object.freeze({
      kind: 'template', id: row.id, fingerprint: row.fingerprint, format: row.format,
    });
    result.push(Object.freeze({key: optionKey(choice), label: row.label, choice}));
  }
  return Object.freeze(result);
}

function parsePreference(raw: string | null): string | undefined {
  if (raw === null) return undefined;
  if (raw.length > 4096) throw new DocumentStartErrorB004('preference-read');
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new DocumentStartErrorB004('preference-read'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new DocumentStartErrorB004('preference-read');
  }
  const row = value as Record<string, unknown>;
  if (!exactKeys(row, ['version', 'choiceKey']) || row.version !== 1 || !text(row.choiceKey, 256)) {
    throw new DocumentStartErrorB004('preference-read');
  }
  return row.choiceKey;
}

function sameCatalog(left: DocumentStartCatalogB004, right: DocumentStartCatalogB004): boolean {
  return left.workspaceId === right.workspaceId && left.stamp === right.stamp;
}

type NativeOpenedB004 = Omit<DocumentStartOpenedB004, 'preferenceSaved'>;

function opened(value: unknown): NativeOpenedB004 | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const row = value as Record<string, unknown>;
  return exactKeys(row, ['status', 'tabId', 'documentIdentity']) && row.status === 'opened'
    && text(row.tabId) && text(row.documentIdentity, 4096)
    ? {status: 'opened', tabId: row.tabId, documentIdentity: row.documentIdentity}
    : undefined;
}

/**
 * Creates a single-use chooser. It stores only the last opaque choice key;
 * paths, file bytes and document contents never enter user preferences.
 */
export function createDocumentStartAssistantB004(input: Readonly<{
  host: DocumentStartHostB004;
  storage: DocumentStartPreferenceStorageB004;
  key?: string;
}>) {
  let initial: DocumentStartCatalogB004;
  try { initial = catalog(input.host.snapshot()); }
  catch (error) {
    if (error instanceof DocumentStartErrorB004) throw error;
    throw new DocumentStartErrorB004('invalid-catalog');
  }
  const available = options(initial);
  if (!available.length) throw new DocumentStartErrorB004('unsupported-choice');
  let preferred: string | undefined;
  try { preferred = parsePreference(input.storage.getItem(input.key ?? DOCUMENT_START_PREFERENCE_KEY_B004)); }
  catch (error) {
    if (error instanceof DocumentStartErrorB004) throw error;
    throw new DocumentStartErrorB004('preference-read');
  }
  let selected = available.some(value => value.key === preferred) ? preferred! : available[0].key;
  let closed = false;
  let executing = false;
  const ensureOpen = () => {
    if (closed || executing) throw new DocumentStartErrorB004('already-closed');
  };

  return Object.freeze({
    options: () => available.map(value => ({...value, choice: {...value.choice}})),
    selected: () => selected,
    select(key: string) {
      ensureOpen();
      if (!available.some(value => value.key === key)) throw new DocumentStartErrorB004('unsupported-choice');
      selected = key;
      return selected;
    },
    cancel() {
      ensureOpen();
      closed = true;
    },
    async start(): Promise<DocumentStartOpenedB004> {
      ensureOpen();
      executing = true;
      let current: DocumentStartCatalogB004;
      try { current = catalog(input.host.snapshot()); }
      catch { executing = false; throw new DocumentStartErrorB004('stale-catalog'); }
      const currentOptions = options(current);
      const choice = available.find(value => value.key === selected)?.choice;
      const currentChoice = currentOptions.find(value => value.key === selected)?.choice;
      if (!choice || !currentChoice || !sameCatalog(initial, current)
        || JSON.stringify(choice) !== JSON.stringify(currentChoice)) {
        executing = false;
        throw new DocumentStartErrorB004('stale-catalog');
      }
      let result: unknown;
      if (choice.kind === 'blank') result = await input.host.openBlank();
      else if (choice.kind === 'recent') result = await input.host.openRecent({id: choice.id, fingerprint: choice.fingerprint});
      else result = await input.host.openTemplate({id: choice.id, fingerprint: choice.fingerprint, format: choice.format});
      const verified = opened(result);
      if (!verified) {
        closed = true;
        throw new DocumentStartErrorB004('invalid-result');
      }
      let preferenceSaved = true;
      try {
        input.storage.setItem(input.key ?? DOCUMENT_START_PREFERENCE_KEY_B004,
          JSON.stringify({version: 1, choiceKey: selected}));
      } catch {
        preferenceSaved = false;
      }
      closed = true;
      return Object.freeze({...verified, preferenceSaved});
    },
  });
}
