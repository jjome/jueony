import {sha256} from '@noble/hashes/sha2.js';

export type EndnotePoint={paragraph:number;offset:number;paragraphLength:number;before:string;after:string};
export type EndnoteRestoreTarget={section:number;parent:number;control:number;page:number;index:number;virtualParagraph:number;focus:{paragraph:number;offset:number};anchor?:{paragraph:number;offset:number}};
export type EndnoteSelectionBookmark={version:1;kind:'endnote-selection';section:number;parent:number;control:number;page:number;index:number;virtualParagraph:number;focus:EndnotePoint;anchor?:EndnotePoint;locatorFingerprint:string;ownerFingerprint:string;storyFingerprint:string};
type NoteSelection={anchor:{fnParaIdx:number;charOffset:number};focus:{fnParaIdx:number;charOffset:number};pageNum:number;footnoteIndex:number};
export type EndnoteSessionInput={
 restoreSessionEndnoteSelection?(target:EndnoteRestoreTarget):boolean;
 cursor:{
  isInFootnote():boolean;isInHeaderFooter():boolean;isInTextBox():boolean;isInTableObjectSelection():boolean;isInPictureObjectSelection():boolean;
  fnSectionIdx:number;fnParaIdx:number;fnControlIdx:number;fnInnerParaIdx:number;fnCharOffset:number;fnPageNum:number;fnFootnoteIndex:number;
  getFootnoteSelection():NoteSelection|null;
 };
 wasm:{requiresPasswordForSave?:boolean;borrowDocumentHandle?():any};
};

const integer=(value:unknown):value is number=>Number.isSafeInteger(value)&&(value as number)>=0&&(value as number)<=2147483647;
const digest=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/u.test(value);
const object=(value:any):value is Record<string,any>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const json=(value:any):any=>typeof value==='string'?JSON.parse(value):value;
function normalized(value:any):any{
 if(Array.isArray(value))return value.map(normalized);
 if(object(value))return Object.fromEntries(Object.keys(value).sort().filter(key=>!(value.fillType==='none'&&['fillColor','patternColor','patternType'].includes(key))).map(key=>[key,normalized(value[key])]));
 return value;
}
const hash=(value:unknown)=>Array.from(sha256(new TextEncoder().encode(JSON.stringify(normalized(value)))),byte=>byte.toString(16).padStart(2,'0')).join('');
const exactKeys=(value:Record<string,unknown>,keys:string[])=>{const actual=Object.keys(value).sort(),expected=[...keys].sort();return actual.length===expected.length&&actual.every((key,index)=>key===expected[index]);};

function point(value:any):EndnotePoint|undefined{
 if(!object(value)||!exactKeys(value,['paragraph','offset','paragraphLength','before','after'])||!integer(value.paragraph)||!integer(value.offset)||!integer(value.paragraphLength)||value.offset>value.paragraphLength||typeof value.before!=='string'||typeof value.after!=='string'||[...value.before].length>32||[...value.after].length>32)return;
 return {paragraph:value.paragraph,offset:value.offset,paragraphLength:value.paragraphLength,before:value.before,after:value.after};
}
export function validateEndnoteSelectionBookmark(value:any):EndnoteSelectionBookmark|undefined{
 if(!object(value)||value.version!==1||value.kind!=='endnote-selection'||!exactKeys(value,['version','kind','section','parent','control','page','index','virtualParagraph','focus',...(value.anchor===undefined?[]:['anchor']),'locatorFingerprint','ownerFingerprint','storyFingerprint'])||![value.section,value.parent,value.control,value.page,value.index,value.virtualParagraph].every(integer)||!digest(value.locatorFingerprint)||!digest(value.ownerFingerprint)||!digest(value.storyFingerprint))return;
 const focus=point(value.focus),anchor=value.anchor===undefined?undefined:point(value.anchor);if(!focus||value.anchor!==undefined&&!anchor)return;
 return {version:1,kind:'endnote-selection',section:value.section,parent:value.parent,control:value.control,page:value.page,index:value.index,virtualParagraph:value.virtualParagraph,focus,...(anchor?{anchor}:{}),locatorFingerprint:value.locatorFingerprint,ownerFingerprint:value.ownerFingerprint,storyFingerprint:value.storyFingerprint};
}

