import type {AgentMasterPageOp,DocumentProperties} from '../public/types.ts';
import {validateMasterPageText} from './master-page-settings.ts';

export function agentMasterPagePayload(op:Extract<AgentMasterPageOp,{kind:'set_master_page_text'}>,paper?:DocumentProperties){
 if(paper&&(![paper.width,paper.height].every(v=>typeof v==='number'&&Number.isSafeInteger(v)&&v>0)||typeof paper.landscape!=='boolean'))throw new Error('바탕쪽의 실제 편집 용지 크기를 확인하지 못했습니다.');
 const raw=(value:number)=>{if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>2000)throw new Error('바탕쪽 위치는 0~2000mm이며 편집 용지 안이어야 합니다.');return Math.round(value*7200/25.4);};
 if(typeof op.fontSizePt!=='number'||!Number.isFinite(op.fontSizePt)||op.fontSizePt<1||op.fontSizePt>72||typeof op.color!=='string')throw new Error('바탕쪽 글자 크기는 1~72pt이며 색상을 확인하세요.');
 return validateMasterPageText({text:op.text,x:raw(op.xMm),y:raw(op.yMm),fontSize:Math.round(op.fontSizePt*100),color:op.color,bold:op.bold},paper?{width:Number(paper.width),height:Number(paper.height),landscape:paper.landscape===true}:undefined);
}
/** Matches the existing checked binary-HWP master-page ordering contract. */
export function assertAgentMasterKinds(name:string,kinds:string[]):void {
 if(kinds.length>3||new Set(kinds).size!==kinds.length||kinds.some(k=>!['both','odd','even'].includes(k)))throw new Error('중복·확장 바탕쪽은 기본 Agent 명령으로 변경하지 않습니다.');
 if(/\.hwp$/iu.test(name)&&!['','both','odd','both,odd','both,even,odd'].includes([...kinds].sort().join(',')))throw new Error('이 바탕쪽 홀짝 조합은 HWP에서 보존되지 않습니다. HWPX를 사용하거나 양쪽·홀수·짝수 순서로 만드세요.');
}
