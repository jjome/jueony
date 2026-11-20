import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {captureTextBoxCursor} from '../src/adapters/rhwp/session-textbox.ts';
import {restoreStudioTextBoxCursorN014} from '../src/adapters/rhwp/session-textbox-studio-restore-n014.ts';
import {validateTextBoxBookmark} from '../src/modules/preferences/public/index.ts';

const pkg=process.env.JUEONY_ENGINE_PACKAGE??fileURLToPath(new URL('../node_modules/@rhwp/core/',import.meta.url));
const {default:init,HwpDocument}=await import(pathToFileURL(resolve(pkg,'rhwp.js')).href);
await init({module_or_path:await readFile(resolve(pkg,'rhwp_bg.wasm'))});

type Position={sectionIndex:number;paragraphIndex:number;charOffset:number;parentParaIndex?:number;controlIndex?:number;cellIndex?:number;cellParaIndex?:number;cellPath?:any[];isTextBox?:boolean};
const clone=<T>(value:T):T=>structuredClone(value);
function cursor(initial:Position){
 let position=clone(initial),anchor:Position|undefined;
 const value:any={
  getPosition:()=>clone(position),moveTo:(next:Position)=>position=clone(next),setAnchor:()=>anchor??=clone(position),clearSelection:()=>anchor=undefined,
  getSelection:()=>anchor?{anchor:clone(anchor),focus:clone(position)}:null,hasSelection:()=>anchor!==undefined,
  exitHeaderFooterMode:()=>{},exitFootnoteMode:()=>{},exitCellSelectionMode:()=>{},exitBlockSelectionMode:()=>{},exitTableObjectSelection:()=>{},exitPictureObjectSelection:()=>{},resetPreferredX:()=>{},
 };
 return value;
}
function createRootTextBox(){
 const document=HwpDocument.createEmpty();document.createBlankDocument();document.splitParagraph(0,0,0);
 const created=JSON.parse(document.createShapeControl(JSON.stringify({sectionIdx:0,paraIdx:1,charOffset:0,width:9000,height:4000,treatAsChar:true,shapeType:'textbox'})));
 assert.equal(created.ok,true);document.insertTextInCell(0,1,created.controlIdx,0,0,0,'글상자');return document;
}
const target=(offset:number):Position=>({sectionIndex:0,paragraphIndex:0,charOffset:offset,parentParaIndex:1,controlIndex:0,cellIndex:0,cellParaIndex:0,cellPath:[{controlIndex:0,cellIndex:0,cellParaIndex:0}],isTextBox:true});
function bookmark(document:any){
 const focus=target(3),anchor=target(0),captureCursor=cursor(anchor);captureCursor.setAnchor();captureCursor.moveTo(focus);
 const captured=captureTextBoxCursor({wasm:{borrowDocumentHandle:()=>document},getCursorPosition:()=>captureCursor.getPosition(),cursor:{
  isInTextBox:()=>true,isInHeaderFooter:()=>false,isInFootnote:()=>false,isInTableObjectSelection:()=>false,isInPictureObjectSelection:()=>false,
  hasSelection:()=>captureCursor.hasSelection(),getSelection:()=>captureCursor.getSelection()},restoreSessionTextBox:()=>true});
 const properties=JSON.parse(document.getShapeProperties(0,1,0));
 if(properties.tbVerticalAlignKnown===true)assert.ok(captured,'patched engine must expose a capturable root textbox story');
 return captured??validateTextBoxBookmark({kind:'textbox',focus:{kind:'body',caret:{section:0,paragraph:1,offset:0,paragraphLength:0,before:'',after:''}},control:0,
  caret:{section:0,paragraph:0,offset:3,paragraphLength:3,before:'글상자',after:''},anchor:{section:0,paragraph:0,offset:0,paragraphLength:3,before:'',after:'글상자'},storyFingerprint:'a'.repeat(64)});
}
const bytes=(document:any,format:'hwp'|'hwpx'):Uint8Array=>format==='hwp'?document.exportHwp():document.exportHwpx();

test('Studio root textbox callback restores exact range after real HWP/HWPX reopen without document writes',()=>{
 const source=createRootTextBox();try{
  for(const format of ['hwp','hwpx'] as const){const reopened=new HwpDocument(bytes(source,format));try{
   const saved=bookmark(reopened);assert.ok(saved,format);
   const live=cursor({sectionIndex:0,paragraphIndex:0,charOffset:0}),before=bytes(reopened,format);
   assert.equal(restoreStudioTextBoxCursorN014({cursor:live,wasm:{borrowDocumentHandle:()=>reopened}},saved),true,format);
   assert.deepEqual(live.getPosition(),target(3));assert.deepEqual(live.getSelection(),{anchor:target(0),focus:target(3)});
   assert.deepEqual(bytes(reopened,format),before,`${format} callback is read-only`);
  }finally{reopened.free();}}
 }finally{source.free();}
});

test('caption ambiguity and post-move readback mismatch fail closed',()=>{
 const document=createRootTextBox();try{
  const saved=bookmark(document);assert.ok(saved);
  assert.equal(JSON.parse(document.setShapeProperties(0,1,0,JSON.stringify({hasCaption:true,captionText:'캡션'}))).ok,true);
  const untouched=cursor({sectionIndex:0,paragraphIndex:0,charOffset:0});
  assert.equal(restoreStudioTextBoxCursorN014({cursor:untouched,wasm:{borrowDocumentHandle:()=>document}},saved),false);
  assert.deepEqual(untouched.getPosition(),{sectionIndex:0,paragraphIndex:0,charOffset:0});
 }finally{document.free();}
 const clean=createRootTextBox();try{
  const saved=bookmark(clean),broken=cursor({sectionIndex:0,paragraphIndex:0,charOffset:0});
  broken.getPosition=()=>({sectionIndex:0,paragraphIndex:0,charOffset:99});
  assert.equal(restoreStudioTextBoxCursorN014({cursor:broken,wasm:{borrowDocumentHandle:()=>clean}},saved),false);
 }finally{clean.free();}
});

test('Studio patch delegates the browser callback to the fail-closed N014 adapter',async()=>{
 const source=await readFile(new URL('../scripts/integration/studio-patches.mjs',import.meta.url),'utf8');
 assert.match(source,/restoreStudioTextBoxCursorN014.*session-textbox-studio-restore-n014/u);
 assert.match(source,/if\(!restoreStudioTextBoxCursorN014\(\{cursor:this\.cursor,wasm:this\.wasm\},saved\)\)return false;/u);
 assert.doesNotMatch(source,/restoreSessionTextBox:[\s\S]{0,900}const point=/u);
});
