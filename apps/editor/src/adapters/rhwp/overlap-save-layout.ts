type Native = any;
type Target = {section:number;paragraph:number;control:number};
export type OverlapSaveLayoutReport = {status:'checked'|'not-applicable';targets:number;pages?:number};
export class OverlapSaveLayoutError extends Error {
 readonly code:'changed'|'unreadable'|'limit';
 constructor(code:'changed'|'unreadable'|'limit',detail:string){super(`HWP 겹침 표의 저장 재열기 배치를 확인하지 못했습니다. 원본 파일은 쓰지 않습니다 (${detail}).`);this.name='OverlapSaveLayoutError';this.code=code;}
}
const fail=(code:'changed'|'unreadable'|'limit',detail:string):never=>{throw new OverlapSaveLayoutError(code,detail);};
const native=(value:Native):Native=>value?.borrowDocumentHandle?.()??value;
const json=(value:any):any=>typeof value==='string'?JSON.parse(value):value;
const index=(value:any):boolean=>Number.isSafeInteger(value)&&value>=0;
function targets(d:Native):Target[]{
 // Unknown provenance is not evidence that this narrowly scoped rule applies.
 // In particular it must not block unrelated minimal preservation-test readers.
 if(typeof d?.getSourceFormat!=='function'||typeof d?.getDocumentInfo!=='function')return [];
 let info:any,format:any;try{format=d.getSourceFormat();info=json(d.getDocumentInfo());}catch{return [];}
 if(info?.hwp3Variant!==false)return [];
 if(format==='hwp'){
  if(typeof info.version!=='string'||!info.version.startsWith('5.'))return [];
 }else if(format!=='hwpx'||info.hwp5OriginHwpx!==true)return [];
 if(typeof d.getControls!=='function')return [];
 let controls:any;try{controls=json(d.getControls());}catch{return [];}
 if(!Array.isArray(controls))return [];
 const roots=controls.filter((c:any)=>c?.ctrlId==='tbl'&&c.list===0);
 const following=roots.filter((c:any)=>index(c.para)&&c.para>0&&roots.some((p:any)=>p.para===c.para-1));
 if(!following.length)return [];
 try{
  const sections=d.getSectionCount();if(!index(sections)||sections>200)fail('limit','구역 조회 한도');
  const positions:Target[]=[];
  for(let section=0;section<sections;section++){const count=d.getParagraphCount(section);if(!index(count)||count+positions.length>10000)fail('limit','본문 조회 한도');for(let paragraph=0;paragraph<count;paragraph++)positions.push({section,paragraph,control:0});}
  const result:Target[]=[];
  for(const c of following){const at=positions[c.para],previous=positions[c.para-1];if(!at||!previous||!index(c.controlIndex))fail('unreadable','후속 표 주소');if(at.section!==previous.section)continue;
   if(roots.filter((p:any)=>p.para===c.para&&p.controlIndex===c.controlIndex).length!==1)fail('unreadable','중복 표 주소');
   const properties=json(d.getTableProperties(at.section,at.paragraph,c.controlIndex));if(typeof properties?.allowOverlap!=='boolean')fail('unreadable','겹침 허용 속성');
   if(properties.allowOverlap)result.push({...at,control:c.controlIndex});
  }
  return result;
 }catch(e){if(e instanceof OverlapSaveLayoutError)throw e;return fail('unreadable','후속 표 조회');}
}
function finiteJson(v:any,budget:{nodes:number}):void {
 if(++budget.nodes>100000)fail('limit','배치 항목 한도');
 if(typeof v==='number'){if(!Number.isFinite(v))fail('unreadable','유한하지 않은 배치');return;}
 if(v===null||typeof v==='string'||typeof v==='boolean')return;
 if(Array.isArray(v)){for(const item of v)finiteJson(item,budget);return;}
 if(v&&typeof v==='object'){for(const item of Object.values(v))finiteJson(item,budget);return;}
 fail('unreadable','배치 JSON');
}
function geometry(d:Native,expected:Target[]):any[]{
 const count=d.pageCount();if(!index(count)||count<1||count>200)fail('limit','쪽 조회 한도');
 const pages:any[]=[],seen=new Set<string>(),budget={nodes:0};let bytes=0;
 for(let page=0;page<count;page++){
  const controls=json(d.getPageControlLayout(page))?.controls,runs=json(d.getPageTextLayout(page))?.runs;
  if(!Array.isArray(controls)||!Array.isArray(runs))fail('unreadable','표·글줄 배치 배열');
  const value={controls,runs};finiteJson(value,budget);bytes+=JSON.stringify(value).length;if(bytes>8*1024*1024)fail('limit','배치 자료 한도');
  for(const c of controls){if(!c||!['x','y','w','h'].every(k=>typeof c[k]==='number'&&Number.isFinite(c[k]))||c.w<0||c.h<0)fail('unreadable','개체 사각형');
   if(c.type==='table'){if(!Array.isArray(c.cells)||!c.cells.length||c.w<=0||c.h<=0)fail('unreadable','표 셀 사각형');for(const cell of c.cells)if(!cell||!['x','y','w','h'].every(k=>typeof cell[k]==='number'&&Number.isFinite(cell[k]))||cell.w<=0||cell.h<=0)fail('unreadable','표 셀 배치');
    for(const t of expected)if(c.secIdx===t.section&&c.paraIdx===t.paragraph&&c.controlIdx===t.control)seen.add(`${t.section}/${t.paragraph}/${t.control}`);
   }
  }
  for(const r of runs)if(!r||typeof r.text!=='string'||!['x','y','w','h'].every(k=>typeof r[k]==='number'&&Number.isFinite(r[k]))||r.w<0||r.h<=0)fail('unreadable','본문·셀 글줄 사각형');
  pages.push(value);
 }
 if(seen.size!==expected.length)fail('unreadable','후속 표의 실제 배치 누락');
 return pages;
}
function same(a:any,b:any):boolean {
 if(typeof a==='number'&&typeof b==='number')return Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=0.2;
 if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>same(v,b[i]));
 if(a&&b&&typeof a==='object')return Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(k=>Object.hasOwn(b,k)&&same(a[k],b[k]));
 return a===b;
}
/** A fail-closed check for known native-HWP5 or explicitly marked HWP5-origin
 * HWPX adjacent overlapping tables. It compares raw public layout without projecting,
 * rounding, rebasing, substituting or normalizing any returned geometry.
 * It does not claim general document-format or Hancom layout equivalence. */
