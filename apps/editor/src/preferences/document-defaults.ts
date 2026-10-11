import type { PreferenceStorage } from './persistence.ts';

export const DOCUMENT_DEFAULTS_KEY = 'jueony-document-defaults';
export type PageDefaults = {
  widthMm: number; heightMm: number; landscape: boolean;
  marginLeftMm: number; marginRightMm: number; marginTopMm: number; marginBottomMm: number;
  marginHeaderMm: number; marginFooterMm: number;
};
export type DocumentDefaults = { version: 1; enabled: boolean; page: PageDefaults; font: { family: string; sizePt: number } };
export function defaultDocumentDefaults(): DocumentDefaults {
  // Values from the pinned engine's fresh blank document, not a claim about
  // every Hancom installation's selected Normal.hwtx template.
  return { version: 1, enabled: false, page: { widthMm: 210, heightMm: 297, landscape: false, marginLeftMm: 30, marginRightMm: 30, marginTopMm: 20, marginBottomMm: 15, marginHeaderMm: 15, marginFooterMm: 15 }, font: { family: '함초롬바탕', sizePt: 10 } };
}
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
function fail(message: string): never { throw new Error(message); }
const mm = (value: number): number => Math.round(value * 7200 / 25.4);
function range(value: unknown, min: number, max: number, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) fail(label + ' 값이 허용 범위를 벗어났습니다.');
  return value as number;
}
export function validateDocumentDefaults(value: unknown): DocumentDefaults {
  if (!object(value) || value.version !== 1) fail('지원하지 않는 새 문서 기본값 형식입니다. 저장된 설정은 유지합니다.');
  if (typeof value.enabled !== 'boolean' || !object(value.page) || !object(value.font)) fail('새 문서 기본값이 손상되었습니다. 저장된 설정은 유지합니다.');
  const page = value.page as Record<string, unknown>, font = value.font as Record<string, unknown>;
  const normalized: PageDefaults = {
    widthMm: range(page.widthMm, 20, 1000, '용지 너비'), heightMm: range(page.heightMm, 20, 1000, '용지 높이'),
    landscape: page.landscape as boolean,
    marginLeftMm: range(page.marginLeftMm, 0, 300, '왼쪽 여백'), marginRightMm: range(page.marginRightMm, 0, 300, '오른쪽 여백'),
    marginTopMm: range(page.marginTopMm, 0, 300, '위쪽 여백'), marginBottomMm: range(page.marginBottomMm, 0, 300, '아래쪽 여백'),
    marginHeaderMm: range(page.marginHeaderMm, 0, 100, '머리말 여백'), marginFooterMm: range(page.marginFooterMm, 0, 100, '꼬리말 여백'),
  };
  if (typeof normalized.landscape !== 'boolean') fail('용지 방향을 확인해 주세요.');
  const width = normalized.landscape ? normalized.heightMm : normalized.widthMm, height = normalized.landscape ? normalized.widthMm : normalized.heightMm;
  if (width - normalized.marginLeftMm - normalized.marginRightMm < 10 || height - normalized.marginTopMm - normalized.marginBottomMm < 10) fail('여백을 제외한 본문 영역은 가로·세로 10mm 이상이어야 합니다.');
  if (typeof font.family !== 'string' || !font.family.trim() || font.family.length > 100 || /[\x00-\x1f\x7f]/.test(font.family)) fail('기본 글꼴 이름을 확인해 주세요.');
  return { version: 1, enabled: value.enabled as boolean, page: normalized, font: { family: (font.family as string).trim(), sizePt: range(font.sizePt, 1, 200, '글자 크기') } };
}
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
export interface BlankDocumentDefaultsPort {
  getSectionCount(): number; getParagraphCount(section: number): number; getParagraphLength(section: number, paragraph: number): number;
  getPageDef(section: number): string; setPageDef(section: number, json: string): string;
  getStyleAt(section: number, paragraph: number): string;
  findOrCreateFontIdForLang(lang: number, name: string): number;
  updateStyleShapes(style: number, characterJson: string, paragraphJson: string): boolean;
  applyCharFormat(section: number, paragraph: number, start: number, end: number, json: string): string;
}
function checked(value: string): void {
  if (JSON.parse(value)?.ok === false) fail('문서 엔진이 새 문서 기본값을 적용하지 못했습니다.');
}
/** Call only immediately after createBlankDocument, before rendering or typing. */
export function applyNewDocumentDefaults(doc: BlankDocumentDefaultsPort, value: DocumentDefaults): boolean {
  const config = validateDocumentDefaults(value);
  if (!config.enabled) return false;
  if (doc.getSectionCount() !== 1 || doc.getParagraphCount(0) !== 1 || doc.getParagraphLength(0, 0) !== 0) fail('새 문서 기본값은 생성 직후 빈 문서에만 적용할 수 있습니다.');
  const page = JSON.parse(doc.getPageDef(0));
  const next = { ...page };
  for (const [key, entry] of Object.entries(config.page)) next[key.endsWith('Mm') ? key.slice(0, -2) : key] = key.endsWith('Mm') ? mm(entry as number) : entry;
  const style = JSON.parse(doc.getStyleAt(0, 0));
  if (!Number.isInteger(style.id) || style.id < 0) fail('빈 문서의 기본 스타일을 확인하지 못했습니다.');
  const ids = Array.from({ length: 7 }, (_, lang) => doc.findOrCreateFontIdForLang(lang, config.font.family));
  if (ids.some(id => !Number.isInteger(id) || id < 0 || id > 65535)) fail('기본 글꼴을 문서에 등록하지 못했습니다.');
  const properties = JSON.stringify({ fontIds: ids, fontSize: Math.round(config.font.sizePt * 100) });
  checked(doc.setPageDef(0, JSON.stringify(next)));
  if (!doc.updateStyleShapes(style.id, properties, '{}')) fail('새 문서의 기본 글자 스타일을 적용하지 못했습니다.');
  checked(doc.applyCharFormat(0, 0, 0, 0, properties));
  return true;
}