import type {Snapshot,AgentDocumentMetadataOp} from '../public/types.ts';
import {validateDocumentMetadataValues,DOCUMENT_METADATA_KEYS} from './document-metadata-values.ts';
export function validateAgentDocumentMetadata(raw:unknown,snapshot:Snapshot):AgentDocumentMetadataOp{
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).length!==3||!['kind','originalFingerprint','values'].every(k=>Object.hasOwn(raw,k)))throw Error('문서 요약 명령의 필드가 맞지 않습니다.');
 const op=raw as AgentDocumentMetadataOp,source=snapshot.documentInformation?.metadata;
 if(op.kind!=='set_document_metadata'||!source?.editable||!source.values||!source.fingerprint||!/^[a-f0-9]{64}$/.test(source.fingerprint)||op.originalFingerprint!==source.fingerprint)throw Error('현재 조회한 편집 가능한 문서 요약만 변경할 수 있습니다.');
 const values=validateDocumentMetadataValues(op.values);validateDocumentMetadataValues(source.values);
 if(DOCUMENT_METADATA_KEYS.every(k=>source.values![k]===values[k]))throw Error('변경할 문서 요약이 없습니다.');
 return{kind:op.kind,originalFingerprint:op.originalFingerprint,values};
}
