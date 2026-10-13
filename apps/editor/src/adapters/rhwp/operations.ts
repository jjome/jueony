import type { Snapshot, Table, ControlOp } from '../../modules/document/public/index.ts';
import { nativeDocument, parsed, readStructure } from './structure.ts';
import {executeAgentSectionOperation} from './agent-section-settings.ts';
import {executeAgentPageBackground} from './agent-page-background.ts';
import { tableAxisKinds, controlKinds, charRules, tableAxisPlan, pageProperties, selectedCells, mm } from '../../modules/document/public/engine-integration.ts';
export { controlKinds };
const fail = (message: string): never => { throw new Error(message); };
const checked = (value: any) => { const result = parsed(value); if (result?.ok === false) fail('문서 엔진이 편집 명령을 거절했습니다.'); return result; };
function charProperties(doc:any,props:any) {
 const result:any=Object.fromEntries(Object.entries(props).filter(([k])=>k in charRules&&!['fontFamily','ratioPercent','spacingPercent'].includes(k)).map(([k,v])=>[k==='fontSizePt'?'fontSize':k==='color'?'textColor':k,k==='fontSizePt'?Math.round((v as number)*100):v]));
 if(props.fontFamily){result.fontIds=Array.from({length:7},(_,lang)=>doc.findOrCreateFontIdForLang(lang,props.fontFamily));if(result.fontIds.some((id:number)=>!Number.isInteger(id)||id<0||id>65535))fail('글꼴 이름을 문서에 등록하지 못했습니다.');}
 if(props.ratioPercent!==undefined)result.ratios=Array(7).fill(props.ratioPercent);
 if(props.spacingPercent!==undefined)result.spacings=Array(7).fill(props.spacingPercent);
 if(props.superscript===true)result.subscript=false;if(props.subscript===true)result.superscript=false;
 return result;
}
function replaceCellText(doc:any,base:number[],cell:number,value:string) {
 const length=doc.getCellParagraphLength(...base,cell,0);
 const shape=parsed(doc.getCellCharPropertiesAt(...base,cell,0,0)).charShapeId;
 if(!Number.isInteger(shape))fail('원래 셀 글자 서식을 확인하지 못했습니다.');
 if(length)checked(doc.deleteTextInCell(...base,cell,0,0,length));
 if(value){checked(doc.insertTextInCell(...base,cell,0,0,value));checked(doc.setCharShapeIdInCell(...base,cell,0,0,doc.getCellParagraphLength(...base,cell,0),shape));}
}
export function executeControlOperation(wasm: any, snapshot: Snapshot, op: ControlOp, tables: Map<string, Table>): { section: number; after: number; count: number } | undefined {
  const doc = nativeDocument(wasm);
  if(op.kind==='set_section_tabs'||op.kind==='set_line_numbers'){executeAgentSectionOperation(doc,snapshot.name,op);return;}
  if(op.kind==='set_page_background'){executeAgentPageBackground(doc,op);return;}
  if(op.kind==='apply_paragraph_style') {const n=snapshot.nodes.find(n=>n.id===op.target)!;checked(doc.applyStyle(n.section,n.paragraph,op.styleId));return;}
  if(op.kind==='set_columns'){checked(doc.setColumnDef(op.section,op.count,0,1,mm(op.spacingMm)));return;}
  if(op.kind==='set_page_hide'){
    const n=snapshot.nodes.find(n=>n.id===op.target)!;
    const flags={...parsed(doc.getPageHide(n.section,n.paragraph)),...op.properties};
    checked(doc.setPageHide(n.section,n.paragraph,...['hideHeader','hideFooter','hideMasterPage','hideBorder','hideFill','hidePageNum'].map(key=>flags[key]===true)));return;
  }
  if (op.kind === 'set_page_setup') { checked(doc.setPageDef(op.section, JSON.stringify(pageProperties(parsed(doc.getPageDef(op.section)), op.properties)))); return; }
  if(tableAxisKinds.includes(op.kind)) {
    const axis=op as Extract<ControlOp,{index:number}>,table=tables.get(axis.target)!;
    const expected=tableAxisPlan(table,axis),row=axis.kind.endsWith('_row'),insert=axis.kind.startsWith('insert_');
    const base=[table.section,table.paragraph,table.control],size=row?table.rows:table.columns;
    const method=({insert_table_row:'insertTableRow',insert_table_column:'insertTableColumn',delete_table_row:'deleteTableRow',delete_table_column:'deleteTableColumn'} as any)[axis.kind];
    if(insert)checked(doc[method](...base,Math.min(axis.index,size-1),axis.index===size));
    else checked(doc[method](...base,axis.index));
    const read=()=>readStructure(doc).tables.find(t=>t.section===table.section&&t.paragraph===table.paragraph&&t.control===table.control);
    let current=read();if(!current)fail('변경한 표를 확인하지 못했습니다.');
    if(insert)for(const cell of current!.cells.filter(c=>(row?c.row:c.column)===axis.index)) {
      const value=(axis as any).values[row?cell.column:cell.row];
      replaceCellText(doc,base,cell.index,value);
    }
    current=read();
    if(!current||current.rows!==expected.rows||current.columns!==expected.columns||current.cells.length!==expected.cells.length||expected.cells.some(c=>current!.cells.find(v=>v.row===c.row&&v.column===c.column)?.text!==c.text))fail('표의 행·열 변경 결과가 명령과 다릅니다.');
    tables.set(axis.target,current!);return;
  }
  if (op.kind === 'format_characters' || op.kind === 'format_paragraph') {
    const n = snapshot.nodes.find(n => n.id === op.target)!;
    if (op.kind === 'format_characters') checked(doc.applyCharFormat(n.section, n.paragraph, 0, doc.getParagraphLength(n.section, n.paragraph), JSON.stringify(charProperties(doc,op.properties))));
    else {
      const p: any = {}; for (const [k, v] of Object.entries(op.properties)) {
        const key = ({ lineSpacingPercent: 'lineSpacing', beforeMm: 'spacingBefore', afterMm: 'spacingAfter' } as any)[k] ?? (k.endsWith('Mm') ? k.slice(0, -2) : k);
        p[key] = k.endsWith('Mm') ? mm(v as number) : v;
      }
      if ('lineSpacingPercent' in op.properties) p.lineSpacingType = 'Percent';
      checked(doc.applyParaFormat(n.section, n.paragraph, JSON.stringify(p)));
    }
    return;
  }
  if (op.kind === 'create_table') {
    const n = snapshot.nodes.find(n => n.id === op.after)!;
    const oldCount = doc.getParagraphCount(n.section);
    checked(doc.splitParagraph(n.section, n.paragraph, doc.getParagraphLength(n.section, n.paragraph)));
    const result = checked(doc.createTable(n.section, n.paragraph + 1, 0, op.rows.length, op.rows[0].length));
    if (result.paraIdx !== n.paragraph + 1) fail('표 생성 위치가 명령과 다릅니다.');
    op.rows.forEach((row, r) => row.forEach((value, c) => { if (value) checked(doc.insertTextInCell(n.section, result.paraIdx, result.controlIdx, r * row.length + c, 0, 0, value)); }));
    const table = readStructure(doc).tables.find(t => t.section === n.section && t.paragraph === result.paraIdx && t.control === result.controlIdx);
    if (!table) fail('생성한 표를 확인하지 못했습니다.');
    // Caller shifts existing coordinates before adding this newly inserted table.
    tables.set('@' + op.resultId, table!);
    return { section: n.section, after: n.paragraph, count: doc.getParagraphCount(n.section) - oldCount };
  }
  if (op.kind !== 'set_table_cell' && op.kind !== 'format_table_cells') return;
  const table = tables.get(op.target)!;
  const base = [table.section, table.paragraph, table.control];
  if (op.kind === 'set_table_cell') {
    const cell = table.cells.find(c => c.row === op.row && c.column === op.column)!;
    const length = doc.getCellParagraphLength(...base, cell.index, 0);
    if (doc.getTextInCell(...base, cell.index, 0, 0, length) !== op.originalText) fail('적용 직전 셀 원문이 달라졌습니다.');
    replaceCellText(doc,base,cell.index,op.text);
    if (doc.getTextInCell(...base, cell.index, 0, 0, doc.getCellParagraphLength(...base, cell.index, 0)) !== op.text) fail('셀 편집 결과가 다릅니다.');
    cell.text = op.text;
  } else for (const cell of selectedCells(table, op)) {
    const p = op.properties, chars = charProperties(doc,p), length = doc.getCellParagraphLength(...base, cell.index, 0);
    if (Object.keys(chars).length && length) checked(doc.applyCharFormatInCell(...base, cell.index, 0, 0, length, JSON.stringify(chars)));
    if (p.alignment) checked(doc.applyParaFormatInCell(...base, cell.index, 0, JSON.stringify({ alignment: p.alignment })));
    const cp: any = {};
    // OWPML omits hatchStyle for plain fills; -1 is the engine's no-pattern value.
    if (p.background) Object.assign(cp, { fillType: 'solid', fillColor: p.background, patternType: -1 });
    if (p.verticalAlignment) cp.verticalAlign = ['top', 'center', 'bottom'].indexOf(p.verticalAlignment as string);
    if (Object.keys(cp).length) checked(doc.setCellProperties(...base, cell.index, JSON.stringify(cp)));
  }
}
