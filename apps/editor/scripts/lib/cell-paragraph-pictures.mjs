import {createAxisPictureFixture} from './axis-picture-fixture.mjs';

export async function multilinePictureParagraph(HwpDocument,folder){
 const d=await createAxisPictureFixture(HwpDocument,folder,{merged:true,grouped:true}),args=[0,1,0,4,0];
 d.insertTextInCell(...args,2,'한글가나다라');d.insertTextInCell(...args,0,'가나다라마바사아');
 d.applyParaFormatInCell(...args,'{"alignment":"left"}');
 for(const i of [3,4])d.setCellProperties(0,1,0,i,'{"height":10500,"verticalAlign":0}');
 return d;
}

export async function repeatedSpacePictureParagraph(HwpDocument,folder){
 const d=await createAxisPictureFixture(HwpDocument,folder,{merged:true,grouped:true}),args=[0,1,0,4,0];
 // The post-picture Latin run "i " has a fractional advance. Its following
 // Hangul run exposes an incorrectly rounded cursor advance after deletion.
 d.insertTextInCell(...args,2,'  다');d.insertTextInCell(...args,0,'😀');
 d.applyCharFormatInCell(...args,0,1,'{"textColor":"#246789"}');
 return d;
}
