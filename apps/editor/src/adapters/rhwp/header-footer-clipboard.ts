import {sha256} from '@noble/hashes/sha2.js';

export type ClipboardRevision=string|number;
export type HeaderFooterPoint={paragraph:number;offset:number};
export type HeaderFooterTextSelection={
 section:number;
 isHeader:boolean;
 applyTo:0|1|2;
 anchor:HeaderFooterPoint;
 focus:HeaderFooterPoint;
};
export type HeaderFooterClipboardSession={
 document:any;
 documentIdentity():string;
 revision():ClipboardRevision;
 selection():HeaderFooterTextSelection|null;
};
type StoryOwner={section:number;isHeader:boolean;applyTo:0|1|2;paragraph:number;control:number};
type SourceSeal={
 documentIdentity:string;
 revision:ClipboardRevision;
 owner:StoryOwner;
 selection:HeaderFooterTextSelection;
 storyFingerprint:string;
 originalText:string;
};
export type HeaderFooterClipboardPayload={
 version:1;
 kind:'jueony-header-footer-plain-text';
 source:SourceSeal;
 text:string;
 integrity:string;
};
export type HeaderFooterPasteTarget={
 version:1;
 kind:'jueony-header-footer-paste-target';
 documentIdentity:string;
 revision:ClipboardRevision;
 owner:StoryOwner;
 selection:HeaderFooterTextSelection;
 storyFingerprint:string;
 originalText:string;
 integrity:string;
};
export type HeaderFooterClipboardReceipt={
 readonly operation:'cut'|'paste';
 readonly documentIdentity:string;
 readonly beforeRevision:ClipboardRevision;
 readonly afterRevision:ClipboardRevision;
 readonly beforeStoryFingerprint:string;
 readonly afterStoryFingerprint:string;
};

type Story={owner:StoryOwner;paragraphs:string[];fingerprint:string};
type ReceiptState={document:any;snapshot:number;owner:StoryOwner;before:Story;after:Story;consumed:boolean};
const receipts=new WeakMap<HeaderFooterClipboardReceipt,ReceiptState>();
const integer=(value:unknown):value is number=>Number.isSafeInteger(value)&&(value as number)>=0&&(value as number)<=2147483647;
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const digest=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/u.test(value);
const revision=(value:unknown):value is ClipboardRevision=>(typeof value==='string'&&value.length>0&&value.length<=1024)||(typeof value==='number'&&Number.isSafeInteger(value));
const json=(value:any):any=>typeof value==='string'?JSON.parse(value):value;
const exact=(value:Record<string,unknown>,keys:string[])=>{const actual=Object.keys(value).sort(),expected=[...keys].sort();return actual.length===expected.length&&actual.every((key,index)=>key===expected[index]);};
const hash=(value:unknown)=>Array.from(sha256(new TextEncoder().encode(JSON.stringify(value))),byte=>byte.toString(16).padStart(2,'0')).join('');
const chars=(value:string)=>[...value];
const same=(left:unknown,right:unknown)=>JSON.stringify(left)===JSON.stringify(right);
const validIdentity=(value:unknown):value is string=>typeof value==='string'&&value.length>0&&value.length<=4096;

