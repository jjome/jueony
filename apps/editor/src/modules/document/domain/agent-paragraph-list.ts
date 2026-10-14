import type {Snapshot,AgentParagraphListOp} from '../public/types.ts';
const fail=(m:string):never=>{throw new Error(m);};
export function agentParagraphListPayload(op:AgentParagraphListOp,s:Snapshot){
 const node=s.nodes.find(n=>n.id===op.target),source=s.structure?.paragraphs.find(p=>p.id===op.target)?.paragraph,cap=s.paragraphListSources?.[op.target];
 if(!node?.editable||!source||cap?.editable!==true)fail(cap?.reason??'현재 조회한 일반 본문 번호 원본만 변경합니다.');
 if(!['none','number','bullet'].includes(op.listKind)||!Number.isSafeInteger(op.definitionId)||op.definitionId<0||op.definitionId>65535||!Number.isSafeInteger(op.level)||op.level<0||op.level>6)fail('번호 종류·정의·수준이 잘못되었습니다.');
 if(op.listKind==='none'&&(op.definitionId!==0||op.level!==0)||op.listKind==='bullet'&&op.level!==0)fail('해제는 정의 0/수준 0, 글머리표는 수준 0으로 지정하세요.');
 const choices=op.listKind==='number'?s.listCatalog?.numberings:s.listCatalog?.bullets;
 if(op.listKind!=='none'&&(!op.definitionId||!choices?.some(c=>c.id===op.definitionId)))fail('현재 문서에 저장되어 조회된 번호/글머리표 정의만 선택하세요.');
 const payload={headType:{none:'None',number:'Number',bullet:'Bullet'}[op.listKind],numberingId:op.definitionId,paraLevel:op.level};
 if(source!.headType===payload.headType&&source!.numberingId===payload.numberingId&&source!.paraLevel===payload.paraLevel)fail('문단 번호의 변경 내용이 없습니다.');
 return payload;
}
