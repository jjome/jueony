import { validateAppState } from './legacy-state-validator.ts';
import { initialState, interruptRuns } from './legacy-records.ts';
import type { AppState, SavedDocument } from './legacy-records.ts';
import { createSerializedWriter } from './serialized-writer.ts';

// The legacy physical envelope remains v1. Domain modules never write separate
// stale copies of its slices; all aggregate/document transactions share this queue.
const writer = createSerializedWriter();
export class WorkspaceStore {
  private db!: IDBDatabase;
  async open(): Promise<void> {
    this.db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('jueony-workspaces', 1);
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
    const snapshot = structuredClone(document);
    await this.request('documents', 'readwrite', store => store.put(snapshot));
  }
  async documents(workspaceId: string): Promise<SavedDocument[]> {
    const records = await this.request<SavedDocument[]>('documents', 'readonly', store => store.getAll());
    return records.filter(document => document?.workspaceId === workspaceId);
  }
  async removeDocument(id: string): Promise<void> {
    await this.request('documents', 'readwrite', store => store.delete(id));
  }
}
