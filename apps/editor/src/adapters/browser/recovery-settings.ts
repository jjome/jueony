import { normalizeRecoverySettings, PreferenceStorageError } from '../../modules/preferences/public/index.ts';
import type { PreferenceStorage, RecoverySettings, RecoveryClock } from '../../modules/preferences/public/index.ts';

export const STUDIO_SETTINGS_KEY = 'rhwp-settings';

/** Read-only projection: Studio's options dialog and settings service remain the only writer. */
export function readRecoverySettings(storage: Pick<PreferenceStorage, 'getItem'>): RecoverySettings {
  let raw: string | null;
  try { raw = storage.getItem(STUDIO_SETTINGS_KEY); }
  catch { throw new PreferenceStorageError('read'); }
  if (raw === null) return normalizeRecoverySettings(undefined);
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new PreferenceStorageError('corrupt'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new PreferenceStorageError('corrupt');
  const record = value as Record<string, unknown>;
  if (Object.hasOwn(record, 'version') && record.version !== 1) throw new PreferenceStorageError('version');
  return normalizeRecoverySettings(record.autosave);
}

export function watchRecoverySettings(options: {
  storage: Pick<PreferenceStorage, 'getItem'>;
  events: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
  onChange(settings: RecoverySettings): void;
  onError(error: unknown): void;
}) {
  let last: string | undefined;
  function refresh(): void {
    try {
      const settings = readRecoverySettings(options.storage), serialized = JSON.stringify(settings);
      if (serialized !== last) { last = serialized; options.onChange(settings); }
    } catch (error) { options.onError(error); }
  }
  const listener: EventListener = event => {
    const key = (event as StorageEvent).key;
    if (key === STUDIO_SETTINGS_KEY || key === null) refresh();
  };
  options.events.addEventListener('storage', listener);
  refresh();
  return { refresh, dispose: () => options.events.removeEventListener('storage', listener) };
}

export function browserRecoveryClock(host: Pick<Window, 'setTimeout' | 'clearTimeout'>): RecoveryClock {
  return { now: () => Date.now(), schedule: (callback, delay) => host.setTimeout(callback, delay), cancel: timer => host.clearTimeout(timer) };
}
