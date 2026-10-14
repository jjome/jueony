import type {Snapshot,AgentEmptySectionOp} from '../public/types.ts';
export function validateAgentEmptySection(op:AgentEmptySectionOp,snapshot:Snapshot):void {
 const structure=snapshot.structure;
 if(!structure||structure.sections.length<2||structure.sections.length>100||!Number.isSafeInteger(op.section)||op.section<0)throw new Error('삭제할 기존 구역이 필요합니다. 유일한 구역은 유지합니다.');
 const section=structure.sections.find(s=>s.index===op.section);
 if(section?.emptySectionRemoval?.supported!==true)throw new Error(section?.emptySectionRemoval?.reason??'이 구역의 빈 본문 삭제 가능성이 확인되지 않았습니다.');
 const nodes=snapshot.nodes.filter(n=>n.section===op.section);
 if(nodes.length!==1||nodes[0].text!==''||!nodes[0].editable)throw new Error('빈 본문 문단 하나의 구역만 삭제합니다. 공백·추가 문단·본문은 유지합니다.');
}
