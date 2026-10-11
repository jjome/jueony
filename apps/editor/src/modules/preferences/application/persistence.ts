import { PreferenceStorageError } from '../public/contracts.ts';
import type { PreferencesRefresh } from '../public/contracts.ts';
import type { PreferencesPersistenceOptions } from '../ports/storage.ts';
import { record, copy, changes, patched } from '../domain/merge.ts';
import type { SettingsRecord } from '../domain/merge.ts';

/**
 * Keeps sequential stale iframe writes from replacing unrelated preferences.
 * localStorage is synchronous but has no cross-process compare-and-swap.
 */
export function createPreferencesFacade<T extends { version: number }>(options: PreferencesPersistenceOptions<T>) {
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