import { requireCopyBudget, type OfficeBlock } from '../files/office-copy.ts';
import { verifyPreservedExport } from './preservation.ts';
import { readStructure } from './structure.ts';

const trimControl = (text: string) => text.replace(/[\u0000-\u0009\u000b-\u001f\u007f]/gu, ' ');
function result(value: string) {
  const parsed = JSON.parse(value);
  if (parsed.ok !== true) throw new Error('한글 엔진이 사본의 문단이나 표 생성을 거절했습니다.');
  return parsed;
}

export function createOfficeCopy(HwpDocument: any, source: OfficeBlock[]): Uint8Array {
  requireCopyBudget(source);
  const blocks = source.map(block => block.kind === 'paragraph'
    ? {...block, text:trimControl(block.text)} : {...block, cells:block.cells.map(row=>row.map(trimControl))});
  const document = HwpDocument.createEmpty();
  const open = (bytes: Uint8Array) => new HwpDocument(bytes);
  try {
    document.createBlankDocument();
    let paragraph = 0;
    const placement: {paragraph: number; cells: string[][]}[] = [];
    for (const [index,block] of blocks.entries()) {
      if (block.kind === 'paragraph') {
        if (block.text) result(document.insertText(0,paragraph,0,block.text));
      } else {
        const columns = block.cells[0]?.length;
        if (!columns || block.cells.some(row=>row.length !== columns)) throw new Error('사각형 표의 격자를 확인할 수 없습니다.');
        const table = result(document.createTable(0,paragraph,0,block.cells.length,columns));
        if (table.paraIdx !== paragraph || !Number.isSafeInteger(table.controlIdx)) throw new Error('사본 안의 표 위치를 확인할 수 없습니다.');
        for (const [cell,value] of block.cells.flat().entries()) {
          const lines = value.split('\n');
          for (const [line,text] of lines.entries()) {
            if (text) result(document.insertTextInCell(0,paragraph,table.controlIdx,cell,line,0,text));
            if (line + 1 < lines.length) {
              const length = document.getCellParagraphLength(0,paragraph,table.controlIdx,cell,line);
              result(document.splitParagraphInCell(0,paragraph,table.controlIdx,cell,line,length));
            }
          }
        }
        placement.push({paragraph,cells:block.cells});
      }
      if (index + 1 < blocks.length) {
        if (document.getParagraphCount(0) <= paragraph + 1) result(document.splitParagraph(0,paragraph,document.getParagraphLength(0,paragraph)));
        paragraph++;
      }
    }
    const artifact = document.exportHwpxWithReport();
    try {
      const bytes = artifact.takeBytes();
      verifyPreservedExport(document,bytes,'hwpx',artifact.contentLoss(),open);
      const saved = open(bytes);
      try {
        const expected = blocks.map(block=>block.kind==='paragraph'?block.text:'');
        const actual = Array.from({length:saved.getParagraphCount(0)},(_,paragraph)=>
          saved.getTextRange(0,paragraph,0,saved.getParagraphLength(0,paragraph)));
        const tables = readStructure(saved).tables;
        if (expected.some((line,i)=>actual[i]!==line) || actual.slice(expected.length).some(Boolean) ||
            tables.length!==placement.length || placement.some(({paragraph,cells},i)=>{
              const table=tables[i];
              return table.paragraph!==paragraph || table.rows!==cells.length || table.columns!==cells[0].length ||
                JSON.stringify(table.cells.map(cell=>cell.text))!==JSON.stringify(cells.flat());
            })) throw new Error('다시 연 HWPX 사본에서 원문과 표의 내용을 확인할 수 없습니다.');
      } finally { saved.free(); }
      return bytes;
    } finally { artifact.free(); }
  } finally { document.free(); }
}
