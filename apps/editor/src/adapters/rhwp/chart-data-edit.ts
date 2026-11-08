import {capturePreservationEvidence} from './preservation.ts';

type JsonRecord=Record<string,unknown>;
type ChartSeries={name:string;values:string[]};
export type ChartDataSource={
 revision:string;index:number;charts:JsonRecord[];chart:number;axis:'category'|'scatter';plot:string;
 hasUpDownBars:boolean;source:'zipPart'|'nestedCopy';representations:{zipPart:boolean;nestedCopy:true};
 labelsShared:boolean;labelsMultiLevel:boolean;labels:string[];series:ChartSeries[];
};
export type ChartValueEdit={revision:string;index:number;series:number;point:number;original:string;value:string};

const CONTROL=/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u;
const json=(value:unknown):unknown=>typeof value==='string'?JSON.parse(value):value;
const object=(value:unknown):JsonRecord=>{const parsed=json(value);if(!parsed||Array.isArray(parsed)||typeof parsed!=='object')throw new Error('차트 응답이 객체가 아닙니다.');return parsed as JsonRecord;};
const integer=(value:unknown,name:string,min=0):number=>{if(!Number.isSafeInteger(value)||Number(value)<min)throw new Error(`차트 ${name} 값이 올바르지 않습니다.`);return Number(value);};
const text=(value:unknown,name:string,max=4096):string=>{if(typeof value!=='string'||value.length>max||CONTROL.test(value)||/[\ud800-\udfff]/u.test(value))throw new Error(`차트 ${name} 값이 올바르지 않습니다.`);return value;};
const exact=(value:unknown)=>JSON.stringify(value);
const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;
function native(value:any):any{return typeof value?.borrowDocumentHandle==='function'?value.borrowDocumentHandle():value;}
function method(doc:any,name:string):(...args:any[])=>unknown{const value=doc?.[name];if(typeof value!=='function')throw new Error(`차트 편집 API가 없습니다: ${name}`);return value.bind(doc);}
function checked(value:unknown,name:string):JsonRecord{const state=object(value);if(state.ok!==true)throw new Error(`차트 ${name}에 실패했습니다.`);return state;}
function revision(value:unknown):string{const result=text(value,'문서 버전',256);if(!result)throw new Error('차트 문서 버전이 비어 있습니다.');return result;}
function charts(doc:any):JsonRecord[]{
 const value=json(method(doc,'listCharts')());if(!Array.isArray(value)||value.length>1024)throw new Error('차트 목록을 읽지 못했습니다.');
 return value.map((item,i)=>{const entry=object(item);integer(entry.index,'목록 번호');integer(entry.section,'구역 번호');integer(entry.paragraph,'문단 번호');integer(entry.control,'컨트롤 번호');
  if(entry.index!==i)throw new Error('차트 목록 번호가 연속적이지 않습니다.');if(!Number.isSafeInteger(entry.nestedCopy)||Number(entry.nestedCopy)<0)throw new Error('차트 중첩 사본 위치가 없습니다.');
  if(entry.zipPart!==undefined&&(!Number.isSafeInteger(entry.zipPart)||Number(entry.zipPart)<0))throw new Error('차트 패키지 위치가 올바르지 않습니다.');return clone(entry);
 });
}
function source(doc:any,index:number,rev:string,list=charts(doc)):ChartDataSource{
 integer(index,'번호');const owner=list.find(item=>item.index===index);if(!owner)throw new Error('대상 차트가 없습니다.');
 const state=checked(method(doc,'getChartDataByIndex')(index),'데이터 읽기');const axis=state.axis,representations=object(state.representations);
 if(axis!=='category'&&axis!=='scatter')throw new Error('지원하지 않는 차트 축입니다.');const plot=text(state.plot,'종류',64);if(!plot)throw new Error('차트 종류가 비어 있습니다.');
 if(state.hasUpDownBars!==false)throw new Error('상승/하락 막대가 있는 차트는 이 편집 범위에서 지원하지 않습니다.');
 if(state.source!=='zipPart'&&state.source!=='nestedCopy')throw new Error('차트 데이터 원본을 확인하지 못했습니다.');
 if(representations.nestedCopy!==true||typeof representations.zipPart!=='boolean')throw new Error('차트 원본과 중첩 사본을 모두 확인하지 못했습니다.');
 if(Boolean(owner.zipPart!==undefined)!==representations.zipPart)throw new Error('차트 패키지 사본 정보가 서로 다릅니다.');
 if(state.labelsShared!==true||state.labelsMultiLevel!==false)throw new Error('공유 단일 단계 레이블 차트만 편집할 수 있습니다.');
 if(!Array.isArray(state.labels)||state.labels.length===0||state.labels.length>10000)throw new Error('차트 레이블을 확인하지 못했습니다.');
 const labels=state.labels.map((v,i)=>text(v,`레이블 ${i}`,4096));if(!Array.isArray(state.series)||state.series.length===0||state.series.length>1000)throw new Error('차트 계열을 확인하지 못했습니다.');
 const series=state.series.map((raw,i)=>{const item=object(raw),name=text(item.name,`계열 ${i} 이름`,4096);if(!Array.isArray(item.values)||item.values.length!==labels.length)throw new Error('차트 계열과 레이블 개수가 다릅니다.');
  return{name,values:item.values.map((v,p)=>text(v,`계열 ${i} 값 ${p}`,128))};});
 return{revision:revision(rev),index,charts:clone(list),chart:integer(state.chart,'내부 번호',1),axis,plot,hasUpDownBars:false,source:state.source,representations:{zipPart:representations.zipPart,nestedCopy:true},labelsShared:true,labelsMultiLevel:false,labels,series};
}

