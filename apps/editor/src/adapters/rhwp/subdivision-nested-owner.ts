import type {Table} from '../../modules/document/public/index.ts';
import {parsed} from './structure.ts';
import {sameTableLayout} from './table-layout-evidence.ts';

export type NestedSubdivisionOwner={index:number;listId:number};
const invalid=()=>Error('분할할 칸의 중첩 표와 모든 내부 셀·글줄의 원래 위치를 확인하지 못했습니다.');

/** A single inline child table in a dedicated, otherwise empty paragraph.
 * Other story types, additional controls and deeper tables remain ineligible. */
export function subdivisionNestedOwner(doc:any,t:Table):NestedSubdivisionOwner|undefined {
  const controls=parsed(doc.getControls()),children=controls.filter((v:any)=>v.list!==0);
  if(!children.some((v:any)=>v.ctrlId==='tbl'))return;
  if(children.length!==1 || doc.pageCount()!==1 || parsed(doc.getFieldList()).length)throw invalid();
  const [child]=children, lists=parsed(doc.getCursorModel()).lists;
  const host=lists.find((v:any)=>v.listId===child.list);
  if(!host?.isCell || host.hostListId!==0 || host.sectionIndex!==t.section || host.hostPara!==t.paragraph ||
      host.controlIndex!==t.control || host.paraCount!==1 || child.para!==0 || child.controlIndex!==0 ||
      child.props?.Lock!==0 || child.props.TreatAsChar!==1 || child.props.AllowOverlap!==0 ||
      !(child.props.Width>0 && child.props.Height>0) || t.cells[host.cellIndex]?.text!=='' ||
      lists.some((v:any)=>!v.isCell || v.hostListId!==0 && v.hostListId!==host.listId))throw invalid();
  return {index:host.cellIndex,listId:host.listId};
}

const rect=(v:any)=>({x:v.x,y:v.y,w:v.w,h:v.h});
function inside(v:any,box:any){
  return [v.x,v.y,v.w,v.h].every(Number.isFinite) && v.w>=0 && v.h>0 && v.x>=box.x-0.2 && v.y>=box.y-0.2 &&
    v.x+v.w<=box.x+box.w+0.2 && v.y+v.h<=box.y+box.h+0.2;
}
const overlap=(a:any,b:any)=>Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>0.2 &&
  Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>0.2;

export function nestedSubdivisionEvidence(doc:any,t:Table,owner:NestedSubdivisionOwner) {
  const at=[t.section,t.paragraph] as const,host={controlIndex:t.control,cellIndex:owner.index,cellParaIndex:0};
  const path=(i:number,p:number)=>JSON.stringify([host,{controlIndex:0,cellIndex:i,cellParaIndex:p}]);
  const dimensions=parsed(doc.getTableDimensionsByPath(...at,path(0,0)));
  const boxes=parsed(doc.getTableCellBboxesByPath(...at,path(0,0)));
  const tables=parsed(doc.getPageControlLayout(0)).controls.filter((v:any)=>v.type==='table');
  const outer=tables.find((v:any)=>sameTableLayout(v.stableIndex,[...at,t.control]));
  const inner=tables.filter((v:any)=>v.stableIndex?.length>3);
  if(!outer || inner.length!==1 || !boxes.length || boxes.length!==dimensions.cellCount ||
      boxes.length>200 || boxes.some((c:any,i:number)=>c.pageIndex!==0 || c.cellIdx!==i) ||
      inner[0].rowCount!==dimensions.rowCount || inner[0].colCount!==dimensions.colCount)throw invalid();
  const source=t.cells[owner.index],box=outer.cells.find((c:any)=>c.row===source.row && c.col===source.column);
  if(!box || !inside(inner[0],box) || outer.cells.some((c:any)=>c!==box && overlap(inner[0],c)) ||
      boxes.some((c:any,i:number)=>boxes.slice(i+1).some((other:any)=>overlap(c,other))) ||
      !sameTableLayout(inner[0].cells.map((c:any)=>[c.cellIdx,c.row,c.col,c.rowSpan,c.colSpan,rect(c)]),
      boxes.map((c:any)=>[c.cellIdx,c.row,c.col,c.rowSpan,c.colSpan,rect(c)])))throw invalid();
  const lists=parsed(doc.getCursorModel()).lists.filter((l:any)=>l.hostListId===owner.listId);
  if(lists.length!==boxes.length)throw invalid();
  const texts=new Map<string,string>(),ends=new Map<string,number>(),cellProperties=[];
  for(const b of boxes){
    const l=lists.find((v:any)=>v.cellIndex===b.cellIdx);
    const properties=parsed(doc.getCellPropertiesByPath(...at,path(b.cellIdx,0)));
    if(!inside(b,inner[0]) || !l || l.paraCount<1 || l.paraCount>50 || properties.cellProtect!==false ||
        properties.isHeader!==false || properties.textDirection!==0 || properties.fieldName!=='')throw invalid();
    cellProperties.push(properties);
    for(let p=0;p<l.paraCount;p++){
      const key=b.cellIdx+'/'+p,loc=path(b.cellIdx,p),n=doc.getCellParagraphLengthByPath(...at,loc);
      texts.set(key,doc.getTextInCellByPath(...at,loc,0,n));
    }
  }
  const lines=[];
  for(const r of parsed(doc.getPageTextLayout(0)).runs){
    if(r.cellPath?.length!==2)continue;
    const [parent,leaf]=r.cellPath,b=boxes[leaf.cellIndex],key=leaf.cellIndex+'/'+leaf.cellParaIndex;
    if(r.secIdx!==t.section || r.parentParaIdx!==t.paragraph || !sameTableLayout(parent,host) || leaf.controlIndex!==0 ||
        !b || !inside(r,b) || typeof r.text!=='string' || !texts.has(key) || r.charStart!==(ends.get(key)??0) ||
        !Array.isArray(r.charX) || !r.charX.every(Number.isFinite))throw invalid();
    const end=r.charStart+Array.from(r.text).length;
    if(Array.from(texts.get(key)!).slice(r.charStart,end).join('')!==r.text)throw invalid();
    ends.set(key,end);lines.push(r);
  }
  for(const [key,text] of texts)if((ends.get(key)??0)!==Array.from(text).length)throw invalid();
  return {table:inner[0],boxes,cellProperties,lines,texts:[...texts]};
}
