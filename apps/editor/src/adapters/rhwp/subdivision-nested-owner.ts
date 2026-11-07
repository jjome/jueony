import type {Table} from '../../modules/document/public/index.ts';
import {parsed} from './structure.ts';
import {sameTableLayout} from './table-layout-evidence.ts';

export type NestedSubdivisionOwner={index:number;listId:number;paragraph:number};
const invalid=()=>Error('분할할 칸의 중첩 표와 모든 내부 셀·글줄의 원래 위치를 확인하지 못했습니다.');

/** A single inline child table in a dedicated, otherwise empty paragraph.
 * Other story types, additional controls and deeper tables remain ineligible. */
export function subdivisionNestedOwner(doc:any,t:Table):NestedSubdivisionOwner|undefined {
  const controls=parsed(doc.getControls()),children=controls.filter((v:any)=>v.list!==0);
  if(!children.some((v:any)=>v.ctrlId==='tbl'))return;
  if(children.length!==1 || parsed(doc.getFieldList()).length)throw invalid();
  const [child]=children, lists=parsed(doc.getCursorModel()).lists;
  const host=lists.find((v:any)=>v.listId===child.list);
  if(!host?.isCell || host.hostListId!==0 || host.sectionIndex!==t.section || host.hostPara!==t.paragraph ||
      host.controlIndex!==t.control || !t.cells[host.cellIndex] || !Number.isSafeInteger(host.paraCount) ||
      host.paraCount<1 || host.paraCount>50 || host.paraCount!==doc.getCellParagraphCount(t.section,t.paragraph,t.control,host.cellIndex) ||
      !Number.isSafeInteger(child.para) || child.para<0 || child.para>=host.paraCount || child.controlIndex!==0 || child.pos!==0 ||
      child.props?.Lock!==0 || child.props.TreatAsChar!==1 || child.props.AllowOverlap!==0 ||
      !(child.props.Width>0 && child.props.Height>0) || doc.getCellParagraphLength(t.section,t.paragraph,t.control,host.cellIndex,child.para)!==0 ||
      lists.some((v:any)=>!v.isCell || v.hostListId!==0 && v.hostListId!==host.listId))throw invalid();
  return {index:host.cellIndex,listId:host.listId,paragraph:child.para};
}

const rect=(v:any)=>({x:v.x,y:v.y,w:v.w,h:v.h});
function inside(v:any,box:any){
  return [v.x,v.y,v.w,v.h].every(Number.isFinite) && v.w>=0 && v.h>0 && v.x>=box.x-0.2 && v.y>=box.y-0.2 &&
    v.x+v.w<=box.x+box.w+0.2 && v.y+v.h<=box.y+box.h+0.2;
}
const overlap=(a:any,b:any)=>Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>0.2 &&
  Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>0.2;

