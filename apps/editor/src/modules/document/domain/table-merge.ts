import type {Snapshot,Table,AgentTableMergeOp} from '../public/types.ts';
export function tableMergePlan(op:AgentTableMergeOp,s:Snapshot):{table:Table;selected:Table['cells'];width:number;height:number} {
 const t=s.structure?.tables.find(t=>t.id===op.target),source=s.tableMergeSources?.[op.target];
 if(!/\.hwpx$/iu.test(s.name)||!/^s\d+p\d+t\d+$/u.test(op.target)||!t||!source?.editable||!/^[a-f0-9]{64}$/u.test(source.fingerprint??''))throw new Error('조회된 HWPX 병합 가능 본문 단순 표가 필요합니다.');
 if(![op.startRow,op.startColumn,op.rowCount,op.columnCount].every(Number.isSafeInteger)||op.startRow<0||op.startColumn<0||op.rowCount<1||op.columnCount<1||op.rowCount*op.columnCount<2||op.startRow+op.rowCount>t.rows||op.startColumn+op.columnCount>t.columns)throw new Error('두 셀 이상의 유효한 사각형 병합 범위를 지정하세요.');
 if(t.editable===false||t.cells.length!==t.rows*t.columns||t.cells.length>200||t.cells.some(c=>!c.editable||c.properties.cellProtect!==false||c.rowSpan!==1||c.columnSpan!==1)||new Set(t.cells.map(c=>c.row+':'+c.column)).size!==t.cells.length||t.cells.some((c,i)=>c.index!==i||c.row!==Math.floor(i/t.columns)||c.column!==i%t.columns))throw new Error('병합 전 표는 보호·병합·복합 셀이 없는 정규 평면 표여야 합니다.');
 const selected=t.cells.filter(c=>c.row>=op.startRow&&c.row<op.startRow+op.rowCount&&c.column>=op.startColumn&&c.column<op.startColumn+op.columnCount);
 const dimensions=t.cells.every(c=>Number.isSafeInteger(c.properties.width)&&Number(c.properties.width)>=200&&Number.isSafeInteger(c.properties.height)&&Number(c.properties.height)>=200&&c.properties.width===t.cells[c.column].properties.width&&c.properties.height===t.cells[c.row*t.columns].properties.height);
 const canonical=(v:any):any=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
 if(!dimensions||selected.some(c=>{const {width:w,height:h,...p}=c.properties,{width:w0,height:h0,...first}=selected[0].properties;return JSON.stringify(canonical(p))!==JSON.stringify(canonical(first));}))throw new Error('병합 셀은 크기 외 셀 속성·테두리·안 여백·제목 설정이 같아야 합니다. 문단/글자 서식은 각각 보존합니다.');
 const width=selected.filter(c=>c.row===op.startRow).reduce((n,c)=>n+Number(c.properties.width),0),height=selected.filter(c=>c.column===op.startColumn).reduce((n,c)=>n+Number(c.properties.height),0);
 if(![width,height].every(v=>Number.isSafeInteger(v)&&v<=0x7fffffff))throw new Error('병합 크기가 저장 범위를 넘습니다.');
 return {table:t,selected,width,height};
}
