import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import init,{HwpDocument} from '@rhwp/core';
import {applySymbolInsertionB090,captureSymbolInsertionB090,readRecentSymbolsB090,rememberRecentSymbolB090,validateSymbolB090} from '../src/adapters/rhwp/symbol-insertion-b090.ts';

await init({module_or_path:await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm',import.meta.url))});

function fixture(document:any){
 let revision='r1',position:any={sectionIndex:0,paragraphIndex:0,charOffset:0},operations:any[]=[];
 const cursor={hasSelection:()=>false,isInHeaderFooter:()=>false,isInFootnote:()=>false,isInTextBox:()=>false};
 const input:any={active:true,isComposing:false,isFormMode:()=>false,cursor,wasm:{requiresPasswordForSave:false,borrowDocumentHandle:()=>document},getPosition:()=>structuredClone(position),getCursorPosition:()=>structuredClone(position),executeOperation(operation:any){operations.push(operation);const snapshot=document.saveSnapshot();try{return operation.operation(this.wasm);}catch(error){document.restoreSnapshot(snapshot);document.discardSnapshot(snapshot);throw error;}}};
 const context:any={hasDocument:true,isEditable:true,isFormMode:false,inTable:false,inCellSelectionMode:false,inPictureObjectSelection:false,inTableObjectSelection:false,inField:false};
 return {input,context,operations,revision:()=>revision,setRevision:(value:string)=>revision=value,setPosition:(value:any)=>position=value};
}

test('B090 validates Unicode scalars without normalizing old-Hangul sequences',()=>{
 const old='\u1100\u1161\u11ab',emoji='😀';
 assert.equal(validateSymbolB090(old),old);assert.equal(validateSymbolB090(emoji),emoji);
 for(const value of['','x'.repeat(9),'\n','\u202e','\ufffc','\ud800'])assert.throws(()=>validateSymbolB090(value));
});

test('B090 stores at most twenty validated unique recent entries',()=>{
 let value='not-json';const store={read:()=>value,write:(next:string)=>{value=next;}};
 assert.deepEqual(readRecentSymbolsB090(store),[]);
 for(let point=0x2460;point<0x2460+24;point++)assert.equal(rememberRecentSymbolB090(store,String.fromCodePoint(point)),true);
 assert.equal(readRecentSymbolsB090(store).length,20);const newest=String.fromCodePoint(0x2460+23);
 assert.equal(readRecentSymbolsB090(store)[0],newest);rememberRecentSymbolB090(store,String.fromCodePoint(0x2460+10));assert.equal(readRecentSymbolsB090(store)[0],String.fromCodePoint(0x2460+10));
 const broken={read:()=>value,write:()=>{throw new Error('quota');}};assert.equal(rememberRecentSymbolB090(broken,'☆'),false);
});

test('B090 inserts one exact sequence through one snapshot and persists HWP/HWPX',()=>{
 for(const format of['Hwp','Hwpx'] as const){const document:any=HwpDocument.createEmpty();document.createBlankDocument();document.insertText(0,0,0,'앞뒤');let reopened:any,value='[]';
  try{const f=fixture(document);f.setPosition({sectionIndex:0,paragraphIndex:0,charOffset:1});const store={read:()=>value,write:(next:string)=>{value=next;}};
   const plan=captureSymbolInsertionB090(f.input,f.context,f.revision(),'\u1100\u1161\u11ab');assert.equal(applySymbolInsertionB090(f.input,f.context,f.revision(),plan,store).recentStored,true);
   assert.equal(f.operations.length,1);assert.equal(f.operations[0].operationType,'jueonyInsertSymbolB090');assert.equal(document.getTextRange(0,0,0,5),'앞\u1100\u1161\u11ab뒤');
   reopened=new HwpDocument(document[`export${format}`]());assert.equal(reopened.getTextRange(0,0,0,reopened.getParagraphLength(0,0)),'앞\u1100\u1161\u11ab뒤');assert.deepEqual(readRecentSymbolsB090(store),['\u1100\u1161\u11ab']);
  }finally{reopened?.free();document.free();}
 }
});

test('B090 fails closed for selection, protected stories, controls and stale evidence',()=>{
 const cases=[(f:any)=>f.input.cursor.hasSelection=()=>true,(f:any)=>f.input.isComposing=true,(f:any)=>f.input.wasm.requiresPasswordForSave=true,(f:any)=>f.context.inTable=true,(f:any)=>f.input.cursor.isInTextBox=()=>true];
 for(const change of cases){const document:any=HwpDocument.createEmpty();document.createBlankDocument();try{const f=fixture(document);change(f);assert.throws(()=>captureSymbolInsertionB090(f.input,f.context,f.revision(),'☆'));assert.equal(f.operations.length,0);}finally{document.free();}}
 for(const stale of['revision','position','text']){const document:any=HwpDocument.createEmpty();document.createBlankDocument();try{const f=fixture(document),plan=captureSymbolInsertionB090(f.input,f.context,f.revision(),'☆');if(stale==='revision')f.setRevision('r2');else if(stale==='position')f.setPosition({sectionIndex:0,paragraphIndex:0,charOffset:1});else document.insertText(0,0,0,'x');assert.throws(()=>applySymbolInsertionB090(f.input,f.context,f.revision(),plan));assert.equal(document.getTextRange(0,0,0,document.getParagraphLength(0,0)),stale==='text'?'x':'');}finally{document.free();}}
});
