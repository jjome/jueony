import type {NestedTable,Structure,Table} from '../../modules/document/public/types.ts';
import {parsed} from './structure.ts';

const fail=()=>Error('중첩 표 캡션의 소유 경로·글자 서식 또는 배치를 확인하지 못했습니다.');
const tablePath=(t:Table|NestedTable)=>JSON.stringify([...('ancestors' in t?t.ancestors:[]),{controlIndex:t.control,cellIndex:0,cellParaIndex:0}]);
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const near=(a:number,b:number)=>Math.abs(a-b)<=.21;
type Box={x:number;y:number;w:number;h:number};
type StoredParagraph={text:string;runs:{char_shape_id:number;start_pos:number}[];lines:{text_start:number}[]};

function paintedCaption(doc:any,target:NestedTable,page:number,left:number,top:number){
 const host=target.ancestors.at(-1)!.cellParaIndex,owners:{box:Box;lines:any[]}[]=[];
 function visit(parent:any){
  const children=parent.children??[];
  for(const table of children.filter((n:any)=>n.type==='Table'&&n.pi===host&&n.ci===target.control&&
     near(n.bbox.x,left)&&near(n.bbox.y,top))){
   const lines=children.filter((n:any)=>n.type==='TextLine'&&n.captionOwner?.controlKind==='table'&&
    n.captionOwner.secIdx===target.section&&n.captionOwner.paraIdx===host&&n.captionOwner.controlIdx===target.control);
   if(!lines.length||lines.length>256)throw fail();
   owners.push({box:table.bbox,lines});
  }
  for(const child of children)visit(child);
 }
 const tree=parsed(doc.getPageRenderTree(page));visit(tree);
 if(owners.length!==1)throw fail();
 const pageRuns=parsed(doc.getPageTextLayout(page)).runs.filter((r:any)=>r.cellIdx===65534);
 const lines=owners[0].lines.map(line=>{
  const ordinal=line.captionOwner.captionOrdinal;
  const runs=(line.children??[]).map((child:any)=>{
   if(child.type!=='TextRun')throw fail();
   const b=child.bbox,hits=pageRuns.filter((r:any)=>r.cellParaIdx===ordinal&&r.text===child.text&&r.x===b.x&&r.y===b.y&&r.w===b.w&&r.h===b.h);
   if(hits.length!==1||b.x<-.2||b.y<-.2||b.x+b.w>tree.bbox.w+.2||b.y+b.h>tree.bbox.h+.2)throw fail();
   return hits[0];
  });
  if(!runs.length)throw fail();
  return {ordinal,box:line.bbox as Box,runs:runs as any[]};
 });
 return {box:owners[0].box,lines};
}

/** Each published line belongs to a paragraph ordinal on the table's parent
 * cell. TextRun offsets use scalar indices; stored HWP shape/line offsets use UTF-16. */
function captionDrawing(doc:any,t:NestedTable,caption:any,boxes:(table:Table|NestedTable)=>any[]){
 const paragraphs:StoredParagraph[]=caption.kind==='plain'?[caption]:caption.paragraphs;
 if(!Array.isArray(paragraphs)||!paragraphs.length)throw fail();
 const cells=boxes(t);
 if(!cells.length||cells.length!==t.cells.length||cells.some(c=>c.pageIndex!==cells[0].pageIndex||!Number.isFinite(c.y+c.h+c.x)))throw fail();
 const page=cells[0].pageIndex,{box,lines}=paintedCaption(doc,t,page,Math.min(...cells.map(c=>c.x)),Math.min(...cells.map(c=>c.y)));
 let next=0;
 for(const [ordinal,p] of paragraphs.entries()){
  const group=lines.filter(l=>l.ordinal===ordinal);
  if(!group.length||group.some((line,i)=>line!==lines[next+i])||(p.lines.length>0&&p.lines.length!==group.length))throw fail();
  let utf16=0,scalars=0,shape=0;
  for(const [i,line] of group.entries()){
   if(p.lines.length&&p.lines[i].text_start!==utf16)throw fail();
   for(const r of line.runs){
    while(shape+1<p.runs.length&&p.runs[shape+1].start_pos===utf16)shape++;
    if(!r.text||r.charStart!==scalars||!p.text.startsWith(r.text,utf16)||p.runs[shape]?.char_shape_id!==r.charShapeId||
       (shape+1<p.runs.length&&utf16+r.text.length>p.runs[shape+1].start_pos))throw fail();
    utf16+=r.text.length;scalars+=Array.from(r.text).length;
   }
  }
  if(utf16!==p.text.length||shape+1!==p.runs.length)throw fail();
  next+=group.length;
 }
 if(next!==lines.length||lines.some((line,i)=>i>0&&line.box.y+.2<lines[i-1].box.y+lines[i-1].box.h))throw fail();
 const x=Math.min(...lines.map(l=>l.box.x)),y=lines[0].box.y;
 const right=Math.max(...lines.map(l=>l.box.x+l.box.w)),bottom=Math.max(...lines.map(l=>l.box.y+l.box.h));
 const side=caption.direction==='Left'||caption.direction==='Right';
 const slack=Math.max(0,box.h-(bottom-y));
 const offset=side?y-box.y-(caption.align==='Center'?slack/2:caption.align==='Bottom'?slack:0):x-box.x;
 const gaps={Left:box.x-right,Right:x-box.x-box.w,Top:box.y-bottom,Bottom:y-box.y-box.h};
 const gap=gaps[caption.direction as keyof typeof gaps];
 if(!Number.isFinite(gap)||gap<-.2||!Number.isFinite(offset))throw fail();
 const positions=[gap,offset];
 const styles=lines.map(line=>{
  positions.push(line.box.x-x,line.box.y-y,line.box.h);
  if(side)positions.push(line.box.w);
  return {ordinal:line.ordinal,runs:line.runs.map(({x:runX,y:runY,cellPath,...style}:any)=>{
   positions.push(runX-x,runY-y);return style;
  })};
 });
 return {page,positions,styles,origin:[x,y]};
}

