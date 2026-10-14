import type {ControlOp,Snapshot,Table,AgentCellPaddingSource} from '../../modules/document/public/index.ts';
import {cellPaddingPlan} from '../../modules/document/public/engine-integration.ts';
import {readAgentTablePaginationSources} from './agent-table-pagination.ts';
import {nativeDocument,parsed,readStructure} from './structure.ts';
import {assertNativeTableWritable} from './table-write-guard.ts';
import {capturePreservationEvidence} from './preservation.ts';
const sides=['Left','Right','Top','Bottom'] as const;
const canonical=(v:any):any=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const same=(a:any,b:any)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
export function readCellPaddingSources(wasm:any,tables:Table[],documentName:string):Record<string,AgentCellPaddingSource>|undefined {
 if(!/\.hwpx$/iu.test(documentName))return Object.fromEntries(tables.map(t=>[t.id,{editable:false,reason:'AI 셀 안 여백은 HWPX 원본만 지원합니다. HWP의 후속 표·행 높이 저장 재열기 차이는 추가 수정이 필요합니다.'}]));
 const d=nativeDocument(wasm),sources=readAgentTablePaginationSources(d,tables);if(!sources||typeof d.setCellProperties!=='function')return;
 return Object.fromEntries(tables.map(t=>{try{const source=sources[t.id],p=parsed(d.getTableProperties(t.section,t.paragraph,t.control));
  const valid=(v:any)=>sides.every(side=>Number.isSafeInteger(v['padding'+side])&&v['padding'+side]>=0&&v['padding'+side]<=32767);
  if(source?.editable!==true||!valid(p)||t.cells.some(c=>!valid(c.properties)||typeof c.properties.applyInnerMargin!=='boolean'||c.properties.textDirection!==0))throw new Error('unsupported');
  return [t.id,{editable:true,fingerprint:source.fingerprint,defaultsMm:{left:p.paddingLeft*25.4/7200,right:p.paddingRight*25.4/7200,top:p.paddingTop*25.4/7200,bottom:p.paddingBottom*25.4/7200}}];
 }catch{return [t.id,{editable:false,reason:'셀 안 여백은 기본 여백을 읽을 수 있고 보호·병합·중첩·혼합 서식·필드·세로 글씨·복합 배치가 없는 본문 단순 표(200셀 이하)만 지원합니다.'}];}}));
}
function layoutEvidence(d:any,t:Table):unknown[] {
 const result:unknown[]=[];const count=d.pageCount();if(!Number.isSafeInteger(count)||count<1)throw new Error('셀 안 여백의 실제 배치를 확인하지 못했습니다.');
 for(let page=0;page<count;page++){
  const controls=parsed(d.getPageControlLayout(page)).controls,runs=parsed(d.getPageTextLayout(page)).runs;
  if(!Array.isArray(controls)||!Array.isArray(runs))throw new Error('셀 안 여백의 실제 셀/글줄 배치를 읽지 못했습니다.');
  for(const c of controls.filter((c:any)=>c.type==='table'&&c.secIdx===t.section&&c.paraIdx===t.paragraph&&c.controlIdx===t.control)){
   if(!Array.isArray(c.cells)||[c,...c.cells].some((v:any)=>!['x','y','w','h'].every(k=>Number.isFinite(v[k]))||v.w<=0||v.h<=0))throw new Error('셀 안 여백의 실제 사각형 배치를 읽지 못했습니다.');
   result.push({page,x:c.x,y:c.y,w:c.w,h:c.h,cells:c.cells.map((v:any)=>({index:v.cellIdx,row:v.row,column:v.col,x:v.x,y:v.y,w:v.w,h:v.h}))});
  }
  for(const r of runs.filter((r:any)=>r.secIdx===t.section&&r.parentParaIdx===t.paragraph&&r.controlIdx===t.control)){if(!['x','y','w','h'].every(k=>Number.isFinite(r[k]))||r.h<=0||r.w<0)throw new Error('셀 안 여백의 실제 글줄 배치를 읽지 못했습니다.');result.push({page,cell:r.cellIdx,paragraph:r.cellParaIdx,start:r.charStart,text:r.text,x:r.x,y:r.y,w:r.w,h:r.h});}
 }
 if(!result.length)throw new Error('셀 안 여백 대상의 실제 배치가 없습니다.');return result;
}
function sameLayout(a:any,b:any):boolean {
 if(typeof a==='number'&&typeof b==='number')return Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=0.2;
 if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>sameLayout(v,b[i]));
 if(a&&b&&typeof a==='object'&&typeof b==='object')return Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(k=>Object.hasOwn(b,k)&&sameLayout(a[k],b[k]));
 return a===b;
}
/** Only requested cell padding and inheritance flags may change. */
export function executeCellPadding(wasm:any,base:Snapshot,op:Extract<ControlOp,{kind:'format_table_cells'}>):void {
 const plan=cellPaddingPlan(op,base),d=nativeDocument(wasm),structure=readStructure(d),table=structure.tables.find(t=>t.id===op.target),cap=readCellPaddingSources(d,structure.tables,base.name)?.[op.target],source=base.cellPaddingSources?.[op.target];
 if(!table||!same(table,plan.table)||cap?.editable!==true||!same(cap,source))throw new Error('표 기본 여백·셀 내용·서식·배치가 바뀌었습니다. 최신 문서로 다시 요청하세요.');
 assertNativeTableWritable(d,table);
 if(['pageCount','getPageControlLayout','getPageTextLayout','exportHwpx'].some(k=>typeof d[k]!=='function'))throw new Error('셀 안 여백의 실제 배치와 저장 재열기를 확인할 수 없는 엔진입니다.');
 const before=capturePreservationEvidence(d);if(before.issues.length)throw new Error('셀 안 여백 보존 정보를 확인하지 못했습니다.');const expected=structuredClone(before.values) as any;
 for(const cell of plan.cells){const stored=expected.cells?.find((v:any)=>v.list.hostListId===0&&v.list.sectionIndex===table.section&&v.list.hostPara===table.paragraph&&v.list.controlIndex===table.control&&v.list.cellIndex===cell.index);if(!stored)throw new Error('안 여백 셀의 보존 정보가 없습니다.');Object.assign(stored.properties,plan.patch);
  if(Object.entries(plan.patch).some(([k,v])=>cell.properties[k]!==v)&&parsed(d.setCellProperties(table.section,table.paragraph,table.control,cell.index,JSON.stringify(plan.patch)))?.ok!==true)throw new Error('셀 안 여백 변경에 실패했습니다.');
 }
 const after=capturePreservationEvidence(d);if(after.issues.length||!same(after.values,expected))throw new Error('셀 안 여백 변경 뒤 내용·서식·테두리·크기·다른 셀·자원이 계획과 다릅니다.');
 let reopened:any;try{const live=layoutEvidence(d,table);reopened=new d.constructor(d.exportHwpx());if(!sameLayout(live,layoutEvidence(reopened,table)))throw new Error('셀 안 여백 변경 후 저장 재열기의 실제 셀/글줄 배치가 다릅니다. 적용하지 않습니다.');}finally{reopened?.free();}
}
