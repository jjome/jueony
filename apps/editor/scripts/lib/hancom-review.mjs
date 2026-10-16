import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,isAbsolute,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {capturePreservationEvidence} from '../../src/adapters/rhwp/preservation.ts';

export const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function absolutePath(value,label){if(typeof value!=='string'||!isAbsolute(value))throw Error(label+' must be an absolute path');return resolve(value);}
export async function loadReviewEngine(path){
 const pkg=absolutePath(path,'engine'),metadata=JSON.parse(await readFile(join(pkg,'jueony-engine-build.json'),'utf8'));
 const wasm=await readFile(join(pkg,'rhwp_bg.wasm')),javascript=await readFile(join(pkg,'rhwp.js'));
 if(hash(wasm)!==metadata.wasmSha256||hash(javascript)!==metadata.jsSha256)throw Error('Engine bytes do not match recorded metadata');
 const module=await import(pathToFileURL(join(pkg,'rhwp.js')));await module.default({module_or_path:wasm});
 return {pkg,metadata,HwpDocument:module.HwpDocument};
}
export function snapshot(doc){
 const pages=doc.pageCount();if(!Number.isSafeInteger(pages)||pages<1||pages>1000)throw Error('Invalid page count or review size limit');
 const json=value=>typeof value==='string'?JSON.parse(value):value;
 const layout=Array.from({length:pages},(_,page)=>({page,controls:json(doc.getPageControlLayout(page)),text:json(doc.getPageTextLayout(page))}));
 const semantic=capturePreservationEvidence(doc);
 const result={sourceFormat:doc.getSourceFormat(),pages,semantic,layout};
 if(JSON.stringify(result).length>64*1024*1024)throw Error('Review snapshot exceeds 64 MiB; no partial snapshot written');
 return result;
}
/** Full structural diff. No projection, rounding, rebasing, skipped fields or truncation. */
export function differences(before,after,tolerance=0,path='$',result=[]){
 if(typeof before==='number'&&typeof after==='number'){
  if(!Number.isFinite(before)||!Number.isFinite(after)||Math.abs(before-after)>tolerance)result.push({path,before,after,...(Number.isFinite(before)&&Number.isFinite(after)?{delta:after-before}:{})});
  return result;
 }
 if(Array.isArray(before)||Array.isArray(after)){
  if(!Array.isArray(before)||!Array.isArray(after)){result.push({path,before,after,kind:'type'});return result;}
  if(before.length!==after.length)result.push({path:path+'.length',before:before.length,after:after.length,kind:'array-length'});
  for(let i=0;i<Math.max(before.length,after.length);i++){
   if(i>=before.length)result.push({path:`${path}[${i}]`,after:after[i],kind:'added'});
   else if(i>=after.length)result.push({path:`${path}[${i}]`,before:before[i],kind:'removed'});
   else differences(before[i],after[i],tolerance,`${path}[${i}]`,result);
  }
  return result;
 }
 if(before!==null&&after!==null&&typeof before==='object'&&typeof after==='object'){
  for(const key of [...new Set([...Object.keys(before),...Object.keys(after)])].sort()){
   const next=path+'['+JSON.stringify(key)+']';
   if(!Object.hasOwn(before,key))result.push({path:next,after:after[key],kind:'added'});
   else if(!Object.hasOwn(after,key))result.push({path:next,before:before[key],kind:'removed'});
   else differences(before[key],after[key],tolerance,next,result);
  }
 }else if(before!==after)result.push({path,before,after,kind:typeof before===typeof after?'value':'type'});
 return result;
}
export function compareSnapshots(before,after){
 const semantics=differences(before.semantic.values,after.semantic.values,0),geometry=differences(before.layout,after.layout,0.2),issues={before:before.semantic.issues,after:after.semantic.issues};
 return {status:semantics.length||geometry.length||before.pages!==after.pages||issues.before.length||issues.after.length?'DIFFERENT_OR_UNREADABLE':'SAME_WITHIN_PUBLISHED_CONTRACT',formats:{before:before.sourceFormat,after:after.sourceFormat},
  pages:{before:before.pages,after:after.pages,equal:before.pages===after.pages},semantic:{count:semantics.length,differences:semantics,readIssues:issues},geometry:{tolerance:0.2,count:geometry.length,differences:geometry},unverified:[...new Set([...before.semantic.unverified,...after.semantic.unverified])],
  note:'Semantic values use the unchanged production preservation reader. Geometry compares every published control/text layout field with 0.2 numeric tolerance, no projection. Hancom provides no serializer loss report; none is fabricated. This compares both files through this engine and does not by itself prove native Hancom screen or print equality.'};
}
export async function writeJSON(path,value){await writeFile(path,JSON.stringify(value,null,2)+'\n');}
export async function ensureNewOutputDirectory(path){const out=absolutePath(path,'output directory');await mkdir(out,{recursive:true});return out;}
