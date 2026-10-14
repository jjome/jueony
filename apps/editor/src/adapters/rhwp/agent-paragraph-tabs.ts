import type {Snapshot,BodyNode,AgentParagraphTabsOp,AgentParagraphTabSource} from '../../modules/document/public/index.ts';
import {agentParagraphTabsPayload} from '../../modules/document/public/engine-integration.ts';
import {nativeDocument,parsed} from './structure.ts';
import {capturePreservationEvidence} from './preservation.ts';
export function readAgentParagraphTabSources(wasm:any,nodes:BodyNode[]):Record<string,AgentParagraphTabSource>|undefined{
 const doc=nativeDocument(wasm);if(typeof doc.getAgentParagraphTabs!=='function'||typeof doc.setAgentParagraphTabs!=='function')return;
 return Object.fromEntries(nodes.map(n=>{try{const raw=parsed(doc.getAgentParagraphTabs(n.section,n.paragraph)),editable=n.editable&&raw.editable===true;return [n.id,{editable,...(!editable?{reason:n.reason??(typeof raw.reason==='string'?raw.reason.slice(0,500):'현재 원본 문단 탭은 읽기 전용입니다.')}:{})}];}catch{return [n.id,{editable:false,reason:'원본 탭 속성을 확인하지 못했습니다.'}];}}));
}
const canonical=(v:any):any=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const tabProperties=(p:any)=>({tabStops:p.tabStops,tabAutoLeft:p.tabAutoLeft,tabAutoRight:p.tabAutoRight});
export function executeAgentParagraphTabs(wasm:any,base:Snapshot,op:AgentParagraphTabsOp):void{
 const payload=agentParagraphTabsPayload(op,base),doc=nativeDocument(wasm),node=base.nodes.find(n=>n.id===op.target)!;
 const current=parsed(doc.getParaPropertiesAt(node.section,node.paragraph)),source=base.structure!.paragraphs.find(p=>p.id===op.target)!.paragraph;
 if(doc.getTextRange(node.section,node.paragraph,0,doc.getParagraphLength(node.section,node.paragraph))!==node.text||JSON.stringify(canonical(tabProperties(current)))!==JSON.stringify(canonical(tabProperties(source))))throw new Error('문단 원문 또는 탭 설정이 바뀌었습니다. 최신 문서로 다시 요청하세요.');
 const raw=parsed(doc.getAgentParagraphTabs(node.section,node.paragraph));if(raw.editable!==true||typeof raw.token!=='string'||!/^[a-f0-9]{64}$/u.test(raw.token))throw new Error('원본 문단 탭 검증 정보가 없습니다.');
 const before=capturePreservationEvidence(doc);if(before.issues.length)throw new Error('전체 문서 보존 정보를 확인하지 못했습니다.');
 const expected=structuredClone(before.values),key=`section/${node.section}/paragraph/${node.paragraph}`,target:any=expected[key];if(!target?.paragraph)throw new Error('대상 문단 보존 정보가 없습니다.');Object.assign(target.paragraph,payload);
 const response=parsed(doc.setAgentParagraphTabs(node.section,node.paragraph,JSON.stringify({...payload,token:raw.token})));
 if(response?.editable!==true||JSON.stringify(canonical(response.stops))!==JSON.stringify(canonical(payload.tabStops))||response.autoLeft!==payload.tabAutoLeft||response.autoRight!==payload.tabAutoRight)throw new Error('문서 엔진의 탭 설정 결과가 요청과 다릅니다.');
 const after=capturePreservationEvidence(doc);
 if(after.issues.length||JSON.stringify(canonical(after.values))!==JSON.stringify(canonical(expected)))throw new Error('문단 탭 적용 뒤 본문·서식·다른 문단·쪽 설정이 계획과 다릅니다.');
}
