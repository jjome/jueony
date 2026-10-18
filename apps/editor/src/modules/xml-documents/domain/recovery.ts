import type {XmlRecoveryState} from '../public/contracts.ts';
import {XmlContractError} from './schema.ts';

/** Bound untrusted persisted DTOs before parsing a schema or allocating history trees. */
export function assertXmlRecoveryState(value:unknown):asserts value is XmlRecoveryState{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new XmlContractError('XML 복구본 형식이 올바르지 않습니다.');
 const r=value as Record<string,unknown>;
 if(Object.keys(r).sort().join(',')!=='current,future,past,revision,schema,source,version'||r.version!==1||typeof r.source!=='string'||typeof r.schema!=='string'||typeof r.current!=='string'||!Number.isSafeInteger(r.revision)||Number(r.revision)<0||!Array.isArray(r.past)||!Array.isArray(r.future)||r.past.length+r.future.length>100||[...r.past,...r.future].some(s=>typeof s!=='string')||Number(r.revision)<r.past.length+r.future.length)throw new XmlContractError('XML 복구본 버전·기록이 올바르지 않습니다.');
 const recovery=r as unknown as XmlRecoveryState;
 if([recovery.source,recovery.schema,recovery.current,...recovery.past,...recovery.future].reduce((sum,s)=>sum+s.length,0)>16_000_000)throw new XmlContractError('XML 복구본 기록 크기 제한을 초과했습니다.');
 if(recovery.revision===0&&recovery.current!==recovery.source)throw new XmlContractError('XML 복구본의 원문과 초기 버전이 일치하지 않습니다.');
}