export function readNestedAxisCaptions(doc:any,structure:Structure,target:NestedTable){
 if(typeof doc.getTableAxisCaptionEvidenceByPath!=='function'){
  const stories=parsed(doc.getDocumentStoryInformation()).paragraphs;
  if(stories.some((p:any)=>p.story==='caption'))throw fail();
  return {stored:[],drawing:null};
 }
 const tables=[...structure.tables,...(structure.nestedTables??[])];
 const stored=tables.flatMap(t=>{
  const value=parsed(doc.getTableAxisCaptionEvidenceByPath(t.section,t.paragraph,tablePath(t)));
  if(value===null)return [];
  if(!['plain','paragraphs','complex'].includes(value?.kind))throw fail();
  return [{id:t.id,value}];
 });
 const caption=stored.find(c=>c.id===target.id)?.value;
 if(!caption)return {stored,drawing:null};
 const paragraphs:StoredParagraph[]=caption.kind==='plain'?[caption]:caption.paragraphs;
 if(!Array.isArray(paragraphs))throw fail();
 const prefix='section/'+target.section+'/body/p/'+target.paragraph+
  target.ancestors.map(p=>'/control/'+p.controlIndex+'/cell/'+p.cellIndex+'/p/'+p.cellParaIndex).join('')+
  '/control/'+target.control+'/caption/p/';
 const stories=parsed(doc.getDocumentStoryInformation()).paragraphs.filter((p:any)=>p.story==='caption'&&p.path.startsWith(prefix));
 if(stories.length!==paragraphs.length||stories.some((s:any,i:number)=>s.path!==prefix+i||s.text!==paragraphs[i].text))throw fail();
 const boxes=(t:Table|NestedTable):any[]=>parsed(doc.getTableCellBboxesByPath(t.section,t.paragraph,tablePath(t)));
 const siblings=tables.filter(t=>t.id!==target.id&&!target.id.startsWith(t.id+'c')).map(t=>{
  const cap=stored.find(c=>c.id===t.id)?.value;
  const drawing='ancestors' in t&&cap&&cap.kind!=='complex'?captionDrawing(doc,t,cap,boxes):null;
  return {id:t.id,boxes:boxes(t),drawing};
 });
 const {origin,...drawing}=captionDrawing(doc,target,caption,boxes);
 return {stored,drawing:{...drawing,siblings}};
}

export function sameNestedCaptionPlacement(before:ReturnType<typeof readNestedAxisCaptions>,after:ReturnType<typeof readNestedAxisCaptions>){
 if(!same(before.stored,after.stored))return false;
 const a=before.drawing,b=after.drawing;
 if(!a||!b)return a===b;
 return a.page===b.page&&a.positions.length===b.positions.length&&a.positions.every((v,i)=>near(v,b.positions[i]))&&same(a.styles,b.styles)&&same(a.siblings,b.siblings);
}
