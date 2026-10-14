import type { Structure,DocumentProperties } from '../public/types.ts';
const numeric = (value:unknown):number => typeof value==='number'?value:Number.NaN;
const mm = (v: unknown) => Math.round(numeric(v) * 25.4 / 7200 * 10) / 10;
const alignments:Record<string,string>={left:'왼쪽',right:'오른쪽',center:'가운데',justify:'양쪽',distribute:'배분'};
const character = (p: DocumentProperties) => `${p.fontFamily ?? ''} ${numeric(p.fontSize ?? 0) / 100}pt${p.bold ? ' 굵게' : ''}${p.italic ? ' 기울임' : ''}${p.underline ? ' 밑줄' : ''}${p.strikethrough ? ' 취소선' : ''} ${p.textColor ?? ''}`;
const paragraph = (p: DocumentProperties) => `${(typeof p.alignment==='string'?alignments[p.alignment]:undefined) ?? p.alignment} 정렬 · 줄 간격 ${p.lineSpacing} · 왼쪽/오른쪽 여백 ${mm(p.marginLeft ?? 0)}/${mm(p.marginRight ?? 0)}mm · 들여쓰기 ${mm(p.indent ?? 0)}mm · 앞/뒤 간격 ${mm(p.spacingBefore ?? 0)}/${mm(p.spacingAfter ?? 0)}mm`;
export function describeStructure(s?: Structure) {
 if (!s) return '이전 기록에는 구조 정보가 없습니다.';
 const capability = s.sectionMergeAvailable===true?'엔진 지원 있음; 두 일반 본문 구역의 추가 원본 검사 필요':'지원 없음';
 const lines = s.sections.map(({ index, page: p }) => `구역 ${index + 1}: ${mm(p.width)}×${mm(p.height)}mm ${p.landscape ? '가로' : '세로'} · 여백 좌/우/위/아래 ${mm(p.marginLeft)}/${mm(p.marginRight)}/${mm(p.marginTop)}/${mm(p.marginBottom)}mm`);
 lines.push(`AI 구역 합치기: ${capability} · 뒤 구역 설정은 앞 구역 설정을 따릅니다.`);
 s.sections.forEach(s=>{if(s.columns)lines.push(`구역 ${s.index+1} 단 설정: ${JSON.stringify(s.columns)}`);});
 s.sections.forEach(s=>{if(s.headerFooters){
  lines.push(`구역 ${s.index+1} 저장된 머리말/꼬리말 (상속되어 보이는 내용과 구분):`);
  for(const h of s.headerFooters){
   const label=`${{both:'양쪽',odd:'홀수 쪽',even:'짝수 쪽'}[h.pageKind]} ${h.story==='header'?'머리말':'꼬리말'}`;
   if(h.exists===false){lines.push(`  ${label}: 저장된 정의 없음${h.creatable?' · 새 정의 생성 가능':''}`);continue;}
   if(h.exists===null){lines.push(`  ${label}: 조회하지 못함 · 원본 유지`);continue;}
   const chars=Array.from(h.text),preview=JSON.stringify(chars.slice(0,240).join(''));
   if(h.paragraph)lines.push(`  ${label} 문단: ${alignments[h.paragraph.alignment]??h.paragraph.alignment} 정렬 · 줄 간격 ${h.paragraph.lineSpacing}${h.paragraph.lineSpacingType==='Percent'?'%':' ('+h.paragraph.lineSpacingType+')'}`);
   if(h.characters)lines.push(`  ${label} 글자: ${h.characters.fontSizePt}pt · ${h.characters.color}${h.characters.bold?' · 굵게':''}${h.characters.italic?' · 기울임':''}${h.characters.underline?' · 밑줄':''}`);
   lines.push(`  ${label}: ${preview}${chars.length>240||h.textTruncated?' … (미리보기)':''} · ${h.editable?'텍스트 수정 가능':'읽기 전용'}${h.deletable?' · 저장 정의 삭제 가능':''}${h.hiddenOnFirstPage?' · 첫 쪽 감춤':''}${h.paragraphCount!==1?' · '+h.paragraphCount+'문단':''}`);
  }
 }if(s.emptySectionRemoval)lines.push(`구역 ${s.index+1} 빈 본문 구역 삭제 가능성: ${JSON.stringify(s.emptySectionRemoval)}`);if(s.defaultTabSpacingPt!==undefined)lines.push(`구역 ${s.index+1} 기본 탭: ${s.defaultTabSpacingPt}pt`);if(s.lineNumbers)lines.push(`구역 ${s.index+1} 줄 번호(HWPX): ${JSON.stringify(s.lineNumbers)}`);if(s.pageBackgrounds)lines.push(`구역 ${s.index+1} 쪽 배경: ${JSON.stringify(s.pageBackgrounds)}`);if(s.masterPages)lines.push(`구역 ${s.index+1} 저장된 바탕쪽(앞 구역 상속과 별도): ${JSON.stringify(s.masterPages)}`);});
 s.paragraphs.forEach((p, i) => lines.push(`본문 문단 ${i + 1}: ${character(p.characters)} · ${paragraph(p.paragraph)}${p.style?' · 스타일 '+JSON.stringify(p.style):''}${p.pageHide?.exists?' · 감추기 '+JSON.stringify(p.pageHide):''}`));
 s.paragraphs.forEach((p,i)=>{if(Array.isArray(p.paragraph.tabStops))lines.push(`본문 문단 ${i+1} 사용자 탭: ${JSON.stringify(p.paragraph.tabStops.map((t:any)=>({positionMm:Math.round(t.position*25.4/7200*1000)/1000,alignment:['left','right','center','decimal'][t.type]??t.type,leader:['none','solid','dash','dot'][t.fill]??t.fill})))} · 왼쪽/오른쪽 자동 탭 ${p.paragraph.tabAutoLeft}/${p.paragraph.tabAutoRight}`);});
 s.paragraphs.forEach((p,i)=>{const v=p.paragraph;if(v.fillType!==undefined)lines.push(`본문 문단 ${i+1} 테두리/배경: ${['borderLeft','borderRight','borderTop','borderBottom'].map(k=>k+':'+JSON.stringify(v[k])).join(' · ')} · 배경 ${v.fillType==='none'?'없음':v.fillColor} · 좌/우/위/아래 간격 ${Array.isArray(v.borderSpacing)?v.borderSpacing.map(mm).join('/'):''}mm · 연결 ${v.borderConnect} · 여백 무시 ${v.borderIgnoreMargin}`);});
 s.paragraphs.forEach((p,i)=>lines.push(`본문 문단 ${i+1} 번호: ${p.paragraph.headType} · 정의 ${p.paragraph.numberingId} · 수준 ${Number(p.paragraph.paraLevel??0)+1}`));
 if(s.bookmarks){lines.push(`AI 책갈피: ${s.bookmarks.editable?'일반 본문 점 책갈피 편집 가능':s.bookmarks.reason??'읽기 전용'}`);for(const b of s.bookmarks.items)lines.push(`책갈피 ${JSON.stringify(b.name)}: ${b.target??'위치 지원 범위 밖'}${b.offset!==null?' · Unicode 글자 위치 '+b.offset:''} · ${b.editable?'이름 변경/삭제 가능':'읽기 전용'}`);if(s.bookmarks.editable&&!s.bookmarks.items.length)lines.push('책갈피 없음');}
 if(s.styles)lines.push('문서 스타일 목록 ('+s.styles.length+'개): '+s.styles.map(v=>{const link=s.styleLinks?.find(l=>l.id===v.id),next=s.styles?.find(n=>n.id===link?.nextStyleId);return v.name+' ('+(v.type===0?'문단':'글자')+')'+(v.type===0&&link?' · Enter 후 '+(next?.name??'없는 다음 스타일'): '');}).join('\n'));
 if (!s.tables.length) lines.push('표 없음');
 s.tables.forEach((t, i) => {
   if(t.pagination)lines.push(`표 ${i+1} 쪽 나눔: ${{none:'나누지 않기',cell:'셀 안에서 나눔',row:'행 사이에서 나눔'}[t.pagination.mode]} · 제목 행 반복 ${t.pagination.repeatHeader?'켜짐':'꺼짐'} (반복 설정 변경은 미지원)`);
   lines.push(`표 ${i + 1}: ${t.rows}행 × ${t.columns}열`);
   for (const c of t.cells) lines.push(`  ${c.row + 1}행 ${c.column + 1}열: ${c.text} · 배경 ${c.properties.fillType === 'none' ? '없음' : c.properties.fillColor}${c.characters ? ' · ' + character(c.characters) : ''}${c.paragraphProperties ? ' · ' + paragraph(c.paragraphProperties) : ''}`);
 });
 return lines.join('\n');
}
