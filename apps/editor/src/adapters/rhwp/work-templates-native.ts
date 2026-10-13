import { readWorkTemplate, type WorkTemplateId } from '../../modules/document/public/work-templates.ts';
import { verifyPreservedExport } from './preservation.ts';
const parsed = (value: any): any => typeof value === 'string' ? JSON.parse(value) : value;
const raw = (wasm: any) => wasm.borrowDocumentHandle?.() ?? wasm;
const checked = (result: any) => { if (parsed(result)?.ok === false) throw new Error('업무 양식을 문서 엔진이 거절했습니다.'); };
export function canApplyWorkTemplate(wasm: any): boolean {
  const doc = raw(wasm);
  return doc.getSectionCount() === 1 && doc.getParagraphCount(0) === 1 && doc.getParagraphLength(0, 0) === 0 && parsed(doc.getControls()).every((control: any) => ['secd', 'cold'].includes(control.ctrlId));
}
/** Writes only into a verified empty live document through the caller's snapshot router. */
export function applyWorkTemplate(wasm: any, id: WorkTemplateId): void {
  const doc = raw(wasm), template = readWorkTemplate(id); if (!canApplyWorkTemplate(doc)) throw new Error('새 빈 문서를 연 뒤 업무 양식을 넣으세요. 기존 내용은 덮어쓰지 않았습니다.');
  const styles = parsed(doc.getStyleList()), base = parsed(doc.getStyleAt(0, 0)).id, baseStyle = styles.find((style: any) => style.id === base);
  const add = (name: string, size: number, alignment: string) => {
    let unique = name, count = 1; while (parsed(doc.getStyleList()).some((style: any) => style.name === unique)) unique = name + ' ' + count++;
    const value = doc.createStyle(JSON.stringify({ name: unique, englishName: '', type: 0, nextStyleId: base, baseCharShapeId: baseStyle.charShapeId, baseParaShapeId: baseStyle.paraShapeId }));
    if (!Number.isInteger(value) || value < 0 || value > 255 || !doc.updateStyleShapes(value, JSON.stringify({ bold: true, fontSize: size }), JSON.stringify({ alignment, spacingBefore: 450, spacingAfter: 450, keepWithNext: true }))) throw new Error('업무 양식의 제목 스타일을 만들지 못했습니다.'); return value;
  };
  const ids = { title: add('업무 양식 제목', 1800, 'center'), heading: add('업무 양식 항목', 1200, 'left'), body: base };
  template.paragraphs.forEach((item, paragraph) => { if (paragraph) checked(doc.splitParagraph(0, paragraph - 1, doc.getParagraphLength(0, paragraph - 1))); if (item.text) checked(doc.insertText(0, paragraph, 0, item.text)); checked(doc.applyStyle(0, paragraph, ids[item.style])); });
  if (template.table) {
    const table = parsed(doc.createTable(0, template.paragraphs.length - 1, 0, template.table.length, template.table[0].length)); if (!table.ok) throw new Error('업무 양식의 표를 만들지 못했습니다.');
    template.table.forEach((row, r) => row.forEach((text, c) => { const cell = r * row.length + c; checked(doc.insertTextInCell(0, table.paraIdx, table.controlIdx, cell, 0, 0, text)); if (r === 0) checked(doc.applyCharFormatInCell(0, table.paraIdx, table.controlIdx, cell, 0, 0, Array.from(text).length, JSON.stringify({ bold: true }))); }));
  }
}
export function preflightWorkTemplate(wasm: any, id: WorkTemplateId): void {
  const { HwpDocument } = wasm.getWasmModuleExports(), format = /\.hwpx$/iu.test(wasm.fileName) ? 'hwpx' : 'hwp', open = (bytes: Uint8Array) => new HwpDocument(bytes);
  const save = (doc: any) => { const artifact = doc[format === 'hwpx' ? 'exportHwpxWithReport' : 'exportHwpWithReport'](); try { const loss = artifact.contentLoss(), bytes = artifact.takeBytes(); verifyPreservedExport(doc, bytes, format, loss, open); return bytes; } finally { artifact.free(); } };
  let scratch: any; try { scratch = open(save(raw(wasm))); applyWorkTemplate(scratch, id); save(scratch); } finally { scratch?.free(); }
}
