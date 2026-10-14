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
function readPrivateSources(d:any,tables:Table[],name:string){
 const structure=readStructure(d),sources:Record<string,any>={};
 for(const t of tables){
  let source:any={editable:false,reason:'Plain merged cell paragraph only; HWPX root table, one page, no protected/complex source.'};
  try{
   if(!/\.hwpx$/iu.test(name)||t.rows*t.columns>200||!t.cells.some(c=>c.rowSpan*c.columnSpan>1)||t.editable!==true)throw Error();
   assertNativeTableWritable(d,t);
   const controls=parsed(d.getControls()),lists=parsed(d.getCursorModel()).lists;
   if(parsed(d.getFieldList()).length||parsed(d.getBookmarks()).length||controls.some((c:any)=>c.list!==0||!['tbl','secd','cold'].includes(c.ctrlId))||lists.some((l:any)=>!l.isCell||l.hostListId!==0))throw Error();
   const p=parsed(d.getTableProperties(t.section,t.paragraph,t.control)),col=parsed(d.getColumnDef(t.section));
   if(p.cellZoneCount!==0||p.hasCaption||p.cellSpacing!==0||p.treatAsChar||p.allowOverlap||p.repeatHeader||p.textWrap!=='TopAndBottom'||p.vertRelTo!=='Para'||p.vertAlign!=='Top'||p.horzRelTo!=='Para'&&p.horzRelTo!=='Column'||p.horzAlign!=='Left'||col.columnCount!==1)throw Error();
   const frames=Array.from({length:d.pageCount()},(_,i)=>parsed(d.getPageControlLayout(i)).controls.filter((c:any)=>c.type==='table'&&c.secIdx===t.section&&c.paraIdx===t.paragraph&&c.controlIdx===t.control)).flat();
   if(frames.length!==1||frames[0].cells.length!==t.cells.length)throw Error();
   let paragraphBudget=0,characterBudget=0;
   const cells=t.cells.map(c=>{
    const count=d.getCellParagraphCount(t.section,t.paragraph,t.control,c.index);if(count<1||count>50||typeof c.properties.verticalAlign!=='number'||![0,1].includes(c.properties.verticalAlign)||c.properties.textDirection!==0||c.properties.fieldName!=='')throw Error();
    const paragraphs=Array.from({length:count},(_,index)=>{
     const args=[t.section,t.paragraph,t.control,c.index,index],length=d.getCellParagraphLength(...args),text=d.getTextInCell(...args,0,length),path=JSON.stringify([{controlIndex:t.control,cellIndex:c.index,cellParaIndex:index}]),runs=parsed(d.getCharShapeRunsInCellByPath(t.section,t.paragraph,path,0,length)),characters=parsed(d.getCellCharPropertiesAt(...args,0)),paragraph=parsed(d.getCellParaPropertiesAt(...args)),style=parsed(d.getCellStyleAt(...args));
     paragraphBudget++;characterBudget+=Array.from(text).length;
     if(paragraphBudget>200||characterBudget>40000||!plain(text)||Array.from(text).length!==length||new Set(runs.map((r:any)=>r.charShapeId)).size>1||!int(characters.charShapeId)||paragraph.headType!=='None')throw Error();
     return {index,text,length,characters,paragraph,style,runs};
    });return {index:c.index,row:c.row,column:c.column,rowSpan:c.rowSpan,columnSpan:c.columnSpan,paragraphs};
   });
   const evidence=capturePreservationEvidence(d);if(evidence.issues.length)throw Error();
   source={editable:true,cells,fingerprint:sha({evidence,resources:resourceFingerprint(d.exportHwpx()),body:rootBodyTexts(d),tables:tableTextTree(structure.tables),cells,properties:p,columns:col,geometry:tableLayoutEvidence(d,t)})};
  }catch{}
  sources[t.id]=source;
 }
 return {structure,sources};
}

