import {createAxisPictureFixture} from './axis-picture-fixture.mjs';
import {execFileSync} from 'node:child_process';
import {writeFile,readFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';

const python=(...args)=>execFileSync('python',[resolve(import.meta.dirname,'cell-paragraph-picture-fields.py'),...args],{encoding:'utf8'});
export const mixedPictureFieldArgs=[0,1,0,4,0];
export const mixedPictureFieldText='앞필드😀 뒤문구 Pi중간문구 cB 일반문구';
export function inspectMixedPictureFields(file){return JSON.parse(python('inspect',file));}

export async function createPictureFieldParagraph(HwpDocument,folder,mode='filled'){
 await mkdir(folder,{recursive:true});
 const d=await createAxisPictureFixture(HwpDocument,folder,{merged:true,grouped:true});
 // The combined field, three pictures and ordinary text must fit the original
 // owner on one line; overflowing source geometry is deliberately ineligible.
 for(const [cell,width] of [6000,12000,15000,6000,27000,6000,12000,15000].entries())
  d.setCellProperties(0,1,0,cell,JSON.stringify({width}));
 d.applyParaFormatInCell(...mixedPictureFieldArgs,'{"alignment":"left"}');
 const source=resolve(folder,'mixed-source.hwpx'),stored=resolve(folder,'mixed-original.hwpx');
 try{await writeFile(source,d.exportHwpx());}finally{d.free();}
 // Construct a stored, filled field. The separate native field-creation API
 // currently changes a picture paragraph's char_count before HWPX export.
 python('fixture',source,stored,mode);
 const result=new HwpDocument(await readFile(stored));
 const formatted=JSON.parse(result.applyCharFormatInCell(...mixedPictureFieldArgs,1,mode==='empty'?2:4,'{"textColor":"#246789"}'));
 if(formatted.ok!==true){result.free();throw Error('Failed to format the stored field fixture');}
 return result;
}
