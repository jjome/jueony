export interface EmptySectionRemovalPlan {ok:true;supported:true;section:number;token:string;sectionCountBefore:number;pagesBefore:number;cursorSection:number;cursorParagraph:number;cursorOffset:number}
export function validateEmptySectionRemovalPlan(value:unknown):EmptySectionRemovalPlan {
 const p=value as EmptySectionRemovalPlan;
 if(!p||p.ok!==true||p.supported!==true)throw new Error((value as any)?.reason??'이 구역은 삭제할 수 없습니다.');
 for(const key of ['section','sectionCountBefore','pagesBefore','cursorSection','cursorParagraph','cursorOffset'] as const)if(!Number.isSafeInteger(p[key])||p[key]<0)throw new Error('빈 구역 삭제 계획의 위치가 유효하지 않습니다.');
 const following=p.section<p.sectionCountBefore-1;
 if(p.sectionCountBefore<2||p.sectionCountBefore>65535||p.pagesBefore<p.sectionCountBefore||p.section>=p.sectionCountBefore||p.cursorSection!==(following?p.section:p.section-1)||p.cursorParagraph>4999||p.cursorOffset>100000||following&&(p.cursorParagraph!==0||p.cursorOffset!==0)||!/^[0-9a-f]{64}$/u.test(p.token))throw new Error('빈 구역 삭제 계획의 문서/커서 검사를 통과하지 못했습니다.');
 return {...p};
}
export function sameEmptySectionRemovalRange(a:EmptySectionRemovalPlan,b:EmptySectionRemovalPlan):boolean {
 return (['section','sectionCountBefore','pagesBefore','cursorSection','cursorParagraph','cursorOffset'] as const).every(k=>a[k]===b[k]);
}