export function readCellParagraphSources(wasm:any,tables:Table[],name:string):Record<string,AgentCellParagraphSource>|undefined {
 const d=nativeDocument(wasm);if(typeof d.setCharShapeIdInCell!=='function'||typeof d.exportHwpx!=='function')return;
 const privateSources=readPrivateSources(d,tables,name).sources;
 return Object.fromEntries(tables.map(t=>{const source=privateSources[t.id];return [t.id,source?.editable===true?{editable:true,fingerprint:source.fingerprint,cells:source.cells.map((c:any)=>({index:c.index,row:c.row,column:c.column,rowSpan:c.rowSpan,columnSpan:c.columnSpan,paragraphs:c.paragraphs.map((p:any)=>({index:p.index,text:p.text}))}))}:{editable:false,reason:'AI 병합 셀 문단 교체는 HWPX 한 쪽 평면 비보호 표의 단순 문단만 지원합니다. 필드·개체·책갈피·중첩·혼합 글자·복합 배치와 쪽을 나누는 긴 결과는 제외합니다.'}];}));
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
 for(const cell of source.cells)for(const para of cell.paragraphs){const old=proof.cells.find((c:any)=>c.index===cell.index)?.paragraphs[para.index];if(!old||!same(para.characters,old.characters)||!same(para.paragraph,old.paragraph)||!same(para.style,old.style)||!same(para.runs.map((r:any)=>r.charShapeId),cell.index===proof.cellIndex&&para.index===op.paragraph?(op.text?[old.characters.charShapeId]:[]):old.runs.map((r:any)=>r.charShapeId)))throw new Error('선택 또는 다른 셀 문단의 원래 서식이 달라졌습니다.');}
 portableLayout(d,()=>{const artifact=d.exportHwpxWithReport();let reopened:any;
 try{const loss=JSON.parse(artifact.contentLoss()),bytes=artifact.takeBytes();verifyPreservedExport(d,bytes,'hwpx',loss,b=>new d.constructor(b));reopened=new d.constructor(bytes);if(!sameTableLayout(tableLayoutEvidence(d,proof.table),tableLayoutEvidence(reopened,proof.table)))throw new Error('셀 문단 교체 후 실제 저장 재열기 배치가 다릅니다.');}finally{reopened?.free();artifact.free();}});
}
export function executeCellParagraph(wasm:any,base:Snapshot,op:AgentCellParagraphOp){
 const d=nativeDocument(wasm);pending.delete(d);const plan=cellParagraphPlan(op,base),t=plan.table,structure=readStructure(d),cap=readCellParagraphSources(d,structure.tables,base.name)?.[t.id];
 if(!same(structure,base.structure)||cap?.editable!==true||!same(cap,base.cellParagraphSources?.[t.id]))throw new Error('병합 셀 또는 다른 내용·서식·문서 자원이 바뀌었습니다. 최신 문서로 다시 요청하세요.');
 assertNativeTableWritable(d,t);const source=readPrivateSources(d,[t],base.name).sources[t.id],c=source.cells.find((c:any)=>c.index===plan.cell.index),p=c.paragraphs[op.paragraph];
 const before=capturePreservationEvidence(d);if(before.issues.length)throw new Error('셀 문단 교체 전 전체 보존 정보를 읽지 못했습니다.');const expected=topologySemantics(before.values),target=expected.cells.find((c:any)=>c.list.hostListId===0&&c.list.sectionIndex===t.section&&c.list.hostPara===t.paragraph&&c.list.controlIndex===t.control&&c.list.cellIndex===plan.cell.index);
 if(!target)throw new Error('원래 셀 문단의 보존 정보가 없습니다.');target.paragraphs[op.paragraph].runs=op.text?[{start:0,end:Array.from(op.text).length,properties:normalize(p.characters)}]:[];
 const text=tableTextTree(structure.tables).map(table=>table.id===t.id?{...table,cells:table.cells.map(cell=>cell.index===c.index?{...cell,text:c.paragraphs.map((p:any)=>p.index===op.paragraph?op.text:p.text).join('\n')}:cell)}:table);
 const proof={revision:base.revision,operation:structuredClone(op),table:t,expected,body:rootBodyTexts(d),text,resources:resourceFingerprint(d.exportHwpx()),cells:source.cells,cellIndex:c.index},args=[t.section,t.paragraph,t.control,c.index,op.paragraph];
 if(p.length)checked(d.deleteTextInCell(...args,0,p.length));if(op.text){checked(d.insertTextInCell(...args,0,op.text));checked(d.setCharShapeIdInCell(...args,0,Array.from(op.text).length,p.characters.charShapeId));}
 pending.set(d,proof);assertCellParagraphResult(d,base,op);
 return {sectionIndex:t.section,parentParaIndex:t.paragraph,paragraphIndex:op.paragraph,charOffset:0,controlIndex:t.control,cellIndex:c.index,cellParaIndex:op.paragraph,cellPath:[{controlIndex:t.control,cellIndex:c.index,cellParaIndex:op.paragraph}]};
}
