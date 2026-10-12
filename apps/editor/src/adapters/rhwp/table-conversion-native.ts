import { parseTableText, joinTableText, tableTextDelimiter, tableConversionLimits } from '../../modules/document/public/table-conversion.ts';
import type { TableTextSeparator } from '../../modules/document/public/table-conversion.ts';
import { verifyPreservedExport } from './preservation.ts';

type Position = { sectionIndex: number; paragraphIndex: number; charOffset: number; parentParaIndex?: number; cellPath?: unknown[]; isTextBox?: boolean };
type Format = { charShape: number; paraShape: number; style: number };
export type TextTablePlan = { kind: 'text-to-table'; section: number; first: number; last: number; texts: string[]; rows: string[][]; formats: Format[]; separator: TableTextSeparator };
export type TableTextPlan = { kind: 'table-to-text'; section: number; paragraph: number; control: number; rows: string[][]; texts: string[]; formats: Format[][]; separator: TableTextSeparator };
export type TableConversionPlan = TextTablePlan | TableTextPlan;
const parsed = (value: any): any => typeof value === 'string' ? JSON.parse(value) : value;
const checked = (value: any) => { const result = parsed(value); if (!result?.ok) throw new Error('문서 엔진이 표 변환을 거절했습니다.'); return result; };
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const native = (value: any) => value.borrowDocumentHandle?.() ?? value;
const length = (text: string) => [...text].length;
function rootControls(doc: any, section: number, paragraph: number): any[] {
  let flat = paragraph;
  for (let s = 0; s < section; s++) flat += doc.getParagraphCount(s);
  return parsed(doc.getControls()).filter((control: any) => control.list === 0 && control.para === flat);
}
function format(doc: any, section: number, paragraph: number, cell?: { control: number; index: number }): Format {
  const args = cell ? [section, paragraph, cell.control, cell.index, 0] : [section, paragraph];
  const count = cell ? doc.getCellParagraphLength(...args) : doc.getParagraphLength(...args);
  const runs = cell ? parsed(doc.getCharShapeRunsInCellByPath(section, paragraph, JSON.stringify([{ controlIndex: cell.control, cellIndex: cell.index, cellParaIndex: 0 }]), 0, count))
    : parsed(doc.getCharShapeRuns(section, paragraph, 0, count));
  if (new Set(runs.map((run: any) => run.charShapeId)).size > 1) throw new Error('혼합 글자 서식 문단은 아직 변환할 수 없습니다.');
  const charShape = parsed(doc[cell ? 'getCellCharPropertiesAt' : 'getCharPropertiesAt'](...args, 0)).charShapeId;
  const paragraphProperties = parsed(doc[cell ? 'getCellParaPropertiesAt' : 'getParaPropertiesAt'](...args));
  // Automatic labels are not returned by getTextRange/getTextInCell. Moving
  // them between body and cell lists can renumber visible content silently.
  if (paragraphProperties.headType !== 'None' || paragraphProperties.pageBreakBefore) throw new Error('자동 번호·글머리표·문단 앞 쪽 나눔은 변환 전에 해제하세요.');
  const paraShape = paragraphProperties.paraShapeId;
  const style = parsed(doc[cell ? 'getCellStyleAt' : 'getStyleAt'](...args)).id;
  if (![charShape, paraShape, style].every(integer)) throw new Error('원문 글자·문단·스타일 서식을 확인하지 못했습니다.');
  return { charShape, paraShape, style };
}
function address(doc: any, section: number, paragraph: number) {
  if (!integer(section) || !integer(paragraph) || section >= doc.getSectionCount() || paragraph >= doc.getParagraphCount(section)) throw new Error('문서의 대상 위치가 유효하지 않습니다.');
}

