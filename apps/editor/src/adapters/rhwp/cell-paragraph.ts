import {sha256} from '@noble/hashes/sha2.js';
import type {Snapshot,Table,AgentCellParagraphOp,AgentCellParagraphSource} from '../../modules/document/public/index.ts';
import {cellParagraphPlan} from '../../modules/document/public/engine-integration.ts';
import {nativeDocument,readStructure,parsed} from './structure.ts';
import {capturePreservationEvidence,verifyPreservedExport} from './preservation.ts';
import {topologySemantics,rootBodyTexts,tableTextTree} from './table-topology-evidence.ts';
import {assertNativeTableWritable} from './table-write-guard.ts';
import {tableLayoutEvidence,sameTableLayout} from './table-layout-evidence.ts';
const hex=(bytes:Uint8Array)=>Array.from(sha256(bytes),n=>n.toString(16).padStart(2,'0')).join('');
const canonical=(v:any):any=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const same=(a:any,b:any)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const sha=(v:any)=>hex(new TextEncoder().encode(JSON.stringify(canonical(v))));
const int=(v:any)=>Number.isSafeInteger(v)&&v>=0;
const plain=(v:any)=>typeof v==='string'&&Array.from(v).length<=4000&&!/[\x00-\x1f\x7f]/u.test(v);
const checked=(v:any)=>{const r=parsed(v);if(r?.ok!==true)throw new Error('문서 엔진이 셀 문단 편집을 거절했습니다.');return r;};
const normalize=(v:any):any=>{if(Array.isArray(v))return v.map(normalize);if(!v||typeof v!=='object')return v;return Object.fromEntries(Object.entries(v).filter(([k])=>!['charShapeId','paraShapeId','borderFillId'].includes(k)&&!(v.fillType==='none'&&['fillColor','patternColor','patternType'].includes(k))).map(([k,x])=>[k,v.fillType==='solid'&&k==='patternType'&&typeof x==='number'&&x<=0?-1:normalize(x)]));};
/** Snapshot exports use deterministic compression. Compare the stored header
 * and every embedded BinData payload directly, so unused resources cannot be
 * created silently. No decompression, OS access or source disk file is needed. */
export function resourceFingerprint(bytes:Uint8Array){
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),decoder=new TextDecoder(),entries:any[]=[];let at=0;
 while(at+30<=bytes.length&&view.getUint32(at,true)===0x04034b50){
  const flags=view.getUint16(at+6,true),method=view.getUint16(at+8,true),crc=view.getUint32(at+14,true),size=view.getUint32(at+18,true),expanded=view.getUint32(at+22,true),nameLen=view.getUint16(at+26,true),extra=view.getUint16(at+28,true),start=at+30+nameLen+extra,end=start+size;
  if(flags&8||![0,8].includes(method)||end>bytes.length||size>128*1024*1024)throw new Error('현재 저장 자원의 구조를 확실하게 확인하지 못했습니다.');
  const name=decoder.decode(bytes.subarray(at+30,at+30+nameLen));
  if(name==='Contents/header.xml'||name.startsWith('BinData/'))entries.push({name,method,crc,expanded,hash:hex(bytes.subarray(start,end))});
  at=end;
 }
 if(entries.filter(e=>e.name==='Contents/header.xml').length!==1||new Set(entries.map(e=>e.name)).size!==entries.length)throw new Error('문서 정의 또는 저장 자원의 식별이 불명확합니다.');
 return sha(entries.sort((a,b)=>a.name.localeCompare(b.name)));
}
/** Rendered cell indices restart on each continuation page. The document
 * model supplies the stable row and column of each merged-cell owner. */
