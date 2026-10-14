import type {Snapshot,AgentNumberingCloneOp} from '../public/types.ts';
export function validateAgentNumberingClone(op:AgentNumberingCloneOp,s:Snapshot){
 const n=s.nodes.find(n=>n.id===op.target),p=s.structure?.paragraphs.find(p=>p.id===op.target),cap=s.paragraphListSources?.[op.target];
 if(!n?.editable||!p||cap?.editable!==true)throw new Error(cap?.reason??'일반 본문 번호 원본이 필요합니다.');
 if(!Number.isInteger(op.sourceDefinitionId)||op.sourceDefinitionId<1||op.sourceDefinitionId>200)throw new Error('현재 조회된 번호 정의 ID가 필요합니다.');
 const definition=s.listCatalog?.numberings.find(d=>d.id===op.sourceDefinitionId),source=s.numberingDefinitionSources?.find(d=>d.id===op.sourceDefinitionId);
 if(!definition||source?.editable!==true)throw new Error(source?.reason??'복제 가능한 번호 정의 원본이 없습니다.');
 if(!Number.isInteger(op.level)||op.level<0||op.level>6||!definition.levelFormats[op.level])throw new Error('번호 형식이 있는 1~7수준을 선택하세요.');
 if(!Number.isInteger(op.startNumber)||op.startNumber<1||op.startNumber>65535)throw new Error('시작 번호는 1~65535 정수입니다.');
 return op;
}
