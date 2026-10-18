import {createHwtLeafWorkspace,restoreHwtLeafWorkspace} from '../modules/xml-documents/public/hwt-leaf.ts';
import type {HwtLeafEnginePort,HwtLeafRecoveryPort,HwtLeafSavePort,HwtLeafCheckpoint,HwtLeafWorkspace,HwtLeafRequest} from '../modules/xml-documents/public/hwt-leaf.ts';
export interface HwtLeafDialogOptions {engine:HwtLeafEnginePort;recovery?:HwtLeafRecoveryPort;createSaveCopy?:(revision:()=>string)=>HwtLeafSavePort}
/** Independent HWT bytes, history and recovery. Never opens/replaces the active HWP. */
export function showHwtLeafDialog(options:HwtLeafDialogOptions):HTMLDialogElement {
 if(document.querySelector('#hwt-leaf-workspace[open]'))throw Error('HWT 일반 필드 편집 창이 이미 열려 있습니다.');
 const dialog=document.createElement('dialog');dialog.id='hwt-leaf-workspace';dialog.style.cssText='width:min(900px,90vw);max-height:90vh;overflow:auto;color:inherit;background:var(--panel-bg,#fff)';
 const title=document.createElement('h2');title.textContent='HWT 일반 필드 편집 · 제한된 지원';
 const limits=document.createElement('p');limits.textContent='단순 루트 sequence의 xs:string과 문단별 단일 ClickHere 일반 필드가 정확히 연결된 HWT만 지원합니다. 그룹·폼·중복 이름·복합 스키마·XSL·일반 HWT 편집은 지원하지 않습니다. 원래 XMLTemplate과 기타 스트림을 보존한 같은 .hwt 사본만 저장합니다.';
 const input=document.createElement('input');input.type='file';input.accept='.hwt';input.dataset.hwtLeafInput='';
 const error=document.createElement('p');error.setAttribute('role','alert');error.dataset.hwtLeafError='';
 const status=document.createElement('p');status.setAttribute('role','status');status.dataset.hwtLeafStatus='';
 const tree=document.createElement('section');tree.dataset.hwtLeafTree='';
 const editor=document.createElement('fieldset'),legend=document.createElement('legend'),value=document.createElement('textarea');value.rows=4;value.maxLength=512;value.dataset.hwtLeafValue='';editor.append(legend,value);editor.hidden=true;
 let workspace:HwtLeafWorkspace|undefined,name='document.hwt',token:string|null=null,pending:HwtLeafCheckpoint|null=null,busy=Boolean(options.recovery),blocked=false,checkpointFailed=false,selected:Omit<HwtLeafRequest,'text'>|undefined;
 const saveCopy=options.createSaveCopy?.(()=>{const s=workspace?.snapshot();return s?`${s.instance}:${s.revision}:${s.sourceSha256}`:'';});
 const buttons:HTMLButtonElement[]=[];
 function showError(e:unknown){error.textContent=e instanceof Error?e.message:String(e);}
 function button(text:string,action:string,run:()=>void|Promise<void>){const b=document.createElement('button');b.textContent=text;b.type='button';b.dataset.hwtLeafAction=action;b.onclick=()=>{if(busy)return;busy=true;error.textContent='';disabled();void Promise.resolve().then(run).catch(showError).finally(()=>{busy=false;if(dialog.isConnected)disabled();});};buttons.push(b);return b;}
 async function checkpoint(){if(!workspace||!options.recovery)return;checkpointFailed=true;const saved=await options.recovery.write({name,state:workspace.captureRecovery()},token);token=saved.token;checkpointFailed=false;}
 async function changed(run:()=>Promise<unknown>){await run();render();try{await checkpoint();}catch(e){throw Error('HWT 변경·기록은 유지했지만 복구본 저장에 실패했습니다. 같은 형식의 사본을 저장하세요. '+(e instanceof Error?e.message:String(e)));}}
 const open=button('HWT 일반 필드 불러오기','open',async()=>{const file=input.files?.[0];if(!file)throw Error('HWT 파일을 선택하세요.');if(!file.size||file.size>32*1024*1024)throw Error('HWT 파일은 32MiB 이하여야 합니다. 파일을 읽지 않았습니다.');if(!file.name.toLowerCase().endsWith('.hwt'))throw Error('.hwt 원본을 선택하세요.');
  const candidate=await createHwtLeafWorkspace(options.engine,new Uint8Array(await file.arrayBuffer()),crypto.randomUUID());
  if(workspace?.snapshot().dirty&&!confirm('현재 HWT 변경 내용을 버리고 선택한 문서를 여시겠습니까?'))return;
  workspace=candidate;name=file.name;render();await checkpoint();
 });
 const restore=button('보관한 HWT 작업 복원','restore',async()=>{if(!pending)return;const candidate=await restoreHwtLeafWorkspace(options.engine,pending.state,crypto.randomUUID());workspace=candidate;name=pending.name;token=pending.token;pending=null;checkpointFailed=false;render();status.textContent+=' · 원문·현재값·되돌리기 기록 복원';});
 const discardPending=button('보관한 HWT 복구본 폐기','discard-recovery',async()=>{if(!pending||!options.recovery||!confirm('보관한 HWT 작업·복구본을 폐기할까요? 원본 파일은 유지합니다.'))return;await options.recovery.discard(pending.token);pending=null;token=null;status.textContent='HWT 복구본을 폐기했습니다. 원본 파일은 유지합니다.';});
 const undo=button('되돌리기','undo',()=>changed(async()=>workspace?.undo())),redo=button('다시 실행','redo',()=>changed(async()=>workspace?.redo()));
 const apply=button('일반 필드 값 적용','replace',async()=>{if(!workspace||!selected)return;await changed(()=>workspace!.edit({...selected!,text:value.value}));});editor.append(apply);
 const save=button('같은 HWT 사본 저장','save',async()=>{if(!workspace||!saveCopy)throw Error('이 환경은 HWT 실제 파일 저장을 지원하지 않습니다.');const artifact=await workspace.exportArtifact(),receipt=await saveCopy.saveCopy(artifact.bytes,name);
  if(receipt.status==='cancelled'){status.textContent='HWT 저장 위치 선택을 취소했습니다. 편집·기록·원본은 유지합니다.';return;}
  if(receipt.status==='failed_partial'){showError(Error(receipt.message));return;}
  workspace.markSaved(artifact.revision,artifact.sourceSha256);name=receipt.name;render();status.textContent+=' · 같은 HWT 파일 쓰기·닫기·디스크 재읽기 확인';try{await checkpoint();}catch(e){throw Error('HWT 파일 저장은 확인했지만 복구본 갱신에 실패했습니다. '+(e instanceof Error?e.message:String(e)));}
 });
 const retry=button('복구본 다시 저장','checkpoint',async()=>{await checkpoint();status.textContent='현재 HWT 작업의 로컬 복구본 저장을 확인했습니다. 디스크 파일 저장은 별도입니다.';});
 function mayClose(){return!workspace?.snapshot().dirty&&!checkpointFailed||confirm(checkpointFailed?'HWT 복구 저장에 실패했습니다. 사본 저장 여부를 확인한 뒤 닫으시겠습니까?':options.recovery?'HWT 변경과 기록은 로컬 복구본에 보관됩니다. 닫으시겠습니까?':'저장하지 않은 HWT 변경이 있습니다. 그래도 닫으시겠습니까?');}
 const close=button('닫기','close',()=>{if(mayClose())dialog.close();});
 const discard=button('HWT 작업 폐기하고 닫기','discard-close',async()=>{if(!confirm('HWT 작업과 복구본을 폐기할까요? 원본 파일은 유지합니다.'))return;if(options.recovery&&token)await options.recovery.discard(token);dialog.close();});
 function disabled(){for(const b of buttons)b.disabled=busy;const s=workspace?.snapshot();input.disabled=open.disabled=busy||blocked||Boolean(pending);restore.hidden=discardPending.hidden=!pending;undo.disabled=busy||!s?.canUndo;redo.disabled=busy||!s?.canRedo;save.disabled=busy||!workspace||!saveCopy;save.title=saveCopy?'사용자가 고른 .hwt 사본의 실제 쓰기와 재읽기를 검사합니다.':'이 환경에는 실제 HWT 사본 저장 경계가 없습니다.';apply.disabled=value.disabled=busy||!selected;retry.hidden=!options.recovery||!workspace;retry.disabled=busy||blocked;discard.hidden=!workspace||!options.recovery;discard.disabled=busy||blocked;for(const b of tree.querySelectorAll('button'))b.disabled=busy;}
 function render(){selected=undefined;editor.hidden=true;tree.replaceChildren();if(workspace){const s=workspace.snapshot();status.textContent=`${name} · 일반 필드 ${s.fields.length}개 · ${s.dirty?'수정됨':'저장된 원문'} · 버전 ${s.revision}`;for(const f of s.fields){const b=document.createElement('button');b.type='button';b.dataset.hwtLeafId=String(f.fieldId);b.textContent=`${f.name}: ${f.value}`;b.onclick=()=>{if(busy)return;selected={instance:s.instance,revision:s.revision,sourceSha256:s.sourceSha256,fieldId:f.fieldId,originalText:f.value};legend.textContent=f.name;value.value=f.value;editor.hidden=false;disabled();};tree.append(b);}}disabled();}
 dialog.addEventListener('cancel',e=>{if(busy||!mayClose())e.preventDefault();});const unload=(e:BeforeUnloadEvent)=>{if(busy||checkpointFailed||workspace?.snapshot().dirty){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',unload);dialog.addEventListener('close',()=>{window.removeEventListener('beforeunload',unload);dialog.remove();},{once:true});
 dialog.append(title,limits,input,open,restore,discardPending,error,status,undo,redo,save,retry,tree,editor,discard,close);document.body.append(dialog);render();dialog.showModal();
 if(options.recovery){status.textContent='이 문서 창·업무의 HWT 복구본을 검사하고 있습니다.';void options.recovery.read().then(r=>{if(dialog.isConnected){pending=r;status.textContent=r?`보관한 HWT 작업: ${r.name}. 명시적으로 복원하거나 폐기하세요.`:'보관한 HWT 작업이 없습니다.';}}).catch(e=>{blocked=true;showError(e);}).finally(()=>{busy=false;if(dialog.isConnected)disabled();});}
 return dialog;
}
