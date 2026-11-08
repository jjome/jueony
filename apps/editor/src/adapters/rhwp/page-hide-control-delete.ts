type JsonRecord=Record<string,unknown>;

export type RootPageHideControl={
 ctrlId:'pghd';ctrlCh:2;userDesc:'감추기';list:0;para:number;pos:number;controlIndex:number;props:JsonRecord;
};
export type PageHideFlags={
 hideHeader:boolean;hideFooter:boolean;hideMasterPage:boolean;hideBorder:boolean;hideFill:boolean;hidePageNum:boolean;
};
export type RootPageHideProof={
 revision:string;section:number;paragraph:number;flatParagraph:number;control:RootPageHideControl;flags:PageHideFlags;
 documentFingerprint:string;controlsFingerprint:string;paragraphFingerprint:string;
};
export type PageHideDeleteTransaction={
 before:RootPageHideProof;afterFingerprint:string;undo():RootPageHideProof;commit():void;
};

const flagNames=['hideHeader','hideFooter','hideMasterPage','hideBorder','hideFill','hidePageNum'] as const;
const json=(value:unknown):unknown=>typeof value==='string'?JSON.parse(value):value;
const object=(value:unknown,name:string):JsonRecord=>{const result=json(value);if(!result||Array.isArray(result)||typeof result!=='object')throw new Error(`${name} 응답이 올바르지 않습니다.`);return result as JsonRecord;};
const array=(value:unknown,name:string):JsonRecord[]=>{const result=json(value);if(!Array.isArray(result)||result.length>100_000||result.some(item=>!item||Array.isArray(item)||typeof item!=='object'))throw new Error(`${name} 응답이 올바르지 않습니다.`);return result as JsonRecord[];};
const integer=(value:unknown,name:string,min=0):number=>{if(!Number.isSafeInteger(value)||Number(value)<min)throw new Error(`${name} 값이 올바르지 않습니다.`);return Number(value);};
const revision=(value:unknown):string=>{if(typeof value!=='string'||!value||value.length>256)throw new Error('문서 버전이 올바르지 않습니다.');return value;};
const exact=(value:unknown):string=>JSON.stringify(value);
const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;
const native=(value:any):any=>typeof value?.borrowDocumentHandle==='function'?value.borrowDocumentHandle():value;
const method=(doc:any,name:string):((...args:any[])=>any)=>{if(typeof doc?.[name]!=='function')throw new Error(`조판 부호 삭제 API가 없습니다: ${name}`);return doc[name].bind(doc);};

function pageHide(value:unknown):PageHideFlags{
 const row=object(value,'감추기 조판 부호');if(row.ok!==true||row.exists!==true)throw new Error('대상 문단에 감추기 조판 부호가 없습니다.');
 for(const key of flagNames)if(typeof row[key]!=='boolean')throw new Error('감추기 조판 부호 원문을 확인하지 못했습니다.');
 return Object.fromEntries(flagNames.map(key=>[key,row[key]])) as PageHideFlags;
}
function paragraphCounts(doc:any):number[]{
 const sections=integer(method(doc,'getSectionCount')(),'구역 수');if(sections<1||sections>65_536)throw new Error('문서 구역 수가 올바르지 않습니다.');
 return Array.from({length:sections},(_,section)=>integer(method(doc,'getParagraphCount')(section),`구역 ${section} 문단 수`));
}
function paragraphFingerprint(doc:any,section:number,paragraph:number):string{
 const length=integer(method(doc,'getParagraphLength')(section,paragraph),'문단 길이');
 const text=method(doc,'getTextRange')(section,paragraph,0,length);if(typeof text!=='string')throw new Error('대상 문단 원문을 읽지 못했습니다.');
 return exact({length,text});
}
function semanticControls(items:JsonRecord[],removed?:RootPageHideControl):unknown[]{
 let skipped=false;
 return items.flatMap(item=>{
  if(removed&&!skipped&&item.list===removed.list&&item.para===removed.para&&item.controlIndex===removed.controlIndex&&item.ctrlId===removed.ctrlId){skipped=true;return[];}
  const copy=clone(item);delete copy.pos;delete copy.controlIndex;return[copy];
 });
}
function control(value:JsonRecord,flat:number):RootPageHideControl{
 const props=object(value.props??{},'조판 부호 속성');
 if(value.ctrlId!=='pghd'||value.ctrlCh!==2||value.userDesc!=='감추기'||value.list!==0||value.para!==flat)
  throw new Error('지원하는 root-body 감추기 조판 부호가 아닙니다.');
 return{ctrlId:'pghd',ctrlCh:2,userDesc:'감추기',list:0,para:flat,pos:integer(value.pos,'조판 부호 위치'),controlIndex:integer(value.controlIndex,'조판 부호 번호'),props:clone(props)};
}

