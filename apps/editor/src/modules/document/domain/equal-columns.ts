import type {ControlOp,Snapshot,Table} from '../public/types.ts';
type Operation=Extract<ControlOp,{kind:'format_table_cells'}>;
/** Full column bands have a durable rectangular representation. Remainders stay
 * in HWPUNIT, assigned from the first selected column; total width is unchanged. */
function columnWidthsPlan(op:Operation,s:Snapshot,explicit:boolean):{table:Table;updates:{cellIdx:number;widthDelta:number}[]} {
 if(!/\.hwpx$/iu.test(s.name))throw new Error('AI 열 너비 균등 분배는 현재 HWPX 원본만 지원합니다.');
 const table=s.structure?.tables.find(t=>t.id===op.target),source=s.equalColumnSources?.[op.target];
 if(!table||!/^s\d+p\d+t\d+$/u.test(op.target)||source?.editable!==true||!/^[a-f0-9]{64}$/u.test(source.fingerprint??''))throw new Error('조회된 균등 분배 가능 본문 단순 표가 필요합니다.');
 if((explicit ? typeof op.properties.columnWidthMm!=='number'||!Number.isFinite(op.properties.columnWidthMm)||op.properties.columnWidthMm<1||op.properties.columnWidthMm>500 : op.properties.equalizeColumns!==true)||Object.keys(op.properties).length!==1)throw new Error(explicit?'열 너비 지정은 columnWidthMm 숫자만 단독 서식으로 요청하세요.':'열 너비 균등 분배는 equalizeColumns:true만 단독 서식으로 요청하세요.');
 if(![op.startRow,op.rowCount,op.startColumn,op.columnCount].every(Number.isSafeInteger)||op.startRow!==0||op.rowCount!==table.rows||op.startColumn<0||op.columnCount<(explicit?1:2)||op.startColumn+op.columnCount>table.columns)throw new Error(explicit?'너비 지정은 표 전체 행에 걸친 한 열 이상을 지정하세요.':'너비 같게는 표 전체 행에 걸친 두 열 이상을 지정하세요.');
 if(![table.rows,table.columns].every(Number.isSafeInteger)||table.editable===false||table.rows<1||table.columns<(explicit?1:2)||table.rows*table.columns>200||table.cells.length!==table.rows*table.columns||table.cells.some(c=>!c.editable||c.properties.cellProtect!==false||c.rowSpan!==1||c.columnSpan!==1)||new Set(table.cells.map(c=>c.row+':'+c.column)).size!==table.cells.length||new Set(table.cells.map(c=>c.index)).size!==table.cells.length)throw new Error('균등 분배는 보호·병합·복합 셀이 없는 200셀 이하의 표만 지원합니다.');
 const widths=Array.from({length:table.columns},(_,column)=>Number(table.cells.find(c=>c.row===0&&c.column===column)?.properties.width));
 if(widths.some(w=>!Number.isSafeInteger(w)||w<200)||table.cells.some(c=>!Number.isSafeInteger(c.index)||c.index<0||c.row<0||c.row>=table.rows||c.column<0||c.column>=table.columns||!Number.isInteger(c.row)||!Number.isInteger(c.column)||c.properties.width!==widths[c.column])||widths.reduce((a,b)=>a+b,0)>0x7fffffff)throw new Error('행마다 일치하는 저장 열 너비가 필요합니다.');
 const selected=widths.slice(op.startColumn,op.startColumn+op.columnCount),sum=selected.reduce((a,b)=>a+b,0),base=Math.floor(sum/op.columnCount),remainder=sum%op.columnCount;
 const requested=explicit?Math.round(Number(op.properties.columnWidthMm)*7200/25.4):0;
 if(explicit){const section=s.structure?.sections.find(v=>v.index===table.section),page=section?.page,columns=section?.columns;
  if(!page||columns?.columnCount!==1||![page.width,page.height,page.marginLeft,page.marginRight,page.marginGutter].every(v=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0)||typeof page.landscape!=='boolean')throw new Error('직접 너비 지정은 용지 폭을 읽을 수 있는 단일 단 구역만 지원합니다.');
  const available=Number(page.landscape?page.height:page.width)-Number(page.marginLeft)-Number(page.marginRight)-Number(page.marginGutter);
  const total=widths.reduce((a,b)=>a+b,0)-sum+requested*op.columnCount;
  const max=source.directWidth?.maxTableWidth;
  if(!Number.isSafeInteger(max)||Number(max)<200)throw new Error('직접 너비 지정은 조회된 단일 단·문단 기준 왼쪽 배치 표만 지원합니다.');
  if(!Number.isSafeInteger(total)||total<200||total>Math.min(available,Number(max)))throw new Error('변경한 표의 총너비가 바깥 여백·위치 오프셋을 제외한 본문 폭을 넘습니다.');
 }
 const updates=table.cells.flatMap(c=>{if(c.column<op.startColumn||c.column>=op.startColumn+op.columnCount)return [];
  const width=explicit?requested:base+(c.column-op.startColumn<remainder?1:0),p=c.properties,left=p.applyInnerMargin===true?Number(p.paddingLeft):(source.defaultsMm?.left??NaN)*7200/25.4,right=p.applyInnerMargin===true?Number(p.paddingRight):(source.defaultsMm?.right??NaN)*7200/25.4;
  if(!Number.isFinite(left)||!Number.isFinite(right)||left<0||right<0||width<=Math.round(left)+Math.round(right))throw new Error('균등 너비가 셀의 좌우 안 여백보다 커야 합니다.');
  return width===p.width?[]:[{cellIdx:c.index,widthDelta:width-Number(p.width)}];
 });
 if(!updates.length)throw new Error('선택한 열의 너비가 이미 같습니다.');
 return {table,updates};
}

export const equalColumnsPlan=(op:Operation,s:Snapshot)=>columnWidthsPlan(op,s,false);
/** Millimetres at the public boundary; integer HWPUNIT in the native plan. */
export const explicitColumnWidthPlan=(op:Operation,s:Snapshot)=>columnWidthsPlan(op,s,true);
