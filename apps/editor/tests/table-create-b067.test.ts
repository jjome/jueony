import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import init,{HwpDocument} from '@rhwp/core';
import {applyTableCreateB067,captureTableCreateB067,gridTableRequestB067,keyboardTableRequestB067} from '../src/adapters/rhwp/table-create-b067.ts';

await init({module_or_path:await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm',import.meta.url))});

function fixture(document:any){
 let revision='r1',position:any={sectionIndex:0,paragraphIndex:0,charOffset:0},operations:any[]=[];
 const cursor={hasSelection:()=>false,isInHeaderFooter:()=>false,isInFootnote:()=>false,isInTextBox:()=>false};
 const input:any={active:true,isComposing:false,isFormMode:()=>false,cursor,wasm:{requiresPasswordForSave:false,borrowDocumentHandle:()=>document},getPosition:()=>structuredClone(position),getCursorPosition:()=>structuredClone(position),executeOperation(operation:any){operations.push(operation);const snapshot=document.saveSnapshot?.();try{return operation.operation(this.wasm);}catch(error){if(snapshot!==undefined){document.restoreSnapshot(snapshot);document.discardSnapshot(snapshot);}throw error;}}};
 const context:any={hasDocument:true,isEditable:true,isFormMode:false,inTable:false,inCellSelectionMode:false,inPictureObjectSelection:false,inTableObjectSelection:false,inField:false};
 return {input,context,operations,revision:()=>revision,setRevision:(value:string)=>revision=value,setPosition:(value:any)=>position=value};
}

test('B067 validates the 8x10 picker and bounded keyboard dimensions',()=>{
 assert.deepEqual(gridTableRequestB067(8,10),{source:'grid',rows:8,columns:10});
 assert.deepEqual(keyboardTableRequestB067(64,64),{source:'keyboard',rows:64,columns:64});
 for(const value of[[0,1],[9,1],[1,11],[1.5,2]])assert.throws(()=>gridTableRequestB067(...value));
 for(const value of[[0,1],[257,1],[1,257],[65,64],[2.2,2]])assert.throws(()=>keyboardTableRequestB067(...value));
});

test('B067 creates one table through one snapshot and proves its readback',()=>{
 const doc:any=HwpDocument.createEmpty();doc.createBlankDocument();
 try{const f=fixture(doc),plan=captureTableCreateB067(f.input,f.context,f.revision(),gridTableRequestB067(3,4));applyTableCreateB067(f.input,f.context,f.revision(),plan);
  assert.equal(f.operations.length,1);assert.equal(f.operations[0].operationType,'jueonyCreateTableB067');
  const table=JSON.parse(doc.getControls()).find((item:any)=>item.ctrlId==='tbl');assert.ok(table);
  assert.deepEqual(JSON.parse(doc.getTableDimensions(0,table.para,table.controlIndex)),{rowCount:3,colCount:4,cellCount:12});
 }finally{doc.free();}
});

test('B067 HWP and HWPX export reopen retain exact table dimensions',()=>{
 for(const format of['Hwp','Hwpx'] as const){const doc:any=HwpDocument.createEmpty();doc.createBlankDocument();let reopened:any;
  try{const f=fixture(doc),plan=captureTableCreateB067(f.input,f.context,f.revision(),keyboardTableRequestB067(2,3));applyTableCreateB067(f.input,f.context,f.revision(),plan);
   reopened=new HwpDocument(doc[`export${format}`]());const table=JSON.parse(reopened.getControls()).find((item:any)=>item.ctrlId==='tbl');assert.ok(table,format);
   assert.deepEqual(JSON.parse(reopened.getTableDimensions(0,table.para,table.controlIndex)),{rowCount:2,colCount:3,cellCount:6});
  }finally{reopened?.free();doc.free();}
 }
});

test('B067 splits a non-empty paragraph at an exact scalar caret and preserves text formatting in HWP/HWPX',()=>{
 for(const format of['Hwp','Hwpx'] as const){const doc:any=HwpDocument.createEmpty();doc.createBlankDocument();let reopened:any;
  try{doc.insertText(0,0,0,'앞😀뒤');doc.applyCharFormat(0,0,0,1,JSON.stringify({bold:true}));doc.applyCharFormat(0,0,1,3,JSON.stringify({italic:true,textColor:'#ff0000'}));
   const f=fixture(doc);f.setPosition({sectionIndex:0,paragraphIndex:0,charOffset:1});const plan=captureTableCreateB067(f.input,f.context,f.revision(),keyboardTableRequestB067(2,3));applyTableCreateB067(f.input,f.context,f.revision(),plan);
   assert.deepEqual(Array.from({length:doc.getParagraphCount(0)},(_,p)=>doc.getTextRange(0,p,0,doc.getParagraphLength(0,p))),['앞','','','😀뒤']);
   assert.equal(JSON.parse(doc.getCharPropertiesAt(0,0,0)).bold,true);assert.equal(JSON.parse(doc.getCharPropertiesAt(0,3,0)).italic,true);
   reopened=new HwpDocument(doc[`export${format}`]());const table=JSON.parse(reopened.getControls()).find((item:any)=>item.ctrlId==='tbl');assert.ok(table,format);
   assert.deepEqual(JSON.parse(reopened.getTableDimensions(0,table.para,table.controlIndex)),{rowCount:2,colCount:3,cellCount:6});
   assert.deepEqual(Array.from({length:reopened.getParagraphCount(0)},(_,p)=>reopened.getTextRange(0,p,0,reopened.getParagraphLength(0,p))),['앞','','','😀뒤']);
   assert.equal(JSON.parse(reopened.getCharPropertiesAt(0,0,0)).bold,true);assert.equal(JSON.parse(reopened.getCharPropertiesAt(0,3,0)).textColor,'#ff0000');
  }finally{reopened?.free();doc.free();}
 }
});

test('B067 fails closed for non-empty/special/selected/protected and stale dialog state',()=>{
 const cases=[
  (f:any)=>f.input.cursor.hasSelection=()=>true,
  (f:any)=>f.input.isComposing=true,
  (f:any)=>f.input.wasm.requiresPasswordForSave=true,
  (f:any)=>f.context.inTable=true,
  (f:any)=>f.input.cursor.isInTextBox=()=>true,
 ];
 for(const change of cases){const doc:any=HwpDocument.createEmpty();doc.createBlankDocument();try{const f=fixture(doc);change(f);assert.throws(()=>captureTableCreateB067(f.input,f.context,f.revision(),gridTableRequestB067(1,1)));assert.equal(f.operations.length,0);}finally{doc.free();}}
 const nonempty:any=HwpDocument.createEmpty();nonempty.createBlankDocument();nonempty.insertText(0,0,0,'본문');try{const f=fixture(nonempty);assert.throws(()=>captureTableCreateB067(f.input,f.context,f.revision(),gridTableRequestB067(1,1)),/맨 앞/);}finally{nonempty.free();}
 for(const stale of['revision','position','structure']){const doc:any=HwpDocument.createEmpty();doc.createBlankDocument();try{const f=fixture(doc),plan=captureTableCreateB067(f.input,f.context,f.revision(),gridTableRequestB067(1,1));if(stale==='revision')f.setRevision('r2');else if(stale==='position')f.setPosition({sectionIndex:0,paragraphIndex:0,charOffset:1});else doc.insertText(0,0,0,'x');assert.throws(()=>applyTableCreateB067(f.input,f.context,f.revision(),plan));assert.equal(f.operations.length,0);assert.equal(JSON.parse(doc.getControls()).some((item:any)=>item.ctrlId==='tbl'),false);}finally{doc.free();}}
});

test('B067 malformed receipt/readback rolls the snapshot back instead of reporting success',()=>{
 let controls:any[]=[];let snapshots=0;const document:any={getSectionCount:()=>1,getParagraphCount:()=>1,getParagraphLength:()=>0,getTextRange:()=>'',getControls:()=>JSON.stringify(controls),saveSnapshot:()=>++snapshots,restoreSnapshot:()=>{controls=[];},discardSnapshot:()=>{},createTable:()=>{controls=[{list:0,para:0,controlIndex:0,ctrlId:'tbl'}];return JSON.stringify({ok:true,paraIdx:0,controlIdx:0});},getTableDimensions:()=>({rowCount:9,colCount:9,cellCount:81})};
 const f=fixture(document),plan=captureTableCreateB067(f.input,f.context,f.revision(),gridTableRequestB067(2,2));assert.throws(()=>applyTableCreateB067(f.input,f.context,f.revision(),plan),/크기/);assert.deepEqual(controls,[]);assert.equal(f.operations.length,1);
});
