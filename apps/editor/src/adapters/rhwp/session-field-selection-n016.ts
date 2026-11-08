import {sha256} from '@noble/hashes/sha2.js';

type Position={sectionIndex:number;paragraphIndex:number;charOffset:number;parentParaIndex?:number;controlIndex?:number;cellIndex?:number;cellParaIndex?:number;cellPath?:unknown[];isTextBox?:boolean};
type Selection={anchor:Position;focus:Position};

export type RootClickHereFieldSelectionBookmarkN016={
 version:1;
 kind:'root-clickhere-field-selection';
 fieldId:number;
 section:number;
 paragraph:number;
 start:number;
 end:number;
 direction:'forward'|'backward';
 fieldFingerprint:string;
 paragraphFingerprint:string;
 selectionFingerprint:string;
};

export type FieldSelectionSessionInputN016={
 getCursorPosition():Position;
 restoreSessionSelection(focus:Position,anchor:Position|undefined,phase:number|null,block:undefined):boolean;
 cursor:{
  hasSelection():boolean;
  getSelection():Selection|null;
  isInHeaderFooter():boolean;
  isInFootnote():boolean;
  isInTextBox():boolean;
  isInTableObjectSelection():boolean;
  isInPictureObjectSelection():boolean;
 };
 wasm:{requiresPasswordForSave?:boolean;borrowDocumentHandle?():unknown};
};

export type RootFieldSelectionCaptureDecisionN016=
 |{status:'not-field-selection'}
 |{status:'unsupported-field-selection'}
 |{status:'captured';bookmark:RootClickHereFieldSelectionBookmarkN016};

type NativeDocument={
 getSectionCount():number;
 getParagraphCount(section:number):number;
 getParagraphLength(section:number,paragraph:number):number;
 getTextRange(section:number,paragraph:number,offset:number,count:number):string;
 getFieldList():unknown;
 getFieldInfoAt(section:number,paragraph:number,offset:number):unknown;
 getFieldValue(fieldId:number):unknown;
 getCursorRect(section:number,paragraph:number,offset:number):unknown;
};

type Field={
 fieldId:number;fieldType:'clickhere';cellField:false;location:{sectionIndex:number;paraIndex:number};
 startCharIdx:number;endCharIdx:number;listId:0;paraInList:number;editableInForm:boolean;
};

const integer=(value:unknown):value is number=>Number.isSafeInteger(value)&&(value as number)>=0&&(value as number)<=2147483647;
const positive=(value:unknown):value is number=>integer(value)&&value>0;
const digest=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/u.test(value);
const parse=(value:unknown):any=>typeof value==='string'?JSON.parse(value):value;
function normalized(value:any):any{
 if(Array.isArray(value))return value.map(normalized);
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,normalized(value[key])]));
 return value;
}
const hash=(value:unknown)=>Array.from(sha256(new TextEncoder().encode(JSON.stringify(normalized(value)))),byte=>byte.toString(16).padStart(2,'0')).join('');

