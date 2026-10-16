import type {RecoveryRecord} from '../public/contracts.ts';
/** Integrity detects accidental damage; it is not a signature or authentication. */
export interface RecoveryIntegrityPort { verify(record:RecoveryRecord):boolean }