function paragraphPageOwners(d:any,t:Table) {
 const remaining=new Map(t.cells.map(cell=>[`${cell.row},${cell.column}`,cell]));
 const pages:Array<{page:number;owners:number[]}>=[];
 for(let page=0;page<d.pageCount();page++){
  const frames=parsed(d.getPageControlLayout(page)).controls.filter((frame:any)=>
   frame.type==='table'&&frame.secIdx===t.section&&frame.paraIdx===t.paragraph&&frame.controlIdx===t.control);
  if(!frames.length)continue;
  if(frames.length!==1||!frames[0].cells.length)throw Error('표의 쪽 경계를 확인하지 못했습니다.');
  const owners=frames[0].cells.map((frame:any)=>{
   const address=`${frame.row},${frame.col}`,cell=remaining.get(address);
   if(!cell||cell.rowSpan!==frame.rowSpan||cell.columnSpan!==frame.colSpan)throw Error('한 셀이 여러 부분으로 나뉘었거나 표의 격자가 달라졌습니다.');
   remaining.delete(address);
   return cell.index;
  });
  pages.push({page,owners});
 }
 if(!pages.length||remaining.size)throw Error('화면의 표에서 모든 셀을 확인하지 못했습니다.');
 return pages;
}
function readPrivateSources(d:any,tables:Table[],name:string){
 const structure=readStructure(d),sources:Record<string,any>={};
 for(const t of tables){
  let source:any={editable:false};
  try{
   if(!/\.hwpx?$/iu.test(name)||d.getSourceFormat()!==(/\.hwp$/iu.test(name)?'hwp':'hwpx')||t.rows*t.columns>200||!t.cells.some(c=>c.rowSpan*c.columnSpan>1)||t.editable!==true)throw Error();
   assertNativeTableWritable(d,t);
   const controls=parsed(d.getControls()),lists=parsed(d.getCursorModel()).lists;
   if(parsed(d.getFieldList()).length||parsed(d.getBookmarks()).length||controls.some((c:any)=>c.list!==0||!['tbl','secd','cold'].includes(c.ctrlId))||lists.some((l:any)=>!l.isCell||l.hostListId!==0))throw Error();
   const p=parsed(d.getTableProperties(t.section,t.paragraph,t.control)),col=parsed(d.getColumnDef(t.section));
   if(p.cellZoneCount!==0||p.hasCaption||p.cellSpacing!==0||p.treatAsChar||p.allowOverlap||p.repeatHeader||p.textWrap!=='TopAndBottom'||p.vertRelTo!=='Para'||p.vertAlign!=='Top'||p.horzRelTo!=='Para'&&p.horzRelTo!=='Column'||p.horzAlign!=='Left'||col.columnCount!==1)throw Error();
   const pages=paragraphPageOwners(d,t);
   let paragraphBudget=0,characterBudget=0;
   const cells=t.cells.map(c=>{
    const count=d.getCellParagraphCount(t.section,t.paragraph,t.control,c.index);if(count<1||count>50||typeof c.properties.verticalAlign!=='number'||![0,1].includes(c.properties.verticalAlign)||c.properties.textDirection!==0||c.properties.fieldName!=='')throw Error();
    const paragraphs=Array.from({length:count},(_,index)=>{
     const args=[t.section,t.paragraph,t.control,c.index,index],length=d.getCellParagraphLength(...args),text=d.getTextInCell(...args,0,length),path=JSON.stringify([{controlIndex:t.control,cellIndex:c.index,cellParaIndex:index}]),runs=parsed(d.getCharShapeRunsInCellByPath(t.section,t.paragraph,path,0,length)),characters=parsed(d.getCellCharPropertiesAt(...args,0)),paragraph=parsed(d.getCellParaPropertiesAt(...args)),style=parsed(d.getCellStyleAt(...args));
     paragraphBudget++;characterBudget+=Array.from(text).length;
     if(paragraphBudget>200||characterBudget>40000||!plain(text)||Array.from(text).length!==length||!Array.isArray(runs)||runs.some((r:any,i:number)=>!int(r.charShapeId)||!int(r.endOffset)||r.startOffset!==(i===0?0:runs[i-1].endOffset)||r.endOffset<=r.startOffset)||(runs.at(-1)?.endOffset??0)!==length||!int(characters.charShapeId)||paragraph.headType!=='None')throw Error();
     return {index,text,length,characters,paragraph,style,runs};
    });return {index:c.index,row:c.row,column:c.column,rowSpan:c.rowSpan,columnSpan:c.columnSpan,paragraphs};
   });
   const evidence=capturePreservationEvidence(d);if(evidence.issues.length)throw Error();
   source={editable:true,cells,pages,fingerprint:sha({evidence,resources:resourceFingerprint(d.exportHwpx()),body:rootBodyTexts(d),tables:tableTextTree(structure.tables),cells,properties:p,columns:col,pages,geometry:tableLayoutEvidence(d,t)})};
  }catch{}
  sources[t.id]=source;
 }
 return {structure,sources};
}

