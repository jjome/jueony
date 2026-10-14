import {sha256} from '@noble/hashes/sha2.js';

/** Read-only export evidence. This is an engine round-trip check, not a Hancom layout check. */
type Json = null | boolean | number | string | Json[] | {[key:string]:Json};
type RecordValue = {[key:string]:Json};
type NativeDocument = object;
type Format = 'hwp' | 'hwpx' | 'hml';
export type PreservationIssue = {code:'content-loss'|'changed'|'unreadable'|'limit';path:string;message:string};
export type PreservationReport = {
 schemaVersion:1;status:'checked'|'blocked';format:Format;checked:string[];unverified:string[];issues:PreservationIssue[];
};
export type PreservationEvidence = {values:Record<string,Json>;unverified:string[];issues:PreservationIssue[]};
export class PreservationError extends Error {
 readonly report:PreservationReport;
 constructor(report:PreservationReport){
  super(`저장 후 문서 보존 검사에 실패했습니다 (${report.issues.slice(0,3).map(i=>`${i.path}: ${i.message}`).join('; ')}). 원본과 기존 복구본은 유지됩니다.`);
  this.name='PreservationError';this.report=report;
 }
}

const LIMITS={paragraphs:10000,runs:40000,controls:20000,assets:1024,assetBytes:128*1024*1024};
const UNVERIFIED=['원본의 해석되지 않은 XML/바이너리 레코드, 바탕쪽 전체 속성, 전자서명과 변경 추적은 이 WASM 읽기 계약으로 검증하지 못합니다.','같은 엔진의 재열기 검사이며 실제 한글의 조판·출력 동일성 검사가 아닙니다.'];
const record=(v:Json):RecordValue=>{if(!v||Array.isArray(v)||typeof v!=='object')throw new Error('객체 응답 아님');return v;};
const array=(v:Json):Json[]=>{if(!Array.isArray(v))throw new Error('배열 응답 아님');return v;};
const integer=(v:Json|undefined):number=>{if(typeof v!=='number'||!Number.isSafeInteger(v)||v<0)throw new Error('좌표 응답 오류');return v;};
function native(value:NativeDocument):NativeDocument {
 const borrow=(value as {borrowDocumentHandle?:()=>NativeDocument}).borrowDocumentHandle;
 return borrow?borrow.call(value):value;
}
function invoke(doc:NativeDocument,key:string,...args:unknown[]):unknown {
 const method=(doc as Record<string,unknown>)[key];
 if(typeof method!=='function')throw new Error(`조회 API 없음: ${key}`);
 return method.apply(doc,args);
}
function read(doc:NativeDocument,key:string,...args:unknown[]):Json {
 const value=invoke(doc,key,...args),json=typeof value==='string'?JSON.parse(value):value;
 if(json===undefined)throw new Error('빈 조회 응답');
 if(json&&typeof json==='object'&&!Array.isArray(json)&&json.ok===false)throw new Error('조회 실패');
 return json as Json;
}
/** Storage IDs may be renumbered; compare resolved properties instead. Inactive fills have no appearance. */
function normalized(value:Json):Json {
 if(Array.isArray(value))return value.map(normalized);
 if(!value||typeof value!=='object')return value;
 const result:RecordValue={};
 for(const key of Object.keys(value).sort()){
  if(['charShapeId','paraShapeId','borderFillId'].includes(key))continue;
  if(value.fillType==='none'&&['fillColor','patternColor','patternType'].includes(key))continue;
  // Both native codes mean no hatch; HWPX omits hatchStyle unless pattern_type >= 1.
  if(value.fillType==='solid'&&key==='patternType'&&typeof value[key]==='number'&&value[key]<=0){result[key]=-1;continue;}
  result[key]=normalized(value[key]);
 }
 return result;
}
const signature=(value:Json)=>JSON.stringify(normalized(value));
const bytesHash=(bytes:Uint8Array)=>Array.from(sha256(bytes),v=>v.toString(16).padStart(2,'0')).join('');

