import type {ControlOp,Snapshot,Table} from '../public/types.ts';
type Operation=Extract<ControlOp,{kind:'format_table_cells'}>;
/** Row commands address complete rows. Heights are exact requested results;
 * native content minima must be checked after layout, never silently accepted. */
export function rowHeightPlan(op:Operation,s:Snapshot):{table:Table;heights:number[];updates:{cellIdx:number;height:number}[];total:number} {
 if(!/\.hwpx$/iu.test(s.name))throw new Error('AI 행 높이는 현재 HWPX 원본만 지원합니다.');
 const table=s.structure?.tables.find(t=>t.id===op.target),source=s.rowHeightSources?.[op.target],p=op.properties;
 if(!table||!/^s\d+p\d+t\d+$/u.test(op.target)||source?.editable!==true||!/^[a-f0-9]{64}$/u.test(source.fingerprint??''))throw new Error('조회된 높이 편집 가능 본문 단순 표가 필요합니다.');
 const equal=Object.hasOwn(p,'equalizeRows');
 if(Object.keys(p).length!==1||(equal?p.equalizeRows!==true:typeof p.rowHeightMm!=='number'||!Number.isFinite(p.rowHeightMm)||p.rowHeightMm<1||p.rowHeightMm>300))throw new Error('행 높이는 equalizeRows:true 또는 rowHeightMm 숫자 하나만 단독 서식으로 요청하세요.');
 if(![op.startRow,op.rowCount,op.startColumn,op.columnCount].every(Number.isSafeInteger)||op.startRow<0||op.rowCount<(equal?2:1)||op.startRow+op.rowCount>table.rows||op.startColumn!==0||op.columnCount!==table.columns)throw new Error('높이는 모든 열에 걸친 전체 행을 지정하세요. 높이 같게는 두 행 이상이어야 합니다.');
 if(![table.rows,table.columns].every(Number.isSafeInteger)||table.editable===false||table.rows<1||table.columns<1||table.rows*table.columns>200||table.cells.length!==table.rows*table.columns||table.cells.some(c=>!c.editable||c.properties.cellProtect!==false||c.rowSpan!==1||c.columnSpan!==1||![c.index,c.row,c.column,c.properties.height].every(Number.isSafeInteger)||c.index<0||c.row<0||c.row>=table.rows||c.column<0||c.column>=table.columns||Number(c.properties.height)<200||Number(c.properties.height)>0x7fffffff)||new Set(table.cells.map(c=>c.row+':'+c.column)).size!==table.cells.length||new Set(table.cells.map(c=>c.index)).size!==table.cells.length)throw new Error('높이는 보호·병합·복합 셀이 없는 200셀 이하의 표만 지원합니다.');
 const heights=Array.from({length:table.rows},(_,row)=>Number(table.cells.find(c=>c.row===row&&c.column===0)?.properties.height));
 const originalTotal=heights.reduce((a,b)=>a+b,0);
 if(heights.some(h=>!Number.isSafeInteger(h)||h<200)||table.cells.some(c=>c.properties.height!==heights[c.row])||originalTotal!==source.tableHeight||!Number.isSafeInteger(originalTotal)||!Number.isSafeInteger(source.maxTableHeight)||Number(source.maxTableHeight)<200)throw new Error('행마다 일치하는 저장 높이와 잉여 없는 표 총높이가 필요합니다.');
 const selected=heights.slice(op.startRow,op.startRow+op.rowCount),sum=selected.reduce((a,b)=>a+b,0),base=equal?Math.floor(sum/op.rowCount):Math.round(Number(p.rowHeightMm)*7200/25.4),remainder=equal?sum%op.rowCount:0;
 const next=heights.map((h,row)=>row>=op.startRow&&row<op.startRow+op.rowCount?base+(row-op.startRow<remainder?1:0):h),total=next.reduce((a,b)=>a+b,0);
 if(!Number.isSafeInteger(total)||total>Number(source.maxTableHeight)||next.some(h=>h<200))throw new Error('변경할 표 높이가 바깥 여백·위치 오프셋을 제외한 본문 높이를 넘습니다.');
 const updates=table.cells.flatMap(c=>{if(c.row<op.startRow||c.row>=op.startRow+op.rowCount)return [];const prop=c.properties;
  const top=prop.applyInnerMargin===true?Number(prop.paddingTop):(source.defaultsMm?.top??NaN)*7200/25.4,bottom=prop.applyInnerMargin===true?Number(prop.paddingBottom):(source.defaultsMm?.bottom??NaN)*7200/25.4;
  if(!Number.isFinite(top)||!Number.isFinite(bottom)||top<0||bottom<0||next[c.row]<=Math.round(top)+Math.round(bottom))throw new Error('행 높이가 셀의 상하 안 여백보다 커야 합니다.');
  return next[c.row]===c.properties.height?[]:[{cellIdx:c.index,height:next[c.row]}];
 });
 if(!updates.length)throw new Error('선택한 행의 저장 높이가 이미 같습니다. 내용에 따른 자동 높이는 별도로 확인하세요.');
 return {table,heights:next,updates,total};
}
