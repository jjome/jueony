import { validateStylePackage, validatePortableShapes, type StylePackage } from '../../modules/document/public/style-package.ts';
import { verifyPreservedExport } from './preservation.ts';
const parsed = (value: any): any => typeof value === 'string' ? JSON.parse(value) : value;
const raw = (wasm: any) => wasm.borrowDocumentHandle?.() ?? wasm;
function plain(detail: any, type: number): void {
  const props = [detail.charProps, ...(type === 0 ? [detail.paraProps] : [])];
  if (props.some(p => p.fillType !== 'none' || ['borderLeft', 'borderRight', 'borderTop', 'borderBottom'].some(key => p[key]?.type || p[key]?.width)) || type === 0 && (detail.paraProps.headType !== 'None' || detail.paraProps.tabStops?.length || detail.paraProps.tabAutoLeft || detail.paraProps.tabAutoRight || detail.paraProps.borderConnect || detail.paraProps.borderIgnoreMargin || detail.paraProps.borderSpacing?.some((v: number) => v !== 0))) throw new Error('번호·개요·사용자 탭·테두리·배경을 포함한 스타일 교환은 아직 지원하지 않습니다. 원본 정의는 유지합니다.');
}
export function exportStylePackage(wasm: any, selected: number[]): StylePackage {
  const doc = raw(wasm), list = parsed(doc.getStyleList()), ids: number[] = [];
  for (const id of selected) { let at = id; while (!ids.includes(at)) { const style = list.find((style: any) => style.id === at); if (!style) throw new Error('내보낼 스타일을 다시 선택하세요.'); ids.push(at); if (ids.length > 64) throw new Error('다음 스타일 연결을 포함해 64개 이하로 선택하세요.'); at = style.type === 0 ? style.nextStyleId : 0; } }
  return validateStylePackage({ format: 'jueony-styles', version: 1, styles: ids.map(id => {
    const style = list.find((style: any) => style.id === id), detail = parsed(doc.getStyleDetail(id)); plain(detail, style.type);
    return { name: style.name, englishName: style.englishName, type: style.type, next: ids.indexOf(style.type === 0 ? style.nextStyleId : 0), ...validatePortableShapes(detail.charProps, detail.paraProps) };
  }) });
}
export function importStyleNames(wasm: any, value: StylePackage): { name: string; englishName: string }[] {
  const packageValue = validateStylePackage(value), list = parsed(raw(wasm).getStyleList());
  if (list.length + packageValue.styles.length > 256) throw new Error('가져온 스타일을 포함하면 256개를 넘습니다.');
  const names = new Set<string>(list.map((style: any) => style.name.normalize('NFC'))), english = new Set<string>(list.map((style: any) => style.englishName.normalize('NFC')));
  const unique = (value: string, used: Set<string>) => { if (!value) return ''; let result = value, n = 1; while (used.has(result.normalize('NFC'))) result = value.slice(0, 225) + ' (가져옴 ' + n++ + ')'; used.add(result.normalize('NFC')); return result; };
  return packageValue.styles.map(style => ({ name: unique(style.name, names), englishName: unique(style.englishName, english) }));
}
/** Appends definitions only. Existing names and every body/style reference remain unchanged. */
export function importStylePackage(wasm: any, value: StylePackage): number[] {
  const doc = raw(wasm), packageValue = validateStylePackage(value), names = importStyleNames(doc, packageValue), existing = parsed(doc.getStyleList()), beforeText = doc.getTextFileUnicode();
  plain(parsed(doc.getStyleDetail(0)), 0);
  const ids = packageValue.styles.map((style, index) => { const id = doc.createStyle(JSON.stringify({ ...names[index], type: style.type, nextStyleId: 0, baseCharShapeId: existing[0].charShapeId, baseParaShapeId: existing[0].paraShapeId })); if (!Number.isInteger(id) || id < existing.length || id > 255) throw new Error('스타일을 만들지 못했습니다.'); return id; });
  packageValue.styles.forEach((style, index) => {
    const { fontFamilies, ...char } = style.char, fontIds = fontFamilies.map((name: string, language: number) => doc.findOrCreateFontIdForLang(language, name));
    if (fontIds.some((id: number) => !Number.isInteger(id) || id < 0 || id > 65535)) throw new Error('스타일의 언어별 글꼴을 등록하지 못했습니다.');
    const para: Record<string, any> = { ...style.para, headType: 'None', paraLevel: 0, numberingId: 0 };
    for (const key of ['marginLeft', 'marginRight', 'indent']) para[key] = Math.round(para[key] * 150);
    for (const key of ['spacingBefore', 'spacingAfter']) para[key] = Math.round(para[key] * 75);
    para.lineSpacing = Math.round(para.lineSpacing * (para.lineSpacingType === 'Percent' ? 1 : 75));
    if (!doc.updateStyle(ids[index], JSON.stringify({ ...names[index], nextStyleId: style.type === 0 ? ids[style.next] : 0 })) || !doc.updateStyleShapes(ids[index], JSON.stringify({ ...char, fontIds }), style.type === 0 ? JSON.stringify(para) : '{}')) throw new Error('스타일의 모양 또는 다음 스타일을 연결하지 못했습니다.');
    const detail = parsed(doc.getStyleDetail(ids[index])), actual = validatePortableShapes(detail.charProps, detail.paraProps);
    if (JSON.stringify(actual.char) !== JSON.stringify(style.char) || style.type === 0 && JSON.stringify(actual.para) !== JSON.stringify(style.para)) throw new Error('가져온 스타일 모양이 파일과 다릅니다.');
  });
  if (doc.getTextFileUnicode() !== beforeText || JSON.stringify(parsed(doc.getStyleList()).slice(0, existing.length)) !== JSON.stringify(existing)) throw new Error('스타일 가져오기 중 기존 문서나 정의가 바뀌었습니다.');
  return ids;
}
export function preflightStylePackage(wasm: any, value: StylePackage): void {
  const { HwpDocument } = wasm.getWasmModuleExports(), format = /\.hwpx$/iu.test(wasm.fileName) ? 'hwpx' : 'hwp', open = (bytes: Uint8Array) => new HwpDocument(bytes);
  const save = (doc: any) => { const artifact = doc[format === 'hwpx' ? 'exportHwpxWithReport' : 'exportHwpWithReport'](); try { const loss = artifact.contentLoss(), bytes = artifact.takeBytes(); verifyPreservedExport(doc, bytes, format, loss, open); return bytes; } finally { artifact.free(); } };
  let scratch: any;
  try { scratch = open(save(raw(wasm))); importStylePackage(scratch, value); save(scratch); } finally { scratch?.free(); }
}
