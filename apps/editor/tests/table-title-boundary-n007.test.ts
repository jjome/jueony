import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {readStructure} from '../src/adapters/rhwp/structure.ts';
import {executeDocumentOperations} from '../src/adapters/rhwp/execute.ts';
import {validateEditOperations,type EditOp,type Snapshot} from '../src/modules/document/public/index.ts';

const pkg=process.env.JUEONY_ENGINE_PACKAGE??fileURLToPath(new URL('../node_modules/@rhwp/core/',import.meta.url));
const {default:init,HwpDocument}=await import(pathToFileURL(resolve(pkg,'rhwp.js')).href);
await init({module_or_path:await readFile(resolve(pkg,'rhwp_bg.wasm'))});
const base=[0,1,0] as const,target='s0p1t0',columns=3,headerRows=2;
const parsed=(value:any)=>typeof value==='string'?JSON.parse(value):value;
const bytes=(doc:any,format:string):Uint8Array=>format==='hwp'?doc.exportHwp():doc.exportHwpx();
const ok=(value:any)=>assert.equal(parsed(value)?.ok,true);

function fixture(format:string){
 const source=HwpDocument.createEmpty();
 try{
  source.createBlankDocument();source.insertText(0,0,0,'표 앞 본문');source.splitParagraph(0,0,6);source.createTable(...base,5,columns);
  for(let index=0;index<15;index++){
   const row=Math.floor(index/columns),column=index%columns;
   ok(source.setCellProperties(...base,index,JSON.stringify({width:[6000,7000,8000][column],height:4200+row*300,isHeader:row<headerRows})));
   source.insertTextInCell(...base,index,0,0,(row<headerRows?'제목':'본문')+row+'-'+column);
  }
  ok(source.setTableProperties(...base,JSON.stringify({pageBreak:2,repeatHeader:true})));
  return new HwpDocument(bytes(source,format));
 }finally{source.free();}
}
function snapshot(doc:any,format:string,revision='n007-'+format):Snapshot{
 return{name:'반복제목.'+format,revision,nodes:[],limitations:[],structure:readStructure(doc)};
}
function rowTexts(doc:any){
 const table=readStructure(doc).tables[0];
 return Array.from({length:table.rows},(_,row)=>table.cells.find(cell=>cell.row===row&&cell.column===0)?.text);
}
function assertHeading(doc:any,expectedRows:number,expectedHeaderRows:number){
 const table=readStructure(doc).tables[0];
 assert.equal(table.rows,expectedRows);assert.equal(table.headerRows,expectedHeaderRows);
 assert.deepEqual(table.pagination,{mode:'row',repeatHeader:true});
 assert.ok(table.cells.every(cell=>cell.properties.isHeader===(cell.row<expectedHeaderRows)));
 return table;
}
function roundtrip(doc:any,format:string,edit:()=>void,verify:(doc:any)=>void){
 const before=bytes(doc,format),undo=doc.saveSnapshot();
 try{
  edit();verify(doc);const after=bytes(doc,format),redo=doc.saveSnapshot(),copy=new HwpDocument(after);
  try{verify(copy);assert.deepEqual(readStructure(copy).tables[0],readStructure(doc).tables[0]);
   doc.restoreSnapshot(undo);assert.deepEqual(bytes(doc,format),before);
   doc.restoreSnapshot(redo);assert.deepEqual(bytes(doc,format),after);
  }finally{copy.free();doc.discardSnapshot(redo);}
 }finally{doc.discardSnapshot(undo);}
}

for(const format of ['hwp','hwpx'])test(format+' safely inserts and deletes at the last-title/first-body boundary',()=>{
 const cases:Array<{op:EditOp;rows:number;titles:number;texts:string[]}>= [
  {op:{kind:'insert_table_row',target,index:1,values:['새 제목','새 제목2','새 제목3']},rows:6,titles:3,texts:['제목0-0','새 제목','제목1-0','본문2-0','본문3-0','본문4-0']},
  {op:{kind:'insert_table_row',target,index:2,values:['새 본문','새 본문2','새 본문3']},rows:6,titles:2,texts:['제목0-0','제목1-0','새 본문','본문2-0','본문3-0','본문4-0']},
  {op:{kind:'delete_table_row',target,index:1},rows:4,titles:1,texts:['제목0-0','본문2-0','본문3-0','본문4-0']},
  {op:{kind:'delete_table_row',target,index:2},rows:4,titles:2,texts:['제목0-0','제목1-0','본문3-0','본문4-0']},
 ];
 for(const entry of cases){
  const doc=fixture(format);
  try{const before=snapshot(doc,format),ops=validateEditOperations([entry.op],before);
   roundtrip(doc,format,()=>executeDocumentOperations(doc,before,ops),current=>{
    assertHeading(current,entry.rows,entry.titles);assert.deepEqual(rowTexts(current),entry.texts);
   });
  }finally{doc.free();}
 }
});

