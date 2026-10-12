export type PageBorderKind='both'|'odd'|'even';
export type PageBorderApplication='all'|'exceptFirst'|'firstOnly';
export interface PageGradient {type:number;angle:number;centerX:number;centerY:number;blur:number;stepCenter:number;colors:string[];positions:number[]}
export interface PageBorderSettings extends Record<string,unknown> {
 kind?:PageBorderKind;applyPage?:PageBorderApplication;fillType:string;gradient?:PageGradient;
}
export const defaultPageGradient=():PageGradient=>({type:1,angle:0,centerX:50,centerY:50,blur:100,stepCenter:50,colors:['#ffffff','#87b7ed'],positions:[]});
const integer=(value:unknown,min:number,max:number,label:string)=>{if(!Number.isInteger(value)||Number(value)<min||Number(value)>max)throw new Error(`${label}: ${min}~${max} 범위의 정수를 입력하세요.`);};
/** Two-color gradients round-trip in both formats; arbitrary stop positions do not. */
export function validatePageBorderSettings(value:PageBorderSettings):PageBorderSettings {
 const result=structuredClone(value);
 if(result.kind!==undefined&&!['both','odd','even'].includes(result.kind))throw new Error('지원하지 않는 쪽 종류입니다.');
 if(result.applyPage!==undefined&&!['all','exceptFirst','firstOnly'].includes(result.applyPage))throw new Error('지원하지 않는 쪽 적용 범위입니다.');
 for(const key of ['spacingLeft','spacingRight','spacingTop','spacingBottom'])integer(result[key],0,Math.round(25*7200/25.4),'테두리 간격');
 for(const key of ['headerInside','footerInside','hideBorder','hideFill','firstPageBorder','firstPageFill'])if(result[key]!==undefined&&typeof result[key]!=='boolean')throw new Error('쪽 테두리 표시 값이 잘못되었습니다.');
 for(const side of ['Left','Right','Top','Bottom']){
  const border=result[`border${side}`] as {type:number;width:number;color:string}|undefined;if(!border)continue;
  integer(border.type,0,16,'테두리 선 종류');integer(border.width,0,15,'테두리 선 굵기');if(!/^#[0-9a-f]{6}$/i.test(border.color))throw new Error('테두리 색상을 확인하세요.');
 }
 if(!['none','solid','gradient','image'].includes(result.fillType))throw new Error('지원하지 않는 쪽 배경 형식입니다.');
 if(result.fillType==='gradient'){
  const gradient=result.gradient;if(!gradient)throw new Error('그러데이션 값이 없습니다.');
  integer(gradient.type,1,4,'그러데이션 유형');integer(gradient.angle,0,360,'그러데이션 각도');
  for(const key of ['centerX','centerY','blur','stepCenter'] as const)integer(gradient[key],0,100,'그러데이션 중심/번짐');
  if(gradient.colors.length!==2||gradient.colors.some(color=>!/^#[0-9a-f]{6}$/i.test(color)))throw new Error('그러데이션은 두 색상만 편집할 수 있습니다.');
  if(gradient.positions.length)throw new Error('개별 색상 위치가 있는 그러데이션 편집은 아직 지원하지 않습니다.');
 }
 return result;
}
export function samePageBorderSettings(a:PageBorderSettings,b:PageBorderSettings):boolean {
 const keys=['basis','spacingLeft','spacingRight','spacingTop','spacingBottom','headerInside','footerInside','fillArea','hideBorder','hideFill','firstPageBorder','firstPageFill','fillType','fillColor','patternColor','patternType'];
 const normalize=(value:PageBorderSettings)=>({kind:value.kind??'both',applyPage:value.applyPage??(value.hideBorder||value.hideFill?'exceptFirst':'all'),...Object.fromEntries(keys.map(key=>[key,value[key]])),
  ...Object.fromEntries(['Left','Right','Top','Bottom'].map(side=>{const border=value[`border${side}`] as any;return [`border${side}`,border?{type:border.type,width:border.width,color:border.color.toLowerCase()}:undefined];})),
  ...(value.fillType==='gradient'?{gradient:Object.fromEntries(['type','angle','centerX','centerY','blur','stepCenter','colors','positions'].map(key=>[key,value.gradient?.[key as keyof PageGradient]]))}:{})});
 return JSON.stringify(normalize(a))===JSON.stringify(normalize(b));
}
export function pageSpacingFromInput(original:number,text:string):number {
 const displayed=Math.round(original/(7200/25.4)*100)/100;
 const mm=Number(text);if(text.trim()===''||!Number.isFinite(mm)||mm<0||mm>25)throw new Error('테두리 간격은 0~25mm로 입력하세요.');
 return mm===displayed?original:Math.round(mm*7200/25.4);
}