function point(value:unknown):HeaderFooterPoint|undefined{
 if(!object(value)||!exact(value,['paragraph','offset'])||!integer(value.paragraph)||!integer(value.offset))return;
 return {paragraph:value.paragraph,offset:value.offset};
}
export function validateHeaderFooterSelection(value:unknown):HeaderFooterTextSelection|undefined{
 if(!object(value)||!exact(value,['section','isHeader','applyTo','anchor','focus'])||!integer(value.section)||typeof value.isHeader!=='boolean'||![0,1,2].includes(value.applyTo as number))return;
 const anchor=point(value.anchor),focus=point(value.focus);if(!anchor||!focus)return;
 return {section:value.section,isHeader:value.isHeader,applyTo:value.applyTo as 0|1|2,anchor,focus};
}
function ordered(selection:HeaderFooterTextSelection){return selection.anchor.paragraph<selection.focus.paragraph||selection.anchor.paragraph===selection.focus.paragraph&&selection.anchor.offset<=selection.focus.offset?{start:selection.anchor,end:selection.focus}:{start:selection.focus,end:selection.anchor};}
function sameOwner(selection:HeaderFooterTextSelection,owner:StoryOwner){return selection.section===owner.section&&selection.isHeader===owner.isHeader&&selection.applyTo===owner.applyTo;}
function assertDocument(document:any){for(const method of ['getHeaderFooter','getHeaderFooterParaInfo','copySelectionInHeaderFooter','replaceRangeInHeaderFooter','saveSnapshot','restoreSnapshot','discardSnapshot'])if(typeof document?.[method]!=='function')throw new Error(`머리말/꼬리말 클립보드 API가 없습니다: ${method}`);}
function readStory(document:any,selection:HeaderFooterTextSelection):Story{
 assertDocument(document);
 const header=json(document.getHeaderFooter(selection.section,selection.isHeader,selection.applyTo));
 if(!object(header)||header.ok!==true||header.exists!==true||header.applyTo!==selection.applyTo||!integer(header.paraIndex)||!integer(header.controlIndex)||!integer(header.paraCount)||header.paraCount<1||header.paraCount>1024)throw new Error('머리말/꼬리말 소유자를 확인하지 못했습니다.');
 const paragraphs:string[]=[];let total=0;
 for(let index=0;index<header.paraCount;index++){
  const info=json(document.getHeaderFooterParaInfo(selection.section,selection.isHeader,selection.applyTo,index));
  if(!object(info)||info.ok!==true||info.paraCount!==header.paraCount||!integer(info.charCount)||typeof info.text!=='string'||chars(info.text).length!==info.charCount||(total+=info.charCount)>100000)throw new Error('머리말/꼬리말 원문을 완전하게 읽지 못했습니다.');
  paragraphs.push(info.text);
 }
 const owner:StoryOwner={section:selection.section,isHeader:selection.isHeader,applyTo:selection.applyTo,paragraph:header.paraIndex,control:header.controlIndex};
 return {owner,paragraphs,fingerprint:hash({owner,paragraphs})};
}
function selectedText(story:Story,selection:HeaderFooterTextSelection,allowCollapsed:boolean){
 if(!sameOwner(selection,story.owner))throw new Error('선택과 story 소유자가 다릅니다.');
 const {start,end}=ordered(selection);
 if(start.paragraph>=story.paragraphs.length||end.paragraph>=story.paragraphs.length||start.offset>chars(story.paragraphs[start.paragraph]).length||end.offset>chars(story.paragraphs[end.paragraph]).length)throw new Error('머리말/꼬리말 선택 범위가 원문을 벗어났습니다.');
 if(!allowCollapsed&&start.paragraph===end.paragraph&&start.offset===end.offset)throw new Error('빈 선택은 복사하거나 잘라낼 수 없습니다.');
 if(start.paragraph===end.paragraph)return chars(story.paragraphs[start.paragraph]).slice(start.offset,end.offset).join('');
 return [chars(story.paragraphs[start.paragraph]).slice(start.offset).join(''),...story.paragraphs.slice(start.paragraph+1,end.paragraph),chars(story.paragraphs[end.paragraph]).slice(0,end.offset).join('')].join('\n');
}
function current(session:HeaderFooterClipboardSession,expectedSelection?:HeaderFooterTextSelection){
 assertDocument(session.document);const identity=session.documentIdentity(),rev=session.revision(),selection=validateHeaderFooterSelection(session.selection());
 if(!validIdentity(identity)||!revision(rev)||!selection)throw new Error('문서·revision·머리말/꼬리말 선택을 확인하지 못했습니다.');
 if(expectedSelection&&!same(selection,expectedSelection))throw new Error('머리말/꼬리말 선택이 바뀌었습니다.');
 return {identity,revision:rev,selection,story:readStory(session.document,selection)};
}
function sourceBody(payload:Omit<HeaderFooterClipboardPayload,'integrity'>){return {version:payload.version,kind:payload.kind,source:payload.source,text:payload.text};}
function targetBody(target:Omit<HeaderFooterPasteTarget,'integrity'>){return {version:target.version,kind:target.kind,documentIdentity:target.documentIdentity,revision:target.revision,owner:target.owner,selection:target.selection,storyFingerprint:target.storyFingerprint,originalText:target.originalText};}
function validOwner(value:unknown):value is StoryOwner{return !!validateHeaderFooterSelection(object(value)?{section:value.section,isHeader:value.isHeader,applyTo:value.applyTo,anchor:{paragraph:0,offset:0},focus:{paragraph:0,offset:0}}:undefined)&&object(value)&&exact(value,['section','isHeader','applyTo','paragraph','control'])&&integer(value.paragraph)&&integer(value.control);}
function validateSource(value:unknown):SourceSeal|undefined{
 if(!object(value)||!exact(value,['documentIdentity','revision','owner','selection','storyFingerprint','originalText'])||!validIdentity(value.documentIdentity)||!revision(value.revision)||!validOwner(value.owner)||!digest(value.storyFingerprint)||typeof value.originalText!=='string'||chars(value.originalText).length>100000)return;
 const selection=validateHeaderFooterSelection(value.selection);if(!selection||!sameOwner(selection,value.owner))return;
 return {documentIdentity:value.documentIdentity,revision:value.revision,owner:value.owner,selection,storyFingerprint:value.storyFingerprint,originalText:value.originalText};
}
export function validateHeaderFooterClipboardPayload(value:unknown):HeaderFooterClipboardPayload|undefined{
 if(!object(value)||!exact(value,['version','kind','source','text','integrity'])||value.version!==1||value.kind!=='jueony-header-footer-plain-text'||typeof value.text!=='string'||chars(value.text).length>100000||!digest(value.integrity))return;
 const source=validateSource(value.source);if(!source)return;const body={version:1 as const,kind:'jueony-header-footer-plain-text' as const,source,text:value.text};if(hash(sourceBody(body))!==value.integrity)return;
 return {...body,integrity:value.integrity};
}
export function serializeHeaderFooterClipboardPayload(value:HeaderFooterClipboardPayload){const payload=validateHeaderFooterClipboardPayload(value);if(!payload)throw new Error('내부 머리말/꼬리말 클립보드 payload가 손상되었습니다.');return JSON.stringify(payload);}
export function parseHeaderFooterClipboardPayload(value:string){if(typeof value!=='string'||value.length>1000000)throw new Error('내부 머리말/꼬리말 클립보드 payload가 너무 큽니다.');let parsed:unknown;try{parsed=JSON.parse(value);}catch{throw new Error('내부 머리말/꼬리말 클립보드 payload가 JSON이 아닙니다.');}const payload=validateHeaderFooterClipboardPayload(parsed);if(!payload)throw new Error('내부 머리말/꼬리말 클립보드 payload가 손상되었습니다.');return payload;}

