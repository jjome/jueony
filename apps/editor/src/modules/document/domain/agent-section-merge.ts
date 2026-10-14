import type {Snapshot,AgentSectionMergeOp} from '../public/types.ts';
/** Numeric section/paragraph addresses change after a merge; use one isolated command. */
export function validateAgentSectionMerge(op:AgentSectionMergeOp,snapshot:Snapshot):void {
 const structure=snapshot.structure;
 if(structure?.sectionMergeAvailable!==true)throw new Error('이 엔진에는 AI 구역 합치기가 없습니다.');
 if(!Number.isSafeInteger(op.rightSection)||op.rightSection<1||op.rightSection>=structure.sections.length||structure.sections.length>100)throw new Error('합칠 뒤 구역은 현재 두 번째부터 100개 이내 구역이어야 합니다.');
 for(const index of [op.rightSection-1,op.rightSection]){
  const section=structure.sections.find(s=>s.index===index),nodes=snapshot.nodes.filter(n=>n.section===index).sort((a,b)=>a.paragraph-b.paragraph);
  if(!section||section.columns?.columnCount!==1||section.lineNumbers?.enabled||!section.masterPages?.editable||section.masterPages.pages.length||structure.tables.some(t=>t.section===index)||!nodes.length||nodes.some((n,p)=>!n.editable||n.paragraph!==p))throw new Error('AI 구역 합치기는 바탕쪽·줄 번호·표·개체·혼합 서식이 없는 두 한 단 일반 본문 구역부터 지원합니다.');
  for(const n of nodes){const p=structure.paragraphs.find(p=>p.id===n.id);if(!p||p.pageHide?.exists||!Array.isArray(p.controls)||p.controls.some(c=>n.paragraph!==0||!['secd','cold'].includes(c)))throw new Error('감추기·머리말·꼬리말·필드·특수 제어가 있는 구역은 합치지 않습니다. 원본을 유지합니다.');}
 }
 const left=snapshot.nodes.filter(n=>n.section===op.rightSection-1).sort((a,b)=>a.paragraph-b.paragraph).at(-1)!;
 const right=snapshot.nodes.find(n=>n.section===op.rightSection&&n.paragraph===0)!;
 if(Array.from(left.text).length+Array.from(right.text).length>4000)throw new Error('합친 경계 문단은 4,000자 이내여야 합니다.');
}
