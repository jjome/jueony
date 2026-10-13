import type {AgentSectionOp} from '../public/types.ts';
import {validateLineNumberSettings} from './line-number-settings.ts';

/** Matches the measured section-tab model used by the existing manual editor. */
export function agentTabSpacingRaw(spacingPt:unknown):number {
 if(typeof spacingPt!=='number'||!Number.isFinite(spacingPt)||spacingPt<0.1||spacingPt>9999)throw new Error('기본 탭 간격은 0.1~9999pt입니다.');
 return Math.round(spacingPt*200);
}
export function agentLineNumberSettings(op:Extract<AgentSectionOp,{kind:'set_line_numbers'}>){
 if(!['page','section','continuous'].includes(op.restart)||typeof op.distanceMm!=='number'||!Number.isFinite(op.distanceMm)||op.distanceMm<0||op.distanceMm>50)throw new Error('줄 번호 방식과 본문 간격(0~50mm)을 확인하세요.');
 return validateLineNumberSettings({enabled:op.enabled,restartType:['page','section','continuous'].indexOf(op.restart)+1,countBy:op.countBy,startNumber:op.startNumber,distance:Math.round(op.distanceMm*7200/25.4)});
}
