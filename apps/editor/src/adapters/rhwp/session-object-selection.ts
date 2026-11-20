import {sha256} from '@noble/hashes/sha2.js';

export type RestorableObjectType='shape'|'group'|'image'|'equation';
export type RestorableObjectRef={section:number;paragraph:number;control:number;type:RestorableObjectType};
export type ObjectSelectionEntry=RestorableObjectRef&{objectFingerprint:string};
export type ObjectSelectionBookmark={version:1;kind:'object-selection';objects:ObjectSelectionEntry[];active:number;documentFingerprint:string};
type RawRef={sec:number;ppi:number;ci:number;type:string;cellIdx?:number;cellParaIdx?:number;outerTableControlIdx?:number;cellPath?:unknown[];noteRef?:unknown;headerFooter?:unknown;missing?:boolean;pageIndex?:number};
export type ObjectSelectionSessionInput={
 restoreSessionObjectSelection?(refs:RestorableObjectRef[]):boolean;
 cursor:{isInPictureObjectSelection():boolean;isInTableObjectSelection():boolean;isInHeaderFooter():boolean;isInFootnote():boolean;isInTextBox():boolean;getSelectedPictureRef?():RawRef|null;getSelectedPictureRefs?():RawRef[]};
 wasm:{requiresPasswordForSave?:boolean;borrowDocumentHandle?():any};
};

const integer=(value:unknown):value is number=>Number.isSafeInteger(value)&&(value as number)>=0&&(value as number)<=2147483647;
const instance=(value:unknown):value is number=>Number.isSafeInteger(value)&&(value as number)>0&&(value as number)<=4294967295;
const digest=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/u.test(value);
const json=(value:any):any=>typeof value==='string'?JSON.parse(value):value;
function normalized(value:any):any{if(Array.isArray(value))return value.map(normalized);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,normalized(value[key])]));return value;}
const hashJson=(value:any)=>Array.from(sha256(new TextEncoder().encode(JSON.stringify(normalized(value)))),v=>v.toString(16).padStart(2,'0')).join('');
const hashBytes=(value:Uint8Array)=>Array.from(sha256(value),v=>v.toString(16).padStart(2,'0')).join('');
const key=(ref:RestorableObjectRef)=>`${ref.section}:${ref.paragraph}:${ref.control}:${ref.type}`;
const rawKey=(ref:RawRef)=>`${ref.sec}:${ref.ppi}:${ref.ci}:${ref.type}`;

