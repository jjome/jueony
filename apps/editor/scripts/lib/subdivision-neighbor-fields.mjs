export function subdivisionNeighborFieldTable(HwpDocument,namedTarget=false) {
  const d=HwpDocument.createEmpty(),at=[0,1,0];
  d.createBlankDocument();d.insertText(0,0,0,'앞');d.splitParagraph(0,0,1);d.createTable(...at,3,3);
  for(let i=0;i<9;i++){
    d.setCellProperties(...at,i,'{"width":7000,"height":4200}');
    d.insertTextInCell(...at,i,0,0,'칸'+i);
  }
  d.mergeTableCells(...at,0,0,0,1);
  if(namedTarget)d.setCellProperties(...at,0,'{"fieldName":"계약번호"}');
  d.insertClickHereFieldInCell(...at,1,0,0,false,'안내','설명','누름틀',true);
  d.setFieldValueByName('누름틀','확정');
  d.setCellProperties(...at,5,'{"fieldName":"이름셀"}');
  return d;
}

export function subdivisionNamedParagraphTable(HwpDocument) {
  const d=subdivisionNeighborFieldTable(HwpDocument,true),at=[0,1,0,0,1];
  d.applyCharFormatInCell(...at,0,d.getCellParagraphLength(...at),'{"bold":true}');
  d.applyParaFormatInCell(...at,'{"alignment":"right"}');
  return d;
}

export function subdivisionInlineFieldTable(HwpDocument,filled=false,paragraph=0) {
  const d=subdivisionNeighborFieldTable(HwpDocument);
  d.insertClickHereFieldInCell(0,1,0,0,paragraph,0,false,'안내','설명','주누름틀',true);
  if(filled)d.setFieldValueByName('주누름틀','값😀');
  d.applyCharFormatInCell(0,1,0,0,1,0,d.getCellParagraphLength(0,1,0,0,1),'{"bold":true}');
  return d;
}
