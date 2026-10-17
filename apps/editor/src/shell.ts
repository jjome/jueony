import {createAgentFilePort} from './adapters/desktop/agent-files.ts';
import {readDocumentWindowContext,mainDocumentWindow,createDocumentWindows,assertTabCapacity} from './adapters/desktop/document-windows.ts';
import {installNativeFilePickers,installNativeExitProtection,nativeFileToken,nativeRecentHandle} from './adapters/desktop/native-host.ts';
import {createNativeRecents} from './adapters/desktop/native-recents.ts';
import {createDocumentLifecycle,assertExitSavedTransition} from './adapters/desktop/document-lifecycle.ts';
import {withExitSaveFrame} from './adapters/desktop/exit-save-frame.ts';
import type {NativeExitConfirmation} from './adapters/desktop/native-host.ts';
import {readDocumentFailure} from './modules/document/public/index.ts';
import {connectDocumentFrame} from './adapters/iframe/document-client.ts';
import type {DocumentFrameClient} from './adapters/iframe/document-client.ts';
import {installUnifiedChrome} from './unified-chrome.ts';
import {createAutomationFacade} from './modules/automation/public/index.ts';
import type {CommandTemplate,CommandMacro} from './modules/automation/public/index.ts';
import {installDocumentDefaultsPanel} from './ui/document-defaults-panel.ts';
import {agent} from './composition/agent.ts';
import {createRecoveryCoordinator,normalizeRecoverySettings,createDocumentViewJournal} from './modules/preferences/public/index.ts';
import {readRecoverySettings,watchRecoverySettings,browserRecoveryClock} from './adapters/browser/recovery-settings.ts';

import {assertRecoveryRecord,partitionRecoveryRecords} from './modules/document-files/public/index.ts';
import {recoveryIntegrity} from './adapters/storage/recovery-integrity.ts';
import {createSessionFacade,createSessionGuard,shouldProtectExit} from './modules/session/public/index.ts';
import type {StoredFileConnection} from './file-connection.ts';
import {describeStructure} from './modules/document/public/index.ts';
import {installPaneResize} from './pane-layout.ts';

import {uid} from './mvp/model.ts';
import {createWorkspaceFacade} from './modules/workspace/public/index.ts';
import type {AppState,Receipt,Run,SavedDocument,ModelConfig,Snapshot} from './mvp/model.ts';
import {permission,readReferences} from './adapters/files/references.ts';
import type {Reference} from './mvp/references.ts';
import {createWorkbenchServices} from './composition/workbench.ts';


import {installConnectionsPanel} from './ui/connections-panel.ts';
import {installDocumentTabCycle} from './adapters/browser/document-tab-cycle.ts';
import {TemporaryReferences} from './adapters/files/temporary-references.ts';

