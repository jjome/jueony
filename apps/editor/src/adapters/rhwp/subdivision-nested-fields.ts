import type {Table} from '../../modules/document/public/index.ts';
import type {NestedSubdivisionOwner} from './subdivision-nested-owner.ts';
import {readNestedCellFields} from './nested-cell-fields.ts';
import {parsed} from './structure.ts';

const invalid=()=>Error('분할할 안쪽 셀의 채워진 누름틀 ID·값·범위·소유 경로를 확인하지 못했습니다.');

/** Retain fields only in actual leaf cells of the independently resolved tree.
 * All document fields and non-table markers must be accounted for; no unrelated
 * field is hidden from the root-table guards. Original list slots stay in place. */
export function subdivisionNestedFields(doc:any,table:Table,owner:NestedSubdivisionOwner,
    lists=parsed(doc.getCursorModel()).lists,controls=parsed(doc.getControls())){
  const fields=parsed(doc.getFieldList()),markers=controls.filter((c:any)=>c.list!==0 && c.ctrlId!=='tbl');
  if(!Array.isArray(fields))throw invalid();
  if(!fields.length){if(markers.length)throw invalid();return [];}
  if(fields.some((f:any)=>f.cellField!==false || f.fieldType!=='clickhere' || f.editableInForm!==true ||
      typeof f.value!=='string' || !f.value || !owner.descendantLists.includes(f.listId) ||
      owner.controlLists.includes(f.listId)))throw invalid();
  const records=readNestedCellFields(doc,lists,fields,controls);
  const result=[...records].map(([listId,record])=>{
    const list=lists.find((l:any)=>l.listId===listId),owned=fields.filter((f:any)=>f.listId===listId);
    const parent=list && owner.tables.find(t=>t.listId===list.hostListId && t.paragraph===list.hostPara);
    if(!parent || record.name!==undefined || record.inlineIds.length!==owned.length ||
        !owned.length || !owner.descendantLists.includes(listId) || owner.controlLists.includes(listId))throw invalid();
    const path=[...parent.path,{controlIndex:list.controlIndex,cellIndex:list.cellIndex,cellParaIndex:0}];
    const properties=parsed(doc.getCellPropertiesByPath(table.section,table.paragraph,JSON.stringify(path),list.cellIndex));
    if(properties.cellProtect!==false || properties.fieldName!=='' || properties.isHeader!==false || properties.textDirection!==0)throw invalid();
    const data=record.data as {fields:any[];controls:any[]};
    if(data.fields.some(f=>f.info?.isGuide!==false))throw invalid();
    for(const paragraph of new Set(owned.map((f:any)=>f.paraInList))){
      const group=owned.filter((f:any)=>f.paraInList===paragraph).sort((a:any,b:any)=>a.startCharIdx-b.startCharIdx);
      const encoded=JSON.stringify([...path.slice(0,-1),{...path.at(-1)!,cellParaIndex:paragraph}]);
      const text=doc.getTextInCellByPath(table.section,table.paragraph,encoded,0,
        doc.getCellParagraphLengthByPath(table.section,table.paragraph,encoded));
      for(const [index,field] of group.entries()){
        const slots=data.controls.filter(c=>c.para===paragraph && c.pos===field.startCharIdx);
        // startPos/endPos are logical scalar/control-slot positions, not HWP
        // UTF-16 byte offsets. field_query::field_content_start counts seven
        // extra units per preceding tab and two 8-unit markers per prior field.
        const tabs=Array.from(text as string).slice(0,field.startCharIdx).filter(c=>c==='\t').length;
        const rawStart=field.startCharIdx+7*tabs+16*index+8;
        if(slots.length!==1 || field.startPos!==rawStart || field.endCharIdx<=field.startCharIdx ||
            field.endPos!==rawStart+field.endCharIdx-field.startCharIdx)throw invalid();
      }
    }
    return {listId,path,fields:owned,data};
  });
  if(result.reduce((n,r)=>n+r.fields.length,0)!==fields.length ||
      markers.some((c:any)=>!result.some(r=>r.listId===c.list)))throw invalid();
  return result;
}
