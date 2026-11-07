import type {Snapshot,AgentCellParagraphOp} from '../public/types.ts';
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
 if(!op||op.kind!=='replace_cell_paragraph'||Object.keys(op).some(k=>!['kind','target','row','column','paragraph','originalText','text'].includes(k)))throw new Error('지원하지 않는 셀 문단 명령입니다.');
 if(![op.row,op.column,op.paragraph].every(v=>Number.isSafeInteger(v)&&v>=0)||!plain(op.originalText)||!plain(op.text)||op.originalText===op.text)throw new Error('셀 문단은 정확한 좌표·원문과 제어문자 없는 다른 교체문이 필요합니다.');
 const table=s.structure?.tables.find(t=>t.id===op.target),source=s.cellParagraphSources?.[op.target];
 if(!/\.hwpx$/iu.test(s.name)||!/^s\d+p\d+t\d+$/u.test(op.target)||!table||table.editable!==true||source?.editable!==true||!/^[a-f0-9]{64}$/u.test(source.fingerprint??''))throw new Error('조회된 HWPX 병합 셀 문단이 필요합니다.');
 const cell=source.cells?.find(c=>c.row===op.row&&c.column===op.column),actual=table.cells.find(c=>c.row===op.row&&c.column===op.column),paragraph=cell?.paragraphs.find(p=>p.index===op.paragraph);
 if(!cell||!actual||cell.index!==actual.index||cell.rowSpan!==actual.rowSpan||cell.columnSpan!==actual.columnSpan||cell.rowSpan*cell.columnSpan<2||actual.properties.cellProtect!==false||!paragraph||paragraph.text!==op.originalText)throw new Error('병합 주 셀의 해당 문단 원문과 위치를 다시 확인하세요.');
 return {table,cell,paragraph,splice:paragraphSplice(op.originalText,op.text,paragraph.formatSpans)};
}
