import type {Snapshot,AgentEmptySectionOp,AgentEmptySectionEligibility} from '../../modules/document/public/index.ts';
import {validateAgentEmptySection} from '../../modules/document/public/engine-integration.ts';
import {validateEmptySectionRemovalPlan} from '../../modules/document/public/index.ts';
import {readEmptySectionRemovalPlan,executeEmptySectionRemoval} from './empty-section-removal.ts';
import {nativeDocument,parsed,readStructure} from './structure.ts';
/** The token and internal native cursor never enter the model context. */
export function readAgentEmptySectionEligibility(wasm:any,section:number):AgentEmptySectionEligibility|undefined {
 const doc=nativeDocument(wasm);
 if(typeof doc.getEmptySectionRemovalPlan!=='function'||typeof doc.removeEmptySection!=='function')return;
 try{const raw=parsed(doc.getEmptySectionRemovalPlan(section));
  if(raw?.ok!==true||raw.section!==section||typeof raw.supported!=='boolean')throw new Error('잘못된 삭제 가능성 응답');
  if(raw.supported)validateEmptySectionRemovalPlan(raw);
  return {supported:raw.supported,...(!raw.supported?{reason:typeof raw.reason==='string'?raw.reason.slice(0,1000):'원본 빈 구역 삭제는 지원 범위 밖입니다.'}:{})};
 }catch{return {supported:false,reason:'빈 본문 구역의 삭제 가능성을 확인하지 못했습니다. 원본은 유지합니다.'};}
}
export function executeAgentEmptySection(wasm:any,base:Snapshot,op:AgentEmptySectionOp):{sectionIndex:number;paragraphIndex:number;charOffset:number} {
 validateAgentEmptySection(op,base);const doc=nativeDocument(wasm),plan=readEmptySectionRemovalPlan(doc,op.section);
 if(plan.sectionCountBefore!==base.structure!.sections.length)throw new Error('구역 수가 바뀌었습니다. 최신 문서로 다시 요청하세요.');
 const before=readStructure(doc),texts=Array.from({length:doc.getSectionCount()},(_,s)=>Array.from({length:doc.getParagraphCount(s)},(_,p)=>doc.getTextRange(s,p,0,doc.getParagraphLength(s,p))));
 const original=base.structure!.sections.map(s=>base.nodes.filter(n=>n.section===s.index).sort((a,b)=>a.paragraph-b.paragraph).map(n=>n.text));
 if(JSON.stringify(texts)!==JSON.stringify(original))throw new Error('빈 구역 삭제의 본문 원문이 바뀌었습니다. 최신 문서로 다시 요청하세요.');
 const expected=texts.filter((_,s)=>s!==op.section),survivors=before.sections.filter(s=>s.index!==op.section);
 const cursor=executeEmptySectionRemoval(doc,plan),after=readStructure(doc);
 const content=Array.from({length:doc.getSectionCount()},(_,s)=>Array.from({length:doc.getParagraphCount(s)},(_,p)=>doc.getTextRange(s,p,0,doc.getParagraphLength(s,p))));
 // Eligibility is derived from the entire current document, not a stored setting.
 const settings=(s:typeof survivors[number])=>{const {index,emptySectionRemoval,...value}=s;return value;};
 if(after.sections.length!==survivors.length||JSON.stringify(content)!==JSON.stringify(expected)||JSON.stringify(after.sections.map(settings))!==JSON.stringify(survivors.map(settings)))throw new Error('빈 구역 삭제 후 남은 본문·구역 설정이 계획과 다릅니다.');
 return cursor;
}
