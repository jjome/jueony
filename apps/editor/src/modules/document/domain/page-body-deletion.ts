export interface PageBodyDeletionPlan {ok:true;supported:true;page:number;section:number;firstParagraph:number;paragraphCount:number;texts:string[];token:string;retainsEmptySection:boolean;pagesBefore:number;willChange:boolean}
export function validatePageBodyDeletionPlan(value:unknown):PageBodyDeletionPlan {
 const p=value as PageBodyDeletionPlan;
 if(!p||p.ok!==true||p.supported!==true)throw new Error((value as any)?.reason??'이 쪽 본문은 지울 수 없습니다.');
 for(const key of ['page','section','firstParagraph','paragraphCount','pagesBefore'] as const)if(!Number.isInteger(p[key])||p[key]<0)throw new Error('쪽 본문 범위가 유효하지 않습니다.');
 if(p.paragraphCount<1||p.paragraphCount>1000||p.page>=p.pagesBefore||!Array.isArray(p.texts)||p.texts.length!==p.paragraphCount||p.texts.some(t=>typeof t!=='string')||p.texts.reduce((n,t)=>n+[...t].length,0)>100000||!/^[0-9a-f]{64}$/u.test(p.token)||typeof p.retainsEmptySection!=='boolean'||typeof p.willChange!=='boolean')throw new Error('쪽 본문 범위와 원문 검사를 통과하지 못했습니다.');
 return p;
}
export function samePageBodyDeletionRange(a:PageBodyDeletionPlan,b:PageBodyDeletionPlan):boolean{return a.page===b.page&&a.section===b.section&&a.firstParagraph===b.firstParagraph&&a.paragraphCount===b.paragraphCount&&a.retainsEmptySection===b.retainsEmptySection&&a.pagesBefore===b.pagesBefore&&JSON.stringify(a.texts)===JSON.stringify(b.texts);}
