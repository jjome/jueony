import {createAxisPictureFixture} from './axis-picture-fixture.mjs';

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

export async function createRepeatedTitlePictures(HwpDocument,folder){
 const d=await createAxisPictureFixture(HwpDocument,folder,{merged:true}),base=[0,1,0];
 d.insertTableRow(...base,1,false);
 for(let i=0;i<2;i++)d.setCellProperties(...base,i,'{"height":3000,"isHeader":true}');
 for(let i=2;i<5;i++)d.setCellProperties(...base,i,'{"height":3000}');
 d.setPageDef(0,JSON.stringify({...JSON.parse(d.getPageDef(0)),height:23000,
  marginTop:2000,marginBottom:2000,marginHeader:0,marginFooter:0}));
 d.setTableProperties(...base,'{"pageBreak":2,"repeatHeader":true}');
 const lists=JSON.parse(d.getCursorModel()).lists;
 for(const [i,c] of JSON.parse(d.getControls()).filter(c=>c.userDesc==='그림').entries()){
  const owner=lists.find(l=>l.listId===c.list);
  const path=JSON.stringify([{controlIndex:0,cellIndex:owner.cellIndex,cellParaIndex:c.para}]);
  d.setCellPicturePropertiesByPath(0,1,path,c.controlIndex,JSON.stringify({
   cropLeft:225,cropRight:450,cropTop:150,cropBottom:225,horzFlip:i%2===0,vertFlip:i%2===1
  }));
 }
 return d;
}

export const crossingTitleText='가나다라마바사아자차😀카타파하가나다라마';
export const titleRowOriginalText='항목0😀';
export async function createTitleRowPictures(HwpDocument,folder){
 const d=await createRepeatedTitlePictures(HwpDocument,folder);
 // Require a real Canvas publication in Edge; the Hangul-only source has no
 // supplementary-cluster metric requests and legitimately stays portable.
 d.insertTextInCell(0,1,0,0,0,d.getCellParagraphLength(0,1,0,0,0),'😀');
 return d;
}
export async function createCrossingTitlePictures(HwpDocument,folder){
 const d=await createRepeatedTitlePictures(HwpDocument,folder),base=[0,1,0];
 d.deleteTextInCell(...base,0,0,0,d.getCellParagraphLength(...base,0,0));
 d.insertTextInCell(...base,0,0,0,crossingTitleText);
 for(const cell of [0,1])d.setCellProperties(...base,cell,'{"height":6000}');
 return d;
}
