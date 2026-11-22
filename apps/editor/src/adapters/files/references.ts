import type {Folder} from '../storage/legacy-records.ts';
import type {Source,SourceLocation} from '../../modules/references/public/index.ts';
import type { TemporaryReference } from './temporary-references.ts';
import {extractPdfReference,extractWordReference} from './office-reference.ts';
import {extractSpreadsheetReference} from './spreadsheet-reference.ts';
import {fingerprint} from './fingerprints.ts';
export type Reference = { id:string; workspaceId:string; rootId:string; path:string; handle:FileSystemHandle };
export type ExtractedReference = { text:string; locations?:SourceLocation[]; limitation?:string };
export type LiveReference = ExtractedReference & { revision:string };
export type ReferenceExtractionCache = ReadonlyMap<string,ExtractedReference>;
type DirectoryHandleWithEntries=FileSystemDirectoryHandle&{entries():AsyncIterableIterator<[string,FileSystemHandle]>};
export const isSupportedReferenceName=(name:string)=>/\.(hwp|hwpx|txt|md|pdf|docx|xlsx)$/iu.test(name);
export async function permission(handle:any,ask=false) {
 const opts={mode:'read'};
 if(await handle.queryPermission(opts)==='granted')return true;
 return ask&&(await handle.requestPermission(opts)==='granted');
}

type ReferenceOrigin = {handle:FileSystemFileHandle} | {file:File};
export async function resolveReferenceOrigin(
 id:string,folders:Folder[],scope:{workspaceId:string;chatId:string},attachments:TemporaryReference[],
):Promise<ReferenceOrigin> {
 const unavailable=()=>new Error('이 업무에서 원본 자료를 열 수 없습니다. 폴더 연결 또는 첨부를 확인해 주세요.');
 if(id.startsWith('attachment:')){
  const attachment=attachments.find(item=>item.id===id&&item.workspaceId===scope.workspaceId&&item.chatId===scope.chatId);
  if(!attachment)throw unavailable();
  return {file:attachment.file};
 }
 const [rootId,rootName,...path]=id.split('/');
 const root=folders.find(folder=>folder.id===rootId&&folder.workspaceId===scope.workspaceId&&folder.name===rootName);
 if(!root||!path.length||path.length>21||path.some(part=>!part||part==='.'||part==='..'||part.includes('\\'))||!await permission(root.handle))throw unavailable();
 let directory=root.handle;
 try {
  for(const part of path.slice(0,-1))directory=await directory.getDirectoryHandle(part);
  const handle=await directory.getFileHandle(path.at(-1)!);
  if(!await permission(handle))throw unavailable();
  return {handle};
 }catch{throw unavailable();}
}

