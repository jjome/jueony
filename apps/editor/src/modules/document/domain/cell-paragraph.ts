import type {Snapshot,AgentCellParagraphOp,CellParagraphText} from '../public/types.ts';
const plain=(v:unknown):v is string=>typeof v==='string'&&Array.from(v).length<=4000&&!/[\x00-\x1f\x7f]/u.test(v);

/** Unicode offsets in both texts. Preserve the runs to either side of the edit. */
function paragraphSplice(original:string,replacement:string,spans?:Array<{start:number;end:number}>) {
 const a=Array.from(original),b=Array.from(replacement);
 if (!spans) return {run:0,start:0,remove:a.length,insert:replacement};
 const refuse=()=>{throw Error('혼합 글자 서식 문단은 위치가 명확한 한 서식 범위 안에서만 바꿀 수 있습니다.');};
 let boundary=0;
 for (const {start,end} of spans) {
   if (!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start!==boundary||end<=start||end>a.length) refuse();
   boundary=end;
 }
 if (boundary!==a.length || spans.length<2) refuse();
 let prefix=0,suffix=0;
 const limit=Math.min(a.length,b.length);
 while (prefix<limit && a[prefix]===b[prefix]) prefix++;
 while (suffix<limit && a[a.length-1-suffix]===b[b.length-1-suffix]) suffix++;
 // Repeated characters can give the same new text for several edit positions.
 if (prefix+suffix>limit) refuse();
 const end=a.length-suffix,start=prefix,insert=b.slice(start,b.length-suffix).join('');
 const choices=spans.flatMap((span,i)=>span.start<=start && end<=span.end ? [i] : []);
 if (choices.length!==1) refuse(); // An insertion on a style boundary has two owners.
 const run=choices[0];
 if (!insert.length && start===spans[run].start && end===spans[run].end) refuse();
 return {run,start,remove:end-start,insert};
}
export function cellParagraphPlan(op:AgentCellParagraphOp,s:Snapshot){
 if(!op||op.kind!=='replace_cell_paragraph'||Object.keys(op).some(k=>!['kind','target','row','column','paragraph','originalText','text','spanTexts','spanFormats'].includes(k)))throw new Error('지원하지 않는 셀 문단 명령입니다.');
 if(![op.row,op.column,op.paragraph].every(v=>Number.isSafeInteger(v)&&v>=0)||!plain(op.originalText)||!plain(op.text)||
    (op.originalText===op.text&&(op.spanFormats===undefined||op.spanTexts!==undefined)))throw new Error('셀 문단은 정확한 좌표·원문과 다른 교체문 또는 새 서식이 필요합니다.');
 const table=s.structure?.tables.find(t=>t.id===op.target),source=s.cellParagraphSources?.[op.target];
 if(!/\.hwpx?$/iu.test(s.name)||!/^s\d+p\d+t\d+$/u.test(op.target)||!table||table.editable!==true||source?.editable!==true||!/^[a-f0-9]{64}$/u.test(source.fingerprint??''))throw new Error('조회된 HWP/HWPX 병합 셀 문단이 필요합니다.');
 const cell=source.cells?.find(c=>c.row===op.row&&c.column===op.column),actual=table.cells.find(c=>c.row===op.row&&c.column===op.column),paragraph=cell?.paragraphs.find(p=>p.index===op.paragraph);
 if(!cell||!actual||cell.index!==actual.index||cell.rowSpan!==actual.rowSpan||cell.columnSpan!==actual.columnSpan||cell.rowSpan*cell.columnSpan<2||actual.properties.cellProtect!==false||!paragraph||paragraph.text!==op.originalText)throw new Error('병합 주 셀의 해당 문단 원문과 위치를 다시 확인하세요.');
 if(op.spanFormats!==undefined){
  const length=Array.from(op.text).length;
  if(!Array.isArray(op.spanFormats)||!op.spanFormats.length||op.spanFormats.length>32)throw Error('새 글자 서식은 1~32개 구간으로 지정하세요.');
  let previous=0;
  for(const format of op.spanFormats){
   if(!format||typeof format!=='object'||Array.isArray(format)||!Number.isSafeInteger(format.start)||!Number.isSafeInteger(format.end)||
      format.start<previous||format.end<=format.start||format.end>length)throw Error('교체 후 문단의 겹치지 않는 글자 위치를 순서대로 지정하세요.');
   if(format.start<(paragraph.editableFrom??0) && !(op.originalText===op.text &&
      paragraph.formatOnlyRanges?.some(r=>Number.isSafeInteger(r.start) && Number.isSafeInteger(r.end) &&
       r.start>=0 && r.end<=paragraph.editableFrom! && r.start<=format.start && format.end<=r.end)))
    throw Error('그림·필드 경계에서 떨어진 원래 글자 구간에만 서식을 지정하세요.');
   const keys=Object.keys(format).filter(k=>k!=='start'&&k!=='end');
   if(!keys.length||keys.some(k=>!['bold','italic','color','fontSizePt'].includes(k))||
      ('bold'in format&&typeof format.bold!=='boolean')||('italic'in format&&typeof format.italic!=='boolean')||
      ('color'in format&&(typeof format.color!=='string'||!/^#[a-f0-9]{6}$/iu.test(format.color)))||
      ('fontSizePt'in format&&(typeof format.fontSizePt!=='number'||!Number.isFinite(format.fontSizePt)||format.fontSizePt<1||format.fontSizePt>200)))
    throw Error('글자 서식은 굵게·기울임·글자색·1~200pt 크기로 지정하세요.');
   previous=format.end;
  }
 }
 let edits=op.originalText===op.text?[]:paragraphEdits(op,paragraph);
 if(paragraph.editableFrom!==undefined){
  const boundary=paragraph.editableFrom,original=Array.from(op.originalText);
  if(!Number.isSafeInteger(boundary)||boundary<1||boundary>original.length)throw Error('필드 또는 그림 뒤의 일반 텍스트 위치를 확인하세요.');
  edits=edits.map(edit=>{
   if(edit.start>=boundary)return edit;
   // Keep every character through the field end and the following boundary.
   const keep=boundary-edit.start,insert=Array.from(edit.insert);
   if(keep>edit.remove||keep>insert.length||original.slice(edit.start,boundary).join('')!==insert.slice(0,keep).join(''))
    throw Error('필드·그림과 경계 문자는 유지하고 뒤의 일반 텍스트만 바꿀 수 있습니다.');
   return {...edit,start:boundary,remove:edit.remove-keep,insert:insert.slice(keep).join('')};
  });
 }
 return {table,cell,paragraph,edits};
}
export function paragraphEdits(op:Pick<AgentCellParagraphOp,'originalText'|'text'|'spanTexts'>,paragraph:CellParagraphText){
 const spans=paragraph.formatSpans;
 if(op.spanTexts===undefined)return [paragraphSplice(op.originalText,op.text,spans)];
 const parts=op.spanTexts;
 if(!Array.isArray(parts)||!spans||spans.length<2||spans.length>128||parts.length!==spans.length||
    parts.some(part=>!plain(part))||parts.join('')!==op.text)throw Error('기존 글자 서식 구간 순서대로 교체문을 지정하세요. 지울 구간에는 빈 문자열을 넣으세요.');
 const original=Array.from(op.originalText);
 const edits=spans.flatMap(({start,end},run)=>{
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start!==(run?spans[run-1].end:0)||end<=start||end>original.length)
   throw Error('원래 서식 구간이 변경되었습니다.');
  return original.slice(start,end).join('')===parts[run]?[]:[{run,start,remove:end-start,insert:parts[run]}];
 });
 if(spans.at(-1)?.end!==original.length||!edits.length)throw Error('전체 서식 구간과 원문을 확인하세요.');
 return edits;
}
