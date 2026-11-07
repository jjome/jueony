import {createAxisPictureFixture} from './lib/axis-picture-fixture.mjs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {hash,loadReviewEngine} from './lib/hancom-review.mjs';
import {readStructure} from '../src/adapters/rhwp/structure.ts';
import {executeDocumentOperations} from '../src/adapters/rhwp/execute.ts';
import {validateEditOperations} from '../src/modules/document/public/index.ts';

const {HwpDocument}=await loadReviewEngine(resolve(process.env.JUEONY_ENGINE_PACKAGE));
const output=resolve(process.env.JUEONY_TEST_OUTPUT??resolve(import.meta.dirname,'../../../build/axis-pictures-native'));
const python=(...args)=>execFileSync('python',[resolve(import.meta.dirname,'lib/inspect-axis-picture.py'),...args],{encoding:'utf8'});
const pictures=Object.fromEntries(await Promise.all(['png','jpg'].map(async ext=>[
 ext,await readFile(resolve(import.meta.dirname,'../fixtures/page-background/background-bands.'+ext))
])));
const labels=['PicA','PicB','PicC','PicD'],kinds=['png','png','jpg','png'],at=[0,1,0];
const target='s0p1t0',insert={kind:'insert_table_row',target,index:1,values:['신규','','']};
const dropColumn={kind:'delete_table_column',target,index:0};
const writeFormat=(d,format)=>format==='hwp'?d.exportHwp():d.exportHwpx();
const snap=(d,format)=>({name:'그림 목록.'+format,structure:readStructure(d),nodes:[],limitations:[],revision:'1'});
function apply(d,format,op){
 const current=snap(d,format);
 executeDocumentOperations(d,current,validateEditOperations([op],current));
}

function checkSource(raw){
 assert.equal(raw.length,4);
 const [a,b,c,d]=raw;
 assert.equal(a.resource,b.resource);
 assert.equal(new Set([a.resource,c.resource,d.resource]).size,3);
 assert.deepEqual(raw.map(p=>p.image),kinds.map(ext=>hash(pictures[ext])));
 assert.deepEqual(raw.map(p=>[p.row,p.col]),[[0,2],[1,1],[2,1],[2,2]]);
}

function importFailure(d,mode){
 if(mode==='protected')d.setCellProperties(...at,JSON.parse(d.getTableDimensions(...at)).cellCount-1,'{"cellProtect":true}');
 if(mode==='duplicate path'){
  const read=d.getPageControlLayout.bind(d);
  d.getPageControlLayout=page=>{
   const layout=JSON.parse(read(page)),picture=layout.controls.find(c=>c.type==='image');
   layout.controls.push({...picture,x:picture.x+20});return JSON.stringify(layout);
  };
 }
 if(mode==='ambiguous paint'){
  const read=d.getPageFlowImageOps.bind(d);
  d.getPageFlowImageOps=page=>{
   const flow=JSON.parse(read(page));flow.images.push(flow.images[0]);return JSON.stringify(flow);
  };
 }
 if(mode==='wrong path bytes')d.getControlImageData=()=>pictures.jpg;
 if(mode==='equal bytes other ID'){
  const nativeInsert=d.insertTableRow.bind(d);
  d.insertTableRow=(...args)=>{
   const result=nativeInsert(...args);
   const owner=readStructure(d).tables[0].cells.find(c=>c.text==='PicA');
   const path=JSON.stringify([{controlIndex:0,cellIndex:owner.index,cellParaIndex:0}]);
   // Register the exact same PNG again, giving A a different native BinData
   // record after insertion. B still points at the original shared resource.
   assert.equal(JSON.parse(d.assignPictureImage(0,1,path,0,pictures.png,48,24,'png')).ok,true);
   return result;
  };
 }
}

for(const grid of ['plain','merged']){
 const folder=resolve(output,grid);await mkdir(folder,{recursive:true});
 const fixtureDoc=await createAxisPictureFixture(HwpDocument,folder,{merged:grid==='merged'});
 try{
  for(const format of ['hwp','hwpx']){
   const original=writeFormat(fixtureDoc,format),before=resolve(folder,'before.'+format);
   await writeFile(before,original);
   const raw=JSON.parse(python('inspect-many',before));checkSource(raw);
   for(const op of [insert,dropColumn]){
    const d=new HwpDocument(original);
    try{
     const source=snap(d,format).structure.tables[0];
     assert.equal(source.cells.filter(c=>c.axisPicture).length,4);
     apply(d,format,op);
     const revised=snap(d,format).structure;
     const artifact=resolve(folder,op.kind+'.'+format);
     await writeFile(artifact,writeFormat(d,format));
     const stored=JSON.parse(python('inspect-many',artifact));
     assert.deepEqual(stored,raw.map(p=>({...p,row:p.row+(op===insert&&p.row>=1?1:0),col:p.col-(op===dropColumn?1:0)})));
     for(const name of labels){
      const old=source.cells.find(c=>c.text===name),cell=revised.tables[0].cells.find(c=>c.text===name);
      assert.deepEqual(cell.properties,old.properties);assert.equal(cell.axisPicture.signature,old.axisPicture.signature);
      assert.ok(Math.abs(cell.axisPicture.left-old.axisPicture.left)<=.2 && Math.abs(cell.axisPicture.top-old.axisPicture.top)<=.2);
     }
     const reopened=new HwpDocument(await readFile(artifact));
     try{assert.deepEqual(readStructure(reopened),revised);}finally{reopened.free();}
     console.log('PASS',grid,format,op.kind,'four owners, stored resource links, bytes, layout and reopen');
    }finally{d.free();}
   }
   for(const mode of ['delete owner','protected','duplicate path','ambiguous paint','wrong path bytes','equal bytes other ID']){
    const d=new HwpDocument(original);
    try{
     importFailure(d,mode);
     const bytes=writeFormat(d,format);
     assert.throws(()=>apply(d,format,mode==='delete owner'?{kind:'delete_table_row',target,index:1}:insert),/그림|필드|보호/);
     assert.deepEqual(writeFormat(d,format),bytes);
    }finally{d.free();}
   }
   console.log('PASS',grid,format,'reject deletion/protection, duplicate paths, ambiguous paint, wrong owner bytes and reassigned equal-byte IDs');
  }
 }finally{fixtureDoc.free();}
}
