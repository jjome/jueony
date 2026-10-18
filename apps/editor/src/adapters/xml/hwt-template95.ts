import {sha256} from '@noble/hashes/sha2.js';
import {bytesToHex} from '@noble/hashes/utils.js';
import {readHwtMapping95} from '../../modules/xml-documents/public/hwt-template95.ts';
import {browserXmlCodec} from './browser-parser.ts';

export interface HwtReadEngine95 {extractHwtXmlTemplate?:(bytes:Uint8Array)=>string|Promise<string>}
interface Stream {path:string;storedBytes:number;storedSha256:string;utf16Bytes:number}
const paths=['/XMLTemplate/Schema','/XMLTemplate/Instance','/XMLTemplate/_SchemaName'];
const hex=(b:Uint8Array)=>bytesToHex(sha256(b));
const digest=(s:unknown):s is string=>typeof s==='string'&&/^[0-9a-f]{64}$/.test(s);
const failure=():never=>{throw Error('HWT 읽기 응답의 원본·크기·읽기 전용 계약이 올바르지 않습니다.');};
function parseDecodedUtf16View(source:string){
 // The native reader already proved the stream's u32 length and UTF16 units.
 // Adapt only its encoding declaration for the existing UTF8-only *parse view*;
 // expose and preserve the original source string, never this view as an export.
 const view=source.replace(/^(\uFEFF?\s*<\?xml\b[^?]*\bencoding\s*=\s*)(["'])UTF-16(?:LE)?\2/i,'$1$2UTF-8$2');
 return browserXmlCodec.parse(view);
}

/** A read-only inspection facade. No normal document/field or save capability. */
export async function inspectHwtTemplate95(input:Uint8Array,engine:HwtReadEngine95){
 if(!(input instanceof Uint8Array)||input.byteLength>32*1024*1024)throw Error('HWT 원본 크기 제한을 초과했습니다.');
 if(typeof engine.extractHwtXmlTemplate!=='function')throw Error('현재 엔진은 HWT XML 서식 구조 읽기를 지원하지 않습니다.');
 const original=input.slice(),sourceSha256=hex(original),raw=await engine.extractHwtXmlTemplate(original.slice());
 if(typeof raw!=='string'||raw.length>6_000_000)failure();
 const value:unknown=JSON.parse(raw);
 if(!value||typeof value!=='object'||Array.isArray(value))failure();
 const v=value as Record<string,unknown>;
 if(v.version!==1||v.readOnly!==true||v.schemaAddressesValidated!==false||v.sourceSha256!==sourceSha256)failure();
 for(const key of ['schema','mapping','schemaName'])if(typeof v[key]!=='string'||(v[key] as string).length>(key==='schemaName'?512:1_000_000))failure();
 const rawStreams=v.streams;if(!Array.isArray(rawStreams)||rawStreams.length!==3)return failure();
 const streams:Stream[]=rawStreams.map((item:unknown,i:number)=>{
  if(!item||typeof item!=='object'||Array.isArray(item))return failure();const s=item as Record<string,unknown>;
  if(s.path!==paths[i]||!digest(s.storedSha256)||!Number.isSafeInteger(s.storedBytes)||!Number.isSafeInteger(s.utf16Bytes)||Number(s.storedBytes)<1||Number(s.storedBytes)>2_000_000||Number(s.utf16Bytes)<0||Number(s.utf16Bytes)>2_000_000||Number(s.utf16Bytes)%2)failure();
  const text=i===0?v.schema:i===1?v.mapping:v.schemaName;if(Number(s.utf16Bytes)!==(text as string).length*2)failure();
  return{path:s.path as string,storedBytes:s.storedBytes as number,storedSha256:s.storedSha256 as string,utf16Bytes:s.utf16Bytes as number};
 });
 const schema=v.schema as string,mapping=v.mapping as string,schemaName=v.schemaName as string;
 if(!schemaName||/[\u0000-\u001f\u007f-\u009f]/.test(schemaName))failure();
 const structure=readHwtMapping95(parseDecodedUtf16View(schema),parseDecodedUtf16View(mapping));
 return{
  sourceSha256,schemaName,schema,mapping,structure,streams,readOnly:true as const,
  // Opaque CFB content is preserved by returning a fresh copy of the exact source,
  // never by regenerating a generic HWP from its partly modeled streams.
  copyOriginal:()=>original.slice(),
 };
}