export function readCellParagraphSources(wasm:any,tables:Table[],name:string):Record<string,AgentCellParagraphSource>|undefined {
 const d=nativeDocument(wasm);if(typeof d.setCharShapeIdInCell!=='function'||typeof d.exportHwpx!=='function')return;
 const privateSources=readPrivateSources(d,tables,name).sources;
 return Object.fromEntries(tables.map(t=>{const source=privateSources[t.id];return [t.id,source?.editable===true?{editable:true,fingerprint:source.fingerprint,cells:source.cells.map((c:any)=>({index:c.index,row:c.row,column:c.column,rowSpan:c.rowSpan,columnSpan:c.columnSpan,paragraphs:c.paragraphs.map((p:any)=>({index:p.index,text:p.text,...(p.runs.length>1?{formatSpans:p.runs.map((r:any)=>({start:r.startOffset,end:r.endOffset}))}:{})}))}))}:{editable:false,reason:'병합 셀 문단 교체에는 셀마다 원래 행·열과 쪽을 확인할 수 있는 비보호 본문 표가 필요합니다. 필드·개체·책갈피·중첩 표와 여러 쪽에 걸쳐 나뉜 셀은 편집할 수 없습니다.'}];}));
}
/** Export bytes use portable metrics. Compare their layout with the same
 * temporary metric selection and restore the screen environment synchronously.
 * Actual Canvas screen/reopen parity is an independent browser check. */
