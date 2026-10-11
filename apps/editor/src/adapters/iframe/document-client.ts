import type {Snapshot,DocumentEditFacade,DocumentInteractionFacade,DocumentFacades} from '../../modules/document/public/index.ts';
import type {DocumentViewState,ViewRestoreResult} from '../../modules/preferences/public/index.ts';
import type {StoredFileConnection,FileConnectionResult} from '../files/file-connection.ts';
/** Same-origin browser integration only. File handles never enter domain contracts. */
export interface DocumentFrameClient extends DocumentEditFacade,DocumentInteractionFacade {
 bridgeVersion:1;
 ready:Promise<unknown>;
 documentFacades:DocumentFacades;
 snapshot():Snapshot;
 state():{name:string;pageCount:number;dirty:boolean;revision:string};
 busy():boolean;
 revision():string;
 documentIdentity():string;
 fileHandle():FileSystemFileHandle|null;
 open(bytes:Uint8Array,name:string,handle?:FileSystemFileHandle|null,dirty?:boolean):Promise<void>;
 readReference(bytes:Uint8Array):Promise<string>;
 recovery():{name:string;dirty:boolean;bytes:Uint8Array;fileConnection?:StoredFileConnection}|null;
 restoreFileConnection(connection:StoredFileConnection,requestPermission?:boolean):Promise<FileConnectionResult>;
 captureDocumentView():DocumentViewState|undefined;
 suspendDocumentView():void;
 restoreDocumentView(value:unknown):Promise<ViewRestoreResult>;
 save():Promise<string>;
 discard():Promise<void>;
}
const required=['snapshot','state','busy','revision','documentIdentity','fileHandle','open','readReference','recovery','restoreFileConnection','captureDocumentView','suspendDocumentView','restoreDocumentView','save','discard','commands','menus','executeCommand','focusEditor','preflight','apply','undoRequest'];
export function assertDocumentFrameClient(value:unknown):asserts value is DocumentFrameClient {
 const api=value as Record<string,unknown>|null;
 if(!api||api.bridgeVersion!==1||required.some(name=>typeof api[name]!=='function'))throw new Error('편집기 연결 계약이 일치하지 않습니다. 같은 버전의 Jueony 화면과 편집기를 실행해 주세요.');
}
export async function connectDocumentFrame(frame:HTMLIFrameElement,closed:()=>boolean):Promise<DocumentFrameClient>{
 const started=Date.now(),pause=()=>new Promise(resolve=>setTimeout(resolve,100));
 for(;;){
  if(closed()||Date.now()-started>45000)throw new Error('편집기 준비 실패. 문서 탭을 다시 열어 주세요.');
  const host=frame.contentWindow as (Window&{jueonyEditor?:unknown;__jueonyInitializationError?:unknown})|null;
  const pending=host?.jueonyEditor as {snapshot?:unknown;ready?:Promise<unknown>}|undefined;
  if(typeof pending?.snapshot!=='function'){await pause();continue;}
  await pending.ready;
  for(let i=0;i<300;i++){
   if(closed())throw new Error('문서 탭이 닫혔습니다.');
   if(host?.__jueonyInitializationError)throw new Error(String(host.__jueonyInitializationError));
   assertDocumentFrameClient(pending);
   if(!pending.busy()&&pending.state().pageCount>0)return pending;
   await pause();
  }
  throw new Error('문서 초기화가 완료되지 않았습니다.');
 }
}
