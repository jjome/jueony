export class ProtectedRecoveryError extends Error { readonly code='PASSWORD_RECOVERY_BLOCKED'; constructor(){super('암호 문서는 평문 자동 복구본을 만들지 않습니다. 문서를 닫기 전에 암호를 유지하여 파일에 저장해 주세요.');this.name='ProtectedRecoveryError';} }
type RecoveryArtifact={bytes:Uint8Array;contentLoss:{schemaVersion:number;outputFormat:string;count:number;losses:unknown[]}};
/** The Studio bridge validates and frees the WASM export before this boundary. */
export function recoveryBytes(exporter:{requiresPasswordForSave?:boolean;exportHwpWithReport():RecoveryArtifact;exportHwpxWithReport():RecoveryArtifact},name:string):Uint8Array{
 if(exporter.requiresPasswordForSave)throw new ProtectedRecoveryError();
 const format=name.toLowerCase().endsWith('.hwpx')?'hwpx':'hwp';
 const artifact=format==='hwpx'?exporter.exportHwpxWithReport():exporter.exportHwpWithReport();
 const report=artifact.contentLoss;
 if(!report||report.schemaVersion!==1||report.outputFormat!==format||!Number.isSafeInteger(report.count)||report.count<0||!Array.isArray(report.losses)||report.count!==report.losses.length)
  throw new Error('복구본의 내용 보존 여부를 확인하지 못했습니다. 기존 복구본은 덮어쓰지 않습니다.');
 if(report.count)throw new Error('복구본에서 일부 내용을 보존할 수 없어 자동 복구 저장을 중단했습니다. 기존 복구본은 유지합니다. 문서를 닫기 전에 다른 이름으로 저장하고 결과를 확인해 주세요.');
 if(!(artifact.bytes instanceof Uint8Array)||!artifact.bytes.byteLength)throw new Error('복구 문서가 비어 있어 기존 복구본을 유지합니다.');
 return artifact.bytes;
}