export function capturePreservationEvidence(value:NativeDocument):PreservationEvidence {
 const doc=native(value),values:Record<string,Json>={},issues:PreservationIssue[]=[],unverified=[...UNVERIFIED];
 let paragraphs=0,runs=0,assetBytes=0;
 const pageImageHashes=new Map<number,string>();
 const capture=(path:string,action:()=>Json)=>{try{values[path]=normalized(action());}catch{issues.push({code:'unreadable',path,message:'문서 속성을 읽지 못했습니다'});}};
 const budget=(count:number,limit:number)=>{if(count>limit)throw new Error('검사 크기 한도 초과');};
 const at: {section:number;paragraph:number}[]=[];
 const pageBorder=(section:number,kind?:string):Json=>{
  const {attr:rawBits,...resolved}=record(kind?read(doc,'getPageBorderFillEntry',section,kind):read(doc,'getPageBorderFill',section));
  if(resolved.fillType==='image'&&resolved.image&&typeof (doc as Record<string,unknown>).getPageBackgroundImageBytes==='function'){
   const image=record(resolved.image),id=integer(image.binDataId);let hash=pageImageHashes.get(id);
   if(!hash){const bytes=invoke(doc,'getPageBackgroundImageBytes',section,kind??'both');if(!(bytes instanceof Uint8Array)||!bytes.length)throw new Error('배경 그림 bytes 없음');assetBytes+=bytes.byteLength;budget(assetBytes,LIMITS.assetBytes);budget(pageImageHashes.size+1,LIMITS.assets);hash=bytesHash(bytes);pageImageHashes.set(id,hash);}
   const {binDataId:unused,...properties}=image;resolved.image={...properties,assetSha256:hash};
  }
  return resolved;
 };
 let storedRestarts:Json[]|undefined;
 if(typeof (doc as Record<string,unknown>).getAgentListDefinitions==='function')capture('list-definitions',()=>{const {storedRestarts:state,...definitions}=record(read(doc,'getAgentListDefinitions'));storedRestarts=array(state);return definitions;});
 capture('sections',()=>integer(read(doc,'getSectionCount')));
 const sectionCount=typeof values.sections==='number'?values.sections:0;
 for(let section=0;section<sectionCount;section++){
  const key=`section/${section}`;
  for(const [name,method] of [['page','getPageDef'],['definition','getSectionDef'],['columns','getColumnDef']] as const)capture(`${key}/${name}`,()=>read(doc,method,section));
  if(typeof (doc as Record<string,unknown>).getAgentOutlineDefinition==='function')capture(`${key}/outline-definition`,()=>({definitionId:integer(record(read(doc,'getAgentOutlineDefinition',section)).definitionId)}));
  capture(`${key}/page-border`,()=>pageBorder(section));
  if(typeof (doc as Record<string,unknown>).getPageBorderFillEntry==='function')capture(`${key}/page-border-entries`,()=>['both','even','odd'].map(kind=>pageBorder(section,kind)));
  if(typeof (doc as Record<string,unknown>).getMasterPages==='function')capture(`${key}/master-pages`,()=>{
   const state=record(read(doc,'getMasterPages',section));return array(state.pages!).map(item=>{const {index:unused,editable:gate,...properties}=record(item);return properties;});
  });
    if(typeof (doc as Record<string,unknown>).getLineNumberSettings==='function')capture(`${key}/line-numbers`,()=>{
     const {editable:gate,formatSupport:format,ok:status,...settings}=record(read(doc,'getLineNumberSettings',section));return settings;
    });
    capture(`${key}/paragraph-count`,()=>integer(read(doc,'getParagraphCount',section)));
  const count=Number(values[`${key}/paragraph-count`]??0);
  for(let paragraph=0;paragraph<count;paragraph++){
   const pkey=`${key}/paragraph/${paragraph}`;at.push({section,paragraph});
   if(++paragraphs>LIMITS.paragraphs){issues.push({code:'limit',path:key,message:'문단 검사 한도를 넘었습니다'});break;}
   capture(pkey,()=>{
    const length=integer(read(doc,'getParagraphLength',section,paragraph));
    const segments=array(read(doc,'getCharShapeRuns',section,paragraph,0,length));
    runs+=segments.length;budget(runs,LIMITS.runs);
    return {...(storedRestarts?{storedNumberingRestart:array(storedRestarts[section])[paragraph]??null}:{}),text:String(invoke(doc,'getTextRange',section,paragraph,0,length)),paragraph:read(doc,'getParaPropertiesAt',section,paragraph),pageHide:read(doc,'getPageHide',section,paragraph),style:read(doc,'getStyleAt',section,paragraph),runs:segments.map(item=>{
     const run=record(item),start=integer(run.startOffset),end=integer(run.endOffset);
     return {start,end,properties:read(doc,'getCharPropertiesAt',section,paragraph,start)};
    }),...(length===0?{emptyProperties:read(doc,'getCharPropertiesAt',section,paragraph,0)}:{})};
   });
  }
  // Header/footer getters do not appear recursively in getControls. Read their text separately.
  for(const header of [true,false])for(const applyTo of [0,1,2])capture(`${key}/${header?'header':'footer'}/${applyTo}`,()=>read(doc,'getHeaderFooter',section,header,applyTo));
  if(typeof (doc as Record<string,unknown>).getAgentHeaderFooter==='function'){
   for(const header of [true,false])for(const applyTo of [0,1,2])capture(`${key}/${header?'header':'footer'}/${applyTo}/format`,()=>{
    const state=record(read(doc,'getHeaderFooter',section,header,applyTo));if(state.exists!==true)return [];
    const count=integer(state.paraCount);budget(count,1024);
    return Array.from({length:count},(_,p)=>{
     budget(++paragraphs,LIMITS.paragraphs);budget(++runs,LIMITS.runs);
     return {paragraph:read(doc,'getParaPropertiesInHf',section,header,applyTo,p),firstCharacters:read(doc,'getCharPropertiesInHeaderFooter',section,header,applyTo,p,0)};
    });
   });
   const note='머리말/꼬리말 문단 모양과 첫 글자 모양을 비교합니다. AI 지원 범위의 균일 글자 서식은 이를 사용하지만 복잡한 원본의 모든 혼합 run은 별도 검수가 필요합니다.';
   if(!unverified.includes(note))unverified.push(note);
  }
 }
 capture('text',()=>read(doc,'getTextFileUnicode'));
 capture('fields',()=>read(doc,'getFieldList'));
 capture('bookmarks',()=>read(doc,'getBookmarks'));
 capture('controls',()=>{
  const controls=array(read(doc,'getControls'));budget(controls.length,LIMITS.controls);
  if(controls.some(c=>record(c).ctrlId===''))unverified.push('종류를 노출하지 않는 컨트롤이 있습니다. 개수·위치는 비교하지만 내부 payload 보존은 검증하지 못합니다.');
  // HWPX moves secd/cold to the front of their paragraph. Their values are checked
  // above; keep their counts/locations but compare content order separately. Native
  // slot numbers and stream positions are not stable identifiers across serialization.
  const semantic=controls.map(c=>{
   const control=record(c),{pos:unused,controlIndex:slot,...rest}=control;
   // getControls exposes cached attr bits for TextWrap, whereas the HWPX
   // serializer/renderer use common.text_wrap. Caption edits can leave only
   // those raw bits stale. Compare the resolved property for body tables;
   // this does not ignore a real wrap change (objects checks it as well).
   if(control.ctrlId==='tbl'&&control.list===0){
    const location=at[integer(control.para)];if(!location)throw new Error('표 위치 없음');
    const properties=record(read(doc,'getTableProperties',location.section,location.paragraph,integer(slot)));
    if(typeof properties.textWrap!=='string')throw new Error('표 배치 속성 없음');
    rest.props={...record(control.props),TextWrap:properties.textWrap};
   }
   return rest;
  });
  const metadata=semantic.filter(c=>['secd','cold'].includes(String(c.ctrlId))).sort((a,b)=>signature(a).localeCompare(signature(b)));
  const content=semantic.filter(c=>!['secd','cold'].includes(String(c.ctrlId)));
  return [...metadata,...content];
 });
 capture('styles',()=>array(read(doc,'getStyleList')).map(item=>{
  const style=record(item),id=integer(style.id),metadata=readStoredStyleMetadata(doc,id);return {...style,...(metadata?{metadata}:{}),details:read(doc,typeof (doc as Record<string,unknown>).getStoredStyleDetail==='function'?'getStoredStyleDetail':'getStyleDetail',id)};
 }));
 capture('cells',()=>{
  const lists=array(record(read(doc,'getCursorModel')).lists).map(record),byId=new Map(lists.map(l=>[integer(l.listId),l]));
  type Address={section:number;paragraph:number;path:{controlIndex:number;cellIndex:number;cellParaIndex:number}[]};
  const address=(list:RecordValue,paragraph:number,depth=0):Address=>{
   if(depth>32)throw new Error('순환 또는 너무 깊은 셀 경로');
   const item={controlIndex:integer(list.controlIndex),cellIndex:integer(list.cellIndex),cellParaIndex:paragraph};
   if(list.hostListId===0)return {section:integer(list.sectionIndex),paragraph:integer(list.hostPara),path:[item]};
   const parent=byId.get(integer(list.hostListId));if(!parent)throw new Error('부모 셀 없음');
   const a=address(parent,integer(list.hostPara),depth+1);return {...a,path:[...a.path,item]};
  };
  const result:Json[]=[];
  for(const list of lists){
   if(!list.isCell){unverified.push('글상자·캡션 안의 모든 글자 서식은 검사 범위 밖입니다. 텍스트와 컨트롤 속성은 별도 비교합니다.');continue;}
   const location=address(list,0),cellIndex=integer(list.cellIndex);
   const cell:{list:Json;properties:Json;paragraphs:Json[]}={list,properties:read(doc,'getCellPropertiesByPath',location.section,location.paragraph,JSON.stringify(location.path),cellIndex),paragraphs:[]};
   for(let p=0;p<integer(list.paraCount);p++){
    budget(++paragraphs,LIMITS.paragraphs);const a=address(list,p),path=JSON.stringify(a.path);
    const length=integer(read(doc,'getCellParagraphLengthByPath',a.section,a.paragraph,path));
    const segments=array(read(doc,'getCharShapeRunsInCellByPath',a.section,a.paragraph,path,0,length));runs+=segments.length;budget(runs,LIMITS.runs);
    cell.paragraphs.push({paragraph:read(doc,'getParaShapeSet',integer(list.listId),p),runs:segments.map(item=>{const run=record(item),start=integer(run.startOffset),end=integer(run.endOffset);return {start,end,properties:read(doc,'getCellCharPropertiesAtByPath',a.section,a.paragraph,path,start)};})});
   }
   result.push(cell);
  }
  return result;
 });
 const controls=Array.isArray(values.controls)?values.controls:[];
 // Common object props in controls cover rotation, dimensions, positions and wrap. Get detailed top-level shapes too.
 capture('objects',()=>array(read(doc,'getObjects')).map(item=>{
  const object=record(item),location=at[integer(object.para)];if(!location)throw new Error('개체 위치 없음');
  const ci=integer(object.controlIndex),{section,paragraph}=location;
  const method=object.kind==='picture'?'getPictureProperties':object.kind==='shape'?'getShapeProperties':object.kind==='equation'?'getEquationProperties':object.kind==='table'?'getTableProperties':null;
  return {object,...(method?{properties:read(doc,method,section,paragraph,ci,-1,-1)}:{})};
 }));
 // Only visible image resources have a published byte reader. Compare hashes, never dump content in reports.
 capture('image-resources',()=>{
  const hashes:string[]=[],seen=new Set<string>(),pageCount=integer(read(doc,'pageCount'));
  for(let page=0;page<pageCount;page++){
   const keys=array(record(read(doc,'getPageSourceImageKeys',page)).keys);
   for(const key of keys){if(typeof key!=='string')throw new Error('그림 키 오류');if(seen.has(key))continue;seen.add(key);budget(seen.size,LIMITS.assets);
    const bytes=invoke(doc,'getSourceImageBytes',key);if(!(bytes instanceof Uint8Array))throw new Error('그림 bytes 없음');assetBytes+=bytes.byteLength;budget(assetBytes,LIMITS.assetBytes);hashes.push(bytesHash(bytes));
   }
  }
  return hashes.sort();
 });
 if(controls.some(c=>['head','foot','fn','en'].includes(String(record(c).ctrlId))))unverified.push('머리말·꼬리말·각주 내부의 개체와 모든 글자 run은 별도 한글 비교가 필요합니다.');
 unverified.push('렌더에 사용되지 않는 바이너리 자산과 OLE 원본 payload는 검사 범위 밖입니다.');
 return {values,issues,unverified:[...new Set(unverified)]};
}

