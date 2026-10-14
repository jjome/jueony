import {sha256} from '@noble/hashes/sha2.js';
import type {Snapshot,AgentCreateParagraphStyleOp} from '../../modules/document/public/index.ts';
import {agentCreateParagraphStyleName} from '../../modules/document/public/engine-integration.ts';
import {nativeDocument,parsed} from './structure.ts';
import {capturePreservationEvidence} from './preservation.ts';
const canonical=(v:any):any=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const same=(a:any,b:any)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const fingerprint=(v:any)=>Array.from(sha256(new TextEncoder().encode(JSON.stringify(canonical(v)))),n=>n.toString(16).padStart(2,'0')).join('');
const valid=(n:any)=>Number.isInteger(n)&&n>=0&&n<=65535;
export function readAgentStyleCreationSources(wasm:any):Pick<Snapshot,'styleCreationSources'>{
 const d=nativeDocument(wasm);if(typeof d.createStyle!=='function'||typeof d.getStoredStyleDetail!=='function')return {};
 try{const styles=parsed(d.getStyleList());if(!Array.isArray(styles)||styles.length>256||styles.some((v,i)=>v.id!==i))return {};
 return {styleCreationSources:Object.fromEntries(styles.map(v=>{const detail=parsed(d.getStoredStyleDetail(v.id)),editable=styles.length<256&&v.type===0&&valid(v.paraShapeId)&&valid(v.charShapeId)&&detail?.charProps&&detail?.paraProps&&typeof detail.charProps.fontSize==='number'&&typeof detail.paraProps.headType==='string';return [String(v.id),{editable:Boolean(editable),...(editable?{fingerprint:fingerprint({style:v,details:detail})}:{reason:'저장 문단 스타일·유효한 모양·256개 미만의 정의가 필요합니다.'})}];}))};}catch{return {};}
}
export function executeAgentCreateParagraphStyle(wasm:any,base:Snapshot,op:AgentCreateParagraphStyleOp){
 const name=agentCreateParagraphStyleName(op,base),d=nativeDocument(wasm),styles=parsed(d.getStyleList()),source=styles.find((v:any)=>v.id===op.sourceStyleId);
 if(!same(base.structure?.styles,styles.map((v:any)=>({id:v.id,name:v.name,type:v.type})))||readAgentStyleCreationSources(d).styleCreationSources?.[String(op.sourceStyleId)]?.editable!==true||readAgentStyleCreationSources(d).styleCreationSources?.[String(op.sourceStyleId)]?.fingerprint!==base.styleCreationSources?.[String(op.sourceStyleId)]?.fingerprint||!source)throw new Error('스타일 원본 또는 목록이 바뀌었습니다. 최신 문서로 다시 요청하세요.');
 const before=capturePreservationEvidence(d);if(before.issues.length)throw new Error('전체 문서 보존 정보를 확인하지 못했습니다.');const expected=structuredClone(before.values) as any;
 const id=styles.length,original=expected.styles?.find((v:any)=>v.id===op.sourceStyleId);if(!original)throw new Error('스타일 모양의 보존 정보가 없습니다.');expected.styles.push({...structuredClone(original),id,name,englishName:'',type:0,nextStyleId:id});
 const result=d.createStyle(JSON.stringify({name,englishName:'',type:0,nextStyleId:id,baseCharShapeId:source.charShapeId,baseParaShapeId:source.paraShapeId}));
 const actual=parsed(d.getStyleList()).find((v:any)=>v.id===id);
 if(result!==id||!actual||actual.paraShapeId!==source.paraShapeId||actual.charShapeId!==source.charShapeId)throw new Error('새 스타일의 ID 또는 저장 모양 참조가 계획과 다릅니다.');
 const after=capturePreservationEvidence(d);if(after.issues.length||!same(after.values,expected))throw new Error('새 스타일 생성 뒤 기존 정의·본문·서식·공유 자원이 계획과 다릅니다.');
}
