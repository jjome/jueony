import type {AgentTableSubdivisionSource,Table} from '../../modules/document/public/index.ts';
import {parsed} from './structure.ts';
import {sameTableLayout} from './table-layout-evidence.ts';
import {verifyFragmentLines} from './subdivision-fragment-lines.ts';

type Frame=NonNullable<AgentTableSubdivisionSource['frame']>;
const geometry=(v:{x:number;y:number;w:number;h:number}) => ({x:v.x,y:v.y,w:v.w,h:v.h});

/** Each page restarts its visual cell indices. A stored grid address identifies
 * its owner, including when one owner has rectangles on several pages. */
export function subdivisionFrames(doc:any, table:Table, properties:any, withLines=false, fromFragmentedOwner?:Set<number>):Frame[] {
  const frames:Frame[]=[], lastPage=new Map<number,number>(), fragmented=new Set<number>();
  const byAddress=new Map(table.cells.map(cell=>[cell.row+','+cell.column,cell]));
  for (let page=0; page<doc.pageCount(); page++) {
    const controls=parsed(doc.getPageControlLayout(page)).controls.filter((c:any)=>
      c.type==='table' && (!c.stableIndex || c.stableIndex.length===3) && c.secIdx===table.section && c.paraIdx===table.paragraph && c.controlIdx===table.control);
    if (!controls.length) continue;
    const f=controls[0], paper=parsed(doc.getPageInfo(page));
    if (controls.length!==1 || !Array.isArray(f.cells) || !f.cells.length
        || ![f.x,f.y,f.w,f.h,paper.width,paper.height].every(Number.isFinite)
        || f.h<=0 || !sameTableLayout(f.w,properties.tableWidth/75) || f.x<0 || f.y<0
        || f.x+f.w>paper.width+0.2 || f.y+f.h>paper.height+0.2) throw Error('쪽 안의 표 외곽을 확인하지 못했습니다.');
    const cells=f.cells.map((v:any)=>{
      const cell=byAddress.get(v.row+','+v.col);
      if (!cell || cell.rowSpan!==v.rowSpan || cell.columnSpan!==v.colSpan
          || ![v.x,v.y,v.w,v.h].every(Number.isFinite)
          || !sameTableLayout(v.w,Number(cell.properties.width)/75) || v.h<=0
          || v.x<f.x-0.2 || v.y<f.y-0.2 || v.x+v.w>f.x+f.w+0.2 || v.y+v.h>f.y+f.h+0.2)
        throw Error('셀 전체의 쪽과 원본 행·열을 확인하지 못했습니다.');
      const previous=lastPage.get(cell.index);
      if (previous!==undefined) {
        if (properties.pageBreak!==1 || previous!==page-1) throw Error('원본 셀의 쪽 경계가 연속되지 않습니다.');
        fragmented.add(cell.index);
      }
      lastPage.set(cell.index,page);
      return {...geometry(v), index:cell.index, row:cell.row, column:cell.column};
    });
    frames.push({...geometry(f),page,cells});
  }
  if (!frames.length || lastPage.size!==table.cells.length
      || frames.length===1 && !sameTableLayout(frames[0].h,properties.tableHeight/75))
    throw Error('표의 전체 셀과 원래 높이를 확인하지 못했습니다.');
  for (const f of frames) for (const c of f.cells) {
    // A new vertical band may fit one page even when its original cell did
    // not. Its measured height is checked against the original fragments.
    if (!fragmented.has(c.index) && !fromFragmentedOwner?.has(c.index) && !sameTableLayout(c.h,Number(table.cells[c.index].properties.height)/75))
      throw Error('셀의 실제 높이가 원래 높이와 다릅니다.');
  }
  if (fragmented.size || withLines) verifyFragmentLines(doc,table,frames);
  return frames;
}

type Piece={page:number;x:number;y:number;w:number;h:number;lineSignature?:string};
function positions(frames:Frame[]) {
  const byCell=new Map<number,Piece[]>();
  for (const f of frames) for (const c of f.cells) {
    const pieces=byCell.get(c.index)??[];
    pieces.push({page:f.page,...geometry(c),lineSignature:c.lineSignature});
    byCell.set(c.index,pieces);
  }
  return byCell;
}

export function compareSubdivisionFrames(before:Frame[], after:Frame[], cells:Array<{index:number;originIndex:number|null}>, primary:number) {
  if (!sameTableLayout(before.map(f=>({...geometry(f),page:f.page})),after.map(f=>({...geometry(f),page:f.page}))))
    throw Error('내용의 최소 크기 때문에 기존 표 외형이나 쪽이 달라졌습니다. 원본을 유지합니다.');
  const old=positions(before), current=positions(after);
  for (const c of cells) if (c.originIndex!==null && c.originIndex!==primary && !sameTableLayout(old.get(c.originIndex),current.get(c.index)))
    throw Error('임의 분할 뒤 이웃 셀의 쪽·위치·크기가 달라졌습니다.');
  const original=old.get(primary);
  if (!original) throw Error('분할할 원본 셀의 실제 배치를 확인하지 못했습니다.');
  return {original,current};
}

/** Intersect each requested row band with the original visible fragments.
 * A page break contributes no height to the physical area being divided. */
export function compareDividedPieces(before:Piece[], after:Piece[]|undefined,
    widths:number[], heights:number[], column:number, row:number) {
  const sum=(a:number[])=>a.reduce((x,y)=>x+y,0);
  const x0=sum(widths.slice(0,column))/sum(widths), x1=sum(widths.slice(0,column+1))/sum(widths);
  const height=sum(before.map(v=>v.h));
  const y0=height*sum(heights.slice(0,row))/sum(heights), y1=height*sum(heights.slice(0,row+1))/sum(heights);
  const expected=[];
  let top=0;
  for (const piece of before) {
    const start=Math.max(y0,top), end=Math.min(y1,top+piece.h);
    if (end-start>1e-6) expected.push({page:piece.page,x:piece.x+x0*piece.w,y:piece.y+start-top,w:(x1-x0)*piece.w,h:end-start});
    top+=piece.h;
  }
  if (!after || !sameTableLayout(after.map(v=>({page:v.page,...geometry(v)})),expected))
    throw Error('새 셀의 쪽별 실제 크기·위치가 원본 영역 분배와 다릅니다.');
}
