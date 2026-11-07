import type {AgentTableSubdivisionSource,Table} from '../../modules/document/public/index.ts';
import {parsed} from './structure.ts';
import {sameTableLayout} from './table-layout-evidence.ts';

type Frame=NonNullable<AgentTableSubdivisionSource['frame']>;
const geometry=(v:{x:number;y:number;w:number;h:number}) => ({x:v.x,y:v.y,w:v.w,h:v.h});

/** Continuation-page renderer indices restart at zero. Use the stored grid
 * address to identify a cell and require its full rectangle on exactly one page. */
export function subdivisionFrames(doc:any, table:Table, properties:any):Frame[] {
  const frames:Frame[]=[], seen=new Set<number>();
  const byAddress=new Map(table.cells.map(cell=>[cell.row+','+cell.column,cell]));
  for (let page=0; page<doc.pageCount(); page++) {
    const controls=parsed(doc.getPageControlLayout(page)).controls.filter((c:any)=>
      c.type==='table' && c.secIdx===table.section && c.paraIdx===table.paragraph && c.controlIdx===table.control);
    if (!controls.length) continue;
    const f=controls[0], paper=parsed(doc.getPageInfo(page));
    if (controls.length!==1 || !Array.isArray(f.cells) || !f.cells.length
        || ![f.x,f.y,f.w,f.h,paper.width,paper.height].every(Number.isFinite)
        || f.h<=0 || !sameTableLayout(f.w,properties.tableWidth/75) || f.x<0 || f.y<0
        || f.x+f.w>paper.width+0.2 || f.y+f.h>paper.height+0.2) throw Error('쪽 안의 표 외곽을 확인하지 못했습니다.');
    const cells=f.cells.map((v:any)=>{
      const cell=byAddress.get(v.row+','+v.col);
      if (!cell || seen.has(cell.index) || cell.rowSpan!==v.rowSpan || cell.columnSpan!==v.colSpan
          || ![v.x,v.y,v.w,v.h].every(Number.isFinite)
          || !sameTableLayout(v.w,Number(cell.properties.width)/75) || !sameTableLayout(v.h,Number(cell.properties.height)/75)
          || v.x<f.x-0.2 || v.y<f.y-0.2 || v.x+v.w>f.x+f.w+0.2 || v.y+v.h>f.y+f.h+0.2)
        throw Error('셀 전체의 쪽과 원본 행·열을 확인하지 못했습니다.');
      seen.add(cell.index);
      return {...geometry(v), index:cell.index, row:cell.row, column:cell.column};
    });
    frames.push({...geometry(f),page,cells});
  }
  if (!frames.length || seen.size!==table.cells.length
      || frames.length===1 && !sameTableLayout(frames[0].h,properties.tableHeight/75))
    throw Error('표의 전체 셀과 원래 높이를 확인하지 못했습니다.');
  return frames;
}

export function compareSubdivisionFrames(before:Frame[], after:Frame[], cells:Array<{index:number;originIndex:number|null}>, primary:number) {
  if (!sameTableLayout(before.map(f=>({...geometry(f),page:f.page})),after.map(f=>({...geometry(f),page:f.page}))))
    throw Error('내용의 최소 크기 때문에 기존 표 외형이나 쪽이 달라졌습니다. 원본을 유지합니다.');
  const positions=(frames:Frame[])=>new Map(frames.flatMap(f=>f.cells.map(c=>[c.index,{page:f.page,...geometry(c)}] as const)));
  const old=positions(before), current=positions(after);
  for (const c of cells) if (c.originIndex!==null && c.originIndex!==primary && !sameTableLayout(old.get(c.originIndex),current.get(c.index)))
    throw Error('임의 분할 뒤 이웃 셀의 쪽·위치·크기가 달라졌습니다.');
  const original=old.get(primary);
  if (!original) throw Error('분할할 원본 셀의 실제 배치를 확인하지 못했습니다.');
  return {original,current};
}
