import {exportRecovery} from '../../modules/document-files/public/index.ts';
import type {RecoveryArtifact} from '../../modules/document-files/public/index.ts';
export {ProtectedRecoveryError} from '../../modules/document-files/public/index.ts';
/** Studio frees native export handles before converting this checked artifact. */
export function recoveryBytes(exporter:{requiresPasswordForSave?:boolean;exportHwpWithReport():RecoveryArtifact;exportHwpxWithReport():RecoveryArtifact},name:string):Uint8Array {
 return exportRecovery({isPasswordProtected:()=>Boolean(exporter.requiresPasswordForSave),export:format=>format==='hwpx'?exporter.exportHwpxWithReport():exporter.exportHwpWithReport()},name);
}
