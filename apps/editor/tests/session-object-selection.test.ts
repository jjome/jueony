import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';
import {captureObjectSelection,restoreObjectSelection,validateObjectSelectionBookmark} from '../src/adapters/rhwp/session-object-selection.ts';

function fixture(){
 let bytes=new Uint8Array([1,2,3]),text='본문',blocked='',calls=0,active=1;
 const refs:any[]=[{sec:0,ppi:1,ci:0,type:'group'},{sec:0,ppi:1,ci:1,type:'shape'}];
 const props:any[]=[{width:9000,height:4000,horzOffset:1000,vertOffset:2000,sizeProtect:false,hasCaption:false,instanceId:0},{width:4000,height:3000,horzOffset:12000,vertOffset:2000,sizeProtect:false,hasCaption:false,instanceId:9,scInstId:10,rotationAngle:0}];
 const document:any={exportHwpx:()=>bytes,getSectionCount:()=>1,getParagraphCount:()=>2,getParagraphLength:()=>[...text].length,getTextRange:()=>text,getObjects:()=>refs.map(ref=>({para:ref.ppi,controlIndex:ref.ci,kind:'shape',listId:null,anchored:true})),getControls:()=>refs.map(ref=>({list:0,para:ref.ppi,controlIndex:ref.ci,ctrlId:'gso',props:{Lock:0}})),getCursorModel:()=>({lists:[]}),getShapeProperties:(_s:number,_p:number,c:number)=>props[c]};
 const cursor:any={isInPictureObjectSelection:()=>blocked!=='picture',isInTableObjectSelection:()=>blocked==='table',isInHeaderFooter:()=>blocked==='header',isInFootnote:()=>blocked==='footnote',isInTextBox:()=>blocked==='textbox',getSelectedPictureRefs:()=>refs,getSelectedPictureRef:()=>refs[active]};
 const input:any={wasm:{borrowDocumentHandle:()=>document},cursor,restoreSessionObjectSelection:(value:any)=>{calls++;assert.deepEqual(value,[{section:0,paragraph:1,control:0,type:'group'},{section:0,paragraph:1,control:1,type:'shape'}]);return true;}};
 return {input,refs,props,setBytes:(value:number[])=>bytes=new Uint8Array(value),setText:(value:string)=>text=value,setBlocked:(value:string)=>blocked=value,setActive:(value:number)=>active=value,calls:()=>calls};
}
test('group plus root shape selection captures ordered active object and strips transient fields',()=>{const f=fixture();f.refs[0].future='ignored';const saved=captureObjectSelection(f.input)!;assert.equal(saved.kind,'object-selection');assert.equal(saved.active,1);assert.equal(saved.objects.length,2);assert.deepEqual(Object.keys(saved.objects[0]).sort(),['control','objectFingerprint','paragraph','section','type']);assert.deepEqual(validateObjectSelectionBookmark(saved),saved);assert.equal(restoreObjectSelection(f.input,saved),true);assert.equal(f.calls(),1);});
test('one group is restorable but one ordinary shape and a non-active tail are rejected',()=>{const f=fixture();f.refs.splice(1);f.setActive(0);const group=captureObjectSelection(f.input);assert.equal(group?.objects[0].type,'group');f.refs[0].type='shape';assert.equal(captureObjectSelection(f.input),undefined);f.refs.push({sec:0,ppi:1,ci:1,type:'shape'});f.setActive(0);assert.equal(captureObjectSelection(f.input),undefined);});
test('document bytes, object properties and host text are independent stale guards',()=>{for(const mode of ['document','properties','text']){const f=fixture(),saved=captureObjectSelection(f.input)!;if(mode==='document')f.setBytes([1,2,4]);if(mode==='properties')f.props[1].width++;if(mode==='text')f.setText('변경');assert.equal(restoreObjectSelection(f.input,saved),false,mode);assert.equal(f.calls(),0);}});
test('nested, captioned, locked, duplicate, protected and special-story refs fail closed',()=>{for(const mode of ['cell','caption','lock','duplicate','password','header','table','textbox']){const f=fixture();if(mode==='cell')f.refs[0].cellPath=[{}];if(mode==='caption')f.props[0].hasCaption=true;if(mode==='lock'){const controls=f.input.wasm.borrowDocumentHandle().getControls;f.input.wasm.borrowDocumentHandle().getControls=()=>controls().map((c:any,i:number)=>i?c:{...c,props:{Lock:1}});}if(mode==='duplicate')f.refs[1]={...f.refs[0]};if(mode==='password')f.input.wasm.requiresPasswordForSave=true;if(['header','table','textbox'].includes(mode))f.setBlocked(mode);assert.equal(captureObjectSelection(f.input),undefined,mode);}});
test('validator rejects forged digests, addresses, active index and unsupported object kinds',()=>{const f=fixture(),saved:any=captureObjectSelection(f.input)!;for(const change of [(v:any)=>v.documentFingerprint='bad',(v:any)=>v.objects[0].objectFingerprint='bad',(v:any)=>v.objects[0].section=-1,(v:any)=>v.objects[0].type='image',(v:any)=>v.active=0,(v:any)=>v.objects=[]]){const value=structuredClone(saved);change(value);assert.equal(validateObjectSelectionBookmark(value),undefined);}});

