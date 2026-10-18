import {validateStoredDocumentInformation} from './document-stored-information.ts';
import type {StoredDocumentInformation} from './document-stored-information.ts';

type CreationDocument = {
 getDocumentStoredInformationEditState():unknown;
 previewDocumentStoredInformation(expected:string,request:string):unknown;
 setDocumentStoredInformation(expected:string,request:string):unknown;
 getSectionCount():number;getParagraphCount(section:number):number;getParagraphLength(section:number,paragraph:number):number;
};
type State={fingerprint:string;information:StoredDocumentInformation};
const fail=(message:string)=>Error('새 문서 날짜 초기화: '+message);
const record=(v:unknown):Record<string,unknown>=>{const value=typeof v==='string'?JSON.parse(v):v;if(!value||typeof value!=='object'||Array.isArray(value))throw fail('엔진 응답 형식이 올바르지 않습니다.');return value as Record<string,unknown>;};
const exact=(v:Record<string,unknown>,keys:string[])=>Object.keys(v).sort().join(',')===keys.sort().join(',');
const fingerprint=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const canonical=(v:unknown):unknown=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,canonical(x)])):v;
const same=(a:unknown,b:unknown)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const validTick=(v:unknown):v is string=>typeof v==='string'&&/^(0|[1-9]\d{0,19})$/.test(v)&&BigInt(v)<=18446744073709551615n;
/** Browser clock precision is milliseconds; FILETIME storage remains exact integer100ns. */
export function creationFileTime100ns(now:()=>number=Date.now):string{
 const ms=now();if(!Number.isSafeInteger(ms))throw fail('시계 값을 확인하지 못했습니다.');
 const value=(BigInt(ms)+11644473600000n)*10000n;
 if(value<0n||value>18446744073709551615n)throw fail('시각이 저장 가능한 범위 밖입니다.');
 return value.toString();
}
function engine(value:unknown):CreationDocument{
 if(!value||typeof value!=='object')throw fail('편집 엔진이 없습니다.');
 const doc=value as Record<string,unknown>;
 for(const name of ['getDocumentStoredInformationEditState','previewDocumentStoredInformation','setDocumentStoredInformation','getSectionCount','getParagraphCount','getParagraphLength'])if(typeof doc[name]!=='function')throw fail('현재 엔진은 새 문서 작성 시각 초기화를 지원하지 않습니다. 같은 버전의 엔진을 사용해 주세요.');
 return value as CreationDocument;
}
function empty(doc:CreationDocument):void{if(doc.getSectionCount()!==1||doc.getParagraphCount(0)!==1||doc.getParagraphLength(0,0)!==0)throw fail('새 빈 문서에서만 초기화할 수 있습니다.');}
function state(doc:CreationDocument):State{
 const raw=record(doc.getDocumentStoredInformationEditState());
 if(!exact(raw,['editable','fingerprint','information','reason'])&&!exact(raw,['editable','fingerprint','information']))throw fail('소유 정보 응답이 올바르지 않습니다.');
 if(raw.editable!==true||!fingerprint(raw.fingerprint)||(raw.reason!=null&&typeof raw.reason!=='string'))throw fail('원본 날짜 정보의 쓰기 소유권을 확인하지 못했습니다.');
 return{fingerprint:raw.fingerprint,information:validateStoredDocumentInformation(raw.information)};
}
const initialized=new WeakSet<object>();
/** Call only on a newly allocated createBlankDocument candidate, before publication.
 * Never use this on open/recovery/SaveAs or as an automatic save clock. The caller
 * owns candidate disposal on failure and publishes only after all setup succeeds. */
export function initializeDocumentCreatedInformation(value:unknown,clock:()=>string=creationFileTime100ns):State{
 const doc=engine(value);if(initialized.has(doc))throw fail('이미 초기화한 새 문서입니다.');empty(doc);
 const before=state(doc),printed=before.information.lastPrinted;
 if(!(printed.state==='absent'||printed.state==='value'&&printed.fileTime100ns==='0'))throw fail('템플릿에 인쇄 이력이 있어 지우거나 빈 값으로 위장하지 않았습니다.');
 const tick=clock();if(!validTick(tick))throw fail('시각은 정규100ns 정수 문자열이어야 합니다.');
 const request=JSON.stringify({schemaVersion:1,values:{created:tick,modified:tick,editingDuration:'0'}});
 const preview=record(doc.previewDocumentStoredInformation(before.fingerprint,request));
 if(!exact(preview,['changed','originalFingerprint','information'])||typeof preview.changed!=='boolean'||preview.originalFingerprint!==before.fingerprint)throw fail('초기화 사전 검사 증거가 일치하지 않습니다.');
 const wanted=validateStoredDocumentInformation(preview.information);
 if(wanted.created.state!=='value'||wanted.created.fileTime100ns!==tick||wanted.modified.state!=='value'||wanted.modified.fileTime100ns!==tick||wanted.editingDuration.state!=='value'||wanted.editingDuration.ticks100ns!=='0'||!same({...wanted,created:before.information.created,modified:before.information.modified,editingDuration:before.information.editingDuration},before.information))throw fail('요청하지 않은 날짜 정보가 바뀌었습니다.');
 if(!same(state(doc),before))throw fail('사전 검사 중 원본이 바뀌었습니다.');empty(doc);
 if(preview.changed){
  const result=record(doc.setDocumentStoredInformation(before.fingerprint,request));
  if(!exact(result,['changed','fingerprint','information'])||result.changed!==true||!fingerprint(result.fingerprint)||!same(validateStoredDocumentInformation(result.information),wanted))throw fail('초기화 완료 증거가 일치하지 않습니다.');
  const after=state(doc);if(after.fingerprint!==result.fingerprint||!same(after.information,wanted))throw fail('실제 초기화 결과가 일치하지 않습니다.');
 }else if(!same(wanted,before.information))throw fail('변경 없는 사전 검사 결과가 올바르지 않습니다.');
 empty(doc);const after=state(doc);initialized.add(doc);return after;
}
