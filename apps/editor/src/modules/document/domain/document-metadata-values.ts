export const DOCUMENT_METADATA_KEYS=['title','subject','author','keywords','description'] as const;
export type DocumentMetadataValues=Record<typeof DOCUMENT_METADATA_KEYS[number],string>;
export function validateDocumentMetadataValues(value:unknown):DocumentMetadataValues{
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==5||!DOCUMENT_METADATA_KEYS.every(k=>Object.hasOwn(value,k)))throw Error('문서 속성의 다섯 항목을 읽지 못했습니다.');
 for(const item of Object.values(value))if(typeof item!=='string'||item.length>4096||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(item)||/[\ud800-\udfff]/u.test(item))throw Error('문서 속성은 항목별 4,096자 이내의 유효한 Unicode 문자로 입력하세요.');
 return{...value} as DocumentMetadataValues;
}
