import type {Snapshot,AgentHeaderFooterCreateOp} from '../../modules/document/public/index.ts';
import {validateAgentHeaderFooterCreate} from '../../modules/document/public/engine-integration.ts';
import {readStructure,nativeDocument,parsed} from './structure.ts';
import {captureHeaderFooterBody,stableHeaderFooterStructure} from './agent-header-footer-structure.ts';
const parity={both:0,even:1,odd:2};
/** Create one missing stored definition; existing and inherited definitions are never silently rewritten. */
export function executeAgentHeaderFooterCreate(wasm:any,base:Snapshot,op:AgentHeaderFooterCreateOp):void {
 validateAgentHeaderFooterCreate(op,base);const doc=nativeDocument(wasm),before=readStructure(doc);
 validateAgentHeaderFooterCreate(op,{...base,structure:before});
 const header=op.story==='header',apply=parity[op.pageKind],absent=parsed(doc.getAgentHeaderFooter(op.section,header,apply));
 if(absent.exists!==false||absent.paragraphCount!==0||absent.text!=='')throw new Error('생성 전에 저장 정의의 부재를 확인하지 못했습니다.');
 const originalBody=captureHeaderFooterBody(doc),expected=structuredClone(before);
 const result=parsed(doc.createHeaderFooter(op.section,header,apply));if(result?.ok!==true)throw new Error('새 머리말/꼬리말 정의를 만들지 못했습니다.');
 const raw=parsed(doc.getAgentHeaderFooter(op.section,header,apply)),created=readStructure(doc).sections.find(s=>s.index===op.section)!.headerFooters!.find(h=>h.story===op.story&&h.pageKind===op.pageKind)!;
 const chars=parsed(doc.getCharPropertiesInHeaderFooter(op.section,header,apply,0,0)),para=parsed(doc.getParaPropertiesInHf(op.section,header,apply,0));
 if(raw.editable!==true||raw.text!==''||raw.paragraphCount!==1||raw.textTruncated!==false||typeof raw.token!=='string'||!/^[a-f0-9]{64}$/u.test(raw.token)||chars.charShapeId!==0||para.paraShapeId!==0)throw new Error('새 정의가 기본 서식의 빈 한 문단이 아닙니다.');
 doc.setAgentHeaderFooterText(op.section,header,apply,JSON.stringify({text:op.text,token:raw.token}));
 const target=expected.sections.find(s=>s.index===op.section)!.headerFooters!.findIndex(h=>h.story===op.story&&h.pageKind===op.pageKind)!,section=expected.sections.find(s=>s.index===op.section)!;
 section.headerFooters![target]={...created,text:op.text};
 const host=expected.paragraphs.find(p=>p.id===`s${op.section}p0`);if(!host?.controls)throw new Error('생성 대상 구역의 첫 본문 문단을 확인하지 못했습니다.');
 host.controls.push(header?'head':'foot');expected.unsupportedControls=[...new Set(expected.paragraphs.flatMap(p=>(p.controls??[]).filter(id=>!['secd','cold'].includes(id))))];
 const after=readStructure(doc);
 if(JSON.stringify(captureHeaderFooterBody(doc))!==JSON.stringify(originalBody)||JSON.stringify(stableHeaderFooterStructure(after,op))!==JSON.stringify(stableHeaderFooterStructure(expected,op)))throw new Error('머리말/꼬리말 생성 뒤 본문·다른 정의·설정이 계획과 다릅니다.');
}
