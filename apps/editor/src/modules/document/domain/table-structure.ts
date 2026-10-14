import type {Snapshot,Table,AgentTableStructureOp} from '../public/types.ts';
export type TableStructureSnapshot=Snapshot;
const id=(s:number,p:number,c:number)=>`s${s}p${p}t${c}`;
function grid(t:Table){
 if(t.editable===false||![t.rows,t.columns].every(Number.isSafeInteger)||t.rows<1||t.columns<1||t.rows*t.columns>200||t.cells.length!==t.rows*t.columns||t.cells.some((c,i)=>c.index!==i||c.row!==Math.floor(i/t.columns)||c.column!==i%t.columns||c.rowSpan!==1||c.columnSpan!==1||!c.editable||c.properties.cellProtect!==false||!Number.isSafeInteger(c.properties.width)||Number(c.properties.width)<200||!Number.isSafeInteger(c.properties.height)||Number(c.properties.height)<200))throw new Error('표 나누기/붙이기는 비보호 평면 격자만 지원합니다.');
 for(const c of t.cells)if(c.properties.width!==t.cells[c.column].properties.width||c.properties.height!==t.cells[c.row*t.columns].properties.height)throw new Error('셀 크기와 행/열 격자가 일치하지 않습니다.');
}
export function tableStructurePlan(op:AgentTableStructureOp,s:TableStructureSnapshot){
 const t=s.structure?.tables.find(t=>t.id===op.target),source=s.tableStructureSources?.[op.target];
 if(!/\.hwpx$/iu.test(s.name)||!/^s\d+p\d+t\d+$/u.test(op.target)||!t||source?.editable!==true||!/^[a-f0-9]{64}$/u.test(source.fingerprint??''))throw new Error('조회된 HWPX 표 구조 명령 대상이 필요합니다.');grid(t);
 const keys=op.kind==='split_table'?['kind','target','atRow']:op.kind==='attach_table'?['kind','target','nextTarget']:[];if(!keys.length||Object.keys(op).some(k=>!keys.includes(k))||keys.some(k=>!Object.hasOwn(op,k)))throw new Error('표 구조 명령의 인자가 올바르지 않습니다.');
 const tables=s.structure!.tables.map(v=>structuredClone(v)),index=tables.findIndex(v=>v.id===t.id);let next:Table|undefined,removed=0;
 if(op.kind==='split_table'){
  if(!Number.isSafeInteger(op.atRow)||op.atRow<1||op.atRow>=t.rows||!source.splitRows?.includes(op.atRow))throw new Error('조회된 내부 행 경계에서만 표를 나눌 수 있습니다.');
  const front=tables[index],back=structuredClone(t);front.rows=op.atRow;front.cells=front.cells.filter(c=>c.row<op.atRow);back.rows-=op.atRow;back.paragraph+=2;back.control=0;back.id=id(back.section,back.paragraph,0);back.cells=back.cells.filter(c=>c.row>=op.atRow).map((c,index)=>({...c,index,row:c.row-op.atRow}));
  for(const v of tables)if(v.section===t.section&&v.paragraph>t.paragraph){v.paragraph+=2;v.id=id(v.section,v.paragraph,v.control);}tables.splice(index+1,0,back);next=back;
 }else{
  next=s.structure!.tables.find(v=>v.id===op.nextTarget);if(!next||source.nextTarget!==op.nextTarget||next.section!==t.section||next.paragraph<=t.paragraph||next.columns!==t.columns)throw new Error('조회된 같은 구역의 다음 표만 붙일 수 있습니다.');grid(next);
  if((t.rows+next.rows)*t.columns>200||t.cells.slice(0,t.columns).some((c,i)=>c.properties.width!==next!.cells[i].properties.width))throw new Error('표 붙이기의 칸 수/너비/셀 한도를 확인하세요.');
  for(let p=t.paragraph+1;p<=next.paragraph;p++){const node=s.nodes.find(n=>n.section===t.section&&n.paragraph===p),props=s.structure!.paragraphs.find(v=>v.id===`s${t.section}p${p}`);if(!node||node.text!==''||!props||props.controls?.some(c=>p===next!.paragraph?c!=='tbl':true))throw new Error('표 사이에 내용 또는 다른 컨트롤이 있습니다.');}
  removed=next.paragraph-t.paragraph;const front=tables[index];front.cells.push(...next.cells.map((c,i)=>({...structuredClone(c),index:t.cells.length+i,row:c.row+t.rows})));front.rows+=next.rows;tables.splice(tables.findIndex(v=>v.id===next!.id),1);for(const v of tables)if(v.section===t.section&&v.paragraph>next.paragraph){v.paragraph-=removed;v.id=id(v.section,v.paragraph,v.control);}
 }
 const front=tables[index];return {table:t,next,removed,tables,front};
}
