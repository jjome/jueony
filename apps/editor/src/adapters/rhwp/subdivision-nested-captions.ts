import type {Table} from '../../modules/document/public/index.ts';
import {parsed,readStructure} from './structure.ts';
import {readNestedAxisCaptions} from './nested-axis-captions.ts';
import {sameTableLayout} from './table-layout-evidence.ts';

type Path={controlIndex:number;cellIndex:number;cellParaIndex:number}[];
const fail=()=>Error('분할할 안쪽 표 캡션의 원문·서식·글줄·소유 경로를 확인하지 못했습니다.');

/** Caption sentinel paths are accepted only after independent stored/rendered proof.
 * The axis reader checks native paragraph runs, story paths, render-tree owners,
 * and portable/live metrics. Subdivision also retains every absolute ink box. */
export function subdivisionNestedCaptions(doc:any,table:Table,paths:Path[],page:number,runs:any[]){
  const captionRuns=runs.filter(r=>r.cellPath?.at(-1)?.cellIndex===65534);
  if(typeof doc.getTableAxisCaptionEvidenceByPath!=='function'){
    if(captionRuns.length || parsed(doc.getDocumentStoryInformation()).paragraphs.some((p:any)=>p.story==='caption'))throw fail();
    return [];
  }
  const owners=paths.flatMap(path=>{
    const encoded=JSON.stringify([...path,{controlIndex:0,cellIndex:0,cellParaIndex:0}]);
    const stored=parsed(doc.getTableAxisCaptionEvidenceByPath(table.section,table.paragraph,encoded));
    if(stored===null)return [];
    if(!['plain','paragraphs'].includes(stored?.kind))throw fail();
    return [{path,stored}];
  });
  if(!owners.length){if(captionRuns.length)throw fail();return [];}
  const structure=readStructure(doc);
  const result=owners.map(({path,stored})=>{
    const matches=structure.nestedTables?.filter(t=>t.section===table.section && t.paragraph===table.paragraph &&
      t.control===0 && sameTableLayout(t.ancestors,path)) ?? [];
    if(matches.length!==1)throw fail();
    const target=matches[0],evidence=readNestedAxisCaptions(doc,structure,target);
    if(!sameTableLayout(evidence.stored.find(c=>c.id===target.id)?.value,stored) ||
        evidence.drawing?.page!==page || evidence.portableDrawing?.page!==page)throw fail();
    const lines=captionRuns.filter(r=>r.secIdx===table.section && r.parentParaIdx===table.paragraph &&
      r.cellPath.at(-1).controlIndex===0 && sameTableLayout(r.cellPath.slice(0,-1),path));
    if(!lines.length)throw fail();
    return {path,evidence,lines:lines.map(r=>r.text ? r : {...r,w:0})};
  });
  if(result.reduce((n,c)=>n+c.lines.length,0)!==captionRuns.length)throw fail();
  return result;
}
