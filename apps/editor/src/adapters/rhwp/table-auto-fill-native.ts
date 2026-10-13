import { planTableSeries, type TableSeries, type DateFillUnit } from '../../modules/document/public/table-auto-fill.ts';
import { verifyPreservedExport } from './preservation.ts';
type Point = { row: number; col: number };
export type AutoFillBlock = { sec: number; ppi: number; ci: number; cellPath?: unknown[]; anchor: Point; focus: Point; excluded?: unknown[] };
type SeriesCell = { index: number; row: number; column: number; text: string; charShape: number; paraShape: number; style: number };
export type AutoFillPlan = { section: number; paragraph: number; control: number; block: AutoFillBlock; cells: SeriesCell[]; dateUnit: DateFillUnit } & TableSeries;
const parsed = (v: any): any => typeof v === 'string' ? JSON.parse(v) : v;
const native = (wasm: any) => wasm.borrowDocumentHandle?.() ?? wasm;
const integer = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;
const checked = (v: any) => { if (!parsed(v)?.ok) throw new Error('문서 엔진이 자동 채우기를 거절했습니다.'); };

export function readAutoFillPlan(value: any, block: AutoFillBlock, dateUnit: DateFillUnit = 'days'): AutoFillPlan {
  const doc = native(value);
  if (!block || (block.cellPath?.length ?? 0) > 1 || block.excluded?.length) throw new Error('본문 표의 연속된 한 행 또는 한 열만 선택하세요.');
  const { sec: section, ppi: paragraph, ci: control } = block;
  if (![section, paragraph, control].every(integer) || section >= doc.getSectionCount() || paragraph >= doc.getParagraphCount(section)) throw new Error('표의 위치가 유효하지 않습니다.');
  const dims = parsed(doc.getTableDimensions(section, paragraph, control));
  if (![dims.rowCount, dims.colCount, dims.cellCount].every(v => integer(v) && v > 0) || dims.cellCount !== dims.rowCount * dims.colCount || dims.cellCount > 1000) throw new Error('병합 없는 1,000셀 이하 표에서 자동 채우기를 지원합니다.');
  const r0 = Math.min(block.anchor.row, block.focus.row), r1 = Math.max(block.anchor.row, block.focus.row), c0 = Math.min(block.anchor.col, block.focus.col), c1 = Math.max(block.anchor.col, block.focus.col);
  if (![r0, r1, c0, c1].every(integer) || r1 >= dims.rowCount || c1 >= dims.colCount || ((r0 !== r1) === (c0 !== c1))) throw new Error('한 행 또는 한 열의 셀을 3개 이상 선택하세요.');
  const controls = parsed(doc.getControls()), lists = parsed(doc.getCursorModel()).lists, cells: SeriesCell[] = [];
  for (let index = 0; index < dims.cellCount; index++) {
    const info = parsed(doc.getCellInfo(section, paragraph, control, index));
    if (info.rowSpan !== 1 || info.colSpan !== 1) throw new Error('병합된 셀이 있는 표는 아직 자동 채우기를 지원하지 않습니다.');
    if (info.row < r0 || info.row > r1 || info.col < c0 || info.col > c1) continue;
    const props = parsed(doc.getCellProperties(section, paragraph, control, index));
    const list = lists.find((l: any) => l.isCell && l.hostListId === 0 && l.sectionIndex === section && l.hostPara === paragraph && l.controlIndex === control && l.cellIndex === index);
    if (props.cellProtect || doc.getCellParagraphCount(section, paragraph, control, index) !== 1 || !list || controls.some((c: any) => c.list === list.listId)) throw new Error('보호·개체·필드·중첩 표·여러 문단 셀은 자동 채우기를 지원하지 않습니다.');
    const count = doc.getCellParagraphLength(section, paragraph, control, index, 0);
    if (!integer(count) || count > 4000) throw new Error('한 셀의 기존 글자는 4,000자 이하여야 합니다.');
    const runs = parsed(doc.getCharShapeRunsInCellByPath(section, paragraph, JSON.stringify([{ controlIndex: control, cellIndex: index, cellParaIndex: 0 }]), 0, count));
    if (new Set(runs.map((r: any) => r.charShapeId)).size > 1) throw new Error('혼합 글자 서식 셀은 자동 채우기를 지원하지 않습니다.');
    const charShape = parsed(doc.getCellCharPropertiesAt(section, paragraph, control, index, 0, 0)).charShapeId, para = parsed(doc.getCellParaPropertiesAt(section, paragraph, control, index, 0)), style = parsed(doc.getCellStyleAt(section, paragraph, control, index, 0)).id;
    if (![charShape, para.paraShapeId, style].every(integer) || para.headType !== 'None') throw new Error('셀의 원문 서식을 확인하지 못하거나 자동 번호가 있습니다.');
    cells.push({ index, row: info.row, column: info.col, text: doc.getTextInCell(section, paragraph, control, index, 0, 0, count), charShape, paraShape: para.paraShapeId, style });
  }
  cells.sort((a, b) => a.row - b.row || a.column - b.column);
  if (cells.length !== (r1 - r0 + 1) * (c1 - c0 + 1) || new Set(cells.map(c => `${c.row}:${c.column}`)).size !== cells.length) throw new Error('선택한 셀 범위가 유효하지 않습니다.');
  const series = planTableSeries(cells[0]?.text ?? '', cells[1]?.text ?? '', cells.length, dateUnit);
  return { section, paragraph, control, block: structuredClone(block), cells, ...series, dateUnit };
}

