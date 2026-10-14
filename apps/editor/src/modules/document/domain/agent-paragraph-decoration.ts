import type {Snapshot,AgentParagraphDecorationOp} from '../public/types.ts';
export const paragraphBorderWidthsMm=[0.1,0.12,0.15,0.2,0.25,0.3,0.4,0.5,0.6,0.7,1,1.5,2,3,4,5] as const;
const fail=(message:string):never=>{throw new Error(message);};
const color=(v:unknown)=>{if(typeof v!=='string'||!/^#[0-9a-f]{6}$/iu.test(v))return fail('색은 #RRGGBB로 지정하세요.');return v.toLowerCase();};
const canon=(v:any):any=>Array.isArray(v)?v.map(canon):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canon(v[k])])):v;
export function agentParagraphDecorationPayload(op:AgentParagraphDecorationOp,snapshot:Snapshot):Record<string,unknown>{
 const node=snapshot.nodes.find(n=>n.id===op.target),capability=snapshot.paragraphDecorationSources?.[op.target],source=snapshot.structure?.paragraphs.find(p=>p.id===op.target)?.paragraph;
 if(!node?.editable||capability?.editable!==true||!source)fail(capability?.reason??'현재 조회된 일반 본문 문단의 기본 테두리/배경만 변경합니다.');
 const props=op.properties,allowed=['borderLeft','borderRight','borderTop','borderBottom','fillType','fillColor','spacingLeftMm','spacingRightMm','spacingTopMm','spacingBottomMm','connect','ignoreMargin'];
 if(!props||typeof props!=='object'||Array.isArray(props)||!Object.keys(props).length||Object.keys(props).some(k=>!allowed.includes(k)))fail('변경할 기본 문단 테두리/배경 속성이 잘못되었습니다.');
 const result:Record<string,unknown>={};
 for(const side of ['borderLeft','borderRight','borderTop','borderBottom'])if(side in props){
  const b=props[side] as any;
  if(!b||typeof b!=='object'||Array.isArray(b)||Object.keys(b).length!==3||Object.keys(b).some(k=>!['style','widthMm','color'].includes(k))||!['none','solid'].includes(b.style))fail('테두리는 없음·실선과 지원 굵기·색을 지정하세요.');
  const width=paragraphBorderWidthsMm.indexOf(b.widthMm);if(width<0)fail('테두리 굵기는 지원하는 한글 굵기 16종 중 하나여야 합니다.');
  const c=color(b.color);if(b.style==='none'&&(width!==0||c!=='#000000'))fail('테두리 없음은 0.1mm·#000000 기본 값으로 지정하세요.');result[side]={type:b.style==='solid'?1:0,width,color:c};
 }
 if(('fillType' in props)!==('fillColor' in props))fail('배경 종류와 색은 함께 지정하세요.');
 if('fillType' in props){if(!['none','solid'].includes(props.fillType as string))fail('배경은 없음·단색만 지원합니다.');const c=color(props.fillColor);if(props.fillType==='none'&&c!=='#ffffff')fail('배경 없음은 #ffffff 기본 값으로 지정하세요.');result.fillType=props.fillType;result.fillColor=c;}
 const spacing=source!.borderSpacing;
 for(const [i,key]of ['spacingLeftMm','spacingRightMm','spacingTopMm','spacingBottomMm'].entries())if(key in props){
  const v=props[key];if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>20)fail('테두리 간격은 0~20mm입니다.');
  if(!Array.isArray(spacing)||spacing.length!==4||spacing.some(x=>typeof x!=='number'||!Number.isSafeInteger(x)))fail('원래 테두리 간격을 확인하지 못했습니다.');
  const next=(result.borderSpacing??[...(spacing as number[])]) as number[];next[i]=Math.round((v as number)*7200/25.4);result.borderSpacing=next;
 }
 for(const [key,native]of [['connect','borderConnect'],['ignoreMargin','borderIgnoreMargin']])if(key in props){if(typeof props[key]!=='boolean')fail('테두리 연결/여백 무시는 참·거짓으로 지정하세요.');result[native]=props[key];}
 if('fillType' in result&&result.fillType===source!.fillType&&(result.fillType==='none'||result.fillColor===source!.fillColor)){delete result.fillType;delete result.fillColor;}
 for(const [k,v]of Object.entries(result))if(!['fillType','fillColor'].includes(k)&&JSON.stringify(canon(v))===JSON.stringify(canon(source![k])))delete result[k];
 if(!Object.keys(result).length)fail('문단 테두리/배경의 변경 내용이 없습니다.');
 return result;
}
