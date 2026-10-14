import {readAgentStyleState} from './agent-style-source.ts';
import type {Snapshot,AgentRenameParagraphStyleOp} from '../../modules/document/public/index.ts';
import {agentRenameParagraphStyleName} from '../../modules/document/public/engine-integration.ts';
import {nativeDocument,parsed} from './structure.ts';
import {capturePreservationEvidence} from './preservation.ts';
const canonical=(v:any):any=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const same=(a:any,b:any)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
export function readAgentStyleRenameSources(wasm:any):Pick<Snapshot,'styleRenameSources'>{
 const state=readAgentStyleState(wasm);return state?{styleRenameSources:state.sources}:{};
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
