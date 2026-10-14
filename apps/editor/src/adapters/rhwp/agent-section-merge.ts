import type {Snapshot,AgentSectionMergeOp} from '../../modules/document/public/index.ts';
import {validateAgentSectionMerge} from '../../modules/document/public/engine-integration.ts';
import {nativeDocument,parsed,readStructure} from './structure.ts';
/** The native staged merger and shared current-format preflight remain authoritative. */
export function executeAgentSectionMerge(wasm:any,base:Snapshot,op:AgentSectionMergeOp):{sectionIndex:number;paragraphIndex:number;charOffset:number} {
 validateAgentSectionMerge(op,base);const doc=nativeDocument(wasm);
 if(typeof doc.mergeSectionBoundary!=='function')throw new Error('이 엔진에는 AI 구역 합치기가 없습니다.');
 const read=()=>Array.from({length:doc.getSectionCount()},(_,s)=>Array.from({length:doc.getParagraphCount(s)},(_,p)=>doc.getTextRange(s,p,0,doc.getParagraphLength(s,p)) as string));
 const before=read(),original=base.structure!.sections.map(s=>base.nodes.filter(n=>n.section===s.index).sort((a,b)=>a.paragraph-b.paragraph).map(n=>n.text));
 if(JSON.stringify(before)!==JSON.stringify(original))throw new Error('구역 합치기의 본문 원문이나 구역 수가 바뀌었습니다. 최신 문서로 다시 요청하세요.');
 const current={...base,structure:readStructure(doc)};validateAgentSectionMerge(op,current);
 const expected=structuredClone(before),right=op.rightSection,left=right-1,p=before[left].length-1,offset=Array.from(before[left][p]).length;
 expected.splice(left,2,[...before[left].slice(0,p),before[left][p]+before[right][0],...before[right].slice(1)]);
 const settings=(s:typeof current.structure.sections[number])=>{const {index,emptySectionRemoval,...value}=s;return value;};
 const retained=current.structure.sections.filter(s=>s.index!==right).map(settings);
 const result=parsed(doc.mergeSectionBoundary(right)),after=readStructure(doc);
 if(result?.ok!==true||result.sectionIdx!==left||result.paraIdx!==p||result.charOffset!==offset||after.sections.length!==before.length-1||JSON.stringify(read())!==JSON.stringify(expected)||JSON.stringify(after.sections.map(settings))!==JSON.stringify(retained))throw new Error('구역 합치기 결과의 위치·본문·앞 구역 설정이 명령과 다릅니다.');
 return {sectionIndex:left,paragraphIndex:p,charOffset:offset};
}
