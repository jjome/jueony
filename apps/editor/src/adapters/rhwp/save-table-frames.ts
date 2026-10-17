import {capturePreservationEvidence,verifyPreservedExport} from './preservation.ts';
import {nativeDocument,parsed} from './structure.ts';

type FramePlan={contract:'plain-unprotected-content-frame-v1';sectionIdx:number;paraIdx:number;controlIdx:number;beforeHeight:number;afterHeight:number;rowHeightsHu:number[];cellSpacingHu:number;changed:boolean};
const unsupported='Unsupported table content-height synchronization scope';
const canonical=(v:any):any=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const same=(a:unknown,b:unknown)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));

function portable<T>(doc:any,action:()=>T):T{
 const active=doc.canvasMetricsActive();
 if(typeof active!=='boolean')throw new Error('표 저장의 글꼴 측정 상태를 읽지 못했습니다.');
 try{
  if(active)doc.selectCanvasMetrics(false);
  if(doc.canvasMetricsActive()!==false)throw new Error('표 저장의 비교 측정 환경을 선택하지 못했습니다.');
  return action();
 }finally{
  if(active){doc.selectCanvasMetrics(true);if(doc.canvasMetricsActive()!==true)throw new Error('표 저장 검사 후 화면 측정 환경을 복원하지 못했습니다.');}
 }
}

function layout(doc:any):unknown[]{
 const count=doc.pageCount();
 if(!Number.isSafeInteger(count)||count<1||count>200)throw new Error('저장 전 표 높이의 쪽 검사 한도를 넘었습니다.');
 let nodes=0,bytes=0;
 const finite=(value:any):void=>{
  if(++nodes>100000)throw new Error('저장 전 표 높이의 배치 검사 한도를 넘었습니다.');
  if(typeof value==='number'){if(!Number.isFinite(value))throw new Error('표 배치에 유효하지 않은 수치가 있습니다.');return;}
  if(value===null||typeof value==='string'||typeof value==='boolean')return;
  if(Array.isArray(value)){value.forEach(finite);return;}
  if(value&&typeof value==='object'){Object.values(value).forEach(finite);return;}
  throw new Error('표 배치 정보를 읽지 못했습니다.');
 };
 return Array.from({length:count},(_,page)=>{
  const value={controls:parsed(doc.getPageControlLayout(page)),text:parsed(doc.getPageTextLayout(page))};
  if(!Array.isArray(value.controls?.controls)||!Array.isArray(value.text?.runs))throw new Error('표 배치 배열을 읽지 못했습니다.');
  finite(value);bytes+=JSON.stringify(value).length;
  if(bytes>8*1024*1024)throw new Error('저장 전 표 높이의 배치 자료 한도를 넘었습니다.');
  return value;
 });
}
const sameLayout=(a:any,b:any):boolean=>{
 if(typeof a==='number'&&typeof b==='number')return Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=0.2;
 if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>sameLayout(v,b[i]));
 if(a&&b&&typeof a==='object')return Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(k=>Object.hasOwn(b,k)&&sameLayout(a[k],b[k]));
 return a===b;
};

/** Compare every published layout field, including non-overlapping tables. */
function assertFrameExportLayout(doc:any,bytes:Uint8Array):void{
 let restore=false,reopened:any;
 try{
  const active=doc.canvasMetricsActive();
  if(typeof active!=='boolean')throw new Error('표 저장의 글꼴 측정 상태를 읽지 못했습니다.');
  restore=active;if(active)doc.selectCanvasMetrics(false);
  if(doc.canvasMetricsActive()!==false)throw new Error('표 저장의 비교 측정 환경을 선택하지 못했습니다.');
  const before=layout(doc);reopened=new doc.constructor(bytes);
  if(reopened.canvasMetricsActive()!==false||!sameLayout(before,layout(reopened)))throw new Error('표 높이 적용 후 저장 재열기의 표·본문 배치가 달라졌습니다.');
 }finally{
  try{reopened?.free();}finally{if(restore){doc.selectCanvasMetrics(true);if(doc.canvasMetricsActive()!==true)throw new Error('표 저장 검사 후 화면 측정 환경을 복원하지 못했습니다.');}}
 }
}

