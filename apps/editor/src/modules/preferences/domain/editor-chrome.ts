import { PreferenceStorageError } from '../public/contracts.ts';

/** Contextual table tools belong to the active document, not the user profile. */
export const EDITOR_RIBBON_TABS = ['edit', 'view', 'insert', 'format', 'page', 'review', 'tool', 'security'] as const;
export type EditorRibbonTab = typeof EDITOR_RIBBON_TABS[number];
export type EditorChromePreferences = { version: 1; stylePanelOpen: boolean; ribbonTab: EditorRibbonTab };

export function isEditorRibbonTab(value: unknown): value is EditorRibbonTab {
  return typeof value === 'string' && (EDITOR_RIBBON_TABS as readonly string[]).includes(value);
}

export function defaultEditorChromePreferences(): EditorChromePreferences {
  return { version: 1, stylePanelOpen: true, ribbonTab: 'edit' };
}

/** Sparse v1 records are valid; unknown extension fields remain storage-owned. */
export function validateEditorChromePreferences(value: unknown): EditorChromePreferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new PreferenceStorageError('corrupt');
  const record = value as Record<string, unknown>;
  if (record.version !== 1) throw new PreferenceStorageError('version');
  if (record.stylePanelOpen !== undefined && typeof record.stylePanelOpen !== 'boolean'
    || record.ribbonTab !== undefined && !isEditorRibbonTab(record.ribbonTab)) throw new PreferenceStorageError('corrupt');
  return { ...defaultEditorChromePreferences(),
    ...(typeof record.stylePanelOpen === 'boolean' ? { stylePanelOpen: record.stylePanelOpen } : {}),
    ...(isEditorRibbonTab(record.ribbonTab) ? { ribbonTab: record.ribbonTab } : {}),
  };
}
