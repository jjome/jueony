import { nativeDocument, parsed, readStructure } from './structure.ts';
import type { Table } from './structure.ts';
import type { Snapshot } from '../mvp/model.ts';
export type ControlOp =
  | { kind: 'format_characters' | 'format_paragraph'; target: string; properties: Record<string, any> }
  | { kind: 'create_table'; after: string; resultId: string; rows: string[][] }
  | { kind: 'set_table_cell'; target: string; row: number; column: number; originalText: string; text: string }
  | { kind: 'format_table_cells'; target: string; startRow: number; rowCount: number; startColumn: number; columnCount: number; properties: Record<string, any> }
  | { kind: 'set_page_setup'; section: number; properties: Record<string, any> };
export const controlKinds = ['format_characters', 'format_paragraph', 'create_table', 'set_table_cell', 'format_table_cells', 'set_page_setup'];
const fail = (m: string): never => { throw new Error(m); };
const object = (v: any) => { if (!v || typeof v !== 'object' || Array.isArray(v)) fail('명령 객체가 필요합니다.'); return v; };
const only = (v: any, fields: string[]) => { if (Object.keys(object(v)).some(k => !fields.includes(k))) fail('지원하지 않는 명령 속성입니다.'); };
const integer = (v: any, min: number, max: number) => { if (!Number.isSafeInteger(v) || v < min || v > max) fail('대상 범위가 잘못되었습니다.'); return v as number; };
const text = (v: any) => { if (typeof v !== 'string' || Array.from(v).length > 4000 || /[\u0000-\u001f\u007f]/u.test(v)) fail('셀은 제어문자 없이 4,000자 이내여야 합니다.'); return v as string; };
const mm = (v: number) => Math.round(v * 7200 / 25.4);
const charRules: Record<string, any> = { bold: 'boolean', italic: 'boolean', underline: 'boolean', strikethrough: 'boolean', fontSizePt: [1, 200], color: 'color' };
const paraRules: Record<string, any> = { alignment: ['left', 'right', 'center', 'justify', 'distribute'], lineSpacingPercent: [50, 500], marginLeftMm: [0, 100], marginRightMm: [0, 100], indentMm: [-100, 100], beforeMm: [0, 100], afterMm: [0, 100], keepWithNext: 'boolean', keepLines: 'boolean', pageBreakBefore: 'boolean' };
const cellRules = { bold: 'boolean', fontSizePt: [1, 200], color: 'color', background: 'color', alignment: paraRules.alignment, verticalAlignment: ['top', 'center', 'bottom'] };
const pageRules: Record<string, any> = { widthMm: [20, 1000], heightMm: [20, 1000], landscape: 'boolean', marginLeftMm: [0, 300], marginRightMm: [0, 300], marginTopMm: [0, 300], marginBottomMm: [0, 300], marginHeaderMm: [0, 100], marginFooterMm: [0, 100] };
function properties(v: any, rules: Record<string, any>) {
  only(v, Object.keys(rules)); if (!Object.keys(v).length) fail('변경할 속성이 없습니다.');
  for (const [key, value] of Object.entries(v)) {
    const rule = rules[key];
    if (rule === 'boolean' ? typeof value !== 'boolean' : rule === 'color' ? typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value) : typeof rule[0] === 'number' ? typeof value !== 'number' || !Number.isFinite(value) || value < rule[0] || value > rule[1] : !rule.includes(value)) fail('속성 값이 잘못되었습니다: ' + key);
  }
  return v;
}
export function pageProperties(current: any, props: any) {
  const next = { ...current };
  for (const [k, v] of Object.entries(props)) next[k.endsWith('Mm') ? k.slice(0, -2) : k] = k.endsWith('Mm') ? mm(v as number) : v;
  // setPageDef stores unrotated paper dimensions; layout rotates on landscape.
  const width = next.landscape ? next.height : next.width, height = next.landscape ? next.width : next.height;
  if (width - next.marginLeft - next.marginRight < mm(10) || height - next.marginTop - next.marginBottom < mm(10)) fail('여백이 용지의 본문 영역을 벗어납니다.');
  return next;
}
export function validateControlOperations(operations: any[], snapshot: Snapshot): ControlOp[] {
  const structure = snapshot.structure; if (!structure) fail('이 문서는 구조 조회 후 편집해야 합니다.');
  const tables = new Map(structure!.tables.map(t => [t.id, structuredClone(t)]));
  const pages = new Map(structure!.sections.map(s => [s.index, s.page]));
  const created = new Set<string>(); let generated = 0;
  const body = (id: any) => { const n = snapshot.nodes.find(n => n.id === id); if (!n?.editable) fail('편집 가능한 본문 문단 ID가 필요합니다.'); return n!; };
  for (const op of operations) {
    if (op.kind === 'format_characters' || op.kind === 'format_paragraph') {
      only(op, ['kind', 'target', 'properties']); const n = body(op.target);
      if (op.kind === 'format_characters' && !n.text) fail('빈 문단에는 글자 서식을 적용할 수 없습니다.');
      properties(op.properties, op.kind === 'format_characters' ? charRules : paraRules);
    } else if (op.kind === 'set_page_setup') {
      only(op, ['kind', 'section', 'properties']); integer(op.section, 0, structure!.sections.length - 1);
      properties(op.properties, pageRules); pages.set(op.section, pageProperties(pages.get(op.section), op.properties));
    } else if (op.kind === 'create_table') {
      only(op, ['kind', 'after', 'resultId', 'rows']); body(op.after);
      if (typeof op.resultId !== 'string' || !/^[A-Za-z][\w-]{0,39}$/.test(op.resultId) || created.has(op.resultId)) fail('새 표의 resultId는 중복되지 않는 영문 ID여야 합니다.');
      if (!Array.isArray(op.rows)) fail('표 데이터가 필요합니다.'); integer(op.rows.length, 1, 50);
      if (!Array.isArray(op.rows[0])) fail('표의 열이 필요합니다.'); const columns = integer(op.rows[0].length, 1, 20);
      if (op.rows.length * columns > 200) fail('한 번에 만드는 표는 200셀 이내입니다.');
      const cells: Table['cells'] = [];
      op.rows.forEach((row: any, r: number) => { if (!Array.isArray(row) || row.length !== columns) fail('표의 열 개수가 다릅니다.'); row.forEach((value: any, c: number) => { generated += text(value).length; cells.push({ index: r * columns + c, row: r, column: c, rowSpan: 1, columnSpan: 1, text: value, editable: true, properties: {} }); }); });
      created.add(op.resultId); tables.set('@' + op.resultId, { id: '@' + op.resultId, section: 0, paragraph: 0, control: 0, rows: op.rows.length, columns, cells });
    } else if (op.kind === 'set_table_cell' || op.kind === 'format_table_cells') {
      const table = tables.get(op.target); if (!table) fail('현재 문서 또는 이번 요청에서 만든 표 ID가 필요합니다.');
      if (op.kind === 'set_table_cell') {
        only(op, ['kind', 'target', 'row', 'column', 'originalText', 'text']);
        integer(op.row, 0, table!.rows - 1); integer(op.column, 0, table!.columns - 1);
        const cell = table!.cells.find(c => c.row === op.row && c.column === op.column);
        if (!cell?.editable || cell.rowSpan !== 1 || cell.columnSpan !== 1 || cell.text !== op.originalText) fail('셀 원문이 다르거나 복잡한 셀입니다.');
        generated += text(op.text).length; cell!.text = op.text;
      } else {
        only(op, ['kind', 'target', 'startRow', 'rowCount', 'startColumn', 'columnCount', 'properties']);
        integer(op.startRow, 0, table!.rows - 1); integer(op.rowCount, 1, table!.rows - op.startRow); integer(op.startColumn, 0, table!.columns - 1); integer(op.columnCount, 1, table!.columns - op.startColumn);
        properties(op.properties, cellRules);
        const cells = selectedCells(table!, op);
        if (cells.length !== op.rowCount * op.columnCount || cells.some(c => !c.editable || c.rowSpan !== 1 || c.columnSpan !== 1)) fail('병합 셀 또는 복잡한 셀 서식은 아직 지원하지 않습니다.');
        if (Object.keys(op.properties).some(k => k in charRules) && cells.some(c => !c.text)) fail('빈 셀의 글자 서식은 텍스트 입력 후 적용하세요.');
      }
    } else fail('지원하지 않는 구조 편집 명령입니다.');
  }
  if (generated > 60000) fail('생성하는 표 텍스트는 60,000자 이내입니다.');
  return operations;
}
const checked = (value: any) => { const result = parsed(value); if (result?.ok === false) fail('문서 엔진이 편집 명령을 거절했습니다.'); return result; };
const selectedCells = (table: Table, op: any) => table.cells.filter(c => c.row >= op.startRow && c.row < op.startRow + op.rowCount && c.column >= op.startColumn && c.column < op.startColumn + op.columnCount);
const charProperties = (props: any) => Object.fromEntries(Object.entries(props).filter(([k]) => k in charRules).map(([k, v]) => [k === 'fontSizePt' ? 'fontSize' : k === 'color' ? 'textColor' : k, k === 'fontSizePt' ? Math.round((v as number) * 100) : v]));
export function executeControlOperation(wasm: any, snapshot: Snapshot, op: ControlOp, tables: Map<string, Table>): { section: number; after: number; count: number } | undefined {
  const doc = nativeDocument(wasm);
  if (op.kind === 'set_page_setup') { checked(doc.setPageDef(op.section, JSON.stringify(pageProperties(parsed(doc.getPageDef(op.section)), op.properties)))); return; }
  if (op.kind === 'format_characters' || op.kind === 'format_paragraph') {
    const n = snapshot.nodes.find(n => n.id === op.target)!;
    if (op.kind === 'format_characters') checked(doc.applyCharFormat(n.section, n.paragraph, 0, doc.getParagraphLength(n.section, n.paragraph), JSON.stringify(charProperties(op.properties))));
    else {
      const p: any = {}; for (const [k, v] of Object.entries(op.properties)) {
        const key = ({ lineSpacingPercent: 'lineSpacing', beforeMm: 'spacingBefore', afterMm: 'spacingAfter' } as any)[k] ?? (k.endsWith('Mm') ? k.slice(0, -2) : k);
        p[key] = k.endsWith('Mm') ? mm(v) : v;
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
    checked(doc.replaceTextInCellDeferredPagination(...base, cell.index, 0, 0, length, op.text));
    if (doc.getTextInCell(...base, cell.index, 0, 0, doc.getCellParagraphLength(...base, cell.index, 0)) !== op.text) fail('셀 편집 결과가 다릅니다.');
    cell.text = op.text;
  } else for (const cell of selectedCells(table, op)) {
    const p = op.properties, chars = charProperties(p), length = doc.getCellParagraphLength(...base, cell.index, 0);
    if (Object.keys(chars).length && length) checked(doc.applyCharFormatInCell(...base, cell.index, 0, 0, length, JSON.stringify(chars)));
    if (p.alignment) checked(doc.applyParaFormatInCell(...base, cell.index, 0, JSON.stringify({ alignment: p.alignment })));
    const cp: any = {};
    if (p.background) Object.assign(cp, { fillType: 'solid', fillColor: p.background });
    if (p.verticalAlignment) cp.verticalAlign = ['top', 'center', 'bottom'].indexOf(p.verticalAlignment);
    if (Object.keys(cp).length) checked(doc.setCellProperties(...base, cell.index, JSON.stringify(cp)));
  }
}
