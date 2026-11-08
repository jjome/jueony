import {createAxisPictureFixture} from './axis-picture-fixture.mjs';
import {execFileSync} from 'node:child_process';
import {writeFile,readFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';

const python=(...args)=>execFileSync('python',[resolve(import.meta.dirname,'cell-paragraph-picture-fields.py'),...args],{encoding:'utf8'});
export const mixedPictureFieldArgs=[0,1,0,4,0];
export const mixedPictureFieldText='앞필드😀 뒤문구 Pi중간문구 cB 일반문구';
export const multiplePictureFieldText='문서 앞글 필드😀 사이문구 둘째값 뒤문구 Pi중간문구 cB 일반문구';
export function inspectMixedPictureFields(file){return JSON.parse(python('inspect',file));}
export function inspectPictureFieldLines(file){return JSON.parse(python('inspect-lines',file));}

export async function createPictureFieldParagraph(HwpDocument,folder,mode='filled'){
 await mkdir(folder,{recursive:true});
 const d=await createAxisPictureFixture(HwpDocument,folder,{merged:true,grouped:true});
 const multiple=mode==='multiple'||mode==='multiple-wrap';
 // The combined field, three pictures and ordinary text must fit the original
 // owner on one line; overflowing source geometry is deliberately ineligible.
 const widths=multiple?[6000,18000,18000,6000,36000,6000,18000,18000]:[6000,12000,15000,6000,27000,6000,12000,15000];
 for(const [cell,width] of widths.entries())
  d.setCellProperties(0,1,0,cell,JSON.stringify({width}));
 d.applyParaFormatInCell(...mixedPictureFieldArgs,'{"alignment":"left"}');
 if(mode==='multiple')d.applyCharFormatInCell(...mixedPictureFieldArgs,0,d.getCellParagraphLength(...mixedPictureFieldArgs),'{"fontSize":800}');
 const source=resolve(folder,'mixed-source.hwpx'),stored=resolve(folder,'mixed-original.hwpx');
 try{await writeFile(source,d.exportHwpx());}finally{d.free();}
 // Construct a stored, filled field. The separate native field-creation API
 // currently changes a picture paragraph's char_count before HWPX export.
 python('fixture',source,stored,mode);
 const result=new HwpDocument(await readFile(stored));
 const formatted=JSON.parse(result.applyCharFormatInCell(...mixedPictureFieldArgs,multiple?6:1,multiple?9:mode==='empty'?2:4,'{"textColor":"#246789"}'));
 if(formatted.ok!==true){result.free();throw Error('Failed to format the stored field fixture');}
 if(multiple&&JSON.parse(result.applyCharFormatInCell(...mixedPictureFieldArgs,15,18,'{"textColor":"#975324"}')).ok!==true){
  result.free();throw Error('Failed to format the second stored field fixture');
 }
 return result;
}
