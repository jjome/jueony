import {sha256} from '@noble/hashes/sha2.js';
import {rememberedFileFingerprint,setRememberedFileFingerprint} from './fingerprints.ts';
import type {Handle,Writable} from './fingerprints.ts';

export type BoundSaveHandle=Handle&{name:string;getFile():Promise<Blob>;queryPermission?(options:{mode:'readwrite'}):Promise<string>};
export type BoundSaveState={instance:string;revision:string;name:string;dirty:boolean;handle:BoundSaveHandle|null;eligible:boolean};
export type BoundSaveExpected={instance:string;revision:string;connection:string};
export type BoundSaveResult={status:'saved';beforeRevision:string;afterRevision:string;beforeConnection:string;afterConnection:string};
type Preparation={changedTables:number;beforeRevision?:string;afterRevision?:string};
export type BoundSaveDependencies={
 read():BoundSaveState;locked():boolean;format():'hwp'|'hwpx'|undefined;
 prepare(format:'hwp'|'hwpx',authority:object):Promise<Preparation>;
 payload(format:'hwp'|'hwpx'):Blob&{jueonyRevision?:unknown};
 /** The existing revision/fingerprint/readback/abort-aware snapshot writer. */
 write(handle:Handle,blob:Blob):Promise<void>;
 /** Existing file-command completion; invoked only after acknowledged readback. */
 complete(format:'hwp'|'hwpx',handle:BoundSaveHandle):void;
};
const hash=(value:unknown)=>Array.from(sha256(new TextEncoder().encode(JSON.stringify(value))),v=>v.toString(16).padStart(2,'0')).join('');
class BoundSavePreflightError extends Error {}
const rejected=(message:string)=>new BoundSavePreflightError(message);
const safeWriteReasons=new Set([
 '다른 프로그램에서 원본 파일을 변경했습니다. 다른 이름으로 저장하거나 원본을 다시 열어 주세요.',
 '저장한 파일의 내용이 문서 사본과 일치하지 않습니다. 편집 내용은 열린 문서에 남아 있습니다. 다른 이름으로 저장해 주세요.',
 '저장 준비 중 문서가 바뀌었습니다. 다시 저장해 주세요.',
 '저장 중 활성 문서의 소유 정보가 바뀌었습니다.',
]);
function safeReason(cause:unknown){
 if(cause instanceof Error){
  if(cause instanceof BoundSavePreflightError||safeWriteReasons.has(cause.message))return cause.message;
  if(cause.name==='AbortError')return '저장 요청이 취소되었습니다.';
  if(cause.name==='PreservationError')return '문서 의미 또는 배치 보존 검사를 통과하지 못했습니다.';
 }
 return '저장 권한 또는 파일 기록 결과를 확인하지 못했습니다. 사용자 저장으로 원본 상태를 확인하세요.';
}

/** Current approved handle only. No picker, permission request or download path.
 * An authority can bypass only prepareFileSave's host lock; every other public
 * editor mutation remains locked throughout the operation.
 */
