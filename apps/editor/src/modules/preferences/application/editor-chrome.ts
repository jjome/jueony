import { PreferenceStorageError } from '../public/contracts.ts';
import type { PreferenceStorage } from '../ports/storage.ts';
import { createPreferencesFacade } from './persistence.ts';
import { defaultEditorChromePreferences, validateEditorChromePreferences } from '../domain/editor-chrome.ts';

export const EDITOR_CHROME_KEY = 'jueony-editor-chrome-v1';
export const LEGACY_STYLE_PANEL_KEY = 'jueony-style-panel';

/** Read-only migration: retain the legacy key until the user actually changes a value. */
function migratedStorage(storage: PreferenceStorage): PreferenceStorage {
  return {
    getItem(key) {
      const current = storage.getItem(key);
      if (current !== null || key !== EDITOR_CHROME_KEY) return current;
      const legacy = storage.getItem(LEGACY_STYLE_PANEL_KEY);
      if (legacy === null) return null;
      if (legacy !== 'true' && legacy !== 'false') throw new PreferenceStorageError('corrupt');
      return JSON.stringify({ ...defaultEditorChromePreferences(), stylePanelOpen: legacy === 'true' });
    },
    setItem: (key, value) => storage.setItem(key, value),
  };
}

export function readEditorChromePreferences(storage: PreferenceStorage) {
  let raw: string | null;
  try { raw = migratedStorage(storage).getItem(EDITOR_CHROME_KEY); }
  catch (error) { if (error instanceof PreferenceStorageError) throw error; throw new PreferenceStorageError('read'); }
  if (raw === null) return defaultEditorChromePreferences();
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new PreferenceStorageError('corrupt'); }
  return validateEditorChromePreferences(value);
}

export function createEditorChromePreferences(storage: PreferenceStorage) {
  let initial = defaultEditorChromePreferences(), initialError: Error | undefined;
  try { initial = readEditorChromePreferences(storage); }
  catch (error) { initialError = error instanceof Error ? error : new PreferenceStorageError('read'); }
  // A damaged/future record can render defaults, but every later write still
  // reads and validates that record, so initialization cannot erase it.
  const persistence = createPreferencesFacade({ storage: migratedStorage(storage), key: EDITOR_CHROME_KEY,
    supportedVersion: 1, initial, load: () => readEditorChromePreferences(storage) });
  return { ...persistence, initialError };
}
