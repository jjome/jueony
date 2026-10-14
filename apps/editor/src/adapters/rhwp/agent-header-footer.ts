import type {AgentHeaderFooter,AgentHeaderFooterOp,AgentHeaderFooterFormatOp,Snapshot} from '../../modules/document/public/index.ts';
import {validateAgentHeaderFooter,validateAgentHeaderFooterFormat} from '../../modules/document/public/engine-integration.ts';
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
   let characters;
   if(r.editable&&typeof doc.applyCharFormatInHeaderFooter==='function'&&typeof doc.getCharPropertiesInHeaderFooter==='function'){
    const c=parsed(doc.getCharPropertiesInHeaderFooter(section,story==='header',parity[pageKind],0,0));
    if(typeof c.bold!=='boolean'||typeof c.italic!=='boolean'||typeof c.underline!=='boolean'||!Number.isFinite(c.fontSize)||typeof c.textColor!=='string'||!/^#[a-f0-9]{6}$/iu.test(c.textColor))throw new Error('머리말 글자 모양 조회 실패');
    characters={bold:c.bold,italic:c.italic,underline:c.underline,fontSizePt:c.fontSize/100,color:c.textColor.toLowerCase()};
   }
   const hidden=definition[story==='header'?'hideHeader':'hideFooter'];
   return {story,pageKind,exists:r.exists,editable:r.editable,text:r.text,textTruncated:r.textTruncated,paragraphCount:r.paragraphCount,...(characters?{characters}:{}),...(typeof hidden==='boolean'?{hiddenOnFirstPage:hidden}:{}),...(!r.editable?{reason:typeof r.reason==='string'?r.reason.slice(0,1000):'원본 머리말/꼬리말은 읽기 전용입니다.'}:{})};
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

export function executeAgentHeaderFooterFormat(wasm:any,base:Snapshot,op:AgentHeaderFooterFormatOp):void {
 validateAgentHeaderFooterFormat(op,base);const doc=native(wasm),rows=readAgentHeaderFooters(doc,op.section);
 validateAgentHeaderFooterFormat(op,{...base,structure:{...base.structure!,sections:base.structure!.sections.map(s=>s.index===op.section?{...s,headerFooters:rows}:s)}});
 const source=rows!.find(h=>h.story===op.story&&h.pageKind===op.pageKind)!;
 const raw=parsed(doc.getAgentHeaderFooter(op.section,op.story==='header',parity[op.pageKind]));
 if(raw.editable!==true||raw.text!==op.originalText||typeof raw.token!=='string'||!/^[a-f0-9]{64}$/u.test(raw.token))throw new Error('머리말/꼬리말 원문·서식 검증 정보가 바뀌었습니다.');
 // Same-text call performs the existing native IR/token validation without a mutation.
 doc.setAgentHeaderFooterText(op.section,op.story==='header',parity[op.pageKind],JSON.stringify({text:raw.text,token:raw.token}));
 const before=parsed(doc.getCharPropertiesInHeaderFooter(op.section,op.story==='header',parity[op.pageKind],0,0));
 const nativeProps=Object.fromEntries(Object.entries(op.properties).map(([k,v])=>[k==='fontSizePt'?'fontSize':k==='color'?'textColor':k,k==='fontSizePt'?Math.round((v as number)*100):v]));
 const result=parsed(doc.applyCharFormatInHeaderFooter(op.section,op.story==='header',parity[op.pageKind],0,0,0,Array.from(source.text).length,JSON.stringify(nativeProps)));
 if(result?.ok!==true)throw new Error('머리말/꼬리말 글자 서식을 적용하지 못했습니다.');
 const after=readAgentHeaderFooters(doc,op.section),expected=rows!.map(h=>h===source?{...h,characters:{...h.characters!,...op.properties,...(op.properties.fontSizePt!==undefined?{fontSizePt:Math.round(op.properties.fontSizePt*100)/100}:{}),...(op.properties.color?{color:op.properties.color.toLowerCase()}:{})}}:h);
 const current=parsed(doc.getCharPropertiesInHeaderFooter(op.section,op.story==='header',parity[op.pageKind],0,0));
 const retained=(value:Record<string,unknown>)=>Object.fromEntries(Object.entries(value).filter(([key])=>key!=='charShapeId'&&!(key in nativeProps)&&!(op.properties.underline!==undefined&&key==='underlineType')));
 if(JSON.stringify(after)!==JSON.stringify(expected)||JSON.stringify(retained(current))!==JSON.stringify(retained(before)))throw new Error('머리말/꼬리말 글자 서식 결과나 보존할 속성이 명령과 다릅니다.');
}
