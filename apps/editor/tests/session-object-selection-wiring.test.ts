import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {captureSessionCursor,restoreSessionCursor} from '../src/adapters/rhwp/session-cursor.ts';
import {validateDocumentView,validateSessionCursor} from '../src/modules/preferences/public/index.ts';

function fixture(){
 let bytes=new Uint8Array([7,8,9]),text='개체 선택 본문',calls=0;
 const refs:any[]=[{sec:0,ppi:1,ci:0,type:'group'},{sec:0,ppi:1,ci:1,type:'shape'}];
 const props:any[]=[
  {width:9000,height:4000,horzOffset:1000,vertOffset:2000,sizeProtect:false,hasCaption:false,instanceId:0},
  {width:4000,height:3000,horzOffset:12000,vertOffset:2000,sizeProtect:false,hasCaption:false,instanceId:9,scInstId:10,rotationAngle:0},
 ];
 const document:any={
  exportHwpx:()=>bytes,getSectionCount:()=>1,getParagraphCount:()=>2,getParagraphLength:()=>[...text].length,getTextRange:()=>text,
  getObjects:()=>refs.map(ref=>({para:ref.ppi,controlIndex:ref.ci,kind:'shape',listId:null,anchored:true})),
  getControls:()=>refs.map(ref=>({list:0,para:ref.ppi,controlIndex:ref.ci,ctrlId:'gso',props:{Lock:0}})),
  getCursorModel:()=>({lists:[]}),getShapeProperties:(_s:number,_p:number,c:number)=>props[c],
 };
 let restored:any;
 const input:any={
  getCursorPosition:()=>({sectionIndex:0,paragraphIndex:1,charOffset:0}),restoreSessionSelection:()=>false,
  cursor:{hasSelection:()=>false,getSelection:()=>null,blockSelectionPhase:()=>null,captureCellSelection:()=>null,
   isInHeaderFooter:()=>false,isInFootnote:()=>false,isInTextBox:()=>false,isInTableObjectSelection:()=>false,isInPictureObjectSelection:()=>true,
   getSelectedPictureRefs:()=>refs,getSelectedPictureRef:()=>refs.at(-1),isMultiPictureSelection:()=>true},
  wasm:{borrowDocumentHandle:()=>document,requiresPasswordForSave:false},
  restoreSessionObjectSelection:(value:any)=>{calls++;restored=structuredClone(value);return true;},
 };
 return {input,refs,props,calls:()=>calls,restored:()=>restored,setBytes:(value:number[])=>bytes=new Uint8Array(value),setText:(value:string)=>text=value};
}

test('shared SessionCursor and document-view pipeline preserve an ordered grouped object selection',()=>{
 const f=fixture(),saved=captureSessionCursor(f.input)!;
 assert.equal(saved.kind,'object-selection');
 assert.deepEqual(validateSessionCursor(saved),saved);
 const view=validateDocumentView({version:1,zoom:1,fitMode:'none',scrollX:4,scrollY:5,cursor:saved});
 assert.deepEqual(view?.cursor,saved);
 assert.equal(restoreSessionCursor(f.input,view!.cursor),true);
 assert.deepEqual(f.restored(),[{section:0,paragraph:1,control:0,type:'group'},{section:0,paragraph:1,control:1,type:'shape'}]);
 assert.equal(f.calls(),1);
});

test('shared restore revalidates document, object and host evidence before invoking Studio callback',()=>{
 for(const mode of ['document','object','host','callback']){
  const f=fixture(),saved=captureSessionCursor(f.input)!;
  if(mode==='document')f.setBytes([7,8,0]);
  if(mode==='object')f.props[1].width++;
  if(mode==='host')f.setText('같은 길이 변경');
  if(mode==='callback')f.input.restoreSessionObjectSelection=undefined;
  assert.equal(restoreSessionCursor(f.input,saved),false,mode);
  assert.equal(f.calls(),0,mode);
 }
});

test('unsupported single shapes and mixed image selections do not become fake restorable cursors',()=>{
 const single=fixture();single.refs.splice(1);single.refs[0].type='shape';single.props[0]={...single.props[1]};assert.equal(captureSessionCursor(single.input),undefined);
 const mixed=fixture();mixed.refs[1].type='image';assert.equal(captureSessionCursor(mixed.input),undefined);
 const forged:any=captureSessionCursor(fixture().input)!;forged.active=0;
 assert.equal(validateSessionCursor(forged),undefined);
});

test('Studio patch restores object order and verifies the resulting live selection',async()=>{
 const source=await readFile(new URL('../scripts/integration/studio-patches.mjs',import.meta.url),'utf8');
 assert.match(source,/restoreSessionObjectSelection:/);
 assert.match(source,/enterPictureObjectSelectionDirect\(ref\.section,ref\.paragraph,ref\.control,ref\.type\)/);
 assert.match(source,/togglePictureObjectSelection\(ref\.section,ref\.paragraph,ref\.control,ref\.type\)/);
 assert.match(source,/restored\.length!==refs\.length/);
 assert.match(source,/renderPictureObjectSelection\(\)/);
 assert.match(source,/catch\{\s*this\.cursor\.exitPictureObjectSelection\(\);return false;/);
});
