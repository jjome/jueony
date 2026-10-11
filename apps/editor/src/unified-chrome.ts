import type {DocumentInteractionFacade as Editor,EditorMenuItem as MenuItem} from './modules/document/public/index.ts';
/** Host controls forward to the active editor dispatcher, preserving its gates and history. */
export function installUnifiedChrome(options:{menus:HTMLElement;tools:HTMLElement;active:()=>Editor|undefined;execute:(id:string,params?:Record<string,unknown>)=>unknown;error:(error:unknown)=>void}){
 let identity:Editor|undefined;
 const menuLabels:Record<string,string>={file:'파일',edit:'편집',view:'보기',insert:'입력',format:'서식',page:'쪽',table:'표',tool:'도구',review:'검토',security:'보안'};
 const clean=(label:string)=>label.replace(/\([A-Z]\)/g,'').trim();
 const invoke=(id:string,params?:Record<string,unknown>)=>{for(const detail of options.menus.querySelectorAll('details'))detail.open=false;try{void Promise.resolve(options.execute(id,params)).catch(options.error);}catch(e){options.error(e);}};
 const commandButton=(id:string,label:string,params?:Record<string,unknown>)=>{
  const b=document.createElement('button');b.type='button';b.dataset.editorCommand=id;b.textContent=clean(label);b.addEventListener('mousedown',e=>e.preventDefault());b.onclick=()=>invoke(id,params);return b;
 };
 function items(nodes:MenuItem[],parent:HTMLElement){for(const node of nodes){
  if(node.submenu?.length){const group=document.createElement('details'),summary=document.createElement('summary');summary.textContent=clean(node.label);group.append(summary);items(node.submenu,group);parent.append(group);}
  else if(node.commandId)parent.append(commandButton(node.commandId,node.label,node.params));
 }}
 const quick=['edit:undo','edit:redo','ext:jueony-navigation-pane','edit:find','format:char-shape','format:para-shape','table:create','file:page-setup','ext:jueony-shortcut-help'];
 function refresh(force=false){
  const editor=options.active();if(!editor){identity=undefined;options.menus.replaceChildren();options.tools.replaceChildren();return;}
  if(force||editor!==identity){identity=editor;options.menus.replaceChildren();
   for(const menu of editor.menus()){
    const detail=document.createElement('details'),summary=document.createElement('summary'),popup=document.createElement('div');
    summary.textContent=menuLabels[menu.menuId]??clean(menu.label);detail.className='unified-menu';popup.className='unified-menu-popup';
    summary.addEventListener('mousedown',e=>e.preventDefault());
    detail.addEventListener('toggle',()=>{if(detail.open){refresh();if(menu.menuId==='file'&&editor.prepareMenus)void editor.prepareMenus().then(()=>{if(identity!==editor||!detail.open)return;const updated=editor.menus().find(m=>m.menuId==='file');if(updated){popup.replaceChildren();items(updated.items,popup);refresh();}}).catch(options.error);for(const other of options.menus.querySelectorAll<HTMLDetailsElement>(':scope > details'))if(other!==detail)other.open=false;}});
    items(menu.items,popup);if(!popup.children.length)continue;detail.append(summary,popup);options.menus.append(detail);
   }
   const commands=editor.commands();options.tools.replaceChildren(...quick.map(id=>commandButton(id,commands.find(c=>c.id===id)?.label??id)));
  }
  options.tools.hidden=editor.toolbarsVisible?.()===false;
  const commands=new Map(editor.commands().map(c=>[c.id,c]));
  for(const target of [options.menus,options.tools])for(const b of target.querySelectorAll<HTMLButtonElement>('[data-editor-command]')){
   const c=commands.get(b.dataset.editorCommand!);b.disabled=!c?.enabled;b.title=(c?.label??'연결되지 않은 기능')+(c?.shortcutLabel?' ('+c.shortcutLabel+')':'')+(!c?.enabled?' · 현재 문서에서 사용할 수 없음':'');
  }
 }
 document.addEventListener('keydown',e=>{if(e.key==='Escape')for(const detail of options.menus.querySelectorAll('details'))detail.open=false;});
 document.addEventListener('pointerdown',e=>{if(!options.menus.contains(e.target as Node))for(const detail of options.menus.querySelectorAll('details'))detail.open=false;});
 return {refresh};
}
