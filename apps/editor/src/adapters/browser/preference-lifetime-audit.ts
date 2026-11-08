import { createCalendarFormatPreference } from './calendar-format-preference.ts';
import { readRecoverySettings } from './recovery-settings.ts';
import {
  createDocumentViewJournal,
  PreferenceStorageError,
  preferenceLifetimeContracts,
  readDocumentDefaults,
  readEditorChromePreferences,
  readRecentFonts,
  readSnippetLibrary,
} from '../../modules/preferences/public/index.ts';
import type { PreferenceLifetimeContract, PreferenceStorage } from '../../modules/preferences/public/index.ts';

export type PreferenceLifetimeAuditStatus = 'missing' | 'valid' | 'corrupt' | 'unsupported-version' | 'read-error';
export type PreferenceLifetimeAuditResult = {
  contract: PreferenceLifetimeContract;
  status: PreferenceLifetimeAuditStatus;
  message?: string;
};

const validators: Record<string, (storage: PreferenceStorage) => void> = {
  'rhwp-settings': storage => { readRecoverySettings(storage); },
  'jueony-document-defaults': storage => { readDocumentDefaults(storage); },
  'jueony-editor-chrome-v1': storage => { readEditorChromePreferences(storage); },
  'jueony-style-panel': storage => {
    const value = storage.getItem('jueony-style-panel');
    if (value !== 'true' && value !== 'false') throw new PreferenceStorageError('corrupt');
  },
  'jueony-recent-fonts-v1': storage => { readRecentFonts(storage); },
  'jueony-calendar-format': storage => { createCalendarFormatPreference(storage).read(); },
  'jueony-common-snippets': storage => { readSnippetLibrary(storage); },
  'jueony-document-view-journal-v1': storage => { createDocumentViewJournal(storage).readRecord('__audit__', '__audit__', 0); },
};

function classified(error: unknown): Pick<PreferenceLifetimeAuditResult, 'status' | 'message'> {
  if (error instanceof PreferenceStorageError) return { status: error.code === 'version' ? 'unsupported-version' : error.code === 'read' ? 'read-error' : 'corrupt', message: error.message };
  const message = error instanceof Error ? error.message : String(error);
  return { status: /버전|version/iu.test(message) ? 'unsupported-version' : 'corrupt', message };
}

function versionStatus(contract: PreferenceLifetimeContract, raw: string): PreferenceLifetimeAuditStatus | undefined {
  if (contract.version === 'unversioned') return;
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return 'corrupt'; }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'corrupt';
  const version = (value as Record<string, unknown>).version;
  if (contract.version === 'v1' && version !== 1 || contract.version === 'optional-v1' && version !== undefined && version !== 1) return 'unsupported-version';
}

/** Read-only audit. Each key is snapshotted once and validators cannot write. */
export function auditPreferenceLifetimes(storage: Pick<PreferenceStorage, 'getItem'>): PreferenceLifetimeAuditResult[] {
  return preferenceLifetimeContracts.map(contract => {
    let raw: string | null;
    try { raw = storage.getItem(contract.key); }
    catch (error) { return { contract, status: 'read-error', message: error instanceof Error ? error.message : String(error) }; }
    if (raw === null) return { contract, status: 'missing' };
    const version = versionStatus(contract, raw);
    if (version) return { contract, status: version };
    const isolated: PreferenceStorage = {
      getItem: key => key === contract.key ? raw : null,
      setItem: () => { throw new Error('수명 감사는 설정을 쓰지 않습니다.'); },
    };
    try { validators[contract.key](isolated); return { contract, status: 'valid' }; }
    catch (error) { return { contract, ...classified(error) }; }
  });
}
