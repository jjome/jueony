import type {Structure} from '../../modules/document/public/index.ts';
export {captureBodyPreservation as captureHeaderFooterBody} from './body-preservation.ts';
export type StoredHeaderTarget={section:number;story:'header'|'footer';pageKind:'both'|'odd'|'even'};
/** Eligibility and body page indices are recalculated after a structural definition change. */
export function stableHeaderFooterStructure(value:Structure,target:StoredHeaderTarget){
 return {...value,...(value.bookmarks?{bookmarks:{items:value.bookmarks.items}}:{}),sections:value.sections.map(s=>{const {emptySectionRemoval,...rest}=s;return {...rest,...(s.lineNumbers?{lineNumbers:{...s.lineNumbers,editable:undefined}}:{}),headerFooters:s.headerFooters?.map(h=>{if(s.index!==target.section||h.story!==target.story||h.pageKind!==target.pageKind)return h;const {reason,...definition}=h;return definition;})};}),paragraphs:value.paragraphs.map(p=>{const {pageIndex,...rest}=p;return rest;})};
}
