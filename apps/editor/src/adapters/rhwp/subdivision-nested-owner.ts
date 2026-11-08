import type {Table} from '../../modules/document/public/index.ts';
import {parsed} from './structure.ts';
import {sameTableLayout} from './table-layout-evidence.ts';
import {subdivisionNestedCaptions} from './subdivision-nested-captions.ts';
import {subdivisionNestedFields} from './subdivision-nested-fields.ts';

type CellPath={controlIndex:number;cellIndex:number;cellParaIndex:number}[];
type NestedSubdivisionTable={listId:number;paragraph:number;path:CellPath};
export type NestedSubdivisionOwner={index:number;listId:number;paragraphs:number[];tables:NestedSubdivisionTable[];controlLists:number[];descendantLists:number[];fieldLists:number[]};
// nested_axis_table accepts 2..=8 path entries. nested-tables.ts also limits
// locate to eight entries, including the root and final leaf cell.
const MAX_CELL_PATH=8,MAX_NESTED_CELLS=1000;
const invalid=()=>Error('분할할 칸의 중첩 표와 모든 내부 셀·글줄의 원래 위치를 확인하지 못했습니다.');

/** Every inline table has a unique, fully resolved path and an empty anchor paragraph. */
export function subdivisionNestedOwner(doc:any,t:Table):NestedSubdivisionOwner|undefined {
  const controls=parsed(doc.getControls()),children=controls.filter((v:any)=>v.list!==0 && v.ctrlId==='tbl');
  if(!children.length)return;
  const lists=parsed(doc.getCursorModel()).lists,byId=new Map<number,any>(lists.map((l:any)=>[l.listId,l]));
  if(byId.size!==lists.length || lists.some((l:any)=>!Number.isSafeInteger(l.listId) || l.listId<=0))throw invalid();
  const descendantLists=lists.filter((l:any)=>l.hostListId!==0);
  const physicalCells=new Set(descendantLists.map((l:any)=>[l.hostListId,l.hostPara,l.controlIndex,l.cellIndex].join('/')));
  if(descendantLists.length>MAX_NESTED_CELLS || children.length>MAX_NESTED_CELLS ||
      physicalCells.size!==descendantLists.length || lists.some((l:any)=>!l.isCell))throw invalid();
  const roots=children.map((c:any)=>byId.get(c.list)).filter((l:any)=>l?.hostListId===0);
  const host=roots[0];
  if(!host?.isCell || host.sectionIndex!==t.section || host.hostPara!==t.paragraph ||
      host.controlIndex!==t.control || !t.cells[host.cellIndex] || roots.some((l:any)=>l.listId!==host.listId))throw invalid();
  const cellPath=(id:number,paragraph:number):CellPath=>{
    const path:CellPath=[],visited=new Set<number>();
    for(;;){
      const list=byId.get(id);
      if(visited.has(id) || path.length>=MAX_CELL_PATH-1 || !list?.isCell || list.sectionIndex!==t.section ||
          ![list.controlIndex,list.cellIndex,list.hostListId,list.hostPara,paragraph].every(n=>Number.isSafeInteger(n) && n>=0) ||
          !Number.isSafeInteger(list.paraCount) || list.paraCount<1 || list.paraCount>50 || paragraph>=list.paraCount)throw invalid();
      visited.add(id);
      path.unshift({controlIndex:list.controlIndex,cellIndex:list.cellIndex,cellParaIndex:paragraph});
      if(list.listId===host.listId)return path;
      if(list.hostListId===0)throw invalid();
      id=list.hostListId;paragraph=list.hostPara;
    }
  };
  const tables:NestedSubdivisionTable[]=[],keys=new Set<string>();
  for(const child of children){
    const path=cellPath(child.list,child.para),encoded=JSON.stringify(path);
    if(child.ctrlId!=='tbl' || keys.has(encoded) || child.controlIndex!==0 || child.pos!==0 ||
        child.props?.Lock!==0 || child.props.TreatAsChar!==1 || child.props.AllowOverlap!==0 ||
        !(child.props.Width>0 && child.props.Height>0) || doc.getCellParagraphLengthByPath(t.section,t.paragraph,encoded)!==0 ||
        byId.get(child.list).paraCount!==doc.getCellParagraphCountByPath(t.section,t.paragraph,encoded))throw invalid();
    keys.add(encoded);
    tables.push({listId:child.list,paragraph:child.para,path});
  }
  if(descendantLists.some((l:any)=>!tables.some(c=>c.listId===l.hostListId && c.paragraph===l.hostPara && l.controlIndex===0)))throw invalid();
  const owner:NestedSubdivisionOwner={index:host.cellIndex,listId:host.listId,
    paragraphs:tables.filter(c=>c.listId===host.listId).map(c=>c.paragraph).sort((a,b)=>a-b),
    tables,controlLists:[...new Set(tables.map(c=>c.listId))],descendantLists:descendantLists.map((l:any)=>l.listId),fieldLists:[]};
  owner.fieldLists=subdivisionNestedFields(doc,t,owner,lists,controls).map(r=>r.listId);
  return owner;
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

function readInner(doc:any,t:Table,table:NestedSubdivisionTable,lists:any[]){
  const at=[t.section,t.paragraph] as const,{paragraph,path:ancestors}=table,host=ancestors.at(-1)!;
  const path=(i:number,p:number)=>JSON.stringify([...ancestors,{controlIndex:0,cellIndex:i,cellParaIndex:p}]);
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
  return {paragraph,host,ancestors,page,dimensions,boxes,cells};
}

function readNestedSubdivisionEvidence(doc:any,t:Table,owner:NestedSubdivisionOwner) {
  const at=[t.section,t.paragraph] as const,lists=parsed(doc.getCursorModel()).lists;
  const fields=subdivisionNestedFields(doc,t,owner,lists);
  if(!sameTableLayout(fields.map(f=>f.listId),owner.fieldLists))throw invalid();
  const children=owner.tables.map(c=>readInner(doc,t,c,lists.filter((l:any)=>l.hostListId===c.listId && l.hostPara===c.paragraph)));
  const pages=doc.pageCount(),page=children[0]?.page;
  if(!Number.isSafeInteger(pages) || pages<1 || pages>200 || !Number.isSafeInteger(page) || page<0 || page>=pages ||
      children.some(c=>c.page!==page))throw invalid();
  const pageControls=Array.from({length:pages},(_,p)=>parsed(doc.getPageControlLayout(p)).controls);
  const rootTables=parsed(doc.getControls()).filter((c:any)=>c.list===0 && c.ctrlId==='tbl');
  const counts=Array.from({length:doc.getSectionCount()},(_,section)=>doc.getParagraphCount(section) as number);
  const sectionOffsets=counts.map((_,section)=>counts.slice(0,section).reduce((sum,count)=>sum+count,0));
  for(const controls of pageControls)for(const frame of controls.filter((c:any)=>c.type==='table')){
    if(!Array.isArray(frame.stableIndex) || frame.stableIndex.length<3 ||
        frame.stableIndex.some((n:any)=>!Number.isSafeInteger(n) || n<0))throw invalid();
    if(frame.stableIndex.length===3 && (frame.paraIdx>=counts[frame.secIdx] ||
        !sameTableLayout(frame.stableIndex,[frame.secIdx,frame.paraIdx,frame.controlIdx]) ||
        !rootTables.some((c:any)=>c.para===sectionOffsets[frame.secIdx]+frame.paraIdx && c.controlIndex===frame.controlIdx)))throw invalid();
  }
  const isOuter=(v:any)=>v.type==='table' && sameTableLayout(v.stableIndex,[...at,t.control]);
  const isInner=(v:any)=>v.type==='table' && v.stableIndex?.length>3;
  const ownerRun=(r:any)=>r.secIdx===t.section && r.parentParaIdx===t.paragraph &&
    (r.controlIdx===t.control && r.cellIdx===owner.index ||
     r.cellPath?.[0]?.controlIndex===t.control && r.cellPath[0].cellIndex===owner.index);
  for(let other=0;other<pages;other++){
    if(other===page)continue;
    const controls=pageControls[other];
    if(controls.some((v:any)=>isOuter(v)||isInner(v)) ||
        parsed(doc.getPageTextLayout(other)).runs.some((r:any)=>r.cellPath?.length>1 || ownerRun(r)))throw invalid();
  }
  const tables=pageControls[page],outerFrames=tables.filter(isOuter),inner=tables.filter(isInner);
  if(outerFrames.length!==1 || inner.length!==children.length)throw invalid();
  const outer=outerFrames[0],source=t.cells[owner.index],box=outer.cells.find((c:any)=>c.cellIdx===owner.index && c.row===source.row && c.col===source.column);
  if(!box || inner.some((frame:any)=>!inside(frame,box) ||
      outer.cells.some((c:any)=>c!==box && overlap(frame,c))))throw invalid();
  const runs=parsed(doc.getPageTextLayout(page)).runs;
  const captions=subdivisionNestedCaptions(doc,t,children.map(c=>c.ancestors),page,runs);
  const innerRuns=runs.filter((r:any)=>r.cellPath?.length>1 && r.cellPath.at(-1).cellIndex!==65534);
  const nested=children.map(child=>{
    const {paragraph,ancestors,dimensions,cells,boxes}=child;
    // The renderer publishes the local anchor paragraph and its full enclosing cell path.
    // Match both to the independently queried rectangles, even for two identical tables.
    const matches=inner.filter((f:any)=>f.secIdx===t.section && f.paraIdx===paragraph && f.controlIdx===0 &&
      sameTableLayout(f.stableIndex,[t.section,paragraph,...ancestors.flatMap(p=>[p.controlIndex,p.cellIndex,p.cellParaIndex]),0,0,0,0]));
    if(matches.length!==1)throw invalid();
    const frame=matches[0];
    if(frame.rowCount!==dimensions.rowCount || frame.colCount!==dimensions.colCount ||
        !sameTableLayout(frame.cells.map(cellBox),boxes.map(cellBox)) || boxes.some((b:any)=>!inside(b,frame)))throw invalid();
    const lines=innerRuns.filter((r:any)=>r.cellPath.length===ancestors.length+1 && sameTableLayout(r.cellPath.slice(0,-1),ancestors)),ends=new Map<string,number>();
    for(const r of lines){
      const leaf=r.cellPath.at(-1),key=leaf.cellIndex+'/'+leaf.cellParaIndex,content=cells[leaf.cellIndex]?.paragraphs[leaf.cellParaIndex],text=content?.text;
      const box=boxes[leaf.cellIndex],length=typeof r.text==='string' ? Array.from(r.text).length : -1,ink=r.text ? r : {...r,w:0};
      if(!ownerRun(r) || r.controlIdx!==t.control || r.cellIdx!==owner.index ||
          r.cellParaIdx!==ancestors[0].cellParaIndex || leaf.controlIndex!==0 || r.paraIdx!==leaf.cellParaIndex || typeof text!=='string' ||
          !box || !inside(ink,box) || length<0 || r.charStart!==(ends.get(key)??0) ||
          !Array.isArray(r.charX) || r.charX.length!==length+1 || !r.charX.every(Number.isFinite) ||
          r.charX.some((x:number)=>r.x+x<box.x-0.2 || r.x+x>box.x+box.w+0.2))throw invalid();
      const end=r.charStart+length;
      if(r.text && !content.shapes.some((s:any)=>s.startOffset<=r.charStart && s.endOffset>=end && s.charShapeId===r.charShapeId))throw invalid();
      if(Array.from(text).slice(r.charStart,end).join('')!==r.text)throw invalid();
      ends.set(key,end);
    }
    for(const cell of cells)for(const [i,p] of cell.paragraphs.entries()){
      if((ends.get(cell.index+'/'+i)??0)!==Array.from(p.text).length)throw invalid();
    }
    return {...child,frame,lines:lines.map((r:any)=>r.text ? r : {...r,w:0})};
  });
  if(nested.reduce((sum,c)=>sum+c.lines.length,0)!==innerRuns.length)throw invalid();
  for(const child of nested){
    const ancestors=child.ancestors,anchor=ancestors.at(-1)!;
    const parent=nested.find(p=>sameTableLayout(p.ancestors,ancestors.slice(0,-1)));
    if(ancestors.length>1 && !parent)throw invalid();
    const parentCells=parent?.boxes ?? [box],ownerCell=parent ? parentCells[anchor.cellIndex] : box;
    if(!ownerCell || !inside(child.frame,ownerCell) ||
        parentCells.some((c:any)=>c!==ownerCell && overlap(child.frame,c)) ||
        parent?.lines.some((r:any)=>r.text && overlap(child.frame,r)) ||
        nested.some(sibling=>sibling!==child && sameTableLayout(sibling.ancestors.slice(0,-1),ancestors.slice(0,-1)) &&
          overlap(child.frame,sibling.frame)))throw invalid();
  }
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
  for(const r of runs.filter((v:any)=>ownerRun(v) && !(v.cellPath?.length>1))){
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
  for(const caption of captions){
    const parent=nested.find(p=>sameTableLayout(p.ancestors,caption.path.slice(0,-1)));
    const parentCell=parent ? parent.boxes[caption.path.at(-1)!.cellIndex] : box;
    if(caption.path.length>1 && !parent || !parentCell)throw invalid();
    for(const line of caption.lines){
      if(!inside(line,parentCell) || !inside(line,box) || typeof line.text!=='string' || !Array.isArray(line.charX) ||
          line.charX.length!==Array.from(line.text).length+1 || Math.abs(line.charX[0])>0.2 ||
          Math.abs(line.charX.at(-1)-line.w)>0.2 ||
          line.charX.some((x:number,i:number)=>!Number.isFinite(x) || i>0 && x<line.charX[i-1] ||
            line.x+x<parentCell.x-0.2 || line.x+x>parentCell.x+parentCell.w+0.2) ||
          nested.some(other=>!(other.ancestors.length<caption.path.length &&
            sameTableLayout(other.ancestors,caption.path.slice(0,other.ancestors.length))) && overlap(line,other.frame)) ||
          [...ownerLines,...nested.flatMap(c=>c.lines)].some((r:any)=>r.text && overlap(line,r)) ||
          captions.some(other=>other!==caption && other.lines.some((r:any)=>overlap(line,r))))
        throw Error('안쪽 표 캡션의 글줄이 첫 칸 안에 겹치지 않고 들어가지 않습니다.');
    }
  }
  return {page,pageCount:pages,nested,ownerParagraphs,ownerLines,captions,fields};
}

export function nestedSubdivisionEvidence(doc:any,t:Table,owner:NestedSubdivisionOwner) {
  const live=readNestedSubdivisionEvidence(doc,t,owner);
  if(!live.captions.length)return live;
  // A side caption can fit with Canvas widths but overflow using file metrics.
  // Prove the same parent bounds and non-overlap under both measurement modes.
  if(doc.canvasMetricsActive?.()!==true)return {...live,portable:live};
  try{
    doc.selectCanvasMetrics(false);
    if(doc.canvasMetricsActive()!==false)throw invalid();
    return {...live,portable:readNestedSubdivisionEvidence(doc,t,owner)};
  }finally{
    doc.selectCanvasMetrics(true);
    if(doc.canvasMetricsActive()!==true)throw invalid();
  }
}