function reference(value:RawRef|undefined|null):RestorableObjectRef|undefined{
 if(!value||!integer(value.sec)||!integer(value.ppi)||!integer(value.ci)||!['shape','group','image','equation'].includes(value.type)
   ||value.cellIdx!==undefined||value.cellParaIdx!==undefined||value.outerTableControlIdx!==undefined||(value.cellPath?.length??0)>0||value.noteRef!==undefined||value.headerFooter!==undefined||value.missing!==undefined||value.pageIndex!==undefined)return;
 return {section:value.sec,paragraph:value.ppi,control:value.ci,type:value.type as RestorableObjectType};
}
function validSelectionKinds(objects:ReadonlyArray<Pick<RestorableObjectRef,'type'>>):boolean{
 const images=objects.every(object=>object.type==='image');
 if(images)return objects.length>=2;
 const equations=objects.every(object=>object.type==='equation');
 if(equations)return objects.length>=2;
 return objects.every(object=>object.type==='shape'||object.type==='group')&&(objects.length>1||objects[0]?.type==='group');
}
function currentRestorableSelection(input:ObjectSelectionSessionInput):RestorableObjectRef[]|undefined{
 const raw=input.cursor.getSelectedPictureRefs?.(),active=input.cursor.getSelectedPictureRef?.();
 if(!Array.isArray(raw)||raw.length<1||raw.length>32||!active||rawKey(raw.at(-1)!)!==rawKey(active))return;
 const refs=raw.map(reference);if(refs.some(value=>!value))return;
 const values=refs as RestorableObjectRef[];if(new Set(values.map(key)).size!==values.length)return;
 return values;
}
function sameSelection(input:ObjectSelectionSessionInput,expected:RestorableObjectRef[]):boolean{
 const actual=currentRestorableSelection(input);
 return Boolean(actual)&&actual!.length===expected.length&&expected.every((value,index)=>key(value)===key(actual![index]));
}
export function validateObjectSelectionBookmark(value:any):ObjectSelectionBookmark|undefined{
 if(!value||typeof value!=='object'||Array.isArray(value)||value.version!==1||value.kind!=='object-selection'||!Array.isArray(value.objects)||value.objects.length<1||value.objects.length>32||!integer(value.active)||value.active!==value.objects.length-1||!digest(value.documentFingerprint))return;
 const objects:ObjectSelectionEntry[]=[];
 for(const item of value.objects){
  if(!item||typeof item!=='object'||Array.isArray(item)||!integer(item.section)||!integer(item.paragraph)||!integer(item.control)||!['shape','group','image','equation'].includes(item.type)||!digest(item.objectFingerprint))return;
  objects.push({section:item.section,paragraph:item.paragraph,control:item.control,type:item.type,objectFingerprint:item.objectFingerprint});
 }
 if(!validSelectionKinds(objects)||new Set(objects.map(key)).size!==objects.length)return;
 return {version:1,kind:'object-selection',objects,active:value.active,documentFingerprint:value.documentFingerprint};
}
function access(input:ObjectSelectionSessionInput){return input.wasm.borrowDocumentHandle?.()??input.wasm;}
function byteDocumentFingerprint(document:any):string|undefined{
 const bytes=document.exportHwpx?.();
 if(!(bytes instanceof Uint8Array)||bytes.length===0||bytes.length>32*1024*1024)return;
 return hashBytes(bytes);
}
function equationDocumentFingerprint(document:any):string|undefined{
 const sectionCount=document.getSectionCount?.();if(!integer(sectionCount)||sectionCount<1||sectionCount>1024)return;
 const sections:any[]=[];let paragraphTotal=0,characterTotal=0;
 for(let section=0;section<sectionCount;section++){
  const paragraphCount=document.getParagraphCount?.(section);if(!integer(paragraphCount)||(paragraphTotal+=paragraphCount)>100000)return;
  const paragraphs:any[]=[];
  for(let paragraph=0;paragraph<paragraphCount;paragraph++){
   const length=document.getParagraphLength?.(section,paragraph);if(!integer(length)||(characterTotal+=length)>16*1024*1024)return;
   const text=document.getTextRange?.(section,paragraph,0,length);if(typeof text!=='string'||[...text].length!==length)return;
   paragraphs.push({length,text});
  }
  sections.push(paragraphs);
 }
 const controls=json(document.getControls?.()),objects=json(document.getObjects?.());
 if(!Array.isArray(controls)||!Array.isArray(objects)||controls.length>100000||objects.length>100000)return;
 const serialized=JSON.stringify([controls,objects]);if(serialized.length>16*1024*1024)return;
 return hashJson({version:1,sections,controls,objects});
}
function documentFingerprint(document:any,objects:ReadonlyArray<Pick<RestorableObjectRef,'type'>>):string|undefined{
 // A top-level group is the only vector singleton that can be restored. Like
 // equations, its HWP conversion rewrites the HWPX package container while the
 // public document graph stays exact, so a raw package hash would reject the
 // same group after a valid HWP reopen.
 return objects.every(object=>object.type==='equation'||object.type==='group')?equationDocumentFingerprint(document):byteDocumentFingerprint(document);
}
function objectEvidence(document:any,ref:RestorableObjectRef):string|undefined{
 if(ref.section>=document.getSectionCount()||ref.paragraph>=document.getParagraphCount(ref.section))return;
 let flat=ref.paragraph;for(let section=0;section<ref.section;section++)flat+=document.getParagraphCount(section);
 const object=json(document.getObjects()).find((item:any)=>item?.para===flat&&item.controlIndex===ref.control);
 const control=json(document.getControls()).find((item:any)=>item?.list===0&&item.para===flat&&item.controlIndex===ref.control);
 const expectedKind=ref.type==='image'?'picture':ref.type==='equation'?'equation':'shape';
 const expectedControl=ref.type==='equation'?'eqed':'gso';
 if(!object||object.kind!==expectedKind||object.anchored!==true||object.listId!==null||control?.ctrlId!==expectedControl
   ||(ref.type==='equation'?control.props?.Lock!==undefined&&control.props.Lock!==0:control.props?.Lock!==0))return;
 const lists=json(document.getCursorModel()).lists;
 if(!Array.isArray(lists)||lists.some((list:any)=>list?.hostListId===0&&list.sectionIndex===ref.section&&list.hostPara===ref.paragraph&&list.controlIndex===ref.control))return;
 if(ref.type==='image'){
  const properties=json(document.getPictureProperties?.(ref.section,ref.paragraph,ref.control)),serialized=JSON.stringify(properties);
  const bytes=document.getControlImageData?.(ref.section,ref.paragraph,'',ref.control),mime=document.getControlImageMime?.(ref.section,ref.paragraph,'',ref.control);
  if(!properties||typeof properties!=='object'||Array.isArray(properties)||!serialized||serialized.length>16384
    ||properties.hasCaption!==false||properties.sizeProtect!==false||!integer(properties.width)||properties.width===0||!integer(properties.height)||properties.height===0
    ||!(bytes instanceof Uint8Array)||bytes.length===0||bytes.length>8*1024*1024||typeof mime!=='string'||!mime.startsWith('image/'))return;
  const length=document.getParagraphLength(ref.section,ref.paragraph);if(!integer(length)||length>100000)return;
  const text=document.getTextRange(ref.section,ref.paragraph,0,length);if(typeof text!=='string'||[...text].length!==length)return;
  return hashJson([ref,object,{ctrlId:control.ctrlId,lock:control.props.Lock},properties,mime,hashBytes(bytes),text]);
 }
 if(ref.type==='equation'){
  const properties=json(document.getEquationProperties?.(ref.section,ref.paragraph,ref.control,-1,-1)),serialized=JSON.stringify(properties);
  if(!properties||typeof properties!=='object'||Array.isArray(properties)||!serialized||serialized.length>65536
    ||properties.hasCaption!==false||properties.sizeProtect!==false||!integer(properties.width)||properties.width===0||!integer(properties.height)||properties.height===0
    ||!instance(properties.instanceId)||typeof properties.script!=='string'||properties.script.length===0||properties.script.length>32768
    ||!integer(properties.fontSize)||properties.fontSize===0||!integer(properties.color)||!integer(properties.baseline)||typeof properties.fontName!=='string'||properties.fontName.length===0)return;
  const length=document.getParagraphLength(ref.section,ref.paragraph);if(!integer(length)||length>100000)return;
  const text=document.getTextRange(ref.section,ref.paragraph,0,length);if(typeof text!=='string'||[...text].length!==length)return;
  return hashJson([ref,object,{ctrlId:control.ctrlId,lock:control.props.Lock??null},properties,text]);
 }
 const properties=json(document.getShapeProperties(ref.section,ref.paragraph,ref.control)),serialized=JSON.stringify(properties);
 if(!properties||typeof properties!=='object'||Array.isArray(properties)||serialized.length>65536||properties.hasCaption!==false||properties.sizeProtect!==false
   ||!integer(properties.width)||properties.width===0||!integer(properties.height)||properties.height===0||!integer(properties.horzOffset)||!integer(properties.vertOffset))return;
 if(ref.type==='group'){
  if(properties.instanceId!==0||Object.hasOwn(properties,'scInstId')||Object.hasOwn(properties,'rotationAngle'))return;
 }else if(!instance(properties.instanceId)||!instance(properties.scInstId)||!integer(properties.rotationAngle))return;
 const length=document.getParagraphLength(ref.section,ref.paragraph);
 if(!integer(length)||length>100000)return;
 const text=document.getTextRange(ref.section,ref.paragraph,0,length);
 if(typeof text!=='string'||[...text].length!==length)return;
 return hashJson([ref,object,{ctrlId:control.ctrlId,lock:control.props.Lock},properties,text]);
}
function blocked(input:ObjectSelectionSessionInput){const cursor=input.cursor;return input.wasm.requiresPasswordForSave||cursor.isInTableObjectSelection()||cursor.isInHeaderFooter()||cursor.isInFootnote()||cursor.isInTextBox();}
export function captureObjectSelection(input:ObjectSelectionSessionInput|undefined):ObjectSelectionBookmark|undefined{
 if(!input||!input.restoreSessionObjectSelection||blocked(input)||!input.cursor.isInPictureObjectSelection())return;
 try{
  const raw=input.cursor.getSelectedPictureRefs?.(),active=reference(input.cursor.getSelectedPictureRef?.());
  if(!Array.isArray(raw)||!active||raw.length<1||raw.length>32)return;
  const refs=raw.map(reference);if(refs.some(value=>!value))return;
  const objects=refs as RestorableObjectRef[];
  if(!validSelectionKinds(objects)||new Set(objects.map(key)).size!==objects.length||key(objects.at(-1)!)!==key(active))return;
  const document=access(input),fingerprint=documentFingerprint(document,objects);if(!fingerprint)return;
  const entries=objects.map(ref=>{const objectFingerprint=objectEvidence(document,ref);return objectFingerprint?{...ref,objectFingerprint}:undefined;});
  if(entries.some(value=>!value))return;
  return validateObjectSelectionBookmark({version:1,kind:'object-selection',objects:entries,active:objects.length-1,documentFingerprint:fingerprint});
 }catch{return;}
}
export function restoreObjectSelection(input:ObjectSelectionSessionInput|undefined,value:unknown):boolean{
 const saved=validateObjectSelectionBookmark(value);if(!input||!saved||!input.restoreSessionObjectSelection||blocked(input))return false;
 try{
  const document=access(input);if(documentFingerprint(document,saved.objects)!==saved.documentFingerprint)return false;
  for(const {section,paragraph,control,type,objectFingerprint} of saved.objects){if(objectEvidence(document,{section,paragraph,control,type})!==objectFingerprint)return false;}
  const expected=saved.objects.map(({section,paragraph,control,type})=>({section,paragraph,control,type})),previous=currentRestorableSelection(input);
  const restored=input.restoreSessionObjectSelection(expected);
  if(restored&&sameSelection(input,expected))return true;
  if(previous)try{input.restoreSessionObjectSelection(previous);}catch{/* The selection remains untrusted; never report success. */}
  return false;
 }catch{return false;}
}
