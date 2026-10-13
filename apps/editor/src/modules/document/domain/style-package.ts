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
  for (const key of ['verticalAlign', 'englishBreakUnit', 'koreanBreakUnit']) { para[key] = num(p[key], 0, 3); if (!Number.isInteger(para[key])) throw new Error('문단 모양 종류 값은 정수여야 합니다.'); }
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
