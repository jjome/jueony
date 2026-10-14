import type {Table} from '../../modules/document/public/index.ts';
import {capturePreservationEvidence} from './preservation.ts';
import {nativeDocument,parsed} from './structure.ts';
/** Recheck Native flags, independent of detached/legacy/model-visible editable values. */
export function assertNativeTableWritable(wasm:any,table:Table,cells?:number[]):void {
 const d=nativeDocument(wasm),flat=table.paragraph+Array.from({length:table.section},(_,i)=>d.getParagraphCount(i)).reduce((a:number,b:number)=>a+b,0);
 const controls=parsed(d.getControls());if(!Array.isArray(controls))throw new Error('표 보호 상태를 확인하지 못했습니다.');
 const control=controls.find((c:any)=>c.ctrlId==='tbl'&&c.list===0&&c.para===flat&&c.controlIndex===table.control);
 if(control?.props?.Lock!==0)throw new Error('보호 표 또는 보호 상태를 확인할 수 없는 표는 AI로 편집하지 않습니다.');
 const dims=parsed(d.getTableDimensions(table.section,table.paragraph,table.control));if(!Number.isSafeInteger(dims.cellCount)||dims.cellCount<1||dims.cellCount>1000||(cells!==undefined&&!cells.length))throw new Error('표 셀 범위를 확인하지 못했습니다.');
 for(const index of new Set(cells??Array.from({length:dims.cellCount},(_,i)=>i))){
  if(!Number.isInteger(index)||index<0||index>=dims.cellCount)throw new Error('표 셀 위치가 바뀌었습니다.');
  const value=parsed(d.getCellProperties(table.section,table.paragraph,table.control,index));if(value?.cellProtect!==false)throw new Error('보호 셀 또는 보호 상태를 확인할 수 없는 셀은 AI로 편집하지 않습니다.');
 }
}

/** Preserve protected neighbours too: border normalization can touch adjacent cells. */
export function protectedTableEvidence(wasm:any,table:Table):unknown[] {
 const d=nativeDocument(wasm),protectedIndices:number[]=[];
 const dims=parsed(d.getTableDimensions(table.section,table.paragraph,table.control));if(!Number.isSafeInteger(dims.cellCount)||dims.cellCount<1||dims.cellCount>1000)throw new Error('표 셀 범위를 확인하지 못했습니다.');
 for(let i=0;i<dims.cellCount;i++){const p=parsed(d.getCellProperties(table.section,table.paragraph,table.control,i));if(typeof p.cellProtect!=='boolean')throw new Error('표 셀 보호 상태를 확인하지 못했습니다.');if(p.cellProtect)protectedIndices.push(i);}
 if(!protectedIndices.length)return [];
 const evidence=capturePreservationEvidence(d);if(evidence.issues.length)throw new Error('보호 셀의 보존 정보를 확인하지 못했습니다.');
 return protectedIndices.map(index=>{const cell=(evidence.values.cells as any[]).find(v=>v.list.hostListId===0&&v.list.sectionIndex===table.section&&v.list.hostPara===table.paragraph&&v.list.controlIndex===table.control&&v.list.cellIndex===index);if(!cell)throw new Error('보호 셀 위치를 확인하지 못했습니다.');const text=Array.from({length:d.getCellParagraphCount(table.section,table.paragraph,table.control,index)},(_,p)=>d.getTextInCell(table.section,table.paragraph,table.control,index,p,0,d.getCellParagraphLength(table.section,table.paragraph,table.control,index,p)));return {index,text,cell};});
}
export function assertProtectedTableUnchanged(wasm:any,table:Table,before:unknown[]):void {
 if(JSON.stringify(protectedTableEvidence(wasm,table))!==JSON.stringify(before))throw new Error('편집 중 선택하지 않은 보호 셀의 내용·서식·보호 표시가 바뀌었습니다. 적용하지 않습니다.');
}
