import { verifyPreservedExport } from './preservation.ts';
const parsed = (value: any): any => typeof value === 'string' ? JSON.parse(value) : value;
const raw = (wasm: any) => wasm.borrowDocumentHandle?.() ?? wasm;
const length = (text: string) => Array.from(text).length;
const checked = (result: any) => { if (parsed(result)?.ok === false) throw new Error('텍스트 넣기를 문서 엔진이 거절했습니다.'); };
export type PlainTextPlan = { section: number; paragraph: number; start: number; end: number; source: string; text: string; charShape: number; paraShape: number; style: number };

export function readPlainTextPlan(wasm: any, range: { start: any; end: any }, value: string): PlainTextPlan {
  const doc = raw(wasm), { start, end } = range, text = value.replace(/\r\n?/gu, '\n');
  if ([start, end].some(point => !point || point.parentParaIndex !== undefined || point.isTextBox || ![point.sectionIndex, point.paragraphIndex, point.charOffset].every(n => Number.isSafeInteger(n) && n >= 0)) || start.sectionIndex !== end.sectionIndex || start.paragraphIndex !== end.paragraphIndex || start.charOffset > end.charOffset) throw new Error('본문의 한 문단 안에서 커서 또는 글자를 선택하세요.');
  if (!text || length(text) > 20_000 || text.split('\n').length > 200 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(text)) throw new Error('1~20,000자, 200줄 이하 텍스트를 넣으세요. 탭과 줄바꿈 외 제어 문자는 지원하지 않습니다.');
  const section = start.sectionIndex, paragraph = start.paragraphIndex;
  if (section >= doc.getSectionCount() || paragraph >= doc.getParagraphCount(section) || end.charOffset > doc.getParagraphLength(section, paragraph)) throw new Error('커서 또는 선택 위치가 바뀌었습니다.');
  let flat = paragraph; for (let s = 0; s < section; s++) flat += doc.getParagraphCount(s);
  if (parsed(doc.getControls()).some((item: any) => item.list === 0 && item.para === flat && !['secd', 'cold'].includes(item.ctrlId))) throw new Error('필드·개체가 포함된 문단의 텍스트 넣기는 아직 지원하지 않습니다.');
  return { section, paragraph, start: start.charOffset, end: end.charOffset, source: doc.getTextRange(section, paragraph, 0, doc.getParagraphLength(section, paragraph)), text,
    charShape: parsed(doc.getCharPropertiesAt(section, paragraph, start.charOffset)).charShapeId,
    paraShape: parsed(doc.getParaPropertiesAt(section, paragraph)).paraShapeId, style: parsed(doc.getStyleAt(section, paragraph)).id };
}
function range(plan: PlainTextPlan) { return { start: { sectionIndex: plan.section, paragraphIndex: plan.paragraph, charOffset: plan.start }, end: { sectionIndex: plan.section, paragraphIndex: plan.paragraph, charOffset: plan.end } }; }
/** Live calls must be enclosed in a snapshot router operation. */
export function executePlainText(wasm: any, plan: PlainTextPlan): any {
  const doc = raw(wasm);
  if (JSON.stringify(readPlainTextPlan(doc, range(plan), plan.text)) !== JSON.stringify(plan)) throw new Error('문서 원문이나 서식이 바뀌었습니다. 텍스트 넣기를 다시 여세요.');
  const lines = plan.text.split('\n'), chars = Array.from(plan.source), expected = chars.slice(0, plan.start).join('') + plan.text + chars.slice(plan.end).join('');
  checked(doc.replaceText(plan.section, plan.paragraph, plan.start, plan.end - plan.start, lines[0]));
  let paragraph = plan.paragraph, offset = plan.start;
  for (let i = 0; i < lines.length; i++) {
    if (i) { checked(doc.splitParagraph(plan.section, paragraph, offset + length(lines[i - 1]))); paragraph++; offset = 0; if (lines[i]) checked(doc.insertText(plan.section, paragraph, 0, lines[i])); }
    if (lines[i]) checked(doc.setCharShapeId(plan.section, paragraph, offset, offset + length(lines[i]), plan.charShape));
    if (parsed(doc.getParaPropertiesAt(plan.section, paragraph)).paraShapeId !== plan.paraShape || parsed(doc.getStyleAt(plan.section, paragraph)).id !== plan.style) throw new Error('텍스트 넣기 후 문단 서식이 달라졌습니다.');
  }
  const actual = lines.map((_, i) => doc.getTextRange(plan.section, plan.paragraph + i, 0, doc.getParagraphLength(plan.section, plan.paragraph + i))).join('\n');
  if (actual !== expected) throw new Error('텍스트 넣기 결과가 원문과 다릅니다.');
  return { sectionIndex: plan.section, paragraphIndex: paragraph, charOffset: offset + length(lines.at(-1)!) };
}
export function preflightPlainText(wasm: any, plan: PlainTextPlan): void {
  const { HwpDocument } = wasm.getWasmModuleExports(), format = /\.hwpx$/iu.test(wasm.fileName) ? 'hwpx' : 'hwp', open = (bytes: Uint8Array) => new HwpDocument(bytes);
  const save = (doc: any) => {
    const artifact = doc[format === 'hwpx' ? 'exportHwpxWithReport' : 'exportHwpWithReport']();
    try { const loss = artifact.contentLoss(), bytes = artifact.takeBytes(); verifyPreservedExport(doc, bytes, format, loss, open); return bytes; } finally { artifact.free(); }
  };
  let scratch: any;
  try { scratch = open(save(raw(wasm))); const candidate = readPlainTextPlan(scratch, range(plan), plan.text); if (candidate.source !== plan.source) throw new Error('텍스트 사본의 원문이 다릅니다.'); executePlainText(scratch, candidate); save(scratch); }
  finally { scratch?.free(); }
}
