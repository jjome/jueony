export interface PageSetupSettings extends Record<string,unknown> {width:number;height:number;marginLeft:number;marginRight:number;marginTop:number;marginBottom:number;marginHeader:number;marginFooter:number;marginGutter:number;landscape:boolean;binding:number}
export const pageSetupKeys=['width','height','marginLeft','marginRight','marginTop','marginBottom','marginHeader','marginFooter','marginGutter','landscape','binding'] as const;
export function pageDimensionFromInput(original:number,text:string):number {
 const mm=Number(text);if(text.trim()===''||!Number.isFinite(mm)||mm<0||mm>2000)throw new Error('용지·여백은 0~2000mm 범위로 입력하세요.');
 return mm===Math.round(original*25.4/7200*10)/10?original:Math.round(mm*7200/25.4);
}
export function validatePageSetup(value:PageSetupSettings):PageSetupSettings {
 const next=structuredClone(value);
 for(const key of pageSetupKeys.filter(k=>k!=='landscape'&&k!=='binding'))if(!Number.isSafeInteger(next[key])||Number(next[key])<0||Number(next[key])>Math.round(2000*7200/25.4))throw new Error('용지·여백 값이 잘못되었습니다.');
 if(next.width===0||next.height===0||typeof next.landscape!=='boolean'||![0,1,2].includes(next.binding))throw new Error('용지 크기·방향·제본을 확인하세요.');return next;
}
export function samePageSetup(a:PageSetupSettings,b:PageSetupSettings):boolean {return pageSetupKeys.every(key=>a[key]===b[key]);}
