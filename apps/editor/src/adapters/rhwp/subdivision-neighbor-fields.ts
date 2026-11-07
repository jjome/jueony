import type {Table} from '../../modules/document/public/index.ts';
import {parsed} from './structure.ts';
import {axisFieldSignature} from './axis-cell-fields.ts';
import {tableLayoutEvidence} from './table-layout-evidence.ts';

const invalid=()=>Error('분할할 표의 이웃 누름틀·이름 셀의 원래 위치와 내용을 확인하지 못했습니다.');

/** Every field in the document must belong to an independently identified
 * root cell of this table. Only its original list slot is allowed to move. */
export function subdivisionFieldOwners(doc:any,table:Table):Map<number,number> {
  const fields=parsed(doc.getFieldList());
  if(!Array.isArray(fields)) throw invalid();
  const owners=new Map<number,number>();
  if(!fields.length && !table.cells.some(c=>c.properties.fieldName)) return owners;
  const lists=parsed(doc.getCursorModel()).lists, controls=parsed(doc.getControls());
  for(const cell of table.cells){
    if(!cell.axisFieldSignature){
      if(cell.properties.fieldName) throw invalid();
      continue;
    }
    const found=lists.filter((l:any)=>l.isCell && l.hostListId===0 && l.sectionIndex===table.section &&
      l.hostPara===table.paragraph && l.controlIndex===table.control && l.cellIndex===cell.index);
    if(found.length!==1)throw invalid();
    const [list]=found,children=controls.filter((c:any)=>c.list===list.listId);
    if(owners.has(list.listId) || axisFieldSignature(doc,table.section,table.paragraph,table.control,cell.index,
        list,children,fields,cell.properties.fieldName)!==cell.axisFieldSignature)throw invalid();
    owners.set(list.listId,cell.index);
  }
  if(new Set(fields.map((f:any)=>f.fieldId)).size!==fields.length ||
      fields.some((f:any)=>!owners.has(f.listId) || f.cellField && f.fieldId!==table.control*65536+owners.get(f.listId)!))
    throw invalid();
  const previousEnd=new Map<string,number>();
  for(const f of fields)if(!f.cellField){
    const paragraph=f.listId+'/'+f.paraInList;
    if((previousEnd.get(paragraph)??-1)>=f.startCharIdx) throw invalid();
    previousEnd.set(paragraph,f.endCharIdx);
  }
  return owners;
}

/** A virtual cell field supplies its first paragraph as the field value.
 * An inline field in the same cell has a separate marker range and cannot
 * use the named-cell split contract. */
export function namedSubdivisionTargets(doc:any,table:Table,owners:Map<number,number>):Set<number> {
  const targets=new Set<number>();
  if(!owners.size)return targets;
  const fields=parsed(doc.getFieldList());
  for(const [list,index] of owners){
    const owned=fields.filter((f:any)=>f.listId===list),field=owned[0];
    if(owned.length!==1 || field.cellField!==true || fields.filter((f:any)=>f.name===field.name).length!==1)continue;
    const args=[table.section,table.paragraph,table.control,index,0] as const;
    if(field.value===doc.getTextInCell(...args,0,doc.getCellParagraphLength(...args)))targets.add(index);
  }
  return targets;
}

/** Predict all owner changes using the planned old-to-new cell addresses.
 * Named cells have a synthetic ID derived from that address. Inline field
 * IDs, field content, ranges and child control records must match unchanged. */
export function projectSubdivisionFields(expected:any,table:Table,owners:Map<number,number>,cells:Array<{index:number;originIndex:number|null}>,afterLists:any[]){
  if(!owners.size)return;
  const moved=new Map<number,{index:number;listId:number}>();
  for(const [oldList,oldIndex] of owners){
    const cell=cells.find(c=>c.originIndex===oldIndex);
    const match=cell && afterLists.filter(l=>l.isCell && l.hostListId===0 && l.sectionIndex===table.section &&
      l.hostPara===table.paragraph && l.controlIndex===table.control && l.cellIndex===cell.index);
    if(!cell || !match || match.length!==1) throw invalid();
    moved.set(oldList,{index:cell.index,listId:match[0].listId});
  }
  for(const f of expected.fields){
    const owner=moved.get(f.listId);
    if(!owner)throw invalid();
    f.location.path[0].cellIndex=owner.index;
    f.listId=owner.listId;
    if(f.cellField) f.fieldId=table.control*65536+owner.index;
  }
  for(const c of expected.controls)if(c.list!==0){
    const owner=moved.get(c.list);
    if(!owner)throw invalid();
    c.list=owner.listId;
  }
}

export function subdivisionFieldLines(doc:any,table:Table,owners:Map<number,number>,cells:Array<{index:number;originIndex:number|null}>,distributing?:number) {
  const map=new Map<number,number>();
  for(const index of owners.values()){
    const planned=cells.find(c=>c.originIndex===index);
    if(!planned)throw invalid();
    map.set(index,planned.index);
  }
  // Distributing centered paragraphs changes the first line's vertical
  // position. All target runs are checked inside their new owner rectangles.
  return tableLayoutEvidence(doc,table).filter((v:any)=>map.has(v.cell) && v.cell!==distributing)
    .map((v:any)=>({...v,cell:map.get(v.cell)}));
}
