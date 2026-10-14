import type {Table} from '../../modules/document/public/index.ts';
import {parsed} from './structure.ts';
export function tableLayoutEvidence(d:any,t:Table):unknown[] {
 const result:unknown[]=[];const count=d.pageCount();if(!Number.isSafeInteger(count)||count<1)throw new Error('셀 안 여백의 실제 배치를 확인하지 못했습니다.');
 for(let page=0;page<count;page++){
  const controls=parsed(d.getPageControlLayout(page)).controls,runs=parsed(d.getPageTextLayout(page)).runs;
  if(!Array.isArray(controls)||!Array.isArray(runs))throw new Error('셀 안 여백의 실제 셀/글줄 배치를 읽지 못했습니다.');
  for(const c of controls.filter((c:any)=>c.type==='table'&&c.secIdx===t.section&&c.paraIdx===t.paragraph&&c.controlIdx===t.control)){
   if(!Array.isArray(c.cells)||[c,...c.cells].some((v:any)=>!['x','y','w','h'].every(k=>Number.isFinite(v[k]))||v.w<=0||v.h<=0))throw new Error('셀 안 여백의 실제 사각형 배치를 읽지 못했습니다.');
   result.push({page,x:c.x,y:c.y,w:c.w,h:c.h,cells:c.cells.map((v:any)=>({index:v.cellIdx,row:v.row,column:v.col,x:v.x,y:v.y,w:v.w,h:v.h}))});
  }
  for(const r of runs.filter((r:any)=>r.secIdx===t.section&&r.parentParaIdx===t.paragraph&&r.controlIdx===t.control)){if(!['x','y','w','h'].every(k=>Number.isFinite(r[k]))||r.h<=0||r.w<0)throw new Error('셀 안 여백의 실제 글줄 배치를 읽지 못했습니다.');result.push({page,cell:r.cellIdx,paragraph:r.cellParaIdx,start:r.charStart,text:r.text,x:r.x,y:r.y,w:r.w,h:r.h});}
 }
 if(!result.length)throw new Error('셀 안 여백 대상의 실제 배치가 없습니다.');return result;
}
export function sameTableLayout(a:any,b:any):boolean {
 if(typeof a==='number'&&typeof b==='number')return Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=0.2;
 if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>sameTableLayout(v,b[i]));
 if(a&&b&&typeof a==='object'&&typeof b==='object')return Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(k=>Object.hasOwn(b,k)&&sameTableLayout(a[k],b[k]));
 return a===b;
}

