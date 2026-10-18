import type {HistoryRecords} from '../../modules/document-files/public/index.ts';

/** Scoped records only. Never opens, migrates, evicts or clears the legacy global database. */
export function indexedDbDocumentHistory(factory: IDBFactory): HistoryRecords {
  let connection: Promise<IDBDatabase> | undefined;
  function open() {return connection ??= new Promise<IDBDatabase>((resolve,reject) => {
    const r = factory.open('jueony-document-history-v1', 1); let abandoned = false;
    r.onupgradeneeded = () => {if (!r.result.objectStoreNames.contains('catalogs')) r.result.createObjectStore('catalogs');};
    r.onerror = () => {connection = undefined; reject(r.error ?? Error('문서 이력 저장소를 열지 못했습니다.'));};
    r.onblocked = () => {abandoned = true; connection = undefined; reject(Error('문서 이력 저장소가 다른 창에서 사용 중입니다.'));};
    r.onsuccess = () => {if (abandoned) {r.result.close(); return;} r.result.onversionchange = () => {r.result.close(); connection = undefined;}; resolve(r.result);};
  });}
  return {
    async read(key) {const db = await open(); return new Promise((resolve,reject) => {
      const tx = db.transaction('catalogs','readonly'), r = tx.objectStore('catalogs').get(key); let value: unknown;
      r.onsuccess = () => {value = r.result ?? null;}; tx.oncomplete = () => resolve(value);
      tx.onerror = tx.onabort = () => reject(tx.error ?? Error('문서 이력을 읽지 못했습니다.'));
    });},
    async exchange(key, expected, value, assertOwner) {const db = await open(); await new Promise<void>((resolve,reject) => {
      const tx = db.transaction('catalogs','readwrite',{durability:'strict'}), store = tx.objectStore('catalogs'), r = store.get(key); let failure: unknown;
      r.onsuccess = () => {try {assertOwner(); if (JSON.stringify(r.result ?? null) !== JSON.stringify(expected ?? null)) throw Error('다른 창에서 문서 이력이 바뀌었습니다. 목록을 다시 여세요.');
        const write=value === null ? store.delete(key) : store.put(value,key);
        // A request success event is still before transaction commit. Catch
        // owner changes during serialization/other success listeners as well.
        write.onsuccess=()=>{queueMicrotask(()=>{try{assertOwner();tx.commit();}catch(e){failure=e;try{tx.abort();}catch{/* already aborted */}}});};
      } catch (e) {failure = e; tx.abort();}};
      tx.oncomplete = () => resolve(); tx.onerror = tx.onabort = () => reject(failure ?? tx.error ?? Error('문서 이력의 지속 저장을 확인하지 못했습니다. 기존 이력은 유지됩니다.'));
    });},
  };
}
