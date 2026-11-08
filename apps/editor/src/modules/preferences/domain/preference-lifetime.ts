export type PreferenceScope = 'user' | 'workspace' | 'document';
export type PreferenceBackup = 'included' | 'excluded' | 'projection-only';
export type PreferenceValidation = 'full' | 'projection-only' | 'legacy';
export type PreferenceVersion = 'v1' | 'optional-v1' | 'unversioned';

export type PreferenceLifetimeContract = {
  id: string;
  key: string;
  scope: readonly PreferenceScope[];
  medium: 'localStorage';
  survivesRestart: true;
  reset: 'explicit' | 'bounded-history' | 'document-lifecycle' | 'migration-only';
  documentDirty: false;
  documentUndo: false;
  backup: PreferenceBackup;
  validation: PreferenceValidation;
  version: PreferenceVersion;
};

/**
 * Contracts for every stable editor preference key known to the current UI.
 * Document/section content is intentionally absent: it belongs to HWP/HWPX,
 * while dialog drafts are temporary and must not be restored from this store.
 */
export const preferenceLifetimeContracts: readonly PreferenceLifetimeContract[] = Object.freeze([
  { id: 'studio-settings', key: 'rhwp-settings', scope: ['user'], medium: 'localStorage', survivesRestart: true, reset: 'explicit', documentDirty: false, documentUndo: false, backup: 'projection-only', validation: 'projection-only', version: 'optional-v1' },
  { id: 'document-defaults', key: 'jueony-document-defaults', scope: ['user'], medium: 'localStorage', survivesRestart: true, reset: 'explicit', documentDirty: false, documentUndo: false, backup: 'included', validation: 'full', version: 'v1' },
  { id: 'editor-chrome', key: 'jueony-editor-chrome-v1', scope: ['user'], medium: 'localStorage', survivesRestart: true, reset: 'explicit', documentDirty: false, documentUndo: false, backup: 'included', validation: 'full', version: 'v1' },
  { id: 'legacy-style-panel', key: 'jueony-style-panel', scope: ['user'], medium: 'localStorage', survivesRestart: true, reset: 'migration-only', documentDirty: false, documentUndo: false, backup: 'included', validation: 'legacy', version: 'unversioned' },
  { id: 'recent-fonts', key: 'jueony-recent-fonts-v1', scope: ['user'], medium: 'localStorage', survivesRestart: true, reset: 'bounded-history', documentDirty: false, documentUndo: false, backup: 'excluded', validation: 'full', version: 'v1' },
  { id: 'calendar-format', key: 'jueony-calendar-format', scope: ['user'], medium: 'localStorage', survivesRestart: true, reset: 'explicit', documentDirty: false, documentUndo: false, backup: 'excluded', validation: 'full', version: 'v1' },
  { id: 'snippets', key: 'jueony-common-snippets', scope: ['user'], medium: 'localStorage', survivesRestart: true, reset: 'explicit', documentDirty: false, documentUndo: false, backup: 'excluded', validation: 'full', version: 'v1' },
  { id: 'document-view-journal', key: 'jueony-document-view-journal-v1', scope: ['workspace', 'document'], medium: 'localStorage', survivesRestart: true, reset: 'document-lifecycle', documentDirty: false, documentUndo: false, backup: 'excluded', validation: 'full', version: 'v1' },
]);

export type NonPersistentStateContract = {
  id: 'document-section-state' | 'dialog-draft';
  scope: readonly ('document' | 'section' | 'temporary')[];
  owner: 'hwp-hwpx' | 'memory';
  documentDirty: boolean;
  documentUndo: boolean;
  reset: 'document-close' | 'dialog-close';
};

export const nonPersistentStateContracts: readonly NonPersistentStateContract[] = Object.freeze([
  { id: 'document-section-state', scope: ['document', 'section'], owner: 'hwp-hwpx', documentDirty: true, documentUndo: true, reset: 'document-close' },
  { id: 'dialog-draft', scope: ['temporary'], owner: 'memory', documentDirty: false, documentUndo: false, reset: 'dialog-close' },
]);
