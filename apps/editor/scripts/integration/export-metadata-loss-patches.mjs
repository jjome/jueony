/** Additive enum extension: unknown DTO subjects/reasons still fail closed. */
export function patchExportMetadataLoss(source){
 let s=source.replaceAll('\r\n','\n');
 const replace=(a,b,label)=>{if(s.split(a).length!==2)throw new Error('소스 패치 기준 불일치: '+label);s=s.replace(a,b);};
 replace("export type ContentLossSubject = 'binaryData' | 'control' | 'fieldParameters';","export type ContentLossSubject = 'binaryData' | 'control' | 'fieldParameters' | 'paragraphProperties' | 'fontProperties';",'paragraph/font metadata loss type');
 replace("  | 'unsupportedByOutputFormat';","  | 'unsupportedByOutputFormat'\n  | 'serializerNotImplemented';",'serializer implementation loss type');
 replace("  return value === 'binaryData' || value === 'control' || value === 'fieldParameters';","  return value === 'binaryData' || value === 'control' || value === 'fieldParameters' || value === 'paragraphProperties' || value === 'fontProperties';",'paragraph/font metadata subject validator');
 replace("    || value === 'unsupportedByOutputFormat';","    || value === 'unsupportedByOutputFormat'\n    || value === 'serializerNotImplemented';",'serializer implementation reason validator');
 replace("    case 'fieldParameters': return '필드 속성';","    case 'fieldParameters': return '필드 속성';\n    case 'paragraphProperties': return '문단 속성';\n    case 'fontProperties': return '글꼴 속성';",'paragraph/font metadata label');
 return s;
}
