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

export function fragmentedMergedCell(HwpDocument) {
  const doc=HwpDocument.createEmpty();
  doc.createBlankDocument();
  doc.insertText(0,0,0,'Title');
  doc.splitParagraph(0,0,5);
  doc.createTable(0,1,0,2,2);
  for(let index=0;index<4;index++){
    doc.setCellProperties(0,1,0,index,'{"width":12000,"height":1200}');
    doc.insertTextInCell(0,1,0,index,0,0,'Cell '+index);
  }
  doc.mergeTableCells(0,1,0,0,0,0,1);
  doc.setTableProperties(0,1,0,'{"pageBreak":1}');
  doc.insertTextInCell(0,1,0,0,0,0,'word '.repeat(550));
  return doc;
}
