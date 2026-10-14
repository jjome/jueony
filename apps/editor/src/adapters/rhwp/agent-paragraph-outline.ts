import type {Snapshot,BodyNode,AgentListCatalog,AgentParagraphOutlineOp} from '../../modules/document/public/index.ts';
import {agentParagraphOutlinePayload} from '../../modules/document/public/engine-integration.ts';
import {readAgentParagraphLists} from './agent-paragraph-list.ts';
import {nativeDocument,parsed} from './structure.ts';
import {capturePreservationEvidence} from './preservation.ts';
const canonical=(v:any):any=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const same=(a:any,b:any)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
export function readAgentParagraphOutlineSources(wasm:any,nodes:BodyNode[],catalog?:AgentListCatalog):Pick<Snapshot,'paragraphOutlineSources'>{
 const d=nativeDocument(wasm);if(!catalog||typeof d.getAgentParagraphOutline!=='function'||typeof d.setAgentParagraphOutline!=='function')return {};
 return {paragraphOutlineSources:Object.fromEntries(nodes.map(n=>{try{const raw=parsed(d.getAgentParagraphOutline(n.section,n.paragraph)),editable=n.editable&&raw.editable===true&&catalog.numberings.some(v=>v.id===raw.definitionId);return [n.id,editable?{editable:true,definitionId:raw.definitionId}:{editable:false,reason:n.reason??(typeof raw.reason==='string'?raw.reason.slice(0,500):'현재 저장된 구역 개요 정의가 필요합니다.')}];}catch{return [n.id,{editable:false,reason:'개요 원본을 확인하지 못했습니다.'}];}}))};
}
const list=(p:any)=>({headType:p.headType,numberingId:p.numberingId,paraLevel:p.paraLevel});
export function executeAgentParagraphOutline(wasm:any,base:Snapshot,op:AgentParagraphOutlineOp):void{
 const props=agentParagraphOutlinePayload(op,base),d=nativeDocument(wasm),n=base.nodes.find(n=>n.id===op.target)!;
 const current=parsed(d.getParaPropertiesAt(n.section,n.paragraph)),source=base.structure!.paragraphs.find(p=>p.id===op.target)!.paragraph;
 if(d.getTextRange(n.section,n.paragraph,0,d.getParagraphLength(n.section,n.paragraph))!==n.text||!same(list(current),list(source))||!same(readAgentParagraphLists(d,base.nodes).listCatalog,base.listCatalog))throw new Error('문단 원문·번호 또는 정의가 바뀌었습니다. 최신 문서로 다시 요청하세요.');
 const raw=parsed(d.getAgentParagraphOutline(n.section,n.paragraph));if(raw.definitionId!==base.paragraphOutlineSources?.[op.target]?.definitionId)throw new Error('구역 개요 번호 정의가 바뀌었습니다.');if(raw.editable!==true||typeof raw.token!=='string'||!/^[a-f0-9]{64}$/u.test(raw.token))throw new Error('원본 문단 번호 검증 정보가 없습니다.');
 const storedRestarts=parsed(d.getAgentListDefinitions()).storedRestarts;
 const before=capturePreservationEvidence(d);if(before.issues.length)throw new Error('전체 문서 보존 정보를 확인하지 못했습니다.');
 const expected=structuredClone(before.values),key=`section/${n.section}/paragraph/${n.paragraph}`,target:any=expected[key];if(!target?.paragraph)throw new Error('대상 문단 보존 정보가 없습니다.');Object.assign(target.paragraph,props);
 // The engine reports inferred continuation modes based on preceding list paragraphs.
 // They are computed views, not stored restart instructions (Native rejects explicit restarts).
 for(const [k,v]of Object.entries(expected))if(/^section\/\d+\/paragraph\/\d+$/u.test(k)){const p=(v as any).paragraph;delete p.numberingRestartMode;delete p.numberingStartNum;}
 const response=parsed(d.setAgentParagraphOutline(n.section,n.paragraph,JSON.stringify({enabled:op.enabled,level:op.level,token:raw.token})));
 if(response.editable!==true)throw new Error('문서 엔진이 문단 번호 명령을 확인하지 못했습니다.');
 const after=capturePreservationEvidence(d);for(const [k,v]of Object.entries(after.values))if(/^section\/\d+\/paragraph\/\d+$/u.test(k)){const p=(v as any).paragraph;delete p.numberingRestartMode;delete p.numberingStartNum;}
 if(!same(storedRestarts,parsed(d.getAgentListDefinitions()).storedRestarts)||after.issues.length||!same(after.values,expected))throw new Error('문단 번호 적용 뒤 본문·서식·공유 정의·다른 문단이 계획과 다릅니다.');
}
