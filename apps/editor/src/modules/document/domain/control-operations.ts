import {cellParagraphPlan} from './cell-paragraph.ts';
import {tableSubdivisionPlan} from './table-subdivision.ts';
import {tableStructurePlan} from './table-structure.ts';
import {tableSplitPlan} from './table-split.ts';
import {tableMergePlan} from './table-merge.ts';
import {rowHeightPlan} from './row-heights.ts';
import {equalColumnsPlan,explicitColumnWidthPlan} from './equal-columns.ts';
import {cellPaddingPlan} from './cell-padding.ts';
import {validateAgentTableHeader} from './agent-table-header.ts';
import {validateAgentTablePagination} from './agent-table-pagination.ts';
import {validateAgentNextParagraphStyle} from './agent-style-next.ts';
import {agentRenameParagraphStyleName} from './agent-style-rename.ts';
import {agentCreateParagraphStyleName} from './agent-style-create.ts';
import {agentParagraphOutlinePayload} from './agent-paragraph-outline.ts';
import {validateAgentBasicNumbering} from './agent-basic-numbering.ts';
import {validateAgentNumberingClone} from './agent-numbering-clone.ts';
import {validateAgentBasicBullet} from './agent-basic-bullet.ts';
import {agentParagraphListPayload} from './agent-paragraph-list.ts';
import {agentParagraphDecorationPayload} from './agent-paragraph-decoration.ts';
import {agentParagraphTabsPayload} from './agent-paragraph-tabs.ts';
import {validateAgentBookmark} from './agent-bookmarks.ts';
import {validateAgentHeaderFooter,validateAgentHeaderFooterFormat,validateAgentHeaderFooterParagraph,validateAgentHeaderFooterDelete,validateAgentHeaderFooterCreate} from './agent-header-footer.ts';
import {validateAgentSectionMerge} from './agent-section-merge.ts';
import {validateAgentEmptySection} from './agent-empty-section.ts';
import {validateAgentSectionSplit} from './agent-section-split.ts';
import type { Snapshot, Table, ControlOp, EditOp, DocumentProperties } from '../public/types.ts';
import {tableAxisKinds,controlKinds} from '../public/wire-schema.mjs';
import {agentTabSpacingRaw,agentLineNumberSettings} from './agent-section-settings.ts';
import {agentMasterPagePayload,assertAgentMasterKinds} from './agent-master-pages.ts';
export {tableAxisKinds,controlKinds};
const fail = (m: string): never => { throw new Error(m); };
const object = (v: unknown): Record<string, unknown> => { if (!v || typeof v !== 'object' || Array.isArray(v)) return fail('명령 객체가 필요합니다.'); return v as Record<string, unknown>; };
const only = (v: unknown, fields: string[]) => { if (Object.keys(object(v)).some(k => !fields.includes(k))) fail('지원하지 않는 명령 속성입니다.'); };
const integer = (v: unknown, min: number, max: number) => { if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < min || v > max) fail('대상 범위가 잘못되었습니다.'); return v as number; };
const text = (v: unknown) => { if (typeof v !== 'string' || Array.from(v).length > 4000 || /[\u0000-\u001f\u007f]/u.test(v)) fail('셀은 제어문자 없이 4,000자 이내여야 합니다.'); return v as string; };
export const mm = (v: number) => Math.round(v * 7200 / 25.4);
type PropertyRule = 'boolean' | 'font' | 'color' | [number, number] | string[];
export const charRules: Record<string, PropertyRule> = { bold: 'boolean', italic: 'boolean', underline: 'boolean', strikethrough: 'boolean', fontSizePt: [1, 200], color: 'color',fontFamily:'font',ratioPercent:[50,200],spacingPercent:[-50,50],superscript:'boolean',subscript:'boolean' };
const paraRules: Record<string, PropertyRule> = { alignment: ['left', 'right', 'center', 'justify', 'distribute'], lineSpacingPercent: [50, 500], marginLeftMm: [0, 100], marginRightMm: [0, 100], indentMm: [-100, 100], beforeMm: [0, 100], afterMm: [0, 100], keepWithNext: 'boolean', keepLines: 'boolean', pageBreakBefore: 'boolean' };
const cellRules: Record<string, PropertyRule> = { ...charRules, background: 'color', alignment: paraRules.alignment, verticalAlignment: ['top', 'center', 'bottom'],equalizeColumns:'boolean',columnWidthMm:[1,500],equalizeRows:'boolean',rowHeightMm:[1,300],paddingMode:['custom','table'],paddingLeftMm:[0,100],paddingRightMm:[0,100],paddingTopMm:[0,100],paddingBottomMm:[0,100] };
const pageRules: Record<string, PropertyRule> = { widthMm: [20, 1000], heightMm: [20, 1000], landscape: 'boolean', marginLeftMm: [0, 300], marginRightMm: [0, 300], marginTopMm: [0, 300], marginBottomMm: [0, 300], marginHeaderMm: [0, 100], marginFooterMm: [0, 100] };
function properties(value: unknown, rules: Record<string, PropertyRule>) {
  const v = object(value);
  only(v, Object.keys(rules)); if (!Object.keys(v).length) fail('변경할 속성이 없습니다.');
  for (const [key, value] of Object.entries(v)) {
    const rule = rules[key];
    if (rule === 'boolean' ? typeof value !== 'boolean' : rule === 'font' ? typeof value!=='string'||!value.trim()||value.length>100||/[\x00-\x1f\x7f]/.test(value) : rule === 'color' ? typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value) : typeof rule[0] === 'number' ? typeof value !== 'number' || !Number.isFinite(value) || value < (rule[0] as number) || value > (rule[1] as number) : !(rule as unknown[]).includes(value)) fail('속성 값이 잘못되었습니다: ' + key);
    if(['ratioPercent','spacingPercent'].includes(key)&&!Number.isInteger(value))fail('장평·자간은 정수 백분율로 입력해야 합니다.');
  }
  if(v.superscript===true&&v.subscript===true)fail('위첨자와 아래첨자를 동시에 적용할 수 없습니다.');
  return v;
}
type AxisOperation = Extract<ControlOp, {index:number}>;
export function tableAxisPlan(table:Table,op:AxisOperation):Table {
 if(table.cellZoneCount!==undefined&&table.cellZoneCount!==0)fail('셀 합성 영역이 있는 표는 AI로 행·열을 변경하지 않습니다.');
 if(table.editable===false)fail('보호 표는 AI로 행·열을 편집하지 않습니다.');if(table.cells.some(c=>c.properties.cellProtect===true))fail('보호 셀이 있는 표는 AI로 행·열을 편집하지 않습니다.');
 const values = 'values' in op ? op.values : [];
 const row=op.kind.endsWith('_row'),insert=op.kind.startsWith('insert_');
 only(op,insert?['kind','target','index','values']:['kind','target','index']);
 if(table.cells.length!==table.rows*table.columns||table.cells.some(c=>!c.editable||c.properties.cellProtect===true||c.rowSpan!==1||c.columnSpan!==1))fail('행·열 편집은 병합·중첩·혼합 서식이 없는 단순 표만 지원합니다.');
 const size=row?table.rows:table.columns,other=row?table.columns:table.rows;
 integer(op.index,0,insert?size:size-1);
 if(!insert&&size===1)fail('표의 마지막 행 또는 열은 삭제할 수 없습니다.');
 if(insert&&(!Array.isArray(values)||values.length!==other))fail('삽입할 행·열의 셀 수가 현재 표와 다릅니다.');
 if(insert)values.forEach(text);
 const rows=table.rows+(row?(insert?1:-1):0),columns=table.columns+(!row?(insert?1:-1):0);
 if(rows>50||columns>20||rows*columns>200)fail('행·열 편집 결과는 50행·20열·200셀 이내여야 합니다.');
 const matrix=Array.from({length:table.rows},(_,r)=>Array.from({length:table.columns},(_,c)=>table.cells.find(v=>v.row===r&&v.column===c)));
 if(matrix.some(r=>r.some(c=>!c)))fail('표의 셀 위치를 확인하지 못했습니다.');
 const fresh=(value:string)=>({index:0,row:0,column:0,rowSpan:1,columnSpan:1,text:value,editable:true,properties:{}});
 if(row)matrix.splice(op.index,insert?0:1,...(insert?[values.map(fresh)]:[]));
 else matrix.forEach((r,i)=>r.splice(op.index,insert?0:1,...(insert?[fresh(values[i])]:[])));
 const cells=matrix.flatMap((r,ri)=>r.map((c,ci)=>({...c!,index:ri*columns+ci,row:ri,column:ci})));
 return {...table,rows,columns,cells};
}
export function pageProperties(current: DocumentProperties | undefined, props: Record<string, unknown>) {
  const next: Record<string, unknown> = { ...current };
  for (const [k, v] of Object.entries(props)) next[k.endsWith('Mm') ? k.slice(0, -2) : k] = k.endsWith('Mm') ? mm(v as number) : v;
  // setPageDef stores unrotated paper dimensions; layout rotates on landscape.
  const width = next.landscape ? next.height : next.width, height = next.landscape ? next.width : next.height;
  if ((width as number) - (next.marginLeft as number) - (next.marginRight as number) < mm(10) || (height as number) - (next.marginTop as number) - (next.marginBottom as number) < mm(10)) fail('여백이 용지의 본문 영역을 벗어납니다.');
  return next as DocumentProperties;
}
export function validateControlOperations(operations: EditOp[], snapshot: Snapshot): void {
  const structure = snapshot.structure; if (!structure) fail('이 문서는 구조 조회 후 편집해야 합니다.');
  const tables = new Map(structure!.tables.map(t => [t.id, structuredClone(t)]));
  const pages = new Map(structure!.sections.map(s => [s.index, s.page]));
  const columns = new Map(structure!.sections.filter(s=>s.columns?.sameWidth===true).map(s=>[s.index,{count:Number(s.columns!.columnCount),spacing:Number(s.columns!.spacing)}]));
  // Single columns can carry sameWidth=false; the engine still supports their numbering.
  const lineColumns = new Map(structure!.sections.map(s=>[s.index,s.columns?.columnCount]));
  const lineNumbers = new Map(structure!.sections.map(s=>[s.index,s.lineNumbers]));
  const masters = new Map(structure!.sections.map(s=>[s.index,s.masterPages?structuredClone(s.masterPages):undefined]));
  const changedMasters = new Map<number,Set<string>>();
  const checkMasterStarts=(section:number)=>{
    for(const page of masters.get(section)?.pages??[])if(changedMasters.get(section)?.has(page.kind))agentMasterPagePayload({kind:'set_master_page_text',section,pageKind:page.kind,text:page.text,xMm:page.xMm,yMm:page.yMm,fontSizePt:page.fontSizePt,color:page.color,bold:page.bold},pages.get(section));
  };
  const tableSections = new Set(structure!.tables.map(t=>t.section));
  const checkLineNumbers=(section:number)=>{
    const lines=lineNumbers.get(section);if(!lines?.enabled)return;
    if(lineColumns.get(section)!==1||tableSections.has(section))fail('줄 번호가 있는 구역은 한 단 일반 본문을 유지해야 합니다. 먼저 줄 번호를 끄세요.');
    if(mm(lines.distanceMm)>=Number(pages.get(section)?.marginLeft))fail('줄 번호 간격은 왼쪽 용지 여백 안에 있어야 합니다.');
  };
  const checkColumns=(section:number)=>{
    const layout=columns.get(section);if(!layout||layout.count<=1)return;
    const page=pages.get(section)!;
    const width=Number(page.landscape?page.height:page.width)-Number(page.marginLeft)-Number(page.marginRight);
    if(!Number.isFinite(width)||!Number.isFinite(layout.spacing)||(width-layout.spacing*(layout.count-1))/layout.count<mm(10))fail('각 단의 너비는 10mm 이상이어야 합니다.');
  };
  const created = new Set<string>(); let generated = 0;
  const nodes=structuredClone(snapshot.nodes);
  const hiddenPages=new Map(structure!.paragraphs.filter(p=>p.pageHide?.exists&&p.pageIndex!==undefined).map(p=>[p.pageIndex,p.id]));
  const body = (id: string) => { const n = nodes.find(n => n.id === id); if (!n?.editable) fail('편집 가능한 본문 문단 ID가 필요합니다.'); return n!; };
  const outlines=operations.filter(op=>op.kind==='set_paragraph_outline');
  if(outlines.length&&(outlines.length!==operations.length||new Set(outlines.map(op=>(op as {target:string}).target)).size!==outlines.length))fail('개요는 서로 다른 문단의 개요 전용 명령만 묶어 실행하세요.');
  const lists=operations.filter(op=>op.kind==='set_paragraph_list');
  if(lists.length&&(lists.length!==operations.length||new Set(lists.map(op=>(op as {target:string}).target)).size!==lists.length))fail('문단 번호는 서로 다른 문단의 전용 명령만 묶어 실행하세요.');
  const decoration=operations.filter(op=>op.kind==='format_paragraph_decoration');
  if(decoration.length&&(decoration.length!==operations.length||new Set(decoration.map(op=>(op as {target:string}).target)).size!==decoration.length))fail('문단 테두리/배경은 서로 다른 문단의 전용 명령만 묶어 실행하세요.');
  const tabs=operations.filter(op=>op.kind==='set_paragraph_tabs');
  if(tabs.length&&(tabs.length!==operations.length||new Set(tabs.map(op=>(op as {target:string}).target)).size!==tabs.length))fail('문단 탭은 서로 다른 문단의 탭 명령만 한 요청으로 묶어 실행하세요.');
  for (const op of operations) {
    if(op.kind==='replace_cell_paragraph'){only(op,['kind','target','row','column','paragraph','originalText','text']);if(operations.length!==1)fail('셀 문단 교체는 단독 요청으로 실행하세요.');cellParagraphPlan(op,snapshot);continue;}
    if(op.kind==='split_table_cell_into'){only(op,['kind','target','row','column','rows','columns']);if(operations.length!==1)fail('임의 셀 분할은 단독 요청으로 실행하세요.');tableSubdivisionPlan(op,snapshot);continue;}
    if(op.kind==='split_table'||op.kind==='attach_table'){only(op,op.kind==='split_table'?['kind','target','atRow']:['kind','target','nextTarget']);if(operations.length!==1)fail('표 나누기·붙이기는 단독 요청으로 실행하세요.');tableStructurePlan(op,snapshot);continue;}
    if(op.kind==='split_table_cell'){only(op,['kind','target','row','column']);if(operations.length!==1)fail('셀 기본 분할은 단독 요청으로 실행하세요.');tableSplitPlan(op,snapshot);continue;}
    if(op.kind==='merge_table_cells'){only(op,['kind','target','startRow','startColumn','rowCount','columnCount']);if(operations.length!==1)fail('셀 병합은 단독 요청으로 실행하세요.');tableMergePlan(op,snapshot);continue;}
    if(op.kind==='set_table_header'){only(op,['kind','target','headerRows','repeatHeader','paginationMode']);if(operations.length!==1)fail('표 제목 행은 단독 명령으로 실행하세요.');validateAgentTableHeader(op,snapshot);continue;}
    if(op.kind==='set_table_pagination'){only(op,['kind','target','mode']);if(operations.length!==1)fail('표 쪽 나눔은 단독 명령으로 실행하세요.');validateAgentTablePagination(op,snapshot);continue;}
    if(op.kind==='set_next_paragraph_style'){only(op,['kind','styleId','nextStyleId']);if(operations.length!==1)fail('다음 문단 스타일 설정은 단독 명령으로 실행하세요.');validateAgentNextParagraphStyle(op,snapshot);continue;}
    if(op.kind==='rename_paragraph_style'){only(op,['kind','styleId','name']);if(operations.length!==1)fail('문단 스타일 이름 변경은 단독 명령으로 실행하세요.');agentRenameParagraphStyleName(op,snapshot);continue;}
    if(op.kind==='create_paragraph_style'){only(op,['kind','sourceStyleId','name']);if(operations.length!==1)fail('새 문단 스타일 생성은 단독 명령으로 실행하세요.');agentCreateParagraphStyleName(op,snapshot);continue;}
    if(op.kind==='set_paragraph_outline'){only(op,['kind','target','enabled','level']);agentParagraphOutlinePayload(op,snapshot);continue;}
    if(op.kind==='set_basic_numbering'){only(op,['kind','target','pattern','level','startNumber']);if(operations.length!==1)fail('새 기본 번호 생성과 적용은 단독 명령으로 실행하세요.');validateAgentBasicNumbering(op,snapshot);continue;}
    if(op.kind==='clone_paragraph_numbering'){only(op,['kind','target','sourceDefinitionId','level','startNumber']);if(operations.length!==1)fail('번호 정의 복제와 적용은 단독 명령으로 실행하세요.');validateAgentNumberingClone(op,snapshot);continue;}
    if(op.kind==='set_basic_bullet'){only(op,['kind','target','character']);if(operations.length!==1)fail('새 기본 글머리표 정의 생성과 적용은 단독 명령으로 실행하세요.');validateAgentBasicBullet(op,snapshot);continue;}
    if(op.kind==='set_paragraph_list'){only(op,['kind','target','listKind','definitionId','level']);agentParagraphListPayload(op,snapshot);continue;}
    if(op.kind==='format_paragraph_decoration'){only(op,['kind','target','properties']);agentParagraphDecorationPayload(op,snapshot);continue;}
    if(op.kind==='set_paragraph_tabs'){only(op,['kind','target','stops','autoLeft','autoRight']);agentParagraphTabsPayload(op,snapshot);continue;}
    if(op.kind==='add_bookmark'||op.kind==='rename_bookmark'||op.kind==='delete_bookmark'){only(op,op.kind==='add_bookmark'?['kind','target','offset','name']:op.kind==='rename_bookmark'?['kind','name','newName']:['kind','name']);if(operations.length!==1)fail('책갈피 편집은 단독 명령으로 실행하세요.');validateAgentBookmark(op,snapshot);continue;}
    if(op.kind==='create_header_footer'){only(op,['kind','section','story','pageKind','text']);if(operations.length!==1)fail('머리말/꼬리말 정의 생성은 단독 명령으로 실행하세요.');validateAgentHeaderFooterCreate(op,snapshot);continue;}
    if(op.kind==='delete_header_footer'){only(op,['kind','section','story','pageKind','originalText']);if(operations.length!==1)fail('머리말/꼬리말 정의 삭제는 단독 명령으로 실행하세요.');validateAgentHeaderFooterDelete(op,snapshot);continue;}
    if(op.kind==='format_header_footer_paragraph'){only(op,['kind','section','story','pageKind','originalText','properties']);if(operations.length!==1)fail('머리말/꼬리말 문단 서식은 현재 단독 명령으로 실행하세요.');validateAgentHeaderFooterParagraph(op,snapshot);continue;}
    if(op.kind==='format_header_footer'){only(op,['kind','section','story','pageKind','originalText','properties']);if(operations.length!==1)fail('머리말/꼬리말 글자 서식은 현재 단독 명령으로 실행하세요.');validateAgentHeaderFooterFormat(op,snapshot);continue;}
    if(op.kind==='set_header_footer_text'){only(op,['kind','section','story','pageKind','originalText','text']);if(operations.length!==1)fail('머리말/꼬리말 수정은 현재 단독 명령으로 실행하세요.');validateAgentHeaderFooter(op,snapshot);continue;}
    if(op.kind==='merge_sections'){only(op,['kind','rightSection']);if(operations.length!==1)fail('구역 합치기는 단독 명령으로 실행하세요. 남은 구역 편집은 후속 요청에서 지정합니다.');validateAgentSectionMerge(op,snapshot);continue;}
    if(op.kind==='remove_empty_section'){only(op,['kind','section']);if(operations.length!==1)fail('빈 구역 삭제는 단독 명령으로 실행하세요. 남은 구역의 편집은 후속 요청에서 지정합니다.');validateAgentEmptySection(op,snapshot);continue;}
    if(op.kind==='split_section'){only(op,['kind','target','offset']);if(operations.length!==1)fail('구역 나누기는 단독 명령으로 실행하세요. 새 구역 설정은 후속 요청에서 지정합니다.');validateAgentSectionSplit(op,snapshot);continue;}
    if(op.kind==='insert_body_paragraphs')continue;
    // Body commands are already validated by validateGeneration. Track their
    // resulting text so later format commands are checked at execution time.
    if(op.kind==='replace_body_text'||op.kind==='delete_body_text'){
      const n=body(op.target),chars=Array.from(n.text);
      n.text=chars.slice(0,op.start).join('')+(op.kind==='replace_body_text'?op.text:'')+chars.slice(op.start+op.count).join('');
    } else if (op.kind === 'format_characters' || op.kind === 'format_paragraph') {
      only(op, ['kind', 'target', 'properties']); const n = body(op.target);
      if (op.kind === 'format_characters' && !n.text) fail('빈 문단에는 글자 서식을 적용할 수 없습니다.');
      properties(op.properties, op.kind === 'format_characters' ? charRules : paraRules);
    } else if(op.kind==='apply_paragraph_style'){
      only(op,['kind','target','styleId']);body(op.target);
      if(!structure!.styles?.some(style=>style.id===op.styleId&&style.type===0))fail('현재 문서의 문단 스타일 ID가 필요합니다.');
    } else if(op.kind==='set_master_page_text'||op.kind==='delete_master_page'){
      only(op,op.kind==='delete_master_page'?['kind','section','pageKind']:['kind','section','pageKind','text','xMm','yMm','fontSizePt','color','bold']);integer(op.section,0,structure!.sections.length-1);
      if(!['both','even','odd'].includes(op.pageKind))fail('바탕쪽 종류는 양쪽·홀수·짝수입니다.');
      const current=masters.get(op.section);if(!current?.editable)fail('원본 바탕쪽이 읽기 전용이거나 조회되지 않았습니다.');
      const existing=current!.pages.find(p=>p.kind===op.pageKind),rest=current!.pages.filter(p=>p.kind!==op.pageKind);
      if(op.kind==='set_master_page_text'){
        agentMasterPagePayload(op,pages.get(op.section));
        rest.push({...existing,kind:op.pageKind,text:op.text,textTruncated:false,xMm:op.xMm,yMm:op.yMm,fontSizePt:op.fontSizePt,color:op.color.toLowerCase(),bold:op.bold,italic:existing?.italic??false,underline:existing?.underline??null,editable:true,paragraphCount:op.text.split('\n').length,controlCount:0});
      }
      assertAgentMasterKinds(snapshot.name,rest.map(p=>p.kind));current!.pages=rest;
      const changed=changedMasters.get(op.section)??new Set();changed.add(op.pageKind);changedMasters.set(op.section,changed);checkMasterStarts(op.section);
    } else if(op.kind==='set_page_background'){
      only(op,['kind','section','pageKind','fillType','color']);integer(op.section,0,structure!.sections.length-1);
      if(!['both','even','odd'].includes(op.pageKind)||!['none','solid'].includes(op.fillType)||typeof op.color!=='string'||!/^#[0-9a-f]{6}$/i.test(op.color))fail('쪽 배경은 양쪽·홀수·짝수 쪽의 없음·단색(#RRGGBB)만 지원합니다.');
      const settings=structure!.sections.find(s=>s.index===op.section)?.pageBackgrounds;
      if(!settings?.find(s=>s.kind===op.pageKind)?.editable)fail('이 구역의 원본 쪽 배경은 읽기 전용이거나 조회되지 않았습니다.');
    } else if(op.kind==='set_section_tabs'){
      only(op,['kind','section','spacingPt']);integer(op.section,0,structure!.sections.length-1);agentTabSpacingRaw(op.spacingPt);
      if(structure!.sections.find(s=>s.index===op.section)?.defaultTabSpacingPt===undefined)fail('기본 탭 설정을 조회한 구역이 필요합니다.');
    } else if(op.kind==='set_line_numbers'){
      only(op,['kind','section','enabled','restart','countBy','startNumber','distanceMm']);integer(op.section,0,structure!.sections.length-1);agentLineNumberSettings(op);
      if(!/\.hwpx$/iu.test(snapshot.name))fail('AI 줄 번호 편집은 HWPX에서 지원합니다. 먼저 HWPX로 저장하세요.');
      const current=structure!.sections.find(s=>s.index===op.section)?.lineNumbers;
      if(!current||(!current.editable&&(current.enabled||op.enabled)))fail('이 구역의 줄 번호는 지원 범위 밖입니다. 원본 설정을 유지합니다.');
      lineNumbers.set(op.section,{editable:current!.editable,enabled:op.enabled,restart:op.restart,countBy:op.countBy,startNumber:op.startNumber,distanceMm:op.distanceMm});checkLineNumbers(op.section);
    } else if(op.kind==='set_columns'){
      only(op,['kind','section','count','spacingMm']);integer(op.section,0,structure!.sections.length-1);integer(op.count,1,6);
      if(typeof op.spacingMm!=='number'||!Number.isFinite(op.spacingMm)||op.spacingMm<0||op.spacingMm>100)fail('단 간격은 0~100mm여야 합니다.');
      columns.set(op.section,{count:op.count,spacing:mm(op.spacingMm)});lineColumns.set(op.section,op.count);checkColumns(op.section);checkLineNumbers(op.section);
    } else if(op.kind==='set_page_hide'){
      only(op,['kind','target','properties']);const n=nodes.find(n=>n.id===op.target);
      if(!n||(!n.editable&&!structure!.paragraphs.find(p=>p.id===n.id)?.pageHide?.exists))fail('감추기를 적용할 본문 문단 ID가 필요합니다.');
      const target=structure!.paragraphs.find(p=>p.id===n!.id);
      if(target?.controls?.some(id=>!['secd','cold','pghd'].includes(id)))fail('다른 개체·필드가 있는 문단의 감추기는 아직 지원하지 않습니다.');
      if(target?.pageIndex!==undefined){const existing=hiddenPages.get(target.pageIndex);if(existing&&existing!==op.target)fail('같은 쪽에 이미 감추기 대상이 있습니다. 기존 문단을 수정하세요.');hiddenPages.set(target.pageIndex,op.target);}
      properties(op.properties,{hideHeader:'boolean',hideFooter:'boolean',hideMasterPage:'boolean',hideBorder:'boolean',hideFill:'boolean',hidePageNum:'boolean'});
    } else if (op.kind === 'set_page_setup') {
      only(op, ['kind', 'section', 'properties']); integer(op.section, 0, structure!.sections.length - 1);
      properties(op.properties, pageRules); pages.set(op.section, pageProperties(pages.get(op.section), op.properties));checkColumns(op.section);checkLineNumbers(op.section);checkMasterStarts(op.section);
    } else if (op.kind === 'create_table') {
      only(op, ['kind', 'after', 'resultId', 'rows']); body(op.after);
      const section=body(op.after).section;tableSections.add(section);checkLineNumbers(section);
      if (typeof op.resultId !== 'string' || !/^[A-Za-z][\w-]{0,39}$/.test(op.resultId) || created.has(op.resultId)) fail('새 표의 resultId는 중복되지 않는 영문 ID여야 합니다.');
      if (!Array.isArray(op.rows)) fail('표 데이터가 필요합니다.'); integer(op.rows.length, 1, 50);
      if (!Array.isArray(op.rows[0])) fail('표의 열이 필요합니다.'); const columns = integer(op.rows[0].length, 1, 20);
      if (op.rows.length * columns > 200) fail('한 번에 만드는 표는 200셀 이내입니다.');
      const cells: Table['cells'] = [];
      op.rows.forEach((row: unknown[], r: number) => { if (!Array.isArray(row) || row.length !== columns) fail('표의 열 개수가 다릅니다.'); row.forEach((value: unknown, c: number) => { generated += text(value).length; cells.push({ index: r * columns + c, row: r, column: c, rowSpan: 1, columnSpan: 1, text: value as string, editable: true, properties: {} }); }); });
      created.add(op.resultId); tables.set('@' + op.resultId, { id: '@' + op.resultId, section: 0, paragraph: 0, control: 0, rows: op.rows.length, columns, cells });
    } else if('index' in op && tableAxisKinds.includes(op.kind)) {
      const table=tables.get(op.target);if(!table)fail('현재 문서 또는 이번 요청에서 만든 표 ID가 필요합니다.');
      tables.set(op.target,tableAxisPlan(table!,op));
      if('values' in op)generated+=op.values.join('').length;
    } else if (op.kind === 'set_table_cell' || op.kind === 'format_table_cells') {
      const table = tables.get(op.target); if (!table) fail('현재 문서 또는 이번 요청에서 만든 표 ID가 필요합니다.');if(table!.editable===false)fail('보호 표는 AI로 편집하지 않습니다.');
      if (op.kind === 'set_table_cell') {
        only(op, ['kind', 'target', 'row', 'column', 'originalText', 'text']);
        integer(op.row, 0, table!.rows - 1); integer(op.column, 0, table!.columns - 1);
        const cell = table!.cells.find(c => c.row === op.row && c.column === op.column);
        if(cell?.properties.cellProtect===true)fail('보호 셀은 AI로 내용을 수정하지 않습니다.');
        if (!cell?.editable || cell.properties.cellProtect===true || cell.rowSpan !== 1 || cell.columnSpan !== 1 || cell.text !== op.originalText) fail('셀 원문이 다르거나 복잡한 셀입니다.');
        generated += text(op.text).length; cell!.text = op.text;
      } else {
        only(op, ['kind', 'target', 'startRow', 'rowCount', 'startColumn', 'columnCount', 'properties']);
        integer(op.startRow, 0, table!.rows - 1); integer(op.rowCount, 1, table!.rows - op.startRow); integer(op.startColumn, 0, table!.columns - 1); integer(op.columnCount, 1, table!.columns - op.startColumn);
        properties(op.properties, cellRules);
        if(Object.hasOwn(op.properties,'equalizeRows')||Object.hasOwn(op.properties,'rowHeightMm')){if(operations.length!==1)fail('행 높이는 단독 요청으로 실행하세요.');rowHeightPlan(op,snapshot);}
        if(Object.hasOwn(op.properties,'columnWidthMm')){if(operations.length!==1)fail('열 너비 직접 지정은 단독 요청으로 실행하세요.');explicitColumnWidthPlan(op,snapshot);}
        if(Object.hasOwn(op.properties,'equalizeColumns')){if(operations.length!==1)fail('열 너비 균등 분배는 단독 요청으로 실행하세요.');equalColumnsPlan(op,snapshot);}
        if(Object.keys(op.properties).some(k=>k.startsWith('padding'))){if(operations.length!==1)fail('셀 안 여백은 단독 요청으로 실행하세요.');cellPaddingPlan(op,snapshot);}
        const cells = selectedCells(table!, op);if(cells.some(c=>c.properties.cellProtect===true))fail('보호 셀은 AI로 서식을 수정하지 않습니다.');
        if (cells.length !== op.rowCount * op.columnCount || cells.some(c => !c.editable || c.properties.cellProtect===true || c.rowSpan !== 1 || c.columnSpan !== 1)) fail('병합 셀 또는 복잡한 셀 서식은 아직 지원하지 않습니다.');
        if (Object.keys(op.properties).some(k => k in charRules) && cells.some(c => !c.text)) fail('빈 셀의 글자 서식은 텍스트 입력 후 적용하세요.');
      }
    } else fail('지원하지 않는 구조 편집 명령입니다.');
  }
  if (generated > 60000) fail('생성하는 표 텍스트는 60,000자 이내입니다.');
}

export const selectedCells = (table: Table, op: {startRow:number;rowCount:number;startColumn:number;columnCount:number}) => table.cells.filter(c => c.row >= op.startRow && c.row < op.startRow + op.rowCount && c.column >= op.startColumn && c.column < op.startColumn + op.columnCount);
