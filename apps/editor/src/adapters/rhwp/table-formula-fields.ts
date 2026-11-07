import type {AgentTableFormulaFields,TableCellPathStep} from '../../modules/document/public/types.ts';
import {nativeDocument,parsed} from './structure.ts';

const index=(v:unknown):v is number=>typeof v==='number' && Number.isSafeInteger(v) && v>=0;

/** Reads stored field commands from the open IR. Numeric cell text and strings
 * beginning with "=" are not evidence that the author created a FORMULA field. */
export function readTableFormulaFields(wasm:any,allowEdits=false,hasPlainCells=false):AgentTableFormulaFields|undefined {
 const d=nativeDocument(wasm);
 if (typeof d.getFieldList!=='function') return undefined;
 const fields:AgentTableFormulaFields['fields']=[];
 let unresolved=0,characters=0,canRefreshDependents=false;
 try {
  for (const field of parsed(d.getFieldList())) {
   if (field.fieldType!=='formula' || !field.location?.path?.some((p:any)=>p.type==='cell')) continue;
   const {sectionIndex:section,paraIndex:paragraph,path:stored}=field.location;
   if (!index(section)||!index(paragraph)||!index(field.fieldId)||field.cellField!==false||
       !Array.isArray(stored)||stored.length>8||!stored.every((p:any)=>p.type==='cell'&&[p.controlIndex,p.cellIndex,p.paraIndex].every(index))||
       typeof field.command!=='string'||typeof field.value!=='string'||field.command.length>8192||field.value.length>4000||
       fields.length>=200||characters+field.command.length+field.value.length>80000) {unresolved++;continue;}
   const path:TableCellPathStep[]=stored.map((p:any)=>({controlIndex:p.controlIndex,cellIndex:p.cellIndex,cellParaIndex:p.paraIndex}));
   try {
    const encoded=JSON.stringify(path),info=parsed(d.getCellInfoByPath(section,paragraph,encoded));
    const {startCharIdx:start,endCharIdx:end}=field;
    if (![info.row,info.col,start,end].every(index)||end<start||end>d.getCellParagraphLengthByPath(section,paragraph,encoded)||
        d.getTextInCellByPath(section,paragraph,encoded,start,end-start)!==field.value) {unresolved++;continue;}
    const parents=path.slice(0,-1),last=path.at(-1)!;
    const tableId='s'+section+'p'+paragraph+parents.map(p=>'t'+p.controlIndex+'c'+p.cellIndex+'p'+p.cellParaIndex).join('')+'t'+last.controlIndex;
    const parts=/^(=[^\r\n]+)\?\?(%(?:g|\.[012]f),?);;([^\r\n]*)$/u.exec(field.command);
    let editable=false;
    if (allowEdits && path.length===1 && parts && typeof d.previewTableFormulaField==='function' && typeof d.updateTableFormulaField==='function') {
     try {
      const probe=parsed(d.previewTableFormulaField(section,paragraph,last.controlIndex,last.cellIndex,field.fieldId,field.command,parts[1],parts[2]));
      editable=probe?.ok===true && probe.fieldId===field.fieldId && probe.formula===parts[1];
      if(editable && Array.isArray(probe.dependentChanges))canRefreshDependents=true;
     } catch { /* Unsupported protection, formula grammar or dependency graph. */ }
    }
    fields.push({tableId,section,paragraph,path,row:info.row,column:info.col,fieldId:field.fieldId,start,end,storedCommand:field.command,displayedValue:field.value,editable,
      ...(parts?{expression:parts[1],resultFormat:parts[2]}:{})});
    characters+=field.command.length+field.value.length;
   } catch {unresolved++;}
  }
  const canInsert=allowEdits && hasPlainCells && unresolved===0 && fields.length<200 && typeof d.insertTableFormulaField==='function';
  if (!fields.length&&!unresolved&&!canInsert) return undefined;
  const canEdit=fields.some(f=>f.editable);
  return {fields,unresolved,canEdit,canRefreshDependents,...(canInsert?{canInsert}:{}),canFill:canEdit && typeof d.insertTableFormulaField==='function'};
 } catch {
  return {fields:[],unresolved:null,canEdit:false,canRefreshDependents:false};
 }
}
