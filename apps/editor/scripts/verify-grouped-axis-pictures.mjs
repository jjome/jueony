import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {loadReviewEngine} from './lib/hancom-review.mjs';
import {createAxisPictureFixture} from './lib/axis-picture-fixture.mjs';
import {readStructure} from '../src/adapters/rhwp/structure.ts';
import {executeDocumentOperations} from '../src/adapters/rhwp/execute.ts';
import {validateEditOperations} from '../src/modules/document/public/index.ts';
import {sameAxisPicture} from '../src/adapters/rhwp/axis-cell-picture.ts';

const {HwpDocument}=await loadReviewEngine(resolve(process.env.JUEONY_ENGINE_PACKAGE));
const output=resolve(process.env.JUEONY_TEST_OUTPUT??resolve(import.meta.dirname,'../../../build/axis-grouped-pictures-native'));
const inspect=file=>JSON.parse(execFileSync('python',[resolve(import.meta.dirname,'lib/inspect-axis-picture.py'),'inspect-grouped',file],{encoding:'utf8'}));
const at=[0,1,0],target='s0p1t0';
const insert={kind:'insert_table_row',target,index:1,values:['신규','','']};
const drop={kind:'delete_table_column',target,index:0};
const bytes=(d,ext)=>ext==='hwp'?d.exportHwp():d.exportHwpx();
const table=d=>readStructure(d).tables[0];
const owner=d=>table(d).cells.find(c=>c.text==='PicB');
function apply(d,ext,op){
 const snapshot={name:'사진.'+ext,structure:readStructure(d),revision:'1',nodes:[],limitations:[]};
 executeDocumentOperations(d,snapshot,validateEditOperations([op],snapshot));
}
function checkSource(raw){
 assert.deepEqual(raw.map(p=>[p.row,p.col]),[[1,1],[1,1],[1,1],[2,2]]);
 assert.equal(raw[0].resource,raw[1].resource);
 assert.equal(new Set(raw.map(p=>p.resource)).size,3);
 assert.equal(raw[0].image,raw[3].image);
 assert.notEqual(raw[0].image,raw[2].image);
 assert.deepEqual(raw[0].paragraph,raw[1].paragraph);
 assert.deepEqual(raw[0].paragraph,raw[2].paragraph);
}

function damageLayoutAfterInsert(d){
 const nativeInsert=d.insertTableRow.bind(d);
 const readLayout=d.getPageControlLayout.bind(d),readPaint=d.getPageFlowImageOps.bind(d);
 let shifted=false;
 d.insertTableRow=(...args)=>{const result=nativeInsert(...args);shifted=true;return result;};
 let originalBounds;
 d.getPageControlLayout=page=>{
  const layout=JSON.parse(readLayout(page));
  if(shifted){
   const second=layout.controls.find(c=>c.type==='image'&&c.controlIdx===1);
   originalBounds={x:second.x,y:second.y};second.x+=1;
  }
  return JSON.stringify(layout);
 };
 d.getPageFlowImageOps=page=>{
  const paint=JSON.parse(readPaint(page));
  if(shifted){
   const op=paint.images.find(c=>Math.abs(c.bbox.x-originalBounds.x)<.051&&Math.abs(c.bbox.y-originalBounds.y)<.051);
   op.bbox.x+=1;
  }
  return JSON.stringify(paint);
 };
}

