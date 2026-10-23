import { createEditorChromePreferences, EDITOR_CHROME_KEY, LEGACY_STYLE_PANEL_KEY, isEditorRibbonTab } from '../../modules/preferences/public/index.ts';
import type { EditorChromePreferences, PreferenceStorage } from '../../modules/preferences/public/index.ts';

export interface EditorChromeBindingOptions {
  storage: PreferenceStorage;
  events: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
  onChange: (value: EditorChromePreferences, source: 'local' | 'external') => void;
  onError: (error: Error) => void;
}

/** Native storage events synchronize all document iframes without document edits. */
export function bindEditorChromePreferences(options: EditorChromeBindingOptions) {
  const preferences = createEditorChromePreferences(options.storage);
  let disposed = false;
  const report = (error: unknown) => options.onError(error instanceof Error ? error : new Error('보기 환경을 저장하지 못했습니다.'));
  if (preferences.initialError) report(preferences.initialError);
  function refresh() {
    if (disposed) return;
    try { const update = preferences.refresh(); if (update.changedPaths.length) options.onChange(update.value, 'external'); }
    catch (error) { report(error); }
  }
  function commit(change: Partial<Omit<EditorChromePreferences, 'version'>>) {
    if (disposed) return false;
    try {
      const next = preferences.commit({ ...preferences.snapshot(), ...change });
      options.onChange(next, 'local');
      return true;
    } catch (error) { report(error); return false; }
  }
  const listener: EventListener = event => {
    const key = (event as StorageEvent).key;
    if (key === EDITOR_CHROME_KEY || key === LEGACY_STYLE_PANEL_KEY || key === null) refresh();
  };
  options.events.addEventListener('storage', listener);
  return {
    snapshot: preferences.snapshot,
    setStylePanelOpen: (open: boolean) => typeof open === 'boolean' && commit({ stylePanelOpen: open }),
    setRibbonTab: (tab: unknown) => isEditorRibbonTab(tab) && commit({ ribbonTab: tab }),
    refresh,
    dispose() { disposed = true; options.events.removeEventListener('storage', listener); },
  };
}
