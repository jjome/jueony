import type {NestedTable,Structure,Table} from '../../modules/document/public/types.ts';
import {parsed} from './structure.ts';

const fail=()=>Error('중첩 표 캡션의 소유 경로·글자 서식 또는 배치를 확인하지 못했습니다.');
const tablePath=(t:Table|NestedTable)=>JSON.stringify([...('ancestors' in t?t.ancestors:[]),{controlIndex:t.control,cellIndex:0,cellParaIndex:0}]);

function paintedCaptionRuns(doc:any,target:NestedTable,page:number,left:number,top:number){
 const hostParagraph=target.ancestors.at(-1)!.cellParaIndex,owners:any[]=[];
 function visit(parent:any){
  const children=parent.children??[];
  if(children.some((n:any)=>n.type==='Table'&&n.pi===hostParagraph&&n.ci===target.control&&
     Math.abs(n.bbox.x-left)<=.11&&Math.abs(n.bbox.y-top)<=.11)){
   const lines=children.filter((n:any)=>n.type==='TextLine'&&n.captionOwner?.controlKind==='table'&&
    n.captionOwner.secIdx===target.section&&n.captionOwner.paraIdx===hostParagraph&&n.captionOwner.controlIdx===target.control);
   if(lines.length!==1)throw fail();
   owners.push(lines[0]);
  }
  for(const child of children)visit(child);
 }
 visit(parsed(doc.getPageRenderTree(page)));
 if(owners.length!==1)throw fail();
 const pageRuns=parsed(doc.getPageTextLayout(page)).runs;
 return (owners[0].children??[]).map((child:any)=>{
  if(child.type!=='TextRun')throw fail();
  const hits=pageRuns.filter((r:any)=>r.cellIdx===65534&&child.text===r.text&&
   r.x===child.bbox.x&&r.y===child.bbox.y&&r.w===child.bbox.w&&r.h===child.bbox.h);
  if(hits.length!==1)throw fail();
  return hits[0];
 });
}

/** The caption text stream alone cannot distinguish two sibling tables.
 * Bind stored properties to the model address and the painted line to its table. */
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
  if(value?.kind!=='plain'&&value?.kind!=='complex')throw fail();
  return [{id:t.id,value}];
 });
 const caption=stored.find(c=>c.id===target.id)?.value;
 if(!caption)return {stored,drawing:null};
 // A single visible line must have an unambiguous caption owner. Other caption
 // paragraphs on the same page can share the renderer's synthetic cell index.
 if(caption.kind!=='plain')throw fail();
 const prefix='section/'+target.section+'/body/p/'+target.paragraph+
  target.ancestors.map(p=>'/control/'+p.controlIndex+'/cell/'+p.cellIndex+'/p/'+p.cellParaIndex).join('')+
  '/control/'+target.control+'/caption/p/';
 const paragraphs=parsed(doc.getDocumentStoryInformation()).paragraphs.filter((p:any)=>p.story==='caption'&&p.path.startsWith(prefix));
 if(paragraphs.length!==1||paragraphs[0].path!==prefix+'0'||paragraphs[0].text!==caption.text)throw fail();
 const boxes=(t:Table|NestedTable):any[]=>parsed(doc.getTableCellBboxesByPath(t.section,t.paragraph,tablePath(t)));
 const cells=boxes(target);
 if(!cells.length||cells.length!==target.cells.length||cells.some(c=>c.pageIndex!==cells[0].pageIndex||!Number.isFinite(c.y+c.h+c.x)))throw fail();
 const page=cells[0].pageIndex,left=Math.min(...cells.map(c=>c.x)),top=Math.min(...cells.map(c=>c.y)),bottom=Math.max(...cells.map(c=>c.y+c.h));
 const runs=paintedCaptionRuns(doc,target,page,left,top);
 if(!runs.length||runs.map((r:any)=>r.text).join('')!==caption.text||runs.some((r:any)=>r.y!==runs[0].y||r.h!==runs[0].h)||
    runs.length!==caption.runs.length||runs.some((r:any,i:number)=>r.charShapeId!==caption.runs[i].char_shape_id||r.charStart!==caption.runs[i].start_pos))throw fail();
 const gap=caption.direction==='Bottom'?runs[0].y-bottom:top-runs[0].y-runs[0].h;
 if(!Number.isFinite(gap)||gap<-.2)throw fail();
 const siblings=tables.filter(t=>t.id!==target.id&&!target.id.startsWith(t.id+'c')).map(t=>({id:t.id,boxes:boxes(t)}));
 const styles=runs.map(({x,y,cellPath,...rest}:any)=>rest);
 return {stored,drawing:{page,gap,inset:runs[0].x-left,styles,siblings}};
}

export function sameNestedCaptionPlacement(before:ReturnType<typeof readNestedAxisCaptions>,after:ReturnType<typeof readNestedAxisCaptions>){
 if(JSON.stringify(before.stored)!==JSON.stringify(after.stored))return false;
 const a=before.drawing,b=after.drawing;
 if(!a||!b)return a===b;
 return a.page===b.page&&Math.abs(a.gap-b.gap)<=0.21&&Math.abs(a.inset-b.inset)<=0.21&&
  JSON.stringify(a.styles)===JSON.stringify(b.styles)&&JSON.stringify(a.siblings)===JSON.stringify(b.siblings);
}
