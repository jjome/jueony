import type {RecoveryArtifact,DocumentFormat} from '../public/contracts.ts';
export interface RecoveryExportPort { isPasswordProtected():boolean; export(format:DocumentFormat):RecoveryArtifact; }
