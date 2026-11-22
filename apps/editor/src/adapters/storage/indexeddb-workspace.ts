import { validateAppState } from './legacy-state-validator.ts';
import { initialState, interruptRuns } from './legacy-records.ts';
import type { AppState, SavedDocument } from './legacy-records.ts';
import { createSerializedWriter } from './serialized-writer.ts';
import { recoveryIntegrity,sealRecoveryRecord } from './recovery-integrity.ts';
import { assertRecoveryRecord } from '../../modules/document-files/public/index.ts';

// The legacy physical envelope remains v1. Domain modules never write separate
// stale copies of its slices; all aggregate/document transactions share this queue.
const writer = createSerializedWriter();
const checkpointTokenPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const recoveryWriteFailure='로컬 저장에 실패했습니다. 기존 복구본을 보존했습니다.';
type CheckpointKey={id:string;workspaceId:string};
type CheckpointTarget=CheckpointKey&{expected:SavedDocument|undefined};
type CheckpointUpdate={document:SavedDocument;expected:SavedDocument|undefined};

function recoveryConflict():Error {
  return Error('다른 창에서 복구본이 바뀌었습니다. 열린 문서와 최신 복구본을 비교해 주세요.');
}

function withNewCheckpoint(document:SavedDocument):SavedDocument {
  return {...sealRecoveryRecord(document),checkpointToken:crypto.randomUUID()};
}

