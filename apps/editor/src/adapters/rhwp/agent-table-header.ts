import type {Snapshot,Table,AgentTableHeaderSource,AgentTableHeaderOp} from '../../modules/document/public/index.ts';
import {validateAgentTableHeader} from '../../modules/document/public/engine-integration.ts';
import {nativeDocument,parsed,readStructure} from './structure.ts';
import {readAgentTablePaginationSources} from './agent-table-pagination.ts';
import {capturePreservationEvidence} from './preservation.ts';
const canonical=(v:any):any=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const same=(a:any,b:any)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const modes=['none','cell','row'] as const;
/** A new multi-row repeat must actually fit as a complete title block on each fragment. */
function verifyRepeatedTitleBlock(d:any,table:Table,count:number):void {
 const pages=d.pageCount();if(!Number.isSafeInteger(pages)||pages<1)throw new Error('제목 행 반복의 실제 쪽 배치를 확인하지 못했습니다.');
 let fragments=0;
 for(let p=0;p<pages;p++)for(const fragment of parsed(d.getPageControlLayout(p)).controls??[]){
  if(fragment.type!=='table'||fragment.secIdx!==table.section||fragment.paraIdx!==table.paragraph||fragment.controlIdx!==table.control)continue;
  fragments++;const cells=fragment.cells,info=parsed(d.getPageInfo(p));
  if(!Array.isArray(cells)||!Number.isFinite(info.height)||info.height<=0)throw new Error('제목 행 반복의 실제 셀 배치를 확인하지 못했습니다.');
  const titles=cells.filter((c:any)=>c.row<count),indices=new Set(titles.map((c:any)=>c.cellIdx));
  const visibleBody=cells.some((c:any)=>c.row>=count&&Number.isFinite(c.y)&&Number.isFinite(c.h)&&c.h>0&&c.y<info.height&&c.y+c.h>0);
  if(indices.size!==count*table.columns||!visibleBody||titles.some((c:any)=>!Number.isFinite(c.y)||!Number.isFinite(c.h)||c.h<=0||c.y<0||c.y+c.h>info.height+0.2))throw new Error('여러 제목 행 전체와 본문 셀이 각 표 조각에 함께 들어가지 않습니다. 제목 행 수나 높이를 줄이세요.');
 }
 if(!fragments)throw new Error('제목 행 반복의 실제 표 조각을 확인하지 못했습니다.');
}
export function readAgentTableHeaderSources(wasm:any,tables:Table[]):Record<string,AgentTableHeaderSource>|undefined {
 const d=nativeDocument(wasm);if(typeof d.setCellProperties!=='function')return;
 const sources=readAgentTablePaginationSources(d,tables);if(!sources)return;
 return Object.fromEntries(tables.map(t=>{const source=sources[t.id];return [t.id,source?.editable===true&&Number.isInteger(t.headerRows)&&(t.headerRows as number)>=0&&(t.headerRows as number)<=t.rows&&typeof t.pagination?.repeatHeader==='boolean'?{...source,headerRows:t.headerRows!,repeatHeader:t.pagination.repeatHeader}:{editable:false,reason:source?.reason??'부분 셀/흩어진 제목 행이 있는 복합 원본은 유지합니다. 맨 위의 연속된 전체 행만 편집합니다.'}];}));
}
/** One atomic header/pagination transaction shared by manual UI and the Agent. */
export function executeAgentTableHeader(wasm:any,base:Snapshot,op:AgentTableHeaderOp):void {
 const planned=validateAgentTableHeader(op,base),d=nativeDocument(wasm),structure=readStructure(d),table=structure.tables.find(t=>t.id===op.target),cap=readAgentTableHeaderSources(d,structure.tables)?.[op.target],original=base.tableHeaderSources?.[op.target];
 if(!table||!same(table,planned)||cap?.editable!==true||cap.fingerprint!==original?.fingerprint||cap.mode!==original?.mode||cap.headerRows!==original?.headerRows||cap.repeatHeader!==original?.repeatHeader)throw new Error('표 제목 행·쪽 나눔·내용·서식이 바뀌었습니다. 최신 문서로 다시 요청하세요.');
 if(cap.mode===op.paginationMode&&cap.headerRows===op.headerRows&&cap.repeatHeader===op.repeatHeader)throw new Error('현재 제목 행·반복·쪽 나눔 설정과 같습니다.');
 if(op.repeatHeader&&op.headerRows>1&&['pageCount','getPageControlLayout','getPageInfo'].some(key=>typeof d[key]!=='function'))throw new Error('여러 제목 행의 실제 반복 배치를 검사할 수 없는 엔진입니다.');
 const before=capturePreservationEvidence(d);if(before.issues.length)throw new Error('전체 문서 보존 정보를 확인하지 못했습니다.');const expected=structuredClone(before.values) as any;
 const flat=Array.from({length:table.section},(_,i)=>d.getParagraphCount(i)).reduce((a:number,b:number)=>a+b,0)+table.paragraph;
 const object=expected.objects?.find((v:any)=>v.object.kind==='table'&&v.object.para===flat&&v.object.controlIndex===table.control);if(!object?.properties)throw new Error('표 저장 보존 정보가 없습니다.');Object.assign(object.properties,{pageBreak:modes.indexOf(op.paginationMode),repeatHeader:op.repeatHeader});
 for(const cell of table.cells){const value=cell.row<op.headerRows;const stored=expected.cells?.find((v:any)=>v.list.hostListId===0&&v.list.sectionIndex===table.section&&v.list.hostPara===table.paragraph&&v.list.controlIndex===table.control&&v.list.cellIndex===cell.index);if(!stored)throw new Error('제목 셀의 보존 정보가 없습니다.');stored.properties.isHeader=value;
  if(cell.properties.isHeader!==value&&parsed(d.setCellProperties(table.section,table.paragraph,table.control,cell.index,JSON.stringify({isHeader:value})))?.ok!==true)throw new Error('제목 행 셀 표시 변경에 실패했습니다.');
 }
 if(parsed(d.setTableProperties(table.section,table.paragraph,table.control,JSON.stringify({pageBreak:modes.indexOf(op.paginationMode),repeatHeader:op.repeatHeader})))?.ok!==true)throw new Error('제목 행 반복/쪽 나눔 설정에 실패했습니다.');
 if(op.repeatHeader&&op.headerRows>1)verifyRepeatedTitleBlock(d,table,op.headerRows);
 const after=capturePreservationEvidence(d);if(after.issues.length||!same(after.values,expected))throw new Error('제목 행 설정 뒤 셀 내용·서식·배치·본문·자원이 계획과 다릅니다.');
}
