import { tablePresetCell, type TablePresetId } from '../../modules/document/public/table-presets.ts';
import { preflightDocumentEdit } from './edit-preflight.ts';

export type PresetTarget = { sec: number; ppi: number; ci: number; cellPath?: unknown[] };
export type TablePresetPlan = { target: PresetTarget; id: TablePresetId; titleRow: boolean; cells: { index: number; info: any; properties: any; patch: any }[] };
const parse = (v: any): any => typeof v === 'string' ? JSON.parse(v) : v;
const native = (v: any) => v.borrowDocumentHandle?.() ?? v;
export function readTablePresetPlan(value: any, target: PresetTarget, id: TablePresetId, titleRow: boolean): TablePresetPlan {
  const doc = native(value);
  if (!target || target.cellPath?.length || ![target.sec, target.ppi, target.ci].every(v => Number.isSafeInteger(v) && v >= 0)) throw new Error('본문의 표 개체를 선택하세요.');
  const dims = parse(doc.getTableDimensions(target.sec, target.ppi, target.ci));
  if (!Number.isSafeInteger(dims.cellCount) || dims.cellCount < 1 || dims.cellCount > 1000) throw new Error('1,000셀 이하 표를 선택하세요.');
  const cells = Array.from({ length: dims.cellCount }, (_, index) => {
    const info = parse(doc.getCellInfo(target.sec, target.ppi, target.ci, index)), properties = parse(doc.getCellProperties(target.sec, target.ppi, target.ci, index));
    if (properties.cellProtect) throw new Error('보호된 셀이 있으면 표 모양을 적용할 수 없습니다.');
    if (![info.row, info.col, info.rowSpan, info.colSpan].every(v => Number.isSafeInteger(v) && v >= 0) || info.rowSpan < 1 || info.colSpan < 1 || info.row + info.rowSpan > dims.rowCount || info.col + info.colSpan > dims.colCount) throw new Error('셀 배치를 확인하지 못했습니다.');
    // A spanning cell cannot have different fills for each covered row. Keep the choice explicit.
    if (info.rowSpan !== 1) throw new Error('여러 행을 병합한 셀은 기본 표 모양을 지원하지 않습니다.');
    return { index, info, properties, patch: tablePresetCell(id, info.row, titleRow) };
  });
  return { target: structuredClone(target), id, titleRow, cells };
}
export function executeTablePreset(value: any, plan: TablePresetPlan): void {
  const doc = native(value), { sec, ppi, ci } = plan.target;
  if (JSON.stringify(readTablePresetPlan(doc, plan.target, plan.id, plan.titleRow)) !== JSON.stringify(plan)) throw new Error('표의 모양이나 셀 배치가 바뀌었습니다. 창을 다시 여세요.');
  for (const cell of plan.cells) {
    const keep = Object.fromEntries(['patternColor', 'diagonalLine', 'diagonalSlash', 'diagonalBackSlash', 'diagonalWidth', 'diagonalColor', 'centerLine'].map(key => [key, cell.properties[key]]));
    if (parse(doc.setCellProperties(sec, ppi, ci, cell.index, JSON.stringify({ ...keep, ...cell.patch })))?.ok !== true) throw new Error('표 모양을 적용하지 못했습니다.');
  }
  // Shared border-fill IDs may change; compare user-visible properties and all unrelated fields.
  for (const cell of plan.cells) {
    const actual = parse(doc.getCellProperties(sec, ppi, ci, cell.index));
    for (const [key, before] of Object.entries(cell.properties)) {
      if (key === 'borderFillId' || Object.hasOwn(cell.patch, key)) continue;
      if (JSON.stringify(actual[key]) !== JSON.stringify(before)) throw new Error(`표 모양 적용 중 다른 셀 속성(${key})이 바뀌었습니다.`);
    }
    for (const [key, expected] of Object.entries(cell.patch)) {
      if (key === 'patternType' && plan.id === 'clear') continue; // inactive fills have no brush pattern
      if (JSON.stringify(actual[key]) !== JSON.stringify(expected)) throw new Error(`표 모양 ${key} 적용 결과가 다릅니다.`);
    }
  }
}
export function preflightTablePreset(wasm: any, plan: TablePresetPlan): void {
  preflightDocumentEdit(wasm, scratch => executeTablePreset(scratch, readTablePresetPlan(scratch, plan.target, plan.id, plan.titleRow)));
}
