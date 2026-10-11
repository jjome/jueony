import type { DocumentDefaults } from '../../modules/preferences/public/contracts.ts';
import { validateDocumentDefaults } from '../../modules/preferences/public/index.ts';
const mm = (value: number): number => Math.round(value * 7200 / 25.4);
function fail(message: string): never { throw new Error(message); }

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