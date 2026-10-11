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
   if(savedHash)sink.rememberFingerprint(savedHash);
   assertSaveRevision(expected,deps.revision());
  }catch(error){if(!closed)await writable?.abort?.().catch(()=>undefined);throw error;}
  finally{try{presentation?.finish();}finally{saving=false;}}
 }};
}
