import type {Snapshot,AgentTableSplitOp} from '../public/types.ts';
export function tableSplitPlan(op:AgentTableSplitOp,s:Snapshot){
 const t=s.structure?.tables.find(t=>t.id===op.target),source=s.tableSplitSources?.[op.target];
 if(!/\.hwpx$/iu.test(s.name)||!/^s\d+p\d+t\d+$/u.test(op.target)||!t||source?.editable!==true||!/^[a-f0-9]{64}$/u.test(source.fingerprint??''))throw new Error('조회된 HWPX 기본 분할 가능 표가 필요합니다.');
 if(![op.row,op.column].every(Number.isSafeInteger)||op.row<0||op.column<0)throw new Error('분할할 주 셀의 행·열 좌표를 지정하세요.');
 const primary=t.cells.find(c=>c.row===op.row&&c.column===op.column);
 if(!primary||primary.properties.cellProtect!==false||t.editable===false||primary.rowSpan*primary.columnSpan<2)throw new Error('병합된 비보호 주 셀만 기본 분할할 수 있습니다.');
 if(![t.rows,t.columns].every(Number.isSafeInteger)||t.rows<1||t.columns<1||t.rows*t.columns>200||source.widths?.length!==t.columns||source.heights?.length!==t.rows||[...source.widths,...source.heights].some(v=>!Number.isSafeInteger(v)||v<200))throw new Error('분할 격자의 실제 원본 너비·높이를 확인하지 못했습니다.');
 if(t.cells.some((c,i)=>c.index!==i||c.properties.cellProtect!==false||c!==primary&&(c.rowSpan!==1||c.columnSpan!==1||!c.editable)))throw new Error('기본 분할은 주 셀 하나만 병합된 평면 표를 지원합니다.');
 const width=source.widths.slice(primary.column,primary.column+primary.columnSpan).reduce((a,b)=>a+b,0),height=source.heights.slice(primary.row,primary.row+primary.rowSpan).reduce((a,b)=>a+b,0);
 if(width!==primary.properties.width||height!==primary.properties.height)throw new Error('주 셀 크기와 주변 격자의 합이 다릅니다.');
 const cells=t.cells.filter(c=>c!==primary).map(c=>({...c}));
 for(let row=primary.row;row<primary.row+primary.rowSpan;row++)for(let column=primary.column;column<primary.column+primary.columnSpan;column++)cells.push({...primary,row,column,rowSpan:1,columnSpan:1,text:row===primary.row&&column===primary.column?primary.text:'',properties:{...primary.properties,width:source.widths[column],height:source.heights[row]}});
 cells.sort((a,b)=>a.row-b.row||a.column-b.column);cells.forEach((c,index)=>c.index=index);
 if(cells.length!==t.rows*t.columns||cells.some((c,i)=>c.row!==Math.floor(i/t.columns)||c.column!==i%t.columns))throw new Error('분할 범위가 겹치거나 격자에 빈 위치가 있습니다.');
 return {table:t,primary,cells};
}
