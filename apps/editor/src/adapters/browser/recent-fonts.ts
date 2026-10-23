import { readRecentFonts, rememberRecentFont, visibleRecentFonts, RECENT_FONTS_KEY } from '../../modules/preferences/public/index.ts';

const storage = { getItem: (key: string) => localStorage.getItem(key), setItem: (key: string, value: string) => localStorage.setItem(key, value) };
function report(error: unknown): void {
  window.dispatchEvent(new CustomEvent('jueony:preferences-error', { detail: { message: error instanceof Error ? error.message : '최근 사용 글꼴을 저장하지 못했습니다.' } }));
}

/** Call after the editor command succeeds. A history failure never reverses or hides that document edit. */
export function rememberSuccessfulToolbarFont(name: string): void {
  try { rememberRecentFont(storage, name); }
  catch (error) { report(error); }
}

export function recentFontMenuEntries(settings: { showRecentFonts: boolean; recentFontCount: number }): { value: string; label: string }[] {
  try { return visibleRecentFonts(readRecentFonts(storage), settings.showRecentFonts, settings.recentFontCount).map(name => ({ value: name, label: name })); }
  catch (error) { report(error); return []; }
}

/** Other document windows share the same history while retaining their current font selection. */
export function observeRecentFonts(onChange: () => void): () => void {
  const listener = (event: StorageEvent) => { if (event.key === RECENT_FONTS_KEY || event.key === null) onChange(); };
  window.addEventListener('storage', listener);
  return () => window.removeEventListener('storage', listener);
}
