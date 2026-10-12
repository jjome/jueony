import type {DocumentInteractionFacade as Editor,EditorMenuItem as MenuItem} from './modules/document/public/index.ts';

/** Navigation excludes disabled entries and wraps only arrow keys. */
export function menuNavigationIndex(enabled:boolean[],current:number,key:string):number {
 const available=enabled.flatMap((value,index)=>value?[index]:[]);
 if(!available.length)return -1;
 if(key==='Home')return available[0]!;
 if(key==='End')return available.at(-1)!;
 const step=key==='ArrowUp'||key==='ArrowLeft'?-1:1;
 const position=available.indexOf(current);
 return available[(position<0?(step>0?0:available.length-1):(position+step+available.length)%available.length)]!;
}
export function menuCommandEnabled(nodeEnabled:boolean,commandEnabled:boolean|undefined):boolean {
 return nodeEnabled&&commandEnabled===true;
}

const installations=new WeakMap<HTMLElement,()=>void>();
/** Host controls forward to the active editor dispatcher, preserving its gates and history. */
export function installUnifiedChrome(options:{menus:HTMLElement;tools:HTMLElement;active:()=>Editor|undefined;execute:(id:string,params?:Record<string,unknown>)=>unknown;error:(error:unknown)=>void}){
 installations.get(options.menus)?.();
 let identity:Editor|undefined,returnFocus:HTMLElement|null=null,disposed=false;
 const abort=new AbortController(),signal=abort.signal;
 const entries=new WeakMap<HTMLElement,{menuId:string;path:number[]}>();
 const menuLabels:Record<string,string>={file:'파일',edit:'편집',view:'보기',insert:'입력',format:'서식',page:'쪽',table:'표',tool:'도구',review:'검토',security:'보안'};
 const clean=(label:string)=>label.replace(/\([A-Z]\)/g,'').trim();
 const topMenus=()=>Array.from(options.menus.querySelectorAll<HTMLDetailsElement>(':scope > details'));
 const close=(restore=false)=>{for(const detail of options.menus.querySelectorAll<HTMLDetailsElement>('details'))detail.open=false;if(restore&&returnFocus?.isConnected)returnFocus.focus({preventScroll:true});returnFocus=null;};
 const visibleItems=(popup:HTMLElement)=>Array.from(popup.querySelectorAll<HTMLElement>('button,summary')).filter(element=>{
  if(element instanceof HTMLButtonElement&&element.disabled||element.getAttribute('aria-disabled')==='true')return false;
  for(let parent=element.parentElement;parent&&parent!==popup;parent=parent.parentElement){if(parent instanceof HTMLDetailsElement&&!parent.open&&element!==parent.firstElementChild)return false;}
  return true;
 });
 function position(detail:HTMLDetailsElement){
  const popup=detail.querySelector<HTMLElement>(':scope > .unified-menu-popup'),summary=detail.querySelector<HTMLElement>(':scope > summary');if(!popup||!summary)return;
  const anchor=summary.getBoundingClientRect(),viewport=window.visualViewport;
  const width=viewport?.width??window.innerWidth,height=viewport?.height??window.innerHeight,left=viewport?.offsetLeft??0,top=viewport?.offsetTop??0;
  popup.style.maxWidth=`${Math.max(0,width-16)}px`;popup.style.left=`${Math.max(left+8,Math.min(anchor.left,left+width-popup.offsetWidth-8))}px`;
  popup.style.top=`${anchor.bottom}px`;popup.style.maxHeight=`${Math.max(0,top+height-anchor.bottom-8)}px`;
 }
 function open(detail:HTMLDetailsElement,key?:string){
  if(!topMenus().some(item=>item.open))returnFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
  for(const other of topMenus())if(other!==detail)other.open=false;
  detail.open=true;refresh();position(detail);
  if(key){const popup=detail.querySelector<HTMLElement>('.unified-menu-popup');if(popup){const list=visibleItems(popup);(key==='End'?list.at(-1):list[0])?.focus();}}
 }
 const invoke=(button:HTMLButtonElement,id:string,params?:Record<string,unknown>)=>{
  // Recheck both menu-specific and command gates at invocation, including stale clicks.
  refresh();if(button.disabled||!button.isConnected||!options.menus.contains(button)&&!options.tools.contains(button)||options.active()!==identity)return;close();
  try{void Promise.resolve(options.execute(id,params)).catch(options.error);}catch(e){options.error(e);}
 };
 const commandButton=(id:string,label:string,params?:Record<string,unknown>,entry?:{menuId:string;path:number[]})=>{
  const b=document.createElement('button');b.type='button';b.dataset.editorCommand=id;b.textContent=clean(label);
  if(entry){entries.set(b,entry);b.setAttribute('role','menuitem');b.tabIndex=-1;}
  b.addEventListener('mousedown',e=>e.preventDefault());b.onclick=()=>invoke(b,id,params);return b;
 };
 function items(nodes:MenuItem[],parent:HTMLElement,menuId:string,path:number[]=[]){nodes.forEach((node,index)=>{
  const entry={menuId,path:[...path,index]};
  if(node.submenu?.length){
   const group=document.createElement('details'),summary=document.createElement('summary');summary.textContent=clean(node.label);summary.setAttribute('role','menuitem');summary.setAttribute('aria-haspopup','menu');summary.tabIndex=-1;entries.set(summary,entry);
   summary.addEventListener('mousedown',e=>e.preventDefault());summary.addEventListener('click',e=>{if(summary.getAttribute('aria-disabled')==='true')e.preventDefault();});
   group.addEventListener('toggle',()=>summary.setAttribute('aria-expanded',String(group.open)));group.append(summary);items(node.submenu,group,menuId,entry.path);parent.append(group);
  }else if(node.commandId)parent.append(commandButton(node.commandId,node.label,node.params,entry));
 });}
 const quick=['edit:undo','edit:redo','ext:jueony-navigation-pane','edit:find','format:char-shape','format:para-shape','table:create','file:page-setup','ext:jueony-shortcut-help'];
 function refresh(force=false){
  if(disposed)return;
  const editor=options.active();if(!editor){close();identity=undefined;options.menus.replaceChildren();options.tools.replaceChildren();return;}
  if(force||editor!==identity){close();identity=editor;options.menus.replaceChildren();options.menus.setAttribute('role','menubar');
   for(const menu of editor.menus()){
    const detail=document.createElement('details'),summary=document.createElement('summary'),popup=document.createElement('div');
    summary.textContent=menuLabels[menu.menuId]??clean(menu.label);summary.setAttribute('role','menuitem');summary.setAttribute('aria-haspopup','menu');summary.setAttribute('aria-expanded','false');summary.tabIndex=options.menus.children.length? -1:0;
    detail.className='unified-menu';popup.className='unified-menu-popup';popup.setAttribute('role','menu');popup.setAttribute('aria-label',summary.textContent);
    summary.addEventListener('mousedown',e=>e.preventDefault());summary.addEventListener('click',e=>{e.preventDefault();if(detail.open)close();else open(detail);});
    detail.addEventListener('toggle',()=>{if(disposed||!detail.isConnected)return;summary.setAttribute('aria-expanded',String(detail.open));if(detail.open){refresh();position(detail);
     if(menu.menuId==='file'&&editor.prepareMenus)void editor.prepareMenus().then(()=>{if(disposed||identity!==editor||!detail.open)return;const updated=editor.menus().find(m=>m.menuId==='file');if(updated){const focused=popup.contains(document.activeElement);popup.replaceChildren();items(updated.items,popup,menu.menuId);refresh();position(detail);if(focused)visibleItems(popup)[0]?.focus();}}).catch(options.error);
     for(const other of topMenus())if(other!==detail)other.open=false;
    }});
    items(menu.items,popup,menu.menuId);if(!popup.children.length)continue;detail.append(summary,popup);options.menus.append(detail);
   }
   const commands=editor.commands();options.tools.replaceChildren(...quick.map(id=>commandButton(id,commands.find(c=>c.id===id)?.label??id)));
  }
  options.tools.hidden=editor.toolbarsVisible?.()===false;
  const commands=new Map(editor.commands().map(c=>[c.id,c])),menus=new Map(editor.menus().map(menu=>[menu.menuId,menu.items]));
  function enabledPath(entry:{menuId:string;path:number[]}){let nodes=menus.get(entry.menuId),enabled=true;for(const index of entry.path){const node=nodes?.[index];if(!node)return false;enabled=enabled&&node.enabled;nodes=node.submenu;}return enabled;}
  for(const target of [options.menus,options.tools])for(const b of target.querySelectorAll<HTMLButtonElement>('[data-editor-command]')){
   const c=commands.get(b.dataset.editorCommand!),entry=entries.get(b);b.disabled=!menuCommandEnabled(entry?enabledPath(entry):true,c?.enabled);b.title=(c?.label??'연결되지 않은 기능')+(c?.shortcutLabel?' ('+c.shortcutLabel+')':'')+(b.disabled?' · 현재 문서에서 사용할 수 없음':'');
  }
  for(const summary of options.menus.querySelectorAll<HTMLElement>('.unified-menu-popup summary')){const entry=entries.get(summary);summary.setAttribute('aria-disabled',String(!entry||!enabledPath(entry)));if(summary.getAttribute('aria-disabled')==='true')(summary.parentElement as HTMLDetailsElement).open=false;}
 }
 const keydown=(e:KeyboardEvent)=>{
  const target=e.target instanceof HTMLElement?e.target:null,detail=target?.closest<HTMLDetailsElement>('.unified-menu');
  if(e.key==='Escape'&&topMenus().some(menu=>menu.open)){e.preventDefault();e.stopPropagation();close(true);return;}
  if(!target||!detail||!options.menus.contains(target))return;
  if(e.key==='Tab'){close();return;}
  if(target.getAttribute('aria-disabled')==='true'&&['Enter',' ','ArrowRight'].includes(e.key)){e.preventDefault();return;}
  const topSummary=detail.querySelector<HTMLElement>(':scope > summary'),popup=detail.querySelector<HTMLElement>(':scope > .unified-menu-popup');if(!topSummary||!popup)return;
  if(target===topSummary){
   if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const list=topMenus(),index=menuNavigationIndex(list.map(()=>true),list.indexOf(detail),e.key),next=list[index];if(next){for(const item of list)(item.firstElementChild as HTMLElement).tabIndex=item===next?0:-1;(next.firstElementChild as HTMLElement).focus();if(detail.open)open(next,'Home');}return;}
   if(['ArrowDown','ArrowUp','Enter',' '].includes(e.key)){e.preventDefault();open(detail,e.key==='ArrowUp'?'End':'Home');}return;
  }
  if(target.tagName==='SUMMARY'&&e.key==='ArrowRight'){e.preventDefault();if(target.getAttribute('aria-disabled')!=='true'){const group=target.parentElement as HTMLDetailsElement;group.open=true;visibleItems(group).find(item=>item!==target)?.focus();}return;}
  if(e.key==='ArrowLeft'){
   const group=target.closest<HTMLDetailsElement>('details');if(group&&group!==detail){e.preventDefault();group.open=false;(group.firstElementChild as HTMLElement).focus();return;}
   e.preventDefault();topSummary.focus();return;
  }
  if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();refresh();const list=visibleItems(popup),index=menuNavigationIndex(list.map(()=>true),list.indexOf(target),e.key);list[index]?.focus();}
 };
 document.addEventListener('keydown',keydown,{signal});
 document.addEventListener('pointerdown',e=>{if(!options.menus.contains(e.target as Node))close();},{signal});
 window.addEventListener('resize',()=>{for(const detail of topMenus())if(detail.open)position(detail);},{signal});
 const dispose=()=>{disposed=true;close();abort.abort();if(installations.get(options.menus)===dispose)installations.delete(options.menus);};
 installations.set(options.menus,dispose);
 return {refresh,dispose};
}
