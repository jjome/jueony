import type { ExtractedOfficeReference } from './office-reference.ts';
import { MAX_SOURCE_LOCATIONS, type SourceLocation, type SpreadsheetReferenceAddress } from '../../modules/references/public/index.ts';

const MAX_SHEETS = 30;
const MAX_CELLS = 30_000;
const MAX_CHARACTERS = 120_000;
const MAX_METADATA = 512 * 1024;
const MAX_DATA = 8 * 1024 * 1024;
const spreadsheetNamespaces = new Set([
  'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
  'http://purl.oclc.org/ooxml/spreadsheetml/main',
]);
const relationshipNamespaces = new Set([
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  'http://purl.oclc.org/ooxml/officeDocument/relationships',
]);
const packageNamespace = 'http://schemas.openxmlformats.org/package/2006/relationships';
const workbookPath = 'xl/workbook.xml';
const relationshipsPath = 'xl/_rels/workbook.xml.rels';
const stringsPath = 'xl/sharedStrings.xml';
const sheetPath = /^xl\/worksheets\/[a-z0-9_.-]+\.xml$/iu;
const invalid = () => new Error('Excel 참고 자료가 손상되었거나 지원하지 않는 형식입니다.');

function children(parent: Element, name: string): Element[] {
  return [...parent.children].filter(child => child.localName === name && child.namespaceURI === parent.namespaceURI);
}

