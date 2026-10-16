import type {RecoveryRecord} from '../public/contracts.ts';
import type {RecoveryIntegrityPort} from '../ports/recovery-integrity.ts';
/** Validate before a persisted record can alter the workspace's tab metadata. */
export function assertRecoveryRecord(value:unknown,workspaceId:string,integrity?:RecoveryIntegrityPort):asserts value is RecoveryRecord{
 const d=value as RecoveryRecord|null;
 if(!d||typeof d.id!=='string'||!d.id.trim()||typeof d.workspaceId!=='string'||!d.workspaceId.trim()||d.workspaceId!==workspaceId||typeof d.name!=='string'||!d.name.trim()||!(d.bytes instanceof Uint8Array)||!d.bytes.byteLength||typeof d.dirty!=='boolean'||!Number.isFinite(d.updatedAt)||d.updatedAt<0)
  throw new Error('복구 문서의 저장 형식이 손상되어 열지 않았습니다. 기존 복구 데이터는 보존했습니다.');
 if(d.integrity!==undefined){
  const tag=d.integrity;
  if(!tag||tag.version!==1||tag.algorithm!=='sha256'||typeof tag.value!=='string'||!/^[0-9a-f]{64}$/.test(tag.value)||!integrity?.verify(d))
   throw new Error('복구 문서의 무결성을 확인하지 못해 열지 않았습니다. 기존 복구 데이터와 원본 파일은 보존했습니다.');
 }
}
/** A damaged draft must not prevent other drafts from opening, nor be deleted. */
export function partitionRecoveryRecords<T>(records:T[],workspaceId:string,integrity?:RecoveryIntegrityPort){
 const valid:(T&RecoveryRecord)[]=[],errors:Error[]=[];
 for(const record of records){try{assertRecoveryRecord(record,workspaceId,integrity);valid.push(record);}catch(error){errors.push(error instanceof Error?error:new Error(String(error)));}}
 return {valid,errors};
}
