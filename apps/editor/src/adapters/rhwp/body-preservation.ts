import {capturePreservationEvidence} from './preservation.ts';
/** Compare every body text/style/character run before and after an isolated structural operation. */
export function captureBodyPreservation(doc:any){
 const evidence=capturePreservationEvidence(doc);
 if(evidence.issues.length)throw new Error('변경 전후 본문 보존 속성을 모두 확인하지 못했습니다.');
 return Object.fromEntries(Object.entries(evidence.values).filter(([key])=>/^section\/\d+\/paragraph\/\d+$/u.test(key)));
}
