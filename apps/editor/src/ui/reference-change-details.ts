import type {ReferenceChangeReview} from '../modules/agent/public/index.ts';
import {describeShapeFillLocation,describeTableLocation} from './agent-changes.ts';

type Operation=ReferenceChangeReview['operations'][number];
type Detail={heading:string;description?:string};
const pages={both:'양쪽',even:'짝수 쪽',odd:'홀수 쪽'} as const;
const stories={header:'머리말',footer:'꼬리말'} as const;
const pagination={none:'나누지 않음',cell:'셀 단위',row:'행 단위'} as const;
const alignment:Record<string,string>={left:'왼쪽',right:'오른쪽',center:'가운데',justify:'양쪽',distribute:'배분',top:'위',bottom:'아래',decimal:'소수점'};
const values:Record<string,string>={none:'없음',solid:'단색',custom:'직접 지정',table:'표와 동일',...alignment};
const labels:Record<string,string>={
 widthMm:'용지 너비',heightMm:'용지 높이',landscape:'방향',marginLeftMm:'왼쪽 여백',marginRightMm:'오른쪽 여백',
 marginTopMm:'위 여백',marginBottomMm:'아래 여백',marginHeaderMm:'머리말 여백',marginFooterMm:'꼬리말 여백',
 borderIncludesHeader:'테두리에 머리말 포함',borderIncludesFooter:'테두리에 꼬리말 포함',
 bold:'굵게',italic:'기울임',underline:'밑줄',strikethrough:'취소선',fontSizePt:'글자 크기',color:'글자색',fontFamily:'글꼴',
 ratioPercent:'장평',spacingPercent:'자간',superscript:'위첨자',subscript:'아래첨자',alignment:'정렬',lineSpacingPercent:'줄 간격',
 indentMm:'들여쓰기',beforeMm:'문단 위 간격',afterMm:'문단 아래 간격',keepWithNext:'다음 문단과 함께',keepLines:'문단 보호',pageBreakBefore:'문단 앞에서 쪽 나누기',
 background:'배경색',verticalAlignment:'세로 정렬',equalizeColumns:'열 너비 균등 분배',columnWidthMm:'열 너비',equalizeRows:'행 높이 균등 분배',
 rowHeightMm:'행 높이',paddingMode:'셀 안 여백',paddingLeftMm:'셀 안 왼쪽 여백',paddingRightMm:'셀 안 오른쪽 여백',
 paddingTopMm:'셀 안 위 여백',paddingBottomMm:'셀 안 아래 여백',fillType:'배경 종류',fillColor:'배경색',
 spacingLeftMm:'왼쪽 테두리 간격',spacingRightMm:'오른쪽 테두리 간격',spacingTopMm:'위 테두리 간격',spacingBottomMm:'아래 테두리 간격',
 borderLeft:'왼쪽 테두리',borderRight:'오른쪽 테두리',borderTop:'위 테두리',borderBottom:'아래 테두리',
 connect:'문단 테두리 연결',ignoreMargin:'문단 여백 무시',hideHeader:'머리말 감추기',hideFooter:'꼬리말 감추기',
 hideMasterPage:'바탕쪽 감추기',hidePageNum:'쪽 번호 감추기',hideBorder:'테두리 감추기',hideFill:'배경 감추기',
};
export const textChange=(before:string,after:string)=>`변경 전\n${before||'(빈 범위)'}\n\n변경 후\n${after||'(비움)'}`;
const position=(row:number,column:number)=>`${row+1}행 ${column+1}열`;
const rectangle=(row:number,column:number,rows:number,columns:number)=>`${position(row,column)}~${row+rows}행 ${column+columns}열`;
const numberWithUnit=(key:string,value:number)=>`${value}${key.endsWith('Mm')?' mm':key.endsWith('Pt')?' pt':key.endsWith('Percent')?'%':''}`;
function propertyLines(properties:Record<string,unknown>):string[] {
 const lines:string[]=[];
 for(const [key,value] of Object.entries(properties)){
  const label=labels[key];
  if(key==='storedStyle'&&value&&typeof value==='object'&&'styleId' in value&&'start' in value&&'count' in value){
   lines.push(`글자 스타일 ${value.styleId}번 · ${Number(value.start)+1}번째부터 ${value.count}자`);
  }else if(label&&key==='landscape')lines.push(`${label} ${value?'가로':'세로'}`);
  else if(label&&typeof value==='boolean')lines.push(`${label} ${value?'켜기':'끄기'}`);
  else if(label&&typeof value==='number')lines.push(`${label} ${numberWithUnit(key,value)}`);
  else if(label&&typeof value==='string')lines.push(`${label} ${key==='fontFamily'?value:values[value]??value}`);
  else if(label&&value&&typeof value==='object'&&'style' in value&&'widthMm' in value&&'color' in value){
   lines.push(`${label} ${value.style==='none'?'없음':`실선 ${value.widthMm} mm · ${value.color}`}`);
  }
 }
 return lines;
}
const borderFlags=(flags:{headerInside?:boolean;footerInside?:boolean})=>[
 typeof flags.headerInside==='boolean'?`머리말 ${flags.headerInside?'포함':'제외'}`:'',
 typeof flags.footerInside==='boolean'?`꼬리말 ${flags.footerInside?'포함':'제외'}`:'',
].filter(Boolean);

