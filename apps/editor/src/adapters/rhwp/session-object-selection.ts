import {sha256} from '@noble/hashes/sha2.js';

export type RestorableObjectType='shape'|'group';
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

function reference(value:RawRef|undefined|null):RestorableObjectRef|undefined{
 if(!value||!integer(value.sec)||!integer(value.ppi)||!integer(value.ci)||!['shape','group'].includes(value.type)
   ||value.cellIdx!==undefined||value.cellParaIdx!==undefined||value.outerTableControlIdx!==undefined||(value.cellPath?.length??0)>0||value.noteRef!==undefined||value.headerFooter!==undefined||value.missing!==undefined||value.pageIndex!==undefined)return;
 return {section:value.sec,paragraph:value.ppi,control:value.ci,type:value.type as RestorableObjectType};
}
export function validateObjectSelectionBookmark(value:any):ObjectSelectionBookmark|undefined{
 if(!value||typeof value!=='object'||Array.isArray(value)||value.version!==1||value.kind!=='object-selection'||!Array.isArray(value.objects)||value.objects.length<1||value.objects.length>32||!integer(value.active)||value.active!==value.objects.length-1||!digest(value.documentFingerprint))return;
 const objects:ObjectSelectionEntry[]=[];
 for(const item of value.objects){
  if(!item||typeof item!=='object'||Array.isArray(item)||!integer(item.section)||!integer(item.paragraph)||!integer(item.control)||!['shape','group'].includes(item.type)||!digest(item.objectFingerprint))return;
  objects.push({section:item.section,paragraph:item.paragraph,control:item.control,type:item.type,objectFingerprint:item.objectFingerprint});
 }
 if(objects.length===1&&objects[0].type!=='group'||new Set(objects.map(key)).size!==objects.length)return;
 return {version:1,kind:'object-selection',objects,active:value.active,documentFingerprint:value.documentFingerprint};
}
function access(input:ObjectSelectionSessionInput){return input.wasm.borrowDocumentHandle?.()??input.wasm;}
function documentFingerprint(document:any):string|undefined{
 const bytes=document.exportHwpx?.();
 if(!(bytes instanceof Uint8Array)||bytes.length===0||bytes.length>32*1024*1024)return;
 return hashBytes(bytes);
}
function objectEvidence(document:any,ref:RestorableObjectRef):string|undefined{
 if(ref.section>=document.getSectionCount()||ref.paragraph>=document.getParagraphCount(ref.section))return;
 let flat=ref.paragraph;for(let section=0;section<ref.section;section++)flat+=document.getParagraphCount(section);
 const object=json(document.getObjects()).find((item:any)=>item?.para===flat&&item.controlIndex===ref.control);
 const control=json(document.getControls()).find((item:any)=>item?.list===0&&item.para===flat&&item.controlIndex===ref.control);
 if(!object||object.kind!=='shape'||object.anchored!==true||object.listId!==null||control?.ctrlId!=='gso'||control.props?.Lock!==0)return;
 const lists=json(document.getCursorModel()).lists;
 if(!Array.isArray(lists)||lists.some((list:any)=>list?.hostListId===0&&list.sectionIndex===ref.section&&list.hostPara===ref.paragraph&&list.controlIndex===ref.control))return;
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
  if(objects.length===1&&objects[0].type!=='group'||new Set(objects.map(key)).size!==objects.length||key(objects.at(-1)!)!==key(active))return;
  const document=access(input),fingerprint=documentFingerprint(document);if(!fingerprint)return;
  const entries=objects.map(ref=>{const objectFingerprint=objectEvidence(document,ref);return objectFingerprint?{...ref,objectFingerprint}:undefined;});
  if(entries.some(value=>!value))return;
  return validateObjectSelectionBookmark({version:1,kind:'object-selection',objects:entries,active:objects.length-1,documentFingerprint:fingerprint});
 }catch{return;}
}
export function restoreObjectSelection(input:ObjectSelectionSessionInput|undefined,value:unknown):boolean{
 const saved=validateObjectSelectionBookmark(value);if(!input||!saved||!input.restoreSessionObjectSelection||blocked(input))return false;
 try{
  const document=access(input);if(documentFingerprint(document)!==saved.documentFingerprint)return false;
  for(const {section,paragraph,control,type,objectFingerprint} of saved.objects){if(objectEvidence(document,{section,paragraph,control,type})!==objectFingerprint)return false;}
  return input.restoreSessionObjectSelection(saved.objects.map(({section,paragraph,control,type})=>({section,paragraph,control,type})));
 }catch{return false;}
}
