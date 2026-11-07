import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {hash,loadReviewEngine} from './lib/hancom-review.mjs';
import {readStructure} from '../src/adapters/rhwp/structure.ts';
import {executeDocumentOperations} from '../src/adapters/rhwp/execute.ts';
import {validateEditOperations} from '../src/modules/document/public/index.ts';

const {HwpDocument}=await loadReviewEngine(resolve(process.env.JUEONY_ENGINE_PACKAGE));
const extension=process.argv.includes('--jpeg')?'jpg':'png';
const out=resolve(process.env.JUEONY_TEST_OUTPUT??resolve(import.meta.dirname,'../../../build/axis-picture-native'),extension);
await mkdir(out,{recursive:true});
const python=(...args)=>execFileSync('python',[resolve(import.meta.dirname,'lib/inspect-axis-picture.py'),...args],{encoding:'utf8'});
const image=await readFile(resolve(import.meta.dirname,'../fixtures/page-background/background-bands.'+extension));
const at=[0,1,0],target='s0p1t0',path=i=>JSON.stringify([{controlIndex:0,cellIndex:i,cellParaIndex:0}]);
const serialize=(d,format)=>format==='hwp'?d.exportHwp():d.exportHwpx();
const snapshot=(d,format)=>({name:'그림.'+format,structure:readStructure(d),nodes:[],limitations:[],revision:'1'});
function apply(d,format,op,s=snapshot(d,format)){
 executeDocumentOperations(d,s,validateEditOperations([op],s));
}
const owner=d=>readStructure(d).tables[0].cells.find(c=>c.text==='Picture owner');
const seed=HwpDocument.createEmpty();
try{
 seed.createBlankDocument();seed.insertText(0,0,0,'본문');seed.splitParagraph(0,0,2);seed.createTable(...at,3,3);
 for(let i=0;i<9;i++){
  seed.setCellProperties(...at,i,JSON.stringify({width:[6000,7500,9000][i%3],height:[4500,6000,7500][Math.floor(i/3)]}));
  seed.insertTextInCell(...at,i,0,0,i===7?'Picture owner':'셀'+i);
 }
 seed.applyCharFormatInCell(...at,7,0,0,7,'{"bold":true}');seed.mergeTableCells(...at,0,0,0,1);
 seed.splitParagraph(0,1,seed.getParagraphLength(0,1));
 const placed=JSON.parse(seed.insertPicture(0,2,0,'[]',image,1800,900,48,24,extension,'결재 도장'));
 seed.setPictureProperties(0,2,placed.controlIdx,'{"treatAsChar":true}');
 const source=resolve(out,'picture-source.hwpx'),inside=resolve(out,'picture-in-cell.hwpx');
 await writeFile(source,seed.exportHwpx());python('embed',source,inside);
 const fixture=new HwpDocument(await readFile(inside));
 try{
  for(const format of ['hwp','hwpx']){
   const original=serialize(fixture,format),sourcePath=resolve(out,'before.'+format);await writeFile(sourcePath,original);
   const sourceWire=JSON.parse(python('inspect',sourcePath));assert.equal(sourceWire.image,hash(image));
   for(const [op,expectedRow,expectedColumn] of [
    [{kind:'insert_table_row',target,index:1,values:['새 행','','']},3,1],
    [{kind:'delete_table_column',target,index:0},2,0]
   ]){
    if(extension==='jpg' && op.kind==='delete_table_column')continue;
    const d=new HwpDocument(original);
    try{
     const before=serialize(d,format),old=owner(d),undo=d.saveSnapshot();assert.ok(old.axisPicture);
     apply(d,format,op);const after=owner(d);
     assert.deepEqual([after.row,after.column],[expectedRow,expectedColumn]);
     assert.deepEqual(after.properties,old.properties);assert.equal(after.axisPicture.signature,old.axisPicture.signature);
     assert.ok(Math.abs(after.axisPicture.left-old.axisPicture.left)<=.2 && Math.abs(after.axisPicture.top-old.axisPicture.top)<=.2);
     assert.equal(JSON.parse(d.getCellCharPropertiesAt(...at,after.index,0,0)).bold,true);
     const file=resolve(out,op.kind+'.'+format),bytes=serialize(d,format);await writeFile(file,bytes);
     const raw=JSON.parse(python('inspect',file));assert.deepEqual(raw,{...sourceWire,row:expectedRow,col:expectedColumn});
     const reopened=new HwpDocument(await readFile(file));
     try{assert.deepEqual(readStructure(reopened),readStructure(d));}finally{reopened.free();}
     const redo=d.saveSnapshot();d.restoreSnapshot(undo);assert.deepEqual(serialize(d,format),before);
     d.restoreSnapshot(redo);assert.deepEqual(serialize(d,format),bytes);d.discardSnapshot(redo);d.discardSnapshot(undo);
     console.log('PASS',format,op.kind,extension,'preserves raw picture records, image bytes, relative layout, paragraph, undo/redo and reopen');
    }finally{d.free();}
   }
   if(extension==='jpg')continue;
   const op={kind:'insert_table_row',target,index:1,values:['','','']};
   for(const mode of ['remove','protected','mixed','stale','changedImage','shiftedLayout']){
    const d=new HwpDocument(original);
    try{
     const src=snapshot(d,format),index=owner(d).index;
     if(mode==='protected')d.setCellProperties(...at,index,'{"cellProtect":true}');
     if(mode==='mixed')d.insertClickHereFieldInCell(...at,index,0,3,false,'안내','','입력',true);
     if(mode==='stale')d.setCellPicturePropertiesByPath(0,1,path(index),0,'{"description":"다른 그림"}');
     if(mode==='changedImage'){
      const jpg=await readFile(resolve(import.meta.dirname,'../fixtures/page-background/background-bands.jpg'));
      const insert=d.insertTableRow.bind(d);
      d.insertTableRow=(...args)=>{
       const result=insert(...args),moved=owner(d);
       d.assignPictureImage(0,1,path(moved.index),0,jpg,48,24,'jpg');
       return result;
      };
     }
     if(mode==='shiftedLayout'){
      const layout=d.getPageControlLayout.bind(d),insert=d.insertTableRow.bind(d);
      let shifted=false;
      d.insertTableRow=(...args)=>{const result=insert(...args);shifted=true;return result;};
      d.getPageControlLayout=(...args)=>{
       const page=JSON.parse(layout(...args));
       if(shifted)page.controls.find(c=>c.type==='image').x+=1;
       return JSON.stringify(page);
      };
     }
     const bytes=serialize(d,format);
     assert.throws(()=>apply(d,format,mode==='remove'?{kind:'delete_table_row',target,index:2}:op,
      mode==='stale'?src:snapshot(d,format)),/그림|필드|보호|바뀌었/);
     assert.deepEqual(serialize(d,format),bytes);
    }finally{d.free();}
   }
   console.log('PASS',format,'rejects owner deletion, protected and mixed hosts, stale picture, image replacement and relative layout drift without byte changes');
  }
 }finally{fixture.free();}
}finally{seed.free();}