export function describeReferenceOperation(operation:Operation,review:ReferenceChangeReview):Detail {
 const {document,shapeFills,tableLocations}=review;
 const paragraph=(id:string)=>{
  const node=document.nodes.find(item=>item.id===id);
  return node?`${node.section+1}구역 ${node.paragraph+1}번째 문단`:'본문 문단';
 };
 const table=(id:string)=>{
  const entry=tableLocations.find(item=>item.id===id);
  return entry?describeTableLocation(entry):'이 요청에서 만든 표';
 };
 const section=(number:number)=>`${number+1}구역`;
 const styled=(heading:string,properties:Record<string,unknown>)=>({heading,description:propertyLines(properties).join('\n')});
 switch(operation.kind){
  case 'create_document':return {heading:'새 문서에 초안 작성',description:operation.paragraphs.join('\n\n')};
  case 'insert_body_paragraphs':return {heading:`${paragraph(operation.after)} 뒤에 삽입`,description:operation.paragraphs.join('\n\n')};
  case 'create_table':return {heading:`${paragraph(operation.after)} 뒤에 ${operation.rows.length}행 × ${operation.rows[0].length}열 표 추가`,
   description:operation.rows.map(row=>row.join(' │ ')).join('\n')};
  case 'replace_body_text':case 'delete_body_text':{
   const node=document.nodes.find(item=>item.id===operation.target);
   const before=[...(node?.text??'')].slice(operation.start,operation.start+operation.count).join('');
   return {heading:`${paragraph(operation.target)} ${operation.kind==='replace_body_text'?'교체':'삭제'}`,
    description:`${operation.start+1}번째 글자부터 ${operation.count}자\n\n${textChange(before,operation.kind==='replace_body_text'?operation.text:'')}`};
  }
  case 'set_table_cell':case 'replace_cell_paragraph':{
   const heading=`${table(operation.target)} · ${position(operation.row,operation.column)}${operation.paragraph===undefined?'':` · 셀의 ${operation.paragraph+1}번째 문단`} 편집`;
   const spans=operation.spanTexts?.map((span,index)=>`${index+1}. ${span||'(비움)'}`).join('\n');
   const formats='spanFormats' in operation?operation.spanFormats?.map(({start,end,...properties})=>
    `${start+1}~${end}번째 글자 · ${propertyLines(properties).join(', ')}`).join('\n'):undefined;
   return {heading,description:[textChange(operation.originalText,operation.text),spans&&`글자 서식을 유지할 구간\n${spans}`,formats&&`글자 모양 변경\n${formats}`].filter(Boolean).join('\n\n')};
  }
  case 'set_shape_fill':{
   const shape=shapeFills[operation.target],color=operation.color.toLowerCase();
   return {heading:shape?describeShapeFillLocation(shape):'도형 채우기',description:shape?textChange(shape.color,color):color};
  }
  case 'insert_table_row':case 'insert_table_column':{
   const axis=operation.kind==='insert_table_row'?'행':'열';
   return {heading:`${table(operation.target)} · ${operation.index+1}${axis} 위치에 한 ${axis} 삽입`,description:operation.values.join(operation.kind==='insert_table_row'?' │ ':'\n')};
  }
  case 'delete_table_row':case 'delete_table_column':return {heading:`${table(operation.target)} · ${operation.index+1}${operation.kind==='delete_table_row'?'행':'열'} 삭제`};
  case 'format_table_cells':return styled(`${table(operation.target)} · ${rectangle(operation.startRow,operation.startColumn,operation.rowCount,operation.columnCount)} 서식`,operation.properties);
  case 'merge_table_cells':return {heading:`${table(operation.target)} · ${rectangle(operation.startRow,operation.startColumn,operation.rowCount,operation.columnCount)} 셀 합치기`};
  case 'split_table_cell':return {heading:`${table(operation.target)} · ${position(operation.row,operation.column)}의 병합 셀 나누기`};
  case 'split_table_cell_into':return {heading:`${table(operation.target)} · ${position(operation.row,operation.column)}의 셀을 ${operation.rows}행 × ${operation.columns}열로 나누기`,
   description:operation.distributeParagraphs?'셀의 문단을 나눈 셀에 배치':undefined};
  case 'split_table':return {heading:`${table(operation.target)} · ${operation.atRow+1}행부터 별도 표로 나누기`};
  case 'attach_table':return {heading:`${table(operation.target)}에 다음 표 붙이기`,description:`붙일 표 · ${table(operation.nextTarget)}`};
  case 'set_table_header':return {heading:`${table(operation.target)} · 제목 행과 쪽 나눔`,description:`제목 ${operation.headerRows}행\n쪽마다 제목 반복 ${operation.repeatHeader?'켜기':'끄기'}\n${pagination[operation.paginationMode]}`};
  case 'set_table_pagination':return {heading:`${table(operation.target)} · 쪽 나눔`,description:pagination[operation.mode]};
  case 'set_page_setup':return styled(`${section(operation.section)} · 용지·여백`,operation.properties);
  case 'set_page_border_inclusion':return {heading:`${operation.sections.map(section).join(' · ')} 쪽 테두리 포함 설정`,description:borderFlags(operation).join('\n')};
  case 'set_page_background':return {heading:`${section(operation.section)} · ${pages[operation.pageKind]} 배경`,
   description:operation.fillType==='gradient'?`그러데이션 ${operation.color} → ${operation.endColor} · ${operation.angle}°`
    :operation.fillType==='none'?'배경 지우기':`단색 ${operation.color}`};
  case 'set_columns':return {heading:`${section(operation.section)} · 다단`,description:`${operation.count}단\n단 간격 ${operation.spacingMm} mm`};
  case 'set_section_tabs':return {heading:`${section(operation.section)} · 기본 탭`,description:`${operation.spacingPt} pt`};
  case 'set_line_numbers':return {heading:`${section(operation.section)} · 줄 번호`,description:operation.enabled?
   `시작 번호 ${operation.startNumber}\n${operation.countBy}줄마다 표시\n간격 ${operation.distanceMm} mm\n${{page:'쪽마다 새 번호',section:'구역마다 새 번호',continuous:'이어 매기기'}[operation.restart]}`:'줄 번호 끄기'};
  case 'set_master_page_text':return {heading:`${section(operation.section)} · ${pages[operation.pageKind]} 바탕쪽 문구`,description:[operation.text,
   `위치 왼쪽 ${operation.xMm} mm, 위 ${operation.yMm} mm`,...propertyLines({fontSizePt:operation.fontSizePt,color:operation.color,bold:operation.bold})].join('\n')};
  case 'delete_master_page':return {heading:`${section(operation.section)} · ${pages[operation.pageKind]} 바탕쪽 삭제`};
  case 'split_section':{
   const label=operation.offset===0?'문단 처음':`문단의 ${operation.offset}번째 글자 뒤`;
   const settings=[...propertyLines(operation.newPageSetup??{}),...borderFlags(operation.newPageBorder??{}).map(flag=>`쪽 테두리 ${flag}`)];
   return {heading:`${paragraph(operation.target)}에서 구역 나누기`,description:[label,...(settings.length?['새 구역 설정',...settings]:[])].join('\n')};
  }
  case 'merge_sections':return {heading:`${section(operation.rightSection)}을 ${section(operation.rightSection-1)}에 합치기`};
  case 'remove_empty_section':return {heading:`빈 ${section(operation.section)} 삭제`};
  case 'create_header_footer':case 'delete_header_footer':case 'set_header_footer_text':case 'format_header_footer':case 'format_header_footer_paragraph':{
   const heading=`${section(operation.section)} · ${pages[operation.pageKind]} ${stories[operation.story]}`;
   if(operation.kind==='create_header_footer')return {heading:`${heading} 추가`,description:operation.text};
   if(operation.kind==='delete_header_footer')return {heading:`${heading} 삭제`,description:textChange(operation.originalText,'')};
   if(operation.kind==='set_header_footer_text')return {heading:`${heading} 교체`,description:textChange(operation.originalText,operation.text)};
   return styled(`${heading} 서식`,operation.properties);
  }
  case 'format_characters':return styled(`${paragraph(operation.target)} · 글자 모양`,operation.properties);
  case 'format_paragraph':return styled(`${paragraph(operation.target)} · 문단 모양`,operation.properties);
  case 'format_paragraph_decoration':return styled(`${paragraph(operation.target)} · 테두리·배경`,operation.properties);
  case 'set_page_hide':return styled(`${paragraph(operation.target)} · 쪽에서 감출 항목`,operation.properties);
  case 'set_paragraph_tabs':return {heading:`${paragraph(operation.target)} · 탭 설정`,description:[
   ...operation.stops.map(stop=>`${stop.positionMm} mm · ${alignment[stop.alignment]} · ${{none:'채움 없음',solid:'실선',dash:'파선',dot:'점선'}[stop.leader]}`),
   `왼쪽 자동 탭 ${operation.autoLeft?'켜기':'끄기'} · 오른쪽 자동 탭 ${operation.autoRight?'켜기':'끄기'}`].join('\n')};
  case 'set_paragraph_outline':return {heading:`${paragraph(operation.target)} · 개요`,description:operation.enabled?`${operation.level}수준`:'개요 해제'};
  case 'apply_paragraph_style':return {heading:`${paragraph(operation.target)} · 문단 스타일 ${operation.styleId}번 적용`};
  case 'set_next_paragraph_style':return {heading:`스타일 ${operation.styleId}번의 다음 문단 스타일 변경`,description:`스타일 ${operation.nextStyleId}번`};
  case 'rename_paragraph_style':return {heading:`스타일 ${operation.styleId}번 이름 변경`,description:operation.name};
  case 'create_paragraph_style':return {heading:`스타일 ${operation.sourceStyleId}번을 바탕으로 스타일 추가`,description:operation.name};
  case 'set_basic_numbering':return {heading:`${paragraph(operation.target)} · 기본 번호 매기기`,description:`${operation.pattern} · ${operation.level}수준 · ${operation.startNumber}부터`};
  case 'clone_paragraph_numbering':return {heading:`${paragraph(operation.target)} · 번호 목록 복제`,description:`목록 ${operation.sourceDefinitionId}번 · ${operation.level}수준 · ${operation.startNumber}부터`};
  case 'set_basic_bullet':return {heading:`${paragraph(operation.target)} · 글머리표`,description:operation.character};
  case 'set_paragraph_list':return {heading:`${paragraph(operation.target)} · 목록 변경`,description:operation.listKind==='none'?'목록 해제':`${operation.listKind==='number'?'번호':'글머리표'} 목록 ${operation.definitionId}번`};
  case 'add_bookmark':return {heading:`${paragraph(operation.target)}에 책갈피 추가`,description:`${operation.name} · ${operation.offset+1}번째 글자 위치`};
  case 'rename_bookmark':return {heading:'책갈피 이름 변경',description:textChange(operation.name,operation.newName)};
  case 'delete_bookmark':return {heading:'책갈피 삭제',description:operation.name};
  case 'update_table_formula_field':case 'insert_table_formula_field':return {heading:`${table(operation.target)} · ${position(operation.row,operation.column)} 계산식 ${operation.kind==='insert_table_formula_field'?'삽입':'변경'}`,
   description:[operation.kind==='update_table_formula_field'?textChange(operation.originalCommand,operation.formula):operation.formula,operation.resultFormat&&`결과 형식 ${operation.resultFormat}`].filter(Boolean).join('\n')};
  case 'fill_table_series':return {heading:`${table(operation.target)} · ${position(operation.startRow,operation.startColumn)}~${position(operation.endRow,operation.endColumn)} 자동 채우기`,
   description:`${{days:'일 단위',months:'월 단위',years:'년 단위',formula:'계산식','calculated-value':'계산 결과'}[operation.mode]}${operation.axis?` · ${operation.axis==='rows'?'행':'열'} 방향`:''}`};
  case 'set_document_metadata':return {heading:'문서 요약 속성',description:[['제목',operation.values.title],['주제',operation.values.subject],['작성자',operation.values.author],
   ['키워드',operation.values.keywords],['설명',operation.values.description]].map(([label,value])=>`${label} · ${value||'(비움)'}`).join('\n')};
  case 'save_active_document':return {heading:'현재 문서를 연결된 원본 파일에 저장'};
  case 'new_document_tab':return {heading:'빈 문서 탭 열기'};
  case 'activate_document_tab':case 'close_document_tab':{
   const name=document.fileContext?.tabs.find(tab=>tab.id===operation.tabId)?.name??'대상 문서';
   return {heading:`${name} 탭 ${operation.kind==='close_document_tab'?'닫기':'선택'}`};
  }
  case 'list_document_tabs':return {heading:'현재 업무의 문서 탭 조회'};
 }
}
