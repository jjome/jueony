import {sha256} from '@noble/hashes/sha2.js';
import type {Snapshot,Table,AgentTablePaginationSource,AgentTablePaginationOp} from '../../modules/document/public/index.ts';
import {validateAgentTablePagination} from '../../modules/document/public/engine-integration.ts';
import {nativeDocument,parsed,readStructure} from './structure.ts';
import {capturePreservationEvidence} from './preservation.ts';
const canonical=(v:any):any=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const same=(a:any,b:any)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const hash=(v:any)=>Array.from(sha256(new TextEncoder().encode(JSON.stringify(canonical(v)))),n=>n.toString(16).padStart(2,'0')).join('');
const modes=['none','cell','row'] as const;
export function readAgentTablePaginationSources(wasm:any,tables:Table[]):Record<string,AgentTablePaginationSource>|undefined {
 const d=nativeDocument(wasm);if(typeof d.setTableProperties!=='function'||typeof d.getTableProperties!=='function'||typeof d.getFieldList!=='function')return;
 try{const fieldFree=parsed(d.getFieldList()).length===0,controls=parsed(d.getControls()),lists=parsed(d.getCursorModel()).lists;
 return Object.fromEntries(tables.map(t=>{try{const p=parsed(d.getTableProperties(t.section,t.paragraph,t.control)),flat=Array.from({length:t.section},(_,i)=>d.getParagraphCount(i)).reduce((a:number,b:number)=>a+b,0)+t.paragraph,c=controls.find((c:any)=>c.list===0&&c.para===flat&&c.controlIndex===t.control&&c.ctrlId==='tbl');
 // Legacy control TextWrap bits can be stale after setters; use the same resolved value as serializer/preservation.
 const mode=modes[p.pageBreak],simple=t.rows>0&&t.columns>0&&t.rows*t.columns<=200&&t.cells.length===t.rows*t.columns&&t.cells.every(v=>v.editable&&v.rowSpan===1&&v.columnSpan===1&&v.properties.cellProtect===false&&Number.isInteger(v.row)&&v.row>=0&&v.row<t.rows&&Number.isInteger(v.column)&&v.column>=0&&v.column<t.columns)&&new Set(t.cells.map(v=>v.row+':'+v.column)).size===t.cells.length;
 const editable=fieldFree&&c&&c.props?.Lock===0&&simple&&mode!==undefined&&!p.treatAsChar&&!p.hasCaption&&p.textWrap==='TopAndBottom'&&!p.allowOverlap&&lists.filter((v:any)=>v.isCell&&v.sectionIndex===t.section&&v.hostPara===t.paragraph&&v.controlIndex===t.control&&v.hostListId===0).length===t.cells.length;
 return [t.id,editable?{editable:true,mode,fingerprint:hash({table:t,properties:p,control:{...c,props:{...c.props,TextWrap:p.textWrap}}})}:{editable:false,reason:'필드·보호/병합/중첩·혼합 서식·캡션·글자 취급/겹침을 제외한 본문 단순 표(200셀 이하)만 쪽 나눔을 변경합니다.'}];}catch{return [t.id,{editable:false,reason:'표 쪽 나눔 검증 정보를 읽지 못했습니다.'}];}}));
 }catch{return;}
}
export function executeAgentTablePagination(wasm:any,base:Snapshot,op:AgentTablePaginationOp):void {
 const planned=validateAgentTablePagination(op,base),d=nativeDocument(wasm),structure=readStructure(d),table=structure.tables.find(t=>t.id===op.target),cap=readAgentTablePaginationSources(d,structure.tables)?.[op.target];
 if(!table||!same(table,planned)||cap?.editable!==true||cap.fingerprint!==base.tablePaginationSources?.[op.target]?.fingerprint||cap.mode!==base.tablePaginationSources?.[op.target]?.mode)throw new Error('표의 쪽 나눔·내용·서식·배치가 바뀌었습니다. 최신 문서로 다시 요청하세요.');
 if(cap.mode===op.mode)throw new Error('현재 표 쪽 나눔 설정과 같습니다.');
 const before=capturePreservationEvidence(d);if(before.issues.length)throw new Error('전체 문서 보존 정보를 확인하지 못했습니다.');const expected=structuredClone(before.values) as any;
 const flat=Array.from({length:table.section},(_,i)=>d.getParagraphCount(i)).reduce((a:number,b:number)=>a+b,0)+table.paragraph;
 const object=expected.objects?.find((v:any)=>v.object.kind==='table'&&v.object.para===flat&&v.object.controlIndex===table.control);if(!object?.properties)throw new Error('표의 저장 보존 정보가 없습니다.');object.properties.pageBreak=modes.indexOf(op.mode);
 if(parsed(d.setTableProperties(table.section,table.paragraph,table.control,JSON.stringify({pageBreak:modes.indexOf(op.mode)})))?.ok!==true)throw new Error('표 쪽 나눔 변경에 실패했습니다.');
 const after=capturePreservationEvidence(d);if(after.issues.length||!same(after.values,expected))throw new Error('표 쪽 나눔 변경 뒤 셀·본문·서식·배치·공유 자원이 계획과 다릅니다.');
}
