import type {AgentHeaderFooterOp,Snapshot} from '../public/types.ts';
export function validateAgentHeaderFooter(op:AgentHeaderFooterOp,snapshot:Snapshot):void {
 const s=snapshot.structure?.sections.find(s=>s.index===op.section);
 if(!Number.isSafeInteger(op.section)||op.section<0||!s||!['header','footer'].includes(op.story)||!['both','odd','even'].includes(op.pageKind))throw new Error('현재 구역·머리말/꼬리말·양쪽/홀짝 종류를 지정하세요.');
 const source=s.headerFooters?.find(h=>h.story===op.story&&h.pageKind===op.pageKind);
 if(!source?.exists||source.editable!==true||source.textTruncated||source.paragraphCount!==1)throw new Error(source?.reason??'조회된 기존 한 문단 일반 텍스트 머리말/꼬리말만 수정합니다. 원본은 유지합니다.');
 if(typeof op.originalText!=='string'||op.originalText!==source.text)throw new Error('머리말/꼬리말 원문이 현재 문서와 다릅니다. 다시 읽어 요청하세요.');
 if(typeof op.text!=='string'||Array.from(op.text).length>4000||/[\u0000-\u001f\u007f-\u009f]/u.test(op.text))throw new Error('머리말/꼬리말은 줄바꿈·탭·제어문자 없는 한 문단 4,000자 이하입니다.');
 if(op.text===source.text)throw new Error('머리말/꼬리말의 변경 내용이 없습니다.');
}