/** Whole body paragraphs only; an end at the following paragraph's start excludes that paragraph. */
export function readTextTablePlan(value: any, selection: { anchor: Position; focus: Position }, separator: TableTextSeparator): TextTablePlan {
  const doc = native(value);
  if (!selection?.anchor || !selection.focus) throw new Error('변환할 본문 문단 전체를 먼저 선택하세요.');
  let { anchor: start, focus: end } = selection;
  if (start.paragraphIndex > end.paragraphIndex || (start.paragraphIndex === end.paragraphIndex && start.charOffset > end.charOffset)) [start, end] = [end, start];
  if (start.sectionIndex !== end.sectionIndex || [start, end].some(p => p.parentParaIndex !== undefined || p.cellPath?.length || p.isTextBox)) throw new Error('같은 구역의 본문 문단 전체만 변환할 수 있습니다.');
  address(doc, start.sectionIndex, start.paragraphIndex); address(doc, end.sectionIndex, end.paragraphIndex);
  if (start.charOffset !== 0) throw new Error('문단 처음부터 끝까지 선택하세요.');
  const section = start.sectionIndex, first = start.paragraphIndex;
  if (parsed(doc.getColumnDef(section)).columnCount !== 1) throw new Error('다단 구역의 문자열 변환은 아직 지원하지 않습니다.');
  let last = end.paragraphIndex;
  if (last > first && end.charOffset === 0) last--;
  else if (end.charOffset !== doc.getParagraphLength(section, last)) throw new Error('문단 처음부터 끝까지 선택하세요.');
  if (last - first + 1 > tableConversionLimits.rows) throw new Error('1,000개 이하 문단을 선택하세요.');
  const texts: string[] = [], formats: Format[] = []; let characters = 0;
  const firstPage = parsed(doc.getPageOfPosition(section, first));
  if (!firstPage?.ok || !integer(firstPage.page)) throw new Error('문단의 쪽 위치를 확인하지 못했습니다.');
  for (let paragraph = first; paragraph <= last; paragraph++) {
    if (rootControls(doc, section, paragraph).some(control => !['secd', 'cold'].includes(control.ctrlId))) throw new Error('개체·필드·쪽 제어가 있는 문단은 변환할 수 없습니다.');
    if (paragraph !== first && rootControls(doc, section, paragraph).length) throw new Error('구역·단 경계가 포함된 선택은 변환할 수 없습니다.');
    const page = parsed(doc.getPageOfPosition(section, paragraph));
    if (!page?.ok || page.page !== firstPage.page) throw new Error('쪽 경계를 포함한 문자열은 현재 변환할 수 없습니다. 같은 쪽의 문단을 선택하세요.');
    const count = doc.getParagraphLength(section, paragraph);
    if (!integer(count) || (characters += count) > tableConversionLimits.characters) throw new Error('변환할 글자가 100,000자를 넘습니다.');
    texts.push(doc.getTextRange(section, paragraph, 0, count)); formats.push(format(doc, section, paragraph));
  }
  return { kind: 'text-to-table', section, first, last, texts, rows: parseTableText(texts, separator), formats, separator };
}

