import {sha256} from '@noble/hashes/sha2.js';
import type {AgentTableSubdivisionSource,Table} from '../../modules/document/public/index.ts';
import {parsed} from './structure.ts';

type Frame=NonNullable<AgentTableSubdivisionSource['frame']>;
const invalid=()=>new Error('분할할 표의 쪽별 글줄과 원본 셀·문단의 범위를 확인하지 못했습니다.');

/** The text renderer exposes original cell indices even when the rectangle list
 * on each continuation page starts at zero. Require every rendered character
 * to agree with the native paragraph at that offset, in page order. */
export function verifyFragmentLines(doc:any, table:Table, frames:Frame[]) {
  const previous=new Map<string,{end:number;page:number;y:number}>();
  const counts=table.cells.map(c=>doc.getCellParagraphCount(table.section,table.paragraph,table.control,c.index));
  for (const frame of frames) {
    const owners=new Map(frame.cells.map(c=>[c.index,c]));
    const lines=new Map<number,unknown[][]>();
    const runs=parsed(doc.getPageTextLayout(frame.page)).runs;
    if (!Array.isArray(runs)) throw invalid();
    for (const r of runs) {
      if (r.secIdx!==table.section || r.parentParaIdx!==table.paragraph || r.controlIdx!==table.control) continue;
      const cell=owners.get(r.cellIdx);
      if (!cell || !Number.isSafeInteger(r.cellParaIdx) || r.cellParaIdx<0 || r.cellParaIdx>=counts[cell.index]
          || typeof r.text!=='string' || ![r.x,r.y,r.w,r.h].every(Number.isFinite) || r.h<=0 || r.w<0) throw invalid();
      const key=cell.index+'/'+r.cellParaIdx, prior=previous.get(key), end=prior?.end??0;
      const args=[table.section,table.paragraph,table.control,cell.index,r.cellParaIdx] as const;
      const start=r.charStart, length=Array.from(r.text).length;
      // A stored hard line break occupies one native character and paints no
      // glyph. Accept that gap only at a confirmed physical line transition.
      const hardBreak=prior && start===end+1 && (frame.page>prior.page || r.y>prior.y+0.2)
        && doc.getTextInCell(...args,end,1)==='\n';
      if (start!==end && !hardBreak || doc.getTextInCell(...args,start,length)!==r.text
          || r.x<cell.x-0.2 || r.x+r.w>cell.x+cell.w+0.2 || r.y<cell.y-0.2 || r.y+r.h>cell.y+cell.h+0.2) throw invalid();
      previous.set(key,{end:start+length,page:frame.page,y:r.y});
      const list=lines.get(cell.index)??[];
      list.push([r.cellParaIdx,start,r.text,r.x,r.y,r.w,r.h]);
      lines.set(cell.index,list);
    }
    for (const c of frame.cells) {
      const bytes=sha256(new TextEncoder().encode(JSON.stringify(lines.get(c.index)??[])));
      c.lineSignature=Array.from(bytes,n=>n.toString(16).padStart(2,'0')).join('');
    }
  }
  for (const c of table.cells) for (let p=0;p<counts[c.index];p++) {
    if ((previous.get(c.index+'/'+p)?.end??0)!==doc.getCellParagraphLength(table.section,table.paragraph,table.control,c.index,p))
      throw invalid();
  }
}
