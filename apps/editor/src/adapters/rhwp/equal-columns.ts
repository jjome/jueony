import type {ControlOp,Snapshot,Table,AgentEqualColumnSource} from '../../modules/document/public/index.ts';
import {equalColumnsPlan} from '../../modules/document/public/engine-integration.ts';
import {readCellPaddingSources} from './cell-padding.ts';
import {nativeDocument,parsed,readStructure} from './structure.ts';
import {assertNativeTableWritable} from './table-write-guard.ts';
import {capturePreservationEvidence} from './preservation.ts';
import {tableLayoutEvidence,sameTableLayout} from './table-layout-evidence.ts';
const canonical=(v:any):any=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const same=(a:any,b:any)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
/** The fingerprint includes native placement, defaults and every cell. Width
 * bands additionally require a consistent stored grid and matching table total. */
export function readEqualColumnSources(wasm:any,tables:Table[],name:string):Record<string,AgentEqualColumnSource>|undefined {
 const d=nativeDocument(wasm),sources=readCellPaddingSources(d,tables,name);if(!sources)return;
 return Object.fromEntries(tables.map(t=>{try{const source=sources[t.id];if(source?.editable!==true||typeof d.resizeTableCells!=='function'||t.columns<2)throw new Error('unsupported');
  const widths=Array.from({length:t.columns},(_,column)=>Number(t.cells.find(c=>c.row===0&&c.column===column)?.properties.width));
  const total=widths.reduce((a,b)=>a+b,0),p=parsed(d.getTableProperties(t.section,t.paragraph,t.control));
  if(widths.some(w=>!Number.isSafeInteger(w)||w<200)||total>0x7fffffff||p.tableWidth!==total||t.cells.some(c=>c.properties.width!==widths[c.column]))throw new Error('unsupported');
  return [t.id,source];
 }catch{return [t.id,{editable:false,reason:'AI 너비 같게는 HWPX의 보호·병합·중첩·혼합 서식·필드·복합 배치가 없고 행마다 열 너비가 일치하는 본문 단순 표(200셀 이하)만 지원합니다.'}];}}));
}
export function executeEqualColumns(wasm:any,base:Snapshot,op:Extract<ControlOp,{kind:'format_table_cells'}>):void {
 const plan=equalColumnsPlan(op,base),d=nativeDocument(wasm),structure=readStructure(d),table=structure.tables.find(t=>t.id===op.target),source=readEqualColumnSources(d,structure.tables,base.name)?.[op.target];
 if(!table||!same(table,plan.table)||source?.editable!==true||!same(source,base.equalColumnSources?.[op.target]))throw new Error('표 너비·셀 내용·서식·배치가 바뀌었습니다. 최신 문서로 다시 요청하세요.');
 assertNativeTableWritable(d,table);
 if(['pageCount','getPageControlLayout','getPageTextLayout','exportHwpx'].some(k=>typeof d[k]!=='function'))throw new Error('열 너비의 실제 배치와 저장 재열기를 확인할 수 없는 엔진입니다.');
 const before=capturePreservationEvidence(d);if(before.issues.length)throw new Error('열 너비 변경의 보존 정보를 확인하지 못했습니다.');const expected=structuredClone(before.values) as any;
 for(const update of plan.updates){const cell=expected.cells?.find((v:any)=>v.list.hostListId===0&&v.list.sectionIndex===table.section&&v.list.hostPara===table.paragraph&&v.list.controlIndex===table.control&&v.list.cellIndex===update.cellIdx);if(!cell)throw new Error('열 너비 변경 셀의 보존 정보가 없습니다.');cell.properties.width+=update.widthDelta;}
 if(parsed(d.resizeTableCells(table.section,table.paragraph,table.control,JSON.stringify(plan.updates)))?.ok!==true)throw new Error('열 너비 균등 분배에 실패했습니다.');
 const after=capturePreservationEvidence(d);if(after.issues.length||!same(after.values,expected))throw new Error('균등 분배 뒤 내용·서식·테두리·높이·다른 열·자원이 계획과 다릅니다.');
 let reopened:any;try{const live=tableLayoutEvidence(d,table);reopened=new d.constructor(d.exportHwpx());if(!sameTableLayout(live,tableLayoutEvidence(reopened,table)))throw new Error('균등 분배 후 저장 재열기의 실제 셀/글줄 배치가 다릅니다. 적용하지 않습니다.');}finally{reopened?.free();}
}
