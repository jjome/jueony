import type {ControlOp,Snapshot,Table,AgentRowHeightSource} from '../../modules/document/public/index.ts';
import {rowHeightPlan} from '../../modules/document/public/engine-integration.ts';
import {readEqualColumnSources} from './equal-columns.ts';
import {nativeDocument,parsed,readStructure} from './structure.ts';
import {assertNativeTableWritable} from './table-write-guard.ts';
import {capturePreservationEvidence} from './preservation.ts';
import {tableLayoutEvidence,sameTableLayout} from './table-layout-evidence.ts';
const canonical=(v:any):any=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const same=(a:any,b:any)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
function frame(d:any,t:Table):{cells:any[];scale:number} {
 const frames:{page:number;value:any}[]=[];
 for(let page=0;page<d.pageCount();page++)for(const value of parsed(d.getPageControlLayout(page)).controls.filter((c:any)=>c.type==='table'&&c.secIdx===t.section&&c.paraIdx===t.paragraph&&c.controlIdx===t.control))frames.push({page,value});
 if(frames.length!==1)throw new Error('행 높이는 한 쪽에 완전히 배치된 표만 지원합니다.');
 const {page,value}=frames[0],info=parsed(d.getPageInfo(page)),paper=parsed(d.getPageDef(t.section)),width=paper.landscape?paper.height:paper.width,scale=info.width/width;
 if(info.sectionIndex!==t.section||!Number.isSafeInteger(width)||width<=0||!Number.isFinite(scale)||Math.abs(info.width-width*96/7200)>0.2)throw new Error('행 높이를 확인할 수 없는 쪽 좌표 환경입니다.');
 const cells=value.cells;if(!Array.isArray(cells)||cells.length!==t.cells.length||new Set(cells.map((c:any)=>c.cellIdx)).size!==cells.length||cells.some((c:any)=>!t.cells.some(v=>v.index===c.cellIdx&&v.row===c.row&&v.column===c.col)||!['x','y','w','h'].every(k=>Number.isFinite(c[k]))||c.w<=0||c.h<=0))throw new Error('행 높이의 전체 셀 사각형을 확인하지 못했습니다.');
 return {cells,scale};
}
export function readRowHeightSources(wasm:any,tables:Table[],name:string):Record<string,AgentRowHeightSource>|undefined {
 const d=nativeDocument(wasm),sources=readEqualColumnSources(d,tables,name);if(!sources)return;
 return Object.fromEntries(tables.map(t=>{try{const source=sources[t.id],p=parsed(d.getTableProperties(t.section,t.paragraph,t.control)),page=parsed(d.getPageDef(t.section));
  const heights=Array.from({length:t.rows},(_,row)=>Number(t.cells.find(c=>c.row===row&&c.column===0)?.properties.height)),total=heights.reduce((a,b)=>a+b,0),flat=Array.from({length:t.section},(_,i)=>d.getParagraphCount(i)).reduce((a:number,b:number)=>a+b,0)+t.paragraph,controls=parsed(d.getControls()).filter((c:any)=>c.list===0&&c.para===flat&&c.ctrlId==='tbl');
  if(source?.editable!==true||!source.directWidth||p.cellSpacing!==0||controls.length!==1||controls[0].props?.Height!==total||!Number.isSafeInteger(total)||p.tableHeight!==total||heights.some(v=>!Number.isSafeInteger(v)||v<200)||t.cells.some(c=>c.properties.height!==heights[c.row])||![page.height,page.width,page.marginTop,page.marginBottom,page.marginHeader,page.marginFooter,p.outerTop,p.outerBottom,p.vertOffset].every(v=>Number.isSafeInteger(v)&&v>=0))throw new Error('unsupported');
  frame(d,t);
  const maxTableHeight=(page.landscape?page.width:page.height)-page.marginTop-page.marginBottom-page.marginHeader-page.marginFooter-p.outerTop-p.outerBottom-p.vertOffset;
  if(!Number.isSafeInteger(maxTableHeight)||maxTableHeight<200)throw new Error('unsupported');
  return [t.id,{editable:true,fingerprint:source.fingerprint,defaultsMm:source.defaultsMm,tableHeight:total,maxTableHeight}];
 }catch{return [t.id,{editable:false,reason:'AI 행 높이는 HWPX의 한 쪽 본문 단순 표만 지원합니다. 단일 단·왼쪽 문단 배치·일치하는 저장 행/표 높이가 필요하며 보호·병합·중첩·필드·복합 원본은 제외합니다.'}];}}));
}
/** Also called INSIDE the strict post-render transaction before history commit. */
export function assertRowHeightResult(wasm:any,base:Snapshot,op:Extract<ControlOp,{kind:'format_table_cells'}>):void {
 const d=nativeDocument(wasm),plan=rowHeightPlan(op,base),t=plan.table,after=readStructure(d).tables.find(v=>v.id===t.id);
 if(!after||after.rows!==t.rows||after.columns!==t.columns||after.cells.some(c=>c.properties.height!==plan.heights[c.row]))throw new Error('적용한 행의 저장 높이가 계획과 다릅니다.');
 const rendered=frame(d,after);
 for(const c of rendered.cells)if(c.row>=op.startRow&&c.row<op.startRow+op.rowCount&&Math.abs(c.h-plan.heights[c.row]*rendered.scale)>0.2)throw new Error('셀 내용·서식·안 여백 때문에 요청한 실제 행 높이를 맞출 수 없습니다. 적용하지 않습니다.');
 let reopened:any;try{reopened=new d.constructor(d.exportHwpx());if(!sameTableLayout(tableLayoutEvidence(d,t),tableLayoutEvidence(reopened,t)))throw new Error('행 높이 변경 후 저장 재열기의 실제 셀/글줄 배치가 다릅니다. 적용하지 않습니다.');}finally{reopened?.free();}
}
export function executeRowHeights(wasm:any,base:Snapshot,op:Extract<ControlOp,{kind:'format_table_cells'}>):void {
 const plan=rowHeightPlan(op,base),d=nativeDocument(wasm),structure=readStructure(d),t=structure.tables.find(v=>v.id===op.target),source=readRowHeightSources(d,structure.tables,base.name)?.[op.target];
 if(!t||!same(t,plan.table)||source?.editable!==true||!same(source,base.rowHeightSources?.[op.target]))throw new Error('표 높이·배치·셀 내용·용지가 바뀌었습니다. 최신 문서로 다시 요청하세요.');
 assertNativeTableWritable(d,t);
 const before=capturePreservationEvidence(d);if(before.issues.length)throw new Error('행 높이 변경의 보존 정보를 확인하지 못했습니다.');const expected=structuredClone(before.values) as any;
 for(const update of plan.updates){const cell=expected.cells?.find((v:any)=>v.list.hostListId===0&&v.list.sectionIndex===t.section&&v.list.hostPara===t.paragraph&&v.list.controlIndex===t.control&&v.list.cellIndex===update.cellIdx);if(!cell)throw new Error('행 높이 셀의 보존 정보가 없습니다.');cell.properties.height=update.height;}
 const flat=Array.from({length:t.section},(_,i)=>d.getParagraphCount(i)).reduce((a:number,b:number)=>a+b,0)+t.paragraph,object=expected.objects?.find((v:any)=>v.object.kind==='table'&&v.object.para===flat&&v.object.controlIndex===t.control),control=expected.controls?.filter((v:any)=>v.ctrlId==='tbl'&&v.list===0&&v.para===flat);
 if(!object?.properties||control?.length!==1)throw new Error('행 높이의 표 공통 저장 정보를 확인하지 못했습니다.');object.properties.tableHeight=plan.total;control[0].props.Height=plan.total;
 for(const update of plan.updates)if(parsed(d.setCellProperties(t.section,t.paragraph,t.control,update.cellIdx,JSON.stringify({height:update.height})))?.ok!==true)throw new Error('셀의 행 높이 변경에 실패했습니다.');
 const after=capturePreservationEvidence(d);if(after.issues.length||!same(after.values,expected))throw new Error('높이 변경 뒤 내용·서식·너비·안 여백·다른 행·자원이 계획과 다릅니다.');
 assertRowHeightResult(d,base,op);
}
