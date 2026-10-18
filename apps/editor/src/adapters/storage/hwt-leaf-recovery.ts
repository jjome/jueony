import {sha256} from '@noble/hashes/sha2.js';
import {bytesToHex} from '@noble/hashes/utils.js';
import {assertHwtLeafRecovery} from '../../modules/xml-documents/public/hwt-leaf.ts';
import type {HwtLeafCheckpoint,HwtLeafRecoveryPort} from '../../modules/xml-documents/public/hwt-leaf.ts';
import type {XmlRecoveryRecords} from './xml-recovery.ts';
type Stored={version:1;scope:string[];checkpoint:HwtLeafCheckpoint;digest:string};
const failure=()=>Error('HWT 복구본의 범위·무결성·버전을 확인하지 못했습니다. 기존 복구본을 덮어쓰지 않았습니다.');
const conflict=()=>Error('다른 창에서 HWT 복구본이 바뀌었습니다. 현재 작업의 사본을 저장한 뒤 다시 여세요.');
function digest(scope:string[],c:HwtLeafCheckpoint){
 const s=c.state,h=sha256.create();h.update(new TextEncoder().encode(JSON.stringify([1,scope,c.token,c.updatedAt,c.name,s.version,s.revision,s.savedSha256,s.past.length,s.future.length])));
 for(const b of[s.source,s.current,...s.past,...s.future]){h.update(new TextEncoder().encode(`:${b.length}:`));h.update(b);}return bytesToHex(h.digest());
}
function validate(value:unknown,scope:string[]):Stored {
 if(!value||typeof value!=='object')throw failure();const v=value as Stored,c=v.checkpoint;
 if(Object.keys(v).sort().join(',')!=='checkpoint,digest,scope,version'||v.version!==1||JSON.stringify(v.scope)!==JSON.stringify(scope)||!c||Object.keys(c).sort().join(',')!=='name,state,token,updatedAt'||typeof c.name!=='string'||!c.name.toLowerCase().endsWith('.hwt')||c.name.length>255||/[\u0000-\u001f\u007f/\\]/.test(c.name)||typeof c.token!=='string'||!/^[-0-9a-f]{36}$/.test(c.token)||!Number.isSafeInteger(c.updatedAt)||c.updatedAt<0)throw failure();
 assertHwtLeafRecovery(c.state);if(v.digest!==digest(scope,c))throw failure();return structuredClone(v);
}
/** Reuses atomic IDB exchange only; keys/payload are disjoint from ordinary XML. */
export function createHwtLeafRecoveryStore(options:{scope:string;workspaceId:string;records:XmlRecoveryRecords;nextToken?:()=>string;now?:()=>number}):HwtLeafRecoveryPort {
 const scope=['hwt-leaf-v1',options.scope,options.workspaceId];if(scope.some(s=>!s||s.length>200))throw failure();const key=JSON.stringify(scope);
 return{
  async read(){const raw=await options.records.read(key);return raw==null?null:validate(raw,scope).checkpoint;},
  async write(value,expectedToken){assertHwtLeafRecovery(value.state);const raw=await options.records.read(key),old=raw==null?null:validate(raw,scope);if((old?.checkpoint.token??null)!==expectedToken)throw conflict();const checkpoint=structuredClone({...value,token:(options.nextToken??(()=>crypto.randomUUID()))(),updatedAt:(options.now??Date.now)()}),stored:Stored={version:1,scope:[...scope],checkpoint,digest:digest(scope,checkpoint)};validate(stored,scope);await options.records.exchange(key,raw,stored);return structuredClone(checkpoint);},
  async discard(expectedToken){const raw=await options.records.read(key);if(raw==null||validate(raw,scope).checkpoint.token!==expectedToken)throw conflict();await options.records.exchange(key,raw,null);},
 };
}
