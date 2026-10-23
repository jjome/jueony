import {parseToolbarSize,validateToolbarFont,validateToolbarLanguage} from '../../modules/document/public/index.ts';
import type {EditorFormattingState} from '../../modules/document/public/index.ts';
import {rememberSuccessfulToolbarFont,observeRecentFonts} from '../browser/recent-fonts.ts';
const composition=new WeakMap<Document,{active:boolean}>();
function compositionState(){let state=composition.get(document);if(!state){state={active:false};composition.set(document,state);document.addEventListener('compositionstart',()=>state!.active=true,true);document.addEventListener('compositionend',()=>state!.active=false,true);}return state;}
function supportsInput(input:any):boolean {
 const c=input?.cursor;if(!c||c.isInFootnote?.()||c.isInTextBox?.()||c.isInPictureObjectSelection?.()||c.isInTableObjectSelection?.())return false;
 if(c.isInHeaderFooter?.()){const range=c.getHeaderFooterSelectionOrdered?.();return Boolean(range&&(range.start.paraIdx!==range.end.paraIdx||range.start.charOffset!==range.end.charOffset));}
 return true;
}
function assertGate(services:any,params?:Record<string,unknown>){
 const api=(window as any).jueonyEditor,context=services.getContext(),input=services.getInputHandler();
 if(!input||input.active===false||input.isFormMode?.()||services.wasm.requiresPasswordForSave||!context.hasDocument||!context.isEditable||context.isFormMode||api?.busy()||compositionState().active||!supportsInput(input))throw new Error('현재 위치에서는 글꼴/크기를 변경할 수 없습니다.');
 const state=api?.formattingState?.();
 if(params?.expected&&state){const expected=params.expected as EditorFormattingState;if(expected.documentIdentity!==state.documentIdentity||expected.revision!==state.revision||expected.selectionToken!==state.selectionToken)throw new Error('서식을 입력하는 동안 문서나 선택이 바뀌었습니다. 다시 선택하세요.');}
 return input;
}
export const formattingToolbarCommands=[
 {id:'format:set-font-family',label:'글꼴 지정',canExecute:(context:any)=>context.hasDocument&&context.isEditable&&!context.isFormMode&&!(window as any).jueonyEditor?.busy()&&!compositionState().active&&(window as any).jueonyEditor?.formattingState?.().fontEnabled!==false,
  execute(services:any,params:Record<string,unknown>={}){
   const input=assertGate(services,params),language=validateToolbarLanguage(params.language??'all');
   let families:string[]|undefined,name:string|undefined;
   if(params.families!==undefined){if(!Array.isArray(params.families)||params.families.length!==7)throw new Error('대표 글꼴 세트는 7개 언어가 필요합니다.');families=params.families.map(validateToolbarFont);}
   else name=validateToolbarFont(params.name);
   const wasm=services.wasm;let mods:any;
   if(families){mods={fontIds:families.map((name,index)=>wasm.findOrCreateFontIdForLang(index,name))};}
   else if(language==='all'){mods={fontIds:Array.from({length:7},(_,lang)=>wasm.findOrCreateFontIdForLang(lang,name))};}
   else {
    const current=input.getCharProperties(),existing=current.fontFamilies;
    if(!Array.isArray(existing)||existing.length!==7)throw new Error('현재 언어별 글꼴 정보를 읽지 못했습니다.');
    const names=existing.map((font:string,index:number)=>validateToolbarFont(index===language?name:font));
    mods={fontIds:names.map((font:string,index:number)=>wasm.findOrCreateFontIdForLang(index,font))};
   }
   const ids=mods.fontIds??[mods.fontId];if(ids.some((id:number)=>!Number.isInteger(id)||id<0||id>65535))throw new Error('글꼴을 문서에 등록하지 못했습니다.');
   services.eventBus.emit('format-char',mods);
  }},
 {id:'format:set-font-size',label:'글자 크기 지정',canExecute:(context:any)=>context.hasDocument&&context.isEditable&&!context.isFormMode&&!(window as any).jueonyEditor?.busy()&&!compositionState().active&&(window as any).jueonyEditor?.formattingState?.().fontEnabled!==false,
  execute(services:any,params:Record<string,unknown>={}){assertGate(services,params);const fontSize=parseToolbarSize(params.sizePt);services.eventBus.emit('format-char',{fontSize});}},
];
export function readNativeFormattingState(wasm:any,input:any,context:any,api:any):EditorFormattingState {
 const bar=document.getElementById('style-bar'),value=(id:string)=>(document.getElementById(id) as HTMLInputElement|HTMLSelectElement|null)?.value??'';
 const active=(id:string)=>document.getElementById(id)?.classList.contains('active')??false;
 const size=Number(value('font-size')),style=Number(value('style-name')),language=value('font-lang');
 const cursor=input?.cursor,position=input?.getCursorPosition?.(),selection=cursor?.getSelection?.();
 const story={header:cursor?.headerFooterMode,hfSection:cursor?.hfSectionIdx,hfApply:cursor?.hfApplyTo,hfPara:cursor?.hfParaIdx,hfOffset:cursor?.hfCharOffset,hfSelection:cursor?.getHeaderFooterSelectionOrdered?.(),footnote:cursor?.fnControlIdx};
 const enabled=Boolean(context?.hasDocument&&context.isEditable&&!context.isFormMode&&!input?.isFormMode?.()&&!api?.busy()&&!wasm.requiresPasswordForSave&&input?.active!==false&&!compositionState().active);
 return {visible:Boolean(bar&&!bar.hidden&&getComputedStyle(bar).display!=='none'),enabled,fontEnabled:enabled&&supportsInput(input),
  revision:api?.revision?.()??'',documentIdentity:api?.documentIdentity?.()??'',selectionToken:JSON.stringify({position,selection,story}),
  styleId:value('style-name')!==''&&Number.isInteger(style)?style:null,fontFamily:value('font-name'),sizePt:Number.isFinite(size)&&size>=1?size:null,
  language:/^[0-6]$/.test(language)?Number(language):'all',bold:active('btn-bold'),italic:active('btn-italic'),underline:active('btn-underline'),
  alignment:['left','center','right','justify','distribute','split'].find(value=>active('btn-align-'+value))??null,
  fonts:Array.from((document.getElementById('font-name') as HTMLSelectElement|null)?.options??[]).map(option=>option.value).filter(value=>!value.startsWith('__fontset__'))};
}
function report(toolbar:any,error:unknown){let label=toolbar.container.querySelector('[data-formatting-error]');if(!label){label=document.createElement('span');label.dataset.formattingError='true';label.setAttribute('role','alert');label.style.cssText='color:#b43b2e;max-width:260px;font-size:11px;overflow-wrap:anywhere;padding:4px;';toolbar.container.append(label);}label.textContent=error instanceof Error?error.message:String(error);}
function expected(toolbar:any){return toolbar.jueonyFormattingExpected??(window as any).jueonyEditor?.formattingState?.();}
function dispatch(toolbar:any,id:string,params:Record<string,unknown>){const result=toolbar.dispatcher.dispatchWithResult(id,{...params,expected:expected(toolbar)});if(!result.ok)throw new Error(result.message??'현재 문서에서 서식을 변경할 수 없습니다.');toolbar.jueonyFormattingExpected=undefined;toolbar.container.querySelector('[data-formatting-error]')?.remove();}
export function commitToolbarFont(toolbar:any,value:string):void {
 try{const set=toolbar.findFontSetByName(value);if(set){const families=['korean','english','chinese','japanese','other','symbol','user'].map(key=>validateToolbarFont(set[key]));dispatch(toolbar,'format:set-font-family',{families,language:'all'});}
  else {const name=validateToolbarFont(value);dispatch(toolbar,'format:set-font-family',{name,language:validateToolbarLanguage(toolbar.fontLang.value)});rememberSuccessfulToolbarFont(name);}
 }catch(error){report(toolbar,error);}
}
export function commitToolbarSize(toolbar:any,value:unknown):void {try{const size=parseToolbarSize(value);dispatch(toolbar,'format:set-font-size',{sizePt:size/100});toolbar.fontSize.value=String(size/100);}catch(error){report(toolbar,error);}}
export function installNativeFormattingBoundary(toolbar:any):void {
 compositionState();
 const disposeRecent=observeRecentFonts(()=>{if(toolbar.fontMenu)toolbar.renderFontMenu(toolbar.fontMenu);});
 window.addEventListener('pagehide',event=>{if(!(event as PageTransitionEvent).persisted)disposeRecent();});
 toolbar.eventBus.on('command-state-changed',()=>{if(!toolbar.container.contains(document.activeElement)&&!toolbar.fontMenu)toolbar.jueonyFormattingExpected=undefined;});
 toolbar.container.addEventListener('focusin',()=>{toolbar.jueonyFormattingExpected=(window as any).jueonyEditor?.formattingState?.();});
 toolbar.container.addEventListener('pointerdown',()=>{toolbar.jueonyFormattingExpected=(window as any).jueonyEditor?.formattingState?.();},true);
 for(const type of ['mousedown','click','change','input','keydown'])toolbar.container.addEventListener(type,(event:Event)=>{
  const target=event.target as HTMLElement;if(target.id==='font-lang'||type==='keydown'&&!['Enter',' ','ArrowUp','ArrowDown'].includes((event as KeyboardEvent).key))return;
  const state=(window as any).jueonyEditor?.formattingState?.(),fontControl=Boolean(target.closest('#font-name,#font-size,#btn-size-up,#btn-size-down'));
  if(state&&(!state.enabled||fontControl&&!state.fontEnabled)){event.preventDefault();event.stopImmediatePropagation();report(toolbar,'문서 작업·한글 조합이 끝나거나 편집 가능한 위치에서 다시 시도하세요.');return;}
  const expected=toolbar.jueonyFormattingExpected;
  if(state&&expected&&(type==='change'||type==='input'||type==='keydown'&&(event as KeyboardEvent).key==='Enter')&&(expected.revision!==state.revision||expected.documentIdentity!==state.documentIdentity||expected.selectionToken!==state.selectionToken)){event.preventDefault();event.stopImmediatePropagation();report(toolbar,'문서나 선택이 바뀌었습니다. 서식 값을 다시 입력하세요.');}
 },true);
}
