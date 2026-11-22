import type { AgentPageBackground, NestedTable, Receipt, Structure, Table } from '../modules/document/public/types.ts';

type DisplayTable = (Table | NestedTable) & {label:string; datum:string};
type StructureChangeInput=Pick<Receipt,'beforeStructure'|'afterStructure'|'shapeFill'|'storedCharacterStyle'|'metadata'|'sectionSplit'|'sectionRemoval'> &
  Partial<Pick<Receipt,'before'|'after'>>;
const cached = new WeakMap<Receipt,readonly string[]>();
const equal = (left:unknown,right:unknown) => JSON.stringify(left)===JSON.stringify(right);
const dimension = (table:Pick<Table,'rows'|'columns'>) => `${table.rows}행 × ${table.columns}열`;
const cellAddress = (cell:{row:number;column:number}) => `${cell.row+1}행 ${cell.column+1}열`;
function textExcerpt(text:string,empty:string):string {
  if(!text)return empty;
  const characters=Array.from(text.replace(/\r?\n/gu,'↵'));
  return `“${characters.slice(0,48).join('')}${characters.length>48?'…':''}”`;
}
export function describeTableLocation(table:Pick<NestedTable,'section'|'paragraph'|'control'>&Partial<Pick<NestedTable,'ancestors'>>){
  const owner=table.ancestors?` ${table.ancestors.map(step=>`${step.controlIndex+1}번 표의 ${step.cellIndex+1}번째 셀`).join(' → ')}의 중첩 표`:' 표';
  return `${table.section+1}구역 ${table.paragraph+1}문단${owner} (${table.control+1}번)`;
}
export function describeShapeFillLocation({section,paragraph,control}:Pick<NonNullable<Receipt['shapeFill']>,'section'|'paragraph'|'control'>){
  return `${section+1}구역 ${paragraph+1}문단 도형 (개체 ${control+1}번) · 채우기`;
}

function tables(structure:Structure):DisplayTable[] {
  return [...structure.tables,...(structure.nestedTables ?? [])].map(table=>{
    const fields=table.cells.map(cell=>[cell.row,cell.column,cell.rowSpan,cell.columnSpan,cell.text,
      'properties' in cell ? cell.properties : undefined,'characters' in cell ? cell.characters : undefined,
      'paragraphProperties' in cell ? cell.paragraphProperties : undefined]);
    const label=describeTableLocation(table);
    return {...table,label,datum:JSON.stringify(['ancestors' in table,dimension(table),fields,'pagination' in table?table.pagination:null,'headerRows' in table?table.headerRows:null])};
  });
}

export function describeAgentChanges(receipt:Receipt):readonly string[] {
  const previous=cached.get(receipt);
  if(previous)return previous;
  const lines=describeStructureChanges(receipt);
  cached.set(receipt,lines);
  return lines;
}

const contentOnly=<T extends {editable:boolean;reason?:string}>({editable,reason,...content}:T)=>content;
function sectionSettings(section:Structure['sections'][number]){
  return {
    '용지·여백':section.page,'다단':section.columns,'기본 탭':section.defaultTabSpacingPt,
    '머리말·꼬리말':section.headerFooters?.map(({deletable,creatable,...item})=>contentOnly(item)),
    '쪽 배경':section.pageBackgrounds?.map(({gradientEditable,...item})=>contentOnly(item)),
    '쪽 테두리 머리말·꼬리말 포함':section.pageBorderInclusion?.entries,
    '저장된 바탕쪽':section.masterPages&&{hiddenOnFirstPage:section.masterPages.hiddenOnFirstPage,pages:section.masterPages.pages.map(contentOnly)},
    '줄 번호':section.lineNumbers&&contentOnly(section.lineNumbers),
  };
}

