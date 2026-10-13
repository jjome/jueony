export type MasterPageKind='both'|'odd'|'even';
export interface MasterPageText {text:string;x:number;y:number;fontSize:number;color:string;bold:boolean}
export const defaultMasterPageText=():MasterPageText=>({text:'',x:1417,y:1417,fontSize:1000,color:'#808080',bold:false});
export function validateMasterPageText(value:MasterPageText,paper?:{width:number;height:number;landscape:boolean}):MasterPageText {
 if(!value||typeof value.text!=='string'||[...value.text].length>4000||value.text.split('\n').length>100||/[\u0000-\u0009\u000b-\u001f\u007f]/u.test(value.text))throw new Error('바탕쪽은 4000자·100문단 이하 텍스트를 지원합니다. 탭과 제어문자는 제외합니다.');
 for(const key of ['x','y','fontSize'] as const)if(!Number.isSafeInteger(value[key])||value[key]<0)throw new Error('바탕쪽 위치·글자 크기를 확인하세요.');
 if(value.fontSize<100||value.fontSize>7200||!/^#[0-9a-f]{6}$/i.test(value.color)||typeof value.bold!=='boolean')throw new Error('바탕쪽 글자 크기는 1~72pt이며 색상·진하게 값을 확인하세요.');
 if(paper&&(value.x>=(paper.landscape?paper.height:paper.width)||value.y>=(paper.landscape?paper.width:paper.height)))throw new Error('바탕쪽 시작 위치는 편집 용지 안에 있어야 합니다.');
 return {...value,color:value.color.toLowerCase()};
}
export function sameMasterPageText(a:MasterPageText|undefined,b:MasterPageText|undefined):boolean {return !a||!b?a===b:['text','x','y','fontSize','color','bold'].every(key=>key==='color'?a.color.toLowerCase()===b.color.toLowerCase():a[key as keyof MasterPageText]===b[key as keyof MasterPageText]);}
