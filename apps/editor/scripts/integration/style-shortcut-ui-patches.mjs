import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';

const marker='/* jueony-style-shortcut-ui-v1 */';

function replaceOnce(source,before,after,label){
  if(source.split(before).length!==2)throw new Error(`Style shortcut UI seam drift: ${label}`);
  return source.replace(before,after);
}

/** Patch only the generated Studio copy. Product source stays independent of pinned upstream seams. */
export function patchStyleShortcutUiSource(source){
  source=source.replace(/\r\n/g,'\n');
  if(source.includes(marker))throw new Error('Style shortcut UI patch was already applied');
  source=replaceOnce(source,
    "import { installEqualCells, equalCellHelp } from '../editor-actions/equal-cells.ts';",
    `${marker}\nimport {sha256} from '@noble/hashes/sha2.js';\nimport {createStyleGalleryProfileStore} from '../adapters/browser/style-gallery-profile.ts';\nimport {commitPortableStyleGalleryImport,exportPortableStyleGalleryPackage,exportPortableStyleGalleryProfile,previewPortableStyleGalleryImport} from '../adapters/browser/style-gallery-portable.ts';\nimport {createStyleShortcutProfileStore,STYLE_SHORTCUT_PROFILE_KEY} from '../adapters/browser/style-shortcut-profile.ts';\nimport {resolveStoredStyleShortcut} from '../adapters/rhwp/style-shortcut-consumer.ts';\nimport { installEqualCells, equalCellHelp } from '../editor-actions/equal-cells.ts';`,
    'imports');
  source=replaceOnce(source,
    '  const resolver = new HangulKeyResolver();',
    `  const resolver = new HangulKeyResolver();
  const jueonyGalleryProfiles=createStyleGalleryProfileStore(localStorage);
  const jueonyShortcutProfiles=createStyleShortcutProfileStore(localStorage);
  const jueonyCanonical=(value:any):any=>Array.isArray(value)?value.map(jueonyCanonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,jueonyCanonical(value[key])])):value;
  const jueonyDigest=(value:unknown)=>Array.from(sha256(new TextEncoder().encode(JSON.stringify(jueonyCanonical(value)))),byte=>byte.toString(16).padStart(2,'0')).join('');
  const jueonyShortcutState=()=>{
    try{
      const stored=jueonyShortcutProfiles.read();if(!stored)return{configured:false as const};
      const profile=jueonyGalleryProfiles.read();
      if(!profile||profile.id!==stored.profileId||profile.name!==stored.profileName||!profile.gallery.some(entry=>entry.id===stored.entryId))return{configured:true as const,stored,reason:'저장된 스타일마당 프로필이 현재 설정과 다릅니다.'};
      const scope={profileId:profile.id,entryId:stored.entryId,profileSha256:jueonyDigest(profile)};
      if(scope.profileSha256!==stored.profileSha256)return{configured:true as const,stored,reason:'스타일마당 프로필이 변경되었습니다.'};
      return{configured:true as const,stored,scope};
    }catch(error){return{configured:true as const,reason:error instanceof Error?error.message:String(error)};}
  };
  const jueonyShortcutBlocked=(event:KeyboardEvent,context:any,ih:any)=>{
    const target=event.target instanceof HTMLElement?event.target:null;
    return event.isComposing||event.keyCode===229||!!ih?.isComposing||!!document.querySelector('dialog[open],.modal-overlay,.context-menu')
      ||(!!target?.closest('input,textarea,select,[contenteditable=true],[role=textbox]')&&target!==ih?.textarea)
      ||!!context.inTable||!!context.inCellSelectionMode||!!context.inPictureObjectSelection||!!context.inTableObjectSelection
      ||!!ih?.cursor?.isInHeaderFooter?.()||!!ih?.cursor?.isInFootnote?.()||!!ih?.cursor?.isInTextBox?.()
      ||(ih?.getCursorPosition?.()?.cellPath?.length??0)>0||!!(window as any).jueonyEditor?.busy?.()||!!document.getElementById('studio-root')?.inert;
  };
  const jueonyResolveShortcut=(slot:unknown)=>{
    const state=jueonyShortcutState();if(!state.configured)return{state,assigned:false as const};
    if(!('stored'in state)||!state.stored)return{state,assigned:true as const,reason:'저장된 번호키 설정을 확인하지 못했습니다.'};
    if(!state.stored.slots.some(value=>value.slot===slot))return{state,assigned:false as const};
    if(!state.scope)return{state,assigned:true as const,reason:'reason'in state?state.reason:'현재 프로필을 확인하지 못했습니다.'};
    const ih=input(),command=resolveStoredStyleShortcut(ih?.wasm,state.stored,state.scope,slot);
    return command?{state,assigned:true as const,command}:{state,assigned:true as const,reason:'번호키 설정이 현재 문서 스타일과 일치하지 않습니다.'};
  };
  const jueonyCanRewriteShortcutProfile=(state:ReturnType<typeof jueonyShortcutState>)=>{
    if(!state.configured||!('stored'in state)||!state.stored||!state.scope)return false;
    return state.stored.slots.every(slot=>!!resolveStoredStyleShortcut(input()?.wasm,state.stored,state.scope,slot.slot));
  };
  const jueonyClearShortcutSlot=(slot:number)=>{
    const state=jueonyShortcutState();
    if(!jueonyCanRewriteShortcutProfile(state)||!('stored'in state)||!state.stored)throw new Error('현재 문서와 프로필을 다시 확인하기 전에는 번호키 설정을 바꿀 수 없습니다.');
    const slots=state.stored.slots.filter(value=>value.slot!==slot);
    const evidence={version:1 as const,profileId:state.stored.profileId,profileName:state.stored.profileName,entryId:state.stored.entryId,profileSha256:state.stored.profileSha256,documentSha256:state.stored.documentSha256,expectedStyleIds:slots.filter(value=>value.source==='package').map(value=>value.styleId),slots};
    jueonyShortcutProfiles.save(evidence,()=>evidence);
  };
  const jueonyResetShortcutProfile=()=>{
    let before:string|null;try{before=localStorage.getItem(STYLE_SHORTCUT_PROFILE_KEY);}catch{throw new Error('번호키 설정을 읽지 못했습니다.');}
    try{localStorage.removeItem(STYLE_SHORTCUT_PROFILE_KEY);if(localStorage.getItem(STYLE_SHORTCUT_PROFILE_KEY)!==null)throw new Error('readback');}
    catch{try{if(before===null)localStorage.removeItem(STYLE_SHORTCUT_PROFILE_KEY);else localStorage.setItem(STYLE_SHORTCUT_PROFILE_KEY,before);if(localStorage.getItem(STYLE_SHORTCUT_PROFILE_KEY)!==before)throw new Error('readback');}catch{throw new Error('번호키 설정 초기화 실패 후 기존 설정을 복원하지 못했습니다.');}throw new Error('번호키 설정을 초기화하지 못했습니다.');}
  };
  const jueonyOpenShortcutSettings=()=>{
    const dialog=document.createElement('dialog');dialog.style.cssText='max-width:620px;width:80%;max-height:75vh;border:1px solid #ccd5df;border-radius:8px;padding:20px';
    const title=document.createElement('h2');title.textContent='사용자 스타일 번호키';
    const status=document.createElement('p');status.setAttribute('role','status');
    const list=document.createElement('div');
    const close=document.createElement('button');close.type='button';close.textContent='닫기';close.onclick=()=>dialog.close();
    const reset=document.createElement('button');reset.type='button';reset.textContent='기본 번호키로 재설정';
    const render=()=>{
      list.replaceChildren();const state=jueonyShortcutState();
      if(!state.configured){status.textContent='사용자 지정이 없습니다. 한글 기본 Ctrl+1~Ctrl+0 스타일을 사용합니다.';reset.disabled=true;return;}
      reset.disabled=false;
      if(!('stored'in state)||!state.stored){status.textContent='reason'in state?state.reason:'현재 프로필과 연결되지 않았습니다.';return;}
      const valid=!!state.scope&&jueonyCanRewriteShortcutProfile(state),disconnected='reason'in state&&typeof state.reason==='string'?state.reason:'프로필 또는 문서 스타일이 변경되어 실행이 차단되었습니다.';status.textContent=valid?state.stored.profileName+' · 현재 문서와 연결됨':disconnected;
      for(const slot of [...state.stored.slots].sort((a,b)=>a.slot-b.slot)){
        const row=document.createElement('p'),label=document.createElement('span'),clear=document.createElement('button');
        label.textContent='Ctrl+'+((slot.slot+1)%10)+' → '+slot.styleName;clear.type='button';clear.textContent='해제';clear.disabled=!valid;
        clear.onclick=()=>{try{jueonyClearShortcutSlot(slot.slot);render();}catch(error){status.textContent=error instanceof Error?error.message:String(error);}};
        row.append(label,' ',clear);list.append(row);
      }
    };
    reset.onclick=()=>{try{jueonyResetShortcutProfile();render();}catch(error){status.textContent=error instanceof Error?error.message:String(error);}};
    dialog.append(title,status,list,reset,close);document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove(),{once:true});render();dialog.showModal();close.focus();
  };
  const jueonyDownloadJson=(name:string,value:string)=>{
    const blob=new Blob([value],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),0);
  };
  const jueonyOpenGalleryPortable=()=>{
    const dialog=document.createElement('dialog');dialog.style.cssText='max-width:760px;width:85%;max-height:82vh;border:1px solid #ccd5df;border-radius:8px;padding:20px';
    const title=document.createElement('h2');title.textContent='스타일마당 JSON 가져오기·내보내기';
    const description=document.createElement('p');description.textContent='기관 프로필 전체 또는 선택한 스타일 패키지만 이동합니다. 가져오기는 검증과 저장 확인이 끝난 경우에만 현재 설정을 바꿉니다.';
    const status=document.createElement('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    const fileLabel=document.createElement('label');fileLabel.textContent='가져올 JSON 파일 ';
    const file=document.createElement('input');file.type='file';file.accept='.json,application/json';fileLabel.append(file);
    const sourceLabel=document.createElement('label');sourceLabel.textContent='JSON 내용';sourceLabel.style.display='block';
    const source=document.createElement('textarea');source.rows=12;source.style.cssText='box-sizing:border-box;width:100%;font-family:monospace';sourceLabel.append(source);
    const packageFields=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent='단일 패키지를 추가할 때의 새 항목 정보';
    const idLabel=document.createElement('label');idLabel.textContent='항목 ID ';
    const id=document.createElement('input');id.type='text';id.pattern='[a-z0-9][a-z0-9._-]{0,79}';id.autocomplete='off';idLabel.append(id);
    const nameLabel=document.createElement('label');nameLabel.textContent=' 표시 이름 ';
    const label=document.createElement('input');label.type='text';label.maxLength=120;label.autocomplete='off';nameLabel.append(label);packageFields.append(legend,idLabel,nameLabel);
    const exportLabel=document.createElement('label');exportLabel.textContent='내보낼 패키지 ';
    const exportEntry=document.createElement('select');exportLabel.append(exportEntry);
    const profileExport=document.createElement('button');profileExport.type='button';profileExport.textContent='프로필 내보내기';
    const packageExport=document.createElement('button');packageExport.type='button';packageExport.textContent='선택 패키지 내보내기';
    const importButton=document.createElement('button');importButton.type='button';importButton.textContent='검증 후 가져오기';
    const close=document.createElement('button');close.type='button';close.textContent='닫기';close.onclick=()=>dialog.close();
    const renderEntries=()=>{
      exportEntry.replaceChildren();let profile;
      try{profile=jueonyGalleryProfiles.read();}catch(error){status.textContent=error instanceof Error?error.message:String(error);return;}
      for(const entry of profile?.gallery??[]){const option=document.createElement('option');option.value=entry.id;option.textContent=entry.label+' ('+entry.id+')';exportEntry.append(option);}
      packageExport.disabled=!exportEntry.value;
    };
    file.onchange=async()=>{const selected=file.files?.[0];if(!selected)return;if(selected.size>2_000_000){status.textContent='가져올 스타일마당 JSON은 2MB 이하여야 합니다.';file.value='';return;}try{source.value=await selected.text();status.textContent=selected.name+' 파일을 읽었습니다. 검증 후 가져오기를 누르세요.';}catch{status.textContent='선택한 JSON 파일을 읽지 못했습니다.';}};
    profileExport.onclick=()=>{try{jueonyDownloadJson('jueony-style-gallery-profile.json',exportPortableStyleGalleryProfile(localStorage));status.textContent='스타일마당 프로필을 내보냈습니다.';}catch(error){status.textContent=error instanceof Error?error.message:String(error);}};
    packageExport.onclick=()=>{try{jueonyDownloadJson('jueony-style-package-'+exportEntry.value+'.json',exportPortableStyleGalleryPackage(localStorage,exportEntry.value));status.textContent='선택한 스타일 패키지를 내보냈습니다.';}catch(error){status.textContent=error instanceof Error?error.message:String(error);}};
    importButton.onclick=()=>{try{const preview=previewPortableStyleGalleryImport(localStorage,source.value,{id:id.value,label:label.value});commitPortableStyleGalleryImport(localStorage,preview);status.textContent=preview.kind==='profile'?'스타일마당 프로필을 가져왔습니다.':'스타일 패키지를 현재 프로필에 추가했습니다.';source.value='';file.value='';renderEntries();}catch(error){status.textContent=error instanceof Error?error.message:String(error);}};
    dialog.append(title,description,status,fileLabel,sourceLabel,packageFields,exportLabel,profileExport,packageExport,importButton,close);document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove(),{once:true});renderEntries();dialog.showModal();close.focus();
  };`,
    'runtime setup');
  source=replaceOnce(source,
    "    const outcome = automation.execute(b.command, b.params, { allowDialog: true });\n    hint(outcome.ok ? '' : b.command === 'table:cell-height-equal' || b.command === 'table:cell-width-equal' ? equalCellHelp : b.label + ': 현재 문맥에서 실행할 수 없습니다.');",
    `    if(b.command==='ext:jueony-default-style'){
      const prepared=jueonyResolveShortcut(b.params?.slot);
      if(prepared.state.configured&&prepared.assigned){
        if(jueonyShortcutBlocked(event,c,ih)){hint('본문의 일반 문단에서만 사용자 스타일 번호키를 실행할 수 있습니다.');return;}
        const command='command'in prepared?prepared.command:undefined;
        if(!command){const reason='reason'in prepared&&typeof prepared.reason==='string'?prepared.reason:'reason'in prepared.state&&typeof prepared.state.reason==='string'?prepared.state.reason:'번호키 설정을 다시 확인하세요.';hint(reason);return;}
        const outcome=automation.execute('format:apply-style',{styleId:command.styleId});
        hint(outcome.ok?'':'현재 문맥에서 저장된 스타일을 적용할 수 없습니다.');return;
      }
    }
    const outcome = automation.execute(b.command, b.params, { allowDialog: true });
    hint(outcome.ok ? '' : b.command === 'table:cell-height-equal' || b.command === 'table:cell-width-equal' ? equalCellHelp : b.label + ': 현재 문맥에서 실행할 수 없습니다.');`,
    'number key dispatch');
  source=replaceOnce(source,
    "  const button = document.createElement('button'); button.textContent = '단축키'; button.type = 'button'; button.title = '한글 2024 단축키와 지원 상태';",
    `  const styleGalleryPortableButton=document.createElement('button');styleGalleryPortableButton.type='button';styleGalleryPortableButton.textContent='스타일마당 JSON';styleGalleryPortableButton.title='스타일마당 프로필과 패키지 가져오기·내보내기';styleGalleryPortableButton.onclick=jueonyOpenGalleryPortable;document.getElementById('jueony-title')?.append(styleGalleryPortableButton);
  const styleShortcutButton=document.createElement('button');styleShortcutButton.type='button';styleShortcutButton.textContent='스타일 번호키';styleShortcutButton.title='현재 사용자 스타일 번호키 설정';styleShortcutButton.onclick=jueonyOpenShortcutSettings;document.getElementById('jueony-title')?.append(styleShortcutButton);
  const button = document.createElement('button'); button.textContent = '단축키'; button.type = 'button'; button.title = '한글 2024 단축키와 지원 상태';`,
    'settings button');
  return source;
}

export async function applyStyleShortcutUiPatches({root}){
  const path=join(root,'src/jueony/shortcuts/install.ts');
  await writeFile(path,patchStyleShortcutUiSource(await readFile(path,'utf8')));
}
