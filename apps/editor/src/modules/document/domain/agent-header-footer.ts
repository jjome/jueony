import type {AgentHeaderFooterOp,AgentHeaderFooterFormatOp,AgentHeaderFooterParagraphOp,Snapshot} from '../public/types.ts';
function sourceFor(op:AgentHeaderFooterOp|AgentHeaderFooterFormatOp|AgentHeaderFooterParagraphOp,snapshot:Snapshot) {
 const s=snapshot.structure?.sections.find(s=>s.index===op.section);
 if(!Number.isSafeInteger(op.section)||op.section<0||!s||!['header','footer'].includes(op.story)||!['both','odd','even'].includes(op.pageKind))throw new Error('현재 구역·머리말/꼬리말·양쪽/홀짝 종류를 지정하세요.');
 const source=s.headerFooters?.find(h=>h.story===op.story&&h.pageKind===op.pageKind);
 if(!source?.exists||source.editable!==true||source.textTruncated||source.paragraphCount!==1)throw new Error(source?.reason??'조회된 기존 한 문단 일반 텍스트 머리말/꼬리말만 수정합니다. 원본은 유지합니다.');
 if(typeof op.originalText!=='string'||op.originalText!==source.text)throw new Error('머리말/꼬리말 원문이 현재 문서와 다릅니다. 다시 읽어 요청하세요.');
 return source;
}
export function validateAgentHeaderFooter(op:AgentHeaderFooterOp,snapshot:Snapshot):void {
 const source=sourceFor(op,snapshot);
 if(typeof op.text!=='string'||Array.from(op.text).length>4000||/[\u0000-\u001f\u007f-\u009f]/u.test(op.text))throw new Error('머리말/꼬리말은 줄바꿈·탭·제어문자 없는 한 문단 4,000자 이하입니다.');
 if(op.text===source.text)throw new Error('머리말/꼬리말의 변경 내용이 없습니다.');
}

export function validateAgentHeaderFooterFormat(op:AgentHeaderFooterFormatOp,snapshot:Snapshot):void {
 const source=sourceFor(op,snapshot),props=op.properties;
 if(!source.characters||!source.text)throw new Error('글자가 있는 기존 단순 머리말/꼬리말의 조회된 글자 모양이 필요합니다.');
 if(!props||typeof props!=='object'||Array.isArray(props)||!Object.keys(props).length)throw new Error('변경할 머리말/꼬리말 글자 서식이 없습니다.');
 for(const [key,value] of Object.entries(props)){
  if(['bold','italic','underline'].includes(key)){if(typeof value!=='boolean')throw new Error('굵게·기울임·밑줄은 참/거짓 값입니다.');}
  else if(key==='fontSizePt'){if(typeof value!=='number'||!Number.isFinite(value)||value<1||value>200)throw new Error('글자 크기는 1~200pt입니다.');}
  else if(key==='color'){if(typeof value!=='string'||!/^#[a-f0-9]{6}$/iu.test(value))throw new Error('글자 색은 #RRGGBB입니다.');}
  else throw new Error('지원하지 않는 머리말/꼬리말 글자 서식입니다.');
 }
}

export function validateAgentHeaderFooterParagraph(op:AgentHeaderFooterParagraphOp,snapshot:Snapshot):void {
 const source=sourceFor(op,snapshot),props=op.properties;
 if(!source.paragraph)throw new Error('기존 단순 머리말/꼬리말의 조회된 문단 모양이 필요합니다.');
 if(!props||typeof props!=='object'||Array.isArray(props)||!Object.keys(props).length)throw new Error('변경할 머리말/꼬리말 문단 서식이 없습니다.');
 for(const [key,value]of Object.entries(props)){
  if(key==='alignment'){if(!['left','right','center','justify','distribute'].includes(value as string))throw new Error('문단 정렬 값이 잘못되었습니다.');}
  else if(key==='lineSpacingPercent'){if(typeof value!=='number'||!Number.isInteger(value)||value<50||value>500)throw new Error('줄 간격은 50~500의 정수 백분율입니다.');}
  else throw new Error('머리말/꼬리말 문단 서식은 정렬과 백분율 줄 간격만 지원합니다.');
 }
}
