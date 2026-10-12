import { calendarStampFormats } from '../../modules/document/public/index.ts';
import type { CalendarStampFormat } from '../../modules/document/public/index.ts';
import { PreferenceStorageError } from '../../modules/preferences/public/index.ts';
import type { PreferenceStorage } from '../../modules/preferences/public/index.ts';

export const CALENDAR_FORMAT_KEY = 'jueony-calendar-format';
/** User preference only: never includes the inserted date, document or workspace. */
export function createCalendarFormatPreference(storage: PreferenceStorage) {
  function raw(): Record<string, unknown> | undefined {
    let text: string | null;
    try { text = storage.getItem(CALENDAR_FORMAT_KEY); }
    catch { throw new PreferenceStorageError('read'); }
    if (text === null) return undefined;
    let value: any;
    try { value = JSON.parse(text); } catch { throw new PreferenceStorageError('corrupt'); }
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new PreferenceStorageError('corrupt');
    if (value.version !== 1) throw new PreferenceStorageError('version');
    if (!calendarStampFormats.includes(value.format)) throw new PreferenceStorageError('corrupt');
    return value;
  }
  return {
    read(): CalendarStampFormat { return (raw()?.format ?? 'date-dots') as CalendarStampFormat; },
    save(format: unknown) {
      if (!calendarStampFormats.includes(format as CalendarStampFormat)) throw new PreferenceStorageError('corrupt');
      // Read the latest record and preserve unknown additions. Invalid/newer data
      // is never replaced with a silently defaulted older record.
      const previous = raw();
      try { storage.setItem(CALENDAR_FORMAT_KEY, JSON.stringify({ ...previous, version: 1, format })); }
      catch { throw new PreferenceStorageError('write'); }
    },
  };
}
