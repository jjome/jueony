import type {XmlRecoveryRecords} from './xml-recovery.ts';
// Typed byte contents are compared directly. Never JSON-project stored records.
function same(a:unknown,b:unknown,depth=0,budget={nodes:10_000}):boolean {
 if(--budget.nodes<0||depth>16||typeof a!==typeof b)return false;
 if(a===null||b===null)return a===b;
 if(typeof a==='string'||typeof a==='boolean')return a===b;
 if(typeof a==='number')return Number.isFinite(a)&&Object.is(a,b);
 if(typeof a!=='object'||typeof b!=='object')return false;
 if(a instanceof Uint8Array||b instanceof Uint8Array){
  if(!(a instanceof Uint8Array)||!(b instanceof Uint8Array)||a.byteLength!==b.byteLength||a.byteLength>32*1024*1024||a.byteOffset!==0||b.byteOffset!==0||a.buffer.byteLength!==a.byteLength||b.buffer.byteLength!==b.byteLength)return false;
  for(let i=0;i<a.length;i++)if(a[i]!==b[i])return false;return true;
 }
 const array=Array.isArray(a);if(array!==Array.isArray(b))return false;
 if(!array&&(![Object.prototype,null].includes(Object.getPrototypeOf(a))||![Object.prototype,null].includes(Object.getPrototypeOf(b))))return false;
 const left=Reflect.ownKeys(a),right=Reflect.ownKeys(b);if(left.length!==right.length||left.length>budget.nodes)return false;
 return left.every((key,i)=>{if(typeof key!=='string'||key!==right[i])return false;const x=Object.getOwnPropertyDescriptor(a,key)!,y=Object.getOwnPropertyDescriptor(b,key)!;return'value'in x&&'value'in y&&(array&&key==='length'||x.enumerable&&y.enumerable)&&same(x.value,y.value,depth+1,budget);});
}
/** Independent HWT database: no XML/history migration, fallback, eviction or clear. */
export function indexedDbHwtLeafRecords(factory:IDBFactory):XmlRecoveryRecords {
 let connection:Promise<IDBDatabase>|undefined;
 function open(){return connection??=new Promise<IDBDatabase>((resolve,reject)=>{const r=factory.open('jueony-hwt-leaf-recovery-v1',1);let abandoned=false;r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('checkpoints'))r.result.createObjectStore('checkpoints');};r.onerror=()=>{connection=undefined;reject(r.error??Error('HWT 복구 저장소를 열지 못했습니다.'));};r.onblocked=()=>{abandoned=true;connection=undefined;reject(Error('다른 창의 HWT 복구 저장소 갱신이 끝나지 않았습니다.'));};r.onsuccess=()=>{if(abandoned){r.result.close();return;}r.result.onversionchange=()=>{r.result.close();connection=undefined;};resolve(r.result);};});}
 return{
  async read(key){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction('checkpoints','readonly'),r=tx.objectStore('checkpoints').get(key);let value:unknown;r.onsuccess=()=>{value=r.result??null;};tx.oncomplete=()=>resolve(value);tx.onerror=tx.onabort=()=>reject(tx.error??Error('HWT 복구본을 읽지 못했습니다.'));});},
  async exchange(key,expected,value){const db=await open();await new Promise<void>((resolve,reject)=>{const tx=db.transaction('checkpoints','readwrite',{durability:'strict'}),store=tx.objectStore('checkpoints'),r=store.get(key);let failure:unknown;r.onsuccess=()=>{try{if(!same(r.result??null,expected??null))throw Error('다른 창에서 HWT 복구본이 바뀌었습니다.');if(value===null)store.delete(key);else store.put(value,key);}catch(e){failure=e;tx.abort();}};tx.oncomplete=()=>resolve();tx.onerror=tx.onabort=()=>reject(failure??tx.error??Error('HWT 복구본 저장을 확인하지 못했습니다. 기존 복구본을 유지합니다.'));});},
 };
}
