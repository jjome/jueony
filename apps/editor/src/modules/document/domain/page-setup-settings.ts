import type {DocumentProperties} from '../public/types.ts';

export interface PageSetupSettings extends Record<string,unknown> {width:number;height:number;marginLeft:number;marginRight:number;marginTop:number;marginBottom:number;marginHeader:number;marginFooter:number;marginGutter:number;landscape:boolean;binding:number}
export const pageSetupKeys=['width','height','marginLeft','marginRight','marginTop','marginBottom','marginHeader','marginFooter','marginGutter','landscape','binding'] as const;
export const mm=(value:number)=>Math.round(value*7200/25.4);
const agentPageRanges:Record<string,readonly [number,number]>={widthMm:[20,1000],heightMm:[20,1000],
 marginLeftMm:[0,300],marginRightMm:[0,300],marginTopMm:[0,300],marginBottomMm:[0,300],marginHeaderMm:[0,100],marginFooterMm:[0,100]};

export function pageProperties(current:DocumentProperties|undefined,changes:unknown):DocumentProperties {
 if(!changes||typeof changes!=='object'||Array.isArray(changes))throw new Error('명령 객체가 필요합니다.');
 const entries=Object.entries(changes);
 if(!entries.length)throw new Error('변경할 속성이 없습니다.');
 const next={...current};
 for(const [key,value] of entries){
  if(key==='landscape'){
   if(typeof value!=='boolean')throw new Error('속성 값이 잘못되었습니다: '+key);
   next.landscape=value;
   continue;
  }
  if(!Object.hasOwn(agentPageRanges,key))throw new Error('지원하지 않는 명령 속성입니다.');
  const [min,max]=agentPageRanges[key];
  if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw new Error('속성 값이 잘못되었습니다: '+key);
  next[key.slice(0,-2)]=mm(value);
 }
 // The native page definition stores portrait dimensions and rotates them for landscape.
 const width=next.landscape?next.height:next.width,height=next.landscape?next.width:next.height;
 if(Number(width)-Number(next.marginLeft)-Number(next.marginRight)<mm(10)||Number(height)-Number(next.marginTop)-Number(next.marginBottom)<mm(10)){
  throw new Error('여백이 용지의 본문 영역을 벗어납니다.');
 }
 return next;
}
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
