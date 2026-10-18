import {sha256} from '@noble/hashes/sha2.js';
import {bytesToHex} from '@noble/hashes/utils.js';
import {createSnapshotWriter} from '../../modules/document-files/public/index.ts';
import type {HwtLeafSavePort} from '../../modules/xml-documents/public/hwt-leaf.ts';
import type {RestorableFileHandle} from './file-connection.ts';
/** User-selected copy only. No path, source connection, remembered permission or download success. */
export function createHwtLeafSavePort(options:{pick?:(name:string)=>Promise<RestorableFileHandle>;revision:()=>string;beginSaving:()=>{finish():void}}):HwtLeafSavePort {
 const hash=(b:Uint8Array)=>bytesToHex(sha256(b)),writer=createSnapshotWriter({revision:options.revision,fingerprint:async bytes=>hash(bytes),beginSaving:options.beginSaving});
 return{async saveCopy(input,name){
  if(!options.pick)throw Error('이 환경에는 HWT 사본의 실제 파일 저장·재읽기 경계가 없습니다. 저장 완료로 표시하지 않았습니다.');
  if(!input.length||input.length>32*1024*1024)throw Error('HWT 저장 사본 크기가 올바르지 않습니다.');
  const bytes=input.slice(),expected=options.revision();let handle:RestorableFileHandle;
  try{handle=await options.pick(name);}catch(e){if(e instanceof Error&&e.name==='AbortError')return{status:'cancelled'};throw e;}
  if(!handle||handle.kind!=='file'||typeof handle.name!=='string'||!handle.name.toLowerCase().endsWith('.hwt')||handle.name.length>255||/[\u0000-\u001f\u007f/\\]/.test(handle.name)||typeof handle.getFile!=='function'||typeof handle.createWritable!=='function')throw Error('같은 .hwt 형식의 저장 위치와 파일 재읽기가 필요합니다. 파일을 쓰지 않았습니다.');
  if(expected!==options.revision())throw Error('저장 위치를 선택하는 동안 HWT 작업이 바뀌었습니다. 파일을 쓰지 않았습니다.');
  const readBytes=async()=>{const file=await handle.getFile();if(file.size>32*1024*1024)throw Error('HWT 저장 대상의 재읽기 크기 제한을 초과했습니다.');return new Uint8Array(await file.arrayBuffer());};
  let baseline=hash(await readBytes()),started=false;
  try{await writer.write({readBytes,readRememberedFingerprint:()=>baseline,rememberFingerprint:value=>{baseline=value;},async open(){const writable=await handle.createWritable();return{write:async b=>{started=true;await writable.write(new Blob([new Uint8Array(b)]));},close:()=>writable.close(),...(writable.abort?{abort:()=>writable.abort!()}:{} )};}},{bytes,expectedRevision:expected});return{status:'saved',name:handle.name};}
  catch(e){if(started)return{status:'failed_partial',message:'HWT 파일 쓰기를 시도했지만 최종 디스크 내용을 확인하지 못했습니다. 편집·복구본은 유지합니다. '+(e instanceof Error?e.message:String(e))};throw e;}
 }};
}
