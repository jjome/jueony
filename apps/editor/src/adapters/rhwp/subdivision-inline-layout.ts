import type {Table,Cell} from '../../modules/document/public/index.ts';
import {parsed} from './structure.ts';
import {sameTableLayout} from './table-layout-evidence.ts';

const invalid=()=>Error('분할한 누름틀의 원래 범위·안내문·셀 안 글줄 위치를 확인하지 못했습니다.');

/** The guide painter emits a synthetic run without secIdx/charStart, next to
 * a real zero-width anchor. Bind it to a verified field before comparing it. */
export function inlineSubdivisionLayout(doc:any,t:Table,c:Cell,firstParagraphOnly:boolean) {
  const fields=parsed(doc.getFieldList()).filter((f:any)=>!f.cellField && f.location?.sectionIndex===t.section &&
    f.location?.paraIndex===t.paragraph && f.location.path?.length===1 && f.location.path[0].controlIndex===t.control &&
    f.location.path[0].cellIndex===c.index);
  if(!fields.length || firstParagraphOnly && fields.some((f:any)=>f.paraInList!==0))throw invalid();
  const guides=fields.filter((f:any)=>parsed(doc.getFieldInfoAtInCell(t.section,t.paragraph,t.control,c.index,f.paraInList,f.startCharIdx,false)).isGuide===true);
  const seen=new Set<number>(),evidence=[];
  for(let page=0;page<doc.pageCount();page++){
    const frame=parsed(doc.getPageControlLayout(page)).controls.find((v:any)=>v.type==='table' &&
      v.secIdx===t.section && v.paraIdx===t.paragraph && v.controlIdx===t.control);
    const box=frame?.cells.find((v:any)=>v.row===c.row && v.col===c.column);
    const runs=parsed(doc.getPageTextLayout(page)).runs;
    let origin:{x:number;y:number}|undefined;
    for(const [i,r] of runs.entries()){
      if(r.parentParaIdx!==t.paragraph || r.controlIdx!==t.control || r.cellIdx!==c.index ||
          r.secIdx!==undefined && r.secIdx!==t.section || firstParagraphOnly && r.cellParaIdx!==0)continue;
      if(!box || ![r.x,r.y,r.w,r.h].every(Number.isFinite) || r.x<box.x-0.2 || r.x+r.w>box.x+box.w+0.2 ||
          r.y<box.y-0.2 || r.y+r.h>box.y+box.h+0.2 || r.w<0 || r.h<=0)throw invalid();
      const step=r.cellPath?.[0];
      if(r.cellPath?.length!==1 || step.controlIndex!==t.control || step.cellIndex!==c.index ||
          step.cellParaIndex!==r.cellParaIdx || !Array.isArray(r.charX) || !r.charX.every(Number.isFinite))throw invalid();
      if(r.secIdx===undefined || r.charStart===undefined){
        const anchor=runs[i-1];
        const guide=guides.find((f:any)=>f.paraInList===r.cellParaIdx && f.guide===r.text && f.startCharIdx===anchor?.charStart);
        if(!guide || seen.has(guide.fieldId) || anchor.secIdx!==t.section || anchor.parentParaIdx!==t.paragraph ||
            anchor.controlIdx!==t.control || anchor.cellIdx!==c.index || anchor.cellParaIdx!==r.cellParaIdx ||
            anchor.text!=='' || anchor.w!==0 || !sameTableLayout([anchor.x,anchor.y,anchor.h],[r.x,r.y,r.h]))throw invalid();
        seen.add(guide.fieldId);
      }
      origin??={x:r.x,y:r.y};
      const {cellIdx,cellPath,x,y,...detail}=r;
      evidence.push({page,...detail,x:x-origin.x,y:y-origin.y});
    }
  }
  if(seen.size!==guides.length)throw invalid();
  return evidence;
}