export function assertOverlapSaveLayout(source:Native,bytes:Uint8Array,format:string,reopen:(bytes:Uint8Array)=>Native):OverlapSaveLayoutReport {
 if(format!=='hwp'&&format!=='hwpx')return {status:'not-applicable',targets:0};
 const d=native(source),expected=targets(d);if(!expected.length)return {status:'not-applicable',targets:0};
 let restore=false,r:Native;
 try{
  if(typeof d.canvasMetricsActive!=='function')fail('unreadable','글꼴 측정 환경');const active=d.canvasMetricsActive();if(typeof active!=='boolean')fail('unreadable','글꼴 측정 상태');
  restore=active;if(active)d.selectCanvasMetrics(false);if(d.canvasMetricsActive()!==false)fail('unreadable','portable 측정 선택');
  const before=geometry(d,expected);r=reopen(bytes);const reopened=native(r);if(typeof reopened.canvasMetricsActive!=='function'||reopened.canvasMetricsActive()!==false)fail('unreadable','재열기 portable 측정');
  const after=geometry(reopened,expected);if(!same(before,after))fail('changed','저장 전후 표·본문 배치 차이');return {status:'checked',targets:expected.length,pages:before.length};
 }catch(e){if(e instanceof OverlapSaveLayoutError)throw e;return fail('unreadable','portable 배치 조회');}
 finally{try{r?.free?.();}finally{if(restore){d.selectCanvasMetrics(true);if(d.canvasMetricsActive()!==true)fail('unreadable','화면 측정 환경 복원');}}}
}
