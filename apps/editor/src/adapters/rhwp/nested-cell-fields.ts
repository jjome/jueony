import type {TableCellPathStep} from '../../modules/document/public/types.ts';

const json=(v:any)=>typeof v==='string'?JSON.parse(v):v;
const invalid=()=>Error('이름 셀 또는 누름틀의 원래 소유 셀·문단·범위 또는 ID를 확인할 수 없습니다.');
const index=(n:any)=>Number.isSafeInteger(n)&&n>=0;

/** Bind each field to its full cursor-list path. A cell name has a virtual ID;
 * an inline click-here field retains its stored ID, ranges and control record. */
export function readNestedCellFields(doc:any,lists:any[],fields:any[],controls:any[]){
 if(!Array.isArray(fields)||fields.length>200||
    fields.some(f=>!Number.isSafeInteger(f.fieldId)||f.fieldId<0||f.fieldId>0xffffffff)||
    new Set(fields.map(f=>f.fieldId)).size!==fields.length)throw invalid();
 const byList=new Map<number,any[]>(),markers=new Map<number,any[]>();
 const tableParagraphs=new Set(controls.filter(c=>c.list!==0&&c.ctrlId==='tbl').map(c=>c.list+'/'+c.para));
 for(const f of fields.filter(f=>f.listId!==0)){
  const owned=byList.get(f.listId)??[];owned.push(f);byList.set(f.listId,owned);
 }
 for(const c of controls.filter(c=>c.list!==0&&c.ctrlId!=='tbl')){
  if(c.ctrlId!==''||c.ctrlCh!==0||!index(c.controlIndex)||!index(c.para)||!index(c.pos))throw invalid();
  const {list,...record}=c,owned=markers.get(list)??[];owned.push(record);markers.set(list,owned);
 }
 const owners=new Map<number,{section:number;paragraph:number;path:TableCellPathStep[]}>();
 const records=new Map<number,{name?:string;inlineIds:number[];data:unknown}>();
 for(const l of lists){
  const parent=owners.get(l.hostListId);
  if(!l.isCell||owners.has(l.listId)||(!parent&&l.hostListId!==0)||parent&&parent.section!==l.sectionIndex)throw invalid();
  const ancestors=parent?[...parent.path.slice(0,-1),{...parent.path.at(-1)!,cellParaIndex:l.hostPara}]:[];
  if(ancestors.length>=8)throw invalid();
  const section=l.sectionIndex,paragraph=parent?.paragraph??l.hostPara;
  const path=[...ancestors,{controlIndex:l.controlIndex,cellIndex:l.cellIndex,cellParaIndex:0}];
  owners.set(l.listId,{section,paragraph,path});
  const args=[section,paragraph,JSON.stringify(path)] as const;
  const properties=json(doc.getCellPropertiesByPath(...args,l.cellIndex)),owned=byList.get(l.listId)??[],slots=markers.get(l.listId)??[];
  byList.delete(l.listId);markers.delete(l.listId);
  if(!owned.length){if(properties.fieldName!==''||slots.length)throw invalid();continue;}
  const named=owned.filter(f=>f.cellField===true),inline=owned.filter(f=>f.cellField===false);
  if(named.length!==Number(properties.fieldName!=='')||inline.length!==slots.length||owned.length!==named.length+inline.length)throw invalid();
  const data=[],ranges=new Map<number,Array<[number,number]>>();
  for(const f of owned){
   const p=f.paraInList,loc=f.location;
   if(f.fieldType!=='clickhere'||!index(p)||p>=l.paraCount||typeof f.editableInForm!=='boolean'||typeof f.name!=='string'||
      typeof f.guide!=='string'||typeof f.command!=='string'||!index(f.startCharIdx)||!index(f.endCharIdx)||
      f.startCharIdx>f.endCharIdx||!index(f.startPos)||!index(f.endPos)||f.startPos>f.endPos||
      loc?.sectionIndex!==section||loc.paraIndex!==paragraph||loc.path?.length!==path.length||!path.every((step,i)=>{
       const part=loc.path[i];return part.type==='cell'&&part.controlIndex===step.controlIndex&&part.cellIndex===step.cellIndex&&
        part.paraIndex===(i===path.length-1?p:step.cellParaIndex);
      }))throw invalid();
   const encoded=JSON.stringify([...ancestors,{...path.at(-1)!,cellParaIndex:p}]),at=[section,paragraph,encoded] as const;
   const length=doc.getCellParagraphLengthByPath(...at),lookup=json(doc.getFieldValue(f.fieldId));
   if(f.endCharIdx>length||doc.getTextInCellByPath(...at,f.startCharIdx,f.endCharIdx-f.startCharIdx)!==f.value||
      lookup.ok!==true||lookup.value!==f.value)throw invalid();
   const {fieldId,listId,location,...record}=f;
   if(f.cellField){
    if(f.name!==properties.fieldName||f.editableInForm!==properties.editableInForm||f.command!==''||f.guide!==''||
       p!==0||f.startPos!==0||f.endPos!==0||f.startCharIdx!==0||f.endCharIdx!==length)throw invalid();
    data.push(record);
   }else{
    // Cursor offsets alone do not reveal whether a child table lies between
    // the field begin and end markers in the same paragraph.
    if(tableParagraphs.has(l.listId+'/'+p))throw invalid();
    const info=json(doc.getFieldInfoAtByPath(...at,f.startCharIdx));
    if(!info.inField||info.fieldId!==fieldId||info.fieldType!=='clickhere'||info.guideName!==f.guide||
       info.editableInForm!==f.editableInForm||typeof info.isGuide!=='boolean'||
       info.startCharIdx!==f.startCharIdx||info.endCharIdx!==f.endCharIdx)throw invalid();
    const group=ranges.get(p)??[];group.push([f.startCharIdx,f.endCharIdx]);ranges.set(p,group);
    data.push({fieldId,record,info});
   }
  }
  for(const [p,group] of ranges){
   const indices=slots.filter(c=>c.para===p).map(c=>c.controlIndex);group.sort((a,b)=>a[0]-b[0]);
   if(indices.length!==group.length||new Set(indices).size!==indices.length||
      group.some(([start],i)=>i>0&&start<=group[i-1][1]+1))throw invalid();
  }
  records.set(l.listId,{name:named[0]?.name,inlineIds:inline.map(f=>f.fieldId),data:{fields:data,controls:slots}});
 }
 if(byList.size||markers.size)throw invalid();
 return records;
}
