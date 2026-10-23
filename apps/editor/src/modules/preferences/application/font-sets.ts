import type { PreferenceStorage } from '../ports/storage.ts';
import type { FontSetChange, FontSetDefinition } from '../domain/font-sets.ts';
import { prepareFontSetChange } from '../domain/font-sets.ts';

/** Read fresh persisted definitions before handing one full-array change to the existing settings owner. */
export function commitFontSetChange(storage: PreferenceStorage, write: (values: FontSetDefinition[]) => void, builtins: readonly FontSetDefinition[], change: FontSetChange): FontSetDefinition[] {
  let raw: string | null;
  try { raw = storage.getItem('rhwp-settings'); } catch { throw new Error('대표 글꼴 설정을 읽지 못했습니다. 원래 목록을 유지합니다.'); }
  let current: unknown = [];
  if (raw !== null) {
    let settings: any; try { settings = JSON.parse(raw); } catch { throw new Error('기존 환경 설정이 손상되었습니다. 대표 글꼴을 덮어쓰지 않았습니다.'); }
    if (!settings || typeof settings !== 'object' || Array.isArray(settings) || settings.version !== undefined && settings.version !== 1) throw new Error('기존 환경 설정 버전을 확인하세요. 대표 글꼴을 덮어쓰지 않았습니다.');
    if (settings.font !== undefined) {
      if (!settings.font || typeof settings.font !== 'object' || Array.isArray(settings.font)) throw new Error('기존 글꼴 설정 형식이 올바르지 않습니다.');
      current = settings.font.fontSets === undefined ? [] : settings.font.fontSets;
    }
  }
  const next = prepareFontSetChange(current, builtins, change);
  write(next);
  return next;
}
