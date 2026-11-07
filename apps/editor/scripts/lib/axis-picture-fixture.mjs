import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const python=(...args)=>execFileSync('python',[resolve(import.meta.dirname,'inspect-axis-picture.py'),...args],{encoding:'utf8'});
const pictures=Object.fromEntries(await Promise.all(['png','jpg'].map(async ext=>[
 ext,await readFile(resolve(import.meta.dirname,'../../fixtures/page-background/background-bands.'+ext))
])));
const labels=['PicA','PicB','PicC','PicD'],kinds=['png','png','jpg','png'],at=[0,1,0];

export function inspectPictureAnchors(file){
 return JSON.parse(python('inspect-anchors',file));
}

export async function createAxisPictureFixture(HwpDocument,folder,{merged=false,grouped=false,mergeRange}={}){
 const d=HwpDocument.createEmpty();
 try{
  d.createBlankDocument();d.insertText(0,0,0,'제품 목록');d.splitParagraph(0,0,5);d.createTable(...at,3,3);
  const owners=new Map([[2,labels[0]],[4,labels[1]],[7,labels[2]],[8,labels[3]]]);
  for(let i=0;i<9;i++){
   d.setCellProperties(...at,i,JSON.stringify({width:[6000,7500,9000][i%3],height:[4500,6000,7500][Math.floor(i/3)]}));
   if(!grouped||i!==5)d.insertTextInCell(...at,i,0,0,owners.get(i)??'항목'+i);
  }
  if(mergeRange)d.mergeTableCells(...at,...mergeRange);
  else if(merged){
   if(grouped)d.mergeTableCells(...at,1,1,1,2);
   else d.mergeTableCells(...at,0,0,0,1);
  }
  for(const [i,ext] of kinds.entries()){
   d.splitParagraph(0,1+i,d.getParagraphLength(0,1+i));
   const {controlIdx}=JSON.parse(d.insertPicture(0,2+i,0,'[]',pictures[ext],1800,900,48,24,ext,labels[i]));
   d.setPictureProperties(0,2+i,controlIdx,'{"treatAsChar":true}');
  }
  const source=resolve(folder,'source.hwpx'),inside=resolve(folder,'source-in-cell.hwpx');
  await writeFile(source,d.exportHwpx());python(grouped?'embed-grouped':'embed-many',source,inside);
  return new HwpDocument(await readFile(inside));
 }finally{d.free();}
}
