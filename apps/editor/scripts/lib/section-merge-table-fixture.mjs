export const mergedTableCellText = '업무\t표 😀';

export function createSectionMergeTableDocument(HwpDocument) {
  const doc = HwpDocument.createEmpty();
  doc.createBlankDocument();
  const body = ['LEFT', 'RIGHT', 'TABLE', 'END'];
  for (const [index, text] of body.entries()) {
    if (index) doc.splitParagraph(0, index - 1, body[index - 1].length);
    doc.insertText(0, index, 0, text);
  }
  const table = JSON.parse(doc.createTable(0, 2, 0, 2, 2));
  doc.insertTextInCell(0, table.paraIdx, table.controlIdx, 0, 0, 0, mergedTableCellText);
  doc.insertSectionBreak(0, 1, 0);
  doc.setSectionDef(0, JSON.stringify({ defaultTabSpacing: 4000 }));
  doc.setSectionDef(1, JSON.stringify({ defaultTabSpacing: 12000 }));
  return doc;
}
