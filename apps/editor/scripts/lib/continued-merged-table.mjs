export function continuedMergedTable(HwpDocument) {
  const doc = HwpDocument.createEmpty();
  doc.createBlankDocument();
  doc.insertText(0, 0, 0, 'Body');
  doc.splitParagraph(0, 0, 4);
  doc.createTable(0, 1, 0, 24, 2);
  for (let cell = 0; cell < 48; cell++) {
    doc.setCellProperties(0, 1, 0, cell, '{"width":12000,"height":5500}');
    doc.insertTextInCell(0, 1, 0, cell, 0, 0, 'cell ' + cell);
  }
  doc.mergeTableCells(0, 1, 0, 17, 0, 17, 1);
  return doc;
}