function portableLayout<T>(d:any,read:()=>T):T {
 const restore=typeof d.canvasMetricsActive==='function'&&d.canvasMetricsActive()===true;
 if(restore)d.selectCanvasMetrics(false);
 try{return read();}finally{if(restore)d.selectCanvasMetrics(true);}
}
const pending=new WeakMap<object,any>();
export function assertCellParagraphResult(wasm:any,base:Snapshot,op:AgentCellParagraphOp):void {
 const d=nativeDocument(wasm),proof=pending.get(d);if(!proof||proof.revision!==base.revision||!same(proof.operation,op))throw new Error('셀 문단 결과의 검증 근거가 없습니다.');
 const after=capturePreservationEvidence(d);if(after.issues.length||!same(topologySemantics(after.values),proof.expected)||!same(rootBodyTexts(d),proof.body)||!same(tableTextTree(readStructure(d).tables),proof.text)||resourceFingerprint(d.exportHwpx())!==proof.resources)throw new Error('병합 셀 문단 결과 또는 다른 문서 내용·자원이 변경되었습니다.');
 const source=readPrivateSources(d,[proof.table],base.name).sources[op.target];if(source?.editable!==true)throw new Error('교체 후 병합 셀 문단을 검증하지 못했습니다.');
 if(!same(source.pages,proof.pages))throw new Error('문단 편집으로 셀의 쪽 경계가 바뀌어 적용하지 않았습니다.');
 for(const cell of source.cells)for(const para of cell.paragraphs){
  const old=proof.cells.find((c:any)=>c.index===cell.index)?.paragraphs[para.index];
  const target=cell.index===proof.cellIndex&&para.index===op.paragraph;
  if(!old||!same(para.characters,target?proof.firstCharacters:old.characters)||!same(para.paragraph,old.paragraph)||!same(para.style,old.style)||!same(para.runs,target?proof.runs:old.runs))throw new Error('선택 또는 다른 셀 문단의 원래 서식이 달라졌습니다.');
 }
 portableLayout(d,()=>{const format=/\.hwp$/iu.test(base.name)?'hwp':'hwpx';const artifact=format==='hwp'?d.exportHwpWithReport():d.exportHwpxWithReport();let reopened:any;
 try{const loss=JSON.parse(artifact.contentLoss()),bytes=artifact.takeBytes();verifyPreservedExport(d,bytes,format,loss,b=>new d.constructor(b));reopened=new d.constructor(bytes);if(!sameTableLayout(tableLayoutEvidence(d,proof.table),tableLayoutEvidence(reopened,proof.table)))throw new Error('셀 문단 교체 후 실제 저장 재열기 배치가 다릅니다.');}finally{reopened?.free();artifact.free();}});
}
export function executeCellParagraph(wasm:any,base:Snapshot,op:AgentCellParagraphOp){
 const d=nativeDocument(wasm);pending.delete(d);const plan=cellParagraphPlan(op,base),t=plan.table,structure=readStructure(d),cap=readCellParagraphSources(d,structure.tables,base.name)?.[t.id];
 if(!same(structure,base.structure)||cap?.editable!==true||!same(cap,base.cellParagraphSources?.[t.id]))throw new Error('병합 셀 또는 다른 내용·서식·문서 자원이 바뀌었습니다. 최신 문서로 다시 요청하세요.');
 assertNativeTableWritable(d,t);const source=readPrivateSources(d,[t],base.name).sources[t.id],c=source.cells.find((c:any)=>c.index===plan.cell.index),p=c.paragraphs[op.paragraph];
 const before=capturePreservationEvidence(d);if(before.issues.length)throw new Error('셀 문단 교체 전 전체 보존 정보를 읽지 못했습니다.');const expected=topologySemantics(before.values),target=expected.cells.find((c:any)=>c.list.hostListId===0&&c.list.sectionIndex===t.section&&c.list.hostPara===t.paragraph&&c.list.controlIndex===t.control&&c.list.cellIndex===plan.cell.index);
 if(!target)throw new Error('원래 셀 문단의 보존 정보가 없습니다.');
 const mixed=p.runs.length>1,edits=plan.edits;
 const paraEvidence=target.paragraphs[op.paragraph];
 const args=[t.section,t.paragraph,t.control,c.index,op.paragraph];
 // Removing a run can expose or join neighboring original styles. Derive both
 // the first-character binding and the expected run evidence before mutation.
 const runs:Array<{startOffset:number;endOffset:number;charShapeId:number}>=[];
 const storedRuns:Array<{start:number;end:number;properties:unknown}>=[];
 let firstCharacters=p.characters;
 if(mixed){
  for(const [i,run] of p.runs.entries()){
   const edit=edits.find(e=>e.run===i);
   const length=run.endOffset-run.startOffset+(edit?Array.from(edit.insert).length-edit.remove:0);
   if(length===0)continue;
   const previous=runs.at(-1),start=previous?.endOffset??0,end=start+length;
   if(previous&&previous.charShapeId===run.charShapeId){
    previous.endOffset=end;
    storedRuns[storedRuns.length-1].end=end;
   }else{
    if(!previous)firstCharacters=parsed(d.getCellCharPropertiesAt(...args,run.startOffset));
    runs.push({startOffset:start,endOffset:end,charShapeId:run.charShapeId});
    storedRuns.push({start,end,properties:paraEvidence.runs[i].properties});
   }
  }
 }else if(op.text){
  const end=Array.from(op.text).length;
  runs.push({startOffset:0,endOffset:end,charShapeId:p.characters.charShapeId});
  storedRuns.push({start:0,end,properties:normalize(p.characters)});
 }
 paraEvidence.runs=storedRuns;
 const text=tableTextTree(structure.tables).map(table=>table.id===t.id?{...table,cells:table.cells.map(cell=>cell.index===c.index?{...cell,text:c.paragraphs.map((p:any)=>p.index===op.paragraph?op.text:p.text).join('\n')}:cell)}:table);
 const proof={revision:base.revision,operation:structuredClone(op),table:t,expected,runs,firstCharacters,pages:source.pages,body:rootBodyTexts(d),text,resources:resourceFingerprint(d.exportHwpx()),cells:source.cells,cellIndex:c.index};
 // Edit right to left so offsets always refer to the queried source.
 for(const edit of [...edits].reverse()){
  const shape=mixed?p.runs[edit.run].charShapeId:p.characters.charShapeId;
  if(edit.remove)checked(d.deleteTextInCell(...args,edit.start,edit.remove));
  if(edit.insert){
   checked(d.insertTextInCell(...args,edit.start,edit.insert));
   checked(d.setCharShapeIdInCell(...args,edit.start,edit.start+Array.from(edit.insert).length,shape));
  }
 }
 pending.set(d,proof);assertCellParagraphResult(d,base,op);
 return {sectionIndex:t.section,parentParaIndex:t.paragraph,paragraphIndex:op.paragraph,charOffset:0,controlIndex:t.control,cellIndex:c.index,cellParaIndex:op.paragraph,cellPath:[{controlIndex:t.control,cellIndex:c.index,cellParaIndex:op.paragraph}]};
}
