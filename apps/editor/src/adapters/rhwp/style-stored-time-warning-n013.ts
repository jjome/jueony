import {sha256} from '@noble/hashes/sha2.js';

export type StyleStoredTimeWarning=Readonly<{code:'new-document-stored-time-initialization'|'stored-time-capability-unavailable';message:string}>;
export type StyleStoredTimeGuard=Readonly<{status:'not-applicable'|'initialized'|'initialization-required'|'unavailable';evidenceSha256:string;warnings:readonly StyleStoredTimeWarning[]}>;
const parsed=(value:any):any=>typeof value==='string'?JSON.parse(value):value;
const digest=(value:unknown)=>Array.from(sha256(new TextEncoder().encode(JSON.stringify(value))),byte=>byte.toString(16).padStart(2,'0')).join('');
const warning:StyleStoredTimeWarning={code:'new-document-stored-time-initialization',message:'내용 없는 새 문서입니다. 저장할 때 문서의 작성·수정 날짜가 초기화될 수 있습니다.'};
const unavailable:StyleStoredTimeWarning={code:'stored-time-capability-unavailable',message:'현재 엔진에서는 빈 새 문서의 저장 날짜 초기화 여부를 확인할 수 없습니다.'};
const record=(value:unknown):Record<string,any>=>{const result=parsed(value);if(!result||typeof result!=='object'||Array.isArray(result))throw new Error('문서의 저장 날짜 정보를 확인할 수 없습니다.');return result;};

function isBlankDocument(document:any):boolean{
  for(const method of ['getSectionCount','getParagraphCount','getParagraphLength','getTextFileUnicode','getControls'])if(typeof document?.[method]!=='function')throw new Error('문서가 내용 없는 새 문서인지 확인할 수 없습니다.');
  if(parsed(document.getTextFileUnicode())!=='')return false;
  if(document.getSectionCount()!==1||document.getParagraphCount(0)!==1||document.getParagraphLength(0,0)!==0)return false;
  const controls=parsed(document.getControls());
  if(!Array.isArray(controls))throw new Error('빈 문서의 저장 날짜 초기화 조건을 확인할 수 없습니다.');
  return controls.every(control=>control&&typeof control==='object'&&control.list===0&&control.para===0&&['secd','cold'].includes(control.ctrlId));
}

/** Read-only guard. It never guesses, writes or initializes a stored timestamp. */
export function inspectStyleStoredTimeGuard(document:any,options:{requireCapability?:boolean}={}):StyleStoredTimeGuard{
  if(!isBlankDocument(document))return{status:'not-applicable',evidenceSha256:digest({empty:false}),warnings:[]};
  if(typeof document.getDocumentStoredInformationEditState!=='function'){
    if(options.requireCapability)throw new Error(unavailable.message);
    return{status:'unavailable',evidenceSha256:digest({empty:true,capability:'unavailable'}),warnings:[unavailable]};
  }
  const state=record(document.getDocumentStoredInformationEditState()),information=record(state.information);
  if(typeof state.fingerprint!=='string'||!/^[0-9a-f]{64}$/u.test(state.fingerprint)||!Array.isArray(information.issues)||information.issues.length!==0)throw new Error('빈 새 문서의 저장 날짜 원본을 안전하게 확인할 수 없습니다.');
  const created=record(information.created),modified=record(information.modified);
  const initialized=created.state==='value'&&typeof created.fileTime100ns==='string'&&modified.state==='value'&&typeof modified.fileTime100ns==='string';
  const absent=created.state==='absent'&&modified.state==='absent';
  if(!initialized&&!absent)throw new Error('빈 새 문서의 작성·수정 날짜 상태가 일관되지 않습니다. 원본을 유지합니다.');
  return{status:absent?'initialization-required':'initialized',evidenceSha256:digest({empty:true,fingerprint:state.fingerprint,created:created.state,modified:modified.state}),warnings:absent?[warning]:[]};
}
