import {
 readChartDataSource,replaceChartCategoryLabel,replaceChartSeriesName,replaceChartValue,
 type ChartDataSource,
} from './chart-data-edit.ts';

type HostApi={revision():string;documentIdentity():string;busy(dialog?:HTMLDialogElement):boolean;hostMutationLocked():boolean};
type Owner={document:any;generation:number;fileName:string;revision:string;identity:string};
export type ChartStudioTarget={chartIndex:number;source:ChartDataSource};
export type ChartStudioCommand=
 |{kind:'value';series:number;point:number;original:string;value:string}
 |{kind:'series-name';series:number;original:string;value:string}
 |{kind:'category-label';point:number;original:string;value:string};
type Dependencies={wasm:any;api:()=>HostApi|undefined;input:()=>any;eventBus:{emit(type:string,value?:unknown):void};render:()=>unknown};

const sessions=new WeakMap<object,{owner:Owner;source:ChartDataSource}>();
const copy=<T>(value:T):T=>structuredClone(value);
function freeze<T>(value:T):T{if(value&&typeof value==='object'){for(const child of Object.values(value as object))freeze(child);Object.freeze(value);}return value;}
function text(value:unknown,name:string){if(typeof value!=='string'||!value||value.length>4096||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ud800-\udfff]/u.test(value))throw new Error(`${name}을 확인하지 못했습니다.`);return value;}
function integer(value:unknown,name:string){if(!Number.isSafeInteger(value)||Number(value)<0)throw new Error(`${name}을 확인하지 못했습니다.`);return Number(value);}

export function createChartDataEditStudioController(deps:Dependencies){
 const owner=(dialog?:HTMLDialogElement):Owner=>{
  const api=deps.api(),input=deps.input(),document=deps.wasm.borrowDocumentHandle?.();
  if(!api||!document||!input||input.wasm!==deps.wasm||input.active===false||input.isFormMode?.()===true)throw new Error('현재 문서는 차트 데이터를 편집할 수 없습니다.');
  if(api.busy(dialog)||api.hostMutationLocked()||deps.wasm.requiresPasswordForSave)throw new Error('다른 문서 작업이 끝난 뒤 차트를 편집해 주세요.');
  const generation=integer(deps.wasm.documentGeneration,'문서 세대'),fileName=text(deps.wasm.fileName,'파일 이름'),revision=text(api.revision(),'문서 버전'),identity=text(api.documentIdentity(),'문서 identity');
  if(!/\.hwpx?$/iu.test(fileName))throw new Error('HWP/HWPX 문서의 차트만 편집할 수 있습니다.');return{document,generation,fileName,revision,identity};
 };
 const assertOwner=(expected:Owner,dialog?:HTMLDialogElement)=>{const live=owner(dialog);if(live.document!==expected.document||live.generation!==expected.generation||live.fileName!==expected.fileName||live.revision!==expected.revision||live.identity!==expected.identity)throw new Error('문서 소유권이나 버전이 바뀌었습니다. 차트 창을 다시 여세요.');return live;};
 const capture=(chartIndex:number,dialog?:HTMLDialogElement):ChartStudioTarget=>{
  const owned=owner(dialog),source=readChartDataSource(owned.document,integer(chartIndex,'차트 번호'),owned.revision),target={chartIndex:source.index,source:copy(source)};sessions.set(target,{owner:owned,source});return freeze(target);
 };
 const apply=async(target:ChartStudioTarget,command:ChartStudioCommand,dialog?:HTMLDialogElement)=>{
  const sealed=sessions.get(target);if(!sealed)throw new Error('차트 편집 대상이 이 창에서 만들어지지 않았습니다.');assertOwner(sealed.owner,dialog);
  const revision=()=>assertOwner(sealed.owner,dialog).revision;let result:{before:ChartDataSource;after:ChartDataSource};
  if(command.kind==='value')result=replaceChartValue(sealed.owner.document,sealed.source,{revision:sealed.owner.revision,index:sealed.source.index,series:integer(command.series,'계열 번호'),point:integer(command.point,'값 번호'),original:command.original,value:command.value},revision);
  else if(command.kind==='series-name')result=replaceChartSeriesName(sealed.owner.document,sealed.source,{revision:sealed.owner.revision,index:sealed.source.index,series:integer(command.series,'계열 번호'),original:command.original,value:command.value},revision);
  else if(command.kind==='category-label')result=replaceChartCategoryLabel(sealed.owner.document,sealed.source,{revision:sealed.owner.revision,index:sealed.source.index,point:integer(command.point,'레이블 번호'),original:command.original,value:command.value},revision);
  else throw new Error('지원하지 않는 차트 편집 명령입니다.');
  assertOwner(sealed.owner,dialog);deps.eventBus.emit('document-mutated','chart-data-edit');
  const api=deps.api(),afterRevision=api?.revision(),afterIdentity=api?.documentIdentity();if(!api||afterIdentity!==sealed.owner.identity||typeof afterRevision!=='string'||afterRevision===sealed.owner.revision)throw new Error('차트 변경 뒤 문서 버전을 확인하지 못했습니다.');
  let rendered=true;try{await deps.render();}catch{rendered=false;}
  return{...result,beforeRevision:sealed.owner.revision,afterRevision,documentIdentity:sealed.owner.identity,rendered};
 };
 return{capture,apply};
}