const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const {store,connections:port,modelGateway}=createWorkbenchServices();
let state:AppState,activeTab:Tab|undefined,restoring=false,persistError=false,closing=false,stateWrites=0;
let running:{controller:AbortController;run:Run}|undefined;
const nativeHost=installNativeFilePickers(window);
let documentWindow=mainDocumentWindow;
let agentFilePending=false;const agentFileAuthority=Symbol('agent-current-workspace-tab-action');
let nativeExitPending=false,nativeExit:ReturnType<typeof installNativeExitProtection>|undefined;
type Tab={id:string;workspaceId:string;frame:HTMLIFrameElement;wrapper:HTMLElement;button:HTMLButtonElement;ready:Promise<DocumentFrameClient|null>;api:DocumentFrameClient|null;closed:boolean;initialized:boolean;restoreError?:string;pendingConnection?:StoredFileConnection;pendingIdentity?:string;handle?:FileSystemFileHandle;timer?:number;persistError?:boolean;preferenceError?:boolean;preferenceMessage?:string;pendingWrites?:number;persist:Promise<void>;recovery?:ReturnType<typeof createRecoveryCoordinator>;disposeTabCycle?:()=>void;cachedDocument?:SavedDocument};
const tabs:Tab[]=[];const loaded=new Set<string>();let recoveryWarning=false;let selected:Reference[]=[];
const viewJournal=createDocumentViewJournal({getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)});
const viewClocks=new Map<string,number>();let viewJournalError=false;
function viewStamp(tab:Tab){const stored=tab.cachedDocument?.viewUpdatedAt;const value=Math.max(Date.now(),viewClocks.get(tab.id)??0,Number.isSafeInteger(stored)?stored!:0)+1;viewClocks.set(tab.id,value);return value;}
function checkpointExitView(){
 try{
  const eligible=tabs.filter(tab=>!tab.closed&&tab.initialized&&tab.cachedDocument&&tab.api);
  const ordered=[...eligible.filter(tab=>tab!==activeTab),...eligible.filter(tab=>tab===activeTab)];
  const entries=ordered.flatMap(tab=>{const view=tab.api!.captureDocumentView();return view?[{documentId:tab.id,workspaceId:tab.workspaceId,checkpointAt:tab.cachedDocument!.updatedAt,recordedAt:viewStamp(tab),view}]:[];});
  if(entries.length){viewJournal.checkpoint(entries);viewJournalError=false;}
 }catch(e){viewJournalError=true;error(e);}
}
const temporary=new TemporaryReferences();
const automation=createAutomationFacade();
const phaseLabels:Record<string,string>={generating:'초안 생성',reviewing:'계획 검토',validated:'명령 확인',ready:'적용 준비',applying:'문서 적용',completed:'완료',stopped:'중단'};
const runLabels:Record<Run['status'],string>={preparing_context:'자료 읽는 중',generating:'모델 응답 대기',validating:'명령 검증 중',applying:'문서 적용 중',completed:'완료',cancelled:'취소됨',conflict:'문서 변경 충돌',failed_no_change:'실패 · 적용 없음',failed_rolled_back:'실패 · 변경 복원됨',failed_partial:'실패 · 부분 적용 확인 필요',interrupted:'이전 실행 중단됨'};
const status=(text:string)=>{$('app-status').textContent=text;$('app-status').title=text;};
const error=(e:unknown)=>status(readDocumentFailure(e).message);
let recoverySettings=normalizeRecoverySettings(undefined);
try{recoverySettings=readRecoverySettings(localStorage);}catch(e){error(e);}
const recoverySettingsWatcher=watchRecoverySettings({storage:localStorage,events:window,onChange:value=>{recoverySettings=value;for(const tab of tabs)tab.recovery?.updateSettings(value);},onError:error});
const requestError=(e:unknown)=>{error(e);$('request-error').textContent=readDocumentFailure(e).message;$('request-error').hidden=false;};
const work=()=>state.workspaces.find(w=>w.id===state.activeWorkspaceId)!;
const workspace=createWorkspaceFacade({state:{current:()=>state},ids:{next:uid}});
const chat=()=>workspace.chat(work().id,work().activeChatId);
const session=createSessionFacade({state:{activeWorkspaceId:()=>state.activeWorkspaceId,workspaces:()=>state.workspaces,tabs:()=>tabs.map(({id,workspaceId,closed})=>({id,workspaceId,closed}))},lifecycle:{setOrder:(id,order)=>{workspace.workspace(id).documentOrder=order;},setActiveDocument:(id,documentId)=>{workspace.workspace(id).activeDocumentId=documentId;}}});
const button=(label:string,action:()=>unknown)=>{const b=document.createElement('button');b.textContent=label;b.type='button';b.onclick=()=>{try{void Promise.resolve(action()).catch(error);}catch(e){error(e);}};return b;};
const nativeRecents=nativeHost?createNativeRecents({invoke:nativeHost.core.invoke.bind(nativeHost.core),workspace:()=>state?.activeWorkspaceId??'',canNavigate:()=>!closing&&!restoring&&!nativeExitPending&&cancelNavigation(),handle:info=>nativeRecentHandle(window,info),token:nativeFileToken,open:openHandle,confirm:message=>window.confirm(message),notice:status,changed:()=>chrome.refresh()}):undefined;
const documentWindows=createDocumentWindows({invoke:nativeHost?.core.invoke.bind(nativeHost.core),canNavigate:()=>Boolean(state)&&!nativeExitPending&&!closing&&!restoring&&!running&&!activeTab?.api?.busy()&&!document.querySelector('dialog[open]'),newTab:()=>newTab(),changed:()=>chrome.refresh()});
const lifecycle=createDocumentLifecycle({canClose:()=>Boolean(activeTab?.initialized&&activeTab.api&&!activeTab.api.busy()&&!closing&&!restoring&&!nativeExitPending&&!running&&!document.querySelector('dialog[open]')),canExit:()=>Boolean(nativeExit&&!nativeExitSnapshot().blocked),close:async()=>{if(activeTab)await closeTab(activeTab);},exit:async()=>{if(!nativeExit)throw Error('프로그램 종료 보호를 확인할 수 없습니다.');await nativeExit.request({preventDefault(){}});}});
const chrome=installUnifiedChrome({menus:$('unified-menus'),tools:$('unified-tools'),active:()=>{const api=activeTab?.initialized?activeTab.api??undefined:undefined;return api?documentWindows.wrap(lifecycle.wrap(nativeRecents?.wrap(api)??api)):undefined;},execute:(id,params)=>{if(running?.run.status==='applying')throw new Error('문서 적용 중입니다.');if(id==='file:new-doc'||id==='file:new-tab'||id==='file:restore-document-window')return documentWindows.execute(id,params);if(id==='ext:jueony-close'||id==='file:exit')return lifecycle.execute(id);if(nativeRecents&&(id==='file:open-native-recent'||id==='file:clear-native-recent'))return nativeRecents.execute(id,params);if(id==='file:open'){$('open-document').click();return;}const result=activeTab?.api!.executeCommand(id,params);if(!result?.ok)throw new Error(result?.message??'현재 문서에서 실행할 수 없습니다.');},error});
const on=(id:string,action:()=>unknown)=>$(id).addEventListener('click',()=>{if(agentFilePending){status('Agent 문서 탭 작업을 마친 뒤 실행하세요.');return;}try{void Promise.resolve(action()).catch(error);}catch(e){error(e);}});
async function persist(){stateWrites++;try{await store.save(state);persistError=false;}catch(e){persistError=true;throw e;}finally{stateWrites--;}}
const navigation=createSessionGuard(()=>({closing,restoring,runStatus:running?.run.status}),()=>running?.controller.abort(),status);
const cancelNavigation=()=>{if(agentFilePending){status('Agent 문서 탭 작업 중에는 업무와 문서를 전환하지 않습니다.');return false;}return navigation.canNavigate();};
function options(select:HTMLSelectElement,items:{value:string;text:string}[],value?:string){select.replaceChildren(...items.map(item=>{const o=document.createElement('option');o.value=item.value;o.textContent=item.text;return o;}));if(value&&items.some(x=>x.value===value))select.value=value;}
const connectionUI=installConnectionsPanel({port,models:()=>state.models,replaceModels:models=>{state.models=models;},chat,isRunning:()=>Boolean(running),persist,renderModels,status,error,uid});
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
 $('app-shell').classList.toggle('sidebar-hidden',Boolean(state.sidebarHidden));$('app-shell').classList.toggle('focus-mode',Boolean(state.focusMode));$('focus-mode').setAttribute('aria-pressed',String(Boolean(state.focusMode)));
 $<HTMLInputElement>('retrieve-sources').checked=Boolean(state.retrieveSources);$<HTMLInputElement>('review-before-apply').checked=Boolean(state.reviewBeforeApply);
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
   if(run.retrieval){const detail=document.createElement('details'),summary=document.createElement('summary');summary.textContent='자료 검색: '+run.retrieval.matchedChunkCount+'개 구간 · '+run.retrieval.sentCharacters+'자 전달';detail.append(summary);for(const hit of run.retrieval.hits){const line=document.createElement('div');line.textContent=hit.name+' · 추출문 '+hit.startLine+'–'+hit.endLine+'행';detail.append(line);}for(const warning of run.retrieval.warnings){const p=document.createElement('p');p.textContent=warning;detail.append(p);}card.append(detail);}
   if(run.events?.length){const note=document.createElement('div');note.className='run-meta';note.textContent='검토 기록: '+run.events.map(e=>(phaseLabels[e.phase]??e.phase)+' '+e.call+'/'+e.maxCalls).join(' → ');card.append(note);}
   if(run.receipt){const actions=document.createElement('div');actions.className='message-actions';actions.append(button('변경 확인',()=>{
    const receipt=run.receipt!;$('diff-before').textContent=receipt.before;$('diff-after').textContent=receipt.after;
    $('structure-diff').hidden=JSON.stringify(receipt.beforeStructure)===JSON.stringify(receipt.afterStructure);
    $('structure-diff-text').textContent='변경 전\n'+describeStructure(receipt.beforeStructure)+'\n\n변경 후\n'+describeStructure(receipt.afterStructure);
    ($('change-dialog') as HTMLDialogElement).showModal();
   }),button('요청 되돌리기',async()=>{if(running)throw new Error('진행 중 요청을 먼저 중지해 주세요.');const tab=tabs.find(t=>t.id===run.documentId&&t.workspaceId===run.workspaceId);if(!tab)throw new Error('열린 문서에서만 되돌릴 수 있습니다. 재시작 후에는 보존된 문서를 직접 편집해 주세요.');selectTab(tab);await tab.api!.undoRequest(run.receipt!);await persistTab(tab);status('이 요청의 변경을 되돌렸습니다.');}));if(run.macroTemplate)actions.append(button('반복 작업으로 저장',async()=>{const name=prompt('반복 작업 이름');if(!name?.trim())return;const macro:CommandMacro={id:uid(),workspaceId:run.workspaceId,name:name.trim(),createdAt:Date.now(),template:structuredClone(run.macroTemplate!)};state.macros??=[];state.macros.push(macro);await persist();status('이 업무의 반복 작업에 저장했습니다.');}));card.append(actions);}
  }
  target.append(card);
 }
 const pending=running?.run.chatId===chat().id&&running.run.workspaceId===work().id;
 target.setAttribute('aria-busy',String(Boolean(pending)));
 if(pending){const card=document.createElement('article');card.className='message assistant pending';card.id='agent-progress';card.setAttribute('role','status');card.textContent=(running!.run.model?.modelId??'반복 작업')+' · '+runLabels[running!.run.status]+'…'+(running!.run.events?.length?' ('+running!.run.events.at(-1)!.call+'/3회)':'');target.append(card);}
 target.scrollTop=target.scrollHeight;
}
function renderReferences(){
 const target=$('reference-summary');target.replaceChildren();
 const line=document.createElement('div');line.textContent=selected.length?'연결 자료: '+selected.map(s=>s.path).join(', '):'폴더에서 자료를 체크하거나 파일을 첨부하세요.';target.append(line);
 const workspaceId=work().id,chatId=chat().id;
 for(const item of temporary.list(workspaceId,chatId)){
  const chip=button(item.file.name+' ×',()=>{temporary.remove(workspaceId,chatId,item.id);renderReferences();});
  chip.className='attachment-chip';chip.title='임시 참고 첨부 제거: '+item.file.name;target.append(chip);
 }
}
function attachFiles(files:File[],workspaceId=work().id,chatId=chat().id){
 try{temporary.add(workspaceId,chatId,files);renderReferences();status('임시 참고 자료를 첨부했습니다. 이 채팅의 요청에 포함되며 앱을 새로고침하면 해제됩니다.');}catch(e){requestError(e);}
}
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
function checkPendingConnection(tab:Tab){
 if(tab.pendingConnection&&tab.initialized&&tab.pendingIdentity!==tab.api!.documentIdentity()){tab.pendingConnection=undefined;tab.pendingIdentity=undefined;}
}
function refreshTab(tab:Tab){
 if(tab.closed||!tab.api||!tab.initialized)return;checkPendingConnection(tab);const s=tab.api!.state();tab.button.textContent=s.name;tab.button.classList.toggle('is-dirty',s.dirty);
 if(tab===activeTab){document.title=work().name+' · '+s.name+' — Jueony';$('active-document-name').textContent=s.name;$('editor-heading').textContent=s.name;chrome.refresh();$('shell-status').textContent=s.dirty?'수정됨':'저장됨';$('reconnect-document').hidden=!tab.pendingConnection||Boolean(tab.api!.fileHandle());}
 tab.recovery?.observe({identity:tab.api.documentIdentity(),...s});
 if(nativeRecents&&!s.dirty)void nativeRecents.remember(tab.workspaceId,tab.api.fileHandle(),s.revision).catch(e=>status('문서는 유지되지만 최근 문서 목록을 갱신하지 못했습니다. '+String(e)));
 clearTimeout(tab.timer);tab.timer=window.setTimeout(()=>void persistCachedView(tab).catch(error),1400);
}
async function persistCachedView(tab:Tab){
 if(nativeExitPending||tab.closed||!tab.initialized||!tab.api||!tab.cachedDocument||tab.pendingWrites)return;
 const view=tab.api.captureDocumentView();if(JSON.stringify(view)===JSON.stringify(tab.cachedDocument.view))return;
 const data={...tab.cachedDocument,view,viewUpdatedAt:viewStamp(tab)};tab.pendingWrites=(tab.pendingWrites??0)+1;
 tab.persist=tab.persist.catch(()=>{}).then(()=>store.saveDocument(data));
 try{await tab.persist;tab.cachedDocument=data;tab.persistError=false;}catch(e){tab.persistError=true;throw e;}finally{tab.pendingWrites!--;}
}
function selectTab(tab:Tab,authority?:symbol){if(agentFilePending&&authority!==agentFileAuthority)return;if(!session.canSelect(tab.id))return;if(activeTab?.initialized&&activeTab!==tab){activeTab.api!.suspendDocumentView();void persistTab(activeTab).catch(error);}if(!session.select(tab.id))return;activeTab=tab;for(const t of tabs){t.frame.hidden=t!==tab;t.wrapper.hidden=t.workspaceId!==work().id;t.wrapper.classList.toggle('is-active',t===tab);t.button.setAttribute('aria-selected',String(t===tab));}refreshTab(tab);tab.frame.contentWindow?.dispatchEvent(new Event('resize'));void persist().catch(error);}
async function newTab(workspaceId=work().id,saved?:SavedDocument,forExisting=false,authority?:symbol){
 if(agentFilePending&&authority!==agentFileAuthority)throw Error('Agent 문서 탭 작업을 마친 뒤 새 문서를 여세요.');
 assertTabCapacity(tabs.filter(tab=>!tab.closed).length);
 if(saved)assertRecoveryRecord(saved,workspaceId,recoveryIntegrity);
 const frame=document.createElement('iframe');const wrapper=document.createElement('div');wrapper.className='document-tab-wrap';
 const tab:Tab={id:saved?.id??uid(),workspaceId,frame,wrapper,button:button('문서 준비 중…',()=>{if(cancelNavigation())selectTab(tab);}),closed:false,initialized:false,pendingConnection:saved?.fileConnection,api:null,ready:Promise.resolve(null),persist:Promise.resolve()};
 tab.button.className='document-tab';tab.button.setAttribute('role','tab');
 const close=button('×',()=>closeTab(tab));close.className='close-tab';close.setAttribute('aria-label','문서 닫기');wrapper.append(tab.button,close);
 frame.className='editor-frame';frame.title='한글 문서 편집기';const url=new URL('./editor.html',location.href);url.searchParams.set('child','1');url.searchParams.set('skipRecovery','1');if(saved||forExisting)url.searchParams.set('skipDefaults','1');if(new URLSearchParams(location.search).get('storage')==='download')url.searchParams.set('storage','download');frame.src=url.href;
 tabs.push(tab);session.opened(tab);$('documents').append(frame);$('document-tab-list').append(wrapper);
 tab.ready=connectDocumentFrame(frame,()=>tab.closed).then(api=>{tab.api=api;return api;});
 if(workspaceId===work().id)selectTab(tab,authority);else frame.hidden=true;
 try {
  const api=(await tab.ready)!;
  // Fix the final viewport before restoring scroll; hiding chrome afterward clamps bottom positions.
  frame.contentDocument!.documentElement.dataset.unifiedChrome='true';
  frame.contentWindow?.dispatchEvent(new Event('resize'));
  if(saved){
   await api.open(saved.bytes,saved.name,null,saved.dirty);
   let view=saved.view;
   try{const journal=viewJournal.readRecord(saved.id,workspaceId,saved.updatedAt,Number.isSafeInteger(saved.viewUpdatedAt)?saved.viewUpdatedAt!:saved.updatedAt);if(journal){view=journal.view;viewClocks.set(tab.id,Math.max(viewClocks.get(tab.id)??0,journal.recordedAt));}}catch(e){viewJournalError=true;error(e);}
   if(await api.restoreDocumentView(view)==='invalid')status('문서 보기 정보가 손상되어 기본 보기로 열었습니다. 문서 내용은 유지합니다.');
   if(saved.fileConnection){tab.pendingIdentity=api.documentIdentity();const result=await api.restoreFileConnection(saved.fileConnection);if(result.status==='connected')tab.pendingConnection=undefined;else status(result.message);}
   else status('최근 문서를 복원했습니다. 원본 연결이 없는 문서는 다른 이름으로 저장해 주세요.');
  }
  tab.cachedDocument=saved;
  tab.recovery=createRecoveryCoordinator({settings:recoverySettings,clock:browserRecoveryClock(window),checkpoint:()=>persistTab(tab,'automatic'),onError:error});
  tab.initialized=true;chrome.refresh(true);refreshTab(tab);
  tab.disposeTabCycle=installDocumentTabCycle({source:frame.contentWindow!,sourceDocument:frame.contentDocument!,sourceId:tab.id,sourceWorkspaceId:tab.workspaceId,
   tabs:()=>tabs.filter(t=>t.initialized).map(({id,workspaceId,closed})=>({id,workspaceId,closed})),activeId:()=>activeTab?.id,workspaceId:()=>work().id,
   captureView:()=>api.captureDocumentView(),blocked:()=>tab.closed||closing||restoring||api.busy()||Boolean(document.querySelector('dialog[open]')),
   activate:id=>{const target=tabs.find(t=>t.id===id);if(target&&cancelNavigation())selectTab(target);},focus:id=>tabs.find(t=>t.id===id)?.api?.focusEditor()});
  if(saved)tab.recovery.checkpointed({identity:api.documentIdentity(),...api.state()});
  else if(!forExisting)await persistTab(tab);
  return tab;
 }catch(e){
  tab.restoreError=e instanceof Error?e.message:String(e);tab.button.textContent=(saved?.name??'문서')+' · 복원 실패';
  status('문서를 복원하지 못했습니다. 기존 복구본은 보존합니다. '+tab.restoreError);throw e;
 }
}
async function persistTab(tab:Tab,reason:'explicit'|'automatic'|'native-exit'='explicit'):Promise<boolean>{
 if((nativeExitPending&&reason!=='native-exit')||tab.closed||!tab.api||!tab.initialized)return false;clearTimeout(tab.timer);
 const captured={identity:tab.api.documentIdentity(),...tab.api.state()};
 if(reason!=='native-exit'&&captured.dirty&&tab.recovery&&!tab.recovery.enabled()){await persistCachedView(tab);return true;}
 try{
  const snapshot=tab.api!.recovery();if(!snapshot){if(reason==='explicit')tab.timer=window.setTimeout(()=>void persistTab(tab).catch(error),1500);return false;}
  checkPendingConnection(tab);
  const fileConnection=snapshot.fileConnection??(!tab.api!.fileHandle()?tab.pendingConnection:undefined);
  if(tab.api!.fileHandle())tab.pendingConnection=undefined;
  const data:SavedDocument={id:tab.id,workspaceId:tab.workspaceId,updatedAt:Date.now(),viewUpdatedAt:viewStamp(tab),...snapshot,fileConnection,view:tab.api!.captureDocumentView()};
  tab.pendingWrites=(tab.pendingWrites??0)+1;tab.persist=tab.persist.catch(()=>{}).then(()=>store.saveDocument(data));
  try{await tab.persist;tab.cachedDocument=data;tab.recovery?.checkpointed(captured);tab.persistError=false;return true;}finally{tab.pendingWrites!--;}
 }catch(e){
  if((e as any)?.code==='PASSWORD_RECOVERY_BLOCKED'){
   if(reason==='native-exit')throw e;
   tab.cachedDocument=undefined;viewClocks.delete(tab.id);
   try{viewJournal.remove(tab.id,tab.workspaceId);}catch(journalError){viewJournalError=true;error(journalError);}
   tab.pendingWrites=(tab.pendingWrites??0)+1;tab.persist=tab.persist.catch(()=>{}).then(()=>store.removeDocument(tab.id));
   try{await tab.persist;tab.persistError=false;status((e as Error).message);return true;}catch(removeError){tab.persistError=true;throw removeError;}finally{tab.pendingWrites!--;}
  }
  tab.persistError=true;throw e;
 }
}
async function openHandle(handle:FileSystemFileHandle){
 if(!cancelNavigation())return;const workspaceId=work().id;if(!await permission(handle,true))throw new Error('파일 접근 권한이 없습니다.');
 if(work().id!==workspaceId)return;
 for(const tab of tabs.filter(t=>t.workspaceId===workspaceId&&t.api?.fileHandle())){if(await handle.isSameEntry(tab.api!.fileHandle()!)){selectTab(tab);return;}}
 const file=await handle.getFile();if(file.size>64*1024*1024)throw new Error('MVP 문서 열기는 64MB까지 지원합니다.');
 if(work().id!==workspaceId)return;const tab=await newTab(workspaceId,undefined,true);await tab.api!.open(new Uint8Array(await file.arrayBuffer()),file.name,handle);tab.handle=handle;await persistTab(tab);status('문서를 열었습니다.');
}
async function closeTab(tab:Tab){
 if(closing||!cancelNavigation()||!tab.api||tab.api!.busy())return;if(!tab.initialized){status('복원 실패 문서의 기존 복구본을 보존합니다. 재실행 후 다시 확인해 주세요.');return;}closing=true;
 try {
 if(tab.api!.state().dirty){
  selectTab(tab);const dialog=$<HTMLDialogElement>('close-document');$('close-document-name').textContent=tab.api!.state().name;dialog.returnValue='cancel';const choice=new Promise<string>(resolve=>dialog.addEventListener('close',()=>resolve(dialog.returnValue),{once:true}));dialog.showModal();const action=await choice;
  if(action==='cancel'||!action)return;if(action==='save'){if(await tab.api!.save()!=='saved'||tab.api!.state().dirty)return;}else if(action!=='discard')return;
 }
 // Embedded frames have no private autosave owner. Deleting the workspace draft
 // is the discard commit: until that succeeds, keep the live dirty/undo state so
 // a failed IDB delete cannot turn unsaved work into an apparently saved tab.
 await commitClosedTab(tab);
 }finally{closing=false;}
}
function closeVersion(tab:Tab){return{api:tab.api,instance:tab.api!.documentInstance(),revision:tab.api!.revision(),identity:tab.api!.documentIdentity(),handle:tab.api!.fileHandle(),dirty:tab.api!.state().dirty,workspaceId:tab.workspaceId};}
async function commitClosedTab(tab:Tab,authority?:symbol,expected?:ReturnType<typeof closeVersion>){
 const assertOwned=()=>{if(tab.closed||!tabs.includes(tab)||!tab.api||!tab.initialized)throw Error('닫을 문서 탭의 소유 정보가 바뀌었습니다.');if(authority===agentFileAuthority){if(!agentFilePending||!expected||work().id!==expected.workspaceId||tab.workspaceId!==expected.workspaceId||tab.api!==expected.api||tab.api.documentInstance()!==expected.instance||tab.api.revision()!==expected.revision||tab.api.documentIdentity()!==expected.identity||tab.api.fileHandle()!==expected.handle||tab.api.state().dirty||tab.api.busy())throw Error('문서가 바뀌어 Agent가 닫지 않았습니다. 사용자 확인으로 닫아 주세요.');}};
 assertOwned();clearTimeout(tab.timer);tab.closed=true;
 try{await tab.persist.catch(()=>{});tab.closed=false;assertOwned();tab.closed=true;
  if(authority===agentFileAuthority){const record=(await store.documents(tab.workspaceId)).find(record=>record.id===tab.id);tab.closed=false;assertOwned();tab.closed=true;await store.removeDocumentIfUnchanged(tab.id,tab.workspaceId,record);}else await store.removeDocument(tab.id);
 }catch(error){tab.closed=false;refreshTab(tab);throw error;}
 tab.recovery?.dispose();tab.disposeTabCycle?.();tabs.splice(tabs.indexOf(tab),1);const nextId=session.closed(tab);tab.frame.remove();tab.wrapper.remove();
 const next=tabs.find(t=>t.id===nextId);if(next)selectTab(next,authority);else await newTab(work().id,undefined,false,authority);
}
const agentFilePort=createAgentFilePort({read:()=>({workspaceId:state?.activeWorkspaceId??'',activeTabId:activeTab?.id??'',blocked:!state||closing||restoring||nativeExitPending||Boolean(document.querySelector('dialog[open]')),tabs:tabs.filter(tab=>!tab.closed).map(tab=>({id:tab.id,workspaceId:tab.workspaceId,name:tab.api?.state().name??'',dirty:tab.api?.state().dirty??true,revision:tab.api?.revision()??'',instance:tab.api?.documentInstance()??'',busy:tab.api?.busy()??true,initialized:tab.initialized}))}),
 freeze:()=>{if(agentFilePending||nativeExitPending||closing||restoring)throw Error('다른 문서 작업 중입니다.');const leases:(()=>void)[]=[];try{for(const tab of tabs.filter(tab=>!tab.closed))if(tab.api)leases.push(tab.api.acquireHostMutationLock());}catch(error){for(const release of leases.reverse())release();throw error;}agentFilePending=true;const elements=Array.from(document.body.children).filter((e):e is HTMLElement=>e instanceof HTMLElement),previous=elements.map(e=>e.inert);elements.forEach(e=>e.inert=true);return()=>{elements.forEach((e,i)=>e.inert=previous[i]);for(const release of leases.reverse())release();agentFilePending=false;};},
 newTab:async()=>{await newTab(work().id,undefined,false,agentFileAuthority);},
 activate:async id=>{const tab=tabs.find(tab=>tab.id===id&&tab.workspaceId===work().id);if(!tab)throw Error('현재 업무의 탭이 아닙니다.');selectTab(tab,agentFileAuthority);await persist();},
 closeClean:async id=>{const tab=tabs.find(tab=>tab.id===id&&tab.workspaceId===work().id);if(!tab?.api||tab.api.state().dirty)throw Error('수정한 문서는 사용자 확인으로 닫아 주세요.');await commitClosedTab(tab,agentFileAuthority,closeVersion(tab));await persist();},
});
async function switchWorkspace(id:string){
 if(restoring||closing||!cancelNavigation()){render();return;}restoring=true;
 try{if(activeTab?.initialized)activeTab.api!.suspendDocumentView();if(activeTab?.initialized&&!await persistTab(activeTab))throw new Error('문서 작업이 끝난 뒤 업무를 전환해 주세요.');state.activeWorkspaceId=id;selected=[];activeTab=undefined;render();
  const previousDocumentId=work().activeDocumentId;
  if(!loaded.has(id)){const recovery=partitionRecoveryRecords(await store.documents(id),id,recoveryIntegrity);for(const issue of recovery.errors){recoveryWarning=true;error(issue);}const documents=session.restore(id,recovery.valid);for(const saved of documents)if(!tabs.some(t=>t.id===saved.id)){try{await newTab(id,saved);}catch(e){recoveryWarning=true;error(e);}}loaded.add(id);}
  const tab=tabs.find(t=>t.id===session.preferred(id,previousDocumentId))??await newTab(id);selectTab(tab);render();await renderFolders();await persist();
 }finally{restoring=false;}
}
function updateRun(){const busy=Boolean(running);$<HTMLButtonElement>('send-request').disabled=busy;$<HTMLButtonElement>('cancel-run').disabled=!busy||running?.run.status==='applying';$('run-status').textContent=running?runLabels[running.run.status]:'지원: 본문 · 서식 · 표 · 문서 요약 · 현재 업무의 탭 조회/생성/선택/수정하지 않은 탭 닫기';}
async function send(){
 const input=$<HTMLTextAreaElement>('request-input');const request=input.value.trim();if(!request)return;
 $('request-error').hidden=true;
 if(running)throw new Error('현재 요청이 진행 중입니다. 완료를 기다리거나 중지한 뒤 전송해 주세요.');
 if(agentFilePending||closing||nativeExitPending)throw new Error('문서 작업을 마친 뒤 요청하세요.');
 if(restoring)throw new Error('문서를 준비하고 있습니다. 준비 완료 후 다시 전송해 주세요.');
 const model=state.models.find(m=>m.id===$<HTMLSelectElement>('model-select').value);if(!model)throw new Error('먼저 AI 연결을 등록해 주세요.');
 const original=activeTab;if(!original?.api||!original.initialized||original.workspaceId!==work().id)throw new Error('문서 준비를 기다려 주세요.');
 const workspaceId=work().id,chatId=chat().id,run:Run={id:uid(),workspaceId,chatId,documentId:original.id,status:'preparing_context',model:{adapterId:model.adapterId,label:model.label,endpoint:model.endpoint,modelId:model.modelId,maxOutputTokens:model.maxOutputTokens},sources:[],createdAt:Date.now()};
 const controller=new AbortController();running={controller,run};state.runs.push(run);workspace.appendMessage(workspaceId,chatId,{id:uid(),role:'user',text:request,runId:run.id});input.value='';renderMessages();updateRun();
 try{
  await persist();const snapshot:Snapshot={...original.api!.snapshot(),fileContext:agentFilePort.snapshot()};
  const references=await readReferences([...selected],state.folders,workspaceId,bytes=>original.api!.readReference(bytes),controller.signal,async handle=>{
   for(const tab of tabs.filter(t=>t.workspaceId===workspaceId&&t.api?.fileHandle()))if(await handle.isSameEntry(tab.api!.fileHandle()!)){const current:Snapshot=tab.api!.snapshot();return {text:current.plainText??current.nodes.map(n=>n.text).join('\n'),revision:current.revision};}
   return undefined;
  },{chatId,items:temporary.list(workspaceId,chatId)});
  run.sources=references.map(({text,...source})=>source);
  const retrieved=state.retrieveSources?await agent.contextWithRetrieval([state,workspaceId,chatId,snapshot,references,request],controller.signal):undefined;
  const context=retrieved?.context??agent.context(state,workspaceId,chatId,snapshot,references,request);
  run.sources=context.references.map(({text,...source})=>source);run.retrieval=retrieved?.retrieval;run.events=[];
  const result=await agent.execute({runId:run.id,context,model,port:modelGateway,editor:original.api,filePort:agentFilePort,signal:controller.signal,
   isCurrent:()=>work().id===workspaceId&&chat().id===chatId&&activeTab?.id===run.documentId,
   createDocument:async()=>{const tab=await newTab(workspaceId);run.documentId=tab.id;return tab.api!;},
   onEvent:(event:any)=>{run.events!.push(event);if(run.events!.length>40)run.events!.shift();renderMessages();},
   state:s=>{run.status=s;updateRun();renderMessages();void persist().catch(error);}},state.reviewBeforeApply?'bounded':'single');
  run.status='completed';run.receipt=result.receipt;run.usedSourceIds=result.sourceIds;if(result.fileReceipt)run.documentId=result.fileReceipt.after.activeTabId;
  if(result.receipt&&result.generation)try{run.macroTemplate=automation.capture(result.generation,snapshot);}catch{/* Unsupported command groups are not offered as recordable macros. */}
  workspace.appendMessage(workspaceId,chatId,{id:uid(),role:'assistant',runId:run.id,text:result.message+'\n\n'+(result.fileReceipt?result.fileReceipt.message:result.receipt?result.receipt.operationCount+'개 명령을 실제 문서에 적용했습니다. 파일 저장은 별도로 실행하세요.':'문서에 적용한 변경은 없습니다.')});
  const tab=tabs.find(t=>t.id===run.documentId);
  try{if(tab)await persistTab(tab);status('AI 요청이 완료되었습니다.');}catch(e){persistError=true;run.error='문서 변경은 적용됐지만 로컬 복구본 저장에 실패했습니다. 문서를 파일로 저장해 주세요.';workspace.appendMessage(workspaceId,chatId,{id:uid(),role:'assistant',runId:run.id,text:run.error});status(run.error);}
 }catch(e){
  const failure=readDocumentFailure(e),name=failure.name;run.status=controller.signal.aborted||name==='AbortError'?'cancelled':name==='ConflictError'?'conflict':name==='PartialApplyError'?'failed_partial':name==='RolledBackError'?'failed_rolled_back':'failed_no_change';run.error=run.status==='cancelled'?'요청을 취소했습니다. 이 요청의 변경을 적용하지 않았습니다.':failure.message;
  workspace.appendMessage(workspaceId,chatId,{id:uid(),role:'assistant',runId:run.id,text:run.error});requestError(run.error);
 }finally{running=undefined;await persist().catch(error);renderMessages();updateRun();}
}
on('focus-mode',async()=>{state.focusMode=!state.focusMode;render();activeTab?.frame.contentWindow?.dispatchEvent(new Event('resize'));await persist();});
for(const [id,key] of [['retrieve-sources','retrieveSources'],['review-before-apply','reviewBeforeApply']] as const)$(id).addEventListener('change',()=>{state[key]=$<HTMLInputElement>(id).checked;void persist().catch(error);});
let pendingMacro:{template:CommandTemplate;name:string;workspaceId:string;chatId:string;tabId?:string;revision:string}|undefined;
function showMacro(template:CommandTemplate,name:string){
 if(running)throw new Error('진행 중인 요청이 끝난 뒤 실행해 주세요.');
 if(!activeTab?.initialized||!activeTab.api)throw new Error('문서 준비가 끝난 뒤 실행해 주세요.');
 const base=activeTab.api.snapshot(),sections=automation.sections(template);
 pendingMacro={template:structuredClone(template),name,workspaceId:work().id,chatId:chat().id,tabId:activeTab.id,revision:base.revision};
 $('macro-parameters-title').textContent=name;$('macro-error').textContent='';$('macro-variables').replaceChildren();$('macro-sections').replaceChildren();
 for(const original of sections){
  const label=document.createElement('label');label.textContent=`기록한 ${original+1}구역 → 대상 구역`;
  const select=document.createElement('select');select.required=true;select.dataset.section=String(original);select.setAttribute('aria-label',label.textContent);
  const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='적용할 구역을 직접 선택해 주세요';select.append(placeholder);
  for(const section of base.structure?.sections??[]){const option=document.createElement('option');option.value=String(section.index);option.textContent=`${section.index+1}구역 · ${base.nodes.filter(n=>n.section===section.index).length}개 본문 문단`;select.append(option);}
  label.append(select);$('macro-sections').append(label);
 }
 for(const variable of automation.variables(template)){const label=document.createElement('label');label.textContent=variable;const input=document.createElement('input');input.dataset.variable=variable;input.required=true;input.maxLength=4000;input.placeholder=variable==='붙임'?'없으면 없음으로 입력':variable;label.append(input);$('macro-variables').append(label);}
 $('macro-preview').textContent=automation.describe(template)+'\n\n'+(template.operations[0].kind==='create_document'?'새 문서를 만듭니다.':sections.length?'선택한 구역에 적용하며 본문은 해당 구역에서 원문을 대조합니다.':'현재 문서에서 원문이 일치하는 문단에 적용합니다.')+'\n문서가 바뀌면 설정창을 다시 열어 주세요. 변경 후 요청 되돌리기로 복원할 수 있습니다. 파일 저장은 별도로 실행하세요.';
 $<HTMLDialogElement>('macro-dialog').close();$<HTMLDialogElement>('macro-parameters').showModal();
}
function renderMacros(){
 const list=$('macro-list');list.replaceChildren();
 for(const macro of (state.macros??[]).filter(m=>m.workspaceId===work().id)){
  const row=document.createElement('div');row.className='macro-row';const name=document.createElement('strong');name.textContent=macro.name;row.append(name,button('실행',()=>showMacro(macro.template,macro.name)),button('이름',async()=>{const next=prompt('반복 작업 이름',macro.name);if(next?.trim()){macro.name=next.trim();await persist();renderMacros();}}),button('삭제',async()=>{state.macros=state.macros?.filter(m=>m.id!==macro.id);await persist();renderMacros();}));list.append(row);
 }
 if(!list.children.length)list.textContent='아직 저장한 반복 작업이 없습니다. 완료한 AI 변경에서 반복 작업으로 저장을 누르세요.';
}
on('macro-manager',()=>{renderMacros();$<HTMLDialogElement>('macro-dialog').showModal();});on('close-macros',()=>$<HTMLDialogElement>('macro-dialog').close());on('cancel-macro',()=>$<HTMLDialogElement>('macro-parameters').close());
for(const [id,kind,label] of [['recipe-letter','official-letter','공문 초안'],['recipe-plan','plan','추진 계획'],['recipe-report','report','결과 보고']] as const)on(id,()=>showMacro(automation.draft(kind),label));
$('macro-parameters-form').addEventListener('submit',e=>{e.preventDefault();void executeMacro().catch(e=>{$('macro-error').textContent=readDocumentFailure(e).message;});});
async function executeMacro(){
 const pending=pendingMacro;if(!pending||running||restoring||closing)throw new Error('현재 작업을 마친 뒤 다시 실행해 주세요.');
 if(work().id!==pending.workspaceId||chat().id!==pending.chatId||activeTab?.id!==pending.tabId)throw new Error('업무나 문서가 바뀌었습니다. 반복 작업을 다시 선택해 주세요.');
 let tab=activeTab;if(!tab?.initialized)throw new Error('문서를 준비하고 있습니다.');
 const values:Record<string,string>=Object.create(null);for(const input of $('macro-variables').querySelectorAll<HTMLInputElement>('input'))values[input.dataset.variable!]=input.value;
 const sectionTargets:Record<string,number>=Object.create(null);
 for(const select of $('macro-sections').querySelectorAll<HTMLSelectElement>('select')){if(select.value==='')throw new Error('기록한 각 구역의 대상 구역을 직접 선택해 주세요.');sectionTargets[select.dataset.section!]=Number(select.value);}
 let base:Snapshot=tab.api!.snapshot();
 if(base.revision!==pending.revision)throw new Error('반복 작업 설정 중 문서가 바뀌었습니다. 취소 후 작업을 다시 열어 주세요.');
 const generation=automation.prepare(pending.template,base,values,sectionTargets);
 await tab.api!.preflight(base,generation);
 if(activeTab!==tab||work().id!==pending.workspaceId||chat().id!==pending.chatId)throw new Error('문서가 바뀌었습니다. 다시 실행해 주세요.');
 $('request-error').hidden=true;
 const run:Run={id:uid(),workspaceId:work().id,chatId:chat().id,documentId:tab.id,status:'applying',sources:[],createdAt:Date.now()};running={controller:new AbortController(),run};state.runs.push(run);
 workspace.appendMessage(run.workspaceId,run.chatId,{id:uid(),role:'user',text:'반복 작업: '+pending.name,runId:run.id});$<HTMLDialogElement>('macro-parameters').close();renderMessages();updateRun();
 try{
  run.receipt=await automation.apply({runId:run.id,base,proposal:generation,editor:tab.api!,createDocument:async()=>{tab=await newTab(run.workspaceId);run.documentId=tab.id;return tab.api!;}});run.status='completed';run.macroTemplate=pending.template;
  workspace.appendMessage(run.workspaceId,run.chatId,{id:uid(),role:'assistant',text:pending.name+' · '+run.receipt!.operationCount+'개 명령을 적용했습니다. 파일 저장은 별도로 실행하세요.',runId:run.id});
  await persistTab(tab);status('반복 작업을 실행했습니다.');
 }catch(e){const failure=readDocumentFailure(e),name=failure.name;run.status=name==='PartialApplyError'?'failed_partial':name==='RolledBackError'?'failed_rolled_back':run.receipt?'completed':'failed_no_change';run.error=failure.message;workspace.appendMessage(run.workspaceId,run.chatId,{id:uid(),role:'assistant',text:run.error,runId:run.id});requestError(e);}
 finally{running=undefined;await persist().catch(error);renderMessages();updateRun();}
}
installDocumentDefaultsPanel({status,error});
window.addEventListener('keydown',e=>{if(agentFilePending){e.preventDefault();e.stopImmediatePropagation();return;}if(nativeExitPending){if(!document.getElementById('native-exit-confirm')?.contains(e.target as Node)){e.preventDefault();e.stopImmediatePropagation();}return;}if(e.isComposing||document.querySelector('dialog[open]'))return;if(!e.metaKey&&!e.shiftKey&&e.altKey&&((!e.ctrlKey&&e.code==='KeyN')||(e.ctrlKey&&e.code==='KeyT'))){e.preventDefault();if(!e.repeat)void documentWindows.execute(e.ctrlKey?'file:new-tab':'file:new-doc').catch(error);return;}if(e.key==='F6'&&e.altKey&&!e.ctrlKey&&!e.shiftKey){e.preventDefault();if(document.activeElement===activeTab?.frame)$('request-input').focus();else activeTab?.api?.focusEditor();}if(e.ctrlKey&&!e.altKey&&!e.shiftKey&&e.code==='KeyS'){e.preventDefault();$('save-document').click();}});
on('add-workspace',async()=>{if(!cancelNavigation())return;const name=prompt('새 업무 이름');if(!name?.trim())return;const w=workspace.addWorkspace(name);await switchWorkspace(w.id);});
on('rename-workspace',async()=>{const name=prompt('업무 이름',work().name);if(name?.trim()){work().name=name.trim();render();await persist();}});
$('workspace-select').addEventListener('change',()=>void switchWorkspace($<HTMLSelectElement>('workspace-select').value).catch(error));
on('add-chat',async()=>{if(!cancelNavigation())return;workspace.addChat(work().id,'새 채팅');selected=[];render();await renderFolders();await persist();});
on('add-folder',async()=>{const picker=(window as any).showDirectoryPicker;if(!picker)throw new Error('폴더 연결은 Jueony 실행기의 Edge/Chrome 창에서 지원합니다.');const workspaceId=work().id;const handle=await picker({mode:'read'});if(work().id!==workspaceId)return;for(const f of state.folders.filter(f=>f.workspaceId===workspaceId))if(await handle.isSameEntry(f.handle)){status('이미 연결한 폴더입니다.');return;}state.folders.push({id:uid(),workspaceId,name:handle.name,handle});await persist();await renderFolders();status('폴더를 연결했습니다. 아직 자료를 분석하지 않았습니다.');});
on('refresh-folders',renderFolders);
on('toggle-sidebar',async()=>{state.sidebarHidden=!state.sidebarHidden;$('app-shell').classList.toggle('sidebar-hidden',state.sidebarHidden);await persist();});
on('new-document',async()=>{if(cancelNavigation())await newTab();});
on('open-document',async()=>{const picker=(window as any).showOpenFilePicker;if(picker){const [handle]=await picker({types:[{description:'한글 문서',accept:{'application/octet-stream':['.hwp','.hwpx']}}]});await openHandle(handle);}else{const file=document.createElement('input');file.type='file';file.accept='.hwp,.hwpx';file.onchange=async()=>{const f=file.files?.[0];if(f&&cancelNavigation()){try{const tab=await newTab(work().id,undefined,true);await tab.api!.open(new Uint8Array(await f.arrayBuffer()),f.name);await persistTab(tab);}catch(e){error(e);}}};file.click();}});
on('save-document',async()=>{if(running?.run.status==='applying')return;if(activeTab?.api&&activeTab.initialized){const tab=activeTab;const result=await tab.api!.save();await persistTab(tab);status(result==='saved'?'파일에 저장했습니다.':'저장을 완료하지 않았습니다.');}});
on('reconnect-document',async()=>{
 const tab=activeTab;if(!tab?.initialized)return;checkPendingConnection(tab);if(!tab.pendingConnection){refreshTab(tab);return;}
 const result=await tab.api!.restoreFileConnection(tab.pendingConnection,true);
 if(result.status==='connected'){tab.pendingConnection=undefined;await persistTab(tab);refreshTab(tab);status('원본 파일과 다시 연결했습니다. 현재 편집 내용은 유지됩니다.');}
 else status(result.message);
});
$('request-form').addEventListener('submit',e=>{e.preventDefault();void send().catch(requestError);});
on('attach-reference',()=>{
 const workspaceId=work().id,chatId=chat().id,input=document.createElement('input');input.type='file';input.accept='.hwp,.hwpx,.txt,.md';input.multiple=true;
 input.onchange=()=>attachFiles(Array.from(input.files??[]),workspaceId,chatId);input.click();
});
$('chat-panel').addEventListener('dragover',e=>{if(e.dataTransfer?.types.includes('Files')){e.preventDefault();e.dataTransfer.dropEffect='copy';}});
$('chat-panel').addEventListener('drop',e=>{if(e.dataTransfer?.types.includes('Files')){e.preventDefault();if(!e.dataTransfer.files.length){requestError('폴더는 왼쪽의 연결 버튼으로 등록해 주세요.');return;}attachFiles(Array.from(e.dataTransfer.files));}});
$('request-input').addEventListener('paste',e=>{if(e.clipboardData?.files.length){e.preventDefault();attachFiles(Array.from(e.clipboardData.files));}});
let requestComposing=false;
$('request-input').addEventListener('compositionstart',()=>requestComposing=true);
$('request-input').addEventListener('compositionend',()=>requestComposing=false);
$('request-input').addEventListener('keydown',e=>{
 if(e.key!=='Enter'||e.shiftKey||e.isComposing||requestComposing||e.keyCode===229)return;
 e.preventDefault();if(!e.repeat)$<HTMLFormElement>('request-form').requestSubmit();
});
on('cancel-run',()=>running?.controller.abort());
$('provider-select').addEventListener('change',()=>{const value=$<HTMLSelectElement>('provider-select').value;const m=state.models.find(m=>m.label+' | '+m.adapterId+' | '+m.endpoint===value);chat().modelId=m?.id;renderModels();void persist().catch(error);});
$('model-select').addEventListener('change',()=>{chat().modelId=$<HTMLSelectElement>('model-select').value;void persist().catch(error);});
const split=$('sidebar-split');let dragging=false;
split.addEventListener('pointerdown',e=>{dragging=true;split.setPointerCapture(e.pointerId);});
split.addEventListener('pointermove',e=>{if(!dragging)return;const rect=$('sidebar').getBoundingClientRect();state.split=Math.max(20,Math.min(75,Math.round((e.clientY-rect.top)/rect.height*100)));$('sidebar').style.setProperty('--chat-share',state.split+'%');split.setAttribute('aria-valuenow',String(state.split));});
split.addEventListener('pointerup',()=>{dragging=false;void persist().catch(error);});
split.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();state.split=Math.max(20,Math.min(75,state.split+(e.key==='ArrowUp'?-3:3)));$('sidebar').style.setProperty('--chat-share',state.split+'%');split.setAttribute('aria-valuenow',String(state.split));void persist().catch(error);}});
window.addEventListener('message',event=>{if(event.origin!==location.origin)return;const tab=tabs.find(t=>t.frame.contentWindow===event.source);if(!tab)return;if(event.data?.type==='jueony:status')refreshTab(tab);if(event.data?.type==='jueony:command-state'&&tab===activeTab)chrome.refresh();if(event.data?.type==='jueony:focus-chat'&&tab===activeTab){if(state.focusMode){state.focusMode=false;render();void persist().catch(error);}$('request-input').focus();}if(event.data?.type==='jueony:preferences-state'){recoverySettingsWatcher.refresh();tab.preferenceError=Boolean(event.data.error);tab.preferenceMessage=tab.preferenceError?String(event.data.message):undefined;if(tab.preferenceError)status(tab.preferenceMessage!);}if(['jueony:new-document','jueony:new-tab'].includes(event.data?.type)&&tab===activeTab&&cancelNavigation())void documentWindows.execute('file:new-tab').catch(error);if(event.data?.type==='jueony:new-document-window'&&tab===activeTab)void documentWindows.execute('file:new-doc').catch(error);if(event.data?.type==='jueony:close-document'&&tab===activeTab)void closeTab(tab).catch(error);});
function nativeExitSnapshot(){
 const documents=tabs.filter(tab=>!tab.closed);
 return {stamp:JSON.stringify({workspace:state?.activeWorkspaceId,documents:documents.map(tab=>({id:tab.id,workspaceId:tab.workspaceId,identity:tab.api?.documentIdentity(),instance:tab.api?.documentInstance(),name:tab.api?.state().name,revision:tab.api?.revision(),dirty:tab.api?.state().dirty}))}),
  blocked:!state||agentFilePending||restoring||stateWrites>0||(closing&&!nativeExitPending)||Boolean(running)||documents.some(tab=>!tab.initialized||!tab.api||tab.api.busy()||(tab.pendingWrites??0)>0)||Boolean(document.querySelector('dialog[open]')),
  needsConfirmation:documents.some(tab=>Boolean(tab.api?.state().dirty))};
}
let nativeExitMode:'checkpoint'|'discard'='checkpoint',nativeExitRollback:(()=>Promise<void>)|undefined;
async function confirmNativeRecoveryExit():Promise<NativeExitConfirmation>{
 const before=nativeExitSnapshot(),original=JSON.parse(before.stamp),dirty=tabs.filter(tab=>!tab.closed&&tab.api?.state().dirty);
 const choice=await new Promise<string>(resolve=>{
  const dialog=document.createElement('dialog');dialog.id='native-exit-confirm';dialog.className='jueony-page-dialog';
  const title=document.createElement('h2');title.textContent='변경한 문서를 저장할까요?';
  const message=document.createElement('p');message.textContent=dirty.map(tab=>tab.api!.state().name).join(', ')+' — 파일에 모두 저장하면 원본 파일(새 문서는 선택한 위치)에 저장합니다. 저장하지 않으면 해당 문서의 로컬 복구본도 폐기합니다. 복구본 보관은 원본 파일에 저장하지 않고 이 Windows 계정에 최신 내용을 보관합니다.';
  const cancel=document.createElement('button');cancel.type='button';cancel.textContent='취소';cancel.onclick=()=>dialog.close('cancel');
  const accept=document.createElement('button');accept.type='button';accept.textContent='복구본을 저장하고 종료';accept.onclick=()=>dialog.close('checkpoint');
  const save=document.createElement('button');save.type='button';save.textContent='파일에 모두 저장하고 종료';save.dataset.exitChoice='save';save.onclick=()=>dialog.close('save');
  const discard=document.createElement('button');discard.type='button';discard.textContent='저장하지 않고 종료';discard.dataset.exitChoice='discard';discard.onclick=()=>dialog.close('discard');
  dialog.append(title,message,cancel,save,discard,accept);document.body.append(dialog);dialog.addEventListener('close',()=>{const result=dialog.returnValue;dialog.remove();resolve(result);},{once:true});dialog.showModal();cancel.focus();
 });
 if(!choice||choice==='cancel')return false;
 if(nativeExitSnapshot().stamp!==before.stamp)throw Error('종료 확인 중 문서가 바뀌었습니다. 다시 확인해 주세요.');
 if(choice==='checkpoint')return true;
 if(choice==='discard'){nativeExitMode='discard';return{beforeStamp:before.stamp,approvedSnapshot:before,rollback:async()=>{await nativeExitRollback?.();nativeExitRollback=undefined;}};}
 if(choice!=='save')return false;
 const saved:string[]=[],apis=new Map(dirty.map(tab=>[tab,tab.api]));let expected=original;
 for(const tab of dirty){
  try{
   if(tab.api!==apis.get(tab)||nativeExitSnapshot().stamp!==JSON.stringify(expected))throw Error('저장 대상의 문서 버전이 바뀌었습니다.');
   if(await withExitSaveFrame(tab.frame,()=>tab.api!.save())!=='saved'||tab.api!.state().dirty)throw Error('파일 저장이 취소되었거나 완료되지 않았습니다.');
   if(tab.api!==apis.get(tab))throw Error('저장 중 문서 연결이 바뀌었습니다.');
   const actual=JSON.parse(nativeExitSnapshot().stamp);assertExitSavedTransition(expected,actual,tab.id,tab.api!.fileHandle()?.name);
   saved.push(tab.api!.state().name);expected=actual;
  }catch(error){throw Error((saved.length?'이미 파일에 저장한 문서: '+saved.join(', ')+'. ':'')+'나머지 문서는 열린 채 유지하며 종료하지 않습니다. '+String(error));}
 }
 return{beforeStamp:before.stamp,approvedSnapshot:nativeExitSnapshot()};
}
async function commitNativeExitRecovery(){
 const discarded=nativeExitMode==='discard'?tabs.filter(tab=>!tab.closed&&tab.api?.state().dirty):[];
 const documents=tabs.filter(tab=>!tab.closed&&!discarded.includes(tab));
 if(nativeExitMode==='discard'){
  const updates:SavedDocument[]=[];
  for(const tab of documents){await tab.persist.catch(()=>{});if(tab.preferenceError)throw Error(tab.preferenceMessage??'문서 환경 설정을 확인해 주세요.');const snapshot=tab.api!.recovery();if(!snapshot)throw Error('문서 복구본을 준비하지 못했습니다.');const fileConnection=snapshot.fileConnection??(!tab.api!.fileHandle()?tab.pendingConnection:undefined);updates.push({id:tab.id,workspaceId:tab.workspaceId,updatedAt:Date.now(),viewUpdatedAt:viewStamp(tab),...snapshot,fileConnection,view:tab.api!.captureDocumentView()});}
  for(const tab of discarded)await tab.persist.catch(()=>{});
  const changes=await store.commitExitRecovery(discarded.map(tab=>({id:tab.id,workspaceId:tab.workspaceId})),updates);
  nativeExitRollback=()=>store.rollbackExitRecovery(changes);
  await store.verifyExitRecovery(changes);
  await persist();checkpointExitView();if(viewJournalError)throw Error('문서 보기 상태를 보관하지 못했습니다.');
  return;
 }
 for(const tab of documents){await tab.persist.catch(()=>{});if(tab.preferenceError)throw new Error(tab.preferenceMessage??'문서 환경 설정 저장을 확인해 주세요.');if(!await persistTab(tab,'native-exit'))throw new Error('문서 복구본을 준비하지 못해 종료하지 않았습니다.');}
 // Read back committed records, including inactive and other-workspace documents.
 for(const workspaceId of new Set(documents.map(tab=>tab.workspaceId))){
  const saved=await store.documents(workspaceId);
  for(const tab of documents.filter(tab=>tab.workspaceId===workspaceId)){
   const record=saved.find(value=>value.id===tab.id),expected=tab.cachedDocument;
   assertRecoveryRecord(record,workspaceId,recoveryIntegrity);
   if(!record.integrity)throw new Error('복구본 저장 확인용 무결성 정보가 없어 종료하지 않았습니다.');
   if(!expected||!record||record.name!==expected.name||record.dirty!==expected.dirty||record.updatedAt!==expected.updatedAt||record.bytes.length!==expected.bytes.length||record.bytes.some((byte,index)=>byte!==expected.bytes[index]))throw new Error('복구본 저장 후 확인에 실패해 종료하지 않았습니다.');
  }
 }
 await persist();checkpointExitView();if(viewJournalError)throw new Error('문서 보기 상태를 보관하지 못해 종료하지 않았습니다.');
}
if(nativeHost){
 nativeExit=installNativeExitProtection(nativeHost,{
  snapshot:nativeExitSnapshot,confirm:confirmNativeRecoveryExit,checkpoint:commitNativeExitRecovery,
  freeze:()=>{nativeExitMode='checkpoint';nativeExitRollback=undefined;const previousClosing=closing;nativeExitPending=true;closing=true;for(const tab of tabs){clearTimeout(tab.timer);tab.recovery?.updateSettings({...recoverySettings,recoveryEnabled:false,idleSaveEnabled:false});}const elements=Array.from(document.body.children).filter((element):element is HTMLElement=>element instanceof HTMLElement);const previous=elements.map(element=>element.inert);elements.forEach(element=>element.inert=true);return()=>{elements.forEach((element,index)=>element.inert=previous[index]);nativeExitPending=false;closing=previousClosing;for(const tab of tabs){tab.recovery?.updateSettings(recoverySettings);refreshTab(tab);}};},
  error:value=>status('종료하지 않았습니다. '+(value instanceof Error?value.message:String(value))),
 },async()=>{if(documentWindow.kind==='document')await nativeHost.core.invoke('close_document_window',{recoverable:nativeExitMode!=='discard'&&tabs.some(tab=>!tab.closed&&tab.api?.state().dirty)});else await nativeHost.window.getCurrentWindow().destroy();});
 void nativeExit.ready.catch(value=>status('네이티브 종료 보호를 설치하지 못했습니다. 문서를 파일에 저장한 뒤 종료해 주세요. '+String(value)));
}
window.addEventListener('beforeunload',event=>{
 if(nativeExit?.isApproved())return;
 checkpointExitView();
 // The host owns the single exit prompt, including inactive and other-workspace tabs.
 // A failed editor read is protected rather than silently allowing a destructive exit.
 let protect=true;
 try{protect=shouldProtectExit({persistenceFailed:persistError||viewJournalError,pendingWrites:stateWrites,closing,running:Boolean(running),documents:tabs.filter(t=>!t.closed).map(t=>({dirty:Boolean(t.api?.state().dirty),persistenceFailed:Boolean(t.persistError),preferenceFailed:Boolean(t.preferenceError),pendingWrites:t.pendingWrites??0}))});}catch{}
 if(protect){event.preventDefault();event.returnValue='';}
});
window.addEventListener('pagehide',checkpointExitView);
async function start(){await store.open(documentWindow.windowId??undefined);if(documentWindow.kind==='document'){document.title='Jueony · 독립 문서 창';$('app-title').title='독립 문서 창: 이 창의 업무·채팅·문서·복구본은 기본 창과 별도로 보관됩니다.';$('app-title').append(document.createTextNode(' · 독립 문서 창'));}$('new-document').textContent='+ 새 탭';state=await store.load();installPaneResize({root:$('app-shell'),sidebar:$('sidebar'),handle:$('agent-editor-split'),chat:$('chat-panel'),initialWidth:state.agentWidth,commit:width=>{state.agentWidth=width;void persist().catch(error);}});try{await connectionUI.refresh();}catch{connectionUI.notice='AI 서버를 최신 실행기로 다시 시작해 주세요. 로컬 문서 편집은 사용할 수 있습니다.';}if(!state.workspaces.length)workspace.addWorkspace(documentWindow.kind==='document'?'독립 문서 창':'내 업무');if(!state.workspaces.some(w=>w.id===state.activeWorkspaceId))state.activeWorkspaceId=state.workspaces[0].id;render();await switchWorkspace(state.activeWorkspaceId);if(documentWindow.kind==='document'){if(recoveryWarning||tabs.some(tab=>tab.restoreError))throw Error('독립 문서 창의 일부 복구본을 열지 못했습니다. 기존 기록을 보존했습니다.');await nativeHost!.core.invoke('ready_document_window');}status((documentWindow.kind==='document'?'독립 문서 창 준비 완료 · 기본 창의 업무와 별도 보관':'로컬 업무 준비 완료')+' · '+(tabs.some(t=>t.preferenceError)?tabs.find(t=>t.preferenceError)!.preferenceMessage:recoveryWarning||tabs.some(t=>t.restoreError)?'일부 문서 복원 실패: 기존 복구본은 보존했습니다.':tabs.some(t=>t.pendingConnection)?'복구 문서의 원본 연결을 확인하세요.':connectionUI.notice||'AI 연결 설정에서 연결과 키를 변경할 수 있습니다.'));}
// One writer per browser profile/origin prevents whole-state writes from
// competing application windows from overwriting each other's workspaces.
void readDocumentWindowContext(nativeHost?.core.invoke.bind(nativeHost.core),location.search).then(context=>{documentWindow=context;return navigator.locks.request('jueony-workspace-writer'+(context.windowId?'-'+context.windowId:''),{ifAvailable:true},async lock=>{
 if(!lock){$('app-title').inert=true;$('unified-menus').inert=true;$('unified-tools').inert=true;$('app-shell').inert=true;$<HTMLButtonElement>('connection-settings').disabled=true;status('다른 Jueony 창이 열려 있습니다. 기존 창을 사용하거나 닫은 뒤 이 창을 새로고침해 주세요.');return;}
 try{await start();}catch(e){$('unified-menus').inert=true;$('unified-tools').inert=true;$('app-shell').inert=true;$<HTMLButtonElement>('connection-settings').disabled=true;error(e);return;}
 await new Promise<void>(()=>{});
});}).catch(value=>{$('app-shell').inert=true;error(value);});