export function comparePreservationEvidence(before:PreservationEvidence,after:PreservationEvidence,format:Format,contentLoss:unknown):PreservationReport {
 const issues=[...before.issues,...after.issues],checked:string[]=[];
 let loss:Record<string,unknown>|undefined;
 try{loss=(typeof contentLoss==='string'?JSON.parse(contentLoss):contentLoss) as Record<string,unknown>;}catch{}
 if(!loss||loss.schemaVersion!==1||loss.outputFormat!==format||!Number.isSafeInteger(loss.count)||!Array.isArray(loss.losses)||loss.count!==loss.losses.length)issues.push({code:'unreadable',path:'serializer-report',message:'유효한 손실 보고서가 없습니다'});
 else if(loss.count!==0)issues.push({code:'content-loss',path:'serializer-report',message:`직렬화기가 ${loss.count}건의 손실을 보고했습니다`});
 for(const path of new Set([...Object.keys(before.values),...Object.keys(after.values)])){
  if(!(path in before.values)||!(path in after.values)||signature(before.values[path])!==signature(after.values[path]))issues.push({code:'changed',path,message:'저장 전후 값이 다릅니다'});
  else checked.push(path);
 }
 return {schemaVersion:1,status:issues.length?'blocked':'checked',format,checked,unverified:[...new Set([...before.unverified,...after.unverified])],issues};
}

