import {exportRecovery} from '../../modules/document-files/public/index.ts';
import type {RecoveryArtifact} from '../../modules/document-files/public/index.ts';
import {verifyPreservedExport} from '../rhwp/preservation.ts';
export {ProtectedRecoveryError} from '../../modules/document-files/public/index.ts';
/** Studio frees native export handles before converting this checked artifact. */
export function recoveryBytes(exporter:{requiresPasswordForSave?:boolean;getWasmModuleExports():any;exportHwpWithReport():RecoveryArtifact;exportHwpxWithReport():RecoveryArtifact},name:string):Uint8Array {
 return exportRecovery({isPasswordProtected:()=>Boolean(exporter.requiresPasswordForSave),export:format=>{
  const artifact=format==='hwpx'?exporter.exportHwpxWithReport():exporter.exportHwpWithReport();
  const {HwpDocument}=exporter.getWasmModuleExports();
  verifyPreservedExport(exporter,artifact.bytes,format,artifact.contentLoss,bytes=>new HwpDocument(bytes));
  return artifact;
 }},name);
}
