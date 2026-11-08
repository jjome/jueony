import type {NestedTable,Structure,Table} from '../../modules/document/public/types.ts';
import {parsed} from './structure.ts';

const fail=()=>Error('중첩 표 캡션의 소유 경로·글자 서식 또는 배치를 확인하지 못했습니다.');
const tablePath=(t:Table|NestedTable)=>JSON.stringify([...('ancestors' in t?t.ancestors:[]),{controlIndex:t.control,cellIndex:0,cellParaIndex:0}]);
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const near=(a:number,b:number)=>Math.abs(a-b)<=.21;
type Box={x:number;y:number;w:number;h:number};
type StoredParagraph={text:string;paragraphShape:number;runs:{char_shape_id:number;start_pos:number}[];lines:{text_start:number;tag:number}[]};

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
 const pageRuns=parsed(doc.getPageTextLayout(page)).runs.filter((r:any)=>r.secIdx===target.section&&r.parentParaIdx===target.paragraph&&
  r.cellPath?.at(-1)?.cellIndex===65534&&r.cellPath.at(-1).controlIndex===target.control&&same(r.cellPath.slice(0,-1),target.ancestors));
 const lines=owners[0].lines.map(line=>{
  const ordinal=line.captionOwner.captionOrdinal;
  const runs=(line.children??[]).map((child:any)=>{
   if(child.type!=='TextRun')throw fail();
   const b=child.bbox,hits=pageRuns.filter((r:any)=>r.cellPath.at(-1).cellParaIndex===ordinal&&r.text===child.text&&r.x===b.x&&r.y===b.y&&r.w===b.w&&r.h===b.h);
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
  if(p.text===''){
   const line=group[0],r=line.runs[0];
   if(group.length!==1||p.lines.length!==1||p.lines[0].text_start!==0||!Number.isSafeInteger(p.lines[0].tag)||(p.lines[0].tag&0x80000000)!==0||
      p.runs.length!==1||p.runs[0].start_pos!==0||
      line.runs.length!==1||r.text!==''||r.charStart!==0||!same(r.charX,[0])||
      r.charShapeId!==p.runs[0].char_shape_id||r.paraShapeId!==p.paragraphShape||
      !Number.isFinite(line.box.h+line.box.w+r.h+r.w)||line.box.h<=0||line.box.w<=0||r.h<=0||r.w<=0)throw fail();
   const hit=parsed(doc.hitTest(page,r.x+Math.min(1,r.w/2),r.y+r.h/2)),caret=hit?.cursorRect;
   const captionPath=[...t.ancestors,{controlIndex:t.control,cellIndex:65534,cellParaIndex:ordinal}];
   if(hit?.sectionIndex!==t.section||hit.parentParaIndex!==t.paragraph||!same(hit.cellPath,captionPath)||hit.charOffset!==0||
      caret?.pageIndex!==page||!near(caret.x,r.x)||!near(caret.y,r.y)||!near(caret.height,r.h))throw fail();
   const resolved=parsed(doc.getCursorRectByPath(t.section,t.paragraph,JSON.stringify(captionPath),0));
   if(resolved.pageIndex!==page||!near(resolved.x,r.x)||!near(resolved.y,r.y)||!near(resolved.height,r.h))throw fail();
   next++;
   continue;
  }
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
   positions.push(runX-x,runY-y);
   // Empty runs publish available line width, while their sole caret stays
   // at charX[0]. Top/bottom captions follow the target table's width.
   if(style.text===''&&!side)return {...style,w:style.w-box.w};
   return style;
  })};
 });
 return {page,positions,styles,origin:[x,y]};
}

export function readNestedAxisCaptions(doc:any,structure:Structure,target:NestedTable){
 if(typeof doc.getTableAxisCaptionEvidenceByPath!=='function'){
  const stories=parsed(doc.getDocumentStoryInformation()).paragraphs;
  if(stories.some((p:any)=>p.story==='caption'))throw fail();
  return {stored:[],drawing:null,portableDrawing:null};
 }
 const tables=[...structure.tables,...(structure.nestedTables??[])];
 const stored=tables.flatMap(t=>{
  const value=parsed(doc.getTableAxisCaptionEvidenceByPath(t.section,t.paragraph,tablePath(t)));
  if(value===null)return [];
  if(!['plain','paragraphs','complex'].includes(value?.kind))throw fail();
  return [{id:t.id,value}];
 });
 const caption=stored.find(c=>c.id===target.id)?.value;
 if(!caption)return {stored,drawing:null,portableDrawing:null};
 const paragraphs:StoredParagraph[]=caption.kind==='plain'?[caption]:caption.paragraphs;
 if(!Array.isArray(paragraphs))throw fail();
 const prefix='section/'+target.section+'/body/p/'+target.paragraph+
  target.ancestors.map(p=>'/control/'+p.controlIndex+'/cell/'+p.cellIndex+'/p/'+p.cellParaIndex).join('')+
  '/control/'+target.control+'/caption/p/';
 const stories=parsed(doc.getDocumentStoryInformation()).paragraphs.filter((p:any)=>p.story==='caption'&&p.path.startsWith(prefix));
 if(stories.length!==paragraphs.length||stories.some((s:any,i:number)=>s.path!==prefix+i||s.text!==paragraphs[i].text))throw fail();
 const boxes=(t:Table|NestedTable):any[]=>parsed(doc.getTableCellBboxesByPath(t.section,t.paragraph,tablePath(t)));
 const readDrawing=()=>{
  const siblings=tables.filter(t=>t.id!==target.id&&!target.id.startsWith(t.id+'c')).map(t=>{
   const cap=stored.find(c=>c.id===t.id)?.value;
   const drawing='ancestors' in t&&cap&&cap.kind!=='complex'?captionDrawing(doc,t,cap,boxes):null;
   return {id:t.id,boxes:boxes(t),drawing};
  });
  const {origin,...drawing}=captionDrawing(doc,target,caption,boxes);
  return {...drawing,siblings};
 };
 const drawing=readDrawing();
 if(doc.canvasMetricsActive?.()!==true)return {stored,drawing,portableDrawing:drawing};
 // The live view can use published Canvas widths. File constructors use
 // portable font metrics, so retain evidence under both measurement systems.
 try{
  doc.selectCanvasMetrics(false);
  if(doc.canvasMetricsActive()!==false)throw fail();
  return {stored,drawing,portableDrawing:readDrawing()};
 }finally{
  doc.selectCanvasMetrics(true);
  if(doc.canvasMetricsActive()!==true)throw fail();
 }
}

type Captions=ReturnType<typeof readNestedAxisCaptions>;
function sameDrawing(a:Captions['drawing'],b:Captions['drawing']){
 if(!a||!b)return a===b;
 return a.page===b.page&&a.positions.length===b.positions.length&&a.positions.every((v,i)=>near(v,b.positions[i]))&&same(a.styles,b.styles)&&same(a.siblings,b.siblings);
}

export function sameNestedCaptionPlacement(before:Captions,after:Captions){
 return same(before.stored,after.stored)&&sameDrawing(before.drawing,after.drawing)&&sameDrawing(before.portableDrawing,after.portableDrawing);
}

export function sameNestedCaptionRoundtrip(before:Captions,reopened:Captions){
 return same(before.stored,reopened.stored)&&same(before.portableDrawing,reopened.portableDrawing)&&same(reopened.drawing,reopened.portableDrawing);
}