/** Read-only plans. Unsupported objects retain their original storage contract. */
export function planSaveTableFrames(wasm:any,includeUnchanged=false):FramePlan[]{
 const d=nativeDocument(wasm);
 if(typeof d.getTableContentHeightPlan!=='function'||typeof d.applyTableContentHeightPlan!=='function'||wasm.requiresPasswordForSave)return [];
 return portable(d,()=>readPlans(d,includeUnchanged));
}
function readPlans(d:any,includeUnchanged:boolean):FramePlan[]{
 const positions:{section:number;paragraph:number}[]=[];
 const sections=d.getSectionCount();
 if(!Number.isSafeInteger(sections)||sections<1||sections>200)throw new Error('저장 전 표 위치의 구역 검사 한도를 넘었습니다.');
 for(let section=0;section<sections;section++){
  const count=d.getParagraphCount(section);
  if(!Number.isSafeInteger(count)||count<0||positions.length+count>10000)throw new Error('저장 전 표 위치의 문단 검사 한도를 넘었습니다.');
  for(let paragraph=0;paragraph<count;paragraph++)positions.push({section,paragraph});
 }
 const controls=parsed(d.getControls());
 if(!Array.isArray(controls)||controls.length>20000)throw new Error('저장 전 표 위치의 개체 검사 한도를 넘었습니다.');
 const plans:FramePlan[]=[];
 for(const control of controls){
  if(!control||typeof control!=='object')throw new Error('저장 전 표 위치를 읽지 못했습니다.');
  if(control.list!==0||control.ctrlId!=='tbl')continue;
  const at=positions[control.para];
  if(!at||!Number.isSafeInteger(control.controlIndex)||control.controlIndex<0)throw new Error('저장 전 표 위치를 확인하지 못했습니다.');
  let value:any;
  try{value=parsed(d.getTableContentHeightPlan(at.section,at.paragraph,control.controlIndex));}
  catch(error){if(String(error).includes(unsupported))continue;throw error;}
  if(value?.contract!=='plain-unprotected-content-frame-v1'||value.sectionIdx!==at.section||value.paraIdx!==at.paragraph||value.controlIdx!==control.controlIndex||value.changed!==false||![value.beforeHeight,value.afterHeight,value.cellSpacingHu].every(v=>Number.isSafeInteger(v)&&v>=0)||value.afterHeight<=0||!Array.isArray(value.rowHeightsHu)||!value.rowHeightsHu.length||value.rowHeightsHu.some((v:unknown)=>!Number.isSafeInteger(v)||Number(v)<=0))throw new Error('저장 전 표 높이 계획을 검증하지 못했습니다.');
  if(includeUnchanged||value.beforeHeight!==value.afterHeight)plans.push(value);
 }
 return plans;
}

/** A frame already fully occupied by content belongs to the padding edit.
 * Its aggregate adds no extra visible space before the edit; real cell minima
 * stay authoritative. A larger explicit frame is never inferred away. */
export function captureDerivedTableFrame(wasm:any,section:number,paragraph:number,control:number):FramePlan|undefined{
 return planSaveTableFrames(wasm,true).find(p=>p.sectionIdx===section&&p.paraIdx===paragraph&&p.controlIdx===control&&p.beforeHeight<=p.afterHeight);
}
export function synchronizeEditedTableFrame(wasm:any,before:FramePlan|undefined):void{
 if(!before)return;
 const after=planSaveTableFrames(wasm).find(p=>p.sectionIdx===before.sectionIdx&&p.paraIdx===before.paraIdx&&p.controlIdx===before.controlIdx);
 if(!after)return;
 if(after.beforeHeight!==before.beforeHeight)throw new Error('표 속성 편집 중 파생 높이의 원본이 달라졌습니다.');
 const name=String(wasm.fileName??'').toLowerCase();
 if(!name.endsWith('.hwp')&&!name.endsWith('.hwpx'))throw new Error('표 속성의 저장 형식을 확인하지 못했습니다.');
 applySaveTableFrames(wasm,[after],name.endsWith('.hwpx')?'hwpx':'hwp');
}

/** Mutate the live document inside one existing snapshot/undo transaction. */
export function applySaveTableFrames(wasm:any,plans:FramePlan[],format:'hwp'|'hwpx'):void{
 const d=nativeDocument(wasm);
 portable(d,()=>applyPlans(d,plans,format));
}
function applyPlans(d:any,plans:FramePlan[],format:'hwp'|'hwpx'):void{
 const before=capturePreservationEvidence(d);
 if(before.issues.length)throw new Error('저장 전 표 높이의 전체 문서 보존 정보를 확인하지 못했습니다.');
 const expected=structuredClone(before.values) as any;
 for(const plan of plans){
  const flat=Array.from({length:plan.sectionIdx},(_,s)=>d.getParagraphCount(s)).reduce((a:number,b:number)=>a+b,0)+plan.paraIdx;
  // The preservation reader deliberately removes serialized control slot IDs.
  // The engine's plan requires exactly one body table in this host paragraph.
  const controls=expected.controls?.filter((v:any)=>v.ctrlId==='tbl'&&v.list===0&&v.para===flat);
  const objects=expected.objects?.filter((v:any)=>v.object.kind==='table'&&v.object.para===flat&&v.object.controlIndex===plan.controlIdx);
  if(controls?.length!==1||objects?.length!==1||controls[0].props?.Height!==plan.beforeHeight||objects[0].properties?.tableHeight!==plan.beforeHeight)throw new Error('저장 전 표의 원본 높이가 계획과 다릅니다.');
  controls[0].props.Height=plan.afterHeight;objects[0].properties.tableHeight=plan.afterHeight;
  const result=parsed(d.applyTableContentHeightPlan(plan.sectionIdx,plan.paraIdx,plan.controlIdx,plan.beforeHeight,plan.afterHeight));
  if(!same(result,{...plan,changed:true}))throw new Error('저장 전 표 높이 적용 결과가 계획과 다릅니다.');
 }
 const after=capturePreservationEvidence(d);
 if(after.issues.length||!same(after.values,expected))throw new Error('저장 전 표 높이 동기화가 셀·본문·서식·다른 속성을 변경했습니다.');
 const artifact=d[format==='hwpx'?'exportHwpxWithReport':'exportHwpWithReport']();
 try{
  const bytes=artifact.takeBytes();
  verifyPreservedExport(d,bytes,format,artifact.contentLoss(),value=>new d.constructor(value));
  assertFrameExportLayout(d,bytes);
 }finally{artifact.free();}
}
