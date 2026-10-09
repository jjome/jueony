import { initialState, interruptRuns } from './model.ts';
import type { AppState, SavedDocument } from './model.ts';
export class WorkspaceStore {
 private db!:IDBDatabase;
 async open(){this.db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('jueony-workspaces',1);r.onupgradeneeded=()=>{r.result.createObjectStore('state');r.result.createObjectStore('documents',{keyPath:'id'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(new Error('로컬 업무 저장소를 열지 못했습니다.'));});this.db.onversionchange=()=>this.db.close();}
 private async request<T>(store:string,mode:IDBTransactionMode,action:(s:IDBObjectStore)=>IDBRequest<T>):Promise<T>{return new Promise((resolve,reject)=>{const t=this.db.transaction(store,mode);const r=action(t.objectStore(store));let value:T;r.onsuccess=()=>{value=r.result;};t.oncomplete=()=>resolve(value);t.onerror=t.onabort=()=>reject(new Error('로컬 저장에 실패했습니다. 브라우저 저장 공간을 확인해 주세요.'));});}
 async load():Promise<AppState>{const s=await this.request<AppState|undefined>('state','readonly',s=>s.get('current'))??initialState();if(s.version!==1)throw new Error('지원하지 않는 업무 저장소 버전입니다.');interruptRuns(s);return s;}
 async save(state:AppState){await this.request('state','readwrite',s=>s.put(state,'current'));}
 async saveDocument(doc:SavedDocument){await this.request('documents','readwrite',s=>s.put(doc));}
 async documents(workspaceId:string){return (await this.request<SavedDocument[]>('documents','readonly',s=>s.getAll())).filter(d=>d.workspaceId===workspaceId);}
 async removeDocument(id:string){await this.request('documents','readwrite',s=>s.delete(id));}
}
