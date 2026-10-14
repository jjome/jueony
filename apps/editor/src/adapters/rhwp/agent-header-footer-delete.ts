import type {Snapshot,AgentHeaderFooterDeleteOp,Structure} from '../../modules/document/public/index.ts';
import {validateAgentHeaderFooterDelete} from '../../modules/document/public/engine-integration.ts';
import {readStructure,nativeDocument,parsed} from './structure.ts';
import {capturePreservationEvidence} from './preservation.ts';
type RootControl={list:number;para:number;controlIndex:number;ctrlId:string};
const parity={both:0,even:1,odd:2};
/** Delete one stored definition, preserving body content and all other stored settings. */
export function executeAgentHeaderFooterDelete(wasm:any,base:Snapshot,op:AgentHeaderFooterDeleteOp):void {
 validateAgentHeaderFooterDelete(op,base);const doc=nativeDocument(wasm),before=readStructure(doc);
 validateAgentHeaderFooterDelete(op,{...base,structure:before});
 const header=op.story==='header',apply=parity[op.pageKind],raw=parsed(doc.getAgentHeaderFooter(op.section,header,apply));
 if(raw.editable!==true||raw.text!==op.originalText||typeof raw.token!=='string'||!/^[a-f0-9]{64}$/u.test(raw.token))throw new Error('머리말/꼬리말 원본 검증 정보가 바뀌었습니다.');
 doc.setAgentHeaderFooterText(op.section,header,apply,JSON.stringify({text:raw.text,token:raw.token}));
 const target=parsed(doc.getHeaderFooter(op.section,header,apply));
 const positions=Array.from({length:doc.getSectionCount()},(_,s)=>Array.from({length:doc.getParagraphCount(s)},(_,p)=>[s,p])).flat();
 const flat=positions.findIndex(([s,p])=>s===op.section&&p===target.paraIndex),controls:RootControl[]=parsed(doc.getControls());
 if(flat<0||!Number.isSafeInteger(target.controlIndex)||!controls.some(c=>c.list===0&&c.para===flat&&c.controlIndex===target.controlIndex&&c.ctrlId===(header?'head':'foot')))throw new Error('삭제 대상 머리말/꼬리말의 본문 위치를 확인하지 못했습니다.');
 const text=()=>positions.map(([s,p])=>doc.getTextRange(s,p,0,doc.getParagraphLength(s,p)));
 const bodyEvidence=()=>{const evidence=capturePreservationEvidence(doc);if(evidence.issues.length)throw new Error('삭제 전후 본문 보존 속성을 모두 확인하지 못했습니다.');return Object.fromEntries(Object.entries(evidence.values).filter(([key])=>/^section\/\d+\/paragraph\/\d+$/u.test(key)));};
 const originalBody=bodyEvidence(),originalText=text(),expected=structuredClone(before);
 const entry=expected.sections.find(s=>s.index===op.section)!.headerFooters!.find(h=>h.story===op.story&&h.pageKind===op.pageKind)!;
 // A missing stored definition can reveal a prior section's inheritance. No blank override is created.
 Object.assign(entry,{exists:false,editable:false,deletable:false,text:'',textTruncated:false,paragraphCount:0});delete entry.characters;delete entry.paragraph;delete entry.reason;
 const list=expected.paragraphs[flat].controls!,i=list.findIndex((_,i)=>controls.filter(c=>c.list===0&&c.para===flat)[i]?.controlIndex===target.controlIndex);
 if(i<0)throw new Error('본문 제어 목록이 삭제 대상과 다릅니다.');list.splice(i,1);
 expected.unsupportedControls=[...new Set(controls.filter(c=>!(c.list===0&&c.para===flat&&c.controlIndex===target.controlIndex)&&!['secd','cold'].includes(c.ctrlId)).map(c=>c.ctrlId))] as string[];
 const result=parsed(doc.deleteHeaderFooter(op.section,header,apply));if(result?.ok!==true)throw new Error('머리말/꼬리말 정의를 삭제하지 못했습니다.');
 const after=readStructure(doc);
 const stable=(value:Structure)=>({...value,sections:value.sections.map(s=>{const {emptySectionRemoval,...rest}=s;return {...rest,...(s.lineNumbers?{lineNumbers:{...s.lineNumbers,editable:undefined}}:{}),headerFooters:s.headerFooters?.map(h=>{if(s.index!==op.section||h.story!==op.story||h.pageKind!==op.pageKind)return h;const {reason,...definition}=h;return definition;})};}),paragraphs:value.paragraphs.map(p=>{const {pageIndex,...rest}=p;return rest;})});
 if(JSON.stringify(bodyEvidence())!==JSON.stringify(originalBody)||JSON.stringify(text())!==JSON.stringify(originalText)||JSON.stringify(stable(after))!==JSON.stringify(stable(expected)))throw new Error('머리말/꼬리말 삭제 뒤 본문·다른 정의·설정이 계획과 다릅니다.');
}
