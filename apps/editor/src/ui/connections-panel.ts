import type {ConnectionFacade,ModelConfig} from '../modules/connections/public/index.ts';
import type {Chat} from '../modules/workspace/public/index.ts';
import {providerPresets} from '../mvp/provider-presets.ts';
import {element as $,selectOptions as options,bindClick} from './dom.ts';
export function installConnectionsPanel(deps:{port:ConnectionFacade;models:()=>ModelConfig[];replaceModels:(models:ModelConfig[])=>void;chat:()=>Chat;isRunning:()=>boolean;persist:()=>Promise<void>;renderModels:()=>void;status:(text:string)=>void;error:(error:unknown)=>void;uid:()=>string}){
const {port,models,replaceModels,chat,isRunning,persist,renderModels,status,error,uid}=deps;
const on=bindClick(deps.error);
let editingId:string|undefined,secureStorage=false,connectionNotice='';
const connectionFlags=new Map<string,{hasKey:boolean;remember:boolean}>();
async function refreshConnections(){
 const info=await port.connections();secureStorage=info.secureStorage;connectionNotice=info.warning;connectionFlags.clear();
 for(const {config,hasKey,remember} of info.connections){connectionFlags.set(config.id,{hasKey,remember});const existing=models().find(m=>m.id===config.id);if(existing)Object.assign(existing,config);else models().push(config);}
}
function fillConnection(config?:ModelConfig){
 editingId=config?.id;
 $<HTMLInputElement>('config-label').value=config?.label??'';$<HTMLInputElement>('config-endpoint').value=config?.endpoint??'';$<HTMLInputElement>('config-model').value=config?.modelId??'';$<HTMLInputElement>('config-key').value='';$<HTMLSelectElement>('config-adapter').value=config?.adapterId??'openai-responses';$<HTMLInputElement>('config-tokens').value=String(config?.maxOutputTokens??(config?.adapterId==='hyperclova'?4096:8192));
 $<HTMLInputElement>('config-remember').checked=secureStorage&&(config?Boolean(connectionFlags.get(config.id)?.remember):true);$<HTMLInputElement>('config-remember').disabled=!secureStorage;
 $<HTMLButtonElement>('delete-connection').disabled=!config;
 renderConnections();adapterHint(!config);$('config-status').textContent=connectionNotice||(config&&connectionFlags.get(config.id)?.hasKey?'등록된 키가 있습니다. 키를 비워 두면 유지하며, 새 키를 입력하면 교체합니다.':'새 연결을 등록하세요. 저장된 키 원문은 화면에 표시하지 않습니다.');
}
function renderConnections(){options($('saved-connections'),[{value:'',text:'＋ 새 연결 등록'},...models().map(m=>({value:m.id,text:`${m.label} · ${m.modelId} · ${connectionFlags.get(m.id)?.hasKey?'키 등록됨':'키 없음'}`}))],editingId);}
on('connection-settings',async()=>{await refreshConnections();const config=models().find(m=>m.id===$<HTMLSelectElement>('model-select').value);fillConnection(config);$<HTMLDialogElement>('model-dialog').showModal();});
on('new-connection',()=>fillConnection());
$('saved-connections').addEventListener('change',()=>fillConnection(models().find(m=>m.id===$<HTMLSelectElement>('saved-connections').value)));
on('delete-connection',async()=>{if(isRunning())throw new Error('진행 중 요청이 끝난 뒤 연결을 삭제해 주세요.');if(!editingId)return;const id=editingId;await port.removeConnection(id);replaceModels(models().filter(m=>m.id!==id));connectionFlags.delete(id);await persist();renderModels();fillConnection();$('config-status').textContent='선택한 연결과 저장된 키를 삭제했습니다.';});
$('model-dialog').addEventListener('close',()=>{$<HTMLInputElement>('config-key').value='';});
on('clear-credentials',async()=>{if(isRunning())throw new Error('진행 중 요청이 끝난 뒤 키를 삭제해 주세요.');await port.clearCredentials();connectionFlags.clear();connectionNotice='';$<HTMLInputElement>('config-key').value='';renderConnections();adapterHint(false);$('config-status').textContent='실행 중인 키와 암호화 저장된 키를 모두 삭제했습니다. 모델 설정은 유지됩니다.';});
on('close-settings',()=>{$<HTMLInputElement>('config-key').value='';$<HTMLDialogElement>('model-dialog').close();});
let settingsBusy=false;
function adapterHint(reset:boolean){
 const adapter=$<HTMLSelectElement>('config-adapter').value as ModelConfig['adapterId'];
 const native=adapter!=='openai-compatible',preset=providerPresets[adapter];
 $('config-token-field').hidden=!native;$<HTMLInputElement>('config-tokens').disabled=!native;
 $('adapter-hint').textContent=preset.hint;
 if(reset){
  $<HTMLInputElement>('config-key').value='';
  $<HTMLInputElement>('config-endpoint').value=preset.endpoint;
  $<HTMLInputElement>('config-model').value=preset.model;
  $<HTMLInputElement>('config-label').value=preset.name;
  $<HTMLInputElement>('config-tokens').value=adapter==='hyperclova'?'4096':'8192';
 }
 const previous=models().find(m=>m.id===editingId);
 const reusable=connectionFlags.get(editingId??'')?.hasKey&&previous?.adapterId===adapter&&previous.endpoint===$<HTMLInputElement>('config-endpoint').value.trim();
 $<HTMLInputElement>('config-key').required=native&&!reusable;
 $<HTMLInputElement>('config-key').placeholder=reusable?'비워 두면 기존 키 유지 · 새 키 입력 시 교체':preset.keyHint;
 const hcx005=adapter==='hyperclova'&&$<HTMLInputElement>('config-model').value==='HCX-005';
 $<HTMLInputElement>('config-tokens').min=hcx005?'1024':'128';$<HTMLInputElement>('config-tokens').max=hcx005?'4096':adapter==='hyperclova'?'8192':'32768';
}
$('config-adapter').addEventListener('change',()=>adapterHint(true));
$('config-model').addEventListener('input',()=>adapterHint(false));
$('config-endpoint').addEventListener('input',()=>adapterHint(false));
$('model-dialog').addEventListener('cancel',event=>{if(settingsBusy)event.preventDefault();});
async function configureModel(testOnly:boolean){
 const form=$<HTMLFormElement>('model-form');if(settingsBusy||!form.reportValidity())return;
 const endpoint=$<HTMLInputElement>('config-endpoint').value.trim(),modelId=$<HTMLInputElement>('config-model').value.trim();
 const adapterId=$<HTMLSelectElement>('config-adapter').value as ModelConfig['adapterId'];
 const existing=models().find(m=>m.id===editingId);
 const config:ModelConfig={id:existing?.id??uid(),adapterId,label:$<HTMLInputElement>('config-label').value.trim(),endpoint,modelId,...(adapterId!=='openai-compatible'?{maxOutputTokens:Number($<HTMLInputElement>('config-tokens').value)}:{})};
 const keyValue=$<HTMLInputElement>('config-key').value;
 const key=keyValue||((editingId&&connectionFlags.get(editingId)?.hasKey)?undefined:'');
 const remember=$<HTMLInputElement>('config-remember').checked&&secureStorage;
 settingsBusy=true;for(const control of form.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLButtonElement>('input,select,button'))control.disabled=true;
 try{
  if(testOnly){$('config-status').textContent='합성 요청으로 연결 확인 중…';await port.testConnection(config,key);$('config-status').textContent='연결 테스트 성공 · 문서/대화/자료 전송 없음. 새로 입력한 키는 테스트로 저장되지 않습니다. 저장하려면 다시 입력하고 연결 저장을 누르세요.';}
  else{await port.configure(config,key,remember);if(existing)Object.assign(existing,config);else models().push(config);await refreshConnections();chat().modelId=config.id;await persist();renderModels();$<HTMLDialogElement>('model-dialog').close();status(remember?'연결을 암호화해 저장했습니다. 재실행 후에도 사용할 수 있습니다.':'연결을 등록했습니다. 키는 현재 서버 실행 중에만 유지됩니다.');}
 }catch(e){$('config-status').textContent=e instanceof Error?e.message:String(e);}
 finally{settingsBusy=false;$<HTMLInputElement>('config-key').value='';for(const control of form.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLButtonElement>('input,select,button'))control.disabled=false;$<HTMLInputElement>('config-remember').disabled=!secureStorage;$<HTMLButtonElement>('delete-connection').disabled=!editingId;adapterHint(false);}
}
on('test-connection',()=>configureModel(true));
$('model-form').addEventListener('submit',e=>{e.preventDefault();void configureModel(false).catch(error);});

return {refresh:refreshConnections,get notice(){return connectionNotice;},set notice(value:string){connectionNotice=value;}};
}