/** Captures the exact root-body PageHide control. Other layout-control kinds remain unsupported. */
export function readRootPageHideControl(value:any,target:{section:number;paragraph:number},currentRevision:string):RootPageHideProof{
 const doc=native(value);if(doc?.requiresPasswordForSave===true)throw new Error('암호 문서의 조판 부호는 삭제하지 않습니다.');
 const rev=revision(currentRevision),counts=paragraphCounts(doc),section=integer(target.section,'구역 번호'),paragraph=integer(target.paragraph,'문단 번호');
 if(section>=counts.length||paragraph>=counts[section])throw new Error('대상 본문 문단이 없습니다.');
 const flat=counts.slice(0,section).reduce((sum,count)=>sum+count,0)+paragraph,items=array(method(doc,'getControls')(),'컨트롤 목록');
 const matches=items.filter(item=>item.list===0&&item.para===flat&&item.ctrlId==='pghd');
 if(matches.length!==1)throw new Error(matches.length?'대상 문단의 감추기 조판 부호가 중복되었습니다.':'대상 문단에 감추기 조판 부호가 없습니다.');
 const targetControl=control(matches[0],flat),flags=pageHide(method(doc,'getPageHide')(section,paragraph));
 return{revision:rev,section,paragraph,flatParagraph:flat,control:targetControl,flags,
  documentFingerprint:exact({counts}),controlsFingerprint:exact(items),paragraphFingerprint:paragraphFingerprint(doc,section,paragraph)};
}

/**
 * Deletes exactly one verified root-body PageHide control.
 * The returned transaction owns the one snapshot used for either undo or failure rollback.
 */
export function deleteRootPageHideControl(value:any,expected:RootPageHideProof,currentRevision:()=>string):PageHideDeleteTransaction{
 const doc=native(value),live=revision(currentRevision());
 if(live!==expected.revision)throw new Error('조판 부호 삭제 요청의 문서 버전이 오래되었습니다.');
 for(const name of ['saveSnapshot','restoreSnapshot','discardSnapshot','deleteControlAt'])method(doc,name);
 const current=readRootPageHideControl(doc,{section:expected.section,paragraph:expected.paragraph},live);
 if(exact(current)!==exact(expected))throw new Error('감추기 조판 부호의 위치·원문·문서 상태가 바뀌었습니다.');
 const beforeControls=array(method(doc,'getControls')(),'컨트롤 목록'),survivors=exact(semanticControls(beforeControls,current.control));
 const token=method(doc,'saveSnapshot')();if(!Number.isSafeInteger(token)||Number(token)<0)throw new Error('조판 부호 삭제 복구 지점을 만들지 못했습니다.');
 let active=true,afterFingerprint='';
 const restore=()=>{method(doc,'restoreSnapshot')(token);method(doc,'discardSnapshot')(token);active=false;};
 try{
  const result=object(method(doc,'deleteControlAt')(0,current.flatParagraph,current.control.controlIndex),'조판 부호 삭제');
  if(result.ok!==true)throw new Error('감추기 조판 부호를 삭제하지 못했습니다.');
  if(revision(currentRevision())!==expected.revision)throw new Error('조판 부호 삭제 도중 문서 버전이 바뀌었습니다.');
  const hide=object(method(doc,'getPageHide')(current.section,current.paragraph),'감추기 조판 부호');
  if(hide.ok!==true||hide.exists!==false)throw new Error('감추기 조판 부호 삭제 결과를 확인하지 못했습니다.');
  const afterControls=array(method(doc,'getControls')(),'컨트롤 목록');
  if(afterControls.some(item=>item.list===0&&item.para===current.flatParagraph&&item.ctrlId==='pghd')||exact(semanticControls(afterControls))!==survivors)
   throw new Error('대상 외의 컨트롤이 함께 바뀌었습니다.');
  if(paragraphFingerprint(doc,current.section,current.paragraph)!==current.paragraphFingerprint)throw new Error('대상 문단 원문이 함께 바뀌었습니다.');
  if(exact({counts:paragraphCounts(doc)})!==current.documentFingerprint)throw new Error('문서 구역·문단 구조가 함께 바뀌었습니다.');
  afterFingerprint=exact({controls:afterControls,paragraph:current.paragraphFingerprint,counts:current.documentFingerprint});
 }catch(error){
  try{restore();const restored=readRootPageHideControl(doc,{section:expected.section,paragraph:expected.paragraph},expected.revision);if(exact(restored)!==exact(expected))throw new Error('snapshot 원복 뒤 원래 조판 부호가 복원되지 않았습니다.');}
  catch(rollback){throw new AggregateError([error,rollback],'조판 부호 삭제 실패와 원복 실패가 함께 발생했습니다.');}
  throw error;
 }
 return{before:clone(expected),afterFingerprint,
  undo(){
   if(!active)throw new Error('조판 부호 삭제 snapshot이 이미 종료되었습니다.');
   if(revision(currentRevision())!==expected.revision)throw new Error('삭제 뒤 문서가 바뀌어 snapshot을 되돌릴 수 없습니다.');
   const afterControls=array(method(doc,'getControls')(),'컨트롤 목록'),fingerprint=exact({controls:afterControls,paragraph:paragraphFingerprint(doc,current.section,current.paragraph),counts:current.documentFingerprint});
   if(fingerprint!==afterFingerprint)throw new Error('삭제 뒤 문서 상태가 바뀌어 snapshot을 되돌릴 수 없습니다.');
   restore();const restored=readRootPageHideControl(doc,{section:expected.section,paragraph:expected.paragraph},expected.revision);
   if(exact(restored)!==exact(expected))throw new Error('snapshot이 원래 조판 부호를 복원하지 못했습니다.');
   return restored;
  },
  commit(){if(!active)throw new Error('조판 부호 삭제 snapshot이 이미 종료되었습니다.');method(doc,'discardSnapshot')(token);active=false;},
 };
}