export function readChartDataSource(value:any,index:number,documentRevision:string):ChartDataSource{return source(native(value),index,documentRevision);}

function expectedAfter(before:ChartDataSource,edit:ChartValueEdit):ChartDataSource{
 const after=clone(before);after.series[edit.series].values[edit.point]=edit.value;return after;
}
function assertOnlyValueChanged(before:ChartDataSource,after:ChartDataSource,edit:ChartValueEdit):void{
 if(exact(after)!==exact(expectedAfter(before,edit)))throw new Error('차트 편집 뒤 대상 값 외의 구조·축·범례·계열이 바뀌었습니다.');
}
function assertResult(result:JsonRecord,before:ChartDataSource,edit:ChartValueEdit,dryRun:boolean):void{
 if(result.dryRun!==dryRun||result.chart!==before.chart||result.changedCount!==1||!Array.isArray(result.changed)||result.changed.length!==1||!Array.isArray(result.wrote))throw new Error('차트 편집 결과가 요청과 다릅니다.');
 const changed=object(result.changed[0]);if(changed.series!==edit.series||changed.point!==edit.point||changed.from!==edit.original||changed.to!==edit.value)throw new Error('차트 편집 결과가 대상 값을 증명하지 못했습니다.');
 const wrote=dryRun?[]:before.representations.zipPart?['zipPart','nestedCopy']:['nestedCopy'];if(exact(result.wrote)!==exact(wrote))throw new Error('차트 원본 사본을 모두 갱신하지 못했습니다.');
}

/** Replaces one numeric cache value only. This is deliberately not a general chart editor. */
export function replaceChartValue(value:any,expected:ChartDataSource,edit:ChartValueEdit,currentRevision:()=>string):{before:ChartDataSource;after:ChartDataSource}{
 const doc=native(value),liveRevision=revision(currentRevision());
 if(liveRevision!==expected.revision||revision(edit.revision)!==expected.revision||edit.index!==expected.index)throw new Error('차트 편집 요청의 문서 버전이 오래되었습니다.');
 integer(edit.series,'계열 번호');integer(edit.point,'값 번호');if(edit.series>=expected.series.length||edit.point>=expected.labels.length)throw new Error('차트 편집 대상 범위를 벗어났습니다.');
 text(edit.original,'원래 값',128);const next=text(edit.value,'새 값',128);if(!next||!Number.isFinite(Number(next)))throw new Error('차트 값은 유한한 숫자 문자열이어야 합니다.');
 if(expected.series[edit.series].values[edit.point]!==edit.original||edit.original===edit.value)throw new Error('차트 원문 또는 새 값이 요청과 다릅니다.');
 for(const name of ['saveSnapshot','restoreSnapshot','discardSnapshot','setChartDataByIndex'])method(doc,name);
 const current=source(doc,edit.index,expected.revision);if(exact(current)!==exact(expected))throw new Error('차트 데이터가 요청을 만든 뒤 바뀌었습니다.');
 const allBefore=current.charts.map((_,i)=>source(doc,i,expected.revision,current.charts));const preservationBefore=capturePreservationEvidence(doc);
 if(preservationBefore.issues.length)throw new Error('차트 편집 전 문서 보존 상태를 확인하지 못했습니다.');
 const request={dryRun:true,labels:clone(current.labels),series:clone(current.series)};request.series[edit.series].values[edit.point]=edit.value;
 const dry=checked(method(doc,'setChartDataByIndex')(edit.index,JSON.stringify(request)),'사전 검사');assertResult(dry,current,edit,true);
 if(exact(source(doc,edit.index,expected.revision))!==exact(current))throw new Error('차트 사전 검사가 문서를 변경했습니다.');
 const token=method(doc,'saveSnapshot')();if(!Number.isSafeInteger(token))throw new Error('차트 편집 복구 지점을 만들지 못했습니다.');
 try{
  const apply=checked(method(doc,'setChartDataByIndex')(edit.index,JSON.stringify({...request,dryRun:false})),'값 변경');assertResult(apply,current,edit,false);
  if(revision(currentRevision())!==expected.revision)throw new Error('차트 편집 도중 문서 버전이 바뀌었습니다.');
  const listAfter=charts(doc);if(exact(listAfter)!==exact(current.charts))throw new Error('차트 편집 뒤 차트 위치가 바뀌었습니다.');
  const allAfter=listAfter.map((_,i)=>source(doc,i,expected.revision,listAfter));assertOnlyValueChanged(current,allAfter[edit.index],edit);
  for(let i=0;i<allBefore.length;i++)if(i!==edit.index&&exact(allBefore[i])!==exact(allAfter[i]))throw new Error('다른 차트 데이터가 함께 바뀌었습니다.');
  const preservationAfter=capturePreservationEvidence(doc);if(preservationAfter.issues.length||exact(preservationBefore.values)!==exact(preservationAfter.values))throw new Error('차트 외 문서 내용이 함께 바뀌었습니다.');
  return{before:current,after:allAfter[edit.index]};
 }catch(error){const restored=checked(method(doc,'restoreSnapshot')(token),'실패 복구');if(restored.ok!==true)throw new Error('차트 편집 실패 뒤 문서를 복구하지 못했습니다.',{cause:error});throw error;}
 finally{method(doc,'discardSnapshot')(token);}
}
