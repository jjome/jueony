import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createAxisPictureFixture} from './lib/axis-picture-fixture.mjs';
import {loadReviewEngine} from './lib/hancom-review.mjs';
import {readStructure} from '../src/adapters/rhwp/structure.ts';
import {axisPictureReader,sameAxisPicture} from '../src/adapters/rhwp/axis-cell-picture.ts';
import {executeDocumentOperations} from '../src/adapters/rhwp/execute.ts';
import {validateEditOperations} from '../src/modules/document/public/index.ts';

const {HwpDocument}=await loadReviewEngine(resolve(process.env.JUEONY_ENGINE_PACKAGE));
const out=resolve(process.env.JUEONY_TEST_OUTPUT??resolve(import.meta.dirname,'../../../build/axis-paged-pictures-native'));
await mkdir(out,{recursive:true});
const base=[0,1,0],op={kind:'insert_table_row',target:'s0p1t0',index:1,values:['새 행','','']};
const raw=file=>JSON.parse(execFileSync('python',[resolve(import.meta.dirname,'lib/inspect-axis-picture.py'),'inspect-grouped',file],{encoding:'utf8'}));
const bytes=(d,ext)=>ext==='hwp'?d.exportHwp():d.exportHwpx();
function apply(d,ext){
 const snapshot={name:'사진 표.'+ext,nodes:[],limitations:[],revision:'1',structure:readStructure(d)};
 executeDocumentOperations(d,snapshot,validateEditOperations([op],snapshot));
}
function imagePages(d){
 assert.equal(d.pageCount(),2);
 return [0,1].flatMap(page=>JSON.parse(d.getPageControlLayout(page)).controls.filter(c=>c.type==='image').map(()=>page));
}
const fixture=await createAxisPictureFixture(HwpDocument,out,{merged:true,grouped:true});
try{
 fixture.setPageDef(0,JSON.stringify({...JSON.parse(fixture.getPageDef(0)),height:22000,marginTop:2000,marginBottom:2000,marginHeader:0,marginFooter:0}));
 fixture.setTableProperties(...base,'{"pageBreak":2,"repeatHeader":false}');
 for(const ext of ['hwp','hwpx']){
  const input=resolve(out,'before.'+ext),original=bytes(fixture,ext);
  await writeFile(input,original);const records=raw(input);
  const d=new HwpDocument(original);
  try{
   assert.deepEqual(imagePages(d),[0,0,0,1]);
   const sources=readStructure(d).tables[0].cells.filter(c=>c.axisPicture);assert.equal(sources.length,2);
   const tail=JSON.parse(d.getPageControlLayout(1)).controls.find(c=>c.type==='table').cells.find(c=>c.col===2);
   assert.notEqual(tail.cellIdx,sources[1].index);
   apply(d,ext);assert.deepEqual(imagePages(d),[1,1,1,1]);
   const current=readStructure(d),saved=resolve(out,'insert_table_row.'+ext);
   for(const c of sources)assert.ok(sameAxisPicture(c.axisPicture,current.tables[0].cells.find(v=>v.text===c.text).axisPicture));
   await writeFile(saved,bytes(d,ext));
   assert.deepEqual(raw(saved),records.map(p=>({...p,row:p.row+1})));
   const copy=new HwpDocument(await readFile(saved));
   try{assert.deepEqual(imagePages(copy),[1,1,1,1]);assert.deepEqual(readStructure(copy),current);}finally{copy.free();}
   console.log('PASS',ext,'four pictures, three move to the next page, exact records, resource IDs, cell bounds and reopened layouts');
  }finally{d.free();}
  const modes=ext==='hwp'?['repeated header','extra frame after edit']:['portable page mismatch','portable owner mismatch','clipped row'];
  for(const mode of modes){
   const d=new HwpDocument(original);
   try{
    if(mode==='repeated header'){
     for(const index of [0,1,2])d.setCellProperties(...base,index,'{"isHeader":true}');
     d.setTableProperties(...base,'{"repeatHeader":true}');
     assert.ok(JSON.parse(d.getPageControlLayout(1)).controls.find(c=>c.type==='table').cells.some(c=>c.row===0));
    }else if(mode==='extra frame after edit'){
     const insert=d.insertTableRow.bind(d),layout=d.getPageControlLayout.bind(d);
     let changed=false;d.insertTableRow=(...args)=>{const result=insert(...args);changed=true;return result;};
     d.getPageControlLayout=page=>{
      const frame=JSON.parse(layout(page));
      if(changed&&page===1)frame.controls.push(frame.controls.find(c=>c.type==='table'));
      return JSON.stringify(frame);
     };
    }else{
     const count=d.pageCount.bind(d),layout=d.getPageControlLayout.bind(d);
     let canvas=true;
     d.canvasMetricsActive=()=>canvas;d.selectCanvasMetrics=active=>{canvas=active;};
     if(mode==='portable page mismatch')d.pageCount=()=>count()+(!canvas?1:0);
     else d.getPageControlLayout=page=>{
      const frame=JSON.parse(layout(page));
      if(!canvas&&page===1){
       const first=frame.controls.find(c=>c.type==='table').cells[0];
       if(mode==='clipped row')first.h-=8;else first.row=0;
      }
      return JSON.stringify(frame);
     };
    }
    const before=bytes(d,ext);
    assert.throws(()=>apply(d,ext),/그림|필드|보존/);
    assert.deepEqual(bytes(d,ext),before);
    if(mode.startsWith('portable'))assert.equal(d.canvasMetricsActive(),true);
   }finally{d.free();}
  }
  console.log('PASS',ext,'refusal with original bytes:',modes.join(', '));
 }
 // Use one reader for different owners, as the production structure snapshot does.
 const cells=readStructure(fixture).tables[0].cells.filter(c=>c.axisPicture);
 const lists=JSON.parse(fixture.getCursorModel()).lists,controls=JSON.parse(fixture.getControls());
 const counters={screen:[0,0],portable:[0,0],paint:[0,0],keys:[0,0],switches:[]};
 let canvas=true;
 fixture.canvasMetricsActive=()=>canvas;
 fixture.selectCanvasMetrics=active=>{counters.switches.push(active);canvas=active;};
 for(const [method,bucket] of [['getPageControlLayout','layout'],['getPageFlowImageOps','paint'],['getPageSourceImageKeys','keys']]){
  const read=fixture[method].bind(fixture);
  fixture[method]=page=>{counters[bucket==='layout'?(canvas?'screen':'portable'):bucket][page]++;return read(page);};
 }
 const readPictures=axisPictureReader(fixture);
 for(const cell of cells){
  const list=lists.find(l=>l.hostListId===0&&l.hostPara===1&&l.controlIndex===0&&l.cellIndex===cell.index);
  assert.ok(readPictures(...base,cell,list.paraCount,controls.filter(c=>c.list===list.listId)));
 }
 assert.deepEqual(counters,{screen:[1,1],portable:[1,1],paint:[1,1],keys:[1,1],switches:[false,true]});
 console.log('PASS each page and metric mode read once for both owners, screen metric mode restored');
}finally{fixture.free();}