function access(input:EndnoteSessionInput){return input.wasm.borrowDocumentHandle?.()??input.wasm;}
function blocked(cursor:EndnoteSessionInput['cursor'],allowNote:boolean){return cursor.isInHeaderFooter()||cursor.isInTextBox()||cursor.isInTableObjectSelection()||cursor.isInPictureObjectSelection()||(!allowNote&&cursor.isInFootnote());}
function identity(value:any){return object(value)&&['semantic','instance'].includes(value.mode)&&(value.mode==='semantic'?value.instance===null:Number.isSafeInteger(value.instance)&&value.instance>0&&value.instance<=4294967295);}
function validateParagraphs(paragraphs:any[]):boolean{
 let size=0,runs=0;if(paragraphs.length<1||paragraphs.length>1024)return false;
 for(const paragraph of paragraphs){
  if(!object(paragraph)||typeof paragraph.text!=='string'||(size+=[...paragraph.text].length)>100000||!object(paragraph.paragraph)||!object(paragraph.endCharacters)||!object(paragraph.metadata)||!object(paragraph.style)||!Array.isArray(paragraph.controls)||paragraph.controls.some((control:any)=>!object(control)||Object.keys(control).length!==1||!object(control.AutoNumber))||!Array.isArray(paragraph.characters)||(runs+=paragraph.characters.length)>4096)return false;
  const length=[...paragraph.text].length;let offset=0;
  for(const run of paragraph.characters){if(!object(run)||!integer(run.start)||run.start!==offset||!integer(run.end)||run.end<=run.start||run.end>length||!object(run.properties))return false;offset=run.end;}
  if(offset!==length||length===0&&!object(paragraph.emptyCharacters))return false;
 }
 return true;
}
function evidence(document:any,section:number,parent:number,control:number){
 if(typeof document.getSessionStoryEvidence!=='function'||typeof document.getNoteEditInfo!=='function'||typeof document.getFootnoteInfo!=='function'||typeof document.getCursorRectInNote!=='function')return;
 const raw=document.getSessionStoryEvidence(JSON.stringify({kind:'endnote',section,parent,control}));if(typeof raw==='string'&&raw.length>32*1024*1024)return;const value=json(raw);
 if(!object(value)||value.version!==1||value.complete!==true||value.identityKnown!==true||value.kind!=='endnote'||value.section!==section||value.parent!==parent||value.control!==control||!identity(value.identity)||!object(value.owner)||!object(value.owner.Endnote)||!Array.isArray(value.context)||value.context.length<1||value.context.length>3||!Array.isArray(value.paragraphs)||!validateParagraphs(value.paragraphs))return;
 let targetCount=0;for(const context of value.context){if(!object(context)||!integer(context.paragraph)||typeof context.text!=='string'||[...context.text].length>100000||!object(context.paragraphProperties)||!object(context.host)||!Array.isArray(context.controlKinds)||!context.controlKinds.every(object))return;for(const kind of context.controlKinds)if(kind.kind==='endnote'&&kind.target===true)targetCount++;}
 if(targetCount!==1||!value.context.some((context:any)=>context.paragraph===parent))return;
 if(value.provenance!==undefined){const provenance=value.provenance;if(!object(provenance)||!exactKeys(provenance,['kind','story','context'])||provenance.kind!=='generated-paragraph-record-identities'||!Array.isArray(provenance.story)||provenance.story.length!==value.paragraphs.length||!provenance.story.every(identity)||!Array.isArray(provenance.context)||provenance.context.length!==value.context.length||!provenance.context.every((item:any,index:number)=>object(item)&&exactKeys(item,['paragraph','identity'])&&item.paragraph===value.context[index].paragraph&&identity(item.identity)))return;}
 const edit=json(document.getNoteEditInfo(section,parent,control));
 if(!object(edit)||edit.ok!==true||edit.kind!=='endnote'||![edit.pageNum,edit.footnoteIndex,edit.fnParaIndex,edit.charOffset,edit.virtualParaIndex].every(integer)||edit.fnParaIndex!==0)return;
 const info=json(document.getFootnoteInfo(section,parent,control));
 if(!object(info)||info.ok!==true||!integer(info.paraCount)||info.paraCount!==value.paragraphs.length||!integer(info.number)||info.number!==value.owner.Endnote.number||!Array.isArray(info.texts)||info.texts.length!==value.paragraphs.length||!info.texts.every((text:any,index:number)=>typeof text==='string'&&text===value.paragraphs[index].text))return;
 const semantic=value.provenance===undefined?value:Object.fromEntries(Object.entries(value).filter(([key])=>key!=='provenance'));
 const ownerFingerprint=hash({section,parent,control,identity:value.identity,owner:value.owner,target:value.context.map((context:any)=>({paragraph:context.paragraph,controlKinds:context.controlKinds.filter((kind:any)=>kind.kind==='endnote')}))});
 const storyFingerprint=hash({paragraphs:semantic.paragraphs,context:semantic.context});
 const locator={page:edit.pageNum,index:edit.footnoteIndex,virtualParagraph:edit.virtualParaIndex};
 return {value,edit,locator,locatorFingerprint:hash({section,parent,control,kind:'endnote',...locator,entryParagraph:edit.fnParaIndex,entryOffset:edit.charOffset}),ownerFingerprint,storyFingerprint};
}
function makePoint(document:any,story:any,section:number,parent:number,control:number,paragraph:number,offset:number):EndnotePoint|undefined{
 if(!integer(paragraph)||paragraph>=story.paragraphs.length||!integer(offset))return;const chars=[...story.paragraphs[paragraph].text];if(offset>chars.length)return;
 try{const rect=json(document.getCursorRectInNote(section,parent,control,paragraph,offset));if(!object(rect)||!integer(rect.pageIndex)||!Number.isFinite(rect.x)||!Number.isFinite(rect.y)||!Number.isFinite(rect.height)||rect.height<=0)return;}catch{return;}
 return {paragraph,offset,paragraphLength:chars.length,before:chars.slice(Math.max(0,offset-32),offset).join(''),after:chars.slice(offset,offset+32).join('')};
}
function samePoint(saved:EndnotePoint,current:EndnotePoint|undefined){return !!current&&saved.paragraph===current.paragraph&&saved.offset===current.offset&&saved.paragraphLength===current.paragraphLength&&saved.before===current.before&&saved.after===current.after;}

