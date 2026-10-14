import type {Snapshot,AgentParagraphTabsOp} from '../public/types.ts';
const fail=(m:string):never=>{throw new Error(m);};
export function agentParagraphTabsPayload(op:AgentParagraphTabsOp,snapshot:Snapshot){
 const node=snapshot.nodes.find(n=>n.id===op.target),source=snapshot.paragraphTabSources?.[op.target];
 if(!node?.editable||source?.editable!==true)fail(source?.reason??'현재 조회된 편집 가능한 일반 본문 탭만 변경합니다.');
 if(typeof op.autoLeft!=='boolean'||typeof op.autoRight!=='boolean')fail('양 끝 자동 탭 여부는 참/거짓이어야 합니다.');
 if(!Array.isArray(op.stops)||op.stops.length>32)fail('문단 사용자 탭은 32개 이하입니다.');
 const section=snapshot.structure?.sections.find(s=>s.index===node!.section),p=snapshot.structure?.paragraphs.find(p=>p.id===op.target)?.paragraph;
 if(!section||!p)fail('현재 문단과 쪽 설정을 확인하지 못했습니다.');
 const page=section!.page,width=page.landscape?page.height:page.width;
 const values=[width,page.marginLeft,page.marginRight,p!.marginLeft??0,p!.marginRight??0];
 if(values.some(v=>typeof v!=='number'||!Number.isFinite(v)))fail('문단의 사용 가능한 본문 너비를 확인하지 못했습니다.');
 const available=(width as number)-(page.marginLeft as number)-(page.marginRight as number)-Number(p!.marginLeft??0)-Number(p!.marginRight??0);
 let previous=0;
 const tabStops=op.stops.map(stop=>{
  if(!stop||typeof stop!=='object'||Array.isArray(stop)||Object.keys(stop).length!==3||Object.keys(stop).some(k=>!['positionMm','alignment','leader'].includes(k)))fail('지원하지 않는 탭 속성입니다.');
  if(typeof stop.positionMm!=='number'||!Number.isFinite(stop.positionMm)||stop.positionMm<0.1||stop.positionMm>1000)fail('탭 위치는 0.1~1000mm여야 합니다.');
  const position=Math.round(stop.positionMm*7200/25.4);
  if(position<=previous||position>available)fail('탭 위치는 본문 너비 안에서 중복 없이 오름차순이어야 합니다.');previous=position;
  const type=['left','right','center','decimal'].indexOf(stop.alignment),fill=['none','solid','dash','dot'].indexOf(stop.leader);
  if(type<0||fill<0)fail('지원하지 않는 탭 정렬 또는 채움선입니다.');return {position,type,fill};
 });
 if(Array.isArray(p!.tabStops)&&JSON.stringify(p!.tabStops.map((t:any)=>({position:t.position,type:t.type,fill:t.fill})))===JSON.stringify(tabStops)&&p!.tabAutoLeft===op.autoLeft&&p!.tabAutoRight===op.autoRight)fail('문단 탭의 변경 내용이 없습니다.');
 return {tabStops,tabAutoLeft:op.autoLeft,tabAutoRight:op.autoRight};
}
