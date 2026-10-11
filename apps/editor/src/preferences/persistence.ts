type SettingsRecord = Record<string, unknown>;
type Change = { path: string[]; remove: boolean; value?: unknown };

export interface PreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export type PreferenceErrorCode = 'read' | 'write' | 'corrupt' | 'version';
export class PreferenceStorageError extends Error {
  readonly code: PreferenceErrorCode;
  constructor(code: PreferenceErrorCode) {
    const messages = {
      read: '환경 설정 저장소를 읽지 못했습니다. 기존 설정을 유지합니다.',
      write: '환경 설정을 저장하지 못했습니다. 저장 공간과 권한을 확인한 뒤 다시 시도해 주세요.',
      corrupt: '저장된 환경 설정이 손상되어 자동으로 덮어쓰지 않았습니다. 기존 설정 복구가 필요합니다.',
      version: '더 새로운 버전 또는 지원하지 않는 형식의 환경 설정입니다. 기존 설정을 보존했습니다.',
    };
    super(messages[code]);
    this.name = 'PreferenceStorageError';
    this.code = code;
  }
}
function record(value: unknown): value is SettingsRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function copy<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value)) as T;
}
function same(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => same(v, b[i]));
  if (record(a) && record(b)) {
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && same(a[key], b[key]));
  }
  return false;
}
function changes(before: unknown, after: unknown, path: string[] = []): Change[] {
  if (same(before, after)) return [];
  if (record(before) && record(after)) {
    const result: Change[] = [];
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
      const at = [...path, key];
      if (!Object.hasOwn(after, key)) result.push({ path: at, remove: true });
      else if (!Object.hasOwn(before, key)) result.push({ path: at, remove: false, value: copy(after[key]) });
      else result.push(...changes(before[key], after[key], at));
    }
    return result;
  }
  return [{ path, remove: false, value: copy(after) }];
}
export function preferenceChangedPaths(before: unknown, after: unknown): string[] {
  return changes(before, after).map(change => change.path.join('.'));
}
function put(object: SettingsRecord, key: string, value: unknown): void {
  // Treat all persisted keys as data, including __proto__.
  Object.defineProperty(object, key, { value, writable: true, enumerable: true, configurable: true });
}
function patched<T>(value: T, delta: Change[]): T {
  let result = copy(value);
  for (const change of delta) {
    if (!change.path.length) { result = copy(change.value) as T; continue; }
    if (!record(result)) result = {} as T;
    let cursor = result as SettingsRecord;
    for (const key of change.path.slice(0, -1)) {
      if (!Object.hasOwn(cursor, key) || !record(cursor[key])) put(cursor, key, {});
      cursor = cursor[key] as SettingsRecord;
    }
    const last = change.path[change.path.length - 1];
    if (change.remove) delete cursor[last]; else put(cursor, last, copy(change.value));
  }
  return result;
}
export interface PreferencesPersistenceOptions<T> {
  storage: PreferenceStorage;
  key: string;
  supportedVersion: number;
  initial: T;
  /** Existing provider normalizer; must read current storage without writing it. */
  load: () => T;
}
export interface PreferencesRefresh<T> { value: T; changedPaths: string[] }

/**
 * Keeps sequential stale iframe writes from replacing unrelated preferences.
 * localStorage is synchronous but has no cross-process compare-and-swap.
 */
export function createPreferencesPersistence<T extends { version: number }>(options: PreferencesPersistenceOptions<T>) {
  let baseline = copy(options.initial);
  function stored(): SettingsRecord | null {
    let raw: string | null;
    try { raw = options.storage.getItem(options.key); }
    catch { throw new PreferenceStorageError('read'); }
    if (raw === null) return null;
    let value: unknown;
    try { value = JSON.parse(raw); } catch { throw new PreferenceStorageError('corrupt'); }
    if (!record(value)) throw new PreferenceStorageError('corrupt');
    // The older boot initializer has no version field and is a supported v1 input.
    const version = Object.hasOwn(value, 'version') ? value.version : 1;
    if (typeof version !== 'number' || !Number.isInteger(version) || version < 1 || version > options.supportedVersion) {
      throw new PreferenceStorageError('version');
    }
    return value;
  }
  function loaded(): T {
    let value: T;
    try { value = options.load(); } catch { throw new PreferenceStorageError('read'); }
    if (!record(value) || value.version !== options.supportedVersion) throw new PreferenceStorageError('version');
    return copy(value);
  }
  function snapshot(): T { return copy(baseline); }
  function refresh(): PreferencesRefresh<T> {
    stored();
    const value = loaded();
    const changedPaths = changes(baseline, value).map(change => change.path.join('.'));
    baseline = copy(value);
    return { value, changedPaths };
  }
  function commit(next: T): T {
    const latestRaw = stored();
    const latest = loaded();
    const delta = changes(baseline, next);
    if (!delta.length) { baseline = copy(latest); return latest; }
    if (next.version !== options.supportedVersion) throw new PreferenceStorageError('version');
    const toStore = patched<SettingsRecord>(latestRaw ?? {}, delta);
    toStore.version = options.supportedVersion;
    let raw: string;
    try { raw = JSON.stringify(toStore); }
    catch { throw new PreferenceStorageError('corrupt'); }
    try { options.storage.setItem(options.key, raw); }
    catch { throw new PreferenceStorageError('write'); }
    // Do not run fallible storage reads after a successful write.
    const value = patched(latest, delta);
    baseline = copy(value);
    return value;
  }
  return { snapshot, refresh, commit };
}