export function captureHeaderFooterClipboard(session:HeaderFooterClipboardSession):HeaderFooterClipboardPayload{
 const observed=current(session),originalText=selectedText(observed.story,observed.selection,false),range=ordered(observed.selection);
 const copied=json(session.document.copySelectionInHeaderFooter(observed.selection.section,observed.selection.isHeader,observed.selection.applyTo,range.start.paragraph,range.start.offset,range.end.paragraph,range.end.offset));
 if(!object(copied)||copied.ok!==true||copied.text!==originalText)throw new Error('코어가 복사한 머리말/꼬리말 원문을 검증하지 못했습니다.');
 const source:SourceSeal={documentIdentity:observed.identity,revision:observed.revision,owner:observed.story.owner,selection:observed.selection,storyFingerprint:observed.story.fingerprint,originalText};
 const body={version:1 as const,kind:'jueony-header-footer-plain-text' as const,source,text:originalText};return {...body,integrity:hash(sourceBody(body))};
}
export function captureHeaderFooterPasteTarget(session:HeaderFooterClipboardSession):HeaderFooterPasteTarget{
 const observed=current(session),originalText=selectedText(observed.story,observed.selection,true),body={version:1 as const,kind:'jueony-header-footer-paste-target' as const,documentIdentity:observed.identity,revision:observed.revision,owner:observed.story.owner,selection:observed.selection,storyFingerprint:observed.story.fingerprint,originalText};
 return {...body,integrity:hash(targetBody(body))};
}
function validateTarget(value:unknown):HeaderFooterPasteTarget|undefined{
 if(!object(value)||!exact(value,['version','kind','documentIdentity','revision','owner','selection','storyFingerprint','originalText','integrity'])||value.version!==1||value.kind!=='jueony-header-footer-paste-target'||!validIdentity(value.documentIdentity)||!revision(value.revision)||!validOwner(value.owner)||!digest(value.storyFingerprint)||typeof value.originalText!=='string'||chars(value.originalText).length>100000||!digest(value.integrity))return;
 const selection=validateHeaderFooterSelection(value.selection);if(!selection||!sameOwner(selection,value.owner))return;const body={version:1 as const,kind:'jueony-header-footer-paste-target' as const,documentIdentity:value.documentIdentity,revision:value.revision,owner:value.owner,selection,storyFingerprint:value.storyFingerprint,originalText:value.originalText};if(hash(targetBody(body))!==value.integrity)return;return {...body,integrity:value.integrity};
}
function expectedParagraphs(story:Story,selection:HeaderFooterTextSelection,replacement:string){
 const {start,end}=ordered(selection),lines=replacement.replace(/\r\n?/gu,'\n').split('\n'),prefix=chars(story.paragraphs[start.paragraph]).slice(0,start.offset).join(''),suffix=chars(story.paragraphs[end.paragraph]).slice(end.offset).join('');
 const inserted=lines.length===1?[prefix+lines[0]+suffix]:[prefix+lines[0],...lines.slice(1,-1),lines.at(-1)!+suffix];
 return [...story.paragraphs.slice(0,start.paragraph),...inserted,...story.paragraphs.slice(end.paragraph+1)];
}
function assertSeal(observed:ReturnType<typeof current>,seal:{documentIdentity:string;revision:ClipboardRevision;owner:StoryOwner;selection:HeaderFooterTextSelection;storyFingerprint:string;originalText:string},allowCollapsed:boolean){
 if(observed.identity!==seal.documentIdentity||observed.revision!==seal.revision||!same(observed.selection,seal.selection)||!same(observed.story.owner,seal.owner)||observed.story.fingerprint!==seal.storyFingerprint||selectedText(observed.story,observed.selection,allowCollapsed)!==seal.originalText)throw new Error('문서·story·revision·선택 또는 원문이 바뀌었습니다.');
}
function mutate(session:HeaderFooterClipboardSession,operation:'cut'|'paste',seal:SourceSeal|HeaderFooterPasteTarget,replacement:string):HeaderFooterClipboardReceipt{
 const observed=current(session,seal.selection);assertSeal(observed,seal,operation==='paste');const expected=expectedParagraphs(observed.story,observed.selection,replacement),range=ordered(observed.selection),snapshot=session.document.saveSnapshot();if(!integer(snapshot))throw new Error('문서 snapshot을 만들지 못했습니다.');
 try{
  const result=json(session.document.replaceRangeInHeaderFooter(observed.selection.section,observed.selection.isHeader,observed.selection.applyTo,range.start.paragraph,range.start.offset,range.end.paragraph,range.end.offset,replacement));
  if(!object(result)||result.ok!==true||!integer(result.hfParaIndex)||!integer(result.charOffset))throw new Error('머리말/꼬리말 범위 치환을 코어가 거부했습니다.');
  const afterSelection:{section:number;isHeader:boolean;applyTo:0|1|2;anchor:HeaderFooterPoint;focus:HeaderFooterPoint}={...observed.selection,anchor:{paragraph:result.hfParaIndex,offset:result.charOffset},focus:{paragraph:result.hfParaIndex,offset:result.charOffset}};
  const after=readStory(session.document,afterSelection);if(!same(after.owner,observed.story.owner)||!same(after.paragraphs,expected))throw new Error('머리말/꼬리말 치환 결과가 예상 결과와 다릅니다.');
  const afterRevision=session.revision(),afterIdentity=session.documentIdentity();if(afterIdentity!==observed.identity||!revision(afterRevision))throw new Error('변경 뒤 문서 identity 또는 revision을 확인하지 못했습니다.');
  const receipt:HeaderFooterClipboardReceipt=Object.freeze({operation,documentIdentity:observed.identity,beforeRevision:observed.revision,afterRevision,beforeStoryFingerprint:observed.story.fingerprint,afterStoryFingerprint:after.fingerprint});receipts.set(receipt,{document:session.document,snapshot,owner:observed.story.owner,before:observed.story,after,consumed:false});return receipt;
 }catch(error){try{session.document.restoreSnapshot(snapshot);}finally{session.document.discardSnapshot(snapshot);}throw error;}
}
export function cutHeaderFooterClipboard(session:HeaderFooterClipboardSession,payload:unknown):HeaderFooterClipboardReceipt{
 const valid=validateHeaderFooterClipboardPayload(payload);if(!valid)throw new Error('내부 머리말/꼬리말 클립보드 payload가 손상되었습니다.');return mutate(session,'cut',valid.source,'');
}
export function pasteHeaderFooterClipboard(session:HeaderFooterClipboardSession,payload:unknown,target:unknown):HeaderFooterClipboardReceipt{
 const validPayload=validateHeaderFooterClipboardPayload(payload),validTarget=validateTarget(target);if(!validPayload||!validTarget)throw new Error('내부 클립보드 payload 또는 붙여넣기 대상이 손상되었습니다.');return mutate(session,'paste',validTarget,validPayload.text);
}
export function undoHeaderFooterClipboard(session:HeaderFooterClipboardSession,receipt:HeaderFooterClipboardReceipt):boolean{
 const state=receipts.get(receipt);if(!state||state.consumed||state.document!==session.document||session.documentIdentity()!==receipt.documentIdentity||session.revision()!==receipt.afterRevision)return false;
 try{const probe={section:state.owner.section,isHeader:state.owner.isHeader,applyTo:state.owner.applyTo,anchor:{paragraph:0,offset:0},focus:{paragraph:0,offset:0}} as HeaderFooterTextSelection;const currentStory=readStory(session.document,probe);if(currentStory.fingerprint!==state.after.fingerprint)return false;const restored=json(session.document.restoreSnapshot(state.snapshot));if(!object(restored)||restored.ok!==true)throw new Error('snapshot 복원 실패');const afterRestore=readStory(session.document,probe);if(afterRestore.fingerprint!==state.before.fingerprint)throw new Error('snapshot 복원 검증 실패');state.consumed=true;session.document.discardSnapshot(state.snapshot);return true;}catch{return false;}
}
export function discardHeaderFooterClipboardUndo(receipt:HeaderFooterClipboardReceipt):boolean{const state=receipts.get(receipt);if(!state||state.consumed)return false;state.document.discardSnapshot(state.snapshot);state.consumed=true;return true;}
