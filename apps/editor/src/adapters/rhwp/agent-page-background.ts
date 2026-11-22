import type {AgentPageBackgroundOp} from '../../modules/document/public/types.ts';
import {nativeDocument,parsed} from './structure.ts';

/** Native source check includes opaque fill properties absent from UI getters. */
export function executeAgentPageBackground(wasm:any,op:AgentPageBackgroundOp):void {
 const doc=nativeDocument(wasm);
 if(typeof doc.getAgentPageBackground!=='function'||typeof doc.setAgentPageBackground!=='function')throw new Error('이 엔진에는 AI 쪽 배경 명령이 없습니다.');
 const before=parsed(doc.getAgentPageBackground(op.section,op.pageKind));
 const gradient=op.fillType==='gradient';
 const token=gradient?before.gradientToken:before.token;
 if(!(gradient?before.gradientEditable:before.editable)||typeof token!=='string')throw new Error(before.reason??'원본 쪽 배경은 읽기 전용입니다.');
 const payload={fillType:op.fillType,color:op.color,token,...(gradient?{endColor:op.endColor,angle:op.angle}:{})};
 doc.setAgentPageBackground(op.section,op.pageKind,JSON.stringify(payload));
 for(const kind of op.pageKind==='both'?['both','even','odd']:[op.pageKind]){
  const after=parsed(doc.getAgentPageBackground(op.section,kind));
  const matches=gradient
   ?after.gradientEditable===true&&after.gradient?.type===1&&after.gradient.angle===op.angle
    &&after.gradient.colors?.[0]?.toLowerCase()===op.color.toLowerCase()&&after.gradient.colors?.[1]?.toLowerCase()===op.endColor.toLowerCase()
   :after.editable===true&&(op.fillType==='none'||after.color?.toLowerCase()===op.color.toLowerCase());
  if(!matches||after.fillType!==op.fillType)throw new Error('쪽 배경 적용 결과가 명령과 다릅니다.');
 }
}
