import type {NativeInvoke} from './native-host.ts';
import type {DocumentInteractionFacade,EditorMenuItem} from '../../modules/document/public/index.ts';
export type DocumentWindowContext={kind:'main'|'document';windowId:string|null;label:string;scope:string};
export type DocumentWindowReceipt={requestId:string;windowId:string|null;status:'opening'|'ready'|'closed'|'failed';error:string|null};
export type DocumentWindowSummary={windowId:string;phase:DocumentWindowReceipt['status'];recoverable:boolean;createdAt:number};
const id=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);
export const mainDocumentWindow:DocumentWindowContext={kind:'main',windowId:null,label:'main',scope:'main'};
/** URL text never grants an IndexedDB namespace; Rust validates the actual caller. */
export async function readDocumentWindowContext(invoke:NativeInvoke|undefined,search:string):Promise<DocumentWindowContext>{
 const supplied=new URLSearchParams(search).get('documentWindow');
 if(!invoke){if(supplied!==null)throw Error('별도 문서 창은 Windows 실행기에서만 열 수 있습니다.');return mainDocumentWindow;}
 const value=await invoke<DocumentWindowContext>('document_window_context');
 if(value?.kind==='main'&&value.windowId===null&&value.label==='main'&&value.scope==='main'&&supplied===null)return mainDocumentWindow;
 if(value?.kind==='document'&&id(value.windowId)&&value.scope===value.windowId&&value.label==='document-'+value.windowId&&supplied===value.windowId)return value;
 throw Error('문서 창과 저장소 범위가 일치하지 않습니다. 기존 업무를 열거나 덮어쓰지 않았습니다.');
}
export function assertTabCapacity(count:number){if(!Number.isSafeInteger(count)||count<0||count>=30)throw Error('한 창의 문서 탭은 30개까지 열 수 있습니다. 기존 탭을 닫은 뒤 다시 시도하세요.');}
export function createDocumentWindows(options:{invoke?:NativeInvoke;canNavigate:()=>boolean;newTab:()=>Promise<unknown>;changed:()=>void;nextId?:()=>string;wait?:()=>Promise<void>;attempts?:number}){
 const wrappers=new WeakMap<object,DocumentInteractionFacade>();let rows:DocumentWindowSummary[]=[],pending=false;
 const usable=()=>!pending&&options.canNavigate();
 async function refresh(){if(!options.invoke)return;const value=await options.invoke<DocumentWindowSummary[]>('list_document_windows');if(!Array.isArray(value)||value.length>1000||value.some(v=>!id(v.windowId)||!['opening','ready','closed','failed'].includes(v.phase)||typeof v.recoverable!=='boolean'||!Number.isSafeInteger(v.createdAt)))throw Error('문서 창 목록을 확인하지 못했습니다.');rows=value;options.changed();}
 function receipt(value:DocumentWindowReceipt,requestId:string){if(value?.requestId!==requestId||!['opening','ready','closed','failed'].includes(value.status)||value.windowId!==null&&!id(value.windowId))throw Error('문서 창 요청 응답이 일치하지 않습니다.');return value;}
 async function open(restoreId?:string){
  if(!options.invoke)throw Error('새 문서 창은 Windows 실행기에서 지원합니다. 브라우저에서는 새 탭을 사용하세요.');
  if(!usable())throw Error('현재 문서 작업을 마친 뒤 새 창을 여세요.');
  if(restoreId!==undefined&&(!id(restoreId)||!rows.some(row=>row.windowId===restoreId)))throw Error('현재 목록에 없는 문서 창입니다. 파일 메뉴를 다시 여세요.');
  pending=true;options.changed();const requestId=(options.nextId??(()=>crypto.randomUUID()))();
  try{let value=receipt(await options.invoke<DocumentWindowReceipt>('open_document_window',{requestId,restoreId:restoreId??null}),requestId);
   for(let index=0;value.status==='opening'&&index<(options.attempts??120);index++){await(options.wait??(()=>new Promise<void>(resolve=>setTimeout(resolve,250))))();value=receipt(await options.invoke<DocumentWindowReceipt>('document_window_request',{requestId}),requestId);}
   if(value.status!=='ready'||!value.windowId)throw Error(value.error??(value.status==='opening'?'새 창의 준비를 아직 확인하지 못했습니다. 만들어진 창을 확인하세요. 기존 문서는 유지합니다.':'새 문서 창을 열지 못했습니다.'));
   await refresh();return value;
  }finally{pending=false;options.changed();}
 }
 const commands=new Set(['file:new-doc','file:new-tab','file:restore-document-window']);
 async function execute(command:string,params?:Record<string,unknown>){if(!commands.has(command))return false;if(command==='file:new-tab'){if(!usable())throw Error('현재 작업을 마친 뒤 새 탭을 여세요.');await options.newTab();return true;}await open(command==='file:restore-document-window'?String(params?.windowId??''):undefined);return true;}
 function strip(nodes:EditorMenuItem[]):EditorMenuItem[]{return nodes.flatMap(node=>commands.has(node.commandId??'')?[]:[node.submenu?{...node,submenu:strip(node.submenu)}:node]);}
 function wrap(editor:DocumentInteractionFacade){const old=wrappers.get(editor);if(old)return old;const value=Object.create(editor) as DocumentInteractionFacade;
  value.commands=()=>[...editor.commands().filter(c=>!commands.has(c.id)),{id:'file:new-doc',label:'새 문서',enabled:Boolean(options.invoke)&&usable()},{id:'file:new-tab',label:'새 탭',enabled:usable()},{id:'file:restore-document-window',label:'독립 문서 창 다시 열기',enabled:Boolean(options.invoke)&&usable()}];
  value.menus=()=>editor.menus().map(menu=>menu.menuId==='file'?{...menu,items:[{label:'새 문서 (Alt+N)',commandId:'file:new-doc',enabled:Boolean(options.invoke)&&usable()},{label:'새 탭 (Ctrl+Alt+T)',commandId:'file:new-tab',enabled:usable()},...strip(menu.items),{label:'독립 문서 창 · 업무와 복구본',enabled:Boolean(options.invoke),submenu:rows.length?rows.map((row,index)=>({label:`${index+1}. 독립 문서 창 · ${row.phase==='ready'?'열림':row.recoverable?'복구본 보관':'닫힘'} · ${row.windowId.slice(0,8)}`,commandId:'file:restore-document-window',params:{windowId:row.windowId},enabled:usable()})):[{label:'등록된 독립 문서 창 없음',commandId:'file:restore-document-window',enabled:false}]}]}:menu);
  value.prepareMenus=async()=>{await editor.prepareMenus?.();await refresh();};wrappers.set(editor,value);return value;
 }
 return {execute,open,refresh,wrap};
}
