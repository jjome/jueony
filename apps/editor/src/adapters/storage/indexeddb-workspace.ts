import { validateAppState } from './legacy-state-validator.ts';
import { initialState, interruptRuns } from './legacy-records.ts';
import type { AppState, SavedDocument } from './legacy-records.ts';
import { createSerializedWriter } from './serialized-writer.ts';
import { sealRecoveryRecord } from './recovery-integrity.ts';

// The legacy physical envelope remains v1. Domain modules never write separate
// stale copies of its slices; all aggregate/document transactions share this queue.
const writer = createSerializedWriter();
export class WorkspaceStore {
  private db!: IDBDatabase;
  async open(documentWindow?: string): Promise<void> {
    if(documentWindow!==undefined&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(documentWindow))throw new Error('문서 창 저장소 식별자가 올바르지 않습니다.');
    this.db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(documentWindow?'jueony-document-window-'+documentWindow:'jueony-workspaces', 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('state');
        request.result.createObjectStore('documents', { keyPath: 'id' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('로컬 업무 저장소를 열지 못했습니다.'));
    });
    this.db.onversionchange = () => this.db.close();
  }
  private request<T>(store: string, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    return writer.run(() => new Promise<T>((resolve, reject) => {
      const transaction = this.db.transaction(store, mode);
      const request = action(transaction.objectStore(store));
      let value: T;
      request.onsuccess = () => { value = request.result; };
      transaction.oncomplete = () => resolve(value);
      transaction.onerror = transaction.onabort = () => reject(new Error('로컬 저장에 실패했습니다. 브라우저 저장 공간을 확인해 주세요.'));
    }));
  }
  async load(): Promise<AppState> {
    const raw = await this.request<unknown>('state', 'readonly', store => store.get('current'));
    const state = validateAppState(raw === undefined ? initialState() : raw);
    interruptRuns(state);
    return state;
  }
  async save(state: AppState): Promise<void> {
    // Capture at call time, as IDB.put did before queueing. Structured clone retains
    // browser handles/bytes and unknown additive fields; JSON serialization cannot.
    const snapshot = structuredClone(state);
    await this.request('state', 'readwrite', store => store.put(snapshot, 'current'));
  }
  async saveDocument(document: SavedDocument): Promise<void> {
    const snapshot = sealRecoveryRecord(document);
    await this.request('documents', 'readwrite', store => store.put(snapshot));
  }
  async documents(workspaceId: string): Promise<SavedDocument[]> {
    const records = await this.request<SavedDocument[]>('documents', 'readonly', store => store.getAll());
    return records.filter(document => document?.workspaceId === workspaceId);
  }
  async removeDocument(id: string): Promise<void> {
    await this.request('documents', 'readwrite', store => store.delete(id));
  }
  /** An Agent clean-close may remove only the exact checkpoint it inspected. */
  async removeDocumentIfUnchanged(id:string,workspaceId:string,expected:SavedDocument|undefined):Promise<void>{
    const captured=structuredClone(expected);
    await this.exitTransaction([{id,workspaceId}],(key,current)=>{
      if(!sameRecoveryValue(current,captured))throw Error('복구본이 바뀌어 문서 탭을 닫지 않았습니다. 최신 문서를 다시 확인하세요.');
      return{id:key.id,workspaceId:key.workspaceId,before:current,after:undefined};
    });
  }
  /** Dirty deletions and clean checkpoints commit together. The token contains
   * exact prior/committed values so an IPC failure can compensate with CAS. */
  async commitExitRecovery(removals:{id:string;workspaceId:string}[],updates:SavedDocument[]):Promise<RecoveryExitChange[]> {
    const next=updates.map(sealRecoveryRecord),keys=[...removals,...next].map(({id,workspaceId})=>({id,workspaceId}));
    return this.exitTransaction(keys,(key,current)=>{
      const after=next.find(record=>record.id===key.id);
      if(current?.fileConnection||after?.fileConnection)throw Error('원본 재연결 정보가 있는 문서는 복구본 보관 또는 파일 저장 후 종료해 주세요.');
      return{id:key.id,workspaceId:key.workspaceId,before:current,after};
    });
  }
  async rollbackExitRecovery(changes:RecoveryExitChange[]):Promise<void>{
    const captured=structuredClone(changes);
    await this.exitTransaction(captured,(key,current)=>{
      const change=captured.find(change=>change.id===key.id)!;
      if(!sameRecoveryValue(current,change.after))throw Error('새 복구본이 있어 이전 내용으로 덮어쓰지 않았습니다.');
      return{id:key.id,workspaceId:key.workspaceId,before:current,after:change.before};
    });
  }
  async verifyExitRecovery(changes:RecoveryExitChange[]):Promise<void>{
    const expected=structuredClone(changes),actual=await this.request<SavedDocument[]>('documents','readonly',store=>store.getAll());
    for(const change of expected)if(!sameRecoveryValue(actual.find(record=>record.id===change.id),change.after))throw Error('종료 복구본의 실제 저장 결과가 일치하지 않습니다.');
  }
  private exitTransaction(keys:{id:string;workspaceId:string}[],plan:(key:{id:string;workspaceId:string},current:SavedDocument|undefined)=>RecoveryExitChange):Promise<RecoveryExitChange[]> {
    if(keys.some(k=>!k.id||!k.workspaceId)||new Set(keys.map(k=>k.id)).size!==keys.length)return Promise.reject(new Error('종료 문서 식별자가 올바르지 않습니다.'));
    if(!keys.length)return Promise.resolve([]);
    return writer.run(()=>new Promise((resolve,reject)=>{
      const tx=this.db.transaction('documents','readwrite'),store=tx.objectStore('documents'),changes:RecoveryExitChange[]=[];let pending=keys.length,failure:unknown;
      tx.oncomplete=()=>resolve(changes);
      tx.onerror=tx.onabort=()=>reject(failure??new Error('종료용 복구본 변경을 완료하지 못했습니다. 모든 문서를 유지합니다.'));
      const abort=(error:unknown)=>{failure=error;try{tx.abort();}catch{reject(error);}};
      try{for(const key of keys){const request=store.get(key.id);request.onsuccess=()=>{try{
        const current=request.result as SavedDocument|undefined;
        if(current&&current.workspaceId!==key.workspaceId)throw Error('다른 업무의 복구본이므로 변경하지 않았습니다.');
        changes.push(plan(key,current));
        if(--pending===0)for(const change of changes)if(change.after)store.put(change.after);else store.delete(change.id);
      }catch(error){abort(error);}};}}catch(error){abort(error);}
    }));
  }
}
export type RecoveryExitChange={id:string;workspaceId:string;before?:SavedDocument;after?:SavedDocument};
/** Exact content and metadata comparison, including all additive plain fields.
 * Unknown host objects fail closed instead of reducing CAS to an ID/hash. */
function sameRecoveryValue(a:unknown,b:unknown,seen=new Map<object,object>()):boolean{
 if(Object.is(a,b))return true;
 if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;
 if(a instanceof Uint8Array||b instanceof Uint8Array)return a instanceof Uint8Array&&b instanceof Uint8Array&&a.length===b.length&&a.every((v,i)=>v===b[i]);
 if(seen.has(a))return seen.get(a)===b;seen.set(a,b);
 if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>sameRecoveryValue(v,b[i],seen));
 if(Object.getPrototypeOf(a)!==Object.prototype||Object.getPrototypeOf(b)!==Object.prototype)return false;
 const left=Object.keys(a).sort(),right=Object.keys(b).sort();return left.length===right.length&&left.every((key,i)=>key===right[i]&&sameRecoveryValue((a as Record<string,unknown>)[key],(b as Record<string,unknown>)[key],seen));
}
