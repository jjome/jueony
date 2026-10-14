import type {Snapshot,AgentParagraphOutlineOp} from '../public/types.ts';
export function agentParagraphOutlinePayload(op:AgentParagraphOutlineOp,s:Snapshot){
 const n=s.nodes.find(n=>n.id===op.target),p=s.structure?.paragraphs.find(p=>p.id===op.target)?.paragraph,cap=s.paragraphOutlineSources?.[op.target];
 if(!n?.editable||!p||cap?.editable!==true)throw new Error(cap?.reason??'현재 일반 본문과 저장된 구역 개요 정의가 필요합니다.');
 if(typeof op.enabled!=='boolean'||!Number.isInteger(op.level)||op.level<0||op.level>6)throw new Error('개요 여부와 0~6 정수 수준을 지정하세요.');
 const definition=s.listCatalog?.numberings.find(d=>d.id===cap.definitionId);
 if(!definition||op.enabled&&!definition.levelFormats[op.level])throw new Error('조회된 개요 번호 정의와 비어 있지 않은 수준이 필요합니다.');
 if(!op.enabled&&(op.level!==0||p.headType!=='Outline'))throw new Error('개요 해제는 현재 개요 문단에서 수준 0으로 요청하세요.');
 if(op.enabled&&p.headType==='Outline'&&p.numberingId===0&&p.paraLevel===op.level)throw new Error('개요 수준의 변경 내용이 없습니다.');
 return {headType:op.enabled?'Outline':'None',numberingId:0,paraLevel:op.level};
}
