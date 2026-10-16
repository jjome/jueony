import {sha256} from '@noble/hashes/sha2.js';
import {assertRecoveryRecord} from '../../modules/document-files/public/index.ts';
import type {RecoveryRecord,RecoveryIntegrityPort} from '../../modules/document-files/public/index.ts';

function fingerprint(record:RecoveryRecord):string {
 const hash=sha256.create();
 // Fixed tuple + length + raw bytes binds content to its workspace/document and
 // checkpoint identity. View/handle fields can change without re-exporting bytes.
 hash.update(new TextEncoder().encode(JSON.stringify(['jueony-recovery',1,record.id,record.workspaceId,record.name,record.dirty,record.updatedAt,record.bytes.byteLength])));
 hash.update(record.bytes);
 return Array.from(hash.digest(),b=>b.toString(16).padStart(2,'0')).join('');
}
export const recoveryIntegrity:RecoveryIntegrityPort={verify:record=>record.integrity?.value===fingerprint(record)};

/** Capture at call time. Never replace a damaged existing tag with a fresh one. */
export function sealRecoveryRecord<T extends RecoveryRecord>(record:T):T {
 const snapshot=structuredClone(record);
 assertRecoveryRecord(snapshot,snapshot.workspaceId,recoveryIntegrity);
 return {...snapshot,integrity:{version:1,algorithm:'sha256',value:fingerprint(snapshot)}};
}
