import type { PreferenceStorage } from '../ports/storage.ts';
import type { DocumentDefaults } from '../public/contracts.ts';
import { defaultDocumentDefaults, validateDocumentDefaults } from '../domain/document-defaults.ts';
export const DOCUMENT_DEFAULTS_KEY = 'jueony-document-defaults';
function fail(message: string): never { throw new Error(message); }

function rawDefaults(storage: PreferenceStorage): Record<string, unknown> | undefined {
  let raw: string | null;
  try { raw = storage.getItem(DOCUMENT_DEFAULTS_KEY); } catch { return fail('새 문서 기본값 저장소를 읽지 못했습니다.'); }
  if (raw === null) return undefined;
  let value: unknown; try { value = JSON.parse(raw); } catch { return fail('새 문서 기본값이 손상되었습니다. 저장된 설정은 유지합니다.'); }
  validateDocumentDefaults(value);
  return value as Record<string, unknown>;
}
export function readDocumentDefaults(storage: PreferenceStorage): DocumentDefaults {
  const raw = rawDefaults(storage);
  return raw === undefined ? defaultDocumentDefaults() : validateDocumentDefaults(raw);
}
export function saveDocumentDefaults(storage: PreferenceStorage, value: unknown): DocumentDefaults {
  const next = validateDocumentDefaults(value), previous = rawDefaults(storage);
  const stored = { ...previous, ...next, page: { ...(previous?.page as object ?? {}), ...next.page }, font: { ...(previous?.font as object ?? {}), ...next.font } };
  try { storage.setItem(DOCUMENT_DEFAULTS_KEY, JSON.stringify(stored)); } catch { return fail('새 문서 기본값을 저장하지 못했습니다. 기존 설정은 유지합니다.'); }
  return next;
}
/** Explicit reset action only; never called while reading a corrupt preference. */
export function resetDocumentDefaults(storage: PreferenceStorage & { removeItem(key: string): void }): DocumentDefaults {
  try { storage.removeItem(DOCUMENT_DEFAULTS_KEY); } catch { return fail('새 문서 기본값을 초기화하지 못했습니다.'); }
  return defaultDocumentDefaults();
}
