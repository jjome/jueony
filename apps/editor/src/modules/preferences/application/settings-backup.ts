import { parseSettingsBackup } from '../domain/settings-backup.ts';
import { validateDocumentDefaults } from '../domain/document-defaults.ts';
import type { PreferenceStorage } from '../ports/storage.ts';
import { DOCUMENT_DEFAULTS_KEY } from './document-defaults.ts';
export type BackupStorage = PreferenceStorage & { removeItem(key: string): void };
export const SETTINGS_BACKUP_KEYS = ['rhwp-settings', DOCUMENT_DEFAULTS_KEY] as const;
export function captureSettingsVersion(storage: BackupStorage): (string | null)[] { return SETTINGS_BACKUP_KEYS.map(key => storage.getItem(key)); }
export function importSettingsBackup(storage: BackupStorage, text: string, expected: (string | null)[]): void {
  const backup = parseSettingsBackup(text), before = captureSettingsVersion(storage);
  if (JSON.stringify(expected) !== JSON.stringify(before)) throw new Error('다른 창에서 환경 설정이 바뀌었습니다. 가져오기 창을 다시 여세요.');
  // Preserve future/extension fields in the local file; never copy arbitrary imported fields.
  let local: Record<string, any> = {};
  if (before[0] !== null) { try { local = JSON.parse(before[0]); } catch { throw new Error('기존 환경 설정이 손상되었습니다. 가져오기로 덮어쓰지 않았습니다.'); } if (!local || typeof local !== 'object' || Array.isArray(local) || local.version !== undefined && local.version !== 1) throw new Error('기존 환경 설정 버전을 확인하세요.'); }
  const next = { ...local, ...backup.settings };
  for (const key of ['font', 'theme', 'dialog', 'view', 'autosave']) next[key] = { ...local[key], ...backup.settings[key] };
  let defaults: Record<string, any> = {};
  if (before[1] !== null) { try { defaults = JSON.parse(before[1]); validateDocumentDefaults(defaults); } catch { throw new Error('기존 새 문서 기본값이 손상되었습니다. 가져오기로 덮어쓰지 않았습니다.'); } }
  const nextDefaults = { ...defaults, ...backup.documentDefaults, page: { ...defaults.page, ...backup.documentDefaults.page }, font: { ...defaults.font, ...backup.documentDefaults.font } };
  const values = [JSON.stringify(next), JSON.stringify(nextDefaults)], changed: number[] = [];
  try { for (let i = 0; i < SETTINGS_BACKUP_KEYS.length; i++) { if (values[i] === before[i]) continue; storage.setItem(SETTINGS_BACKUP_KEYS[i], values[i]); changed.push(i); } }
  catch {
    let failed = false;
    for (const i of changed.reverse()) { try { if (before[i] === null) storage.removeItem(SETTINGS_BACKUP_KEYS[i]); else storage.setItem(SETTINGS_BACKUP_KEYS[i], before[i]!); } catch { failed = true; } }
    throw new Error(failed ? '환경 저장과 일부 원상 복구가 실패했습니다. 저장 공간을 확인하고 환경 설정을 다시 점검하세요.' : '환경 파일을 저장하지 못했습니다. 기존 설정으로 복구했습니다.');
  }
}
