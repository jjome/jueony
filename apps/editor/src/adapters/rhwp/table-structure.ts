import {sha256} from '@noble/hashes/sha2.js';
import type {Table,AgentTableStructureOp,AgentTableStructureSource,Snapshot as TableStructureSnapshot} from '../../modules/document/public/index.ts';
import {tableStructurePlan} from '../../modules/document/public/engine-integration.ts';
import {nativeDocument,parsed,readStructure} from './structure.ts';
import {capturePreservationEvidence,verifyPreservedExport} from './preservation.ts';
import {assertNativeTableWritable} from './table-write-guard.ts';
import {tableLayoutEvidence,sameTableLayout} from './table-layout-evidence.ts';
import {topologySemantics,rootBodyTexts,tableTextTree} from './table-topology-evidence.ts';
const canonical=(v:any):any=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const same=(a:any,b:any)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const hash=(v:any)=>Array.from(sha256(new TextEncoder().encode(JSON.stringify(canonical(v)))),n=>n.toString(16).padStart(2,'0')).join('');
const height=(t:Table)=>t.cells.filter(c=>c.column===0).reduce((n,c)=>n+Number(c.properties.height),0);
const flat=(d:any,t:Table)=>t.paragraph+Array.from({length:t.section},(_,s)=>d.getParagraphCount(s)).reduce((a:number,b:number)=>a+b,0);
function plain(d:any,t:Table,controls:any[],values:any){
 const p=parsed(d.getTableProperties(t.section,t.paragraph,t.control)),cols=parsed(d.getColumnDef(t.section)),control=controls.find(c=>c.ctrlId==='tbl'&&c.list===0&&c.para===flat(d,t)&&c.controlIndex===t.control),root=values[`section/${t.section}/paragraph/${t.paragraph}`];
 assertNativeTableWritable(d,t);
 if(!root||root.text!==''||root.style.id!==0||root.pageHide.exists||root.storedNumberingRestart!==null||root.paragraph.headType!=='None'||root.paragraph.pageBreakBefore||root.paragraph.keepWithNext||t.control!==0||controls.filter(c=>c.list===0&&c.para===flat(d,t)).some(c=>c.ctrlId!=='tbl')||control?.props?.Lock!==0||cols.columnCount!==1||p.hasCaption||p.treatAsChar||p.allowOverlap||p.repeatHeader||p.pageBreak!==0||p.cellSpacing!==0||p.textWrap!=='TopAndBottom'||p.vertRelTo!=='Para'||p.vertAlign!=='Top'||!['Para','Column'].includes(p.horzRelTo)||p.horzAlign!=='Left'||p.vertOffset!==0||p.horzOffset!==0||p.tableHeight!==height(t)||t.rows*t.columns>200||t.cells.length!==t.rows*t.columns||t.cells.some((c,i)=>!c.editable||c.rowSpan!==1||c.columnSpan!==1||c.row!==Math.floor(i/t.columns)||c.column!==i%t.columns||c.index!==i||c.properties.textDirection!==0||c.properties.isHeader!==false||!Number.isSafeInteger(c.properties.width)||Number(c.properties.width)<200||!Number.isSafeInteger(c.properties.height)||Number(c.properties.height)<200||c.properties.width!==t.cells[c.column].properties.width||c.properties.height!==t.cells[c.row*t.columns].properties.height)||p.tableWidth!==t.cells.slice(0,t.columns).reduce((a,c)=>a+Number(c.properties.width),0))throw new Error('unsupported');
 const frames=Array.from({length:d.pageCount()},(_,page)=>parsed(d.getPageControlLayout(page)).controls.filter((c:any)=>c.type==='table'&&c.secIdx===t.section&&c.paraIdx===t.paragraph&&c.controlIdx===t.control)).flat();if(frames.length!==1||frames[0].cells.length!==t.cells.length)throw new Error('unsupported');
 return p;
}
export function readTableStructureSources(wasm:any,tables:Table[],name:string):Record<string,AgentTableStructureSource>|undefined{
 const d=nativeDocument(wasm);if(typeof d.splitTable!=='function'||typeof d.mergeTableWithNext!=='function')return;
 const e=capturePreservationEvidence(d),controls=parsed(d.getControls()),lists=parsed(d.getCursorModel()).lists;
 return Object.fromEntries(tables.map(t=>{try{
  if(!/\.hwpx$/iu.test(name)||e.issues.length||controls.some((c:any)=>c.list!==0||!['secd','cold','tbl'].includes(c.ctrlId))||lists.some((l:any)=>!l.isCell||l.hostListId!==0)||parsed(d.getFieldList()).length||parsed(d.getBookmarks()).length)throw new Error('unsupported');
  const p=plain(d,t,controls,e.values),source:AgentTableStructureSource={editable:true,fingerprint:hash({table:t,preservation:e.values}),splitRows:Array.from({length:t.rows-1},(_,i)=>i+1)};
  const next=tables.find(v=>v.section===t.section&&v.paragraph>t.paragraph);if(next){try{
   const q=plain(d,next,controls,e.values),{tableHeight:ph,...pp}=p,{tableHeight:qh,...qq}=q;
   if(!same(pp,qq)||next.columns!==t.columns||(next.rows+t.rows)*t.columns>200||t.cells.slice(0,t.columns).some((c,i)=>c.properties.width!==next.cells[i].properties.width))throw new Error('different tables');
   for(let para=t.paragraph+1;para<=next.paragraph;para++){const rp=e.values[`section/${t.section}/paragraph/${para}`] as any;if(!rp||rp.text!==''||rp.pageHide.exists||rp.paragraph.pageBreakBefore||rp.paragraph.headType!=='None'||rp.storedNumberingRestart!==null)throw new Error('content between tables');}
   source.nextTarget=next.id;
  }catch{/* A valid split source does not imply that its next table can be attached. */}}
  return [t.id,source];
 }catch{return [t.id,{editable:false,reason:'AI 표 나누기/붙이기는 HWPX의 비보호 단일 쪽 평면 격자와 빈 표 host를 지원합니다. 병합·중첩·혼합 서식·캡션·제목 행·필드·책갈피·복합 배치는 제외합니다.'}];}}));
}
/** Explicitly transform only the addresses and dimensions changed by the native command. */
function expectedEvidence(d:any,base:TableStructureSnapshot,op:AgentTableStructureOp){
 const plan=tableStructurePlan(op,base),t=plan.table,values=topologySemantics(capturePreservationEvidence(d).values),hostFlat=flat(d,t),split=op.kind==='split_table',next=plan.next!,cut=split?(op as Extract<AgentTableStructureOp,{kind:'split_table'}>).atRow:0,nextFlat=split?hostFlat+2:flat(d,next),delta=split?2:-plan.removed;
 const moved=(p:number)=>split?p>hostFlat?p+2:p:p>nextFlat?p+delta:p;
 const local=(p:number)=>split?p>t.paragraph?p+2:p:p>next.paragraph?p+delta:p;
 const pkey=`section/${t.section}/paragraph/`,oldCount=values[`section/${t.section}/paragraph-count`],roots=Array.from({length:oldCount},(_,p)=>structuredClone(values[pkey+p]));for(let p=0;p<oldCount;p++)delete values[pkey+p];
 if(split){const skeleton=structuredClone(roots[t.paragraph]);roots.splice(t.paragraph+1,0,structuredClone(skeleton),skeleton);}else roots.splice(t.paragraph+1,plan.removed);
 values[`section/${t.section}/paragraph-count`]=roots.length;roots.forEach((v,p)=>values[pkey+p]=v);
 const frontHeight=height(plan.front),backHeight=split?height(next):0;
 const targetControl=values.controls.find((c:any)=>c.ctrlId==='tbl'&&c.para===hostFlat),targetObject=values.objects.find((c:any)=>c.object.kind==='table'&&c.object.para===hostFlat);
 if(!targetControl||!targetObject)throw new Error('표 구조 보존 정보가 없습니다.');
 const backControl=structuredClone(targetControl),backObject=structuredClone(targetObject);
 values.controls=values.controls.filter((c:any)=>split||!(c.ctrlId==='tbl'&&c.para===nextFlat)).map((c:any)=>({...c,para:moved(c.para)}));values.objects=values.objects.filter((c:any)=>split||!(c.object.kind==='table'&&c.object.para===nextFlat)).map((c:any)=>({...c,object:{...c.object,para:moved(c.object.para)}}));
 const frontControl=values.controls.find((c:any)=>c.ctrlId==='tbl'&&c.para===hostFlat),frontObject=values.objects.find((c:any)=>c.object.kind==='table'&&c.object.para===hostFlat);frontControl.props.Height=frontHeight;frontObject.properties.tableHeight=frontHeight;
 if(split){backControl.para=nextFlat;backControl.props.Height=backHeight;backObject.object.para=nextFlat;backObject.object.controlIndex=0;backObject.properties.tableHeight=backHeight;values.controls.splice(values.controls.indexOf(frontControl)+1,0,backControl);values.objects.splice(values.objects.indexOf(frontObject)+1,0,backObject);}
 const targetCells=values.cells.filter((c:any)=>c.list.sectionIndex===t.section&&c.list.hostPara===t.paragraph&&c.list.controlIndex===t.control),backCells=split?[]:values.cells.filter((c:any)=>c.list.sectionIndex===t.section&&c.list.hostPara===next.paragraph&&c.list.controlIndex===next.control);
 if(targetCells.length!==t.cells.length||!split&&backCells.length!==next.cells.length)throw new Error('표 셀 보존 정보가 없습니다.');
 const all=split?targetCells:[...targetCells,...backCells],newCells=all.map((cell:any,i:number)=>{const c=structuredClone(cell),back=split?c.list.row>=cut:i>=targetCells.length;Object.assign(c.list,{hostPara:split&&back?t.paragraph+2:t.paragraph,controlIndex:split&&back?0:t.control,cellCount:split&&back?next.cells.length:plan.front.cells.length,cellIndex:split&&back?i-plan.front.cells.length:i,row:split&&back?c.list.row-cut:!split&&back?c.list.row+t.rows:c.list.row});return c;});
 const at=values.cells.indexOf(targetCells[0]);values.cells=values.cells.filter((c:any)=>!all.includes(c)).map((c:any)=>c.list.sectionIndex===t.section?{...c,list:{...c.list,hostPara:local(c.list.hostPara)}}:c);values.cells.splice(at,0,...newCells);
 const texts=rootBodyTexts(d);if(split)texts[t.section].splice(t.paragraph+1,0,'','');else texts[t.section].splice(t.paragraph+1,plan.removed);
 return {plan,values,texts};
}
export function assertTableStructureResult(wasm:any,base:TableStructureSnapshot,op:AgentTableStructureOp):void{
 const d=nativeDocument(wasm),plan=tableStructurePlan(op,base),tables=readStructure(d).tables;
 const view=(t:Table)=>({id:t.id,section:t.section,paragraph:t.paragraph,control:t.control,rows:t.rows,columns:t.columns,cells:t.cells.map(c=>({index:c.index,row:c.row,column:c.column,rowSpan:c.rowSpan,columnSpan:c.columnSpan,text:c.text,properties:c.properties,characters:c.characters,paragraphProperties:c.paragraphProperties}))});
 if(!same(tables.map(view),plan.tables.map(view)))throw new Error('표 나누기/붙이기 결과의 구조·내용·서식이 계획과 다릅니다.');
 let reopened:any;try{const artifact=d.exportHwpxWithReport();let bytes:Uint8Array;try{bytes=artifact.takeBytes();verifyPreservedExport(d,bytes,'hwpx',artifact.contentLoss(),bytes=>new d.constructor(bytes));}finally{artifact.free();}reopened=new d.constructor(bytes);for(const t of tables)if(!sameTableLayout(tableLayoutEvidence(d,t),tableLayoutEvidence(reopened,t)))throw new Error('표 구조 변경 후 저장 재열기의 실제 배치가 다릅니다.');}finally{reopened?.free();}
}
export function executeTableStructure(wasm:any,base:TableStructureSnapshot,op:AgentTableStructureOp){
 const d=nativeDocument(wasm),structure=readStructure(d),plan=tableStructurePlan(op,base),cap=readTableStructureSources(d,structure.tables,base.name)?.[op.target];if(!same(structure.tables,base.structure?.tables)||cap?.editable!==true||!same(cap,base.tableStructureSources?.[op.target]))throw new Error('표 구조 원본과 문서 상태가 바뀌었습니다. 최신 문서로 다시 요청하세요.');assertNativeTableWritable(d,plan.table);if(op.kind==='attach_table')assertNativeTableWritable(d,plan.next!);
 const expected=expectedEvidence(d,base,op),t=plan.table,result=parsed(op.kind==='split_table'?d.splitTable(t.section,t.paragraph,t.control,op.atRow):d.mergeTableWithNext(t.section,t.paragraph,t.control));if(result?.ok!==true||op.kind==='split_table'&&(result.frontRows!==op.atRow||result.backParaIdx!==t.paragraph+2)||op.kind==='attach_table'&&result.rowCount!==plan.front.rows)throw new Error('표 구조 변경이 계획대로 실행되지 않았습니다.');
 const after=capturePreservationEvidence(d);if(after.issues.length||!same(topologySemantics(after.values),expected.values)||!same(rootBodyTexts(d),expected.texts)||!same(tableTextTree(readStructure(d).tables),tableTextTree(plan.tables)))throw new Error('표 구조 변경 뒤 내용·서식·다른 표·자원이 예상 변환과 다릅니다.');assertTableStructureResult(d,base,op);
 const focus=op.kind==='split_table'?plan.next!:plan.front;
 return {sectionIndex:focus.section,parentParaIndex:focus.paragraph,paragraphIndex:0,charOffset:0,controlIndex:focus.control,cellIndex:0,cellParaIndex:0,cellPath:[{controlIndex:focus.control,cellIndex:0,cellParaIndex:0}]};
}