export async function readCitedReference(origin:ReferenceOrigin,expectedSha256:string,kind:'hwp'|'xlsx'|'pdf'|'docx'='hwp'):Promise<{bytes:Uint8Array;name:string}>{
 const file='file' in origin ? origin.file : await origin.handle.getFile();
 const extension=file.name.split('.').at(-1)?.toLowerCase();
 const matches=extension===kind||kind==='hwp'&&extension==='hwpx';
 if(!matches||!file.name.includes('.')||file.size>16*1024*1024)throw new Error('인용 위치로 여는 참고 자료의 형식이나 16MB 한도를 확인해 주세요.');
 const buffer=await file.arrayBuffer();
 if(await fingerprint(buffer)!==expectedSha256)throw new Error('인용한 뒤 원본 자료가 바뀌었습니다. 최신 자료로 다시 요청해 주세요.');
 return {bytes:new Uint8Array(buffer),name:file.name};
}
export async function readReferences(
 selected:Reference[],folders:Folder[],workspaceId:string,
 parse:(bytes:Uint8Array)=>Promise<string|ExtractedReference>,signal:AbortSignal,
 live?: (handle:FileSystemFileHandle)=>Promise<LiveReference|undefined>,
 attachments?:{chatId:string;items:TemporaryReference[]},
 usePdfOcr=false,
 extractionCache?:{previous:ReferenceExtractionCache;next:Map<string,ExtractedReference>},
 skipUnavailable=false,
):Promise<Source[]> {
 const sources:Source[]=[];const seen=new Set<string>();let total=0,entries=0;
 function maySkip(error:unknown){
  signal.throwIfAborted();
  return skipUnavailable&&error instanceof DOMException&&
   ['NotFoundError','NotAllowedError','NotReadableError','NoModificationAllowedError','SecurityError','UnknownError'].includes(error.name);
 }
 async function readAccessible<T>(operation:()=>Promise<T>):Promise<T|undefined>{
  try{return await operation();}
  catch(error){if(!maySkip(error))throw error;}
 }
 async function* directoryEntries(directory:DirectoryHandleWithEntries){
  try{yield* directory.entries();}
  catch(error){if(!maySkip(error))throw error;}
 }
 async function extract(name:string,bytes:Uint8Array):Promise<ExtractedReference>{
  if(/\.pdf$/iu.test(name))return extractPdfReference(bytes,signal,usePdfOcr);
  if(/\.docx$/iu.test(name))return extractWordReference(bytes,signal);
  if(/\.xlsx$/iu.test(name))return extractSpreadsheetReference(bytes,signal);
  if(/\.(hwp|hwpx)$/iu.test(name)){
   const result=await parse(bytes);
   return typeof result==='string' ? {text:result,limitation:'엔진 Unicode 추출문. 그림 속 글자/OCR 제외. SHA-256은 원본 파일 기준.'} : result;
  }
  return {text:new TextDecoder('utf-8',{fatal:true}).decode(bytes),limitation:undefined};
 }
 function append(id:string,path:string,sha256:string,extracted:ExtractedReference,revision?:string){
  signal.throwIfAborted();total+=extracted.text.length;
  if(total>120000)throw new Error('참고 자료 합계가 120,000자를 넘습니다. 자료를 줄여 주세요.');
  sources.push({id,name:path,...extracted,characters:extracted.text.length,sha256,...(revision ? {sourceVersion:{kind:'open-document',revision} as const} : {})});
 }
 async function readStoredFile(file:File){
  const buffer=await readAccessible(()=>file.arrayBuffer());signal.throwIfAborted();
  if(!buffer)return;
  const sha256=await fingerprint(buffer);signal.throwIfAborted();
  const key=`${file.name.split('.').at(-1)!.toLowerCase()}:${sha256}:${usePdfOcr}`;
  const data=extractionCache?.next.get(key)??extractionCache?.previous.get(key)??await extract(file.name,new Uint8Array(buffer));
  signal.throwIfAborted();
  extractionCache?.next.set(key,data);
  return {sha256,data};
 }
 async function read(handle:FileSystemHandle,rootId:string,path:string,depth:number) {
  signal.throwIfAborted();
  if(depth>20||++entries>1000)throw new Error('참고 폴더 탐색은 깊이 20단계·1,000개 항목까지입니다. 필요한 하위 폴더나 파일을 선택해 주세요.');
  if(handle.kind==='directory') {
   for await(const [name,child] of directoryEntries(handle as DirectoryHandleWithEntries))await read(child,rootId,path+'/'+name,depth+1);
   return;
  }
  const id=rootId+'/'+path;
  if(seen.has(id))return;seen.add(id);
  if(!isSupportedReferenceName(handle.name))throw new Error('미지원 참고 파일: '+path+' (HWP/HWPX/TXT/MD/PDF/DOCX/XLSX 지원). 필요한 파일만 선택해 주세요.');
  if(sources.length>=20)throw new Error('참고 파일은 요청당 최대 20개입니다.');
  const fileHandle=handle as FileSystemFileHandle;
  const current=await live?.(fileHandle);
  if(current) {
   const {text,locations,revision,limitation}=current;
   const sha256=await fingerprint(new TextEncoder().encode(text).buffer);
   append(id,path,sha256,{text,locations,
    limitation:['열린 문서의 미저장 내용을 포함한 최신 텍스트, 버전 '+revision+'. SHA-256은 전달한 UTF-8 텍스트 기준.',limitation].filter(Boolean).join(' ')},revision);
  } else {
   const file=await readAccessible(()=>fileHandle.getFile());
   if(!file)return;
   if(file.size>16*1024*1024)throw new Error('16MB를 넘는 참고 파일: '+path);
   const stored=await readStoredFile(file);
   if(stored)append(id,path,stored.sha256,stored.data);
  }
 }
 for(const ref of selected) {
  signal.throwIfAborted();
  const root=folders.find(folder=>folder.id===ref.rootId&&folder.workspaceId===workspaceId);
  if(ref.workspaceId!==workspaceId||!root)throw new Error('다른 업무의 참고 자료입니다.');
  const granted=await readAccessible(async()=>await permission(root.handle)&&(ref.handle===root.handle||await permission(ref.handle)));
  if(!granted){
   if(skipUnavailable)continue;
   throw new Error('참고 자료 권한을 먼저 다시 연결해 주세요.');
  }
  await read(ref.handle,ref.rootId,ref.path,0);
 }
 for(const item of attachments?.items??[]){
  signal.throwIfAborted();
  if(item.workspaceId!==workspaceId||item.chatId!==attachments!.chatId)throw new Error('다른 업무 또는 채팅의 임시 첨부입니다.');
  if(seen.has(item.id))continue;seen.add(item.id);
  if(sources.length>=20)throw new Error('연결 자료와 임시 첨부를 합해 요청당 최대 20개입니다.');
  const file=item.file;
  if(!isSupportedReferenceName(file.name)||file.size>16*1024*1024)throw new Error('지원하지 않는 첨부 형식 또는 크기입니다: '+file.name);
  const stored=await readStoredFile(file);
  if(stored)append(item.id,file.name,stored.sha256,{...stored.data,limitation:'임시 첨부 시점의 파일. '+(stored.data.limitation??'UTF-8 텍스트 전체.')+' SHA-256은 첨부 파일 기준. 앱 새로고침 시 첨부 해제.'});
 }
 return sources;
}
