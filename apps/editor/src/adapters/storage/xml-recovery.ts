import {sha256} from '@noble/hashes/sha2.js';
import {assertXmlRecoveryState} from '../../modules/xml-documents/public/index.ts';
import type {XmlRecoveryCheckpoint,XmlRecoveryPort} from '../../modules/xml-documents/public/index.ts';

export interface XmlRecoveryRecords {
 read(key:string):Promise<unknown>;
 /** Atomic equality check and replacement; null means absent/delete. */
 exchange(key:string,expected:unknown,value:unknown):Promise<void>;
}
type Stored={version:1;scope:string[];checkpoint:XmlRecoveryCheckpoint;digest:string};
const conflict=()=>Error('다른 창에서 XML 복구본이 변경되었습니다. 현재 작업을 내보낸 뒤 다시 여세요.');
const encode=(value:unknown)=>JSON.stringify(value);
function digest(value:unknown){const json=encode(value);if(typeof json!=='string'||json.length>32_000_000)throw Error('XML 복구본 크기 제한을 초과했습니다.');return Array.from(sha256(new TextEncoder().encode(json)),b=>b.toString(16).padStart(2,'0')).join('');}
const validName=(name:unknown):name is string=>typeof name==='string'&&name.length>0&&name.length<=255&&!/[\u0000-\u001f\u007f/\\]/.test(name);
function validate(value:unknown,scope:string[]):Stored{
 if(!value||typeof value!=='object')throw Error('XML 복구본이 손상되었습니다. 자동으로 덮어쓰지 않았습니다.');
 const r=value as Stored,c=r.checkpoint;
 if(Object.keys(r).sort().join(',')!=='checkpoint,digest,scope,version'||r.version!==1||encode(r.scope)!==encode(scope)||!c||Object.keys(c).sort().join(',')!=='state,token,updatedAt,xmlName,xsdName'||typeof c.token!=='string'||!/^[0-9a-f-]{36}$/.test(c.token)||!Number.isSafeInteger(c.updatedAt)||c.updatedAt<0||!validName(c.xmlName)||!validName(c.xsdName)||!c.state||c.state.version!==1||typeof r.digest!=='string'||r.digest!==digest([1,r.scope,c]))throw Error('XML 복구본의 범위·무결성을 확인하지 못했습니다. 자동으로 덮어쓰지 않았습니다.');
 assertXmlRecoveryState(c.state);return structuredClone(r);
}
/** Content, names, revision and history are bound to the authenticated window/workspace. */
export function createXmlRecoveryStore(options:{scope:string;workspaceId:string;records:XmlRecoveryRecords;now?:()=>number;nextToken?:()=>string}):XmlRecoveryPort{
 const scope=[options.scope,options.workspaceId];if(scope.some(s=>typeof s!=='string'||!s||s.length>200))throw Error('XML 복구 범위가 올바르지 않습니다.');
 const key=encode(scope),nextToken=options.nextToken??(()=>crypto.randomUUID()),now=options.now??Date.now;
 return{
  async read(){const raw=await options.records.read(key);return raw==null?null:validate(raw,scope).checkpoint;},
  async write(value,expectedToken){
   const raw=await options.records.read(key),previous=raw==null?null:validate(raw,scope);
   if((previous?.checkpoint.token??null)!==expectedToken)throw conflict();
   const checkpoint=structuredClone({...value,token:nextToken(),updatedAt:now()}),candidate:Stored={version:1,scope:[...scope],checkpoint,digest:digest([1,scope,checkpoint])};
   validate(candidate,scope);await options.records.exchange(key,raw,candidate);return structuredClone(checkpoint);
  },
  async discard(expectedToken){const raw=await options.records.read(key);if(raw==null||validate(raw,scope).checkpoint.token!==expectedToken)throw conflict();await options.records.exchange(key,raw,null);},
 };
}

/** No localStorage fallback: failed/quota-blocked transactions retain the previous record. */
export function indexedDbXmlRecoveryRecords(factory:IDBFactory):XmlRecoveryRecords{
 let connection:Promise<IDBDatabase>|undefined;
 function open(){return connection??=new Promise<IDBDatabase>((resolve,reject)=>{const r=factory.open('jueony-xml-recovery-v1',1);let abandoned=false;r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('checkpoints'))r.result.createObjectStore('checkpoints');};r.onblocked=()=>{abandoned=true;connection=undefined;reject(Error('다른 창의 XML 복구 저장소 업그레이드를 기다리고 있습니다.'));};r.onerror=()=>{connection=undefined;reject(r.error??Error('XML 복구 저장소를 열지 못했습니다.'));};r.onsuccess=()=>{if(abandoned){r.result.close();return;}r.result.onversionchange=()=>{r.result.close();connection=undefined;};resolve(r.result);};});}
 return{
  async read(key){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction('checkpoints','readonly'),r=tx.objectStore('checkpoints').get(key);let value:unknown;r.onsuccess=()=>{value=r.result??null;};tx.oncomplete=()=>resolve(value);tx.onerror=tx.onabort=()=>reject(tx.error??Error('XML 복구본을 읽지 못했습니다.'));});},
  async exchange(key,expected,value){const db=await open();await new Promise<void>((resolve,reject)=>{const tx=db.transaction('checkpoints','readwrite',{durability:'strict'}),store=tx.objectStore('checkpoints'),r=store.get(key);let failure:unknown;r.onsuccess=()=>{try{if(encode(r.result??null)!==encode(expected??null))throw conflict();if(value===null)store.delete(key);else store.put(value,key);}catch(e){failure=e;tx.abort();}};tx.oncomplete=()=>resolve();tx.onerror=tx.onabort=()=>reject(failure??tx.error??Error('XML 복구본 저장을 확인하지 못했습니다.'));});},
 };
}
