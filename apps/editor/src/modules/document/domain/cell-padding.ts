import type {ControlOp,Snapshot,Cell,Table} from '../public/types.ts';
type Operation=Extract<ControlOp,{kind:'format_table_cells'}>;
const sides=['Left','Right','Top','Bottom'] as const;
const raw=(mm:number)=>Math.round(mm*7200/25.4);
/** Complete custom values avoid accidentally activating dormant inherited-side values. */
export function cellPaddingPlan(op:Operation,s:Snapshot):{table:Table;cells:Cell[];patch:Record<string,number|boolean>} {
 if(!/\.hwpx$/iu.test(s.name))throw new Error('AI 셀 안 여백은 현재 HWPX 원본만 지원합니다. HWP는 편집 화면과 저장 재열기의 글줄 배치 차이를 먼저 수정해야 합니다.');
 const table=s.structure?.tables.find(t=>t.id===op.target),source=s.cellPaddingSources?.[op.target],p=op.properties;
 if(!table||!/^s\d+p\d+t\d+$/u.test(op.target)||source?.editable!==true||!/^[a-f0-9]{64}$/u.test(source.fingerprint??''))throw new Error('조회된 안 여백 편집 가능 본문 단순 표가 필요합니다.');
 if(!['custom','table'].includes(p.paddingMode as string)||Object.keys(p).some(k=>!['paddingMode',...sides.map(v=>'padding'+v+'Mm')].includes(k)))throw new Error('셀 안 여백은 custom/table 모드로 다른 서식과 분리해 요청하세요.');
 if(p.paddingMode==='custom'&&sides.some(side=>typeof p['padding'+side+'Mm']!=='number'||!Number.isFinite(p['padding'+side+'Mm'])||Number(p['padding'+side+'Mm'])<0||Number(p['padding'+side+'Mm'])>100))throw new Error('직접 지정할 셀 안 여백 네 방향을 각각 0~100mm로 명시하세요.');
 if(p.paddingMode==='table'&&Object.keys(p).length!==1)throw new Error('표 기본 여백으로 되돌릴 때 개별 여백 값을 함께 지정하지 마세요.');
 if(!Number.isSafeInteger(op.startRow)||!Number.isSafeInteger(op.rowCount)||!Number.isSafeInteger(op.startColumn)||!Number.isSafeInteger(op.columnCount)||op.startRow<0||op.startColumn<0||op.rowCount<1||op.columnCount<1||op.startRow+op.rowCount>table.rows||op.startColumn+op.columnCount>table.columns)throw new Error('안 여백 셀 범위를 확인하세요.');
 const cells=table.cells.filter(c=>c.row>=op.startRow&&c.row<op.startRow+op.rowCount&&c.column>=op.startColumn&&c.column<op.startColumn+op.columnCount);
 if(table.editable===false||table.rows*table.columns>200||table.cells.length!==table.rows*table.columns||table.cells.some(c=>!c.editable||c.properties.cellProtect!==false||c.rowSpan!==1||c.columnSpan!==1)||cells.length!==op.rowCount*op.columnCount)throw new Error('안 여백은 보호·병합·복합 셀이 없는 200셀 이하의 표만 지원합니다.');
 const patch:Record<string,number|boolean>={applyInnerMargin:p.paddingMode==='custom'};
 if(p.paddingMode==='custom')for(const side of sides)patch['padding'+side]=raw(Number(p['padding'+side+'Mm']));
 const left=p.paddingMode==='custom'?Number(patch.paddingLeft):raw(source.defaultsMm?.left??NaN),right=p.paddingMode==='custom'?Number(patch.paddingRight):raw(source.defaultsMm?.right??NaN);
 if(!Number.isFinite(left)||!Number.isFinite(right)||cells.some(c=>!Number.isSafeInteger(c.properties.width)||Number(c.properties.width)<=left+right))throw new Error('좌우 안 여백 합계는 각 셀의 너비보다 작아야 합니다.');
 if(cells.every(c=>Object.entries(patch).every(([k,v])=>c.properties[k]===v)))throw new Error('현재 셀 안 여백 설정과 같습니다.');
 return {table,cells,patch};
}
