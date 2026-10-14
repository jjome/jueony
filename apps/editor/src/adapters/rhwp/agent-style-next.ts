import type {Snapshot,AgentNextParagraphStyleOp} from '../../modules/document/public/index.ts';
import {validateAgentNextParagraphStyle} from '../../modules/document/public/engine-integration.ts';
import {nativeDocument} from './structure.ts';
import {capturePreservationEvidence} from './preservation.ts';
import {readAgentStyleState} from './agent-style-source.ts';
const canonical=(v:any):any=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const same=(a:any,b:any)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
export function readAgentStyleNextSources(wasm:any):Pick<Snapshot,'styleNextSources'|'styleNextTargets'>{
 const state=readAgentStyleState(wasm);if(!state)return {};
 return {styleNextSources:Object.fromEntries(state.styles.map(v=>[String(v.id),{...state.sources[String(v.id)],currentNextStyleId:v.nextStyleId}])),styleNextTargets:state.targets};
}
export function executeAgentNextParagraphStyle(wasm:any,base:Snapshot,op:AgentNextParagraphStyleOp){
 validateAgentNextParagraphStyle(op,base);const d=nativeDocument(wasm),state=readAgentStyleState(d),current=state?.sources[String(op.styleId)],target=state?.targets[String(op.nextStyleId)];
 if(!state||!same(base.structure?.styles,state.styles.map(v=>({id:v.id,name:v.name,type:v.type})))||current?.editable!==true||current.fingerprint!==base.styleNextSources?.[String(op.styleId)]?.fingerprint||target?.fingerprint!==base.styleNextTargets?.[String(op.nextStyleId)]?.fingerprint)throw new Error('원본 또는 다음 문단 스타일이 바뀌었습니다. 최신 문서로 다시 요청하세요.');
 const stored=state.styles.find(v=>v.id===op.styleId);if(stored.nextStyleId!==base.styleNextSources?.[String(op.styleId)]?.currentNextStyleId)throw new Error('현재 다음 스타일 정보가 바뀌었습니다.');if(stored.nextStyleId===op.nextStyleId)throw new Error('현재 다음 문단 스타일과 같습니다.');
 const before=capturePreservationEvidence(d);if(before.issues.length)throw new Error('전체 문서 보존 정보를 확인하지 못했습니다.');const expected=structuredClone(before.values) as any;
 const source=expected.styles?.find((v:any)=>v.id===op.styleId);if(!source)throw new Error('스타일 보존 정보가 없습니다.');source.nextStyleId=op.nextStyleId;
 if(d.updateStyle(op.styleId,JSON.stringify({nextStyleId:op.nextStyleId}))!==true)throw new Error('다음 문단 스타일 변경에 실패했습니다.');
 const after=capturePreservationEvidence(d);if(after.issues.length||!same(after.values,expected))throw new Error('다음 스타일 변경 뒤 본문·서식·이름·언어·잠금·공유 자원이 계획과 다릅니다.');
}
