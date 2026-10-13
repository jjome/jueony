import type {AgentMasterPages,AgentMasterPageOp} from '../../modules/document/public/types.ts';
import {agentMasterPagePayload} from '../../modules/document/public/engine-integration.ts';
import {readMasterPages,planMasterPageEdits,executeMasterPageEdits} from './master-pages.ts';
const handle=(wasm:any)=>wasm.borrowDocumentHandle?.()??wasm;
const parsed=(v:any)=>typeof v==='string'?JSON.parse(v):v;
const mm=(v:number)=>Math.round(v*25.4/7200*1000000)/1000000;
export function readAgentMasterPages(wasm:any,section:number):AgentMasterPages {
 const native=readMasterPages(wasm,section),kinds=native.pages.map((p:any)=>p.kind);
 const bounded=native.pages.length<=3&&new Set(kinds).size===kinds.length&&kinds.every((k:string)=>['both','odd','even'].includes(k));
 const pages=native.pages.map((p:any)=>{
  if(typeof p.text!=='string')throw new Error('바탕쪽 텍스트를 읽지 못했습니다.');
  const chars=Array.from(p.text),textTruncated=chars.length>4000;
  return {kind:p.kind,text:chars.slice(0,4000).join(''),textTruncated,xMm:mm(p.x),yMm:mm(p.y),fontSizePt:p.fontSize/100,color:p.color,bold:p.bold,italic:p.italic,underline:p.underline??null,editable:native.editable&&p.editable&&bounded&&!textTruncated,paragraphCount:p.paragraphCount,controlCount:p.controlCount};
 });
 const editable=native.editable&&bounded&&pages.every((p:any)=>p.editable);
 return {editable,pages,...(editable?{}:{reason:'표·그림·필드·혼합/확장·중복 또는 긴 원본 바탕쪽은 읽기 전용입니다. 긴 텍스트는 4,000자 미리보기입니다.'})};
}
export function executeAgentMasterPage(wasm:any,name:string,op:AgentMasterPageOp):void {
 const doc=handle(wasm),current=readAgentMasterPages(doc,op.section);
 if(!current.editable)throw new Error(current.reason??'원본 바탕쪽은 읽기 전용입니다.');
 const value=op.kind==='delete_master_page'?null:agentMasterPagePayload(op,parsed(doc.getPageDef(op.section)));
 const edits=planMasterPageEdits({fileName:name,borrowDocumentHandle:()=>doc},op.section,op.pageKind,value,'current');
 executeMasterPageEdits(doc,edits);
}
