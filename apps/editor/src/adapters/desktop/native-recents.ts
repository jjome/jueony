import type {NativeInvoke,NativeHandleInfo} from './native-host.ts';
import type {DocumentInteractionFacade,EditorMenuItem} from '../../modules/document/public/index.ts';

export type NativeRecent={id:string;name:string;openedAt:number};
type Inspection={status:'unchanged'|'changed'|'missing'|'unavailable';name:string;fingerprint:string|null;message:string};
export type NativeRecentOptions={invoke:NativeInvoke;workspace:()=>string;canNavigate:()=>boolean;handle:(info:NativeHandleInfo)=>FileSystemFileHandle;token:(handle:object)=>string|undefined;open:(handle:FileSystemFileHandle)=>Promise<void>;confirm:(message:string)=>boolean|Promise<boolean>;notice:(message:string)=>void;changed:()=>void};
const OPEN='file:open-native-recent',CLEAR='file:clear-native-recent',EMPTY='file:native-recent-empty';

/** Paths stay in the OS-owned registry. A persisted record is not a live handle:
 * every click checks workspace, current disk bytes, and approval again in Rust. */
export function createNativeRecents(options:NativeRecentOptions){
 const cache=new Map<string,NativeRecent[]>(),versions=new Map<string,number>(),wrappers=new WeakMap<object,DocumentInteractionFacade>();
 const recorded=new WeakMap<object,string>(),recording=new WeakMap<object,Promise<void>>();let selecting=false;
 const scope=()=>{const value=options.workspace();if(!/^[a-zA-Z0-9_-]{1,128}$/.test(value))throw new Error('현재 업무를 확인할 수 없습니다.');return value;};
 const current=(workspace:string)=>scope()===workspace;
 async function refresh(workspace=scope()){
  const version=(versions.get(workspace)??0)+1;versions.set(workspace,version);
  const rows=await options.invoke<NativeRecent[]>('list_recent_documents',{workspace});
  if(!Array.isArray(rows)||rows.length>20||rows.some(row=>!row||typeof row.id!=='string'||typeof row.name!=='string'||!Number.isSafeInteger(row.openedAt)))throw new Error('최근 문서 목록 형식이 올바르지 않습니다.');
  if(versions.get(workspace)===version){cache.set(workspace,rows);if(current(workspace))options.changed();}
 }
 async function remember(workspace:string,handle:object|null,revision:string):Promise<void>{
  if(!handle)return;const token=options.token(handle);if(!token)return;
  const stamp=workspace+'|'+token+'|'+revision;if(recorded.get(handle)===stamp)return;
  const pending=recording.get(handle);if(pending){await pending;return remember(workspace,handle,revision);}
  const operation=(async()=>{await options.invoke('remember_recent_document',{workspace,token});recorded.set(handle,stamp);await refresh(workspace);})();
  recording.set(handle,operation);try{await operation;}finally{if(recording.get(handle)===operation)recording.delete(handle);}
 }
 async function execute(id:string,params?:Record<string,unknown>):Promise<boolean>{
  if(id!==OPEN&&id!==CLEAR)return false;
  if(selecting)throw new Error('최근 문서 작업을 마친 뒤 다시 선택하세요.');
  const workspace=scope();if(params?.workspace!==workspace)throw new Error('업무가 바뀌어 최근 문서를 열지 않았습니다. 현재 업무의 목록을 다시 여세요.');
  if(!options.canNavigate())return true;selecting=true;
  try{
   if(id===CLEAR){if(await options.confirm('현재 업무의 최근 문서 목록만 지울까요? 원래 파일은 지우지 않습니다.')&&current(workspace)){await options.invoke('clear_recent_documents',{workspace});await refresh(workspace);}return true;}
   if(typeof params?.id!=='string'||!cache.get(workspace)?.some(row=>row.id===params.id))throw new Error('현재 목록에 없는 문서입니다. 파일 메뉴를 다시 여세요.');
   const inspected=await options.invoke<Inspection>('inspect_recent_document',{workspace,id:params.id});
   if(!current(workspace))return true;
   if(!inspected||!['unchanged','changed','missing','unavailable'].includes(inspected.status))throw new Error('최근 파일의 상태를 확인하지 못했습니다.');
   if(inspected.status==='missing'||inspected.status==='unavailable'){options.notice(inspected.message);return true;}
   if(!/^[a-f0-9]{64}$/i.test(inspected.fingerprint??''))throw new Error('원본 파일 확인 정보가 올바르지 않습니다.');
   if(inspected.status==='changed'&&!await options.confirm(inspected.name+'\n'+inspected.message)){options.notice('최근 문서 열기를 취소했습니다. 열린 문서와 원본 파일은 유지됩니다.');return true;}
   if(!current(workspace)||!options.canNavigate())return true;
   const info=await options.invoke<NativeHandleInfo>('reopen_recent_document',{workspace,id:params.id,fingerprint:inspected.fingerprint});
   if(!current(workspace))return true;
   await options.open(options.handle(info));
   if(current(workspace))await refresh(workspace);
   return true;
  }finally{selecting=false;options.changed();}
 }
 function entries():EditorMenuItem[]{const workspace=scope(),rows=cache.get(workspace)??[];return rows.length?[...rows.map(row=>({label:row.name,commandId:OPEN,params:{id:row.id,workspace},enabled:!selecting})),{label:'현재 업무의 최근 문서 목록 지우기',commandId:CLEAR,params:{workspace},enabled:!selecting}]:[{label:'현재 업무의 최근 문서 없음',commandId:EMPTY,enabled:false}];}
 function strip(nodes:EditorMenuItem[]):EditorMenuItem[]{return nodes.flatMap(node=>{if(node.commandId==='file:open-recent'||node.commandId==='file:clear-recent')return [];if(!node.submenu)return [node];const submenu=strip(node.submenu);return submenu.length?[{...node,submenu}]:[];});}
 function wrap(editor:DocumentInteractionFacade):DocumentInteractionFacade{
  const old=wrappers.get(editor);if(old)return old;
  const wrapped=Object.create(editor) as DocumentInteractionFacade;
  wrapped.menus=()=>editor.menus().map(menu=>menu.menuId==='file'?{...menu,items:[...strip(menu.items),{label:'최근 문서 · 현재 업무',enabled:true,submenu:entries()}]}:menu);
  wrapped.commands=()=>[...editor.commands(),{id:OPEN,label:'최근 문서 열기',enabled:!selecting},{id:CLEAR,label:'최근 문서 목록 지우기',enabled:!selecting},{id:EMPTY,label:'최근 문서 없음',enabled:false}];
  wrapped.prepareMenus=async()=>{await refresh();};
  wrappers.set(editor,wrapped);return wrapped;
 }
 return {refresh,remember,execute,wrap};
}
