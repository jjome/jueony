import type {AgentPageBackgroundOp} from '../../modules/document/public/types.ts';
import {nativeDocument,parsed} from './structure.ts';

/** Native source check includes opaque fill properties absent from UI getters. */
export function executeAgentPageBackground(wasm:any,op:AgentPageBackgroundOp):void {
 const doc=nativeDocument(wasm);
 if(typeof doc.getAgentPageBackground!=='function'||typeof doc.setAgentPageBackground!=='function')throw new Error('이 엔진에는 AI 쪽 배경 명령이 없습니다.');
 const before=parsed(doc.getAgentPageBackground(op.section,op.pageKind));
 if(!before.editable||typeof before.token!=='string')throw new Error(before.reason??'원본 쪽 배경은 읽기 전용입니다.');
 doc.setAgentPageBackground(op.section,op.pageKind,JSON.stringify({fillType:op.fillType,color:op.color,token:before.token}));
 for(const kind of op.pageKind==='both'?['both','even','odd']:[op.pageKind]){
  const after=parsed(doc.getAgentPageBackground(op.section,kind));
  if(!after.editable||after.fillType!==op.fillType||op.fillType==='solid'&&after.color?.toLowerCase()!==op.color.toLowerCase())throw new Error('쪽 배경 적용 결과가 명령과 다릅니다.');
 }
}
