import type { Cell, Table, Structure } from '../../modules/document/public/types.ts';
export type { Cell, Table, Structure } from '../../modules/document/public/types.ts';
// All coordinates refer to the currently open WASM document, never its disk copy.
export const parsed = (v: any): any => typeof v === 'string' ? JSON.parse(v) : v;
export const nativeDocument = (wasm: any): any => wasm.borrowDocumentHandle?.() ?? wasm;
export function readStructure(wasm: any): Structure {
  const doc = nativeDocument(wasm), positions: { section: number; paragraph: number }[] = [];
  const sections: Structure['sections'] = [], paragraphs: Structure['paragraphs'] = [];
  for (let section = 0; section < doc.getSectionCount(); section++) {
    sections.push({ index: section, page: parsed(doc.getPageDef(section)),columns:parsed(doc.getColumnDef(section)) });
    for (let paragraph = 0; paragraph < doc.getParagraphCount(section); paragraph++) {
      positions.push({ section, paragraph });
      paragraphs.push({ id: `s${section}p${paragraph}`, characters: parsed(doc.getCharPropertiesAt(section, paragraph, 0)), paragraph: parsed(doc.getParaPropertiesAt(section, paragraph)),style:parsed(doc.getStyleAt(section,paragraph)),pageHide:parsed(doc.getPageHide(section,paragraph)) });
    }
  }
  const controls = parsed(doc.getControls()), lists = parsed(doc.getCursorModel()).lists;
  paragraphs.forEach((p,index)=>{const at=positions[index];p.controls=controls.filter((c:any)=>c.list===0&&c.para===index).map((c:any)=>c.ctrlId);p.pageIndex=parsed(doc.getPageOfPosition(at.section,at.paragraph)).page;});
  const tables: Table[] = [], unsupportedControls: string[] = [];
  for (const control of controls) {
    if (['secd', 'cold'].includes(control.ctrlId)) continue;
    if (control.list !== 0 || control.ctrlId !== 'tbl') { unsupportedControls.push(control.ctrlId); continue; }
    // getControls root paragraph indices are flattened across sections.
    const at = positions[control.para];
    if (!at) throw new Error('표의 본문 위치를 확인하지 못했습니다.');
    const { section, paragraph } = at, ci = control.controlIndex;
    const dimensions = parsed(doc.getTableDimensions(section, paragraph, ci));
    if (dimensions.cellCount > 1000) throw new Error('한 표가 구조 조회 한도 1,000셀을 넘습니다.');
    const cells: Cell[] = [];
    for (let i = 0; i < dimensions.cellCount; i++) {
      const info = parsed(doc.getCellInfo(section, paragraph, ci, i));
      const count = doc.getCellParagraphCount(section, paragraph, ci, i), texts: string[] = [];
      for (let p = 0; p < count; p++) texts.push(doc.getTextInCell(section, paragraph, ci, i, p, 0, doc.getCellParagraphLength(section, paragraph, ci, i, p)));
      const list = lists.find((l: any) => l.isCell && l.sectionIndex === section && l.hostPara === paragraph && l.controlIndex === ci && l.cellIndex === i && l.hostListId === 0);
      const runs = count === 1 ? parsed(doc.getCharShapeRunsInCellByPath(section, paragraph, JSON.stringify([{ controlIndex: ci, cellIndex: i, cellParaIndex: 0 }]), 0, doc.getCellParagraphLength(section, paragraph, ci, i, 0))) : [];
      const simple = count === 1 && new Set(runs.map((r: any) => r.charShapeId)).size <= 1 && Array.from(texts[0]).length <= 4000 && list && !controls.some((c: any) => c.list === list.listId);
      cells.push({ index: i, row: info.row, column: info.col, rowSpan: info.rowSpan, columnSpan: info.colSpan, text: texts.join('\n'), editable: Boolean(simple), properties: parsed(doc.getCellProperties(section, paragraph, ci, i)), characters: parsed(doc.getCellCharPropertiesAt(section, paragraph, ci, i, 0, 0)), paragraphProperties: parsed(doc.getCellParaPropertiesAt(section, paragraph, ci, i, 0)) });
    }
    tables.push({ id: `s${section}p${paragraph}t${ci}`, section, paragraph, control: ci, rows: dimensions.rowCount, columns: dimensions.colCount, cells });
  }
  const styles=parsed(doc.getStyleList()).map((style:any)=>({id:style.id,name:style.name,type:style.type}));
  return { sections, tables, paragraphs,styles, unsupportedControls: [...new Set(unsupportedControls)] };
}