function documentOf(input:FieldSelectionSessionInputN016):NativeDocument|undefined{
 const value=input.wasm.borrowDocumentHandle?.()??input.wasm;
 if(!value||typeof value!=='object')return;
 const document=value as Partial<NativeDocument>;
 if(!['getSectionCount','getParagraphCount','getParagraphLength','getTextRange','getFieldList','getFieldInfoAt','getFieldValue','getCursorRect']
  .every(name=>typeof (document as any)[name]==='function'))return;
 return document as NativeDocument;
}
function blocked(input:FieldSelectionSessionInputN016):boolean{
 const cursor=input.cursor;
 return input.wasm.requiresPasswordForSave===true||cursor.isInHeaderFooter()||cursor.isInFootnote()||cursor.isInTextBox()
  ||cursor.isInTableObjectSelection()||cursor.isInPictureObjectSelection();
}
function bodyPosition(value:Position|undefined):value is Position{
 return Boolean(value)&&integer(value!.sectionIndex)&&integer(value!.paragraphIndex)&&integer(value!.charOffset)
  &&value!.parentParaIndex===undefined&&value!.controlIndex===undefined&&value!.cellIndex===undefined&&value!.cellParaIndex===undefined
  &&(value!.cellPath===undefined||value!.cellPath.length===0)&&value!.isTextBox!==true;
}
function samePosition(left:Position,right:Position):boolean{
 return left.sectionIndex===right.sectionIndex&&left.paragraphIndex===right.paragraphIndex&&left.charOffset===right.charOffset;
}
function validRect(value:unknown):boolean{
 const rect=parse(value);
 return Boolean(rect)&&typeof rect==='object'&&!Array.isArray(rect)&&integer(rect.pageIndex)
  &&['x','y','height'].every(key=>Number.isFinite(rect[key]))&&rect.height>0;
}
function asField(value:any):Field|undefined{
 if(!value||typeof value!=='object'||Array.isArray(value)||!positive(value.fieldId)||value.fieldType!=='clickhere'||value.cellField!==false
  ||!value.location||typeof value.location!=='object'||!integer(value.location.sectionIndex)||!integer(value.location.paraIndex)
  ||!integer(value.startCharIdx)||!integer(value.endCharIdx)||value.endCharIdx<=value.startCharIdx||value.listId!==0
  ||!integer(value.paraInList)||value.paraInList!==value.location.paraIndex||typeof value.editableInForm!=='boolean')return;
 return value as Field;
}
function fieldInfoMatches(value:unknown,field:Field):boolean{
 const info=parse(value);
 return Boolean(info)&&typeof info==='object'&&!Array.isArray(info)&&info.inField===true&&info.fieldId===field.fieldId
  &&info.fieldType==='clickhere'&&info.startCharIdx===field.startCharIdx&&info.endCharIdx===field.endCharIdx
  &&typeof info.isGuide==='boolean'&&typeof info.editableInForm==='boolean'&&info.editableInForm===field.editableInForm;
}
function fieldEvidence(document:NativeDocument,fieldId:number,section:number,paragraph:number,start:number,end:number){
 if(section>=document.getSectionCount()||paragraph>=document.getParagraphCount(section))return;
 const length=document.getParagraphLength(section,paragraph);
 if(!integer(length)||end>length||length>100000)return;
 const text=document.getTextRange(section,paragraph,0,length);
 if(typeof text!=='string'||[...text].length!==length)return;
 const fields=parse(document.getFieldList());
 if(!Array.isArray(fields)||fields.length>100000)return;
 const matches=fields.filter(value=>value?.fieldId===fieldId);
 if(matches.length!==1)return;
 const field=asField(matches[0]);
 if(!field||field.location.sectionIndex!==section||field.location.paraIndex!==paragraph||field.startCharIdx!==start||field.endCharIdx!==end)return;
 const startInfo=parse(document.getFieldInfoAt(section,paragraph,start));
 const endInfo=parse(document.getFieldInfoAt(section,paragraph,end));
 if(!fieldInfoMatches(startInfo,field)||!fieldInfoMatches(endInfo,field)||!validRect(document.getCursorRect(section,paragraph,start))||!validRect(document.getCursorRect(section,paragraph,end)))return;
 const value=parse(document.getFieldValue(fieldId));
 if(!value||typeof value!=='object'||Array.isArray(value)||value.ok!==true||typeof value.value!=='string'||value.value!==matches[0].value)return;
 const selected=[...text].slice(start,end).join('');
 if(selected.length===0||selected!==value.value)return;
 const fieldFingerprint=hash({field:matches[0],startInfo,endInfo,value});
 const paragraphFingerprint=hash({section,paragraph,length,text});
 return {fieldFingerprint,paragraphFingerprint,selectionFingerprint:hash({fieldFingerprint,paragraphFingerprint,start,end,selected})};
}

export function validateRootClickHereFieldSelectionN016(value:unknown):RootClickHereFieldSelectionBookmarkN016|undefined{
 if(!value||typeof value!=='object'||Array.isArray(value))return;
 const item=value as Record<string,unknown>;
 if(item.version!==1||item.kind!=='root-clickhere-field-selection'||!positive(item.fieldId)||!integer(item.section)||!integer(item.paragraph)
  ||!integer(item.start)||!integer(item.end)||(item.end as number)<=(item.start as number)||!['forward','backward'].includes(item.direction as string)
  ||!digest(item.fieldFingerprint)||!digest(item.paragraphFingerprint)||!digest(item.selectionFingerprint))return;
 return value as RootClickHereFieldSelectionBookmarkN016;
}

export function captureRootClickHereFieldSelectionN016(input:FieldSelectionSessionInputN016|undefined):RootClickHereFieldSelectionBookmarkN016|undefined{
 const decision=inspectRootClickHereFieldSelectionN016(input);
 return decision.status==='captured'?decision.bookmark:undefined;
}

