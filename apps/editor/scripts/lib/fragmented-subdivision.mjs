/** Short lines preserve their page breaks when the cell is divided into columns. */
export function fragmentedSubdivisionTable(HwpDocument,{merged=true,hardBreaks=false,wrapped=false}={}) {
  const d=HwpDocument.createEmpty(), at=[0,1,0];
  d.createBlankDocument();
  d.insertText(0,0,0,'Title');d.splitParagraph(0,0,5);
  d.createTable(...at,2,3);
  for(let i=0;i<6;i++){
    d.setCellProperties(...at,i,'{"width":12000,"height":2200}');
    d.insertTextInCell(...at,i,0,0,'C'+i);
  }
  if(merged) d.mergeTableCells(...at,0,0,0,1);
  d.setTableProperties(...at,'{"pageBreak":1}');
  const paper=JSON.parse(d.getPageDef(0));
  d.setPageDef(0,JSON.stringify({...paper,height:42000,marginTop:4400,marginBottom:4400}));
  if (wrapped) d.insertTextInCell(...at,0,0,0,'word '.repeat(500));
  else if (hardBreaks) d.insertTextInCell(...at,0,0,0,'line\n'.repeat(30));
  else {
    for(let i=0;i<31;i++) {
      d.splitParagraphInCell(...at,0,i,d.getCellParagraphLength(...at,0,i));
      d.insertTextInCell(...at,0,i+1,0,'줄'+i+'😀');
    }
    const p=19;
    d.applyCharFormatInCell(...at,0,p,0,d.getCellParagraphLength(...at,0,p),'{"bold":true}');
  }
  return d;
}