export function nestedSubdivisionEvidence(doc:any,t:Table,owner:NestedSubdivisionOwner) {
  const at=[t.section,t.paragraph] as const,host={controlIndex:t.control,cellIndex:owner.index,cellParaIndex:owner.paragraph};
  const path=(i:number,p:number)=>JSON.stringify([host,{controlIndex:0,cellIndex:i,cellParaIndex:p}]);
  const dimensions=parsed(doc.getTableDimensionsByPath(...at,path(0,0)));
  const boxes=parsed(doc.getTableCellBboxesByPath(...at,path(0,0)));
  const pages=doc.pageCount(),page=boxes[0]?.pageIndex;
  if(!Number.isSafeInteger(pages) || pages<1 || pages>200 || !Number.isSafeInteger(page) || page<0 || page>=pages ||
      boxes.length!==dimensions.cellCount || boxes.length>200 ||
      boxes.some((c:any,i:number)=>c.pageIndex!==page || c.cellIdx!==i))throw invalid();
  const isOuter=(v:any)=>v.type==='table' && sameTableLayout(v.stableIndex,[...at,t.control]);
  const isInner=(v:any)=>v.type==='table' && v.stableIndex?.length>3;
  const ownerRun=(r:any)=>r.secIdx===t.section && r.parentParaIdx===t.paragraph &&
    (r.controlIdx===t.control && r.cellIdx===owner.index ||
     r.cellPath?.[0]?.controlIndex===t.control && r.cellPath[0].cellIndex===owner.index);
  for(let other=0;other<pages;other++){
    if(other===page)continue;
    const controls=parsed(doc.getPageControlLayout(other)).controls;
    if(controls.some((v:any)=>isOuter(v)||isInner(v)) ||
        parsed(doc.getPageTextLayout(other)).runs.some((r:any)=>r.cellPath?.length>1 || ownerRun(r)))throw invalid();
  }
  const tables=parsed(doc.getPageControlLayout(page)).controls,outerFrames=tables.filter(isOuter);
  const [outer]=outerFrames,inner=tables.filter(isInner);
  if(outerFrames.length!==1 || inner.length!==1 ||
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
    if(!inside(b,inner[0]) || !l || l.sectionIndex!==t.section || l.hostPara!==owner.paragraph || l.controlIndex!==0 ||
        l.paraCount<1 || l.paraCount>50 || properties.cellProtect!==false ||
        properties.isHeader!==false || properties.textDirection!==0 || properties.fieldName!=='')throw invalid();
    cellProperties.push(properties);
    for(let p=0;p<l.paraCount;p++){
      const key=b.cellIdx+'/'+p,loc=path(b.cellIdx,p),n=doc.getCellParagraphLengthByPath(...at,loc);
      texts.set(key,doc.getTextInCellByPath(...at,loc,0,n));
    }
  }
  const runs=parsed(doc.getPageTextLayout(page)).runs;
  const count=doc.getCellParagraphCount(...at,t.control,owner.index);
  const ownerParagraphs=Array.from({length:count},(_,paragraph)=>{
    const args=[...at,t.control,owner.index,paragraph],n=doc.getCellParagraphLength(...args);
    if(!Number.isSafeInteger(n) || n<0 || n>4000)throw invalid();
    const text=doc.getTextInCell(...args,0,n),loc=JSON.stringify([{...host,cellParaIndex:paragraph}]);
    if(typeof text!=='string' || Array.from(text).length!==n || paragraph===owner.paragraph && text!=='')throw invalid();
    const shapes=parsed(doc.getCharShapeRunsInCellByPath(...at,loc,0,n));
    return {text,style:parsed(doc.getCellStyleAt(...args)),paragraph:parsed(doc.getCellParaPropertiesAt(...args)),
      characters:parsed(doc.getCellCharPropertiesAt(...args,0)),shapes};
  });
  if(ownerParagraphs.map(p=>p.text).join('\n')!==source.text)throw invalid();
  const ownerLines=[],offsets=Array<number>(count).fill(0),lines=[];
  for(const r of runs){
    if(ownerRun(r) && r.cellPath?.length!==2){
      const para=r.cellParaIdx,content=ownerParagraphs[para],n=typeof r.text==='string' ? Array.from(r.text).length : -1;
      if(!content || r.controlIdx!==t.control || r.cellIdx!==owner.index ||
          !sameTableLayout(r.cellPath,[{...host,cellParaIndex:para}]) || r.paraIdx!==para ||
          r.charStart!==offsets[para] || n<0 || Array.from(content.text).slice(r.charStart,r.charStart+n).join('')!==r.text ||
          !Array.isArray(r.charX) || r.charX.length!==n+1 || !r.charX.every(Number.isFinite))throw invalid();
      // An empty paragraph publishes its available line width, which shrinks with the first piece.
      // Its caret position and line height remain part of the proof.
      const ink=n ? r : {...r,w:0};
      if(!inside(ink,box) || r.charX.some((x:number)=>r.x+x<box.x-0.2 || r.x+x>box.x+box.w+0.2) ||
          n && overlap(ink,inner[0]))throw Error('안쪽 표와 앞뒤 문단의 글줄이 첫 칸 안에 함께 들어가지 않습니다.');
      offsets[para]+=n;
      ownerLines.push(ink);
    }
    if(r.cellPath?.length!==2)continue;
    const [parent,leaf]=r.cellPath,b=boxes[leaf.cellIndex],key=leaf.cellIndex+'/'+leaf.cellParaIndex;
    if(r.secIdx!==t.section || r.parentParaIdx!==t.paragraph || r.controlIdx!==t.control || r.cellIdx!==owner.index ||
        r.cellParaIdx!==owner.paragraph || !sameTableLayout(parent,host) || leaf.controlIndex!==0 || r.paraIdx!==leaf.cellParaIndex ||
        !b || !inside(r,b) || typeof r.text!=='string' || !texts.has(key) || r.charStart!==(ends.get(key)??0) ||
        !Array.isArray(r.charX) || !r.charX.every(Number.isFinite))throw invalid();
    const end=r.charStart+Array.from(r.text).length;
    if(Array.from(texts.get(key)!).slice(r.charStart,end).join('')!==r.text)throw invalid();
    ends.set(key,end);lines.push(r);
  }
  if(ownerParagraphs.some((p,i)=>offsets[i]!==Array.from(p.text).length))throw invalid();
  for(const [key,text] of texts)if((ends.get(key)??0)!==Array.from(text).length)throw invalid();
  return {page,pageCount:pages,table:inner[0],boxes,cellProperties,lines,texts:[...texts],ownerParagraphs,ownerLines};
}