for(const grid of ['plain','merged']){
 const folder=resolve(output,grid);await mkdir(folder,{recursive:true});
 const source=await createAxisPictureFixture(HwpDocument,folder,{merged:grid==='merged',grouped:true});
 try{
  const cells=table(source).cells;
  source.setCellProperties(...at,cells.find(c=>c.text==='PicA').index,'{"fieldName":"제품 코드"}');
  source.insertClickHereFieldInCell(...at,cells.find(c=>c.text==='PicC').index,0,0,false,'입력','제품 설명','설명',true);
  for(const ext of ['hwp','hwpx']){
   const original=bytes(source,ext),input=resolve(folder,'before.'+ext);await writeFile(input,original);
   const raw=inspect(input);checkSource(raw);
   const op=grid==='plain'?insert:drop;
   const d=new HwpDocument(original);
   try{
    const before=table(d),group=owner(d).axisPicture;
    assert.deepEqual(group.pictures.map(p=>p.controlIndex),[0,1,2]);
    assert.equal(new Set(group.pictures.map(p=>p.left)).size,3);
    const fields=before.cells.filter(c=>c.axisFieldSignature);assert.equal(fields.length,2);
    apply(d,ext,op);
    const current=table(d),survivor=owner(d);
    assert.ok(sameAxisPicture(group,survivor.axisPicture));
    for(const field of fields){
     const keep=current.cells.find(c=>c.text===field.text);
     assert.equal(keep.axisFieldSignature,field.axisFieldSignature);
    }
    const result=resolve(folder,op.kind+'.'+ext);
    await writeFile(result,bytes(d,ext));
    assert.deepEqual(inspect(result),raw.map(p=>({...p,row:p.row+(op===insert?1:0),col:p.col-(op===drop?1:0)})));
    const copy=new HwpDocument(await readFile(result));
    try{assert.deepEqual(table(copy),current);}finally{copy.free();}
    console.log('PASS',grid,ext,op.kind,'stored order, text around three images, native properties, offsets, field neighbors and reopen');
   }finally{d.free();}
   // These four combinations exercise different failure modes, including
   // checks that can fail only on a later picture of the same owner.
   const modes=grid==='plain'?(ext==='hwp'?['duplicate inner index','anchor order','field before']:['field after','second layout']):
      (ext==='hwp'?['delete owner','resize owner']:['protected','third asset']);
   for(const mode of modes){
    const d=new HwpDocument(original);
    try{
     const cell=owner(d),path=JSON.stringify([{controlIndex:0,cellIndex:cell.index,cellParaIndex:0}]);
     let op=insert;
     if(mode==='field before'||mode==='field after'){
      const offset=mode==='field before'?0:d.getCellParagraphLength(...at,cell.index,0);
      d.insertClickHereFieldInCell(...at,cell.index,0,offset,false,'입력','사진 설명','설명',true);
     }
     if(mode==='protected')d.setCellProperties(...at,cell.index,'{"cellProtect":true}');
     if(mode==='delete owner')op={kind:'delete_table_row',target,index:1};
     if(mode==='resize owner')op={kind:'insert_table_column',target,index:2,values:['','','']};
     if(mode==='duplicate inner index'){
      const read=d.getPageControlLayout.bind(d);
      d.getPageControlLayout=page=>{
       const layout=JSON.parse(read(page));layout.controls.find(c=>c.type==='image'&&c.controlIdx===1).controlIdx=0;
       return JSON.stringify(layout);
      };
     }
     if(mode==='anchor order'){
      const read=d.getControls.bind(d);
      d.getControls=()=>{
       const controls=JSON.parse(read()),second=controls.find(c=>c.ctrlId==='gso'&&c.controlIndex===1);
       const first=controls.find(c=>c.list===second.list&&c.controlIndex===0);
       [first.pos,second.pos]=[second.pos,first.pos];
       return JSON.stringify(controls);
      };
     }
     if(mode==='second layout')damageLayoutAfterInsert(d);
     if(mode==='third asset'){
      const jpg=d.getControlImageData(0,1,path,2),nativeInsert=d.insertTableRow.bind(d);
      d.insertTableRow=(...args)=>{
       const result=nativeInsert(...args);
       const movedPath=JSON.stringify([{controlIndex:0,cellIndex:owner(d).index,cellParaIndex:0}]);
       assert.equal(JSON.parse(d.assignPictureImage(0,1,movedPath,2,jpg,48,24,'jpg')).ok,true);
       return result;
      };
     }
     const before=bytes(d,ext);assert.throws(()=>apply(d,ext,op),/그림|필드|보호/);assert.deepEqual(bytes(d,ext),before);
    }finally{d.free();}
   }
   console.log('PASS',grid,ext,'refuses and preserves bytes:',modes.join(', '));
  }
 }finally{source.free();}
}
