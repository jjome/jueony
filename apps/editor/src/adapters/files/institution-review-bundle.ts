import {strToU8,zipSync} from 'fflate';
import {fingerprint} from './fingerprints.ts';

const maximumBytes=50_000_000;
const windowsDevice=/^(?:CON|PRN|AUX|NUL|COM[1-9¹²³]|LPT[1-9¹²³])(?:\.|$)/iu;

function entryName(value:string){
 const name=value.normalize('NFC');
 if(!name||name.length>180||/^[ .]|[ .]$/u.test(name)||/[<>:"/\\|?*\p{Cc}\p{Cf}]/u.test(name)||windowsDevice.test(name)){
  throw new Error('묶음에 넣을 수 없는 파일 이름이 있습니다.');
 }
 return name;
}

export async function createInstitutionReviewBundle(document:{name:string;bytes:Uint8Array},attachments:readonly File[],notes:string,signal?:AbortSignal){
 signal?.throwIfAborted();
 const name=entryName(document.name),memo=notes.trim();
 if(!/\.hwpx?$/iu.test(name)||!document.bytes.length)throw new Error('묶음에 넣을 HWP 또는 HWPX 문서를 확인해 주세요.');
 if(memo.length>1000||/[\p{Cc}\p{Cf}]/u.test(memo.replace(/[\r\n\t]/gu,'')))throw new Error('검토 메모는 1,000자까지 입력하세요.');
 if(attachments.length>20||attachments.reduce((size,file)=>size+file.size,document.bytes.length)>maximumBytes){
  throw new Error('붙임 20개와 전체 용량 50MB까지 묶을 수 있습니다.');
 }
 const names=attachments.map(file=>entryName(file.name));
 if(new Set(names.map(name=>name.toLowerCase())).size!==names.length)throw new Error('이름이 같은 붙임은 파일명을 구분해 주세요.');
 const files=await Promise.all(attachments.map(async(file,index)=>({path:`붙임/${names[index]}`,bytes:new Uint8Array(await file.arrayBuffer())})));
 signal?.throwIfAborted();
 if(files.reduce((size,file)=>size+file.bytes.length,document.bytes.length)>maximumBytes)throw new Error('묶음의 전체 용량이 50MB를 넘습니다.');
 const contents=[{path:`본문/${name}`,bytes:new Uint8Array(document.bytes)},...files];
 const entries=await Promise.all(contents.map(async({path,bytes})=>({path,bytes:bytes.length,sha256:await fingerprint(bytes.buffer)})));
 signal?.throwIfAborted();
 const manifest={version:1,purpose:'review',status:'draft',notes:memo,document:entries[0],attachments:entries.slice(1)};
 const archive=zipSync(Object.fromEntries([...contents.map(({path,bytes})=>[path,bytes]),['검토 기록.json',strToU8(JSON.stringify(manifest,null,2)+'\n')]]),{level:0});
 return {name:'검토 묶음.zip',archive};
}
