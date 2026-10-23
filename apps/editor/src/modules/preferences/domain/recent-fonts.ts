import { PreferenceStorageError } from '../public/contracts.ts';

export type RecentFonts = { version: 1; names: string[] };
export const RECENT_FONT_LIMIT = 5;

export function recentFontName(value: unknown): string {
  if (typeof value !== 'string' || /[\u0000-\u001f\u007f]/u.test(value) || value.trim().length > 240
    || !value.trim() || value.trim().startsWith('__fontset__')) throw new PreferenceStorageError('corrupt');
  // Retain the actual family spelling used by the engine; normalize only for
  // duplicate detection, so choosing the recent item reuses the same family.
  return value.trim();
}
const identity = (name: string) => name.normalize('NFC').toLocaleLowerCase('en-US');

export function validateRecentFonts(value: unknown): RecentFonts {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new PreferenceStorageError('corrupt');
  const record = value as Record<string, unknown>;
  if (record.version !== 1) throw new PreferenceStorageError('version');
  if (!Array.isArray(record.names) || record.names.length > RECENT_FONT_LIMIT) throw new PreferenceStorageError('corrupt');
  const names = record.names.map(recentFontName);
  if (new Set(names.map(identity)).size !== names.length) throw new PreferenceStorageError('corrupt');
  return { version: 1, names };
}

/** Display limits do not erase history, so hiding then enabling restores it. */
export function visibleRecentFonts(value: RecentFonts, show: boolean, count: number): string[] {
  if (!show) return [];
  const limit = Number.isSafeInteger(count) && count >= 1 && count <= RECENT_FONT_LIMIT ? count : 3;
  return validateRecentFonts(value).names.slice(0, limit);
}

export function prependRecentFont(value: RecentFonts, name: unknown): RecentFonts {
  const clean = recentFontName(name), names = validateRecentFonts(value).names;
  return { version: 1, names: [clean, ...names.filter(previous => identity(previous) !== identity(clean))].slice(0, RECENT_FONT_LIMIT) };
}
