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
/** Repeated text permits several minimal deletions. Every candidate must
 * preserve the same style owner, picture region and UTF-16 slot displacement. */
function repeatedPictureDeletion(op:AgentCellParagraphOp,paragraph:CellParagraphText){
 if(op.spanTexts!==undefined || op.spanFormats!==undefined || !paragraph.pictureTextRanges?.length)return;
 const a=Array.from(op.originalText),b=Array.from(op.text),remove=a.length-b.length;
 if(remove<=0)return;
 let prefix=0,suffix=0;
 while(prefix<b.length && a[prefix]===b[prefix])prefix++;
 while(suffix<b.length && a[a.length-1-suffix]===b[b.length-1-suffix])suffix++;
 if(prefix+suffix<=b.length)return;
 // For every start in this inclusive interval, the retained prefix and
 // suffix reconstruct the exact replacement. Keep all possible owners.
 const first=b.length-suffix,last=prefix,end=last+remove;
 const spans=paragraph.formatSpans??[{start:0,end:a.length}];
 if(paragraph.formatSpans && spans.length<2)return;
 if(spans.some((r,i)=>!Number.isSafeInteger(r.start)||!Number.isSafeInteger(r.end)||
    r.start!==(i?spans[i-1].end:0)||r.end<=r.start) || spans.at(-1)?.end!==a.length)return;
 const run=spans.findIndex(r=>r.start<=first && end<=r.end);
 if(run<0 || !paragraph.pictureTextRanges.some(r=>Number.isSafeInteger(r.start)&&Number.isSafeInteger(r.end)&&
    r.start>=0 && r.end<=(paragraph.editableFrom??0) && r.start<=first && end<=r.end))return;
 const units=[0];
 for(const char of a)units.push(units.at(-1)!+char.length);
 const removedUnits=units[first+remove]-units[first];
 for(let start=first+1;start<=last;start++)
  if(units[start+remove]-units[start]!==removedUnits)return;
 return {run,start:first,remove,insert:''};
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
 const repeated=repeatedPictureDeletion(op,paragraph);
 let edits=op.originalText===op.text?[]:repeated?[repeated]:paragraphEdits(op,paragraph);
 let pictureEdit:typeof edits[number]|undefined=repeated;
 if(paragraph.editableFrom!==undefined){
  const boundary=paragraph.editableFrom,original=Array.from(op.originalText);
  if(!Number.isSafeInteger(boundary)||boundary<1||boundary>original.length)throw Error('필드 또는 그림 뒤의 일반 텍스트 위치를 확인하세요.');
  edits=edits.map(edit=>{
   if(edit===repeated)return edit;
   if(edit.start>=boundary)return edit;
   // Keep every character through the field end and the following boundary.
   const keep=boundary-edit.start,insert=Array.from(edit.insert);
   if(paragraph.pictureTextRanges?.length && !op.spanFormats && edits.length===1){
    // Remove equal leading/trailing characters from the native mutation. A
    // repeated suffix/prefix must not leave multiple possible picture owners.
    const removed=original.slice(edit.start,edit.start+edit.remove),limit=Math.min(removed.length,insert.length);
    let left=0,right=0;
    while(left<limit && removed[left]===insert[left])left++;
    while(right<limit && removed[removed.length-1-right]===insert[insert.length-1-right])right++;
    const start=edit.start+left,end=edit.start+edit.remove-right;
    if(left+right<=limit && paragraph.pictureTextRanges.some(r=>Number.isSafeInteger(r.start)&&Number.isSafeInteger(r.end)&&
        r.start>=0 && r.end<=boundary && r.start<=start && end<=r.end)){
     pictureEdit={...edit,start,remove:end-start,insert:insert.slice(left,insert.length-right).join('')};
     return pictureEdit;
    }
   }
   if(keep>edit.remove||keep>insert.length||original.slice(edit.start,boundary).join('')!==insert.slice(0,keep).join(''))
    throw Error('필드·그림과 경계 문자는 유지하고 뒤의 일반 텍스트만 바꿀 수 있습니다.');
   return {...edit,start:boundary,remove:edit.remove-keep,insert:insert.slice(keep).join('')};
  });
 }
 return {table,cell,paragraph,edits,pictureEdit};
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
