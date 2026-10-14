import {topologySemantics as semantic,rootBodyTexts as body,tableTextTree as texts} from './table-topology-evidence.ts';
import type {Snapshot,Table,AgentTableMergeOp,AgentTableMergeSource} from '../../modules/document/public/index.ts';
import {tableMergePlan} from '../../modules/document/public/engine-integration.ts';
import {nativeDocument,parsed,readStructure} from './structure.ts';
import {readEqualColumnSources} from './equal-columns.ts';
import {capturePreservationEvidence} from './preservation.ts';
import {assertNativeTableWritable} from './table-write-guard.ts';
import {tableLayoutEvidence,sameTableLayout} from './table-layout-evidence.ts';
const canonical=(v:any):any=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const same=(a:any,b:any)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
export function readTableMergeSources(wasm:any,tables:Table[],name:string):Record<string,AgentTableMergeSource>|undefined {
 const d=nativeDocument(wasm),sources=readEqualColumnSources(d,tables,name);if(!sources)return;
 let simple=false;try{simple=parsed(d.getFieldList()).length===0&&parsed(d.getBookmarks()).length===0&&parsed(d.getControls()).every((c:any)=>c.list===0&&['tbl','secd','cold'].includes(c.ctrlId))&&parsed(d.getCursorModel()).lists.every((l:any)=>l.isCell&&l.hostListId===0);}catch{}
 return Object.fromEntries(tables.map(t=>{let onePage=false;try{const frames=Array.from({length:d.pageCount()},(_,i)=>parsed(d.getPageControlLayout(i)).controls.filter((c:any)=>c.type==='table'&&c.secIdx===t.section&&c.paraIdx===t.paragraph&&c.controlIdx===t.control)).flat();onePage=frames.length===1&&frames[0].cells?.length===t.cells.length&&parsed(d.getTableProperties(t.section,t.paragraph,t.control)).cellSpacing===0;}catch{}return [t.id,simple&&onePage&&sources[t.id]?.editable===true&&sources[t.id].directWidth?{editable:true,fingerprint:sources[t.id].fingerprint}:{editable:false,reason:'AI 셀 병합은 HWPX 한 쪽 평면 본문 표만 지원합니다. 필드·책갈피·머리말/개체·중첩·보호·혼합 원본은 제외합니다.'}];}));
}
function resultCells(base:Snapshot,op:AgentTableMergeOp){const plan=tableMergePlan(op,base),{table:t,selected}=plan,first=selected[0],removed=new Set(selected.slice(1).map(c=>c.index));
 const text=[first.text,...selected.slice(1).filter(c=>c.text.length>0).map(c=>c.text)].join('\n');
 return t.cells.filter(c=>!removed.has(c.index)).map((c,index)=>c.index===first.index?{...c,index,rowSpan:op.rowCount,columnSpan:op.columnCount,text,properties:{...c.properties,width:plan.width,height:plan.height}}:{...c,index});
}
export function assertTableMergeResult(wasm:any,base:Snapshot,op:AgentTableMergeOp):void {
 const d=nativeDocument(wasm),t=tableMergePlan(op,base).table,actual=readStructure(d).tables.find(v=>v.id===t.id),expected=resultCells(base,op);
 if(!actual||actual.rows!==t.rows||actual.columns!==t.columns||actual.cells.length!==expected.length||actual.cells.some((c,i)=>!same({index:c.index,row:c.row,column:c.column,rowSpan:c.rowSpan,columnSpan:c.columnSpan,text:c.text,properties:c.properties},{index:expected[i].index,row:expected[i].row,column:expected[i].column,rowSpan:expected[i].rowSpan,columnSpan:expected[i].columnSpan,text:expected[i].text,properties:expected[i].properties})))throw new Error('병합 결과의 위치·내용·셀 속성이 계획과 다릅니다.');
 let reopened:any;try{reopened=new d.constructor(d.exportHwpx());if(!sameTableLayout(tableLayoutEvidence(d,actual),tableLayoutEvidence(reopened,actual)))throw new Error('병합 후 저장 재열기의 실제 셀/글줄 배치가 다릅니다. 적용하지 않습니다.');}finally{reopened?.free();}
}
/** List IDs are ephemeral slots. All addresses, topology and paragraph/run semantics remain exact.
 * The linear text export changes order when cells become paragraphs; all body and cell text is
 * instead compared by the explicitly planned tree. This is command-local, not a save-guard change. */
