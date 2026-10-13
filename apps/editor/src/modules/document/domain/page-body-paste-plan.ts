import {validatePageSetup} from './page-setup-settings.ts';
import type {PageSetupSettings} from './page-setup-settings.ts';
import type {PageBodyDeletionPlan} from './page-body-deletion.ts';
export interface PageBodyPastePlan {ok:true;page:number;token:string;targetSection:number;insertionParagraph:number;paperChanged:boolean;styleChanged:boolean;newSection:boolean;sourceFillTypes:string[];sectionsAdded:number;sectionIdx:number;paraIdx:number;pageCountBefore:number;sectionCountBefore:number;sourcePaper:PageSetupSettings;targetPaper:PageSetupSettings}
export function validatePageBodyPastePlan(value:unknown,target:PageBodyDeletionPlan):PageBodyPastePlan {
 const p=value as PageBodyPastePlan;
 if(!p||p.ok!==true||typeof p.paperChanged!=='boolean'||typeof p.styleChanged!=='boolean'||typeof p.newSection!=='boolean'||p.newSection!==(p.paperChanged||p.styleChanged)||p.token!==target.token||p.page!==target.page||p.targetSection!==target.section||p.insertionParagraph!==target.firstParagraph+target.paragraphCount||p.pageCountBefore!==target.pagesBefore)throw new Error('쪽 붙이기 대상과 계획이 다릅니다.');
 for(const k of ['sectionIdx','paraIdx','sectionsAdded','sectionCountBefore'] as const)if(!Number.isSafeInteger(p[k])||p[k]<0)throw new Error('쪽 붙이기 구역 계획이 유효하지 않습니다.');
 if(p.sectionCountBefore<=target.section||p.sectionCountBefore+p.sectionsAdded>65535||p.sectionIdx!==target.section+(p.newSection?1:0)||p.paraIdx!==(p.newSection?0:p.insertionParagraph)||!(p.newSection?[1,2]:[0]).includes(p.sectionsAdded)||!Array.isArray(p.sourceFillTypes)||p.sourceFillTypes.length!==3||p.sourceFillTypes.some(t=>!['none','solid','gradient'].includes(t)))throw new Error('쪽 붙이기 구역/문단 연결을 확인하지 못했습니다.');
 return {...p,sourceFillTypes:[...p.sourceFillTypes],sourcePaper:validatePageSetup(p.sourcePaper),targetPaper:validatePageSetup(p.targetPaper)};
}
