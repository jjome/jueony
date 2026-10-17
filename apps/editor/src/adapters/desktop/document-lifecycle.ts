import type {DocumentInteractionFacade,EditorMenuItem} from '../../modules/document/public/index.ts';

type Options={canClose:()=>boolean;canExit:()=>boolean;close:()=>Promise<void>;exit:()=>Promise<void>};
type ExitDocument={id:string;workspaceId:string;identity:string;instance:string;name:string;revision:string;dirty:boolean};
type ExitProjection={workspace:string;documents:ExitDocument[]};
/** A successful native save must retain the loaded document instance and bind
 * its resulting display name to the actual output handle. Identities are opaque. */
export function assertExitSavedTransition(before:ExitProjection,after:ExitProjection,id:string,savedName:string|undefined):void{
 const previous=before.documents.find(d=>d.id===id),current=after.documents.find(d=>d.id===id);
 if(before.workspace!==after.workspace||!previous||!current||!previous.instance||current.instance!==previous.instance||!savedName||current.name!==savedName||current.dirty||previous.workspaceId!==current.workspaceId||JSON.stringify(before.documents.map(d=>d.id))!==JSON.stringify(after.documents.map(d=>d.id))||JSON.stringify(before.documents.filter(d=>d.id!==id))!==JSON.stringify(after.documents.filter(d=>d.id!==id)))throw Error('저장 중 다른 문서 또는 업무가 바뀌었습니다.');
}
const CLOSE='ext:jueony-close',EXIT='file:exit';
/** File-menu lifecycle actions belong to the host that owns tabs and the window.
 * Editor dispatch success alone cannot mean an asynchronous close succeeded. */
export function createDocumentLifecycle(options:Options){
 const wrappers=new WeakMap<object,DocumentInteractionFacade>();
 async function execute(id:string):Promise<boolean>{
  if(id!==CLOSE&&id!==EXIT)return false;
  if(!(id===CLOSE?options.canClose():options.canExit()))throw Error('문서 작업과 대화상자를 마친 뒤 다시 요청해 주세요.');
  await(id===CLOSE?options.close():options.exit());return true;
 }
 function wrap(editor:DocumentInteractionFacade):DocumentInteractionFacade{
  const old=wrappers.get(editor);if(old)return old;
  const clean=(items:EditorMenuItem[]):EditorMenuItem[]=>items.filter(n=>n.commandId!==CLOSE&&n.commandId!==EXIT).map(n=>n.submenu?{...n,submenu:clean(n.submenu)}:n);
  const wrapper=Object.create(editor)as DocumentInteractionFacade;
  wrapper.menus=()=>editor.menus().map(menu=>menu.menuId==='file'?{...menu,items:[...clean(menu.items),{label:'문서 닫기',commandId:CLOSE,enabled:options.canClose()},{label:'끝',commandId:EXIT,enabled:options.canExit()}]}:menu);
  wrapper.commands=()=>[...editor.commands().filter(c=>c.id!==CLOSE&&c.id!==EXIT),{id:CLOSE,label:'문서 닫기',shortcutLabel:'Ctrl+F4',enabled:options.canClose()},{id:EXIT,label:'끝',shortcutLabel:'Alt+F4',enabled:options.canExit()}];
  wrappers.set(editor,wrapper);return wrapper;
 }
 return{execute,wrap};
}