/** Must run inside the caller's snapshot router, which owns rollback and one undo. */
export function executeAutoFill(value: any, plan: AutoFillPlan): void {
  const doc = native(value), current = readAutoFillPlan(doc, plan.block, plan.dateUnit);
  if (JSON.stringify(current) !== JSON.stringify(plan)) throw new Error('셀 원문·서식 또는 표 범위가 바뀌었습니다. 자동 채우기를 다시 여세요.');
  plan.cells.slice(2).forEach((cell, index) => {
    const text = plan.values[index + 2]; if (text === cell.text) return;
    const args = [plan.section, plan.paragraph, plan.control, cell.index, 0], count = doc.getCellParagraphLength(...args);
    if (count) checked(doc.deleteTextInCell(...args, 0, count)); checked(doc.insertTextInCell(...args, 0, text)); checked(doc.setCharShapeIdInCell(...args, 0, Array.from(text).length, cell.charShape));
    if (doc.getTextInCell(...args, 0, doc.getCellParagraphLength(...args)) !== text
      || parsed(doc.getCellParaPropertiesAt(...args)).paraShapeId !== cell.paraShape || parsed(doc.getCellStyleAt(...args)).id !== cell.style) throw new Error('자동 채우기 결과나 셀 서식이 다릅니다.');
  });
}

export function preflightAutoFill(wasm: any, plan: AutoFillPlan): void {
  const { HwpDocument } = wasm.getWasmModuleExports(), open = (bytes: Uint8Array) => new HwpDocument(bytes), format = /\.hwpx$/iu.test(wasm.fileName) ? 'hwpx' : 'hwp';
  const save = (doc: any) => {
    const artifact = doc[format === 'hwpx' ? 'exportHwpxWithReport' : 'exportHwpWithReport']();
    try { const loss = artifact.contentLoss(), bytes = artifact.takeBytes(); verifyPreservedExport(doc, bytes, format, loss, open); return bytes; }
    finally { artifact.free(); }
  };
  let scratch: any;
  try { scratch = open(save(native(wasm))); const scratchPlan = readAutoFillPlan(scratch, plan.block, plan.dateUnit); if (JSON.stringify(scratchPlan.cells.map(c => c.text)) !== JSON.stringify(plan.cells.map(c => c.text))) throw new Error('사전 검사 사본의 셀이 원문과 다릅니다.'); executeAutoFill(scratch, scratchPlan); save(scratch); }
  finally { scratch?.free(); }
}
