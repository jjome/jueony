import { tablePresetCell, type TablePresetId } from '../../modules/document/public/table-presets.ts';
import { preflightDocumentEdit } from './edit-preflight.ts';

type PresetBlock = { anchor: { row: number; col: number }; focus: { row: number; col: number }; excluded?: unknown[]; cellPath?: { controlIndex: number }[] };
export type PresetTarget = { sec: number; ppi: number; ci: number; cellPath?: unknown[]; block?: PresetBlock };
export type TablePresetPlan = { target: PresetTarget; id: TablePresetId; titleRow: boolean; cells: { index: number; info: any; properties: any; patch: any }[]; unselected: { index: number; properties: any }[] };
const parse = (v: any): any => typeof v === 'string' ? JSON.parse(v) : v;
const native = (v: any) => v.borrowDocumentHandle?.() ?? v;
export function readTablePresetPlan(value: any, target: PresetTarget, id: TablePresetId, titleRow: boolean): TablePresetPlan {
  const doc = native(value);
  if (!target || target.cellPath?.length || ![target.sec, target.ppi, target.ci].every(v => Number.isSafeInteger(v) && v >= 0)) throw new Error('본문의 표 개체를 선택하세요.');
  const dims = parse(doc.getTableDimensions(target.sec, target.ppi, target.ci));
  if (!Number.isSafeInteger(dims.cellCount) || dims.cellCount < 1 || dims.cellCount > 1000) throw new Error('1,000셀 이하 표를 선택하세요.');
  const block = target.block;
  let area: { r0: number; r1: number; c0: number; c1: number } | undefined;
  if (block) {
    if (!block.anchor || !block.focus || block.excluded?.length || (block.cellPath?.length ?? 0) > 1 || block.cellPath?.length && block.cellPath[0].controlIndex !== target.ci) throw new Error('본문 표의 연속된 직사각형 셀 영역을 선택하세요.');
    const r0 = Math.min(block.anchor.row, block.focus.row), r1 = Math.max(block.anchor.row, block.focus.row), c0 = Math.min(block.anchor.col, block.focus.col), c1 = Math.max(block.anchor.col, block.focus.col);
    if (![r0, r1, c0, c1].every(v => Number.isSafeInteger(v) && v >= 0) || r1 >= dims.rowCount || c1 >= dims.colCount || (r1 - r0 + 1) * (c1 - c0 + 1) > 100000) throw new Error('선택한 셀 영역이 유효하지 않거나 너무 큽니다.');
    area = { r0, r1, c0, c1 };
  }
  const unselected: TablePresetPlan['unselected'] = [], covered = new Set<number>();
  const cells = Array.from({ length: dims.cellCount }, (_, index) => {
    const info = parse(doc.getCellInfo(target.sec, target.ppi, target.ci, index)), properties = parse(doc.getCellProperties(target.sec, target.ppi, target.ci, index));
    if (![info.row, info.col, info.rowSpan, info.colSpan].every(v => Number.isSafeInteger(v) && v >= 0) || info.rowSpan < 1 || info.colSpan < 1 || info.row + info.rowSpan > dims.rowCount || info.col + info.colSpan > dims.colCount) throw new Error('셀 배치를 확인하지 못했습니다.');
    if (area) {
      const bottom = info.row + info.rowSpan - 1, right = info.col + info.colSpan - 1;
      if (bottom < area.r0 || info.row > area.r1 || right < area.c0 || info.col > area.c1) { unselected.push({ index, properties }); return null; }
      if (info.row < area.r0 || bottom > area.r1 || info.col < area.c0 || right > area.c1) throw new Error('병합 셀 전체를 포함하도록 셀 영역을 선택하세요.');
      for (let r = info.row; r <= bottom; r++) for (let c = info.col; c <= right; c++) { const key = r * dims.colCount + c; if (covered.has(key)) throw new Error('선택한 셀 영역이 겹칩니다.'); covered.add(key); }
    }
    if (properties.cellProtect) throw new Error('선택 영역에 보호된 셀이 있으면 표 모양을 적용할 수 없습니다.');
    // A merged cell uses the color of its first selected row, shown in the dialog.
    const patch = tablePresetCell(id, info.row - (area?.r0 ?? 0), titleRow);
    // The engine synchronizes opposite cell edges. Retain outer selection edges
    // so applying a preset cannot repaint an unselected neighbor's border.
    if (area) {
      if (info.row === area.r0) patch.borderTop = structuredClone(properties.borderTop);
      if (info.row + info.rowSpan - 1 === area.r1) patch.borderBottom = structuredClone(properties.borderBottom);
      if (info.col === area.c0) patch.borderLeft = structuredClone(properties.borderLeft);
      if (info.col + info.colSpan - 1 === area.c1) patch.borderRight = structuredClone(properties.borderRight);
    }
    return { index, info, properties, patch };
  }).filter((cell): cell is NonNullable<typeof cell> => cell !== null);
  if (!cells.length || area && covered.size !== (area.r1 - area.r0 + 1) * (area.c1 - area.c0 + 1)) throw new Error('선택한 셀 범위가 비어 있거나 완전하지 않습니다.');
  return { target: structuredClone(target), id, titleRow, cells, unselected };
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
  const visible = (props: any) => Object.fromEntries(Object.entries(props).filter(([key]) => key !== 'borderFillId'));
  for (const cell of plan.unselected) {
    const actual = visible(parse(doc.getCellProperties(sec, ppi, ci, cell.index))), before = visible(cell.properties);
    const changed = Object.keys(before).filter(key => JSON.stringify(actual[key]) !== JSON.stringify(before[key]));
    if (changed.length) throw new Error(`표 모양 적용 중 선택하지 않은 셀의 속성(${changed.join(', ')})이 바뀌었습니다.`);
  }
}
export function preflightTablePreset(wasm: any, plan: TablePresetPlan): void {
  preflightDocumentEdit(wasm, scratch => executeTablePreset(scratch, readTablePresetPlan(scratch, plan.target, plan.id, plan.titleRow)));
}