for(const format of ['hwp','hwpx'])test(format+' boundary edit rejects stale selection/revision evidence without a second mutation',()=>{
 const doc=fixture(format);
 try{
  const noRevision=snapshot(doc,format,'');const before=bytes(doc,format),op:EditOp={kind:'insert_table_row',target,index:2,values:['','','']};
  assert.throws(()=>executeDocumentOperations(doc,noRevision,[op]),/revision/);assert.deepEqual(bytes(doc,format),before);
  const stale=snapshot(doc,format);doc.insertTextInCell(...base,6,0,0,'외부 변경');const changed=bytes(doc,format);
  assert.throws(()=>executeDocumentOperations(doc,stale,[op]),/바뀌었습니다/);assert.deepEqual(bytes(doc,format),changed);
 }finally{doc.free();}
});

for(const format of ['hwp','hwpx'])for(const failure of ['proof','save'] as const)test(format+' boundary edit rolls back a '+failure+' failure',()=>{
 const doc=fixture(format);
 try{
  const state=snapshot(doc,format),before=bytes(doc,format),op:EditOp={kind:'insert_table_row',target,index:1,values:['','','']};
  const injected=new Proxy(doc,{get(owner,property){
   if(failure==='proof'&&property==='insertTableRow')return(...args:any[])=>{const result=owner.insertTableRow(...args);owner.setCellProperties(...base,0,JSON.stringify({isHeader:false}));return result;};
   if(failure==='save'&&property===(format==='hwp'?'exportHwpWithReport':'exportHwpxWithReport'))return()=>{throw Error('시험 저장 실패');};
   const value=Reflect.get(owner,property);return typeof value==='function'?value.bind(owner):value;
  }});
  assert.throws(()=>executeDocumentOperations(injected,state,validateEditOperations([op],state)),failure==='proof'?/반복 제목/:/시험 저장 실패/);
  assert.deepEqual(bytes(doc,format),before);assertHeading(doc,5,2);
 }finally{doc.free();}
});

for(const format of ['hwp','hwpx'])test(format+' boundary deletion fails closed for crossing spans, fields and complex owner cells',()=>{
 for(const mode of ['crossing','merged-owner','field','complex','object'] as const){
  const doc=fixture(format);
  try{
   if(mode==='crossing')ok(doc.mergeTableCells(...base,1,0,2,0));
   if(mode==='merged-owner')ok(doc.mergeTableCells(...base,1,0,1,1));
   if(mode==='field'){ok(doc.insertClickHereFieldInCell(...base,3,0,0,false,'안내','설명','제목 필드',true));doc.setFieldValueByName('제목 필드','값');}
   if(mode==='complex'){ok(doc.splitParagraphInCell(...base,3,0,2));doc.insertTextInCell(...base,3,1,0,'둘째 문단');}
   const state=snapshot(doc,format),before=bytes(doc,format),table=state.structure!.tables[0];
   if(mode==='object')table.cells.find(cell=>cell.row===1&&cell.column===0)!.axisPicture={signature:'a'.repeat(64),left:0,top:0};
   const op:EditOp={kind:'delete_table_row',target,index:1};
   assert.throws(()=>validateEditOperations([op],state),/반복 제목|병합|그림|필드|개체|보존 상태/);
   assert.deepEqual(bytes(doc,format),before,mode);
  }finally{doc.free();}
 }
});

test('first body row complex owner deletion is refused by the same boundary policy',()=>{
 const doc=fixture('hwpx');
 try{
  ok(doc.splitParagraphInCell(...base,6,0,2));doc.insertTextInCell(...base,6,1,0,'둘째 문단');
  const state=snapshot(doc,'hwpx'),before=bytes(doc,'hwpx'),op:EditOp={kind:'delete_table_row',target,index:2};
  assert.throws(()=>validateEditOperations([op],state),/개체|보존 상태/);assert.deepEqual(bytes(doc,'hwpx'),before);
 }finally{doc.free();}
});
