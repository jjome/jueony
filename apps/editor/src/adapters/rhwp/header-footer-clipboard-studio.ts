import {
 captureHeaderFooterClipboard,captureHeaderFooterPasteTarget,parseHeaderFooterClipboardPayload,
 prepareHeaderFooterCutGuard,prepareHeaderFooterPasteGuard,prepareHeaderFooterPlainPasteGuard,
 serializeHeaderFooterClipboardPayload,type HeaderFooterClipboardPayload,type HeaderFooterClipboardSession,
 type HeaderFooterTextSelection,
} from './header-footer-clipboard.ts';

export const HEADER_FOOTER_CLIPBOARD_MIME='application/x-jueony-header-footer+json';
type StudioInput={cursor:any;wasm:any;isFormMode?():boolean;replaceHeaderFooterSelection(text:string,options:Record<string,unknown>):boolean};
const api=()=>((window as any).jueonyEditor as {documentIdentity?():string;revision?():string|number;busy?():boolean}|undefined);
function selection(input:StudioInput,allowCollapsed:boolean):HeaderFooterTextSelection|null{
 const cursor=input.cursor,ordered=cursor.getHeaderFooterSelectionOrdered?.();
 if(ordered){return {section:ordered.start.sectionIdx,isHeader:ordered.start.isHeader,applyTo:ordered.start.applyTo,anchor:{paragraph:ordered.start.paraIdx,offset:ordered.start.charOffset},focus:{paragraph:ordered.end.paraIdx,offset:ordered.end.charOffset}};}
 if(!allowCollapsed||!cursor.isInHeaderFooter?.()||!Number.isSafeInteger(cursor.hfSectionIdx)||!Number.isSafeInteger(cursor.hfParaIdx)||!Number.isSafeInteger(cursor.hfCharOffset)||![0,1,2].includes(cursor.hfApplyTo))return null;
 const point={paragraph:cursor.hfParaIdx,offset:cursor.hfCharOffset};return {section:cursor.hfSectionIdx,isHeader:cursor.headerFooterMode==='header',applyTo:cursor.hfApplyTo,anchor:point,focus:{...point}};
}
function session(input:StudioInput,allowCollapsed:boolean):HeaderFooterClipboardSession{
 const editor=api(),document=input.wasm.borrowDocumentHandle?.()??input.wasm;if(!editor?.documentIdentity||!editor.revision||editor.busy?.()||input.wasm.requiresPasswordForSave)throw new Error('현재 문서의 clipboard 권한·identity·revision을 확인하지 못했습니다.');
 return {document,documentIdentity:()=>editor.documentIdentity!(),revision:()=>editor.revision!(),selection:()=>selection(input,allowCollapsed)};
}
function write(event:ClipboardEvent,payload:HeaderFooterClipboardPayload){
 event.preventDefault();const clipboard=event.clipboardData;if(!clipboard)throw new Error('운영체제 clipboard 쓰기 권한이 없습니다.');const encoded=serializeHeaderFooterClipboardPayload(payload);clipboard.setData('text/plain',payload.text);clipboard.setData(HEADER_FOOTER_CLIPBOARD_MIME,encoded);if(clipboard.getData('text/plain')!==payload.text||clipboard.getData(HEADER_FOOTER_CLIPBOARD_MIME)!==encoded)throw new Error('운영체제 clipboard가 머리말/꼬리말 내용을 받아들이지 않았습니다.');
}
const warn=(prefix:string,error:unknown)=>alert(`${prefix}: ${error instanceof Error?error.message:String(error)} 원본 문서는 유지했습니다.`);
export function handleHeaderFooterCopy(input:StudioInput,event:ClipboardEvent):boolean{
 if(!input.cursor.isInHeaderFooter?.())return false;event.preventDefault();if(!input.cursor.getHeaderFooterSelectionOrdered?.())return true;
 try{write(event,captureHeaderFooterClipboard(session(input,false)));}catch(error){warn('복사 취소',error);}return true;
}
export function handleHeaderFooterCut(input:StudioInput,event:ClipboardEvent):boolean{
 if(!input.cursor.isInHeaderFooter?.())return false;event.preventDefault();if(input.isFormMode?.()){warn('잘라내기 취소','양식 편집 상태입니다.');return true;}if(!input.cursor.getHeaderFooterSelectionOrdered?.())return true;
 try{const access=session(input,false),payload=captureHeaderFooterClipboard(access);write(event,payload);const guard=prepareHeaderFooterCutGuard(access,payload),ok=input.replaceHeaderFooterSelection('',{operationType:'cutPlainTextInHeaderFooter',restoreSelectionOnUndo:true,jueonyPreflight:guard.preflight,jueonyVerify:guard.verify});if(!ok)throw new Error('원자 잘라내기와 검증을 완료하지 못했습니다.');}catch(error){warn('잘라내기 취소',error);}return true;
}
export function handleHeaderFooterPaste(input:StudioInput,event:ClipboardEvent):boolean{
 if(!input.cursor.isInHeaderFooter?.())return false;event.preventDefault();if(input.isFormMode?.()){warn('붙이기 취소','양식 편집 상태입니다.');return true;}
 try{const clipboard=event.clipboardData;if(!clipboard)throw new Error('운영체제 clipboard 읽기 권한이 없습니다.');const text=clipboard.getData('text/plain'),encoded=clipboard.getData(HEADER_FOOTER_CLIPBOARD_MIME);if(!text)return true;const access=session(input,true),target=captureHeaderFooterPasteTarget(access);let guard;if(encoded){const payload=parseHeaderFooterClipboardPayload(encoded);if(payload.text!==text)throw new Error('내부 payload와 평문 clipboard가 일치하지 않습니다.');guard=prepareHeaderFooterPasteGuard(access,payload,target);}else guard=prepareHeaderFooterPlainPasteGuard(access,text,target);const ok=input.replaceHeaderFooterSelection(text,{operationType:'pastePlainTextInHeaderFooter',restoreSelectionOnUndo:true,allowCollapsed:true,jueonyPreflight:guard.preflight,jueonyVerify:guard.verify});if(!ok)throw new Error('원자 붙이기와 검증을 완료하지 못했습니다.');}catch(error){warn('붙이기 취소',error);}return true;
}