export function installChartDataEditStudio(deps:Omit<Dependencies,'api'>){
 if(document.getElementById('jueony-chart-data'))throw new Error('차트 데이터 UI가 이미 설치되었습니다.');
 const api=()=> (window as any).jueonyEditor as HostApi|undefined,controller=createChartDataEditStudioController({...deps,api});
 const button=document.createElement('button');button.id='jueony-chart-data';button.type='button';button.textContent='차트 데이터';button.title='차트 값·계열 이름·범주 이름 편집';document.getElementById('jueony-title')?.append(button);
 button.addEventListener('click',()=>{
  const dialog=document.createElement('dialog');dialog.id='jueony-chart-data-dialog';dialog.className='jueony-page-dialog';dialog.style.cssText='max-width:640px;width:min(640px,calc(100vw - 32px));padding:20px';
  const title=document.createElement('h2');title.textContent='차트 데이터 편집';const status=document.createElement('p');status.setAttribute('role','status');
  const chart=document.createElement('select'),kind=document.createElement('select'),series=document.createElement('select'),point=document.createElement('select'),original=document.createElement('input'),value=document.createElement('input');
  original.readOnly=true;value.maxLength=4096;kind.append(new Option('값','value'),new Option('계열 이름','series-name'),new Option('범주 이름','category-label'));
  const apply=document.createElement('button');apply.type='button';apply.textContent='적용';const close=document.createElement('button');close.type='button';close.textContent='닫기';close.onclick=()=>dialog.close();
  let target:ChartStudioTarget|undefined;
  const renderFields=()=>{if(!target)return;const source=target.source,mode=kind.value,selectedSeries=Math.min(Number(series.value)||0,source.series.length-1);series.replaceChildren(...source.series.map((item,i)=>new Option(`${i+1}. ${item.name}`,String(i))));series.value=String(selectedSeries);
   const labels=mode==='value'?source.series[selectedSeries]?.values??[]:source.labels,selectedPoint=Math.min(Number(point.value)||0,labels.length-1);point.replaceChildren(...labels.map((item,i)=>new Option(`${i+1}. ${item}`,String(i))));point.value=String(selectedPoint);series.hidden=mode==='category-label';point.hidden=mode==='series-name';
   original.value=mode==='series-name'?source.series[selectedSeries]?.name??'':mode==='category-label'?source.labels[selectedPoint]??'':source.series[selectedSeries]?.values[selectedPoint]??'';value.value=original.value;};
  const selectChart=()=>{try{target=controller.capture(Number(chart.value),dialog);status.textContent=`차트 ${target.chartIndex+1} · ${target.source.plot} · ${target.source.axis}`;renderFields();}catch(error){target=undefined;status.textContent=error instanceof Error?error.message:String(error);apply.disabled=true;}};
  try{const first=controller.capture(0,dialog);for(const item of first.source.charts)chart.append(new Option(`차트 ${Number(item.index)+1}`,String(item.index)));target=first;apply.disabled=false;status.textContent=`차트 1 · ${first.source.plot} · ${first.source.axis}`;renderFields();}
  catch(error){status.textContent=error instanceof Error?error.message:String(error);apply.disabled=true;}
  chart.onchange=selectChart;kind.onchange=renderFields;series.onchange=renderFields;point.onchange=renderFields;
  apply.onclick=async()=>{if(!target)return;apply.disabled=true;try{const mode=kind.value,s=Number(series.value)||0,p=Number(point.value)||0,command:ChartStudioCommand=mode==='series-name'?{kind:'series-name',series:s,original:original.value,value:value.value}:mode==='category-label'?{kind:'category-label',point:p,original:original.value,value:value.value}:{kind:'value',series:s,point:p,original:original.value,value:value.value};const receipt=await controller.apply(target,command,dialog);status.textContent=receipt.rendered?'차트 데이터를 적용했습니다.':'차트는 적용했지만 화면을 즉시 새로 고치지 못했습니다.';target=controller.capture(target.chartIndex,dialog);renderFields();}
   catch(error){status.textContent=error instanceof Error?error.message:String(error);}finally{apply.disabled=!target;}};
  const row=(label:string,control:HTMLElement)=>{const p=document.createElement('p'),span=document.createElement('span');span.textContent=label+' ';p.append(span,control);return p;};
  dialog.append(title,status,row('차트',chart),row('작업',kind),row('계열',series),row('항목',point),row('원문',original),row('새 값',value),apply,close);dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);dialog.showModal();close.focus();
 });
 return{button,controller};
}
