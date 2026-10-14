import type {Snapshot,AgentBasicBulletOp} from '../public/types.ts';
export const basicBulletCharacters=['●','○','■','□','◆','◇','▶','▷'] as const;
export function validateAgentBasicBullet(op:AgentBasicBulletOp,s:Snapshot){
 const n=s.nodes.find(n=>n.id===op.target),p=s.structure?.paragraphs.find(p=>p.id===op.target)?.paragraph,cap=s.basicBulletSources?.[op.target];
 if(!n?.editable||!p||cap?.editable!==true)throw new Error(cap?.reason??'현재 지원되는 일반 본문 글머리표 원본이 필요합니다.');
 if(typeof op.character!=='string'||!(basicBulletCharacters as readonly string[]).includes(op.character))throw new Error('기본 문자 글머리표 8종 중 하나를 선택하세요.');
 if(p.headType==='Bullet'&&s.listCatalog?.bullets.find(b=>b.id===p.numberingId)?.char===op.character)throw new Error('글머리표의 변경 내용이 없습니다.');
 return op.character;
}