export function captureEndnoteSelection(input:EndnoteSessionInput|undefined):EndnoteSelectionBookmark|undefined{
 if(!input||!input.restoreSessionEndnoteSelection||input.wasm.requiresPasswordForSave||blocked(input.cursor,true)||!input.cursor.isInFootnote())return;
 const cursor=input.cursor;if(![cursor.fnSectionIdx,cursor.fnParaIdx,cursor.fnControlIdx,cursor.fnInnerParaIdx,cursor.fnCharOffset,cursor.fnPageNum,cursor.fnFootnoteIndex].every(integer))return;
 try{
  const document=access(input),observed=evidence(document,cursor.fnSectionIdx,cursor.fnParaIdx,cursor.fnControlIdx);if(!observed||observed.locator.page!==cursor.fnPageNum||observed.locator.index!==cursor.fnFootnoteIndex)return;
  const focus=makePoint(document,observed.value,cursor.fnSectionIdx,cursor.fnParaIdx,cursor.fnControlIdx,cursor.fnInnerParaIdx,cursor.fnCharOffset);if(!focus)return;
  const selection=cursor.getFootnoteSelection();let anchor:EndnotePoint|undefined;
  if(selection!==null&&selection!==undefined){if(!object(selection)||!object(selection.anchor)||!object(selection.focus)||selection.pageNum!==cursor.fnPageNum||selection.footnoteIndex!==cursor.fnFootnoteIndex||selection.focus.fnParaIdx!==cursor.fnInnerParaIdx||selection.focus.charOffset!==cursor.fnCharOffset)return;anchor=makePoint(document,observed.value,cursor.fnSectionIdx,cursor.fnParaIdx,cursor.fnControlIdx,selection.anchor.fnParaIdx,selection.anchor.charOffset);if(!anchor)return;}
  return validateEndnoteSelectionBookmark({version:1,kind:'endnote-selection',section:cursor.fnSectionIdx,parent:cursor.fnParaIdx,control:cursor.fnControlIdx,...observed.locator,focus,...(anchor?{anchor}:{}),locatorFingerprint:observed.locatorFingerprint,ownerFingerprint:observed.ownerFingerprint,storyFingerprint:observed.storyFingerprint});
 }catch{return;}
}
export function restoreEndnoteSelection(input:EndnoteSessionInput|undefined,value:unknown):boolean{
 const saved=validateEndnoteSelectionBookmark(value);if(!input||!saved||!input.restoreSessionEndnoteSelection||input.wasm.requiresPasswordForSave||blocked(input.cursor,false))return false;
 try{
  const document=access(input),observed=evidence(document,saved.section,saved.parent,saved.control);if(!observed||observed.locator.page!==saved.page||observed.locator.index!==saved.index||observed.locator.virtualParagraph!==saved.virtualParagraph||observed.locatorFingerprint!==saved.locatorFingerprint||observed.ownerFingerprint!==saved.ownerFingerprint||observed.storyFingerprint!==saved.storyFingerprint)return false;
  const focus=makePoint(document,observed.value,saved.section,saved.parent,saved.control,saved.focus.paragraph,saved.focus.offset);if(!samePoint(saved.focus,focus))return false;
  if(saved.anchor){const anchor=makePoint(document,observed.value,saved.section,saved.parent,saved.control,saved.anchor.paragraph,saved.anchor.offset);if(!samePoint(saved.anchor,anchor))return false;}
  return input.restoreSessionEndnoteSelection({section:saved.section,parent:saved.parent,control:saved.control,page:saved.page,index:saved.index,virtualParagraph:saved.virtualParagraph,focus:{paragraph:saved.focus.paragraph,offset:saved.focus.offset},...(saved.anchor?{anchor:{paragraph:saved.anchor.paragraph,offset:saved.anchor.offset}}:{})});
 }catch{return false;}
}
