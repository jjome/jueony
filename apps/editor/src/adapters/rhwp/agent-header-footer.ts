import type {AgentHeaderFooter,AgentHeaderFooterOp,Snapshot} from '../../modules/document/public/index.ts';
import {validateAgentHeaderFooter} from '../../modules/document/public/engine-integration.ts';
const native=(w:any)=>w.borrowDocumentHandle?.()??w;
const parsed=(v:any)=>typeof v==='string'?JSON.parse(v):v;
const parity={both:0,even:1,odd:2};
/** Private native token is intentionally never copied into the model DTO. */
export function readAgentHeaderFooters(wasm:any,section:number):AgentHeaderFooter[]|undefined {
 const doc=native(wasm);if(typeof doc.getAgentHeaderFooter!=='function'||typeof doc.setAgentHeaderFooterText!=='function')return;
 const definition=parsed(doc.getSectionDef(section));
 return (['header','footer'] as const).flatMap(story=>(['both','odd','even'] as const).map(pageKind=>{
  try{const r=parsed(doc.getAgentHeaderFooter(section,story==='header',parity[pageKind]));
   if(typeof r.exists!=='boolean'||typeof r.editable!=='boolean'||typeof r.text!=='string'||!Number.isSafeInteger(r.paragraphCount)||r.paragraphCount<0||typeof r.textTruncated!=='boolean'||Array.from(r.text).length>4000||r.editable&&(!r.exists||r.paragraphCount!==1||r.textTruncated||typeof r.token!=='string'||!/^[a-f0-9]{64}$/u.test(r.token)))throw new Error('잘못된 머리말/꼬리말 응답');
   const hidden=definition[story==='header'?'hideHeader':'hideFooter'];
   return {story,pageKind,exists:r.exists,editable:r.editable,text:r.text,textTruncated:r.textTruncated,paragraphCount:r.paragraphCount,...(typeof hidden==='boolean'?{hiddenOnFirstPage:hidden}:{}),...(!r.editable?{reason:typeof r.reason==='string'?r.reason.slice(0,1000):'원본 머리말/꼬리말은 읽기 전용입니다.'}:{})};
  }catch{return {story,pageKind,exists:null,editable:false,text:'',textTruncated:false,paragraphCount:0,reason:'머리말/꼬리말의 안전한 편집 가능성을 확인하지 못했습니다. 원본은 유지합니다.'};}
 }));
}
export function executeAgentHeaderFooter(wasm:any,base:Snapshot,op:AgentHeaderFooterOp):void {
 validateAgentHeaderFooter(op,base);const doc=native(wasm),rows=readAgentHeaderFooters(doc,op.section);
 validateAgentHeaderFooter(op,{...base,structure:{...base.structure!,sections:base.structure!.sections.map(s=>s.index===op.section?{...s,headerFooters:rows}:s)}});
 const r=parsed(doc.getAgentHeaderFooter(op.section,op.story==='header',parity[op.pageKind]));
 const source=rows!.find(h=>h.story===op.story&&h.pageKind===op.pageKind)!;
 if(r.editable!==true||r.text!==op.originalText||typeof r.token!=='string'||!/^[a-f0-9]{64}$/u.test(r.token))throw new Error('머리말/꼬리말 원문·검증 정보가 바뀌었습니다.');
 doc.setAgentHeaderFooterText(op.section,op.story==='header',parity[op.pageKind],JSON.stringify({text:op.text,token:r.token}));
 const after=readAgentHeaderFooters(doc,op.section),expected=rows!.map(h=>h===source?{...h,text:op.text}:h);
 if(JSON.stringify(after)!==JSON.stringify(expected))throw new Error('머리말/꼬리말 변경 결과 또는 다른 홀짝 정의가 명령과 다릅니다.');
}
