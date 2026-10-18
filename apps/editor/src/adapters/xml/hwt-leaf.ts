import {sha256} from '@noble/hashes/sha2.js';
import {bytesToHex} from '@noble/hashes/utils.js';
import type {HwtLeafEnginePort,HwtLeafInspection} from '../../modules/xml-documents/public/hwt-leaf.ts';
export interface HwtLeafNative {inspectHwtLeafDocument(bytes:Uint8Array):string|Promise<string>;editHwtLeafDocument(bytes:Uint8Array,request:string):Uint8Array|Promise<Uint8Array>}
const hash=(b:Uint8Array)=>bytesToHex(sha256(b));
function bounded(input:Uint8Array){if(Object.prototype.toString.call(input)!=='[object Uint8Array]'||!input.byteLength||input.byteLength>32*1024*1024)throw Error('HWT 원본은 32MiB 이하여야 합니다.');return new Uint8Array(input);}
/** No live editor document, file handle, OS path or generic XML write authority. */
export function createHwtLeafEngine(native:HwtLeafNative):HwtLeafEnginePort {
 return{
  async inspect(input){const bytes=bounded(input),raw=await native.inspectHwtLeafDocument(bytes.slice());if(typeof raw!=='string'||raw.length>100_000)throw Error('HWT 엔진 검사 응답이 올바르지 않습니다.');const v:unknown=JSON.parse(raw),r=v as HwtLeafInspection;
   if(!r||Object.keys(r).sort().join(',')!=='fields,profile,sourceSha256,version'||r.version!==1||r.profile!=='plain-root-string-clickhere-v1'||r.sourceSha256!==hash(bytes)||!Array.isArray(r.fields)||!r.fields.length||r.fields.length>32)throw Error('HWT 원본·지원 범위 검증에 실패했습니다.');
   const names=new Set<string>(),ids=new Set<number>();for(const f of r.fields){if(!f||Object.keys(f).sort().join(',')!=='fieldId,name,paragraph,value'||typeof f.name!=='string'||!/^[_A-Za-z][_A-Za-z0-9]{0,31}$/.test(f.name)||names.has(f.name)||!Number.isSafeInteger(f.fieldId)||f.fieldId<=0||f.fieldId>0xffffffff||ids.has(f.fieldId)||!Number.isSafeInteger(f.paragraph)||f.paragraph<0||f.paragraph>=64||typeof f.value!=='string'||f.value.length>100_000)throw Error('HWT 필드 소유 응답이 올바르지 않습니다.');names.add(f.name);ids.add(f.fieldId);}
   return structuredClone(r);
  },
  async edit(input,request){const bytes=bounded(input);if(request.sourceSha256!==hash(bytes))throw Error('HWT 원본이 바뀌었습니다.');const out=await native.editHwtLeafDocument(bytes.slice(),JSON.stringify(request));if(Object.prototype.toString.call(out)!=='[object Uint8Array]'||!out.byteLength||out.byteLength>32*1024*1024)throw Error('HWT 편집 출력이 올바르지 않습니다.');return new Uint8Array(out);},
 };
}
