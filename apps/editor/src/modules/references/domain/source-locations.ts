import type {SourceAddress,SourceLocation} from '../public/contracts.ts';

export const MAX_SOURCE_LOCATIONS = 160;
const index = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const validCell = (cell: unknown) => record(cell)&&[cell.controlIndex,cell.cellIndex,cell.cellParagraph,cell.row,cell.column].every(index);

export function validSourceLocations(locations: unknown, characters: number): boolean {
  if (!Array.isArray(locations) || locations.length > MAX_SOURCE_LOCATIONS) return false;
  let previousEnd = 0;
  for (const place of locations) {
    if (!record(place)||!index(place.start)||!index(place.end)||place.start<previousEnd||place.end<=place.start||place.end>characters||!record(place.address)) return false;
    previousEnd = place.end;
    const address = place.address;
    if (address.kind === 'xlsx') {
      if (typeof address.sheet!=='string'||!address.sheet.length||address.sheet.length>128||
          typeof address.cell!=='string'||!(/^[A-Z]{1,3}[1-9][0-9]{0,6}$/u.test(address.cell))) return false;
    } else if (address.kind === 'pdf') {
      if (!index(address.page)||address.page<1||address.page>200||typeof address.ocr!=='boolean') return false;
    } else if (address.kind === 'docx') {
      if (!index(address.paragraph)||address.paragraph<1||address.paragraph>60_000) return false;
    } else if (address.kind === 'hwp') {
      if (![address.section,address.paragraph,address.offset].every(index)) return false;
      const cell = address.cell;
      if (cell!==undefined&&!validCell(cell)) return false;
      const ancestors = address.ancestors;
      if (ancestors!==undefined&&(!cell||!Array.isArray(ancestors)||!ancestors.length||ancestors.length>7||!ancestors.every(validCell))) return false;
    } else return false;
  }
  return true;
}

export function describeSourceAddress(address: SourceAddress): string {
  if (address.kind === 'xlsx') return `${address.sheet} · ${address.cell}`;
  if (address.kind === 'pdf') return `PDF ${address.page}쪽${address.ocr?' · OCR':''}`;
  if (address.kind === 'docx') return `Word 본문 ${address.paragraph}문단`;
  const body = `${address.section + 1}구역 ${address.paragraph + 1}문단`;
  const cell = address.cell;
  if (cell&&address.ancestors?.length) {
    const steps=[...address.ancestors,cell].map(step=>`표 ${step.controlIndex + 1}번 개체 ${step.row + 1}행 ${step.column + 1}열`);
    return `${body} · ${steps.join(' → 중첩 ')} · 셀 문단 ${cell.cellParagraph + 1}`;
  }
  return cell
    ? `${body} · 표 ${cell.controlIndex + 1}번 개체, ${cell.row + 1}행 ${cell.column + 1}열, 셀 문단 ${cell.cellParagraph + 1}`
    : body;
}

export function parseOfficeTextQuery(query: string) {
  const page = /^pdf\s+([1-9][0-9]{0,2})\s*쪽$/iu.exec(query);
  if (page) return {kind:'pdf' as const, page:Number(page[1])};
  const paragraph = /^(?:word|docx)\s+(?:본문\s+)?([1-9][0-9]{0,4})\s*(?:번째\s+)?문단$/iu.exec(query);
  if (paragraph) return {kind:'docx' as const, paragraph:Number(paragraph[1])};
}

export function findSpreadsheetLocation(locations: SourceLocation[] | undefined, query: string): SourceLocation | undefined {
  const normalized = query.normalize('NFKC').toLowerCase();
  const cells = new Set(normalized.match(/(?<![a-z0-9])[a-z]{1,3}[1-9][0-9]{0,6}(?![a-z0-9])/gu));
  if (cells.size !== 1 || !locations?.length) return;
  const spreadsheet = locations.filter(place=>place.address.kind==='xlsx');
  const namedSheets = new Set(spreadsheet.flatMap(({address})=>
    address.kind==='xlsx'&&normalized.includes(address.sheet.normalize('NFKC').toLowerCase())?[address.sheet]:[]));
  const matches = spreadsheet.filter(({address})=>address.kind==='xlsx'&&cells.has(address.cell.toLowerCase())&&
    (namedSheets.size===0||namedSheets.has(address.sheet)));
  if (matches.length===1) return matches[0];
}

/** Region offsets are relative to the source text presented with them. Only return complete regions. */
export function sourceLocationsInRange(locations: SourceLocation[] | undefined, start: number, end: number): SourceLocation[] | undefined {
  const visible = locations?.filter(place=>place.start>=start && place.end<=end);
  if (!visible?.length) return undefined;
  return start ? visible.map(place=>({...place,start:place.start-start,end:place.end-start})) : visible;
}
