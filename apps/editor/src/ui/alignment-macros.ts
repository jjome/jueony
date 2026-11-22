import type {DocumentFrameClient} from '../adapters/iframe/document-client.ts';
import {fingerprint} from '../adapters/files/fingerprints.ts';
import {readDocumentFailure} from '../modules/document/public/index.ts';
import {parseScriptMacroB142,serializeScriptMacroB142,SCRIPT_MACRO_B142_LIMITS,SCRIPT_MACRO_BODY_TEXT_COMMAND,type SavedAlignmentMacro,type ScriptMacroB142} from '../modules/script-macros/public/index.ts';
import {element as $} from './dom.ts';

type Owner = {api:DocumentFrameClient|null;frame:HTMLIFrameElement};
const includesTextEdit = (macro:ScriptMacroB142) => macro.steps.some(step=>step.commandId===SCRIPT_MACRO_BODY_TEXT_COMMAND);

export function installAlignmentMacros<Tab extends Owner>(options:{
  active():Tab|undefined;
  blocked():boolean;
  persist(tab:Tab):Promise<unknown>;
  library():{workspaceId:string;records:SavedAlignmentMacro[]};
  replaceRecord(record:SavedAlignmentMacro,remove?:boolean):Promise<void>;
  queueRequest(includeText:boolean):void;
  on(id:string,action:()=>unknown):void;
  status(text:string):void;
  error(error:unknown):void;
}){
  const {active,blocked,persist,on,status,error}=options;
  let recordingAlignment:Tab|undefined;
  let recordingAlignmentSource:string|undefined;
  const recordedAlignment=new WeakMap<Tab,{macro:ScriptMacroB142;source?:string;importedRevision?:string}>();
  const librarySelect=$<HTMLSelectElement>('alignment-library-select');
  const records=()=>{
   const {workspaceId,records}=options.library();
   return records.filter(record=>record.workspaceId===workspaceId);
  };
  function renderLibrary(){
   const entries=records(),previous=librarySelect.value;
   librarySelect.replaceChildren(...entries.map(record=>new Option(new Date(record.createdAt).toLocaleString('ko-KR'),record.id)));
   if(entries.some(record=>record.id===previous))librarySelect.value=previous;
   $('alignment-library').hidden=entries.length===0;
   $<HTMLButtonElement>('load-alignment-record').disabled=Boolean(recordingAlignment)||!active()?.api;
   $<HTMLButtonElement>('delete-alignment-record').disabled=Boolean(recordingAlignment);
  }
  function renderAlignmentMacro(){
   const tab=active(),saved=tab&&recordedAlignment.get(tab);
   const hasCurrentRecording=Boolean(saved&&tab?.api&&saved.macro.recordedFrom.documentIdentity===tab.api.documentIdentity()&&
    (saved.importedRevision===undefined||saved.importedRevision===tab.api.revision()));
   $<HTMLButtonElement>('start-alignment-macro').disabled=Boolean(recordingAlignment)||!tab?.api?.startAlignmentMacro;
   $<HTMLButtonElement>('finish-alignment-macro').disabled=!recordingAlignment;
   $<HTMLButtonElement>('cancel-alignment-macro').disabled=!recordingAlignment;
   $<HTMLButtonElement>('replay-alignment-macro').disabled=Boolean(recordingAlignment)||!hasCurrentRecording;
   $<HTMLButtonElement>('agent-alignment-macro').disabled=Boolean(recordingAlignment)||!hasCurrentRecording||!saved?.source;
   $<HTMLButtonElement>('export-alignment-macro').disabled=!saved;
   $<HTMLButtonElement>('import-alignment-macro').disabled=Boolean(recordingAlignment)||!tab?.api?.bindImportedAlignmentMacro;
   $('alignment-macro-status').textContent=recordingAlignment?'현재 문서에서 본문 입력과 정렬을 기록 중입니다.'
    :saved?(hasCurrentRecording?`기록한 ${includesTextEdit(saved.macro)?'편집':'정렬'} ${saved.macro.steps.length}개`:'문서 상태가 바뀌었습니다. 원래 상태에서 다시 가져오세요.')
    :'일반 본문의 입력·삭제·정렬을 기록합니다. 채팅 요청에는 기록한 본문을 보내지 않습니다.';
   renderLibrary();
  }
  function cancelAlignmentRecording(){
   recordingAlignment?.api?.cancelAlignmentMacro?.();
   recordingAlignment=undefined;
   recordingAlignmentSource=undefined;
   $('macro-manager').textContent='반복 작업';
  }
  async function alignmentSource(api:DocumentFrameClient){
   const record=api.recovery();
   if(!record||record.bytes.length>50_000_000)throw new Error('기록과 대조할 현재 문서의 저장 바이트를 확인할 수 없습니다.');
   return 'sha256:'+await fingerprint(new Uint8Array(record.bytes).buffer);
  }
  on('start-alignment-macro',async()=>{
   const tab=active(),api=tab?.api;
   if(recordingAlignment||blocked()||!tab||!api?.startAlignmentMacro)throw new Error('현재 문서 작업을 마친 뒤 편집 기록을 시작하세요.');
   const identity=api.documentIdentity(),revision=api.revision();
   const source=await alignmentSource(api).catch(()=>undefined);
   if(active()!==tab||tab.api!==api||identity!==api.documentIdentity()||revision!==api.revision()||recordingAlignment||blocked()){
    throw new Error('기록을 시작하기 전에 문서가 바뀌었습니다.');
   }
   api.startAlignmentMacro();
   recordingAlignment=tab;
   recordingAlignmentSource=source;
   $('macro-manager').textContent='편집 기록 중';
   $<HTMLDialogElement>('macro-dialog').close();
   status('일반 본문에서 입력·삭제·정렬을 실행하고 반복 작업 창에서 기록을 마치세요.');
  });
  on('finish-alignment-macro',async()=>{
   const owner=recordingAlignment;
   if(!owner?.api?.finishAlignmentMacro||active()!==owner)throw new Error('기록을 시작한 문서에서 기록을 마치세요.');
   const source=recordingAlignmentSource;
   let macro:ScriptMacroB142;
   try{macro=owner.api.finishAlignmentMacro('수동 편집');recordedAlignment.set(owner,{macro,source});}
   finally{cancelAlignmentRecording();renderAlignmentMacro();}
   const label=includesTextEdit(macro)?'본문 편집':'문단 정렬';
   if(!source||records().length>=100){status(`현재 탭에 ${label} 매크로를 기록했습니다. JSON으로 내보낼 수 있습니다.`);return;}
   const json=serializeScriptMacroB142({...macro,recordedFrom:{...macro.recordedFrom,documentIdentity:source}});
   await options.replaceRecord({id:crypto.randomUUID(),workspaceId:options.library().workspaceId,createdAt:Date.now(),json});
   renderLibrary();status(`${label} 매크로를 이 업무에 기록했습니다.`);
  });
  on('cancel-alignment-macro',()=>{cancelAlignmentRecording();renderAlignmentMacro();status('편집 매크로 기록을 취소했습니다.');});
  on('agent-alignment-macro',()=>{
   const tab=active(),saved=tab&&recordedAlignment.get(tab);
   if(recordingAlignment||blocked()||!saved)throw new Error('현재 문서 작업을 마친 뒤 편집 기록을 요청하세요.');
   $<HTMLDialogElement>('macro-dialog').close();options.queueRequest(includesTextEdit(saved.macro));
  });
  on('replay-alignment-macro',async()=>{
   const tab=active(),saved=tab&&recordedAlignment.get(tab);
   if(recordingAlignment||blocked()||!tab?.api?.replayAlignmentMacro||!saved||
    (saved.importedRevision!==undefined&&saved.importedRevision!==tab.api.revision()))throw new Error('기록한 원래 문서 상태에서 재생해 주세요.');
   $<HTMLDialogElement>('macro-dialog').close();
   await tab.api.replayAlignmentMacro(saved.macro);
   status(`${includesTextEdit(saved.macro)?'본문 편집':'문단 정렬'} 매크로를 재생했습니다. 한 번에 되돌릴 수 있습니다.`);
   await persist(tab).catch(error);
  });
  on('export-alignment-macro',()=>{
   const tab=active(),saved=tab&&recordedAlignment.get(tab);
   if(!saved)return;
   const link=document.createElement('a');
   const macro={...saved.macro,recordedFrom:{...saved.macro.recordedFrom,documentIdentity:saved.source??'session-only'}};
   const url=URL.createObjectURL(new Blob([serializeScriptMacroB142(macro)],{type:'application/json'}));
   link.href=url;link.download=includesTextEdit(macro)?'jueony-manual-edit.json':'jueony-paragraph-alignment.json';link.click();
   window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  const alignmentImport=$<HTMLInputElement>('alignment-macro-file');
  async function loadAlignment(read:()=>Promise<string>){
   const tab=active(),api=tab?.api,workspaceId=options.library().workspaceId;
   if(!tab||!api?.bindImportedAlignmentMacro||recordingAlignment||blocked())throw new Error('현재 문서 작업을 마친 뒤 편집 기록을 가져오세요.');
   const revision=api.revision(),identity=api.documentIdentity(),macro=parseScriptMacroB142(await read());
   const source=macro.recordedFrom.documentIdentity;
   if(!/^sha256:[a-f0-9]{64}$/u.test(source)||source!==await alignmentSource(api))throw new Error('기록을 시작할 때의 문서 바이트와 일치해야 가져올 수 있습니다.');
   if(active()!==tab||tab.api!==api||revision!==api.revision()||identity!==api.documentIdentity()||recordingAlignment||blocked()||
      workspaceId!==options.library().workspaceId){
    throw new Error('문서 상태가 바뀌었습니다. 편집 기록을 다시 가져오세요.');
   }
   const bound=api.bindImportedAlignmentMacro(macro);
   recordedAlignment.set(tab,{macro:bound,source,importedRevision:revision});
   renderAlignmentMacro();status('현재 문서에 편집 기록을 가져왔습니다.');
  }
  on('load-alignment-record',async()=>{
   const record=records().find(item=>item.id===librarySelect.value);
   if(record)await loadAlignment(async()=>record.json).catch(reason=>{$('alignment-macro-status').textContent=readDocumentFailure(reason).message;});
  });
  on('delete-alignment-record',async()=>{
   const record=records().find(item=>item.id===librarySelect.value);
   if(!record)return;
   await options.replaceRecord(record,true);
   renderLibrary();status('이 업무에 저장한 편집 기록을 삭제했습니다.');
  });
  on('import-alignment-macro',()=>alignmentImport.click());
  alignmentImport.addEventListener('change',()=>{
   const file=alignmentImport.files?.[0];alignmentImport.value='';
   if(!file)return;
   void loadAlignment(async()=>{
    if(file.size>SCRIPT_MACRO_B142_LIMITS.maximumSerializedBytes)throw new Error('편집 기록 JSON은 64KB 이하여야 합니다.');
    return file.text();
   }).catch(reason=>{$('alignment-macro-status').textContent=readDocumentFailure(reason).message;});
  });
  window.addEventListener('message',event=>{
   if(event.origin!==location.origin||!recordingAlignment||event.source!==recordingAlignment.frame.contentWindow||
      event.data?.type!=='jueony:manual-macro-invalid'||typeof event.data.message!=='string')return;
   cancelAlignmentRecording();renderAlignmentMacro();status(event.data.message);
  });
  return {
    get recording(){return Boolean(recordingAlignment);},
    render:renderAlignmentMacro,
    async agentPlan(){
      const tab=active(),api=tab?.api,saved=tab&&recordedAlignment.get(tab);
      if(!tab||!api?.prepareAlignmentMacro||!saved?.source||recordingAlignment||blocked())throw new Error('현재 문서에 사용할 편집 기록을 먼저 불러오세요.');
      const identity=api.documentIdentity(),revision=api.revision();
      if((saved.importedRevision!==undefined&&saved.importedRevision!==revision)||saved.source!==await alignmentSource(api)){
        throw new Error('편집 기록의 시작 문서와 같은 버전을 열어 주세요.');
      }
      if(active()!==tab||tab.api!==api||identity!==api.documentIdentity()||revision!==api.revision()||recordingAlignment||blocked()){
        throw new Error('편집 기록을 확인하는 동안 문서 상태가 바뀌었습니다.');
      }
      return {revision,generation:api.prepareAlignmentMacro(saved.macro)};
    },
    cancelOnTabSwitch(next:Tab){
      if(!recordingAlignment||recordingAlignment===next)return;
      cancelAlignmentRecording();
      status('문서를 전환해 편집 매크로 기록을 취소했습니다.');
    },
  };
}
