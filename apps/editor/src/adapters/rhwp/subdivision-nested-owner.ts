import type {Table} from '../../modules/document/public/index.ts';
import {parsed} from './structure.ts';
import {sameTableLayout} from './table-layout-evidence.ts';

export type NestedSubdivisionOwner={index:number;listId:number;paragraphs:number[]};
const invalid=()=>Error('분할할 칸의 중첩 표와 모든 내부 셀·글줄의 원래 위치를 확인하지 못했습니다.');

/** All child controls must be inline tables in separate, otherwise empty paragraphs of one root cell. */
export function subdivisionNestedOwner(doc:any,t:Table):NestedSubdivisionOwner|undefined {
  const controls=parsed(doc.getControls()),children=controls.filter((v:any)=>v.list!==0);
  if(!children.some((v:any)=>v.ctrlId==='tbl'))return;
  if(parsed(doc.getFieldList()).length)throw invalid();
  const lists=parsed(doc.getCursorModel()).lists,host=lists.find((v:any)=>v.listId===children[0].list);
  if(!host?.isCell || host.hostListId!==0 || host.sectionIndex!==t.section || host.hostPara!==t.paragraph ||
      host.controlIndex!==t.control || !t.cells[host.cellIndex] || !Number.isSafeInteger(host.paraCount) ||
      host.paraCount<1 || host.paraCount>50 || host.paraCount!==doc.getCellParagraphCount(t.section,t.paragraph,t.control,host.cellIndex) ||
      lists.some((v:any)=>!v.isCell || v.hostListId!==0 && v.hostListId!==host.listId))throw invalid();
  const paragraphs:number[]=[];
  for(const child of children){
    if(child.ctrlId!=='tbl' || child.list!==host.listId || !Number.isSafeInteger(child.para) || child.para<0 ||
        child.para>=host.paraCount || paragraphs.includes(child.para) || child.controlIndex!==0 || child.pos!==0 ||
        child.props?.Lock!==0 || child.props.TreatAsChar!==1 || child.props.AllowOverlap!==0 ||
        !(child.props.Width>0 && child.props.Height>0) || doc.getCellParagraphLength(t.section,t.paragraph,t.control,host.cellIndex,child.para)!==0)throw invalid();
    paragraphs.push(child.para);
  }
  return {index:host.cellIndex,listId:host.listId,paragraphs:paragraphs.sort((a,b)=>a-b)};
}

const rect=(v:any)=>({x:v.x,y:v.y,w:v.w,h:v.h});
function inside(v:any,box:any){
  return [v.x,v.y,v.w,v.h].every(Number.isFinite) && v.w>=0 && v.h>0 && v.x>=box.x-0.2 && v.y>=box.y-0.2 &&
    v.x+v.w<=box.x+box.w+0.2 && v.y+v.h<=box.y+box.h+0.2;
}
const overlap=(a:any,b:any)=>Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>0.2 &&
  Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>0.2;
const cellBox=(c:any)=>[c.cellIdx,c.row,c.col,c.rowSpan,c.colSpan,rect(c)];
const segment=(t:Table,owner:NestedSubdivisionOwner,p:number)=>({controlIndex:t.control,cellIndex:owner.index,cellParaIndex:p});

function characterRuns(doc:any,at:readonly [number,number],path:string,length:number){
  const shapes=parsed(doc.getCharShapeRunsInCellByPath(...at,path,0,length));
  if(!Array.isArray(shapes) || shapes.length>4000 || shapes.some((s:any,i:number)=>
      !Number.isSafeInteger(s.endOffset) || !Number.isSafeInteger(s.charShapeId) || s.charShapeId<0 ||
      s.startOffset!==(i?shapes[i-1].endOffset:0) || s.endOffset<=s.startOffset) ||
      (shapes.at(-1)?.endOffset??0)!==length)throw invalid();
  return shapes.map((s:any)=>({...s,characters:parsed(doc.getCellCharPropertiesAtByPath(...at,path,s.startOffset))}));
}

