import {createSnapshotWriter} from '../../modules/document-files/public/index.ts';
import {fingerprint,rememberedFileFingerprint,setRememberedFileFingerprint} from './fingerprints.ts';
import type {Handle} from './fingerprints.ts';
export {rememberFileSnapshot,rememberedFileFingerprint,reconnectFileSnapshot} from './fingerprints.ts';
export {assertSaveRevision} from '../../modules/document-files/public/index.ts';
type EditorWindow = Window & {jueonyEditor:{revision():string}};
const writer=createSnapshotWriter({
 revision:()=>(window as unknown as EditorWindow).jueonyEditor.revision(),
 fingerprint:bytes=>fingerprint(new Uint8Array(bytes).buffer),
 beginSaving(){
  const root=document.getElementById('studio-root')!;const wasInert=root.inert;root.inert=true;
  const overlay=Object.assign(document.createElement('div'),{id:'jueony-busy',textContent:'문서를 저장하고 있습니다…'});
  overlay.setAttribute('role','status');document.body.append(overlay);
  return {finish(){overlay.remove();root.inert=wasInert;}};
 },
});
/** Converts native handles and Blob metadata at the browser boundary only. */
export async function writeSnapshot(handle:Handle,blob:Blob){
 const expectedRevision=(blob as Blob & {jueonyRevision?:unknown}).jueonyRevision;
 const bytes=new Uint8Array(await blob.arrayBuffer());
 return writer.write({
  ...(handle.getFile?{readBytes:async()=>new Uint8Array(await (await handle.getFile!()).arrayBuffer())}:{}),
  readRememberedFingerprint:()=>rememberedFileFingerprint(handle),
  rememberFingerprint:value=>setRememberedFileFingerprint(handle,value),
  async open(){const native=await handle.createWritable();return {
   write:async data=>native.write(new Blob([new Uint8Array(data)],{type:blob.type})),
   close:()=>native.close(),
   ...(native.abort?{abort:()=>native.abort!()}:{}),
  };},
 },{expectedRevision,bytes});
}