export function inspectRootClickHereFieldSelectionN016(input:FieldSelectionSessionInputN016|undefined):RootFieldSelectionCaptureDecisionN016{
 if(!input||blocked(input)||!input.cursor.hasSelection())return {status:'not-field-selection'};
 try{
  const selection=input.cursor.getSelection(),current=input.getCursorPosition(),document=documentOf(input);
  if(!selection||!document)return {status:'not-field-selection'};
  const fields=parse(document.getFieldList());
  if(!Array.isArray(fields))return {status:'unsupported-field-selection'};
  if(!bodyPosition(selection.anchor)||!bodyPosition(selection.focus)||!bodyPosition(current)||!samePosition(current,selection.focus)){
   return fields.some(field=>field?.cellField===true)?{status:'unsupported-field-selection'}:{status:'not-field-selection'};
  }
  const ordered=[selection.anchor,selection.focus].sort((left,right)=>left.sectionIndex-right.sectionIndex||left.paragraphIndex-right.paragraphIndex||left.charOffset-right.charOffset);
  const [rangeStart,rangeEnd]=ordered;
  const intersects=fields.some(raw=>{
   if(raw?.cellField!==false||!raw.location||!integer(raw.location.sectionIndex)||!integer(raw.location.paraIndex)||!integer(raw.startCharIdx)||!integer(raw.endCharIdx))return false;
   const fieldStart={sectionIndex:raw.location.sectionIndex,paragraphIndex:raw.location.paraIndex,charOffset:raw.startCharIdx};
   const fieldEnd={sectionIndex:raw.location.sectionIndex,paragraphIndex:raw.location.paraIndex,charOffset:raw.endCharIdx};
   const compare=(left:Position,right:Position)=>left.sectionIndex-right.sectionIndex||left.paragraphIndex-right.paragraphIndex||left.charOffset-right.charOffset;
   return compare(fieldEnd,rangeStart)>=0&&compare(fieldStart,rangeEnd)<=0;
  });
  if(!intersects)return {status:'not-field-selection'};
  if(selection.anchor.sectionIndex!==selection.focus.sectionIndex||selection.anchor.paragraphIndex!==selection.focus.paragraphIndex)return {status:'unsupported-field-selection'};
  const section=selection.focus.sectionIndex,paragraph=selection.focus.paragraphIndex;
  const start=Math.min(selection.anchor.charOffset,selection.focus.charOffset),end=Math.max(selection.anchor.charOffset,selection.focus.charOffset);
  if(start===end)return {status:'unsupported-field-selection'};
  const candidates=fields.filter(raw=>{
   const field=asField(raw);
   return field?.location.sectionIndex===section&&field.location.paraIndex===paragraph&&field.startCharIdx===start&&field.endCharIdx===end;
  });
  if(candidates.length!==1)return {status:'unsupported-field-selection'};
  const field=asField(candidates[0]);if(!field)return {status:'unsupported-field-selection'};
  const evidence=fieldEvidence(document,field.fieldId,section,paragraph,start,end);if(!evidence)return {status:'unsupported-field-selection'};
  const bookmark=validateRootClickHereFieldSelectionN016({version:1,kind:'root-clickhere-field-selection',fieldId:field.fieldId,section,paragraph,start,end,
   direction:selection.focus.charOffset===end?'forward':'backward',...evidence});
  return bookmark?{status:'captured',bookmark}:{status:'unsupported-field-selection'};
 }catch{return {status:'unsupported-field-selection'};}
}

export function restoreRootClickHereFieldSelectionN016(input:FieldSelectionSessionInputN016|undefined,value:unknown):boolean{
 const saved=validateRootClickHereFieldSelectionN016(value);
 if(!input||!saved||blocked(input))return false;
 try{
  const document=documentOf(input),evidence=document&&fieldEvidence(document,saved.fieldId,saved.section,saved.paragraph,saved.start,saved.end);
  if(!evidence||evidence.fieldFingerprint!==saved.fieldFingerprint||evidence.paragraphFingerprint!==saved.paragraphFingerprint
   ||evidence.selectionFingerprint!==saved.selectionFingerprint)return false;
  const start={sectionIndex:saved.section,paragraphIndex:saved.paragraph,charOffset:saved.start};
  const end={sectionIndex:saved.section,paragraphIndex:saved.paragraph,charOffset:saved.end};
  return saved.direction==='forward'?input.restoreSessionSelection(end,start,null,undefined):input.restoreSessionSelection(start,end,null,undefined);
 }catch{return false;}
}
