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
    `${marker}\nimport {sha256} from '@noble/hashes/sha2.js';\nimport {createStyleGalleryProfileStore} from '../adapters/browser/style-gallery-profile.ts';\nimport {createStyleShortcutProfileStore,STYLE_SHORTCUT_PROFILE_KEY} from '../adapters/browser/style-shortcut-profile.ts';\nimport {resolveStoredStyleShortcut} from '../adapters/rhwp/style-shortcut-consumer.ts';\nimport { installEqualCells, equalCellHelp } from '../editor-actions/equal-cells.ts';`,
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
    `  const styleShortcutButton=document.createElement('button');styleShortcutButton.type='button';styleShortcutButton.textContent='스타일 번호키';styleShortcutButton.title='현재 사용자 스타일 번호키 설정';styleShortcutButton.onclick=jueonyOpenShortcutSettings;document.getElementById('jueony-title')?.append(styleShortcutButton);
  const button = document.createElement('button'); button.textContent = '단축키'; button.type = 'button'; button.title = '한글 2024 단축키와 지원 상태';`,
    'settings button');
  return source;
}

export async function applyStyleShortcutUiPatches({root}){
  const path=join(root,'src/jueony/shortcuts/install.ts');
  await writeFile(path,patchStyleShortcutUiSource(await readFile(path,'utf8')));
}