function openXml(bytes: Uint8Array | undefined, name: string, namespaces: ReadonlySet<string>): Element {
  if (!bytes) throw invalid();
  let source: string;
  try { source = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { throw invalid(); }
  if (/<!DOCTYPE|<!ENTITY/iu.test(source)) throw invalid();
  const root = new DOMParser().parseFromString(source, 'application/xml').documentElement;
  if (root.localName !== name || !namespaces.has(root.namespaceURI ?? '')) throw invalid();
  return root;
}

function stringValue(item: Element): string {
  return [...item.children].map(child => {
    if (child.namespaceURI !== item.namespaceURI) return '';
    if (child.localName === 't') return child.textContent ?? '';
    if (child.localName === 'r') return children(child, 't').map(text => text.textContent ?? '').join('');
    return '';
  }).join('');
}

function columnName(index: number): string {
  let value = '';
  for (let column = index; column > 0; column = Math.floor((column - 1) / 26)) {
    value = String.fromCharCode(65 + (column - 1) % 26) + value;
  }
  return value;
}

function columnNumber(name: string): number {
  return [...name].reduce((column, letter) => column * 26 + letter.charCodeAt(0) - 64, 0);
}

export async function extractSpreadsheetReference(bytes: Uint8Array, signal: AbortSignal): Promise<ExtractedOfficeReference> {
  signal.throwIfAborted();
  const { unzipSync } = await import('fflate');
  let metadata: Record<string, Uint8Array>;
  try {
    metadata = unzipSync(bytes, { filter(entry) {
      if (entry.name !== workbookPath && entry.name !== relationshipsPath) return false;
      if (entry.originalSize > MAX_METADATA) throw invalid();
      return true;
    } });
  } catch { throw invalid(); }
  const workbook = openXml(metadata[workbookPath], 'workbook', spreadsheetNamespaces);
  const list = children(workbook, 'sheets')[0];
  if (!list) throw invalid();
  const sheets = children(list, 'sheet');
  if (sheets.length > MAX_SHEETS) throw new Error(`Excel 참고 자료는 시트 ${MAX_SHEETS}개까지 읽을 수 있습니다.`);
  const relationships = openXml(metadata[relationshipsPath], 'Relationships', new Set([packageNamespace]));
  const byId = new Map<string, string>();
  for (const entry of children(relationships, 'Relationship')) {
    const id = entry.getAttribute('Id'), target = entry.getAttribute('Target');
    const type = entry.getAttribute('Type')?.split('/').at(-1);
    if (!id || !target || type !== 'worksheet' || entry.hasAttribute('TargetMode')) continue;
    const path = target.startsWith('/') ? target.slice(1) : `xl/${target}`;
    if (!sheetPath.test(path) || path.includes('..') || byId.has(id)) throw invalid();
    byId.set(id, path);
  }
  const locations = sheets.map(sheet => {
    const id = [...relationshipNamespaces].map(ns => sheet.getAttributeNS(ns, 'id')).find(Boolean);
    return {name: sheet.getAttribute('name') ?? '', path: id ? byId.get(id) : undefined,
      hidden: ['hidden', 'veryHidden'].includes(sheet.getAttribute('state') ?? '')};
  });
  const visibleNames=locations.filter(sheet=>!sheet.hidden&&sheet.path).map(({name})=>name.normalize('NFC').toLowerCase());
  if(visibleNames.some(name=>!name.trim()||name.length>128)||new Set(visibleNames).size!==visibleNames.length)throw invalid();
  const desired = new Set(locations.flatMap(sheet => !sheet.hidden && sheet.path ? [sheet.path] : []));
  desired.add(stringsPath);
  let data: Record<string, Uint8Array>;
  try {
    let size = 0;
    data = unzipSync(bytes, { filter(entry) {
      if (!desired.has(entry.name)) return false;
      size += entry.originalSize;
      if (size > MAX_DATA) throw new RangeError();
      return true;
    } });
  } catch (error) {
    if (error instanceof RangeError) throw new Error('Excel 시트와 공유 문자열 XML 합계가 8MB를 넘습니다.');
    throw invalid();
  }
  const shared = data[stringsPath]
    ? children(openXml(data[stringsPath], 'sst', spreadsheetNamespaces), 'si').map(stringValue) : [];
  const lines: string[] = [];
  const sourceLocations: SourceLocation[] = [];
  let characters = 0;
  let usedCells = 0;
  let formulasWithoutValues = 0;
  let omittedSheets = 0;
  function append(line: string) {
    characters += line.length + 1;
    if (characters > MAX_CHARACTERS) throw new Error('Excel 참고 자료의 추출문이 120,000자를 넘습니다.');
    lines.push(line);
  }
  for (const {name, path, hidden} of locations) {
    signal.throwIfAborted();
    if (!path || hidden) { omittedSheets++; continue; }
    const worksheet = openXml(data[path], 'worksheet', spreadsheetNamespaces);
    const rows = children(worksheet, 'sheetData')[0];
    if (!rows) continue;
    let header = false;
    let previousRow = 0;
    for (const row of children(rows, 'row')) {
      signal.throwIfAborted();
      const number = row.hasAttribute('r') ? Number(row.getAttribute('r')) : previousRow + 1;
      if (!Number.isSafeInteger(number) || number <= previousRow || number > 1_048_576) throw invalid();
      previousRow = number;
      let column = 0;
      const entries: {address:string;text:string}[] = [];
      for (const cell of children(row, 'c')) {
        if (++usedCells > MAX_CELLS) throw new Error(`Excel 참고 자료는 실제 셀 ${MAX_CELLS}개까지 읽을 수 있습니다.`);
        const address = cell.getAttribute('r');
        const parsed = address?.match(/^([A-Z]{1,3})([1-9][0-9]{0,6})$/u);
        const next = parsed ? columnNumber(parsed[1]) : column + 1;
        if ((address && (!parsed || Number(parsed[2]) !== number)) || next <= column || next > 16_384) throw invalid();
        column = next;
        const type = cell.getAttribute('t');
        const stored = children(cell, 'v')[0]?.textContent ?? '';
        let value = stored;
        if (type === 's') {
          if (!/^\d{1,8}$/u.test(stored) || shared[Number(stored)] === undefined) throw invalid();
          value = shared[Number(stored)];
        } else if (type === 'inlineStr') {
          const inline = children(cell, 'is')[0];
          value = inline ? stringValue(inline) : '';
        } else if (type === 'b') value = stored === '1' ? 'TRUE' : stored === '0' ? 'FALSE' : '';
        if (!value && children(cell, 'f').length) formulasWithoutValues++;
        if (value.trim()) {
          const location = `${columnName(column)}${number}`;
          entries.push({address:location,text:`${location}=${value.replace(/[\r\n\t]/gu,' ')}`});
        }
      }
      if (entries.length) {
        if (!header) { append(`[Excel ${name}]`); header = true; }
        let start = characters;
        for (const entry of entries) {
          if (sourceLocations.length === MAX_SOURCE_LOCATIONS) break;
          const end = start + entry.text.length;
          sourceLocations.push({start,end,address:{kind:'xlsx',sheet:name,cell:entry.address}});
          start = end + 1;
        }
        append(entries.map(entry=>entry.text).join('\t'));
      }
    }
  }
  if (!lines.length) throw new Error('Excel 파일에서 읽을 수 있는 셀 값이 없습니다.');
  return {
    text: lines.join('\n'),
    locations: sourceLocations,
    limitation: 'Excel의 표시 가능한 시트와 셀 주소, 저장된 값만 추출했습니다. 숫자 서식·차트·매크로·수식 계산은 제외됩니다.'
      + (omittedSheets ? ` 숨겨졌거나 셀 형식이 아닌 시트 ${omittedSheets}개를 건너뛰었습니다.` : '')
      + (sourceLocations.length === MAX_SOURCE_LOCATIONS ? ' 앞쪽 근거 위치를 최대 160개 표시합니다.' : '')
      + (formulasWithoutValues ? ` 저장된 결과가 없는 수식 ${formulasWithoutValues}개를 건너뛰었습니다.` : ''),
  };
}

export async function readSpreadsheetCitation(bytes:Uint8Array,address:SpreadsheetReferenceAddress):Promise<string> {
  const {text,locations}=await extractSpreadsheetReference(bytes,new AbortController().signal);
  const matches=locations?.filter(({address:place})=>place.kind==='xlsx'&&place.sheet===address.sheet&&place.cell===address.cell);
  if(matches?.length!==1)throw new Error('인용한 Excel 시트와 셀의 저장 값을 확인할 수 없습니다.');
  const {start,end}=matches[0],entry=text.slice(start,end),prefix=address.cell+'=';
  if(!entry.startsWith(prefix))throw new Error('인용한 Excel 셀의 주소와 저장 값이 일치하지 않습니다.');
  return entry.slice(prefix.length);
}