const mm=new Intl.NumberFormat('ko-KR',{maximumFractionDigits:2});
function describePageChanges(before:Structure['sections'][number]['page'],after:Structure['sections'][number]['page']){
  const dimensions=[['width','용지 너비'],['height','용지 높이'],['marginLeft','왼쪽 여백'],['marginRight','오른쪽 여백'],
    ['marginTop','위 여백'],['marginBottom','아래 여백'],['marginHeader','머리말 여백'],['marginFooter','꼬리말 여백']] as const;
  const details=dimensions.flatMap(([key,label])=>{
    const from=before[key],to=after[key];
    return typeof from==='number'&&typeof to==='number'&&from!==to?[`${label} ${mm.format(from*25.4/7200)} → ${mm.format(to*25.4/7200)} mm`]:[];
  });
  if(typeof before.landscape==='boolean'&&typeof after.landscape==='boolean'&&before.landscape!==after.landscape){
    details.unshift(`방향 ${before.landscape?'가로':'세로'} → ${after.landscape?'가로':'세로'}`);
  }
  return details;
}
function changedSectionSettings(before:Structure['sections'][number],after:Structure['sections'][number]){
  const old=sectionSettings(before),next=sectionSettings(after);
  return Object.keys(old).filter(label=>!equal(old[label as keyof typeof old],next[label as keyof typeof next]));
}

function backgroundLabel(background:AgentPageBackground):string|undefined{
  if(background.fillType==='none')return '없음';
  if(background.fillType==='solid'&&background.color)return `단색 ${background.color}`;
  if(background.fillType==='gradient'&&background.linearGradient){
    const {colors,angle}=background.linearGradient;
    return `그러데이션 ${colors.join(' ~ ')} · ${angle}°`;
  }
}

function describeBackgroundChanges(before:Structure['sections'][number],after:Structure['sections'][number]):string[]{
  const parity={both:'기본',even:'짝수 쪽',odd:'홀수 쪽'} as const;
  const changes=(after.pageBackgrounds??[]).flatMap(next=>{
    const previous=before.pageBackgrounds?.find(item=>item.kind===next.kind);
    if(!previous)return [];
    const from=backgroundLabel(previous),to=backgroundLabel(next);
    return from&&to&&from!==to?[{kind:next.kind,text:`${from} → ${to}`}]:[];
  });
  if(changes.length===3&&changes.every(change=>change.text===changes[0].text)){
    return [`쪽 배경 (양쪽) ${changes[0].text}`];
  }
  return changes.map(change=>`쪽 배경 (${parity[change.kind]}) ${change.text}`);
}

const pageKinds={both:'양쪽 기본',even:'짝수 쪽',odd:'홀수 쪽'} as const;
type Section=Structure['sections'][number];

function describeBorderInclusionChanges(before:Section,after:Section){
  const previous=before.pageBorderInclusion?.entries,next=after.pageBorderInclusion?.entries;
  if(!previous||!next)return [];
  const changes=next.flatMap(entry=>{
    const old=previous.find(value=>value.kind===entry.kind);
    if(!old)return [];
    const details=([['headerInside','머리말'],['footerInside','꼬리말']] as const).flatMap(([flag,label])=>
      old[flag]===entry[flag]?[]:[`${label} ${old[flag]?'포함':'제외'} → ${entry[flag]?'포함':'제외'}`]);
    return details.length?[{kind:entry.kind,text:details.join(', ')}]:[];
  });
  const label='쪽 테두리 머리말·꼬리말 포함';
  if(changes.length===3&&changes.every(change=>change.text===changes[0].text))return [`${label} (양쪽) · ${changes[0].text}`];
  return changes.map(change=>`${label} (${pageKinds[change.kind]}) · ${change.text}`);
}