function readInner(doc:any,t:Table,owner:NestedSubdivisionOwner,paragraph:number,lists:any[]){
  const at=[t.section,t.paragraph] as const,host=segment(t,owner,paragraph);
  const path=(i:number,p:number)=>JSON.stringify([host,{controlIndex:0,cellIndex:i,cellParaIndex:p}]);
  const dimensions=parsed(doc.getTableDimensionsByPath(...at,path(0,0)));
  const boxes=parsed(doc.getTableCellBboxesByPath(...at,path(0,0))),page=boxes[0]?.pageIndex;
  if(!boxes.length || boxes.length>200 || boxes.length!==dimensions.cellCount || boxes.length!==lists.length ||
      boxes.some((c:any,i:number)=>c.pageIndex!==page || c.cellIdx!==i || boxes.slice(i+1).some((v:any)=>overlap(v,c))))throw invalid();
  const cells=boxes.map((b:any)=>{
    const index=b.cellIdx,l=lists.find(v=>v.cellIndex===index),loc=path(index,0);
    const properties=parsed(doc.getCellPropertiesByPath(...at,loc,index)),info=parsed(doc.getCellInfoByPath(...at,loc));
    if(!l || l.sectionIndex!==t.section || l.controlIndex!==0 || l.paraCount!==doc.getCellParagraphCountByPath(...at,loc) ||
        l.paraCount<1 || l.paraCount>50 || properties.cellProtect!==false || properties.isHeader!==false ||
        properties.textDirection!==0 || properties.fieldName!=='' ||
        !['row','col','rowSpan','colSpan'].every(k=>b[k]===l[k] && b[k]===info[k]))throw invalid();
    const paragraphs=Array.from({length:l.paraCount},(_,p)=>{
      const leaf=path(index,p),n=doc.getCellParagraphLengthByPath(...at,leaf);
      if(!Number.isSafeInteger(n) || n<0 || n>4000)throw invalid();
      const text=doc.getTextInCellByPath(...at,leaf,0,n),shapes=characterRuns(doc,at,leaf,n);
      if(typeof text!=='string' || Array.from(text).length!==n)throw invalid();
      return {text,paragraph:parsed(doc.getParaShapeSet(l.listId,p)),characters:parsed(doc.getCellCharPropertiesAtByPath(...at,leaf,0)),
        shapes};
    });
    return {index,properties,paragraphs};
  });
  return {paragraph,host,page,dimensions,boxes,cells};
}

