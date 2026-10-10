import type { Folder, Source } from './model.ts';
import type { TemporaryReference } from './temporary-references.ts';
export type Reference = { id:string; workspaceId:string; rootId:string; path:string; handle:FileSystemHandle };
export type LiveReference = { text:string; revision:string };
export async function permission(handle:any,ask=false) {
 const opts={mode:'read'};
 if(await handle.queryPermission(opts)==='granted')return true;
 return ask&&(await handle.requestPermission(opts)==='granted');
}
export async function readReferences(
 selected:Reference[],folders:Folder[],workspaceId:string,
 parse:(bytes:Uint8Array)=>Promise<string>,signal:AbortSignal,
 live?: (handle:FileSystemFileHandle)=>Promise<LiveReference|undefined>,
 attachments?:{chatId:string;items:TemporaryReference[]}
):Promise<Source[]> {
 const sources:Source[]=[];const seen=new Set<string>();let total=0,entries=0;
 async function append(id:string,path:string,bytes:Uint8Array,text:string,limitation?:string){
  signal.throwIfAborted();total+=text.length;
  if(total>120000)throw new Error('참고 자료 합계가 120,000자를 넘습니다. 자료를 줄여 주세요.');
  const digest=await crypto.subtle.digest('SHA-256',bytes as Uint8Array<ArrayBuffer>);
  const sha256=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
  sources.push({id,name:path,text,characters:text.length,sha256,limitation});
 }
 async function read(handle:any,rootId:string,path:string,depth:number) {
  signal.throwIfAborted();
  if(depth>20||++entries>1000)throw new Error('참고 폴더 탐색은 깊이 20단계·1,000개 항목까지입니다. 필요한 하위 폴더나 파일을 선택해 주세요.');
  if(handle.kind==='directory') {
   for await(const [name,child] of handle.entries())await read(child,rootId,path+'/'+name,depth+1);
   return;
  }
  const id=rootId+'/'+path;
  if(seen.has(id))return;seen.add(id);
  if(!/\.(hwp|hwpx|txt|md)$/i.test(handle.name))throw new Error('미지원 참고 파일: '+path+' (HWP/HWPX/TXT/MD만 지원). 필요한 파일만 선택해 주세요.');
  if(sources.length>=20)throw new Error('참고 파일은 요청당 최대 20개입니다.');
  const current=await live?.(handle);let bytes:Uint8Array,text:string,limitation:string|undefined;
  if(current) {
   text=current.text;bytes=new TextEncoder().encode(text);
   limitation='열린 문서의 미저장 내용을 포함한 최신 텍스트, 버전 '+current.revision+'. SHA-256은 전달한 UTF-8 텍스트 기준.';
  } else {
   const file=await handle.getFile();
   if(file.size>16*1024*1024)throw new Error('16MB를 넘는 참고 파일: '+path);
   bytes=new Uint8Array(await file.arrayBuffer());signal.throwIfAborted();
   text=/\.(hwp|hwpx)$/i.test(file.name)?await parse(bytes):new TextDecoder('utf-8',{fatal:true}).decode(bytes);
   if(/\.(hwp|hwpx)$/i.test(file.name))limitation='엔진 Unicode 추출문. 그림 속 글자/OCR 제외. SHA-256은 원본 파일 기준.';
  }
  await append(id,path,bytes,text,limitation);
 }
 for(const ref of selected) {
  signal.throwIfAborted();
  if(ref.workspaceId!==workspaceId||!folders.some(f=>f.id===ref.rootId&&f.workspaceId===workspaceId))throw new Error('다른 업무의 참고 자료입니다.');
  if(!await permission(ref.handle))throw new Error('참고 자료 권한을 먼저 다시 연결해 주세요.');
  await read(ref.handle,ref.rootId,ref.path,0);
 }
 for(const item of attachments?.items??[]){
  signal.throwIfAborted();
  if(item.workspaceId!==workspaceId||item.chatId!==attachments!.chatId)throw new Error('다른 업무 또는 채팅의 임시 첨부입니다.');
  if(seen.has(item.id))continue;seen.add(item.id);
  if(sources.length>=20)throw new Error('연결 자료와 임시 첨부를 합해 요청당 최대 20개입니다.');
  const file=item.file;
  if(!/\.(hwp|hwpx|txt|md)$/i.test(file.name)||file.size>16*1024*1024)throw new Error('지원하지 않는 첨부 형식 또는 크기입니다: '+file.name);
  const bytes=new Uint8Array(await file.arrayBuffer());signal.throwIfAborted();
  const hwp=/\.(hwp|hwpx)$/i.test(file.name);
  const text=hwp?await parse(bytes):new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  await append(item.id,file.name,bytes,text,'임시 첨부 시점의 파일. '+(hwp?'엔진 Unicode 추출문, 그림 속 글자/OCR 제외. ':'UTF-8 텍스트 전체. ')+'SHA-256은 첨부 파일 기준. 앱 새로고침 시 첨부 해제.');
 }
 return sources;
}
