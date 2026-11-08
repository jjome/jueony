export type PortableStyle = { name: string; englishName: string; type: 0 | 1; next: number; char: Record<string, any>; para: Record<string, any> };
export type StylePackage = { format: 'jueony-styles'; version: 1; styles: PortableStyle[] };
const object = (v: unknown): Record<string, any> => { if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('스타일 파일의 항목 형식이 올바르지 않습니다.'); return v as Record<string, any>; };
const text = (v: unknown, empty = false) => { if (typeof v !== 'string' || (!empty && !v.trim()) || v.length > 250 || /[\u0000-\u001f\u007f]/u.test(v)) throw new Error('스타일 또는 글꼴 이름을 확인하세요.'); return v; };
const num = (v: unknown, min: number, max: number) => { if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) throw new Error('스타일 모양 값이 허용 범위를 벗어났습니다.'); return v; };
const bool = (v: unknown) => { if (typeof v !== 'boolean') throw new Error('스타일 모양의 켜짐/꺼짐 값이 올바르지 않습니다.'); return v; };
const choice = (v: unknown, values: string[]) => { if (typeof v !== 'string' || !values.includes(v)) throw new Error('지원하지 않는 스타일 모양 값입니다.'); return v; };
const colors = ['underlineColor', 'strikeColor', 'textColor', 'shadeColor', 'shadowColor'];
const charBooleans = ['bold', 'italic', 'underline', 'strikethrough', 'subscript', 'superscript', 'emboss', 'engrave', 'kerning'];
const paraBooleans = ['widowOrphan', 'keepWithNext', 'keepLines', 'pageBreakBefore', 'fontLineHeight', 'singleLine', 'autoSpaceKrEn', 'autoSpaceKrNum'];
// Added to portable v1 after its first release. Missing values in an older v1
// record mean the native defaults, while present values are still strict.
const optionalParaBooleans = ['borderConnect', 'borderIgnoreMargin'];
const borderKeys = ['borderLeft', 'borderRight', 'borderTop', 'borderBottom'] as const;
const color = (v: unknown) => { if (!/^#[\da-f]{6}$/iu.test(String(v ?? ''))) throw new Error('스타일의 색상 형식을 확인하세요.'); return String(v).toLowerCase(); };
const exact = (v: Record<string, any>, keys: readonly string[]) => { if (Object.keys(v).some(key => !keys.includes(key)) || keys.some(key => !Object.hasOwn(v, key))) throw new Error('이 스타일 파일에는 교환을 지원하지 않는 모양 속성이 있습니다.'); };
function portableTabs(value: unknown): Record<string, any> {
  const tabs = object(value); exact(tabs, ['autoLeft', 'autoRight', 'stops']);
  if (!Array.isArray(tabs.stops) || tabs.stops.length > 32) throw new Error('스타일 사용자 탭은 32개 이하여야 합니다.');
  let previous = 0;
  const stops = tabs.stops.map(raw => { const stop = object(raw); exact(stop, ['position', 'type', 'fill']); const position = num(stop.position, 1, 283465), type = num(stop.type, 0, 3), fill = num(stop.fill, 0, 3); if (![position, type, fill].every(Number.isInteger) || position <= previous) throw new Error('스타일 사용자 탭은 유효한 위치의 오름차순 정수여야 합니다.'); previous = position; return { position, type, fill }; });
  return { autoLeft: bool(tabs.autoLeft), autoRight: bool(tabs.autoRight), stops };
}
function portableDecoration(value: unknown): Record<string, any> {
  const decoration = object(value), keys = [...borderKeys, 'fillType', 'fillColor', 'patternColor', 'patternType', 'borderSpacing']; exact(decoration, keys);
  const result: Record<string, any> = {};
  for (const key of borderKeys) { const border = object(decoration[key]); exact(border, ['type', 'width', 'color']); const type = num(border.type, 0, 1), width = num(border.width, 0, 15), borderColor = color(border.color); if (!Number.isInteger(type) || !Number.isInteger(width) || type === 0 && (width !== 0 || borderColor !== '#000000')) throw new Error('스타일 테두리는 기본 없음 또는 실선만 지원합니다.'); result[key] = { type, width, color: borderColor }; }
  result.fillType = choice(decoration.fillType, ['none', 'solid']); result.fillColor = color(decoration.fillColor); result.patternColor = color(decoration.patternColor); result.patternType = num(decoration.patternType, -1, -1);
  if (result.fillType === 'none' && (result.fillColor !== '#ffffff' || result.patternColor !== '#999999')) throw new Error('배경 없음 스타일의 비활성 색상은 기본값이어야 합니다.');
  if (!Array.isArray(decoration.borderSpacing) || decoration.borderSpacing.length !== 4) throw new Error('스타일 테두리 간격 네 값을 확인하세요.');
  result.borderSpacing = decoration.borderSpacing.map((value: unknown) => { const spacing = num(value, 0, 5669); if (!Number.isInteger(spacing)) throw new Error('스타일 테두리 간격은 정수여야 합니다.'); return spacing; });
  return result;
}
export function validatePortableShapes(charValue: unknown, paraValue: unknown): { char: Record<string, any>; para: Record<string, any> } {
  const source = object(charValue), p = object(paraValue), char: Record<string, any> = {}, para: Record<string, any> = {};
  if (!Array.isArray(source.fontFamilies) || source.fontFamilies.length !== 7) throw new Error('언어별 글꼴 7개를 확인하세요.'); char.fontFamilies = source.fontFamilies.map(value => text(value));
  char.fontSize = num(source.fontSize, 100, 20000);
  for (const key of charBooleans) char[key] = bool(source[key]);
  for (const key of colors) { if (!/^#[\da-f]{6}$/iu.test(source[key] ?? '')) throw new Error('스타일의 색상 형식을 확인하세요.'); char[key] = source[key].toLowerCase(); }
  char.underlineType = choice(source.underlineType, ['None', 'Bottom', 'Top']);
  for (const key of ['shadowType', 'outlineType', 'emphasisDot', 'underlineShape', 'strikeShape']) { const max = key === 'shadowType' ? 2 : key === 'outlineType' ? 6 : key === 'emphasisDot' ? 15 : 16; char[key] = num(source[key], 0, max); if (!Number.isInteger(char[key])) throw new Error('스타일 종류 값은 정수여야 합니다.'); }
  for (const key of ['shadowOffsetX', 'shadowOffsetY']) char[key] = num(source[key], -128, 127);
  for (const key of ['ratios', 'spacings', 'relativeSizes', 'charOffsets']) { if (!Array.isArray(source[key]) || source[key].length !== 7) throw new Error('언어별 글자 모양 7개를 확인하세요.'); char[key] = source[key].map((value: unknown) => { const n = num(value, key === 'ratios' || key === 'relativeSizes' ? 1 : -128, key === 'ratios' || key === 'relativeSizes' ? 255 : 127); if (!Number.isInteger(n)) throw new Error('언어별 글자 모양은 정수여야 합니다.'); return n; }); }
  para.alignment = choice(p.alignment, ['justify', 'left', 'right', 'center', 'distribute', 'distribute-space']);
  para.lineSpacingType = choice(p.lineSpacingType, ['Percent', 'Fixed', 'SpaceOnly', 'Minimum']); para.lineSpacing = num(p.lineSpacing, 0, 1000);
  for (const key of ['marginLeft', 'marginRight', 'indent']) para[key] = num(p[key], -1000, 1000);
  for (const key of ['spacingBefore', 'spacingAfter']) para[key] = num(p[key], 0, 1000);
  for (const key of paraBooleans) para[key] = bool(p[key]);
  for (const key of optionalParaBooleans) para[key] = p[key] === undefined ? false : bool(p[key]);
  for (const key of ['verticalAlign', 'englishBreakUnit', 'koreanBreakUnit']) { para[key] = num(p[key], 0, 3); if (!Number.isInteger(para[key])) throw new Error('문단 모양 종류 값은 정수여야 합니다.'); }
  if (p.tabs !== undefined) para.tabs = portableTabs(p.tabs);
  if (p.decoration !== undefined) para.decoration = portableDecoration(p.decoration);
  return { char, para };
}
export function validateStylePackage(value: unknown): StylePackage {
  const source = object(value); if (source.format !== 'jueony-styles' || source.version !== 1 || !Array.isArray(source.styles) || source.styles.length < 1 || source.styles.length > 64) throw new Error('지원하는 스타일 파일은 v1이며 1~64개 정의를 포함해야 합니다.');
  const names = new Set<string>(), english = new Set<string>();
  const styles: PortableStyle[] = source.styles.map((raw: unknown) => { const v = object(raw), name = text(v.name), englishName = text(v.englishName, true); if (![0, 1].includes(v.type) || !Number.isInteger(v.next) || v.next < 0 || v.next >= source.styles.length) throw new Error('스타일 종류 또는 다음 스타일 연결이 올바르지 않습니다.');
    if (names.has(name.normalize('NFC')) || englishName && english.has(englishName.normalize('NFC'))) throw new Error('스타일 이름이 중복됩니다.'); names.add(name.normalize('NFC')); if (englishName) english.add(englishName.normalize('NFC'));
    const shapes = validatePortableShapes(v.char, v.para);
    if (Object.keys(object(v.char)).some(key => !Object.hasOwn(shapes.char, key)) || Object.keys(object(v.para)).some(key => !Object.hasOwn(shapes.para, key))) throw new Error('이 스타일 파일에는 교환을 지원하지 않는 모양 속성이 있습니다.');
    return { name, englishName, type: v.type, next: v.next, ...shapes };
  });
  for (const style of styles) if (style.type === 0 && styles[style.next].type !== 0) throw new Error('다음 문단 스타일은 문단 스타일을 가리켜야 합니다.');
  return { format: 'jueony-styles', version: 1, styles };
}
export function parseStylePackage(text: string): StylePackage { if (text.length > 256_000) throw new Error('스타일 파일은 256KB 이하여야 합니다.'); let value: unknown; try { value = JSON.parse(text); } catch { throw new Error('스타일 파일의 JSON 형식을 확인하세요.'); } return validateStylePackage(value); }
