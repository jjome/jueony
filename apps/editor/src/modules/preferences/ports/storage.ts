export interface PreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface PreferencesPersistenceOptions<T> {
  storage: PreferenceStorage;
  key: string;
  supportedVersion: number;
  initial: T;
  /** Existing provider normalizer; must read current storage without writing it. */
  load: () => T;
}
