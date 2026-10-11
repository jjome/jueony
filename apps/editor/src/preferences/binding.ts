import { createPreferencesPersistence, preferenceChangedPaths } from './persistence.ts';
import type { PreferenceStorage, PreferencesRefresh } from './persistence.ts';

export interface PreferencesUpdate<T> extends PreferencesRefresh<T> { source: 'local' | 'external' }
export interface PreferencesBindingOptions<T> {
  storage: PreferenceStorage;
  key: string;
  supportedVersion: number;
  initial: T;
  load: () => T;
  replace: (value: T) => void;
  onChange?: (update: PreferencesUpdate<T>) => void;
  onError: (error: Error) => void;
  events?: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
}
/** Small adapter around the existing Studio settings service and storage events. */
export function bindPreferencesPersistence<T extends { version: number }>(options: PreferencesBindingOptions<T>) {
  const persistence = createPreferencesPersistence(options);
  function report(cause: unknown): Error {
    const error = cause instanceof Error ? cause : new Error('환경 설정 처리에 실패했습니다.');
    options.onError(error);
    return error;
  }
  function refresh(): void {
    try {
      const update = persistence.refresh();
      options.replace(update.value);
      if (update.changedPaths.length) options.onChange?.({ ...update, source: 'external' });
    } catch (error) { report(error); }
  }
  function save(next: T): void {
    try {
      const value = persistence.commit(next);
      options.replace(value);
      // Local command handlers already apply their own change to the renderer.
      // The callback is for merged remote changes and successful-write bookkeeping.
      options.onChange?.({ value, changedPaths: preferenceChangedPaths(next, value), source: 'local' });
    } catch (error) {
      options.replace(persistence.snapshot());
      throw report(error);
    }
  }
  const storageListener: EventListener = event => {
    const detail = event as StorageEvent;
    if (detail.key === options.key || detail.key === null) refresh();
  };
  options.events?.addEventListener('storage', storageListener);
  return {
    save,
    refresh,
    snapshot: persistence.snapshot,
    dispose: () => options.events?.removeEventListener('storage', storageListener),
  };
}