export function createBoundDocumentSave(deps:BoundSaveDependencies){
 const handles=new WeakMap<object,number>();let nextHandle=0,activeAuthority:object|undefined;
 function binding(){
  const state=deps.read(),handle=state.handle;
  if(!handle)return undefined;
  if(!handles.has(handle))handles.set(handle,++nextHandle);
  const baseline=rememberedFileFingerprint(handle);
  const connection=hash([handles.get(handle),handle.name,baseline??null]);
  const format=deps.format();
  return{connection,eligible:state.eligible&&/^[a-f0-9]{64}$/.test(baseline??'')&&typeof handle.queryPermission==='function'&&Boolean(format)&&handle.name===state.name&&handle.name.toLowerCase().endsWith('.'+format)};
 }
 return{
  binding,
  acceptsAuthority:(value:unknown)=>activeAuthority!==undefined&&value===activeAuthority,
  async save(expected:BoundSaveExpected,signal:AbortSignal,assertOwner:()=>void=()=>{}):Promise<BoundSaveResult>{
   if(activeAuthority||!deps.locked())throw Object.assign(Error('문서 저장 전용 잠금이 필요합니다.'),{name:'BoundSaveRejectedError'});
   signal.throwIfAborted();assertOwner();const initial=deps.read(),initialBinding=binding(),handle=initial.handle,format=deps.format();
   if(!handle||!format||!initialBinding?.eligible||initialBinding.connection!==expected.connection||initial.instance!==expected.instance||initial.revision!==expected.revision)throw Object.assign(Error('조회한 문서와 원본 연결이 바뀌었거나 승인된 저장 연결이 없습니다. 저장하지 않았습니다.'),{name:'BoundSaveRejectedError'});
   let revision=expected.revision,writeAttempted=false,completionAttempted=false;
   const assertCurrent=()=>{
    signal.throwIfAborted();assertOwner();const current=deps.read();
    if(!deps.locked()||current.handle!==handle||current.instance!==initial.instance||current.revision!==revision||current.name!==initial.name||!current.eligible||deps.format()!==format||binding()?.connection!==expected.connection)throw rejected('저장 중 문서 또는 원본 연결이 바뀌었습니다.');
   };
   const permission=async()=>{assertCurrent();if(await handle.queryPermission!({mode:'readwrite'})!=='granted')throw rejected('원본 쓰기 권한이 이미 승인된 문서만 Agent가 저장할 수 있습니다. 사용자 저장으로 연결을 확인하세요.');assertCurrent();};
   const authority=Object.freeze({});activeAuthority=authority;
   try{
    await permission();
    const prepared=await deps.prepare(format,authority),current=deps.read();
    if(!Number.isSafeInteger(prepared.changedTables)||prepared.changedTables<0)throw rejected('저장 준비 결과가 올바르지 않습니다.');
    if(prepared.changedTables>0){
     if(prepared.beforeRevision!==revision||prepared.afterRevision!==current.revision)throw rejected('저장 전용 문서 갱신 결과가 일치하지 않습니다.');
     revision=prepared.afterRevision;
    }
    assertCurrent();
    const payload=deps.payload(format);assertCurrent();
    if(payload.jueonyRevision!==revision)throw rejected('저장 사본과 현재 문서 버전이 다릅니다.');
    // Wrap only the captured handle. Preserve its known disk baseline for the
    // existing writer; never manufacture a new baseline from a possibly changed file.
    const guarded:Handle={
     async getFile(){assertCurrent();const file=await handle.getFile();assertCurrent();return file;},
     async createWritable(){
      await permission();const writable=await handle.createWritable();
      try{assertCurrent();}catch(error){await writable.abort?.().catch(()=>undefined);throw error;}
      const result:Writable={
       async write(data){assertCurrent();writeAttempted=true;await writable.write(data);assertCurrent();},
       async close(){assertCurrent();await writable.close();assertCurrent();},
       ...(writable.abort?{abort:()=>writable.abort!()}:{}),
      };return result;
     },
    };
    setRememberedFileFingerprint(guarded,rememberedFileFingerprint(handle)!);
    await deps.write(guarded,payload);assertCurrent();
    const acknowledged=rememberedFileFingerprint(guarded);
    if(!acknowledged)throw rejected('저장한 원본의 재읽기 지문을 확인하지 못했습니다.');
    completionAttempted=true;deps.complete(format,handle);
    assertOwner();const completed=deps.read();
    if(completed.handle!==handle||completed.instance!==initial.instance||completed.revision!==revision||completed.name!==initial.name||completed.dirty||!deps.locked())throw rejected('파일 기록 후 문서 완료 상태를 확인하지 못했습니다.');
    setRememberedFileFingerprint(handle,acknowledged);
    return{status:'saved',beforeRevision:expected.revision,afterRevision:revision,beforeConnection:expected.connection,afterConnection:binding()!.connection};
   }catch(cause){
    const error=Error((writeAttempted||completionAttempted?'저장 도중 오류가 발생했습니다. 원본에 일부 또는 전체가 기록됐을 수 있어 완료로 보고하지 않습니다.':'파일 기록 전에 저장을 거절했습니다.')+' '+safeReason(cause));
    error.name=writeAttempted||completionAttempted?'PartialApplyError':'BoundSaveRejectedError';
    Object.defineProperty(error,'cause',{value:cause});throw error;
   }finally{activeAuthority=undefined;}
  },
 };
}
