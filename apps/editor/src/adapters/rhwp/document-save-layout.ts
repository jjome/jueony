/** Whole published layout round-trip proof. No format/provenance exclusions. */
type Value=null|boolean|number|string|Value[]|{[key:string]:Value};
type Native=object;
type Format='hwp'|'hwpx'|'hml';
export class DocumentSaveLayoutError extends Error {
 readonly code:'changed'|'unreadable'|'limit';readonly path:string;
 constructor(code:'changed'|'unreadable'|'limit',path:string){super(`저장 전후 문서 전체 배치를 확인하지 못했습니다 (${path}). 원본 파일은 쓰지 않습니다.`);this.name='DocumentSaveLayoutError';this.code=code;this.path=path;}
}
const LIMIT={pages:200,nodes:1_000_000,bytes:32*1024*1024,runs:40000,controls:20000,depth:64};
function fail(code:'changed'|'unreadable'|'limit',path:string):never{throw new DocumentSaveLayoutError(code,path);}
function call(doc:Native,key:string,...args:unknown[]):unknown{const method=(doc as Record<string,unknown>)[key];if(typeof method!=='function')return fail('unreadable',key);return method.apply(doc,args);}
function native(doc:Native):Native{const borrow=(doc as {borrowDocumentHandle?:()=>Native}).borrowDocumentHandle;return borrow?borrow.call(doc):doc;}
function object(value:unknown,path:string):Record<string,Value>{if(!value||typeof value!=='object'||Array.isArray(value))return fail('unreadable',path);return value as Record<string,Value>;}
type Budget={nodes:number;bytes:number;runs:number;controls:number};
function json(doc:Native,key:string,page:number,budget:Budget):Record<string,Value>{
 let value=call(doc,key,page);const parsedFromString=typeof value==='string';
 const encoded=typeof value==='string'?value:JSON.stringify(value);if(typeof encoded!=='string')return fail('unreadable',key);
 if(encoded.length>LIMIT.bytes)fail('limit','layout-bytes');budget.bytes+=new TextEncoder().encode(encoded).byteLength;if(budget.bytes>LIMIT.bytes)fail('limit','layout-bytes');
 if(typeof value==='string')value=JSON.parse(value);
 const queue:{value:unknown;depth:number}[]=[{value,depth:0}];
 while(queue.length){const item=queue.pop()!;if(++budget.nodes>LIMIT.nodes||item.depth>LIMIT.depth)fail('limit','layout-nodes');const v=item.value;
  if(typeof v==='number'){if(!Number.isFinite(v))fail('unreadable','nonfinite-layout-number');continue;}
  if(v===null||typeof v==='string'||typeof v==='boolean')continue;
  if(!v||typeof v!=='object'||typeof(v as {toJSON?:unknown}).toJSON==='function')fail('unreadable','invalid-layout-json');
  for(const child of Object.values(v))queue.push({value:child,depth:item.depth+1});
 }
 // Native JSON strings are already detached. A facade may return a mutable DTO;
 // validate it first (never erase undefined/NaN/functions), then detach the proof.
 const result=object(parsedFromString?value:JSON.parse(encoded),key);if(result.ok===false)fail('unreadable',key);return result;
}
function capture(doc:Native):Value[]{
 const count=call(doc,'pageCount');if(typeof count!=='number'||!Number.isSafeInteger(count)||count<1)fail('unreadable','page-count');if(count>LIMIT.pages)fail('limit','page-count');
 const budget:Budget={nodes:0,bytes:0,runs:0,controls:0},pages:Value[]=[];
 for(let page=0;page<count;page++){
  const controls=json(doc,'getPageControlLayout',page,budget),text=json(doc,'getPageTextLayout',page,budget);
  if(!Array.isArray(controls.controls)||!Array.isArray(text.runs))fail('unreadable',`page/${page}/layout-arrays`);
  budget.controls+=controls.controls.length;budget.runs+=text.runs.length;if(budget.controls>LIMIT.controls||budget.runs>LIMIT.runs)fail('limit','layout-items');
  for(const [kind,items]of[['controls',controls.controls],['runs',text.runs]]as const)for(const item of items){const r=object(item,`page/${page}/${kind}`);for(const key of['x','y','w','h'])if(typeof r[key]!=='number'||!Number.isFinite(r[key]))fail('unreadable',`page/${page}/${kind}/${key}`);if((r.w as number)<0||(r.h as number)<0)fail('unreadable',`page/${page}/${kind}/size`);if(kind==='runs'&&(typeof r.text!=='string'||!Array.isArray(r.charX)||r.charX.some(x=>typeof x!=='number'||!Number.isFinite(x))))fail('unreadable',`page/${page}/run-text-positions`);if(kind==='controls'&&typeof r.type!=='string')fail('unreadable',`page/${page}/control-type`);}
  // Keep the complete response objects, including every newly exposed field.
  pages.push({controls,text});
 }
 return pages;
}
const measuredPath=(path:string)=>/^pages\/\d+\/(?:controls\/controls\/\d+(?:\/cells\/\d+)?\/(?:x|y|w|h)|text\/runs\/\d+\/(?:x|y|w|h|charX\/\d+))$/.test(path);
function compare(a:Value,b:Value,path:string):void{
 if(typeof a==='number'&&typeof b==='number'){
  // Only measured rectangles/glyph positions use the established 0.2 maximum.
  // Counts, IDs, owners, offsets and all other published metadata remain exact.
  if(measuredPath(path)?Math.abs(a-b)>0.2:a!==b)fail('changed',path);return;
 }
 if(Array.isArray(a)||Array.isArray(b)){if(!Array.isArray(a)||!Array.isArray(b)||a.length!==b.length)fail('changed',path+'/length');for(let i=0;i<a.length;i++)compare(a[i],b[i],`${path}/${i}`);return;}
 if(a&&b&&typeof a==='object'&&typeof b==='object'){
  const aa=object(a,path),bb=object(b,path),keys=Object.keys(aa);if(keys.length!==Object.keys(bb).length)fail('changed',path+'/keys');
  for(const k of keys){if(!Object.hasOwn(bb,k))fail('changed',path+'/keys');compare(aa[k],bb[k],`${path}/${k}`);}return;
 }
 if(a!==b)fail('changed',path);
}
/** Mandatory for every supported save, including plain HWPX and plans.length=0.
 * Metrics selection is temporary, complete raw layout IDs are not discarded,
 * and failures/limits never become an unverified successful save. */
