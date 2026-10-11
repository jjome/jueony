import type {RecoveryExportPort} from '../ports/recovery-export.ts';
import {ProtectedRecoveryError,validateRecoveryArtifact} from '../domain/recovery-export.ts';
export function exportRecovery(exporter:RecoveryExportPort,name:string):Uint8Array {
 if(exporter.isPasswordProtected())throw new ProtectedRecoveryError();
 const format=name.toLowerCase().endsWith('.hwpx')?'hwpx':'hwp';
 return validateRecoveryArtifact(exporter.export(format),format);
}
