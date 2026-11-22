import type {ConnectionFacade,ModelConfig} from '../modules/connections/public/index.ts';
import {supportsDocumentTools} from '../modules/connections/public/index.ts';
import type {Chat} from '../modules/workspace/public/index.ts';
import {providerPresets} from '../mvp/provider-presets.ts';
import {institutionOffline} from '../mvp/institution-policy.ts';
import {element as $,selectOptions as options,bindClick} from './dom.ts';
export function installConnectionsPanel(deps:{port:ConnectionFacade;models:()=>ModelConfig[];replaceModels:(models:ModelConfig[])=>void;chat:()=>Chat;isRunning:()=>boolean;persist:()=>Promise<void>;renderModels:()=>void;status:(text:string)=>void;error:(error:unknown)=>void;uid:()=>string}){
const {port,models,replaceModels,chat,isRunning,persist,renderModels,status,error,uid}=deps;
const on=bindClick(deps.error);
let editingId:string|undefined,secureStorage=false,connectionNotice='',discovery:AbortController|undefined,toolProbe:AbortController|undefined;
let googleAvailable=false,googleEpoch=0,googleId:string|undefined,googleBusy=false;
const googleEndpoint=providerPresets.gemini.endpoint;
const connectionFlags=new Map<string,{hasKey:boolean;remember:boolean;auth?:'gemini-oauth'}>();
async function refreshConnections(){
 const info=await port.connections();secureStorage=info.secureStorage;connectionNotice=info.warning;googleAvailable=info.geminiOAuth===true;connectionFlags.clear();
 for(const {config,hasKey,remember,auth} of info.connections){connectionFlags.set(config.id,{hasKey,remember,auth});const existing=models().find(m=>m.id===config.id);if(existing)Object.assign(existing,config);else models().push(config);}
}
function fillConnection(config?:ModelConfig){
 discovery?.abort();toolProbe?.abort();cancelGoogle();$('local-model-options').replaceChildren();
 editingId=config?.id;
 $<HTMLInputElement>('config-label').value=config?.label??'';$<HTMLInputElement>('config-endpoint').value=config?.endpoint??'';$<HTMLInputElement>('config-model').value=config?.modelId??'';$<HTMLInputElement>('config-key').value='';$<HTMLSelectElement>('config-adapter').value=config?.adapterId??'openai-responses';$<HTMLInputElement>('config-tokens').value=String(config?.maxOutputTokens??(config?.adapterId==='hyperclova'?4096:8192));
 $<HTMLInputElement>('config-remember').checked=secureStorage&&(config?Boolean(connectionFlags.get(config.id)?.remember):true);$<HTMLInputElement>('config-remember').disabled=!secureStorage;
 $<HTMLButtonElement>('delete-connection').disabled=!config;
 const flags=config&&connectionFlags.get(config.id);
 renderConnections();adapterHint(!config);$('config-status').textContent=connectionNotice||(flags?.auth?'Google 브라우저 인증으로 연결했습니다.':flags?.hasKey?'등록된 키가 있습니다. 키를 비워 두면 유지하며, 새 키를 입력하면 교체합니다.':'새 연결을 등록하세요. 저장된 키 원문은 화면에 표시하지 않습니다.');
}
function renderConnections(){options($('saved-connections'),[{value:'',text:'＋ 새 연결 등록'},...models().map(m=>{const flags=connectionFlags.get(m.id);return {value:m.id,text:`${m.label} · ${m.modelId} · ${flags?.auth?'Google 인증':flags?.hasKey?'키 등록됨':'키 없음'}`};})],editingId);}
on('connection-settings',async()=>{await refreshConnections();const config=models().find(m=>m.id===$<HTMLSelectElement>('model-select').value);fillConnection(config);$<HTMLDialogElement>('model-dialog').showModal();});
on('new-connection',()=>fillConnection());
$('saved-connections').addEventListener('change',()=>fillConnection(models().find(m=>m.id===$<HTMLSelectElement>('saved-connections').value)));
on('delete-connection',async()=>{if(isRunning())throw new Error('진행 중 요청이 끝난 뒤 연결을 삭제해 주세요.');if(!editingId)return;const id=editingId;await port.removeConnection(id);replaceModels(models().filter(m=>m.id!==id));connectionFlags.delete(id);await persist();renderModels();fillConnection();$('config-status').textContent='선택한 연결과 저장된 키를 삭제했습니다.';});
$('model-dialog').addEventListener('close',()=>{discovery?.abort();toolProbe?.abort();cancelGoogle();$('local-model-options').replaceChildren();$<HTMLInputElement>('config-key').value='';});
on('clear-credentials',async()=>{if(isRunning())throw new Error('진행 중 요청이 끝난 뒤 키를 삭제해 주세요.');cancelGoogle();await port.clearCredentials();connectionFlags.clear();connectionNotice='';$<HTMLInputElement>('config-key').value='';renderConnections();adapterHint(false);$('config-status').textContent='이 PC에서 관리하는 키와 인증 정보를 모두 삭제했습니다. 모델 설정은 유지됩니다.';});
on('close-settings',()=>{$<HTMLInputElement>('config-key').value='';$<HTMLDialogElement>('model-dialog').close();});
let settingsBusy=false;
function cancelGoogle(){
 googleEpoch++;
 if(googleId)void port.cancelGeminiOAuth?.(googleId).catch(()=>{});
 googleId=undefined;googleBusy=false;
 $('gemini-oauth-link').removeAttribute('href');
 renderGoogle();
}
function renderGoogle(){
 const show=!institutionOffline&&googleAvailable&&$<HTMLSelectElement>('config-adapter').value==='gemini'&&
  $<HTMLInputElement>('config-endpoint').value.trim()===googleEndpoint;
 $('gemini-oauth-controls').hidden=!show;
 $('gemini-oauth-start').hidden=Boolean(googleId);
 for(const id of ['gemini-oauth-link','gemini-oauth-finish','gemini-oauth-cancel'])$(id).hidden=!googleId;
 $<HTMLButtonElement>('gemini-oauth-start').disabled=googleBusy;
 $<HTMLButtonElement>('gemini-oauth-finish').disabled=googleBusy;
}
function adapterHint(reset:boolean){
 const adapter=$<HTMLSelectElement>('config-adapter').value as ModelConfig['adapterId'];
 const native=adapter!=='openai-compatible',preset=providerPresets[adapter];
 const discover=$<HTMLButtonElement>('discover-local-models');
 $('config-token-field').hidden=!native;$<HTMLInputElement>('config-tokens').disabled=!native;
 $('adapter-hint').textContent=preset.hint;
 if(reset){
  $<HTMLInputElement>('config-key').value='';
  $<HTMLInputElement>('config-endpoint').value=preset.endpoint;
  $<HTMLInputElement>('config-model').value=preset.model;
  $<HTMLInputElement>('config-label').value=preset.name;
  $<HTMLInputElement>('config-tokens').value=adapter==='hyperclova'?'4096':'8192';
 }
 let local=false;
 try {local=['localhost','127.0.0.1','[::1]'].includes(new URL($<HTMLInputElement>('config-endpoint').value).hostname);}
 catch {/* The endpoint may still be incomplete. */}
 discover.hidden=native||!port.discoverLocal||!local;
 const modelId=$<HTMLInputElement>('config-model').value.trim();
 const maxOutputTokens=Number($<HTMLInputElement>('config-tokens').value);
 $('test-document-tools').hidden=!supportsDocumentTools({adapterId:adapter,modelId,maxOutputTokens})||!port.testDocumentTools;
 const previous=models().find(m=>m.id===editingId);
 const reusable=connectionFlags.get(editingId??'')?.hasKey&&previous?.adapterId===adapter&&previous.endpoint===$<HTMLInputElement>('config-endpoint').value.trim();
 $<HTMLInputElement>('config-key').required=native&&!reusable;
 $<HTMLInputElement>('config-key').placeholder=reusable?(connectionFlags.get(editingId??'')?.auth?'비워 두면 Google 인증 유지':'비워 두면 기존 키 유지 · 새 키 입력 시 교체'):preset.keyHint;
 const hcx005=adapter==='hyperclova'&&$<HTMLInputElement>('config-model').value==='HCX-005';
 $<HTMLInputElement>('config-tokens').min=hcx005?'1024':'128';$<HTMLInputElement>('config-tokens').max=hcx005?'4096':adapter==='hyperclova'?'8192':'32768';
 renderGoogle();
}
$('config-adapter').addEventListener('change',()=>{cancelGoogle();discovery?.abort();toolProbe?.abort();$('local-model-options').replaceChildren();adapterHint(true);});
$('config-model').addEventListener('input',()=>{cancelGoogle();toolProbe?.abort();adapterHint(false);});
$('config-tokens').addEventListener('input',()=>{cancelGoogle();toolProbe?.abort();adapterHint(false);});
$('config-key').addEventListener('input',()=>{cancelGoogle();toolProbe?.abort();});
$('config-label').addEventListener('input',cancelGoogle);
$('config-remember').addEventListener('change',cancelGoogle);
$('config-endpoint').addEventListener('input',()=>{cancelGoogle();discovery?.abort();toolProbe?.abort();$('local-model-options').replaceChildren();adapterHint(false);});
$('model-dialog').addEventListener('cancel',event=>{if(settingsBusy)event.preventDefault();});
function currentConfig(){
 const endpoint=$<HTMLInputElement>('config-endpoint').value.trim(),modelId=$<HTMLInputElement>('config-model').value.trim();
 const adapterId=$<HTMLSelectElement>('config-adapter').value as ModelConfig['adapterId'];
 const existing=models().find(m=>m.id===editingId);
 const config:ModelConfig={id:existing?.id??uid(),adapterId,label:$<HTMLInputElement>('config-label').value.trim(),endpoint,modelId,...(adapterId!=='openai-compatible'?{maxOutputTokens:Number($<HTMLInputElement>('config-tokens').value)}:{})};
 const keyValue=$<HTMLInputElement>('config-key').value;
 const key=keyValue||((editingId&&connectionFlags.get(editingId)?.hasKey)?undefined:'');
 return {config,key,existing};
}
async function configureModel(testOnly:boolean){
 const form=$<HTMLFormElement>('model-form');if(settingsBusy||!form.reportValidity())return;
 cancelGoogle();
 toolProbe?.abort();
 const {config,key,existing}=currentConfig();
 const remember=$<HTMLInputElement>('config-remember').checked&&secureStorage;
 settingsBusy=true;for(const control of form.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLButtonElement>('input,select,button'))control.disabled=true;
 try{
  if(testOnly){$('config-status').textContent='합성 요청으로 연결 확인 중…';await port.testConnection(config,key);$('config-status').textContent='연결 테스트 성공 · 문서/대화/자료 전송 없음. 새로 입력한 키는 테스트로 저장되지 않습니다. 저장하려면 다시 입력하고 연결 저장을 누르세요.';}
  else{await port.configure(config,key,remember);if(existing)Object.assign(existing,config);else models().push(config);await refreshConnections();chat().modelId=config.id;await persist();renderModels();$<HTMLDialogElement>('model-dialog').close();status(remember?'연결을 암호화해 저장했습니다. 재실행 후에도 사용할 수 있습니다.':'연결을 등록했습니다. 키는 현재 서버 실행 중에만 유지됩니다.');}
 }catch(e){$('config-status').textContent=e instanceof Error?e.message:String(e);}
 finally{settingsBusy=false;$<HTMLInputElement>('config-key').value='';for(const control of form.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLButtonElement>('input,select,button'))control.disabled=false;$<HTMLInputElement>('config-remember').disabled=!secureStorage;$<HTMLButtonElement>('delete-connection').disabled=!editingId;adapterHint(false);}
}
on('gemini-oauth-start',async()=>{
 if(googleBusy||settingsBusy||isRunning()||!port.startGeminiOAuth)return;
 const key=$<HTMLInputElement>('config-key'),required=key.required;key.required=false;
 const valid=$<HTMLFormElement>('model-form').reportValidity();key.required=required;
 if(!valid)return;
 toolProbe?.abort();
 const {config}=currentConfig();
 const remember=$<HTMLInputElement>('config-remember').checked&&secureStorage;
 const epoch=++googleEpoch;googleBusy=true;renderGoogle();
 try{
  const result=await port.startGeminiOAuth(config,remember);
  if(epoch!==googleEpoch){await port.cancelGeminiOAuth?.(result.id);return;}
  googleId=result.id;
  $<HTMLAnchorElement>('gemini-oauth-link').href=result.url;
  $('config-status').textContent='Google에서 인증한 뒤 이 화면으로 돌아와 인증 결과를 확인하세요.';
 }catch(error){if(epoch===googleEpoch)$('config-status').textContent=error instanceof Error?error.message:String(error);}
 finally{if(epoch===googleEpoch){googleBusy=false;renderGoogle();}}
});
on('gemini-oauth-finish',async()=>{
 if(!googleId||googleBusy||settingsBusy||isRunning()||!port.finishGeminiOAuth)return;
 const epoch=googleEpoch;googleBusy=true;renderGoogle();
 try{
  const result=await port.finishGeminiOAuth(googleId);
  if(epoch!==googleEpoch)return;
  if(result.status==='pending'){$('config-status').textContent='Google 인증이 끝나면 다시 확인해 주세요.';return;}
  googleId=undefined;
  await refreshConnections();
  if(epoch!==googleEpoch)return;
  chat().modelId=result.configId;await persist();renderModels();
  $<HTMLDialogElement>('model-dialog').close();status('Google 인증으로 Gemini를 연결했습니다.');
 }catch(error){if(epoch===googleEpoch){cancelGoogle();$('config-status').textContent=error instanceof Error?error.message:String(error);}}
 finally{if(epoch===googleEpoch){googleBusy=false;renderGoogle();}}
});
on('gemini-oauth-cancel',()=>{cancelGoogle();$('config-status').textContent='Google 브라우저 인증을 취소했습니다.';});
on('test-connection',()=>configureModel(true));
on('test-document-tools',async()=>{
 if(toolProbe){toolProbe.abort();return;}
 if(settingsBusy||!port.testDocumentTools||!$<HTMLFormElement>('model-form').reportValidity())return;
 const {config,key}=currentConfig();
 if(!supportsDocumentTools(config))return;
 const controller=new AbortController();toolProbe=controller;
 const trigger=$('test-document-tools');trigger.textContent='도구 확인 중지';
 $('config-status').textContent='합성 요청으로 조회 도구 지원을 확인하는 중입니다.';
 try{
  const result=await port.testDocumentTools(config,key,controller.signal);
  if(!controller.signal.aborted)$('config-status').textContent=result.supported?'모델이 실제 조회 도구 호출을 반환했습니다.':'응답에서 유효한 조회 도구 호출을 확인하지 못했습니다.';
 }catch(error){if(!controller.signal.aborted)$('config-status').textContent=error instanceof Error?error.message:String(error);}
 finally{if(toolProbe===controller){toolProbe=undefined;trigger.textContent='조회 도구 지원 확인';
  if(controller.signal.aborted&&$('config-status').textContent==='합성 요청으로 조회 도구 지원을 확인하는 중입니다.')$('config-status').textContent='조회 도구 지원 확인을 중지했습니다.';}}
});
on('discover-local-models',async()=>{
 if(!port.discoverLocal||settingsBusy)return;
 discovery?.abort();const controller=new AbortController();discovery=controller;
 const endpoint=$<HTMLInputElement>('config-endpoint').value.trim();
 const key=$<HTMLInputElement>('config-key').value||undefined;
 $('config-status').textContent='이 PC의 모델 목록을 확인하고 있습니다.';
 try {
  const result=await port.discoverLocal(endpoint,editingId,key,controller.signal);
  if(controller.signal.aborted)return;
  $('local-model-options').replaceChildren(...result.models.map(id=>new Option(id,id)));
  $('config-status').textContent=result.models.length?`모델 ${result.models.length}개를 찾았습니다. 모델 ID 입력란에서 선택하세요.`:'서버가 모델 목록을 비워 반환했습니다.';
 }catch(error){if(!controller.signal.aborted)$('config-status').textContent=error instanceof Error?error.message:String(error);}
 finally {if(discovery===controller)discovery=undefined;}
});
$('model-form').addEventListener('submit',e=>{e.preventDefault();void configureModel(false).catch(error);});

return {refresh:refreshConnections,get notice(){return connectionNotice;},set notice(value:string){connectionNotice=value;}};
}
