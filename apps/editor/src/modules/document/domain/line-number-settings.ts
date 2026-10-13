export interface LineNumberSettings {enabled:boolean;restartType:number;countBy:number;distance:number;startNumber:number}
export const defaultLineNumberSettings=():LineNumberSettings=>({enabled:false,restartType:1,countBy:1,distance:1417,startNumber:1});
export function validateLineNumberSettings(value:LineNumberSettings):LineNumberSettings {
 if(!value||typeof value.enabled!=='boolean'||![1,2,3].includes(value.restartType))throw new Error('줄 번호 표시와 번호 매기기 방식을 확인하세요.');
 for(const key of ['countBy','startNumber'] as const)if(!Number.isInteger(value[key])||value[key]<1||value[key]>65535)throw new Error('줄 번호 시작·간격은 1~65535의 정수입니다.');
 if(!Number.isInteger(value.distance)||value.distance<0||value.distance>14173)throw new Error('본문과의 간격은 0~50mm입니다.');
 return {enabled:value.enabled,restartType:value.restartType,countBy:value.countBy,distance:value.distance,startNumber:value.startNumber};
}
export const sameLineNumberSettings=(a:LineNumberSettings,b:LineNumberSettings)=>['enabled','restartType','countBy','distance','startNumber'].every(k=>a[k as keyof LineNumberSettings]===b[k as keyof LineNumberSettings]);