/** Call before any disk/download/recovery commit, and for each AI edited clone before applying it. */
export function verifyPreservedExport(source:NativeDocument,bytes:Uint8Array,format:Format,contentLoss:unknown,open:(bytes:Uint8Array)=>NativeDocument & {free():void}):PreservationReport {
 const before=capturePreservationEvidence(source);let reopened:ReturnType<typeof open>|undefined;
 let after:PreservationEvidence;
 try{if(!bytes.length)throw new Error('empty');reopened=open(bytes);after=capturePreservationEvidence(reopened);}
 catch{after={values:{},unverified:[],issues:[{code:'unreadable',path:'reopen',message:'저장 사본을 다시 열지 못했습니다'}]};}
 finally{reopened?.free();}
 const report=comparePreservationEvidence(before,after,format,contentLoss);
 if(report.status==='blocked')throw new PreservationError(report);
 return report;
}

/** Semantic metadata, separate from physical raw-record reconstruction eligibility. */
export function readStoredStyleMetadata(doc:any,id:number):{langId:number;lockForm:boolean}|undefined {
 if(typeof doc.getAgentStyleMetadata!=='function')return undefined;
 const state=record(read(doc,'getAgentStyleMetadata',id));
 if(typeof state.langId!=='number'||!Number.isInteger(state.langId)||state.langId< -32768||state.langId>32767||typeof state.lockForm!=='boolean')throw new Error('저장 스타일 언어·잠금 정보를 확인하지 못했습니다.');
 return {langId:state.langId,lockForm:state.lockForm};
}
