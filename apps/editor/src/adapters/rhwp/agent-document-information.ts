import type {Snapshot,AgentDocumentInformation,AgentDocumentMetadataOp} from '../../modules/document/public/index.ts';
import {validateAgentDocumentMetadata} from '../../modules/document/public/engine-integration.ts';
import {readDocumentMetadata,preflightDocumentMetadata,applyDocumentMetadata,DOCUMENT_METADATA_KEYS} from './document-metadata.ts';
import {readDocumentStatistics} from './document-info.ts';
import {readStoredDocumentInformation} from './document-stored-information.ts';
import {readStoryInformation} from './document-story-information.ts';
export function readAgentDocumentInformation(wasm:any,name:string,canEdit:boolean):AgentDocumentInformation{
 const source=readDocumentMetadata(wasm),metadata=canEdit?source:{...source,editable:false,reason:source.reason??'현재 문서가 읽기 전용 상태입니다.'};
 try{
  const stored=readStoredDocumentInformation(wasm),stories=readStoryInformation(wasm);
  return{metadata,statistics:{...readDocumentStatistics(wasm,name),
   storedFileInformation:stored.value?{readOnly:true,...stored.value}:{unavailableReason:stored.reason??'조회 불가'},
   canonicalStories:stories.value?{basis:stories.value.basis,counts:{...stories.value.counts},objects:{...stories.value.objects},
    stories:stories.value.stories.map(s=>({kind:s.kind,counts:{...s.counts}})),limitations:stories.value.limitations}:{unavailableReason:stories.reason??'조회 불가'},
  }};
 }catch{return{metadata,reason:'일부 문서 통계를 읽지 못했습니다. 값이 0이라는 뜻이 아닙니다.'};}
}
function current(wasm:any,base:Snapshot,op:AgentDocumentMetadataOp){
 const value=validateAgentDocumentMetadata(op,base),source=readDocumentMetadata(wasm);
 if(!source.editable||source.fingerprint!==op.originalFingerprint||!source.values||!DOCUMENT_METADATA_KEYS.every(k=>source.values![k]===base.documentInformation!.metadata.values![k]))throw Error('조회 후 문서 요약이 바뀌었습니다. 최신 문서에서 다시 요청하세요.');
 return{source,values:value.values};
}
export function preflightAgentDocumentMetadata(wasm:any,base:Snapshot,op:AgentDocumentMetadataOp){const{source,values}=current(wasm,base,op);preflightDocumentMetadata(wasm,source,values);}
export function executeAgentDocumentMetadata(wasm:any,base:Snapshot,op:AgentDocumentMetadataOp){const{source,values}=current(wasm,base,op);if(!applyDocumentMetadata(wasm,source,values))throw Error('문서 요약 변경을 적용하지 않았습니다.');}
export function assertAgentDocumentMetadata(wasm:any,op:AgentDocumentMetadataOp){const source=readDocumentMetadata(wasm);if(!source.editable||!source.values||!DOCUMENT_METADATA_KEYS.every(k=>source.values![k]===op.values[k]))throw Error('문서 요약 적용 결과를 확인하지 못했습니다.');}
