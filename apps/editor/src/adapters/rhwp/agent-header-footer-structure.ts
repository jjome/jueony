import type {Structure} from '../../modules/document/public/index.ts';
import {capturePreservationEvidence} from './preservation.ts';
export type StoredHeaderTarget={section:number;story:'header'|'footer';pageKind:'both'|'odd'|'even'};
/** Every body run is compared, not just the first character of each paragraph. */
export function captureHeaderFooterBody(doc:any){
 const evidence=capturePreservationEvidence(doc);
 if(evidence.issues.length)throw new Error('머리말/꼬리말 변경 전후 본문 보존 속성을 모두 확인하지 못했습니다.');
 return Object.fromEntries(Object.entries(evidence.values).filter(([key])=>/^section\/\d+\/paragraph\/\d+$/u.test(key)));
}
/** Eligibility and body page indices are recalculated after a structural definition change. */
export function stableHeaderFooterStructure(value:Structure,target:StoredHeaderTarget){
 return {...value,sections:value.sections.map(s=>{const {emptySectionRemoval,...rest}=s;return {...rest,...(s.lineNumbers?{lineNumbers:{...s.lineNumbers,editable:undefined}}:{}),headerFooters:s.headerFooters?.map(h=>{if(s.index!==target.section||h.story!==target.story||h.pageKind!==target.pageKind)return h;const {reason,...definition}=h;return definition;})};}),paragraphs:value.paragraphs.map(p=>{const {pageIndex,...rest}=p;return rest;})};
}
