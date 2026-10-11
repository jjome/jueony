import type { Structure,DocumentProperties } from '../public/types.ts';
const numeric = (value:unknown):number => typeof value==='number'?value:Number.NaN;
const mm = (v: unknown) => Math.round(numeric(v) * 25.4 / 7200 * 10) / 10;
const alignments:Record<string,string>={left:'왼쪽',right:'오른쪽',center:'가운데',justify:'양쪽',distribute:'배분'};
const character = (p: DocumentProperties) => `${p.fontFamily ?? ''} ${numeric(p.fontSize ?? 0) / 100}pt${p.bold ? ' 굵게' : ''}${p.italic ? ' 기울임' : ''}${p.underline ? ' 밑줄' : ''}${p.strikethrough ? ' 취소선' : ''} ${p.textColor ?? ''}`;
const paragraph = (p: DocumentProperties) => `${(typeof p.alignment==='string'?alignments[p.alignment]:undefined) ?? p.alignment} 정렬 · 줄 간격 ${p.lineSpacing} · 왼쪽/오른쪽 여백 ${mm(p.marginLeft ?? 0)}/${mm(p.marginRight ?? 0)}mm · 들여쓰기 ${mm(p.indent ?? 0)}mm · 앞/뒤 간격 ${mm(p.spacingBefore ?? 0)}/${mm(p.spacingAfter ?? 0)}mm`;
export function describeStructure(s?: Structure) {
 if (!s) return '이전 기록에는 구조 정보가 없습니다.';
 const lines = s.sections.map(({ index, page: p }) => `구역 ${index + 1}: ${mm(p.width)}×${mm(p.height)}mm ${p.landscape ? '가로' : '세로'} · 여백 좌/우/위/아래 ${mm(p.marginLeft)}/${mm(p.marginRight)}/${mm(p.marginTop)}/${mm(p.marginBottom)}mm`);
 s.paragraphs.forEach((p, i) => lines.push(`본문 문단 ${i + 1}: ${character(p.characters)} · ${paragraph(p.paragraph)}`));
 if (!s.tables.length) lines.push('표 없음');
 s.tables.forEach((t, i) => {
   lines.push(`표 ${i + 1}: ${t.rows}행 × ${t.columns}열`);
   for (const c of t.cells) lines.push(`  ${c.row + 1}행 ${c.column + 1}열: ${c.text} · 배경 ${c.properties.fillType === 'none' ? '없음' : c.properties.fillColor}${c.characters ? ' · ' + character(c.characters) : ''}${c.paragraphProperties ? ' · ' + paragraph(c.paragraphProperties) : ''}`);
 });
 return lines.join('\n');
}
