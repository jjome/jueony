import { extractPdfReference, openWordMainDocument } from './office-reference.ts';

export type OfficeBlock = { kind: 'paragraph'; text: string } | { kind: 'table'; cells: string[][] };
export type OfficeCopy = { blocks: OfficeBlock[]; losses: string[] };
const MAX_BLOCKS = 500;
const MAX_CELLS = 1500;
const MAX_CHARACTERS = 60_000;

export function requireCopyBudget(blocks: OfficeBlock[]) {
  let cells = 0;
  let characters = 0;
  for (const block of blocks) {
    if (block.kind === 'paragraph') characters += block.text.length;
    else {
      for (const row of block.cells) for (const cell of row) { cells++; characters += cell.length; }
    }
  }
  if (!characters) throw new Error('사본으로 옮길 텍스트가 없습니다.');
  if (blocks.length > MAX_BLOCKS || cells > MAX_CELLS || characters > MAX_CHARACTERS) {
    throw new Error('변환은 본문 블록 500개, 표 셀 1,500개, 텍스트 60,000자까지 지원합니다.');
  }
}

export async function readOfficeCopy(file: File, signal: AbortSignal, usePdfOcr = false): Promise<OfficeCopy> {
  if (!file.size || file.size > 16 * 1024 * 1024) throw new Error('변환할 원본은 16MB 이하의 파일이어야 합니다.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  signal.throwIfAborted();
  if (/\.pdf$/iu.test(file.name)) {
    const extracted = await extractPdfReference(bytes, signal, usePdfOcr);
    const blocks = extracted.text.split(/\r?\n/u).filter(line => line.trim() && !/^\[PDF \d+쪽(?: OCR)?\]$/u.test(line))
      .map((text): OfficeBlock => ({kind:'paragraph',text}));
    requireCopyBudget(blocks);
    return {blocks, losses:[extracted.limitation,'PDF의 쪽 구성, 표 구조, 이미지와 글자 서식은 옮기지 않습니다. 읽힌 줄을 한글 본문 문단으로 만듭니다.']};
  }
  if (!/\.docx$/iu.test(file.name)) throw new Error('변환할 Word(.docx) 또는 PDF 파일을 선택하세요.');
  const {body,parts} = await openWordMainDocument(bytes, signal);
  const losses = new Set(['글꼴, 스타일, 셀 여백과 쪽 설정을 한글 사본의 기본값으로 재구성합니다.']);
  const blocks: OfficeBlock[] = [];
  const ns = body.namespaceURI;
  const elements = (node: Element) => [...node.children].filter(child => child.namespaceURI === ns);
  const named = (node: Element, name: string) => elements(node).filter(child => child.localName === name);
  let inspected = 0;

  function visit(node: Element, depth: number) {
    signal.throwIfAborted();
    if (++inspected > 40_000 || depth > 70) throw new Error('Word 문서의 구조가 변환 한도를 넘습니다.');
    switch (node.localName) {
      case 'drawing': case 'pict': case 'object': case 'txbxContent':
        losses.add('그림, 개체와 글상자 내용을 제외했습니다.'); return false;
      case 'del': case 'moveFrom':
        losses.add('삭제된 변경 사항과 변경 이력은 제외했습니다.'); return false;
      case 'altChunk':
        losses.add('별도로 삽입된 외부 문서 블록은 제외했습니다.'); return false;
      case 'footnoteReference': case 'endnoteReference':
        losses.add('각주·미주 내용과 연결을 제외했습니다.'); return false;
      case 'fldSimple': case 'fldChar': case 'instrText': case 'hyperlink':
        losses.add('필드와 연결은 현재 표시된 텍스트만 유지합니다.');
        return node.localName !== 'instrText';
      default: return true;
    }
  }

  function text(node: Element, depth: number): string {
    if (!visit(node, depth)) return '';
    if (node.localName === 't') return node.textContent ?? '';
    if (node.localName === 'tab') return ' ';
    if (node.localName === 'br' || node.localName === 'cr') return '\n';
    const joined = elements(node).map(child => text(child, depth + 1)).join('');
    return node.localName === 'p' ? joined + '\n' : joined;
  }

  function table(node: Element, depth: number) {
    const rows = named(node, 'tr');
    const packed = rows.map(row => named(row, 'tc'));
    const complex = rows.length !== elements(node).filter(child => child.localName !== 'tblPr' && child.localName !== 'tblGrid').length
      || rows.length > 50 || !packed[0]?.length || packed[0].length > 20
      || [...node.getElementsByTagNameNS(ns,'tbl')].length > 0
      || ['gridSpan','hMerge','vMerge','gridBefore','gridAfter'].some(name=>node.getElementsByTagNameNS(ns,name).length > 0)
      || packed.some(row => row.length !== packed[0].length);
    if (complex) {
      losses.add('병합·중첩 또는 변환 범위를 넘는 표는 본문 문단으로 펼쳤습니다.');
      for (const line of text(node, depth).trimEnd().split('\n')) if (line) blocks.push({kind:'paragraph',text:line});
      return;
    }
    const cells = packed.map(row => row.map(cell => text(cell, depth + 1).trimEnd()));
    blocks.push({kind:'table',cells});
  }

  function collect(node: Element, depth: number) {
    if (node.localName === 'p') {
      const paragraphs = text(node, depth).slice(0, -1).split('\n');
      for (const value of paragraphs) blocks.push({kind:'paragraph',text:value});
    } else if (node.localName === 'tbl') table(node, depth);
    else if (visit(node, depth)) for (const child of elements(node)) collect(child, depth + 1);
  }
  collect(body, 0);
  if ([...parts].some(name => /^word\/(?:header|footer)\d*\.xml$/u.test(name))) losses.add('머리말과 꼬리말을 제외했습니다.');
  if ([...parts].some(name => /^word\/(?:comments|footnotes|endnotes)\.xml$/u.test(name))) losses.add('메모와 각주·미주와 같은 별도 부속 내용을 제외했습니다.');
  requireCopyBudget(blocks);
  return {blocks, losses:[...losses]};
}
