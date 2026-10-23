import type { PreferenceStorage } from '../ports/storage.ts';
import { PreferenceStorageError } from '../public/contracts.ts';
import { prependRecentFont, validateRecentFonts } from '../domain/recent-fonts.ts';
import type { RecentFonts } from '../domain/recent-fonts.ts';

export const RECENT_FONTS_KEY = 'jueony-recent-fonts-v1';
function stored(storage: PreferenceStorage): Record<string, unknown> | undefined {
  let raw: string | null;
  try { raw = storage.getItem(RECENT_FONTS_KEY); } catch { throw new PreferenceStorageError('read'); }
  if (raw === null) return;
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new PreferenceStorageError('corrupt'); }
  validateRecentFonts(value);
  return value as Record<string, unknown>;
}
export function readRecentFonts(storage: PreferenceStorage): RecentFonts {
  const value = stored(storage);
  return value ? validateRecentFonts(value) : { version: 1, names: [] };
}
/** Re-read each successful use, so sequential stale editor tabs cannot lose other recent entries. */
export function rememberRecentFont(storage: PreferenceStorage, name: unknown): RecentFonts {
  const original = stored(storage), previous = original ? validateRecentFonts(original) : { version: 1 as const, names: [] };
  const next = prependRecentFont(previous, name);
  if (JSON.stringify(next) === JSON.stringify(previous)) return next;
  try { storage.setItem(RECENT_FONTS_KEY, JSON.stringify({ ...original, ...next })); }
  catch { throw new PreferenceStorageError('write'); }
  return next;
}
