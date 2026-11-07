import {readBodyTableMarkers} from './body-table-markers.ts';
import {readNestedCellFields} from './nested-cell-fields.ts';
import type {CellParagraphText, NestedTable, TableCellPathStep} from '../../modules/document/public/types.ts';

type CellList = {isCell:boolean;listId:number;hostListId:number;sectionIndex:number;hostPara:number;controlIndex:number;cellIndex:number;paraCount:number};
type Control = {ctrlId:string;ctrlCh?:number;list:number;para:number;controlIndex:number;props?:{Lock?:number}};
type Location = {section:number;paragraph:number;path:TableCellPathStep[];writable:boolean};
const json = (value:any) => typeof value === 'string' ? JSON.parse(value) : value;
const index = (value:number) => Number.isSafeInteger(value) && value >= 0;
const check = (ok:boolean) => {if (!ok) throw Error('중첩 표 경로 또는 조회 한도를 확인해 주세요.');};

/** Worksheet coordinates belong to a table. List IDs belong to a single native handle. */
export function inspectNestedTables(doc:any, controls:Control[], lists:CellList[]) {
  const tables:NestedTable[] = [];
  const listIds = new Map<string,number[]>();
  const nested = controls.filter(c => c.ctrlId === 'tbl' && c.list !== 0);
  if (!nested.length) return {tables,listIds};
  const byId = new Map(lists.map(l => [l.listId,l]));
  const key = (host:number, paragraph:number, control:number) => [host,paragraph,control].join('/');
  const controlAt = new Map(controls.filter(c => c.ctrlId === 'tbl').map(c => [key(c.list,c.para,c.controlIndex),c]));
  const controlParagraphs = new Set(controls.map(c => c.list+'/'+c.para));
  const offsets = [0];
  for (let s=0;s<doc.getSectionCount();s++) offsets.push(offsets[s]+doc.getParagraphCount(s));
  let canCheckAxis=false,cellFields:ReturnType<typeof readNestedCellFields>|undefined;
  if(typeof doc.canEditNestedTableAxis==='function' && lists.every(l=>l.isCell)){
    // Unreadable marker metadata only prevents structural edits. Independently
    // addressable cells still belong in the document snapshot.
    try{
      const fields=json(doc.getFieldList()),bookmarks=json(doc.getBookmarks());
      if(fields.length+bookmarks.length>200)throw Error();
      readBodyTableMarkers(doc,controls.filter(c=>c.list===0),offsets,fields.filter((f:any)=>f.listId===0),bookmarks);
      cellFields=readNestedCellFields(doc,lists,fields,controls);
      canCheckAxis=true;
    }catch{/* read-only axis */}
  }
  const children = new Map<string,CellList[]>();
  for (const l of lists) {
    if (!l.isCell || l.hostListId===0) continue;
    const k=key(l.hostListId,l.hostPara,l.controlIndex);
    const group=children.get(k) ?? [];
    group.push(l); children.set(k,group);
  }
  function locate(l:CellList|undefined, p:number, depth=0):Location|undefined {
    if (!l?.isCell) return undefined; // A text box can also own a child list.
    check(depth<8 && index(l.controlIndex) && index(l.cellIndex) && index(p) && p<l.paraCount);
    const parent=l.hostListId===0 ? {section:l.sectionIndex,paragraph:l.hostPara,path:[],writable:true} :
      locate(byId.get(l.hostListId),l.hostPara,depth+1);
    if (!parent) return undefined;
    const flatOrLocal=l.hostListId===0 ? offsets[l.sectionIndex]+l.hostPara : l.hostPara;
    const ctrl=controlAt.get(key(l.hostListId,flatOrLocal,l.controlIndex));
    if (!ctrl) return undefined;
    const path=[...parent.path,{controlIndex:l.controlIndex,cellIndex:l.cellIndex,cellParaIndex:p}];
    const props=json(doc.getCellPropertiesByPath(parent.section,parent.paragraph,JSON.stringify(path),l.cellIndex));
    return {...parent,path,writable:parent.writable && ctrl.props?.Lock===0 && props.cellProtect===false && props.fieldName===''};
  }
  let count=0,characters=0;
  for (const control of nested) {
    const host=locate(byId.get(control.list),control.para);
    if (!host) continue;
    const group=children.get(key(control.list,control.para,control.controlIndex)) ?? [];
    const dimensions=json(doc.getTableDimensionsByPath(host.section,host.paragraph,JSON.stringify([...host.path,{controlIndex:control.controlIndex,cellIndex:0,cellParaIndex:0}])));
    count+=group.length;
    check(group.length>0 && count<=1000 && dimensions.cellCount===group.length && index(dimensions.rowCount) && index(dimensions.colCount));
    const id='s'+host.section+'p'+host.paragraph+host.path.map(p=>'t'+p.controlIndex+'c'+p.cellIndex+'p'+p.cellParaIndex).join('')+'t'+control.controlIndex;
    check(!listIds.has(id));
    const cells:NestedTable['cells']=[],ids:number[]=[];
    const coords=new Set<string>();
    for (const l of group.sort((a,b)=>a.cellIndex-b.cellIndex)) {
      check(l.cellIndex===cells.length && index(l.paraCount) && l.paraCount>=1 && l.paraCount<=1000);
      const location=locate(l,0);
      if (!location) throw Error('중첩 셀의 부모 표를 찾을 수 없습니다.');
      const path=location.path,encoded=JSON.stringify(path);
      const args=[host.section,host.paragraph];
      const info=json(doc.getCellInfoByPath(...args,encoded)),coord=info.row+'/'+info.col;
      check(index(info.row) && index(info.col) && index(info.rowSpan) && info.rowSpan>0 && index(info.colSpan) && info.colSpan>0 &&
        info.row+info.rowSpan<=dimensions.rowCount && info.col+info.colSpan<=dimensions.colCount && !coords.has(coord));
      coords.add(coord);
      const texts:string[]=[],paragraphs:CellParagraphText[]=[];
      for (let p=0;p<l.paraCount;p++) {
        const part=JSON.stringify([...path.slice(0,-1),{...path.at(-1)!,cellParaIndex:p}]);
        const length=doc.getCellParagraphLengthByPath(...args,part);
        characters+=length;check(index(length) && characters<=120000);
        const text=doc.getTextInCellByPath(...args,part,0,length);
        texts.push(text);
        if(!location.writable || controlParagraphs.has(l.listId+'/'+p) || length>4000 ||
           Array.from(text).length!==length || /[\u0000-\u001f\u007f]/u.test(text))continue;
        const runs=json(doc.getCharShapeRunsInCellByPath(...args,part,0,length));
        if(!Array.isArray(runs)||runs.length>128||runs.some((r:any,i:number)=>!index(r.charShapeId)||
           r.startOffset!==(i?runs[i-1].endOffset:0)||!index(r.endOffset)||r.endOffset<=r.startOffset)||
           (runs.at(-1)?.endOffset??0)!==length)continue;
        paragraphs.push({index:p,text,...(runs.length>1?{formatSpans:runs.map((r:any)=>({start:r.startOffset,end:r.endOffset}))}:{})});
      }
      const text=texts.join('\n'),editable=l.paraCount===1 && paragraphs.length===1 && !paragraphs[0].formatSpans;
      const fields=cellFields?.get(l.listId);
      cells.push({index:l.cellIndex,row:info.row,column:info.col,rowSpan:info.rowSpan,columnSpan:info.colSpan,text,editable,
        ...(fields?.name?{fieldName:fields.name}:{}),...(fields?.inlineIds.length?{clickHereFieldIds:fields.inlineIds}:{}),
        ...(paragraphs.length?{paragraphs}:{})});
      ids.push(l.listId);
    }
    const tablePath=JSON.stringify([...host.path,{controlIndex:control.controlIndex,cellIndex:0,cellParaIndex:0}]);
    const axisEditable=canCheckAxis&&host.writable&&doc.canEditNestedTableAxis(host.section,host.paragraph,tablePath);
    tables.push({id,section:host.section,paragraph:host.paragraph,ancestors:host.path,control:control.controlIndex,rows:dimensions.rowCount,columns:dimensions.colCount,cells,
      ...(axisEditable?{axisEditable:true}:{})});
    listIds.set(id,ids);
  }
  return {tables,listIds};
}

export function readNestedTables(doc:any, controls:Control[], lists:CellList[]) {
  try {
    const {tables}=inspectNestedTables(doc,controls,lists);
    return tables.length ? {nestedTables:tables} : {};
  } catch {
    return {nestedTableLimitation:'중첩 표의 전체 주소·내용을 확인할 수 없어 이번 요청에서 중첩 셀 편집을 사용할 수 없습니다.'};
  }
}