test('restore verifies group selection readback and rolls back the prior exact selection on a lying callback',()=>{
 const f=fixture(),saved=captureObjectSelection(f.input)!;let current=[structuredClone(f.refs[0])],calls=0;
 f.input.cursor.getSelectedPictureRefs=()=>current;f.input.cursor.getSelectedPictureRef=()=>current.at(-1)??null;
 f.input.restoreSessionObjectSelection=(refs:any[])=>{calls++;if(calls>1)current=refs.map(ref=>({sec:ref.section,ppi:ref.paragraph,ci:ref.control,type:ref.type}));return true;};
 assert.equal(restoreObjectSelection(f.input,saved),false);assert.equal(calls,2);assert.deepEqual(current,[f.refs[0]]);
});

async function customEngine(){
 const pkg=process.env.JUEONY_ENGINE_PACKAGE??resolve('apps/editor/node_modules/@rhwp/core');
 const root=pathToFileURL(resolve(pkg)+'\\');const {default:init,HwpDocument}=await import(new URL('rhwp.js',root).href);
 await init({module_or_path:await readFile(new URL('rhwp_bg.wasm',root))});return HwpDocument;
}
async function groupedDocument(){
 const HwpDocument=await customEngine(),document=HwpDocument.createEmpty();document.createBlankDocument();document.splitParagraph(0,0,0);
 assert.equal(JSON.parse(document.createShapeControl(JSON.stringify({sectionIdx:0,paraIdx:0,charOffset:0,width:5000,height:3000,shapeType:'rectangle'}))).ok,true);
 assert.equal(JSON.parse(document.createShapeControl(JSON.stringify({sectionIdx:0,paraIdx:1,charOffset:0,width:4000,height:2000,shapeType:'ellipse'}))).ok,true);
 const objects=JSON.parse(document.getObjects()),group=JSON.parse(document.groupShapes(JSON.stringify({sectionIdx:0,targets:objects.map((object:any)=>({paraIdx:object.para,controlIdx:object.controlIndex}))})));
 assert.equal(group.ok,true);return document;
}
function groupInput(document:any){
 const object=JSON.parse(document.getObjects())[0];let selected:any[]=[{sec:0,ppi:object.para,ci:object.controlIndex,type:'group'}],calls=0;
 const input:any={wasm:{borrowDocumentHandle:()=>document},cursor:{isInPictureObjectSelection:()=>true,isInTableObjectSelection:()=>false,isInHeaderFooter:()=>false,isInFootnote:()=>false,isInTextBox:()=>false,
  getSelectedPictureRefs:()=>selected,getSelectedPictureRef:()=>selected.at(-1)??null},restoreSessionObjectSelection:(refs:any[])=>{calls++;selected=refs.map(ref=>({sec:ref.section,ppi:ref.paragraph,ci:ref.control,type:ref.type}));return true;}};
 return {input,calls:()=>calls,selected:()=>selected};
}

test('custom Rust group owner, type, properties and geometry survive HWP/HWPX reopen with byte-invariant restore',async()=>{
 const source=await groupedDocument();try{
  const saved=captureObjectSelection(groupInput(source).input)!;assert.equal(saved.objects.length,1);assert.equal(saved.objects[0].type,'group');
  for(const format of ['hwp','hwpx'] as const){
   const bytes=format==='hwp'?source.exportHwp():source.exportHwpx(),HwpDocument=await customEngine(),reopened=new HwpDocument(bytes);try{
    const fixture=groupInput(reopened),before=format==='hwp'?reopened.exportHwp():reopened.exportHwpx();
    assert.deepEqual(captureObjectSelection(fixture.input),saved,`${format} exact group owner/type/properties/geometry`);
    assert.equal(restoreObjectSelection(fixture.input,saved),true,format);assert.equal(fixture.calls(),1);assert.deepEqual(fixture.selected(),
     saved.objects.map(object=>({sec:object.section,ppi:object.paragraph,ci:object.control,type:object.type})));
    assert.deepEqual(format==='hwp'?reopened.exportHwp():reopened.exportHwpx(),before,`${format} restore is byte invariant`);
   }finally{reopened.free();}
  }
 }finally{source.free();}
});
