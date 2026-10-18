import type {HwtMappingRead95} from '../modules/xml-documents/public/hwt-template95.ts';

export interface HwtInspectionView95 {sourceSha256:string;schemaName:string;schema:string;mapping:string;structure:HwtMappingRead95;readOnly:true}
function view(value:unknown):HwtInspectionView95{
 if(!value||typeof value!=='object')throw Error('HWT 구조 읽기 결과가 없습니다.');
 const v=value as Partial<HwtInspectionView95>;
 if(v.readOnly!==true||!v.structure||v.structure.profile!=='hwt-schema-addresses-v1'||v.structure.readOnly!==true||!Array.isArray(v.structure.entries)||v.structure.entries.length>4096||typeof v.sourceSha256!=='string'||!/^[0-9a-f]{64}$/.test(v.sourceSha256)||typeof v.schemaName!=='string'||typeof v.schema!=='string'||typeof v.mapping!=='string'||v.schema.length>1_000_000||v.mapping.length>1_000_000)throw Error('검증된 읽기 전용 HWT 구조가 아닙니다.');
 for(const e of v.structure.entries)if(typeof e.name!=='string'||e.name.length>512||typeof e.schemaXPath!=='string'||e.schemaXPath.length>4096||e.bodyBinding!=='unverified'||!Array.isArray(e.mappingPath)||e.mappingPath.length>32||e.mappingPath.some(i=>!Number.isSafeInteger(i)||i<0))throw Error('지원하지 않는 HWT 필드 연결 응답입니다.');
 return v as HwtInspectionView95;
}

/** An independent, clean read-only modal; never owns XML/HWP recovery/history. */
export function showHwtTemplate95Dialog(options:{inspect:(bytes:Uint8Array)=>unknown|Promise<unknown>}):HTMLDialogElement{
 if(document.querySelector('#hwt-template95-inspector[open]'))throw Error('HWT 구조 읽기 창이 이미 열려 있습니다.');
 const dialog=document.createElement('dialog');dialog.id='hwt-template95-inspector';dialog.style.cssText='width:min(900px,90vw);max-height:90vh;overflow:auto;color:inherit;background:var(--panel-bg,#fff)';
 const title=document.createElement('h2');title.textContent='HWT XML 서식 구조 · 읽기 전용';
 const limits=document.createElement('p');limits.textContent='지원하는 XMLTemplate 스트림과 Name·SchemaXPath의 정확한 연결만 읽습니다. HWP 본문 필드 연결·값 편집·HWT 재저장·XSL 지면 변환은 지원하지 않습니다. 원본과 기존 XML 작업·복구본은 바뀌지 않습니다.';
 const input=document.createElement('input');input.type='file';input.accept='.hwt';input.dataset.hwtInput='';
 const label=document.createElement('label');label.append('HWT 서식 파일 (32MiB 이하) ',input);
 const error=document.createElement('p');error.setAttribute('role','alert');error.dataset.hwtError='';
 const status=document.createElement('p');status.setAttribute('role','status');status.dataset.hwtStatus='';
 const tree=document.createElement('section');tree.dataset.hwtTree='';
 const open=document.createElement('button');open.type='button';open.textContent='HWT 구조 읽기';open.dataset.hwtAction='open';
 const close=document.createElement('button');close.type='button';close.textContent='닫기';close.dataset.hwtAction='close';let busy=false;
 function disabled(){input.disabled=open.disabled=close.disabled=busy;}
 open.onclick=()=>{if(busy)return;error.textContent='';const file=input.files?.[0];if(!file){error.textContent='HWT 서식 파일을 선택하세요.';return;}if(file.size>32*1024*1024){error.textContent='HWT 파일은 32MiB 이하여야 합니다. 파일을 읽지 않았습니다.';return;}
  busy=true;disabled();status.textContent='HWT 구조를 검사하고 있습니다.';
  void Promise.resolve().then(()=>file.arrayBuffer()).then(bytes=>options.inspect(new Uint8Array(bytes))).then(value=>{
   const r=view(value);if(!dialog.isConnected)return;const nodes=document.createDocumentFragment();
   for(const entry of r.structure.entries){const line=document.createElement('p');line.style.marginLeft=`${entry.mappingPath.length*12}px`;line.textContent=`${entry.name} · ${entry.schemaXPath} · 본문 연결 미검증`;nodes.append(line);}
   tree.replaceChildren(nodes);status.textContent=`${file.name} · ${r.schemaName} · 검증된 스키마 주소 ${r.structure.entries.length}개 · 읽기 전용 · 원본 SHA-256 ${r.sourceSha256}`;
  }).catch(e=>{if(dialog.isConnected){error.textContent=e instanceof Error?e.message:String(e);status.textContent='선택한 HWT 구조 읽기에 실패했습니다. 이전 읽기 결과와 원본 파일은 유지합니다.';}}).finally(()=>{busy=false;if(dialog.isConnected)disabled();});
 };
 close.onclick=()=>{if(!busy)dialog.close();};dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});dialog.addEventListener('close',()=>dialog.remove(),{once:true});
 dialog.append(title,limits,label,open,error,status,tree,close);document.body.append(dialog);dialog.showModal();return dialog;
}
