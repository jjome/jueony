import type {TableCellPathStep} from '../../modules/document/public/types.ts';

const json=(v:any)=>typeof v==='string'?JSON.parse(v):v;
const invalid=()=>Error('이름 셀의 원래 표 주소·첫 문단·가상 필드 ID를 확인할 수 없습니다.');

/** A named cell has no stored field ID. Re-resolve its runtime ID and list
 * against its complete native owner path; duplicate names remain distinct. */
export function readNestedNamedFields(doc:any,lists:any[],fields:any[]){
 if(!Array.isArray(fields)||fields.length>200||
    fields.some(f=>!Number.isSafeInteger(f.fieldId)||f.fieldId<0||f.fieldId>0xffffffff)||
    new Set(fields.map(f=>f.fieldId)).size!==fields.length)throw invalid();
 const named=fields.filter(f=>f.listId!==0),byList=new Map(named.map(f=>[f.listId,f]));
 if(byList.size!==named.length)throw invalid();
 const owners=new Map<number,{section:number;paragraph:number;path:TableCellPathStep[]}>();
 const records=new Map<number,{name:string;data:unknown}>();
 for(const l of lists){
  const parent=owners.get(l.hostListId);
  if(!l.isCell||owners.has(l.listId)||(!parent&&l.hostListId!==0)||parent&&parent.section!==l.sectionIndex)throw invalid();
  const ancestors=parent?[...parent.path.slice(0,-1),{...parent.path.at(-1)!,cellParaIndex:l.hostPara}]:[];
  if(ancestors.length>=8)throw invalid();
  const section=l.sectionIndex,paragraph=parent?.paragraph??l.hostPara;
  const path=[...ancestors,{controlIndex:l.controlIndex,cellIndex:l.cellIndex,cellParaIndex:0}];
  owners.set(l.listId,{section,paragraph,path});
  const args=[section,paragraph,JSON.stringify(path)] as const;
  const properties=json(doc.getCellPropertiesByPath(...args,l.cellIndex)),f=byList.get(l.listId);
  if(!f){if(properties.fieldName!=='')throw invalid();continue;}
  const loc=f.location;
  if(f.fieldType!=='clickhere'||f.cellField!==true||typeof f.name!=='string'||!f.name||f.name!==properties.fieldName||
     typeof f.editableInForm!=='boolean'||f.editableInForm!==properties.editableInForm||f.command!==''||f.guide!==''||
     f.paraInList!==0||f.startPos!==0||f.endPos!==0||f.startCharIdx!==0||loc?.sectionIndex!==section||
     loc.paraIndex!==paragraph||loc.path?.length!==path.length||!path.every((p,i)=>{
      const step=loc.path[i];
      return step.type==='cell'&&step.controlIndex===p.controlIndex&&step.cellIndex===p.cellIndex&&step.paraIndex===p.cellParaIndex;
     }))throw invalid();
  const length=doc.getCellParagraphLengthByPath(...args),value=doc.getTextInCellByPath(...args,0,length);
  const lookup=json(doc.getFieldValue(f.fieldId));
  if(f.endCharIdx!==length||f.value!==value||lookup.ok!==true||lookup.value!==value)throw invalid();
  const {fieldId,listId,location,...data}=f;
  records.set(l.listId,{name:f.name,data});
 }
 if(records.size!==named.length)throw invalid();
 return records;
}