/** Isolated, flat, unmerged, unprotected tables with one plain paragraph per cell. */
export function readTableTextPlan(value: any, ref: { sec: number; ppi: number; ci: number; cellPath?: unknown[] }, separator: TableTextSeparator): TableTextPlan {
  const doc = native(value);
  if (!ref || ref.cellPath?.length) throw new Error('본문의 표 개체를 먼저 선택하세요.');
  const { sec: section, ppi: paragraph, ci: control } = ref; address(doc, section, paragraph);
  const controls = rootControls(doc, section, paragraph), tables = controls.filter(c => c.ctrlId === 'tbl');
  if (tables.length !== 1 || tables[0].controlIndex !== control || controls.some(c => !['tbl', 'secd', 'cold'].includes(c.ctrlId))) throw new Error('다른 개체가 없는 본문 표만 문자열로 변환할 수 있습니다.');
  const hostText = doc.getTextRange(section, paragraph, 0, doc.getParagraphLength(section, paragraph));
  // getTextRange returns body text, not extended-control slots. Even a literal
  // tab/space beside the table is original content and must not be discarded.
  if (hostText !== '') throw new Error('표와 같은 문단에 본문 문자열이 있으면 변환할 수 없습니다.');
  const dims = parsed(doc.getTableDimensions(section, paragraph, control)), props = parsed(doc.getTableProperties(section, paragraph, control));
  if (![dims.rowCount, dims.colCount, dims.cellCount].every(v => integer(v) && v > 0) || dims.cellCount !== dims.rowCount * dims.colCount || dims.cellCount > tableConversionLimits.cells || dims.colCount > tableConversionLimits.columns || props.hasCaption) throw new Error('캡션·병합 없는 100열·1,000셀 이하 표만 변환할 수 있습니다.');
  const lists = parsed(doc.getCursorModel()).lists, allControls = parsed(doc.getControls());
  const rows: string[][] = Array.from({ length: dims.rowCount }, () => []), formats: Format[][] = Array.from({ length: dims.rowCount }, () => []);
  let characters = 0;
  for (let index = 0; index < dims.cellCount; index++) {
    const info = parsed(doc.getCellInfo(section, paragraph, control, index)), cp = parsed(doc.getCellProperties(section, paragraph, control, index));
    const list = lists.find((l: any) => l.isCell && l.hostListId === 0 && l.sectionIndex === section && l.hostPara === paragraph && l.controlIndex === control && l.cellIndex === index);
    if (!integer(info.row) || !integer(info.col) || info.row >= dims.rowCount || info.col >= dims.colCount || rows[info.row][info.col] !== undefined
      || info.rowSpan !== 1 || info.colSpan !== 1 || cp.cellProtect || doc.getCellParagraphCount(section, paragraph, control, index) !== 1
      || !list || allControls.some((c: any) => c.list === list.listId)) throw new Error('병합·보호·여러 문단·개체·중첩 표가 있는 셀은 변환할 수 없습니다.');
    const count = doc.getCellParagraphLength(section, paragraph, control, index, 0);
    if (!integer(count) || count > tableConversionLimits.cellCharacters || (characters += count) > tableConversionLimits.characters) throw new Error('셀 4,000자·전체 100,000자 이하만 변환할 수 있습니다.');
    rows[info.row][info.col] = doc.getTextInCell(section, paragraph, control, index, 0, 0, count);
    formats[info.row][info.col] = format(doc, section, paragraph, { control, index });
  }
  for (const row of formats) if (row.some(f => f.paraShape !== row[0].paraShape || f.style !== row[0].style)) throw new Error('같은 행의 셀 문단·스타일 서식이 다르면 변환할 수 없습니다.');
  return { kind: 'table-to-text', section, paragraph, control, rows, texts: joinTableText(rows, separator), formats, separator };
}

