import { validateStylePackage, validatePortableShapes, type StylePackage } from '../../modules/document/public/style-package.ts';
import { verifyPreservedExport } from './preservation.ts';
const parsed = (value: any): any => typeof value === 'string' ? JSON.parse(value) : value;
const raw = (wasm: any) => wasm.borrowDocumentHandle?.() ?? wasm;
const canonical = (value: any): any => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const same = (left: any, right: any) => JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
function plain(detail: any, type: number): void {
  const p = detail.charProps;
  if (p.fillType !== 'none' || ['borderLeft', 'borderRight', 'borderTop', 'borderBottom'].some(key => p[key]?.type || p[key]?.width)) throw new Error('글자 스타일의 테두리·배경 참조는 아직 안전하게 교환할 수 없습니다. 원본 정의는 유지합니다.');
  if (type === 0 && detail.paraProps.headType !== 'None') throw new Error('번호·개요를 포함한 스타일 교환은 아직 지원하지 않습니다. 원본 정의는 유지합니다.');
}
const borderKeys = ['borderLeft', 'borderRight', 'borderTop', 'borderBottom'] as const;
const activeTabs = (p: any) => Boolean(p.tabAutoLeft || p.tabAutoRight || p.tabStops?.length);
const activeDecoration = (p: any) => p.fillType !== 'none' || borderKeys.some(key => p[key]?.type || p[key]?.width) || p.borderSpacing?.some((v: number) => v !== 0);
function portableReferences(p: any): Record<string, any> {
  const value: Record<string, any> = {};
  if (activeTabs(p)) value.tabs = { autoLeft: p.tabAutoLeft, autoRight: p.tabAutoRight, stops: p.tabStops };
  if (activeDecoration(p)) value.decoration = { ...Object.fromEntries(borderKeys.map(key => [key, p[key]])), fillType: p.fillType, fillColor: p.fillColor, patternColor: p.patternColor, patternType: p.patternType, borderSpacing: p.borderSpacing };
  return value;
}
function certifyPortableReferences(doc: any, styleId: number, detail: any): Record<string, any> {
  const references = portableReferences(detail.paraProps);
  const canCertify = typeof doc.getAgentParagraphTabs === 'function' && typeof doc.getAgentParagraphDecoration === 'function';
  if (!canCertify && !Object.keys(references).length) return references;
  if (!canCertify) throw new Error('사용자 탭·문단 테두리·배경의 원본 참조를 검사하는 최신 문서 엔진이 필요합니다.');
  const checkpoint = doc.saveSnapshot(); let failure: unknown;
  try {
    const section = doc.getSectionCount() - 1, count = doc.getParagraphCount(section), inserted = parsed(doc.insertParagraph(section, count - 1)), paragraph = inserted?.paraIdx;
    if (inserted?.ok !== true || !Number.isInteger(paragraph) || paragraph < 0 || paragraph >= count + 1 || doc.getParagraphCount(section) !== count + 1) throw new Error('스타일 참조 검사 문단을 만들지 못했습니다.');
    if (parsed(doc.applyStyle(section, paragraph, styleId))?.ok !== true) throw new Error('스타일 참조를 검사 문단에 연결하지 못했습니다.');
    const actual = parsed(doc.getParaPropertiesAt(section, paragraph));
    const tabEvidence = parsed(doc.getAgentParagraphTabs(section, paragraph));
    if (tabEvidence?.editable !== true || !same(tabEvidence.stops, detail.paraProps.tabStops) || tabEvidence.autoLeft !== detail.paraProps.tabAutoLeft || tabEvidence.autoRight !== detail.paraProps.tabAutoRight) throw new Error('스타일 사용자 탭의 원본 참조에 해석되지 않은 속성이 있습니다.');
    if (parsed(doc.getAgentParagraphDecoration(section, paragraph))?.editable !== true) throw new Error('스타일 테두리·배경의 원본 참조에 고급 효과 또는 해석되지 않은 속성이 있습니다.');
    if (!same(portableReferences(actual), references)) throw new Error('스타일 참조 검사 결과가 원본 정의와 다릅니다.');
  } catch (error) { failure = error; }
  finally {
    try { if (parsed(doc.restoreSnapshot(checkpoint))?.ok === false) throw new Error('스타일 참조 검사 뒤 문서를 복원하지 못했습니다.'); }
    catch (error) { failure = error; }
    doc.discardSnapshot(checkpoint);
  }
  if (failure) throw failure;
  return references;
}
export function exportStylePackage(wasm: any, selected: number[]): StylePackage {
  const doc = raw(wasm), list = parsed(doc.getStyleList()), ids: number[] = [];
  for (const id of selected) { let at = id; while (!ids.includes(at)) { const style = list.find((style: any) => style.id === at); if (!style) throw new Error('내보낼 스타일을 다시 선택하세요.'); ids.push(at); if (ids.length > 64) throw new Error('다음 스타일 연결을 포함해 64개 이하로 선택하세요.'); at = style.type === 0 ? style.nextStyleId : 0; } }
  return validateStylePackage({ format: 'jueony-styles', version: 1, styles: ids.map(id => {
    const style = list.find((style: any) => style.id === id), detail = parsed(doc.getStyleDetail(id)); plain(detail, style.type);
    const para = style.type === 0 ? { ...detail.paraProps, ...certifyPortableReferences(doc, id, detail) } : detail.paraProps;
    return { name: style.name, englishName: style.englishName, type: style.type, next: ids.indexOf(style.type === 0 ? style.nextStyleId : 0), ...validatePortableShapes(detail.charProps, para) };
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
  const defaultDetail = parsed(doc.getStyleDetail(0)); plain(defaultDetail, 0);
  certifyPortableReferences(doc, 0, defaultDetail);
  if (Object.keys(portableReferences(defaultDetail.paraProps)).length) throw new Error('현재 문서의 바탕글에 사용자 탭·테두리·배경이 있어 새 스타일의 기본 참조로 사용할 수 없습니다.');
  const checkpoint = doc.saveSnapshot();
  try {
    const body = () => JSON.stringify(Array.from({ length: doc.getSectionCount() }, (_, section) => Array.from({ length: doc.getParagraphCount(section) }, (_, paragraph) => doc.getTextRange(section, paragraph, 0, doc.getParagraphLength(section, paragraph)))));
    const nativePara = (portable: Record<string, any>, references = true) => { const { tabs, decoration, ...para } = portable; for (const key of ['marginLeft', 'marginRight', 'indent']) para[key] = Math.round(para[key] * 150); for (const key of ['spacingBefore', 'spacingAfter']) para[key] = Math.round(para[key] * 75); para.lineSpacing = Math.round(para.lineSpacing * (para.lineSpacingType === 'Percent' ? 1 : 75)); if (references && tabs) Object.assign(para, { tabStops: tabs.stops, tabAutoLeft: tabs.autoLeft, tabAutoRight: tabs.autoRight }); if (references && decoration) Object.assign(para, decoration); return { ...para, headType: 'None', paraLevel: 0, numberingId: 0 }; };
    const baseParaShapeIds = packageValue.styles.map(style => {
      if (style.type !== 0 || !style.para.tabs && !style.para.decoration) return existing[0].paraShapeId;
      const before = body(), section = doc.getSectionCount() - 1, count = doc.getParagraphCount(section), inserted = parsed(doc.insertParagraph(section, count - 1)), paragraph = inserted?.paraIdx;
      if (inserted?.ok !== true || !Number.isInteger(paragraph) || paragraph < 0 || paragraph >= count + 1 || doc.getParagraphCount(section) !== count + 1) throw new Error('스타일 참조 자원을 만들 임시 문단을 추가하지 못했습니다.');
      if (parsed(doc.applyParaFormat(section, paragraph, JSON.stringify(nativePara(style.para))))?.ok !== true) throw new Error('스타일 참조 자원을 만들지 못했습니다.');
      const shape = parsed(doc.getParaPropertiesAt(section, paragraph)), actual = portableReferences(shape), expected = Object.fromEntries(['tabs', 'decoration'].filter(key => style.para[key]).map(key => [key, style.para[key]]));
      if (!Number.isInteger(shape.paraShapeId) || shape.paraShapeId < 0 || !same(actual, expected)) throw new Error('스타일 참조 자원의 생성 결과가 파일과 다릅니다.');
      if (parsed(doc.deleteParagraph(section, paragraph))?.ok !== true || body() !== before) throw new Error('스타일 참조 자원 생성 뒤 임시 문단을 제거하지 못했습니다.');
      return shape.paraShapeId;
    });
    const ids = packageValue.styles.map((style, index) => { const id = doc.createStyle(JSON.stringify({ ...names[index], type: style.type, nextStyleId: 0, baseCharShapeId: existing[0].charShapeId, baseParaShapeId: baseParaShapeIds[index] })); if (!Number.isInteger(id) || id < existing.length || id > 255) throw new Error('스타일을 만들지 못했습니다.'); return id; });
    packageValue.styles.forEach((style, index) => {
      const { fontFamilies, ...char } = style.char, fontIds = fontFamilies.map((name: string, language: number) => doc.findOrCreateFontIdForLang(language, name));
      if (fontIds.some((id: number) => !Number.isInteger(id) || id < 0 || id > 65535)) throw new Error('스타일의 언어별 글꼴을 등록하지 못했습니다.');
      const para = nativePara(style.para, false);
      if (!doc.updateStyle(ids[index], JSON.stringify({ ...names[index], nextStyleId: style.type === 0 ? ids[style.next] : 0 })) || !doc.updateStyleShapes(ids[index], JSON.stringify({ ...char, fontIds }), style.type === 0 ? JSON.stringify(para) : '{}')) throw new Error('스타일의 모양 또는 다음 스타일을 연결하지 못했습니다.');
      const detail = parsed(doc.getStyleDetail(ids[index])), actual = validatePortableShapes(detail.charProps, style.type === 0 ? { ...detail.paraProps, ...portableReferences(detail.paraProps) } : detail.paraProps);
      if (JSON.stringify(actual.char) !== JSON.stringify(style.char) || style.type === 0 && JSON.stringify(actual.para) !== JSON.stringify(style.para)) throw new Error('가져온 스타일 모양이 파일과 다릅니다.');
    });
    if (doc.getTextFileUnicode() !== beforeText || JSON.stringify(parsed(doc.getStyleList()).slice(0, existing.length)) !== JSON.stringify(existing)) throw new Error('스타일 가져오기 중 기존 문서나 정의가 바뀌었습니다.');
    return ids;
  } catch (error) {
    const restored = parsed(doc.restoreSnapshot(checkpoint));
    if (restored?.ok === false) throw new Error('실패한 스타일 가져오기를 원래 문서로 되돌리지 못했습니다.');
    throw error;
  } finally { doc.discardSnapshot(checkpoint); }
}
export function preflightStylePackage(wasm: any, value: StylePackage): void {
  const { HwpDocument } = wasm.getWasmModuleExports(), format = /\.hwpx$/iu.test(wasm.fileName) ? 'hwpx' : 'hwp', open = (bytes: Uint8Array) => new HwpDocument(bytes);
  const save = (doc: any) => { const artifact = doc[format === 'hwpx' ? 'exportHwpxWithReport' : 'exportHwpWithReport'](); try { const loss = artifact.contentLoss(), bytes = artifact.takeBytes(); verifyPreservedExport(doc, bytes, format, loss, open); return bytes; } finally { artifact.free(); } };
  let scratch: any;
  try { scratch = open(save(raw(wasm))); importStylePackage(scratch, value); save(scratch); } finally { scratch?.free(); }
}
