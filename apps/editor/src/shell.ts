import {WorkspaceStore} from './mvp/store.ts';
import {addWorkspace,addChat,chatOf,uid,appendMessage} from './mvp/model.ts';
import type {AppState,Receipt,Run,SavedDocument,ModelConfig,Snapshot} from './mvp/model.ts';
import {permission,readReferences} from './mvp/references.ts';
import type {Reference} from './mvp/references.ts';
import {LocalLLMPort} from './mvp/llm.ts';
import {buildContext} from './mvp/context.ts';
import {runOnce} from './mvp/run-once.ts';

const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const store=new WorkspaceStore(),port=new LocalLLMPort();
let state:AppState,activeTab:Tab|undefined,restoring=false,persistError=false,closing=false;
let running:{controller:AbortController;run:Run}|undefined;
let editingId:string|undefined,secureStorage=false,connectionNotice='';
const connectionFlags=new Map<string,{hasKey:boolean;remember:boolean}>();
async function refreshConnections(){
 const info=await port.connections();secureStorage=info.secureStorage;connectionNotice=info.warning;connectionFlags.clear();
 for(const {config,hasKey,remember} of info.connections){connectionFlags.set(config.id,{hasKey,remember});const existing=state.models.find(m=>m.id===config.id);if(existing)Object.assign(existing,config);else state.models.push(config);}
}
function fillConnection(config?:ModelConfig){
 editingId=config?.id;
 $<HTMLInputElement>('config-label').value=config?.label??'';$<HTMLInputElement>('config-endpoint').value=config?.endpoint??'';$<HTMLInputElement>('config-model').value=config?.modelId??'';$<HTMLInputElement>('config-key').value='';$<HTMLSelectElement>('config-adapter').value=config?.adapterId??'openai-compatible';$<HTMLInputElement>('config-tokens').value=String(config?.maxOutputTokens??4096);
 $<HTMLInputElement>('config-remember').checked=secureStorage&&(config?Boolean(connectionFlags.get(config.id)?.remember):true);$<HTMLInputElement>('config-remember').disabled=!secureStorage;
 $<HTMLButtonElement>('delete-connection').disabled=!config;
 adapterHint(false);$('config-status').textContent=connectionNotice||(config&&connectionFlags.get(config.id)?.hasKey?'등록된 키가 있습니다. 키를 비워 두면 유지하며, 새 키를 입력하면 교체합니다.':'새 연결을 등록하세요. 저장된 키 원문은 화면에 표시하지 않습니다.');
}
type Tab={id:string;workspaceId:string;frame:HTMLIFrameElement;wrapper:HTMLElement;button:HTMLButtonElement;ready:Promise<any>;api:any;closed:boolean;handle?:FileSystemFileHandle;timer?:number;persistError?:boolean;persist:Promise<void>};
const tabs:Tab[]=[];const loaded=new Set<string>();let selected:Reference[]=[];
const runLabels:Record<Run['status'],string>={preparing_context:'자료 읽는 중',generating:'모델 응답 대기',validating:'명령 검증 중',applying:'문서 적용 중',completed:'완료',cancelled:'취소됨',conflict:'문서 변경 충돌',failed_no_change:'실패 · 적용 없음',failed_rolled_back:'실패 · 변경 복원됨',failed_partial:'실패 · 부분 적용 확인 필요',interrupted:'이전 실행 중단됨'};
const status=(text:string)=>{$('app-status').textContent=text;$('app-status').title=text;};
const error=(e:unknown)=>status(e instanceof Error?e.message:String(e));
const work=()=>state.workspaces.find(w=>w.id===state.activeWorkspaceId)!;
const chat=()=>chatOf(state,work().id,work().activeChatId);
const button=(label:string,action:()=>unknown)=>{const b=document.createElement('button');b.textContent=label;b.type='button';b.onclick=()=>{try{void Promise.resolve(action()).catch(error);}catch(e){error(e);}};return b;};
const on=(id:string,action:()=>unknown)=>$(id).addEventListener('click',()=>{try{void Promise.resolve(action()).catch(error);}catch(e){error(e);}});
async function persist(){try{await store.save(state);persistError=false;}catch(e){persistError=true;throw e;}}
function cancelNavigation(){if(closing||restoring){status('문서 준비 또는 닫기를 완료한 뒤 전환해 주세요.');return false;}if(running?.run.status==='applying'){status('문서 적용이 끝난 뒤 전환해 주세요.');return false;}running?.controller.abort();return true;}
function options(select:HTMLSelectElement,items:{value:string;text:string}[],value?:string){select.replaceChildren(...items.map(item=>{const o=document.createElement('option');o.value=item.value;o.textContent=item.text;return o;}));if(value&&items.some(x=>x.value===value))select.value=value;}
function renderModels(){
 const group=(m:ModelConfig)=>m.label+' | '+m.adapterId+' | '+m.endpoint;
 const providers=[...new Set(state.models.map(group))];
 const selectedModel=state.models.find(m=>m.id===chat().modelId)??state.models[0];
 options($('provider-select'),providers.length?providers.map(value=>({value,text:value.split(' | ')[0]})):[{value:'',text:'AI 연결 필요'}],selectedModel?group(selectedModel):undefined);
 const models=state.models.filter(m=>group(m)===($('provider-select') as HTMLSelectElement).value);
 options($('model-select'),models.length?models.map(m=>({value:m.id,text:m.modelId})):[{value:'',text:'모델 등록'}],selectedModel?.id);
}
function render(){
 options($('workspace-select'),state.workspaces.map(w=>({value:w.id,text:w.name})),work().id);
 $('chat-title').textContent=chat().title;
 $('chat-list').replaceChildren(...state.chats.filter(c=>c.workspaceId===work().id).map(c=>{const b=button(c.title,async()=>{if(!cancelNavigation())return;work().activeChatId=c.id;selected=[];render();await renderFolders();await persist();});b.className='chat-item'+(c.id===chat().id?' active':'');b.ondblclick=async()=>{const title=prompt('채팅 이름',c.title);if(title?.trim()){c.title=title.trim();render();await persist().catch(error);}};return b;}));
 renderModels();renderMessages();renderReferences();
 $('sidebar').style.setProperty('--chat-share',state.split+'%');$('sidebar-split').setAttribute('aria-valuenow',String(state.split));
 for(const tab of tabs){const visible=tab.workspaceId===work().id;tab.wrapper.hidden=!visible;tab.frame.hidden=!visible||tab!==activeTab;}
}
function renderMessages(){
 const target=$('messages');target.replaceChildren();
 if(!chat().messages.length){const hint=document.createElement('div');hint.className='empty-chat';hint.textContent='자료를 연결하고 업무를 시작하세요.\nAI는 오른쪽의 열린 문서를 직접 편집합니다.';target.append(hint);}
 for(const m of chat().messages){
  const card=document.createElement('article');card.className='message '+m.role;
  const role=document.createElement('div');role.className='role';role.textContent=m.role==='user'?'나':'Jueony';
  const text=document.createElement('div');text.textContent=m.text;card.append(role,text);
  const run=state.runs.find(r=>r.id===m.runId&&r.workspaceId===work().id&&r.chatId===chat().id);
  if(run&&m.role==='assistant'){
   const meta=document.createElement('div');meta.className='run-meta';meta.textContent=runLabels[run.status]+(run.sources.length?' · 전달한 자료: '+run.sources.map(s=>s.name+' ('+s.characters+'자)').join(', '):' · 참고 파일 없음');card.append(meta);
   if(run.sources.length){const detail=document.createElement('details'),summary=document.createElement('summary');summary.textContent='자료 범위와 출처';detail.append(summary);for(const source of run.sources){const info=document.createElement('div');info.textContent=source.name+' · '+source.characters+'자 · '+(run.usedSourceIds?.includes(source.id)?'모델이 참조 표시':'모델에 전달')+'\n'+(source.limitation??'UTF-8 텍스트 전체');detail.append(info);}card.append(detail);}
   if(run.receipt){const actions=document.createElement('div');actions.className='message-actions';actions.append(button('변경 확인',()=>{$('diff-before').textContent=run.receipt!.before;$('diff-after').textContent=run.receipt!.after;($('change-dialog') as HTMLDialogElement).showModal();}),button('요청 되돌리기',async()=>{if(running)throw new Error('진행 중 요청을 먼저 중지해 주세요.');const tab=tabs.find(t=>t.id===run.documentId&&t.workspaceId===run.workspaceId);if(!tab)throw new Error('열린 문서에서만 되돌릴 수 있습니다. 재시작 후에는 보존된 문서를 직접 편집해 주세요.');selectTab(tab);await tab.api.undoRequest(run.receipt);await persistTab(tab);status('이 요청의 변경을 되돌렸습니다.');}));card.append(actions);}
  }
  target.append(card);
 }
 target.scrollTop=target.scrollHeight;
}
function renderReferences(){$('reference-summary').textContent=selected.length?'이번 요청 참고: '+selected.map(s=>s.path).join(', '):'참고 파일 없음 · 폴더 트리에서 체크하세요.';}
async function renderFolders(){
 const container=$('folder-tree');container.replaceChildren();const workspaceId=work().id;
 for(const folder of state.folders.filter(f=>f.workspaceId===workspaceId)){
  const root=document.createElement('div');root.className='folder-root';container.append(root);
  const row=document.createElement('div');row.className='folder-row';root.append(row);
  const children=document.createElement('div');children.className='folder-children';
  let expanded=false;
  row.append(button('▸ '+folder.name,async()=>{if(!await permission(folder.handle,true))throw new Error('폴더 접근 권한이 없습니다. 다시 연결해 주세요.');expanded=!expanded;children.hidden=!expanded;if(expanded){children.replaceChildren();await entries(folder.handle,children,folder.name,folder.id,workspaceId);}}));
  const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.title='폴더를 이번 요청 참고 자료로 지정';checkbox.checked=selected.some(r=>r.id===folder.id);checkbox.onchange=()=>choose(checkbox.checked,{id:folder.id,workspaceId,rootId:folder.id,path:folder.name,handle:folder.handle});row.prepend(checkbox);
  row.append(button('해제',async()=>{if(!cancelNavigation())return;state.folders=state.folders.filter(f=>f.id!==folder.id);selected=selected.filter(r=>r.rootId!==folder.id);await persist();renderReferences();await renderFolders();status('폴더 연결을 해제했습니다. 원본은 그대로 있습니다.');}));
  root.append(children);
  if(!await permission(folder.handle)){const note=document.createElement('div');note.className='folder-warning';note.textContent='폴더 이름을 눌러 접근 권한을 다시 확인하세요.';root.append(note);}
 }
 if(!container.children.length){const p=document.createElement('p');p.className='hint';p.textContent='로컬 폴더를 연결해 자료를 탐색하세요.';container.append(p);}
}
function choose(checked:boolean,reference:Reference){selected=selected.filter(s=>s.id!==reference.id);if(checked)selected.push(reference);renderReferences();}
async function entries(dir:any,parent:HTMLElement,path:string,rootId:string,workspaceId:string){
 const list:[string,any][]=[];for await(const entry of dir.entries()){if(list.length>=1000)throw new Error('한 폴더의 표시는 1,000개로 제한됩니다. 하위 폴더를 연결해 주세요.');list.push(entry);}list.sort((a,b)=>Number(b[1].kind==='directory')-Number(a[1].kind==='directory')||a[0].localeCompare(b[0],'ko'));
 for(const [name,handle] of list){
  const childPath=path+'/'+name,id=rootId+'/'+childPath,row=document.createElement('div');row.className='folder-row';parent.append(row);
  const cb=document.createElement('input');cb.type='checkbox';cb.title='참고 자료 지정';cb.checked=selected.some(s=>s.id===id);cb.onchange=()=>choose(cb.checked,{id,workspaceId,rootId,path:childPath,handle});row.append(cb);
  let expanded=false;const children=document.createElement('div');children.className='folder-children';children.hidden=true;
  const label=button((handle.kind==='directory'?'▸ ':'')+name,async()=>{if(workspaceId!==work().id)return;if(handle.kind==='directory'){expanded=!expanded;children.hidden=!expanded;if(expanded){children.replaceChildren();await entries(handle,children,childPath,rootId,workspaceId);}}else if(/\.(hwp|hwpx)$/i.test(name)){await openHandle(handle);}else status('이 파일은 참고 자료로 체크할 수 있습니다. 문서 편집기는 HWP/HWPX만 엽니다.');});label.className='file-label';label.title=childPath;row.append(label);parent.append(children);
 }
}
function refreshTab(tab:Tab){
 if(tab.closed||!tab.api)return;const s=tab.api.state();tab.button.textContent=s.name;tab.button.classList.toggle('is-dirty',s.dirty);
 if(tab===activeTab){document.title=work().name+' · '+s.name+' — Jueony';$('shell-status').textContent=s.dirty?'수정됨':'저장됨';}
 clearTimeout(tab.timer);tab.timer=window.setTimeout(()=>void persistTab(tab).catch(error),1400);
}
function selectTab(tab:Tab){if(tab.workspaceId!==work().id||tab.closed)return;activeTab=tab;work().activeDocumentId=tab.id;for(const t of tabs){t.frame.hidden=t!==tab;t.wrapper.hidden=t.workspaceId!==work().id;t.wrapper.classList.toggle('is-active',t===tab);t.button.setAttribute('aria-selected',String(t===tab));}refreshTab(tab);tab.frame.contentWindow?.dispatchEvent(new Event('resize'));void persist().catch(error);}
async function newTab(workspaceId=work().id,saved?:SavedDocument){
 const frame=document.createElement('iframe');const wrapper=document.createElement('div');wrapper.className='document-tab-wrap';
 const tab:Tab={id:saved?.id??uid(),workspaceId,frame,wrapper,button:button('문서 준비 중…',()=>{if(cancelNavigation())selectTab(tab);}),closed:false,api:null,ready:Promise.resolve(null),persist:Promise.resolve()};
 tab.button.className='document-tab';tab.button.setAttribute('role','tab');
 const close=button('×',()=>closeTab(tab));close.className='close-tab';close.setAttribute('aria-label','문서 닫기');wrapper.append(tab.button,close);
 frame.className='editor-frame';frame.title='한글 문서 편집기';const url=new URL('./editor.html',location.href);url.searchParams.set('child','1');url.searchParams.set('skipRecovery','1');if(new URLSearchParams(location.search).get('storage')==='download')url.searchParams.set('storage','download');frame.src=url.href;
 tabs.push(tab);$('documents').append(frame);$('document-tab-list').append(wrapper);
 tab.ready=new Promise((resolve,reject)=>{const started=Date.now();const timer=setInterval(()=>{const api=(frame.contentWindow as any)?.jueonyEditor;if(api?.snapshot){clearInterval(timer);Promise.resolve(api.ready).then(async()=>{
 for(let i=0;i<300;i++){if(!api.busy()&&api.state().pageCount>0){tab.api=api;resolve(api);return;}await new Promise(r=>setTimeout(r,100));}
 throw new Error('문서 초기화가 완료되지 않았습니다.');
}).catch(reject);}else if(tab.closed||Date.now()-started>45000){clearInterval(timer);reject(new Error('편집기 준비 실패. 문서 탭을 다시 열어 주세요.'));}},100);});
 if(workspaceId===work().id)selectTab(tab);else frame.hidden=true;
 const api=await tab.ready;
 if(saved){await api.open(saved.bytes,saved.name,null,saved.dirty);status('최근 문서를 복원했습니다. 복원 문서는 다른 이름으로 저장해 주세요.');}
 refreshTab(tab);return tab;
}
async function persistTab(tab:Tab){
 if(tab.closed||!tab.api)return;clearTimeout(tab.timer);
 const snapshot=tab.api.recovery();if(!snapshot){tab.timer=window.setTimeout(()=>void persistTab(tab).catch(error),1500);return;}
 const data:SavedDocument={id:tab.id,workspaceId:tab.workspaceId,updatedAt:Date.now(),...snapshot};
 tab.persist=tab.persist.catch(()=>{}).then(()=>store.saveDocument(data));
 try{await tab.persist;tab.persistError=false;}catch(e){tab.persistError=true;throw e;}
}
async function openHandle(handle:FileSystemFileHandle){
 if(!cancelNavigation())return;const workspaceId=work().id;if(!await permission(handle,true))throw new Error('파일 접근 권한이 없습니다.');
 if(work().id!==workspaceId)return;
 for(const tab of tabs.filter(t=>t.workspaceId===workspaceId&&t.api?.fileHandle())){if(await handle.isSameEntry(tab.api.fileHandle())){selectTab(tab);return;}}
 const file=await handle.getFile();if(file.size>64*1024*1024)throw new Error('MVP 문서 열기는 64MB까지 지원합니다.');
 if(work().id!==workspaceId)return;const tab=await newTab(workspaceId);await tab.api.open(new Uint8Array(await file.arrayBuffer()),file.name,handle);tab.handle=handle;await persistTab(tab);status('문서를 열었습니다.');
}
async function closeTab(tab:Tab){
 if(closing||!cancelNavigation()||!tab.api||tab.api.busy())return;closing=true;
 try {
 if(tab.api.state().dirty){
  selectTab(tab);const dialog=$<HTMLDialogElement>('close-document');$('close-document-name').textContent=tab.api.state().name;dialog.returnValue='cancel';const choice=new Promise<string>(resolve=>dialog.addEventListener('close',()=>resolve(dialog.returnValue),{once:true}));dialog.showModal();const action=await choice;
  if(action==='cancel'||!action)return;if(action==='save'){if(await tab.api.save()!=='saved'||tab.api.state().dirty)return;}else if(action==='discard')await tab.api.discard();
 }
 clearTimeout(tab.timer);await tab.persist;tab.closed=true;try{await store.removeDocument(tab.id);}catch(e){tab.closed=false;refreshTab(tab);throw e;}tabs.splice(tabs.indexOf(tab),1);tab.frame.remove();tab.wrapper.remove();
 const next=tabs.find(t=>t.workspaceId===work().id);if(next)selectTab(next);else await newTab();
 }finally{closing=false;}
}
async function switchWorkspace(id:string){
 if(restoring||closing||!cancelNavigation()){render();return;}restoring=true;
 try{if(activeTab)await persistTab(activeTab);state.activeWorkspaceId=id;selected=[];activeTab=undefined;render();
  const previousDocumentId=work().activeDocumentId;
  if(!loaded.has(id)){const documents=await store.documents(id);for(const saved of documents)if(!tabs.some(t=>t.id===saved.id))await newTab(id,saved);loaded.add(id);}
  const tab=tabs.find(t=>t.workspaceId===id&&t.id===previousDocumentId)??tabs.find(t=>t.workspaceId===id)??await newTab(id);selectTab(tab);render();await renderFolders();await persist();
 }finally{restoring=false;}
}
function updateRun(){const busy=Boolean(running);$<HTMLButtonElement>('send-request').disabled=busy;$<HTMLButtonElement>('cancel-run').disabled=!busy||running?.run.status==='applying';$('run-status').textContent=running?runLabels[running.run.status]:'지원: 새 초안 · 본문 삽입/교체/삭제';}
async function send(){
 const input=$<HTMLTextAreaElement>('request-input');const request=input.value.trim();if(!request||running||restoring)return;
 const model=state.models.find(m=>m.id===$<HTMLSelectElement>('model-select').value);if(!model)throw new Error('먼저 AI 연결을 등록해 주세요.');
 const original=activeTab;if(!original?.api||original.workspaceId!==work().id)throw new Error('문서 준비를 기다려 주세요.');
 const workspaceId=work().id,chatId=chat().id,run:Run={id:uid(),workspaceId,chatId,documentId:original.id,status:'preparing_context',model:{adapterId:model.adapterId,label:model.label,endpoint:model.endpoint,modelId:model.modelId,maxOutputTokens:model.maxOutputTokens},sources:[],createdAt:Date.now()};
 const controller=new AbortController();running={controller,run};state.runs.push(run);appendMessage(state,workspaceId,chatId,{id:uid(),role:'user',text:request,runId:run.id});input.value='';renderMessages();updateRun();
 try{
  await persist();const snapshot:Snapshot=original.api.snapshot();
  const references=await readReferences([...selected],state.folders,workspaceId,bytes=>original.api.readReference(bytes),controller.signal,async handle=>{
   for(const tab of tabs.filter(t=>t.workspaceId===workspaceId&&t.api?.fileHandle()))if(await handle.isSameEntry(tab.api.fileHandle())){const current:Snapshot=tab.api.snapshot();return {text:current.plainText??current.nodes.map(n=>n.text).join('\n'),revision:current.revision};}
   return undefined;
  });
  run.sources=references.map(({text,...source})=>source);
  const context=buildContext(state,workspaceId,chatId,snapshot,references,request);
  const result=await runOnce({runId:run.id,context,model,port,editor:original.api,signal:controller.signal,
   isCurrent:()=>work().id===workspaceId&&chat().id===chatId&&activeTab?.id===run.documentId,
   createDocument:async()=>{const tab=await newTab(workspaceId);run.documentId=tab.id;return tab.api;},
   state:s=>{run.status=s;updateRun();void persist().catch(error);}});
  run.status='completed';run.receipt=result.receipt;run.usedSourceIds=result.sourceIds;
  appendMessage(state,workspaceId,chatId,{id:uid(),role:'assistant',runId:run.id,text:result.message+'\n\n'+(result.receipt?result.receipt.operationCount+'개 명령을 실제 문서에 적용했습니다. 파일 저장은 별도로 실행하세요.':'문서에 적용한 변경은 없습니다.')});
  const tab=tabs.find(t=>t.id===run.documentId);
  try{if(tab)await persistTab(tab);status('AI 요청이 완료되었습니다.');}catch(e){persistError=true;run.error='문서 변경은 적용됐지만 로컬 복구본 저장에 실패했습니다. 문서를 파일로 저장해 주세요.';appendMessage(state,workspaceId,chatId,{id:uid(),role:'assistant',runId:run.id,text:run.error});status(run.error);}
 }catch(e){
  const name=e instanceof Error?e.name:'';run.status=controller.signal.aborted||name==='AbortError'?'cancelled':name==='ConflictError'?'conflict':name==='PartialApplyError'?'failed_partial':name==='RolledBackError'?'failed_rolled_back':'failed_no_change';run.error=run.status==='cancelled'?'요청을 취소했습니다. 이 요청의 변경을 적용하지 않았습니다.':e instanceof Error?e.message:'실행 오류';
  appendMessage(state,workspaceId,chatId,{id:uid(),role:'assistant',runId:run.id,text:run.error});error(e);
 }finally{running=undefined;await persist().catch(error);renderMessages();updateRun();}
}
on('add-workspace',async()=>{if(!cancelNavigation())return;const name=prompt('새 업무 이름');if(!name?.trim())return;const w=addWorkspace(state,name);await switchWorkspace(w.id);});
on('rename-workspace',async()=>{const name=prompt('업무 이름',work().name);if(name?.trim()){work().name=name.trim();render();await persist();}});
$('workspace-select').addEventListener('change',()=>void switchWorkspace($<HTMLSelectElement>('workspace-select').value).catch(error));
on('add-chat',async()=>{if(!cancelNavigation())return;addChat(state,work().id,'새 채팅');selected=[];render();await renderFolders();await persist();});
on('add-folder',async()=>{const picker=(window as any).showDirectoryPicker;if(!picker)throw new Error('폴더 연결은 Jueony 실행기의 Edge/Chrome 창에서 지원합니다.');const workspaceId=work().id;const handle=await picker({mode:'read'});if(work().id!==workspaceId)return;for(const f of state.folders.filter(f=>f.workspaceId===workspaceId))if(await handle.isSameEntry(f.handle)){status('이미 연결한 폴더입니다.');return;}state.folders.push({id:uid(),workspaceId,name:handle.name,handle});await persist();await renderFolders();status('폴더를 연결했습니다. 아직 자료를 분석하지 않았습니다.');});
on('refresh-folders',renderFolders);
on('toggle-sidebar',()=>$('app-shell').classList.toggle('sidebar-hidden'));
on('new-document',async()=>{if(cancelNavigation())await newTab();});
on('open-document',async()=>{const picker=(window as any).showOpenFilePicker;if(picker){const [handle]=await picker({types:[{description:'한글 문서',accept:{'application/octet-stream':['.hwp','.hwpx']}}]});await openHandle(handle);}else{const file=document.createElement('input');file.type='file';file.accept='.hwp,.hwpx';file.onchange=async()=>{const f=file.files?.[0];if(f&&cancelNavigation()){try{const tab=await newTab();await tab.api.open(new Uint8Array(await f.arrayBuffer()),f.name);await persistTab(tab);}catch(e){error(e);}}};file.click();}});
on('save-document',async()=>{if(running?.run.status==='applying')return;if(activeTab?.api){const tab=activeTab;const result=await tab.api.save();await persistTab(tab);status(result==='saved'?'파일에 저장했습니다.':'저장을 완료하지 않았습니다.');}});
$('request-form').addEventListener('submit',e=>{e.preventDefault();void send().catch(error);});
on('cancel-run',()=>running?.controller.abort());
$('provider-select').addEventListener('change',()=>{const value=$<HTMLSelectElement>('provider-select').value;const m=state.models.find(m=>m.label+' | '+m.adapterId+' | '+m.endpoint===value);chat().modelId=m?.id;renderModels();void persist().catch(error);});
$('model-select').addEventListener('change',()=>{chat().modelId=$<HTMLSelectElement>('model-select').value;void persist().catch(error);});
on('connection-settings',async()=>{await refreshConnections();const config=state.models.find(m=>m.id===$<HTMLSelectElement>('model-select').value);fillConnection(config);$<HTMLDialogElement>('model-dialog').showModal();});
on('new-connection',()=>fillConnection());
on('delete-connection',async()=>{if(running)throw new Error('진행 중 요청이 끝난 뒤 연결을 삭제해 주세요.');if(!editingId)return;const id=editingId;await port.removeConnection(id);state.models=state.models.filter(m=>m.id!==id);connectionFlags.delete(id);await persist();renderModels();fillConnection();$('config-status').textContent='선택한 연결과 저장된 키를 삭제했습니다.';});
$('model-dialog').addEventListener('close',()=>{$<HTMLInputElement>('config-key').value='';});
on('clear-credentials',async()=>{if(running)throw new Error('진행 중 요청이 끝난 뒤 키를 삭제해 주세요.');await port.clearCredentials();connectionFlags.clear();connectionNotice='';$<HTMLInputElement>('config-key').value='';adapterHint(false);$('config-status').textContent='실행 중인 키와 암호화 저장된 키를 모두 삭제했습니다. 모델 설정은 유지됩니다.';});
on('close-settings',()=>{$<HTMLInputElement>('config-key').value='';$<HTMLDialogElement>('model-dialog').close();});
let settingsBusy=false;
function adapterHint(reset:boolean){
 const native=$<HTMLSelectElement>('config-adapter').value==='hyperclova';
 $('config-token-field').hidden=!native;$<HTMLInputElement>('config-tokens').disabled=!native;
 $('adapter-hint').textContent=native?'일반 NAVER Cloud · HCX-005 / HCX-007 지원. 서비스 앱에서 승인된 모델을 선택하세요. Endpoint는 /v3/chat-completions까지 입력합니다. HCX-005는 함수 호출 방식으로 1,024~4,096 출력 토큰을 사용합니다.':'Chat Completions 호환 서버를 연결합니다. GPT 전용 Responses, Claude·Gemini 전용 adapter는 아직 구현하지 않았습니다.';
 $<HTMLInputElement>('config-key').required=native&&!connectionFlags.get(editingId??'')?.hasKey;
 $<HTMLInputElement>('config-key').placeholder=connectionFlags.get(editingId??'')?.hasKey?'비워 두면 기존 키 유지 · 새 키 입력 시 교체':native?'CLOVA Studio에서 발급한 API 키':'인증이 없는 로컬 서버는 비워 둘 수 있습니다.';
 if(reset){
  $<HTMLInputElement>('config-key').value='';
  $<HTMLInputElement>('config-endpoint').value=native?'https://clovastudio.stream.ntruss.com/v3/chat-completions':'';
  $<HTMLInputElement>('config-model').value=native?'HCX-005':'';
  $<HTMLInputElement>('config-label').value=native?'NAVER Cloud 개발':'';
 }
 const hcx005=native&&$<HTMLInputElement>('config-model').value==='HCX-005';
 $<HTMLInputElement>('config-tokens').min=hcx005?'1024':'128';$<HTMLInputElement>('config-tokens').max=hcx005?'4096':'8192';
}
$('config-adapter').addEventListener('change',()=>adapterHint(true));
$('config-model').addEventListener('input',()=>adapterHint(false));
$('model-dialog').addEventListener('cancel',event=>{if(settingsBusy)event.preventDefault();});
async function configureModel(testOnly:boolean){
 const form=$<HTMLFormElement>('model-form');if(settingsBusy||!form.reportValidity())return;
 const endpoint=$<HTMLInputElement>('config-endpoint').value.trim(),modelId=$<HTMLInputElement>('config-model').value.trim();
 const adapterId=$<HTMLSelectElement>('config-adapter').value as ModelConfig['adapterId'];
 const existing=state.models.find(m=>m.id===editingId);
 const config:ModelConfig={id:existing?.id??uid(),adapterId,label:$<HTMLInputElement>('config-label').value.trim(),endpoint,modelId,...(adapterId==='hyperclova'?{maxOutputTokens:Number($<HTMLInputElement>('config-tokens').value)}:{})};
 const keyValue=$<HTMLInputElement>('config-key').value;
 const key=keyValue||((editingId&&connectionFlags.get(editingId)?.hasKey)?undefined:'');
 const remember=$<HTMLInputElement>('config-remember').checked&&secureStorage;
 settingsBusy=true;for(const control of form.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLButtonElement>('input,select,button'))control.disabled=true;
 try{
  if(testOnly){$('config-status').textContent='합성 요청으로 연결 확인 중…';await port.testConnection(config,key);$('config-status').textContent='연결 테스트 성공 · 문서/대화/자료 전송 없음. 새로 입력한 키는 테스트로 저장되지 않습니다. 저장하려면 다시 입력하고 연결 저장을 누르세요.';}
  else{await port.configure(config,key,remember);if(existing)Object.assign(existing,config);else state.models.push(config);await refreshConnections();chat().modelId=config.id;await persist();renderModels();$<HTMLDialogElement>('model-dialog').close();status(remember?'연결을 암호화해 저장했습니다. 재실행 후에도 사용할 수 있습니다.':'연결을 등록했습니다. 키는 현재 서버 실행 중에만 유지됩니다.');}
 }catch(e){$('config-status').textContent=e instanceof Error?e.message:String(e);}
 finally{settingsBusy=false;$<HTMLInputElement>('config-key').value='';for(const control of form.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLButtonElement>('input,select,button'))control.disabled=false;$<HTMLInputElement>('config-remember').disabled=!secureStorage;$<HTMLButtonElement>('delete-connection').disabled=!editingId;adapterHint(false);}
}
on('test-connection',()=>configureModel(true));
$('model-form').addEventListener('submit',e=>{e.preventDefault();void configureModel(false).catch(error);});
const split=$('sidebar-split');let dragging=false;
split.addEventListener('pointerdown',e=>{dragging=true;split.setPointerCapture(e.pointerId);});
split.addEventListener('pointermove',e=>{if(!dragging)return;const rect=$('sidebar').getBoundingClientRect();state.split=Math.max(20,Math.min(75,Math.round((e.clientY-rect.top)/rect.height*100)));$('sidebar').style.setProperty('--chat-share',state.split+'%');split.setAttribute('aria-valuenow',String(state.split));});
split.addEventListener('pointerup',()=>{dragging=false;void persist().catch(error);});
split.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();state.split=Math.max(20,Math.min(75,state.split+(e.key==='ArrowUp'?-3:3)));$('sidebar').style.setProperty('--chat-share',state.split+'%');split.setAttribute('aria-valuenow',String(state.split));void persist().catch(error);}});
window.addEventListener('message',event=>{if(event.origin!==location.origin)return;const tab=tabs.find(t=>t.frame.contentWindow===event.source);if(!tab)return;if(event.data?.type==='jueony:status')refreshTab(tab);if(event.data?.type==='jueony:new-document'&&tab===activeTab&&cancelNavigation())void newTab().catch(error);});
window.addEventListener('beforeunload',event=>{if(persistError||running||tabs.some(t=>t.persistError||t.api?.state().dirty)){event.preventDefault();event.returnValue='';}});
async function start(){await store.open();state=await store.load();try{await refreshConnections();}catch{connectionNotice='AI 서버를 최신 실행기로 다시 시작해 주세요. 로컬 문서 편집은 사용할 수 있습니다.';}if(!state.workspaces.length)addWorkspace(state,'내 업무');if(!state.workspaces.some(w=>w.id===state.activeWorkspaceId))state.activeWorkspaceId=state.workspaces[0].id;render();await switchWorkspace(state.activeWorkspaceId);status('로컬 업무 준비 완료 · '+(connectionNotice||'AI 연결 설정에서 연결과 키를 변경할 수 있습니다.'));}
// One writer per browser profile/origin prevents whole-state writes from
// competing application windows from overwriting each other's workspaces.
void navigator.locks.request('jueony-workspace-writer',{ifAvailable:true},async lock=>{
 if(!lock){$('app-shell').inert=true;$<HTMLButtonElement>('connection-settings').disabled=true;status('다른 Jueony 창이 열려 있습니다. 기존 창을 사용하거나 닫은 뒤 이 창을 새로고침해 주세요.');return;}
 await start();
 await new Promise<void>(()=>{});
}).catch(error);