export function executeTableConversion(value: any, plan: TableConversionPlan): Position {
  const doc = native(value);
  const current = plan.kind === 'text-to-table' ? readTextTablePlan(doc, { anchor: { sectionIndex: plan.section, paragraphIndex: plan.first, charOffset: 0 }, focus: { sectionIndex: plan.section, paragraphIndex: plan.last, charOffset: doc.getParagraphLength(plan.section, plan.last) } }, plan.separator)
    : readTableTextPlan(doc, { sec: plan.section, ppi: plan.paragraph, ci: plan.control }, plan.separator);
  if (JSON.stringify(current) !== JSON.stringify(plan)) throw new Error('원문이나 표 서식이 바뀌었습니다. 변환 창을 다시 여세요.');
  if (plan.kind === 'text-to-table') {
    checked(doc.deleteRange(plan.section, plan.first, 0, plan.last, doc.getParagraphLength(plan.section, plan.last)));
    const countBeforeCreate = doc.getParagraphCount(plan.section);
    const result = checked(doc.createTable(plan.section, plan.first, 0, plan.rows.length, plan.rows[0].length));
    if (result.paraIdx !== plan.first) throw new Error('문자열을 표로 바꾼 위치가 다릅니다.');
    // createTable splits its empty host and adds a fresh trailing paragraph. Only
    // that proven-new empty paragraph may be removed; existing blank rows stay.
    if (doc.getParagraphCount(plan.section) !== countBeforeCreate + 1
      || doc.getParagraphLength(plan.section, plan.first + 1) !== 0
      || rootControls(doc, plan.section, plan.first + 1).length) throw new Error('표 생성 후 새 빈 문단의 위치가 예상과 다릅니다.');
    checked(doc.deleteParagraph(plan.section, plan.first + 1));
    plan.rows.forEach((row, r) => row.forEach((text, c) => {
      const args = [plan.section, result.paraIdx, result.controlIdx, r * row.length + c, 0], f = plan.formats[r];
      checked(doc.applyCellStyle(...args, f.style)); checked(doc.setCellParaShapeId(...args, f.paraShape));
      if (text) checked(doc.insertTextInCell(...args, 0, text));
      checked(doc.setCharShapeIdInCell(...args, 0, length(text), f.charShape));
    }));
    const actual = readTableTextPlan(doc, { sec: plan.section, ppi: result.paraIdx, ci: result.controlIdx }, plan.separator);
    if (JSON.stringify(actual.rows) !== JSON.stringify(plan.rows)) throw new Error('생성한 표의 문자열이 원문과 다릅니다.');
    return { sectionIndex: plan.section, paragraphIndex: plan.first, charOffset: 0 };
  }
  checked(doc.deleteTableControl(plan.section, plan.paragraph, plan.control));
  const delimiter = tableTextDelimiter(plan.separator);
  plan.texts.forEach((text, r) => {
    const paragraph = plan.paragraph + r;
    if (r) checked(doc.splitParagraph(plan.section, paragraph - 1, doc.getParagraphLength(plan.section, paragraph - 1)));
    if (doc.getParagraphLength(plan.section, paragraph) !== 0) throw new Error('표 삭제 후 대상 문단이 비어 있지 않습니다.');
    checked(doc.applyStyle(plan.section, paragraph, plan.formats[r][0].style)); checked(doc.setParaShapeId(plan.section, paragraph, plan.formats[r][0].paraShape));
    if (text) checked(doc.insertText(plan.section, paragraph, 0, text));
    else checked(doc.setCharShapeId(plan.section, paragraph, 0, 0, plan.formats[r][0].charShape));
    let offset = 0;
    plan.rows[r].forEach((cell, c) => {
      const count = length(cell) + (c < plan.rows[r].length - 1 ? length(delimiter) : 0);
      if (count) checked(doc.setCharShapeId(plan.section, paragraph, offset, offset + count, plan.formats[r][c].charShape));
      offset += count;
    });
    if (doc.getTextRange(plan.section, paragraph, 0, doc.getParagraphLength(plan.section, paragraph)) !== text) throw new Error('표를 문자열로 바꾼 결과가 원문과 다릅니다.');
  });
  return { sectionIndex: plan.section, paragraphIndex: plan.paragraph + plan.texts.length - 1, charOffset: length(plan.texts.at(-1)!) };
}

/** Never mutate the live document while validating its export, conversion and reopen. */
export function preflightTableConversion(wasm: any, plan: TableConversionPlan): void {
  const { HwpDocument } = wasm.getWasmModuleExports(), open = (bytes: Uint8Array) => new HwpDocument(bytes);
  const kind = /\.hwpx$/iu.test(wasm.fileName) ? 'hwpx' : 'hwp';
  const checkedExport = (doc: any) => {
    const artifact = doc[kind === 'hwpx' ? 'exportHwpxWithReport' : 'exportHwpWithReport']();
    try { const loss = artifact.contentLoss(), bytes = artifact.takeBytes(); verifyPreservedExport(doc, bytes, kind, loss, open); return bytes; }
    finally { artifact.free(); }
  };
  let scratch: any;
  try {
    scratch = open(checkedExport(native(wasm)));
    // Storage IDs can be remapped by serialization. Rebuild the plan using the
    // scratch IDs; compare the user-visible strings before trying the mutation.
    const scratchPlan = plan.kind === 'text-to-table' ? readTextTablePlan(scratch, { anchor: { sectionIndex: plan.section, paragraphIndex: plan.first, charOffset: 0 }, focus: { sectionIndex: plan.section, paragraphIndex: plan.last, charOffset: scratch.getParagraphLength(plan.section, plan.last) } }, plan.separator)
      : readTableTextPlan(scratch, { sec: plan.section, ppi: plan.paragraph, ci: plan.control }, plan.separator);
    if (JSON.stringify(scratchPlan.rows) !== JSON.stringify(plan.rows)) throw new Error('사전 검사 사본의 문자열이 원문과 다릅니다.');
    executeTableConversion(scratch, scratchPlan); checkedExport(scratch);
  }
  finally { scratch?.free(); }
}