function describeStoredMasterChanges(before:Section,after:Section){
  if(!before.masterPages||!after.masterPages)return [];
  const previous=before.masterPages.pages,next=after.masterPages.pages;
  const changes:string[]=[];
  const excerpt=(text:string)=>textExcerpt(text,'(빈 문구)');
  for(const kind of ['both','odd','even'] as const){
    const old=previous.find(page=>page.kind===kind),page=next.find(page=>page.kind===kind);
    const label=`저장된 바탕쪽 (${pageKinds[kind]})`;
    if(!old||!page){
      const changed=page??old;
      if(changed)changes.push(`${label} ${page?'추가':'삭제'} · ${excerpt(changed.text)}`);
      continue;
    }
    const fields=[['xMm','가로 위치','mm'],['yMm','세로 위치','mm'],['fontSizePt','글자 크기','pt']] as const;
    const details=fields.flatMap(([key,name,unit])=>old[key]===page[key]?[]:[`${name} ${mm.format(old[key])} → ${mm.format(page[key])} ${unit}`]);
    if(old.text!==page.text)details.unshift(`문구 ${excerpt(old.text)} → ${excerpt(page.text)}`);
    if(old.color!==page.color)details.push(`글자색 ${old.color} → ${page.color}`);
    if(old.bold!==page.bold)details.push(`진하게 ${old.bold?'켜짐':'꺼짐'} → ${page.bold?'켜짐':'꺼짐'}`);
    if(details.length)changes.push(`${label} · ${details.join(', ')}`);
  }
  const wasHidden=before.masterPages.hiddenOnFirstPage,isHidden=after.masterPages.hiddenOnFirstPage;
  if(typeof wasHidden==='boolean'&&typeof isHidden==='boolean'&&wasHidden!==isHidden){
    changes.push(`첫 쪽 바탕쪽 ${wasHidden?'숨김':'표시'} → ${isHidden?'숨김':'표시'}`);
  }
  return changes;
}