export function assertDocumentSaveLayout(source:Native,bytes:Uint8Array,format:Format,reopen:(bytes:Uint8Array)=>Native&{free():void}):{pages:number}{
 if(format!=='hwp'&&format!=='hwpx')return fail('unreadable','unsupported-layout-format');
 let doc:Native|undefined,opened:ReturnType<typeof reopen>|undefined,originalMode:boolean|undefined,openedNative:Native|undefined;
 try{
  doc=native(source);const mode=call(doc,'canvasMetricsActive');if(typeof mode!=='boolean')fail('unreadable','canvas-metric-mode');originalMode=mode;
  if(mode)call(doc,'selectCanvasMetrics',false);if(call(doc,'canvasMetricsActive')!==false)fail('unreadable','portable-metric-mode');
  const before=capture(doc);if(!(bytes instanceof Uint8Array)||!bytes.length)fail('unreadable','empty-export');opened=reopen(bytes);if(opened===source||opened===doc)fail('unreadable','reopened-source-alias');openedNative=native(opened);if(openedNative===doc)fail('unreadable','reopened-source-alias');
  if(call(openedNative,'canvasMetricsActive')!==false)fail('unreadable','reopened-portable-metric-mode');const after=capture(openedNative);compare(before,after,'pages');return{pages:before.length};
 }catch(error){if(error instanceof DocumentSaveLayoutError)throw error;return fail('unreadable','layout-query');}
 finally{
  try{if(opened&&opened!==source&&opened!==doc&&openedNative!==doc)opened.free();}
  finally{if(doc&&originalMode===true){call(doc,'selectCanvasMetrics',true);if(call(doc,'canvasMetricsActive')!==true)fail('unreadable','restore-canvas-metric-mode');}}
 }
}
