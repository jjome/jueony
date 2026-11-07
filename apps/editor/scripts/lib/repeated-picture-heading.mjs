// Stored coordinates and text of the three source forms, independent of the renderer.
export function expectedPictureHeading(twoRows,multiParagraph){
 const slots=twoRows?[
  [0,0,2,1,['항목0','계3']], [0,1,1,2,['항목1','PicA']],
  [1,1,1,1,['계4']], [1,2,1,1,['계5']],
 ]:[
  [0,0,1,1,multiParagraph?['항','목0']:['항목0']],
  [0,1,1,1,multiParagraph?['']:['항목1']], [0,2,1,1,['PicA']],
 ];
 return slots.map(([row,col,rowSpan,colSpan,paragraphs])=>({row,col,rowSpan,colSpan,paragraphs}));
}
