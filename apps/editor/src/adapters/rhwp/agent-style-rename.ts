import {sha256} from '@noble/hashes/sha2.js';
import type {Snapshot,AgentRenameParagraphStyleOp} from '../../modules/document/public/index.ts';
import {agentRenameParagraphStyleName} from '../../modules/document/public/engine-integration.ts';
import {nativeDocument,parsed} from './structure.ts';
import {capturePreservationEvidence,readStoredStyleMetadata} from './preservation.ts';
const canonical=(v:any):any=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const same=(a:any,b:any)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const fingerprint=(v:any)=>Array.from(sha256(new TextEncoder().encode(JSON.stringify(canonical(v)))),n=>n.toString(16).padStart(2,'0')).join('');
export function readAgentStyleRenameSources(wasm:any):Pick<Snapshot,'styleRenameSources'>{
 const d=nativeDocument(wasm);if(typeof d.updateStyle!=='function'||typeof d.getStoredStyleDetail!=='function'||typeof d.getAgentStyleMetadata!=='function'||typeof d.getFieldList!=='function')return {};
 try{const fields=parsed(d.getFieldList()),fieldFree=Array.isArray(fields)&&fields.length===0;const styles=parsed(d.getStyleList());if(!Array.isArray(styles)||styles.length>256||styles.some((v,i)=>v.id!==i))return {};
 return {styleRenameSources:Object.fromEntries(styles.map(v=>{const detail=parsed(d.getStoredStyleDetail(v.id)),native=parsed(d.getAgentStyleMetadata(v.id)),metadata=readStoredStyleMetadata(d,v.id),editable=fieldFree&&v.id>0&&v.type===0&&native.rawCanonical===true&&metadata?.lockForm===false&&detail?.charProps&&detail?.paraProps;
 return [String(v.id),{editable:Boolean(editable),...(editable?{fingerprint:fingerprint({style:v,details:detail,metadata})}:{reason:'필드가 있는 문서와 바탕글·글자·양식 잠금·비정규 바이너리 스타일은 AI 이름 변경에서 보호합니다.'})}];}))};}catch{return {};}
}
export function executeAgentRenameParagraphStyle(wasm:any,base:Snapshot,op:AgentRenameParagraphStyleOp){
 const name=agentRenameParagraphStyleName(op,base),d=nativeDocument(wasm),styles=parsed(d.getStyleList()),current=readAgentStyleRenameSources(d).styleRenameSources?.[String(op.styleId)];
 if(!same(base.structure?.styles,styles.map((v:any)=>({id:v.id,name:v.name,type:v.type})))||current?.editable!==true||current.fingerprint!==base.styleRenameSources?.[String(op.styleId)]?.fingerprint)throw new Error('스타일 원본 또는 목록이 바뀌었습니다. 최신 문서로 다시 요청하세요.');
 const before=capturePreservationEvidence(d);if(before.issues.length)throw new Error('전체 문서 보존 정보를 확인하지 못했습니다.');const expected=structuredClone(before.values) as any;
 const target=expected.styles?.find((v:any)=>v.id===op.styleId);if(!target)throw new Error('스타일 보존 정보가 없습니다.');target.name=name;
 for(const [key,value]of Object.entries(expected) as [string,any][]){if(/^section\/\d+\/paragraph\/\d+$/u.test(key)&&value.style?.id===op.styleId)value.style.name=name;}
 if(d.updateStyle(op.styleId,JSON.stringify({name}))!==true)throw new Error('스타일 이름 변경에 실패했습니다.');
 const after=capturePreservationEvidence(d);if(after.issues.length||!same(after.values,expected))throw new Error('이름 변경 뒤 본문·서식·다음 스타일·언어·잠금·공유 자원이 계획과 다릅니다.');
}
