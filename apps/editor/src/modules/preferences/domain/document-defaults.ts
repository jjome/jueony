import type { DocumentDefaults, PageDefaults } from '../public/contracts.ts';

export function defaultDocumentDefaults(): DocumentDefaults {
  // Values from the pinned engine's fresh blank document, not a claim about
  // every Hancom installation's selected Normal.hwtx template.
  return { version: 1, enabled: false, page: { widthMm: 210, heightMm: 297, landscape: false, marginLeftMm: 30, marginRightMm: 30, marginTopMm: 20, marginBottomMm: 15, marginHeaderMm: 15, marginFooterMm: 15 }, font: { family: '함초롬바탕', sizePt: 10 } };
}
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
function fail(message: string): never { throw new Error(message); }
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
