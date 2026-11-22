import type {CommandTemplate} from '../public/contracts.ts';
import {assertTemplate} from '../domain/commands.ts';
const kindName={both:'양쪽',odd:'홀수 쪽',even:'짝수 쪽'};
const preview=(text:string)=>text.length>240?text.slice(0,240)+'… (앞 240자 미리보기)':text;
export function describeTemplate(template:CommandTemplate):string {
 assertTemplate(template);
 return template.operations.map((op,i)=>{
  const section='section' in op?`기록 ${op.section+1}구역 · `:'';
  let label:string;
  if(op.kind==='set_section_tabs')label=`기본 탭 ${op.spacingPt}pt`;
  else if(op.kind==='set_line_numbers')label=`줄 번호 ${op.enabled?'켜기':'끄기'} · ${{page:'쪽마다',section:'구역마다',continuous:'이어 매기기'}[op.restart]} · ${op.startNumber}부터 ${op.countBy}줄마다 · 본문 간격 ${op.distanceMm}mm`;
  else if(op.kind==='set_page_background')label=`${kindName[op.pageKind]} 배경 ${op.fillType==='none'?'지우기':'단색 '+op.color}`;
  else if(op.kind==='set_master_page_text')label=`${kindName[op.pageKind]} 바탕쪽 추가/수정 · ${op.fontSizePt}pt · ${op.color} · ${op.bold?'진하게':'보통'} · 위치 ${op.xMm}, ${op.yMm}mm\n${preview(op.text)}`;
  else if(op.kind==='delete_master_page')label=`저장된 ${kindName[op.pageKind]} 바탕쪽 삭제 (앞 구역 상속은 별도)`;
  else if(op.kind==='set_columns')label=`${op.count}단 · 단 간격 ${op.spacingMm}mm`;
  else if(op.kind==='set_page_setup'){
   const names:Record<string,string>={widthMm:'용지 너비',heightMm:'용지 높이',landscape:'가로 방향',marginLeftMm:'왼쪽 여백',marginRightMm:'오른쪽 여백',marginTopMm:'위 여백',marginBottomMm:'아래 여백',marginHeaderMm:'머리말 여백',marginFooterMm:'꼬리말 여백'};
   label='용지/여백 · '+Object.entries(op.properties).map(([k,v])=>`${names[k]??'지원 검사 대상'} ${k==='landscape'?(v?'켜기':'끄기'):v+'mm'}`).join(' · ');
  }else if(op.kind==='create_document')label='새 문서 · '+op.paragraphs.length+'문단';
  else if(op.kind==='create_table')label='새 표 · '+op.rows.length+'행 × '+op.rows[0]?.length+'열';
  else if(op.kind==='set_table_cell')label=`대상 표의 ${op.row+1}행 ${op.column+1}열 내용 바꾸기\n${preview(op.text)}`;
  else if(op.kind==='set_shape_fill')label=`대상 도형의 단색 채우기를 ${op.color}로 바꾸기`;
  else if(op.kind==='format_table_cells')label=`대상 표의 ${op.startRow+1}행 ${op.startColumn+1}열부터 ${op.rowCount}행 × ${op.columnCount}열 서식 변경`;
  else if(op.kind==='insert_table_row'||op.kind==='insert_table_column')label=`대상 표의 ${op.index+1}번째 ${op.kind==='insert_table_row'?'행':'열'} 위치에 추가`;
  else if(op.kind==='delete_table_row'||op.kind==='delete_table_column')label=`대상 표의 ${op.index+1}번째 ${op.kind==='delete_table_row'?'행':'열'} 삭제`;
  else if(op.kind==='insert_body_paragraphs')label='원문 대조 후 본문 '+op.paragraphs.length+'문단 삽입';
  else if(op.kind==='replace_body_text')label='원문 대조 후 본문 수정\n'+preview(op.text);
  else if(op.kind==='delete_body_text')label='원문 대조 후 본문 삭제';
  else label='원문 대조 후 '+(op.kind==='format_characters'?'글자':'문단')+' 서식 변경';
  return `${i+1}. ${section}${label}`;
 }).join('\n');
}
