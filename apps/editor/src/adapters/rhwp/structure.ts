import type { Cell, Table, Structure } from '../../modules/document/public/types.ts';
import {readAgentBookmarks} from './agent-bookmarks.ts';
import {readAgentHeaderFooters} from './agent-header-footer.ts';
import {readAgentEmptySectionEligibility} from './agent-empty-section.ts';
import {readLineNumberSettings} from './line-numbers.ts';
import {readAgentMasterPages} from './agent-master-pages.ts';
export type { Cell, Table, Structure } from '../../modules/document/public/types.ts';
// All coordinates refer to the currently open WASM document, never its disk copy.
export const parsed = (v: any): any => typeof v === 'string' ? JSON.parse(v) : v;
export const nativeDocument = (wasm: any): any => wasm.borrowDocumentHandle?.() ?? wasm;
export function readStructure(wasm: any): Structure {
  const doc = nativeDocument(wasm), positions: { section: number; paragraph: number }[] = [];
  const sections: Structure['sections'] = [], paragraphs: Structure['paragraphs'] = [];
  for (let section = 0; section < doc.getSectionCount(); section++) {
    const entry:Structure['sections'][number]={index:section,page:parsed(doc.getPageDef(section)),columns:parsed(doc.getColumnDef(section))};
    if(typeof doc.getSectionDef==='function'){
      const raw=parsed(doc.getSectionDef(section)).defaultTabSpacing;
      if(!Number.isSafeInteger(raw)||raw<0)throw new Error('구역의 기본 탭 설정을 읽지 못했습니다.');
      entry.defaultTabSpacingPt=(raw||8000)/200;
    }
    if(typeof doc.getLineNumberSettings==='function'){
      const settings=readLineNumberSettings(doc,section);
      entry.lineNumbers={enabled:settings.enabled,restart:([null,'page','section','continuous'] as const)[settings.restartType]??null,countBy:settings.countBy,startNumber:settings.startNumber,distanceMm:Math.round(settings.distance*25.4/7200*1000000)/1000000,editable:settings.editable};
    }
    const removal=readAgentEmptySectionEligibility(doc,section);if(removal)entry.emptySectionRemoval=removal;
    const headerFooters=readAgentHeaderFooters(doc,section);if(headerFooters)entry.headerFooters=headerFooters;
    sections.push(entry);
    if(typeof doc.getMasterPages==='function'&&typeof doc.setMasterPageText==='function')entry.masterPages=readAgentMasterPages(doc,section);
    if(typeof doc.getAgentPageBackground==='function')entry.pageBackgrounds=['both','even','odd'].map(kind=>{
      const setting=parsed(doc.getAgentPageBackground(section,kind));
      const visibility=parsed(doc.getPageBorderFillEntry(section,kind));
      return {kind:setting.kind,fillType:setting.fillType,color:setting.color,applyPage:setting.applyPage,hideFill:visibility.hideFill,firstPageFill:visibility.firstPageFill,editable:setting.editable,...(setting.reason?{reason:setting.reason}:{})};
    });
    for (let paragraph = 0; paragraph < doc.getParagraphCount(section); paragraph++) {
      positions.push({ section, paragraph });
      paragraphs.push({ id: `s${section}p${paragraph}`, characters: parsed(doc.getCharPropertiesAt(section, paragraph, 0)), paragraph: parsed(doc.getParaPropertiesAt(section, paragraph)),style:parsed(doc.getStyleAt(section,paragraph)),pageHide:parsed(doc.getPageHide(section,paragraph)) });
    }
  }
  // Deletion is restricted to documents whose every stored header/footer is natively plain.
  const allPlainHeaders=sections.every(s=>s.headerFooters?.every(h=>h.exists===false||h.exists===true&&h.editable===true)===true);
  if(!allPlainHeaders)for(const section of sections)for(const header of section.headerFooters??[]){header.deletable=false;header.creatable=false;}
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
    const tableProps=parsed(doc.getTableProperties(section,paragraph,ci)),mode=(['none','cell','row'] as const)[tableProps.pageBreak];
    const headerRows=cells.every(c=>c.properties.isHeader===false)?0:cells.every(c=>c.properties.isHeader===(c.row===0))?1:null;
    tables.push({headerRows, ...(mode!==undefined?{pagination:{mode,repeatHeader:tableProps.repeatHeader}}:{}), id: `s${section}p${paragraph}t${ci}`, section, paragraph, control: ci, rows: dimensions.rowCount, columns: dimensions.colCount, cells });
  }
  const styleLinks=parsed(doc.getStyleList()).map((style:any)=>({id:style.id,nextStyleId:style.nextStyleId}));
  const styles=parsed(doc.getStyleList()).map((style:any)=>({id:style.id,name:style.name,type:style.type}));
  if(sections.reduce((total,s)=>total+(s.masterPages?.pages.reduce((n,p)=>n+Array.from(p.text).length,0)??0),0)>120000)throw new Error('바탕쪽 문맥은 전체 120,000자 이하입니다. 원본 바탕쪽은 유지됩니다.');
  if(sections.reduce((total,s)=>total+(s.headerFooters?.reduce((n,h)=>n+Array.from(h.text).length,0)??0),0)>120000)throw new Error('머리말/꼬리말 문맥은 전체 120,000자 이하입니다.');
  const bookmarks=readAgentBookmarks(doc);
  return {...(bookmarks?{bookmarks}:{}), sectionMergeAvailable:typeof doc.mergeSectionBoundary==='function', sectionSplitAvailable:typeof doc.insertSectionBreak==='function', sections, tables, paragraphs,styles,styleLinks, unsupportedControls: [...new Set(unsupportedControls)] };
}