export function nestedSubdivisionEvidence(doc:any,t:Table,owner:NestedSubdivisionOwner) {
  const at=[t.section,t.paragraph] as const,lists=parsed(doc.getCursorModel()).lists.filter((l:any)=>l.hostListId===owner.listId);
  if(lists.length>1000 || lists.some((l:any)=>!owner.paragraphs.includes(l.hostPara)))throw invalid();
  const children=owner.paragraphs.map(p=>readInner(doc,t,owner,p,lists.filter((l:any)=>l.hostPara===p)));
  const pages=doc.pageCount(),page=children[0]?.page;
  if(!Number.isSafeInteger(pages) || pages<1 || pages>200 || !Number.isSafeInteger(page) || page<0 || page>=pages ||
      children.some(c=>c.page!==page))throw invalid();
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
  const tables=parsed(doc.getPageControlLayout(page)).controls,outerFrames=tables.filter(isOuter),inner=tables.filter(isInner);
  if(outerFrames.length!==1 || inner.length!==children.length)throw invalid();
  const outer=outerFrames[0],source=t.cells[owner.index],box=outer.cells.find((c:any)=>c.cellIdx===owner.index && c.row===source.row && c.col===source.column);
  if(!box || inner.some((frame:any,i:number)=>!inside(frame,box) || inner.slice(i+1).some((other:any)=>overlap(frame,other)) ||
      outer.cells.some((c:any)=>c!==box && overlap(frame,c))))throw invalid();
  const runs=parsed(doc.getPageTextLayout(page)).runs,innerRuns=runs.filter((r:any)=>r.cellPath?.length>1);
  const nested=children.map(child=>{
    const {paragraph,host,dimensions,cells,boxes}=child;
    // The renderer publishes the local anchor paragraph and its full enclosing cell path.
    // Match both to the independently queried rectangles, even for two identical tables.
    const matches=inner.filter((f:any)=>f.secIdx===t.section && f.paraIdx===paragraph && f.controlIdx===0 &&
      sameTableLayout(f.stableIndex.slice(2,5),[t.control,owner.index,paragraph]));
    if(matches.length!==1)throw invalid();
    const frame=matches[0];
    if(frame.rowCount!==dimensions.rowCount || frame.colCount!==dimensions.colCount ||
        !sameTableLayout(frame.cells.map(cellBox),boxes.map(cellBox)) || boxes.some((b:any)=>!inside(b,frame)))throw invalid();
    const lines=innerRuns.filter((r:any)=>sameTableLayout(r.cellPath[0],host)),ends=new Map<string,number>();
    for(const r of lines){
      const leaf=r.cellPath[1],key=leaf.cellIndex+'/'+leaf.cellParaIndex,text=cells[leaf.cellIndex]?.paragraphs[leaf.cellParaIndex]?.text;
      if(r.cellPath.length!==2 || !ownerRun(r) || r.controlIdx!==t.control || r.cellIdx!==owner.index ||
          r.cellParaIdx!==paragraph || leaf.controlIndex!==0 || r.paraIdx!==leaf.cellParaIndex || typeof text!=='string' ||
          !inside(r,boxes[leaf.cellIndex]) || typeof r.text!=='string' || r.charStart!==(ends.get(key)??0) ||
          !Array.isArray(r.charX) || !r.charX.every(Number.isFinite))throw invalid();
      const end=r.charStart+Array.from(r.text).length;
      if(Array.from(text).slice(r.charStart,end).join('')!==r.text)throw invalid();
      ends.set(key,end);
    }
    for(const cell of cells)for(const [i,p] of cell.paragraphs.entries()){
      if((ends.get(cell.index+'/'+i)??0)!==Array.from(p.text).length)throw invalid();
    }
    return {...child,frame,lines};
  });
  if(nested.reduce((sum,c)=>sum+c.lines.length,0)!==innerRuns.length)throw invalid();
  const count=doc.getCellParagraphCount(...at,t.control,owner.index);
  const ownerParagraphs=Array.from({length:count},(_,paragraph)=>{
    const args=[...at,t.control,owner.index,paragraph],n=doc.getCellParagraphLength(...args);
    if(!Number.isSafeInteger(n) || n<0 || n>4000)throw invalid();
    const text=doc.getTextInCell(...args,0,n),loc=JSON.stringify([segment(t,owner,paragraph)]);
    if(typeof text!=='string' || Array.from(text).length!==n || owner.paragraphs.includes(paragraph) && text!=='')throw invalid();
    const shapes=characterRuns(doc,at,loc,n);
    return {text,style:parsed(doc.getCellStyleAt(...args)),paragraph:parsed(doc.getCellParaPropertiesAt(...args)),
      characters:parsed(doc.getCellCharPropertiesAt(...args,0)),shapes};
  });
  if(ownerParagraphs.map(p=>p.text).join('\n')!==source.text)throw invalid();
  const ownerLines=[],offsets=Array<number>(count).fill(0);
  for(const r of runs.filter((v:any)=>ownerRun(v) && v.cellPath?.length!==2)){
    const para=r.cellParaIdx,content=ownerParagraphs[para],n=typeof r.text==='string' ? Array.from(r.text).length : -1;
    if(!content || r.controlIdx!==t.control || r.cellIdx!==owner.index ||
        !sameTableLayout(r.cellPath,[segment(t,owner,para)]) || r.paraIdx!==para ||
        r.charStart!==offsets[para] || n<0 || Array.from(content.text).slice(r.charStart,r.charStart+n).join('')!==r.text ||
        !Array.isArray(r.charX) || r.charX.length!==n+1 || !r.charX.every(Number.isFinite))throw invalid();
    if(n && !content.shapes.some((s:any)=>s.startOffset<=r.charStart && s.endOffset>=r.charStart+n &&
        s.charShapeId===r.charShapeId))throw invalid();
    // An empty line publishes the available width. Its caret and height are retained.
    const ink=n ? r : {...r,w:0};
    if(!inside(ink,box) || r.charX.some((x:number)=>r.x+x<box.x-0.2 || r.x+x>box.x+box.w+0.2) ||
        n && inner.some((frame:any)=>overlap(ink,frame)))throw Error('안쪽 표와 앞뒤 문단의 글줄이 첫 칸 안에 함께 들어가지 않습니다.');
    offsets[para]+=n;
    ownerLines.push(ink);
  }
  if(ownerParagraphs.some((p,i)=>offsets[i]!==Array.from(p.text).length))throw invalid();
  return {page,pageCount:pages,nested,ownerParagraphs,ownerLines};
}
