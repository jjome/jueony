import type {SavedDocument} from './model.ts';
/** Validate before a persisted record can alter the workspace's tab metadata. */
export function assertRecoveryRecord(value:unknown,workspaceId:string):asserts value is SavedDocument{
 const d=value as SavedDocument|null;
 if(!d||typeof d.id!=='string'||!d.id.trim()||d.workspaceId!==workspaceId||typeof d.name!=='string'||!d.name.trim()||!(d.bytes instanceof Uint8Array)||!d.bytes.byteLength||typeof d.dirty!=='boolean'||!Number.isFinite(d.updatedAt)||d.updatedAt<0)
  throw new Error('복구 문서의 저장 형식이 손상되어 열지 않았습니다. 기존 복구 데이터는 보존했습니다.');
}