export class WorkspaceStore {
  private db!: IDBDatabase;
  async open(documentWindow?: string): Promise<void> {
    if(documentWindow!==undefined&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(documentWindow))throw new Error('문서 창 저장소 식별자가 올바르지 않습니다.');
    this.db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(documentWindow?'jueony-document-window-'+documentWindow:'jueony-workspaces', 1);
      let blocked=false;
      request.onupgradeneeded = () => {
        request.result.createObjectStore('state');
        request.result.createObjectStore('documents', { keyPath: 'id' });
      };
      request.onsuccess = () => {
        const database=request.result;
        if(blocked){database.close();return;}
        database.onversionchange=()=>database.close();
        resolve(database);
      };
      request.onerror = () => reject(new Error('로컬 업무 저장소를 열지 못했습니다.'));
      request.onblocked = () => {
        blocked=true;
        reject(new Error('다른 창이 로컬 업무 저장소를 사용 중입니다. 창을 닫은 뒤 다시 열어 주세요.'));
      };
    });
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
  /** Give a legacy checkpoint a token in the same transaction that reads it. */
  async openDocumentCheckpoint(key:CheckpointKey):Promise<SavedDocument> {
    const [change]=await this.mutateRecovery([key],(target,current)=>{
      if(!current)throw recoveryConflict();
      assertRecoveryRecord(current,target.workspaceId,recoveryIntegrity);
      if(current.checkpointToken!==undefined&&!checkpointTokenPattern.test(current.checkpointToken))throw recoveryConflict();
      const after=current.checkpointToken===undefined?{...current,checkpointToken:crypto.randomUUID()}:current;
      return {...target,before:current,after};
    });
    return change.after!;
  }
  async saveDocument(document:SavedDocument,expected:SavedDocument|undefined):Promise<SavedDocument> {
    const snapshot=withNewCheckpoint(document);
    const captured=structuredClone(expected);
    const [change]=await this.mutateRecovery([snapshot],(key,current)=>{
      if(!sameCheckpoint(current,captured))throw recoveryConflict();
      return {id:key.id,workspaceId:key.workspaceId,before:current,after:snapshot};
    });
    return change.after!;
  }
  async documents(workspaceId: string): Promise<SavedDocument[]> {
    const records = await this.request<SavedDocument[]>('documents', 'readonly', store => store.getAll());
    return records.filter(document => document?.workspaceId === workspaceId);
  }
  /** Close or intentional discard may remove only the checkpoint that this tab owns. */
  async removeDocumentIfUnchanged(id:string,workspaceId:string,expected:SavedDocument|undefined):Promise<void>{
    const captured=structuredClone(expected);
    await this.mutateRecovery([{id,workspaceId}],(key,current)=>{
      if(!sameCheckpoint(current,captured))throw recoveryConflict();
      return{id:key.id,workspaceId:key.workspaceId,before:current,after:undefined};
    });
  }
  /** Dirty deletions and clean checkpoints commit together. The token contains
   * exact prior/committed values so an IPC failure can compensate with CAS. */
  async commitExitRecovery(removals:CheckpointTarget[],updates:CheckpointUpdate[]):Promise<RecoveryExitChange[]> {
    const changes=[...removals.map(({id,workspaceId,expected})=>({id,workspaceId,expected:structuredClone(expected),after:undefined})),
      ...updates.map(({document,expected})=>({id:document.id,workspaceId:document.workspaceId,expected:structuredClone(expected),after:withNewCheckpoint(document)}))];
    return this.mutateRecovery(changes,(key,current)=>{
      const {expected,after}=changes.find(change=>change.id===key.id)!;
      if(!sameCheckpoint(current,expected))throw recoveryConflict();
      return{id:key.id,workspaceId:key.workspaceId,before:current,after};
    });
  }
  async rollbackExitRecovery(changes:RecoveryExitChange[]):Promise<void>{
    const captured=structuredClone(changes);
    await this.mutateRecovery(captured,(key,current)=>{
      const change=captured.find(change=>change.id===key.id)!;
      if(!sameCheckpoint(current,change.after))throw Error('새 복구본이 있어 이전 내용으로 덮어쓰지 않았습니다.');
      return{id:key.id,workspaceId:key.workspaceId,before:current,after:change.before};
    });
  }
  async verifyExitRecovery(changes:RecoveryExitChange[]):Promise<void>{
    const expected=structuredClone(changes),actual=await this.request<SavedDocument[]>('documents','readonly',store=>store.getAll());
    for(const change of expected)if(!sameCheckpoint(actual.find(record=>record.id===change.id),change.after))throw Error('종료 복구본의 실제 저장 결과가 일치하지 않습니다.');
  }
  private mutateRecovery(keys:CheckpointKey[],plan:(key:CheckpointKey,current:SavedDocument|undefined)=>RecoveryExitChange):Promise<RecoveryExitChange[]> {
    if(keys.some(k=>!k.id||!k.workspaceId)||new Set(keys.map(k=>k.id)).size!==keys.length)return Promise.reject(new Error('복구 문서 식별자가 올바르지 않습니다.'));
    if(!keys.length)return Promise.resolve([]);
    return writer.run(()=>new Promise((resolve,reject)=>{
      const tx=this.db.transaction('documents','readwrite',{durability:'strict'});
      if(tx.durability!=='strict'){tx.abort();throw Error('이 브라우저에서 문서 복구 저장을 확인할 수 없습니다.');}
      const store=tx.objectStore('documents'),changes:RecoveryExitChange[]=[];let pending=keys.length,failure:unknown;
      tx.oncomplete=()=>resolve(changes);
      tx.onabort=()=>reject(failure??new Error(recoveryWriteFailure));
      const abort=(error:unknown)=>{failure=error instanceof DOMException?new Error(recoveryWriteFailure):error;try{tx.abort();}catch{reject(failure);}};
      try{for(const key of keys){const request=store.get(key.id);request.onsuccess=()=>{try{
        const current=request.result as SavedDocument|undefined;
        if(current&&current.workspaceId!==key.workspaceId)throw Error('다른 업무의 복구본이므로 변경하지 않았습니다.');
        changes.push(plan(key,current));
        if(--pending===0)for(const change of changes){
          if(change.after===change.before)continue;
          if(change.after)store.put(change.after);else store.delete(change.id);
        }
      }catch(error){abort(error);}};}}catch(error){abort(error);}
    }));
  }
}
export type RecoveryExitChange={id:string;workspaceId:string;before?:SavedDocument;after?:SavedDocument};
function sameCheckpoint(current:SavedDocument|undefined,expected:SavedDocument|undefined):boolean {
 if(!current||!expected)return current===expected;
 const {fileConnection:currentFile,...currentRecord}=current;
 const {fileConnection:expectedFile,...expectedRecord}=expected;
 // Browsers return a new handle wrapper on each IDB read. The version is changed
 // on every application write and binds the opaque handle to this checkpoint.
 if(!current.checkpointToken||!checkpointTokenPattern.test(current.checkpointToken)||current.checkpointToken!==expected.checkpointToken)return false;
 if(Boolean(currentFile)!==Boolean(expectedFile)||currentFile?.fingerprint!==expectedFile?.fingerprint||currentFile?.handle?.name!==expectedFile?.handle?.name)return false;
 return sameRecoveryValue(currentRecord,expectedRecord);
}

/** Plain checkpoint data must still match if another process wrote without changing the token. */
function sameRecoveryValue(a:unknown,b:unknown,seen=new Map<object,object>()):boolean{
 if(Object.is(a,b))return true;
 if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;
 if(a instanceof Uint8Array||b instanceof Uint8Array)return a instanceof Uint8Array&&b instanceof Uint8Array&&a.length===b.length&&a.every((v,i)=>v===b[i]);
 if(seen.has(a))return seen.get(a)===b;seen.set(a,b);
 if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>sameRecoveryValue(v,b[i],seen));
 if(Object.getPrototypeOf(a)!==Object.prototype||Object.getPrototypeOf(b)!==Object.prototype)return false;
 const left=Object.keys(a).sort(),right=Object.keys(b).sort();return left.length===right.length&&left.every((key,i)=>key===right[i]&&sameRecoveryValue((a as Record<string,unknown>)[key],(b as Record<string,unknown>)[key],seen));
}