export function describeStructureChanges(receipt:StructureChangeInput):string[] {
  const {beforeStructure:before,afterStructure:after}=receipt;
  const changes:string[]=[];
  if(receipt.shapeFill){
    const {before,after}=receipt.shapeFill;
    changes.push(`${describeShapeFillLocation(receipt.shapeFill)} ${before} → ${after}`);
  }
  if(receipt.storedCharacterStyle){
    const {section,paragraph,start,count,name}=receipt.storedCharacterStyle;
    changes.push(`${section+1}구역 ${paragraph+1}문단 · ${start+1}번째부터 ${count}자 · 글자 스타일 ${name}`);
  }
  if(receipt.metadata){
    const {before:previous,after:next}=receipt.metadata;
    const count=Object.keys(previous).filter(key=>previous[key as keyof typeof previous]!==next[key as keyof typeof next]).length;
    if(count)changes.push(`문서 요약 속성 ${count}개 변경`);
  }
  if(!before||!after)return changes;
  if(before.sections.length!==after.sections.length)changes.push(`구역 수 ${before.sections.length}개 → ${after.sections.length}개`);
  const split=receipt.sectionSplit?.sourceSection;
  const created=split!==undefined&&after.sections.length===before.sections.length+1&&before.sections[split]?split+1:undefined;
  if(created!==undefined){
    const fields=changedSectionSettings(before.sections[created-1],after.sections[created]);
    changes.push(`새 구역 ${created+1} 추가${fields.length?` · ${fields.join(', ')} 변경`:''}`);
    const page=describePageChanges(before.sections[created-1].page,after.sections[created].page);
    if(page.length)changes.push(`${created+1}구역 · ${page.join(', ')}`);
  }
  const removal=receipt.sectionRemoval;
  const removed=removal&&before.sections.length===after.sections.length+1&&before.sections[removal.removedSection]?removal.removedSection:undefined;
  if(removed!==undefined)changes.push(removal?.reason==='merge'?`${removed+1}구역을 ${removed}구역에 합침`:`빈 ${removed+1}구역 삭제`);
  for(const [index,old] of before.sections.entries()){
    if(index===removed)continue;
    const replacement=after.sections[index+(created!==undefined&&index>=created?1:0)-(removed!==undefined&&index>removed?1:0)];
    if(!replacement)continue;
    const page=describePageChanges(old.page,replacement.page);
    const background=describeBackgroundChanges(old,replacement);
    const border=describeBorderInclusionChanges(old,replacement),master=describeStoredMasterChanges(old,replacement);
    const detailBySetting={'용지·여백':page,'쪽 배경':background,'쪽 테두리 머리말·꼬리말 포함':border,'저장된 바탕쪽':master};
    const changed=changedSectionSettings(old,replacement).filter(label=>!detailBySetting[label as keyof typeof detailBySetting]?.length);
    if(changed.length)changes.push(`${replacement.index+1}구역 · ${changed.join(', ')} 변경`);
    if(page.length)changes.push(`${replacement.index+1}구역 · ${page.join(', ')}`);
    if(background.length)changes.push(`${replacement.index+1}구역 · ${background.join(', ')}`);
    for(const item of [...border,...master])changes.push(`${replacement.index+1}구역 · ${item}`);
  }
  const originals=tables(before);
  const remaining=new Map(tables(after).map(table=>[table.id,table]));
  let movedWithSection: DisplayTable | undefined;
  if (removed !== undefined && removed > 0 && removal?.reason === 'merge') {
    const fromRemovedSection = originals.filter(table => table.section === removed);
    const [original] = fromRemovedSection;
    if (fromRemovedSection.length === 1 && !('ancestors' in original)) {
      const leftParagraphs = before.paragraphs.filter(paragraph => paragraph.id.startsWith(`s${removed - 1}p`)).length;
      const target = remaining.get(`s${removed - 1}p${original.paragraph + leftParagraphs - 1}t${original.control}`);
      if (leftParagraphs > 0 && target && dimension(target) === dimension(original)
        && equal(original.cells.map(cell => cell.text), target.cells.map(cell => cell.text))) {
        movedWithSection = original;
        remaining.delete(target.id);
        changes.push(`${original.label} → ${target.label} 이동 (${dimension(target)})`);
        const previousTab = before.sections[removed].defaultTabSpacingPt;
        const inheritedTab = after.sections[removed - 1].defaultTabSpacingPt;
        if (previousTab !== undefined && inheritedTab !== undefined && previousTab !== inheritedTab) {
          changes.push(`${target.label} · 기본 탭 ${previousTab} → ${inheritedTab}pt`);
        }
      }
    }
  }
  const equalContent=new Map<string,Set<string>>();
  for(const table of remaining.values()){
    const ids=equalContent.get(table.datum)??new Set<string>();
    ids.add(table.id);equalContent.set(table.datum,ids);
  }
  // Preserve identical tables at the same address before matching moved content.
  const movedOrChanged=originals.filter(old=>{
    if (old === movedWithSection) return false;
    if(remaining.get(old.id)?.datum!==old.datum)return true;
    remaining.delete(old.id);
    equalContent.get(old.datum)?.delete(old.id);
    return false;
  });
  // An inserted body paragraph can move otherwise identical tables to new native IDs.
  const changed:DisplayTable[]=[];
  for(const old of movedOrChanged){
    const matches=equalContent.get(old.datum);
    const identical=matches?.values().next().value;
    if(identical){remaining.delete(identical);matches?.delete(identical);}
    else changed.push(old);
  }
  for(const old of changed){
    const replacement=remaining.get(old.id);
    if(!replacement){changes.push(`${old.label} 삭제 (${dimension(old)})`);continue;}
    remaining.delete(old.id);
    if(old.rows!==replacement.rows||old.columns!==replacement.columns){changes.push(`${old.label} 크기 ${dimension(old)} → ${dimension(replacement)}`);continue;}
    const byAddress=new Map(replacement.cells.map(cell=>[`${cell.row}/${cell.column}`,cell]));
    const texts=old.cells.flatMap(cell=>{
      const next=byAddress.get(`${cell.row}/${cell.column}`);
      return next&&cell.text!==next.text?[{before:cell,after:next}]:[];
    });
    const positions=texts.slice(0,4).map(({before})=>cellAddress(before));
    const details=texts.length?[`내용 ${texts.length}셀 · ${positions.join(', ')}`]:[];
    for(const [axis,label] of [['width','저장 너비'],['height','저장 높이']] as const){
      const count=old.cells.filter(cell=>{
        const next=byAddress.get(`${cell.row}/${cell.column}`);
        if(!next||!('properties' in cell)||!('properties' in next))return false;
        return typeof cell.properties[axis]==='number'&&typeof next.properties[axis]==='number'&&cell.properties[axis]!==next.properties[axis];
      }).length;
      if(count)details.push(`${label} ${count}셀`);
    }
    if('headerRows' in old&&'headerRows' in replacement&&old.headerRows!==replacement.headerRows)details.push('제목 행');
    if('pagination' in old&&'pagination' in replacement&&!equal(old.pagination,replacement.pagination))details.push('쪽 나눔·제목 반복');
    const spans=old.cells.filter(cell=>{
      const next=byAddress.get(`${cell.row}/${cell.column}`);
      return !next||next.rowSpan!==cell.rowSpan||next.columnSpan!==cell.columnSpan;
    }).length;
    if(spans)details.push(`셀 합치기·나누기 ${spans}셀`);
    changes.push(`${replacement.label} (${dimension(replacement)}) · ${details.join(', ')||'셀 서식'} 변경`);
    for(const {before,after} of texts.slice(0,4))changes.push(`${replacement.label} · ${cellAddress(after)} ${textExcerpt(before.text,'(빈 셀)')} → ${textExcerpt(after.text,'(빈 셀)')}`);
  }
  for(const table of remaining.values())changes.push(`${table.label} 추가 (${dimension(table)})`);
  if(!equal(before.unsupportedControls,after.unsupportedControls))changes.push('문서에서 읽을 수 있는 개체 종류 목록 변경');
  if(receipt.before!==undefined&&receipt.before===receipt.after&&created===undefined&&removed===undefined){
    const old=new Map(before.paragraphs.map(item=>[item.id,item]));
    const formats=after.paragraphs.filter(item=>{
      const previous=old.get(item.id);
      return previous&&(!equal(previous.characters,item.characters)||!equal(previous.paragraph,item.paragraph)||!equal(previous.style,item.style));
    }).length;
    if(formats)changes.push(`본문 문단 ${formats}개의 글자·문단 모양 변경`);
  }
  return changes.length>16?[...changes.slice(0,16),`다른 구조 변경 ${changes.length-16}건`]:changes;
}

/** Excerpts use the engine receipt, never the model's proposed changes. */
export function showBodyChangeExcerpt(element: HTMLElement, receipt: Receipt): void {
  element.replaceChildren();
  if (receipt.before === receipt.after) { element.hidden=true; return; }
  const before=receipt.before.split('\n'), after=receipt.after.split('\n');
  let start=0, oldEnd=before.length, newEnd=after.length;
  while(start<oldEnd && start<newEnd && before[start]===after[start]) start++;
  while(oldEnd>start && newEnd>start && before[oldEnd-1]===after[newEnd-1]) {oldEnd--;newEnd--;}
  const create=(kind:'del'|'ins',lines:string[],end:number)=>{
    if(end===start)return;
    const value=document.createElement(kind);
    value.style.cssText='display:block;white-space:pre-wrap;overflow-wrap:anywhere';
    value.textContent=lines.slice(start,Math.min(start+6,end)).join('\n').slice(0,700)+(end-start>6?'\n…':'');
    element.append(value);
  };
  const summary=document.createElement('p');summary.textContent=`본문 ${start+1}행부터 바뀐 부분`;
  element.append(summary);create('del',before,oldEnd);create('ins',after,newEnd);element.hidden=false;
}
