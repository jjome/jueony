import type {Snapshot,AgentBasicNumberingOp} from '../public/types.ts';
export const basicNumberingPatterns=['decimal','parenthesized','closing_parenthesis'] as const;
export function basicNumberingFormats(pattern:string){if(!(basicNumberingPatterns as readonly string[]).includes(pattern))throw new Error('기본 숫자 번호 3종을 선택하세요.');return Array.from({length:7},(_,i)=>pattern==='parenthesized'?`(^${i+1})`:pattern==='closing_parenthesis'?`^${i+1})`:`^${i+1}.`);}
export function validateAgentBasicNumbering(op:AgentBasicNumberingOp,s:Snapshot){
 const n=s.nodes.find(n=>n.id===op.target),cap=s.basicNumberingSources?.[op.target];
 if(!n?.editable||!s.structure?.paragraphs.some(p=>p.id===op.target)||cap?.editable!==true)throw new Error(cap?.reason??'일반 본문 번호 원본이 필요합니다.');
 basicNumberingFormats(op.pattern);
 if(!Number.isInteger(op.level)||op.level<0||op.level>6)throw new Error('번호 수준은 0~6 정수입니다.');
 if(!Number.isInteger(op.startNumber)||op.startNumber<1||op.startNumber>65535)throw new Error('시작 번호는 1~65535 정수입니다.');
 return op;
}
