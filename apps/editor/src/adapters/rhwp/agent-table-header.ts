import type {Snapshot,Table,AgentTableHeaderSource,AgentTableHeaderOp} from '../../modules/document/public/index.ts';
import {validateAgentTableHeader} from '../../modules/document/public/engine-integration.ts';
import {nativeDocument,parsed,readStructure} from './structure.ts';
import {readAgentTablePaginationSources} from './agent-table-pagination.ts';
import {capturePreservationEvidence} from './preservation.ts';
const canonical=(v:any):any=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const same=(a:any,b:any)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const modes=['none','cell','row'] as const;
export function readAgentTableHeaderSources(wasm:any,tables:Table[]):Record<string,AgentTableHeaderSource>|undefined {
 const d=nativeDocument(wasm);if(typeof d.setCellProperties!=='function')return;
 const sources=readAgentTablePaginationSources(d,tables);if(!sources)return;
 return Object.fromEntries(tables.map(t=>{const source=sources[t.id];return [t.id,source?.editable===true&&(t.headerRows===0||t.headerRows===1)&&typeof t.pagination?.repeatHeader==='boolean'?{...source,headerRows:t.headerRows,repeatHeader:t.pagination.repeatHeader}:{editable:false,reason:source?.reason??'복합/여러 제목 행이 있는 원본은 유지합니다. 첫 행 전체 또는 제목 행 없음만 편집합니다.'}];}));
}
/** One atomic header/pagination transaction shared by manual UI and the Agent. */
export function executeAgentTableHeader(wasm:any,base:Snapshot,op:AgentTableHeaderOp):void {
 const planned=validateAgentTableHeader(op,base),d=nativeDocument(wasm),structure=readStructure(d),table=structure.tables.find(t=>t.id===op.target),cap=readAgentTableHeaderSources(d,structure.tables)?.[op.target],original=base.tableHeaderSources?.[op.target];
 if(!table||!same(table,planned)||cap?.editable!==true||cap.fingerprint!==original?.fingerprint||cap.mode!==original?.mode||cap.headerRows!==original?.headerRows||cap.repeatHeader!==original?.repeatHeader)throw new Error('표 제목 행·쪽 나눔·내용·서식이 바뀌었습니다. 최신 문서로 다시 요청하세요.');
 if(cap.mode===op.paginationMode&&cap.headerRows===op.headerRows&&cap.repeatHeader===op.repeatHeader)throw new Error('현재 제목 행·반복·쪽 나눔 설정과 같습니다.');
 const before=capturePreservationEvidence(d);if(before.issues.length)throw new Error('전체 문서 보존 정보를 확인하지 못했습니다.');const expected=structuredClone(before.values) as any;
 const flat=Array.from({length:table.section},(_,i)=>d.getParagraphCount(i)).reduce((a:number,b:number)=>a+b,0)+table.paragraph;
 const object=expected.objects?.find((v:any)=>v.object.kind==='table'&&v.object.para===flat&&v.object.controlIndex===table.control);if(!object?.properties)throw new Error('표 저장 보존 정보가 없습니다.');Object.assign(object.properties,{pageBreak:modes.indexOf(op.paginationMode),repeatHeader:op.repeatHeader});
 for(const cell of table.cells){const value=op.headerRows===1&&cell.row===0;const stored=expected.cells?.find((v:any)=>v.list.hostListId===0&&v.list.sectionIndex===table.section&&v.list.hostPara===table.paragraph&&v.list.controlIndex===table.control&&v.list.cellIndex===cell.index);if(!stored)throw new Error('제목 셀의 보존 정보가 없습니다.');stored.properties.isHeader=value;
  if(cell.properties.isHeader!==value&&parsed(d.setCellProperties(table.section,table.paragraph,table.control,cell.index,JSON.stringify({isHeader:value})))?.ok!==true)throw new Error('제목 행 셀 표시 변경에 실패했습니다.');
 }
 if(parsed(d.setTableProperties(table.section,table.paragraph,table.control,JSON.stringify({pageBreak:modes.indexOf(op.paginationMode),repeatHeader:op.repeatHeader})))?.ok!==true)throw new Error('제목 행 반복/쪽 나눔 설정에 실패했습니다.');
 const after=capturePreservationEvidence(d);if(after.issues.length||!same(after.values,expected))throw new Error('제목 행 설정 뒤 셀 내용·서식·배치·본문·자원이 계획과 다릅니다.');
}