export function executeTableMerge(wasm:any,base:Snapshot,op:AgentTableMergeOp):{sectionIndex:number;parentParaIndex:number;paragraphIndex:number;charOffset:number;controlIndex:number;cellIndex:number;cellParaIndex:number;cellPath:any[]} {
 const d=nativeDocument(wasm),plan=tableMergePlan(op,base),t=plan.table,structure=readStructure(d),source=readTableMergeSources(d,structure.tables,base.name)?.[op.target];
 if(!same(structure.tables.find(v=>v.id===t.id),t)||source?.editable!==true||!same(source,base.tableMergeSources?.[t.id]))throw new Error('표 내용·서식·배치가 바뀌었습니다. 최신 문서로 다시 요청하세요.');assertNativeTableWritable(d,t);
 const before=capturePreservationEvidence(d);if(before.issues.length)throw new Error('병합 전 전체 보존 정보를 읽지 못했습니다.');const expected=semantic(before.values),beforeBody=body(d),isTarget=(c:any)=>c.list.hostListId===0&&c.list.sectionIndex===t.section&&c.list.hostPara===t.paragraph&&c.list.controlIndex===t.control;
 const originals=expected.cells.filter(isTarget),first=originals.find((c:any)=>c.list.cellIndex===plan.selected[0].index),selected=new Set(plan.selected.map(c=>c.index)),removed=new Set(plan.selected.slice(1).map(c=>c.index));if(!first||originals.length!==t.cells.length)throw new Error('병합 셀 보존 정보가 없습니다.');
 for(const c of plan.selected.slice(1))if(c.text.length)first.paragraphs.push(...originals.find((v:any)=>v.list.cellIndex===c.index).paragraphs);
 const remaining=originals.filter((c:any)=>!removed.has(c.list.cellIndex));remaining.forEach((c:any,index:number)=>{const primary=selected.has(c.list.cellIndex);Object.assign(c.list,{cellIndex:index,cellCount:remaining.length});if(primary){Object.assign(c.list,{rowSpan:op.rowCount,colSpan:op.columnCount,paraCount:first.paragraphs.length});Object.assign(c.properties,{width:plan.width,height:plan.height});}});
 const raw=semantic(before.values).cells,at=raw.findIndex(isTarget);expected.cells=[...raw.slice(0,at),...remaining,...raw.slice(at+originals.length)];
 if(parsed(d.mergeTableCells(t.section,t.paragraph,t.control,op.startRow,op.startColumn,op.startRow+op.rowCount-1,op.startColumn+op.columnCount-1))?.ok!==true)throw new Error('표 셀 병합에 실패했습니다.');
 const expectedText=texts(structure.tables.map(table=>table.id===t.id?{...table,cells:resultCells(base,op)}:table));
 const after=capturePreservationEvidence(d);if(after.issues.length||!same(semantic(after.values),expected)||!same(body(d),beforeBody)||!same(texts(readStructure(d).tables),expectedText))throw new Error('병합 뒤 문단 서식·글자 run·이웃 셀·자원 보존이 계획과 다릅니다.');
 assertTableMergeResult(d,base,op);const cell=resultCells(base,op).find(c=>c.row===op.startRow&&c.column===op.startColumn)!;
 return {sectionIndex:t.section,parentParaIndex:t.paragraph,paragraphIndex:0,charOffset:0,controlIndex:t.control,cellIndex:cell.index,cellParaIndex:0,cellPath:[{controlIndex:t.control,cellIndex:cell.index,cellParaIndex:0}]};
}
