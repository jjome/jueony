import type {Snapshot,AgentSectionSplitOp} from '../public/types.ts';
/** The operation is isolated because inserting a section invalidates later numeric IDs. */
export function validateAgentSectionSplit(op:AgentSectionSplitOp,snapshot:Snapshot):void {
 const structure=snapshot.structure,node=snapshot.nodes.find(n=>n.id===op.target);
 if(structure?.sectionSplitAvailable!==true)throw new Error('이 엔진에는 AI 구역 나누기가 없습니다.');
 if(!node?.editable)throw new Error('구역 나누기는 편집 가능한 일반 본문 문단에서 요청하세요.');
 if(structure.sections.length>=100)throw new Error('구역은 최대 100개입니다.');
 if(!Number.isSafeInteger(op.offset)||op.offset<0||op.offset>Array.from(node.text).length)throw new Error('구역 나누기 위치는 문단 안의 Unicode 글자 위치여야 합니다.');
 const section=structure.sections.find(s=>s.index===node.section),nodes=snapshot.nodes.filter(n=>n.section===node.section);
 if(!section||section.columns?.columnCount!==1||section.lineNumbers?.enabled||structure.tables.some(t=>t.section===node.section)||nodes.some(n=>!n.editable))throw new Error('AI 구역 나누기는 줄 번호·표·개체·복잡한 문단이 없는 한 단 일반 본문 구역부터 지원합니다.');
 for(const n of nodes){const p=structure.paragraphs.find(p=>p.id===n.id);if(!p||p.pageHide?.exists||!Array.isArray(p.controls)||p.controls.some(c=>n.paragraph!==0||!['secd','cold'].includes(c)))throw new Error('감추기·필드·특수 제어가 있는 구역은 나누지 않습니다. 원본을 유지합니다.');}
}
