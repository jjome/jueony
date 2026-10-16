import type {SaveSnapshot} from '../public/contracts.ts';
import type {SnapshotSinkPort,SnapshotWriteDependencies} from '../ports/snapshot-write.ts';
import {assertSaveRevision} from '../domain/save-revision.ts';
/** Serializes file writes for one editor; all environment effects are injected. */
export function createSnapshotWriter(deps: SnapshotWriteDependencies) {
 let saving=false;
 async function assertFileUnchanged(sink:SnapshotSinkPort) {
  const expected=sink.readRememberedFingerprint();
  if(!expected||!sink.readBytes)return;
  if(await deps.fingerprint(await sink.readBytes())!==expected)throw new Error('다른 프로그램에서 원본 파일을 변경했습니다. 다른 이름으로 저장하거나 원본을 다시 열어 주세요.');
 }
 return {async write(sink:SnapshotSinkPort,snapshot:SaveSnapshot):Promise<void> {
  const {expectedRevision:expected,bytes}=snapshot;
  assertSaveRevision(expected,deps.revision());
  if(saving)throw new Error('이미 저장 중입니다.');
  saving=true;
  let presentation:ReturnType<SnapshotWriteDependencies['beginSaving']>|undefined;
  let writable:Awaited<ReturnType<SnapshotSinkPort['open']>>|undefined;
  let closed=false;
  try {
   presentation=deps.beginSaving();
   const savedHash=sink.readBytes?await deps.fingerprint(bytes):undefined;
   await assertFileUnchanged(sink);
   writable=await sink.open();
   assertSaveRevision(expected,deps.revision());
   await writable.write(bytes);
   assertSaveRevision(expected,deps.revision());
   await assertFileUnchanged(sink);
   await writable.close();closed=true;
   // Acknowledged close is irreversible. Read the committed bytes before
   // advancing the disk baseline or allowing the UI to mark the document saved.
   if(savedHash && sink.readBytes){
    const actualHash=await deps.fingerprint(await sink.readBytes());
    if(actualHash!==savedHash)throw new Error('저장한 파일의 내용이 문서 사본과 일치하지 않습니다. 편집 내용은 열린 문서에 남아 있습니다. 다른 이름으로 저장해 주세요.');
   }
   if(savedHash)sink.rememberFingerprint(savedHash);
   assertSaveRevision(expected,deps.revision());
  }catch(error){if(!closed)await writable?.abort?.().catch(()=>undefined);throw error;}
  finally{try{presentation?.finish();}finally{saving=false;}}
 }};
}
