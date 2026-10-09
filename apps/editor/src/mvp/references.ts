import type { Folder, Source } from './model.ts';
export type Reference={id:string;workspaceId:string;rootId:string;path:string;handle:FileSystemHandle};
export async function permission(handle:any,ask=false){const opts={mode:'read'};if(await handle.queryPermission(opts)==='granted')return true;return ask&&(await handle.requestPermission(opts)==='granted');}
export async function readReferences(selected:Reference[],folders:Folder[],workspaceId:string,parse:(bytes:Uint8Array)=>Promise<string>,signal:AbortSignal):Promise<Source[]>{
 const sources:Source[]=[];const seen=new Set<string>();let total=0;
 async function read(handle:any,id:string,path:string){
  signal.throwIfAborted();
  if(handle.kind==='directory'){for await(const [name,child] of handle.entries())await read(child,id+'/'+name,path+'/'+name);return;}
  if(seen.has(id))return;seen.add(id);
  if(!/\.(hwp|hwpx|txt|md)$/i.test(handle.name))throw new Error('미지원 참고 파일: '+path+' (HWP/HWPX/TXT/MD만 지원). 필요한 파일만 선택해 주세요.');
  if(sources.length>=20)throw new Error('참고 파일은 요청당 최대 20개입니다.');
  const file=await handle.getFile();if(file.size>16*1024*1024)throw new Error('16MB를 넘는 참고 파일: '+path);
  const bytes=new Uint8Array(await file.arrayBuffer());signal.throwIfAborted();
  const text=/\.(hwp|hwpx)$/i.test(file.name)?await parse(bytes):new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  total+=text.length;if(total>120000)throw new Error('참고 자료 합계가 120,000자를 넘습니다. 자료를 줄여 주세요.');
  const digest=await crypto.subtle.digest('SHA-256',bytes);const sha256=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
  sources.push({id,name:path,text,characters:text.length,sha256,limitation:/\.(hwp|hwpx)$/i.test(file.name)?'엔진 Unicode 추출문. 그림 속 글자/OCR 제외.':undefined});
 }
 for(const ref of selected){signal.throwIfAborted();if(ref.workspaceId!==workspaceId||!folders.some(f=>f.id===ref.rootId&&f.workspaceId===workspaceId))throw new Error('다른 업무의 참고 자료입니다.');if(!await permission(ref.handle))throw new Error('참고 자료 권한을 먼저 다시 연결해 주세요.');await read(ref.handle,ref.id,ref.path);}
 return sources;
}
