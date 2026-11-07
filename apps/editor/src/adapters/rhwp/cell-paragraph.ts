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
 const byAddress=new Map(t.cells.map(cell=>[`${cell.row},${cell.column}`,cell]));
 const lastPage=new Map<number,number>(),continued=new Set<number>();
 const pages:Array<{page:number;owners:number[]}>=[];
 for(let page=0;page<d.pageCount();page++){
  const frames=parsed(d.getPageControlLayout(page)).controls.filter((frame:any)=>
   frame.type==='table'&&frame.secIdx===t.section&&frame.paraIdx===t.paragraph&&frame.controlIdx===t.control);
  if(!frames.length)continue;
  if(frames.length!==1||!frames[0].cells.length)throw Error('표의 쪽 경계를 확인하지 못했습니다.');
  const owners=frames[0].cells.map((frame:any)=>{
   const cell=byAddress.get(`${frame.row},${frame.col}`);
   if(!cell||cell.rowSpan!==frame.rowSpan||cell.columnSpan!==frame.colSpan)throw Error('표의 원래 격자가 달라졌습니다.');
   const previous=lastPage.get(cell.index);
   if(previous!==undefined){
    if(previous!==page-1)throw Error('셀의 쪽 경계가 연속되지 않습니다.');
    continued.add(cell.index);
   }
   lastPage.set(cell.index,page);
   return cell.index;
  });
  pages.push({page,owners});
 }
 if(!pages.length||lastPage.size!==t.cells.length)throw Error('화면의 표에서 모든 셀을 확인하지 못했습니다.');
 // A repeated frame alone cannot distinguish a continuation from duplicated
 // content. Reassemble each split owner's rendered runs at native text offsets.
 if(continued.size){
  const offsets=new Map<string,number>();
  for(const {page,owners} of pages){
   const runs=parsed(d.getPageTextLayout(page)).runs;
   for(const r of runs){
    if(r.secIdx!==t.section||r.parentParaIdx!==t.paragraph||r.controlIdx!==t.control||!continued.has(r.cellIdx))continue;
    const key=r.cellIdx+'/'+r.cellParaIdx,start=offsets.get(key)??0;
    const args=[t.section,t.paragraph,t.control,r.cellIdx,r.cellParaIdx],length=Array.from(r.text as string).length;
    if(!owners.includes(r.cellIdx)||!int(r.cellParaIdx)||r.cellParaIdx>=d.getCellParagraphCount(...args.slice(0,4))||
       start!==r.charStart||d.getTextInCell(...args,start,length)!==r.text)throw Error('여러 쪽에 걸친 셀의 글줄과 원문이 다릅니다.');
    offsets.set(key,start+length);
   }
  }
  for(const index of continued){
   const args=[t.section,t.paragraph,t.control,index];
   for(let p=0;p<d.getCellParagraphCount(...args);p++)
    if((offsets.get(index+'/'+p)??0)!==d.getCellParagraphLength(...args,p))throw Error('여러 쪽에 걸친 셀의 글줄을 모두 확인하지 못했습니다.');
  }
 }
 return pages;
}
/** Match every anonymous native control to its field and owning cursor list.
 * A stored table formula must reproduce its cached result without updating any field. */
function cellFieldBoundaries(d:any,t:Table,tables:Table[],controls:any[],lists:any[]){
 const nested=controls.filter(c=>c.list!==0),fields=parsed(d.getFieldList());
 const boundaries=new Map<string,number>();
 const formulaTables=new Set<string>(),formulaResults:Array<{id:number;result:number}>=[];
 if(!Array.isArray(fields)||fields.length!==nested.length)throw Error();
 const remaining=new Map<string,number>();
 for(const c of nested){
  if(c.ctrlId!==''||c.ctrlCh!==0)throw Error();
  const key=c.list+'/'+c.para;
  remaining.set(key,(remaining.get(key)??0)+1);
 }
 const inspected=new Set<number>();
 const ranges=new Map<string,Array<[number,number]>>();
 for(const field of fields){
  const loc=field.location,step=loc?.path?.[0];
  if(!['clickhere','formula'].includes(field.fieldType)||field.cellField!==false||
     loc?.path?.length!==1||step.type!=='cell'||!int(step.cellIndex)||!int(step.paraIndex)||
     !int(field.startCharIdx)||!int(field.endCharIdx)||field.endCharIdx<field.startCharIdx||field.paraInList!==step.paraIndex)throw Error();
  const host=tables.find(table=>table.section===loc.sectionIndex&&table.paragraph===loc.paraIndex&&table.control===step.controlIndex);
  if(!host||field.fieldType==='clickhere'&&host.id!==t.id)throw Error();
  const list=lists.find(l=>l.hostListId===0&&l.isCell&&l.sectionIndex===host.section&&l.hostPara===host.paragraph&&
   l.controlIndex===host.control&&l.cellIndex===step.cellIndex&&l.listId===field.listId);
  const slot=field.listId+'/'+step.paraIndex,count=remaining.get(slot)??0;
  if(!list||!count||!int(field.fieldId)||inspected.has(field.fieldId))throw Error();
  inspected.add(field.fieldId); remaining.set(slot,count-1);
  if(field.fieldType==='formula'){
   const cell=host.cells.find(c=>c.index===step.cellIndex),formula=cell?.axisFormula;
   if(!cell||!formula||formula.fieldId!==field.fieldId||host.rows*host.columns>200||host.cellZoneCount!==0)throw Error();
   if(!formulaTables.has(host.id))assertNativeTableWritable(d,host);
   const preview=parsed(d.previewTableFormulaField(host.section,host.paragraph,host.control,cell.index,
    formula.fieldId,field.command,formula.expression,formula.resultFormat));
   if(preview.ok!==true||preview.fieldId!==formula.fieldId||!Number.isFinite(preview.result)||
      preview.command!==field.command||preview.value!==cell.text||preview.dependentChanges?.length!==0)throw Error();
   formulaTables.add(host.id);formulaResults.push({id:formula.fieldId,result:preview.result});
   continue;
  }
  const info=parsed(d.getFieldInfoAtInCell(t.section,t.paragraph,t.control,step.cellIndex,step.paraIndex,field.startCharIdx,false));
  const key=step.cellIndex+'/'+step.paraIndex;
  if(!info.inField||info.fieldId!==field.fieldId||info.fieldType!==field.fieldType||info.startCharIdx!==field.startCharIdx||
     info.endCharIdx!==field.endCharIdx)throw Error();
  const group=ranges.get(key)??[];
  // Adjacent inline markers can coalesce on re-export. Only advertise a
  // suffix when a plain character separates every pair of stored fields.
  group.push([field.startCharIdx,field.endCharIdx]);ranges.set(key,group);
 }
 for(const [key,group] of ranges){
  group.sort((a,b)=>a[0]-b[0]);
  if(group.some(([start],i)=>i>0&&start<=group[i-1][1]+1))throw Error();
  boundaries.set(key,group[group.length-1][1]+1);
 }
 return {boundaries,formulaResults,hasLocalFormula:formulaTables.has(t.id)};
}
function readPrivateSources(d:any,tables:Table[],name:string){
 const structure=readStructure(d),sources:Record<string,any>={};
 for(const t of tables){
  let source:any={editable:false};
  try{
   if(!/\.hwpx?$/iu.test(name)||d.getSourceFormat()!==(/\.hwp$/iu.test(name)?'hwp':'hwpx')||t.rows*t.columns>200||!t.cells.some(c=>c.rowSpan*c.columnSpan>1)||t.editable!==true)throw Error();
   assertNativeTableWritable(d,t);
   const controls=parsed(d.getControls()),lists=parsed(d.getCursorModel()).lists;
   if(parsed(d.getBookmarks()).length||controls.some((c:any)=>c.list===0&&!['tbl','secd','cold'].includes(c.ctrlId))||lists.some((l:any)=>!l.isCell||l.hostListId!==0))throw Error();
   const {boundaries,formulaResults,hasLocalFormula}=cellFieldBoundaries(d,t,structure.tables,controls,lists);
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
     const editableFrom=boundaries.get(c.index+'/'+index);
     return {index,text,length,characters,paragraph,style,runs,...(editableFrom===undefined?{}:{editableFrom})};
    });
    let formulaReadOnly=false;
    if(hasLocalFormula){
     // The native graph resolves covered coordinates to their merged owner.
     // Refuse both referenced owners and any owner whose dependencies cannot be resolved.
     try{formulaReadOnly=d.tableFormulaInputHasDependents(t.section,t.paragraph,t.control,c.index)!==false;}
     catch{formulaReadOnly=true;}
    }
    return {index:c.index,row:c.row,column:c.column,rowSpan:c.rowSpan,columnSpan:c.columnSpan,paragraphs,...(formulaReadOnly?{formulaReadOnly}: {})};
   });
   if(!cells.some(c=>!c.formulaReadOnly&&c.rowSpan*c.columnSpan>1))throw Error();
   const evidence=capturePreservationEvidence(d);if(evidence.issues.length)throw Error();
   source={editable:true,cells,pages,formulaResults,fingerprint:sha({evidence,formulaResults,resources:resourceFingerprint(d.exportHwpx()),body:rootBodyTexts(d),tables:tableTextTree(structure.tables),cells,properties:p,columns:col,pages,geometry:tableLayoutEvidence(d,t)})};
  }catch{}
  sources[t.id]=source;
 }
 return {structure,sources};
}

export function readCellParagraphSources(wasm:any,tables:Table[],name:string):Record<string,AgentCellParagraphSource>|undefined {
 const d=nativeDocument(wasm);if(typeof d.setCharShapeIdInCell!=='function'||typeof d.exportHwpx!=='function')return;
 const privateSources=readPrivateSources(d,tables,name).sources;
 return Object.fromEntries(tables.map(t=>{const source=privateSources[t.id];return [t.id,source?.editable===true?{editable:true,fingerprint:source.fingerprint,cells:source.cells.filter((c:any)=>!c.formulaReadOnly).map((c:any)=>({index:c.index,row:c.row,column:c.column,rowSpan:c.rowSpan,columnSpan:c.columnSpan,paragraphs:c.paragraphs.map((p:any)=>({index:p.index,text:p.text,...(p.editableFrom===undefined?{}:{editableFrom:p.editableFrom}),...(p.runs.length>1?{formatSpans:p.runs.map((r:any)=>({start:r.startOffset,end:r.endOffset}))}:{})}))}))}:{editable:false,reason:'병합 셀 문단 교체에는 셀마다 원래 행·열과 쪽을 확인할 수 있는 비보호 본문 표가 필요합니다. 경계를 확인할 수 없는 필드·개체·책갈피·중첩 표 또는 여러 쪽의 글줄을 원문과 대조할 수 없는 셀은 편집할 수 없습니다.'}];}));
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
type CharacterRun={startOffset:number;endOffset:number;charShapeId:number};
/** Build the expected definitions in an independent document using the body
 * formatter. The live cell formatter must produce the same stored header and
 * all original binary resources, including unreferenced ones. */
function planCharacterFormats(d:any,base:Snapshot,op:AgentCellParagraphOp,runs:CharacterRun[],storedRuns:any[],resources:string) {
 const scratch=new d.constructor(/\.hwp$/iu.test(base.name)?d.exportHwp():d.exportHwpx());
 try{
  const at=scratch.getParagraphLength(0,0);
  checked(scratch.insertText(0,0,at,'x'));
  if(resourceFingerprint(scratch.exportHwpx())!==resources)throw Error('새 글자 서식의 원본 정의와 자원을 대조할 수 없습니다.');
  const spans=op.spanFormats!,boundaries=new Set(spans.flatMap(f=>[f.start,f.end]));
  const result:CharacterRun[]=[],stored:Array<{start:number;end:number;properties:unknown}>=[];
  const applications:Array<{start:number;end:number;properties:string}>=[];
  let firstCharacters:any;
  for(const [i,run] of runs.entries()){
   const cuts=[run.startOffset,...[...boundaries].filter(n=>run.startOffset<n&&n<run.endOffset).sort((a,b)=>a-b),run.endOffset];
   for(let j=1;j<cuts.length;j++){
    const start=cuts[j-1],end=cuts[j],span=spans.find(s=>s.start<=start&&end<=s.end);
    checked(scratch.setCharShapeId(0,0,at,at+1,run.charShapeId));
    let shape=parsed(scratch.getCharPropertiesAt(0,0,at));
    if(shape.charShapeId!==run.charShapeId||!same(normalize(shape),storedRuns[i].properties))throw Error('원래 글자 서식 정의가 달라졌습니다.');
    if(span){
     const properties={...(span.bold===undefined?{}:{bold:span.bold}),...(span.italic===undefined?{}:{italic:span.italic}),
      ...(span.color===undefined?{}:{textColor:span.color.toLowerCase()}),...(span.fontSizePt===undefined?{}:{fontSize:Math.round(span.fontSizePt*100)})};
     const expected={...normalize(shape),...properties};
     if(!same(normalize(shape),expected)){
      const json=JSON.stringify(properties);
      checked(scratch.applyCharFormat(0,0,at,at+1,json));
      shape=parsed(scratch.getCharPropertiesAt(0,0,at));
      if(!int(shape.charShapeId)||!same(normalize(shape),expected))throw Error('요청한 속성만 바뀐 글자 서식 정의를 확인하지 못했습니다.');
      applications.push({start,end,properties:json});
     }
    }
    if(start===0)firstCharacters=shape;
    const previous=result.at(-1);
    if(previous?.charShapeId===shape.charShapeId){previous!.endOffset=end;stored[stored.length-1].end=end;}
    else{result.push({startOffset:start,endOffset:end,charShapeId:shape.charShapeId});stored.push({start,end,properties:normalize(shape)});}
   }
  }
  if(!applications.length&&op.text===op.originalText)throw Error('선택한 구간에 이미 같은 글자 서식이 적용되어 있습니다.');
  return {runs:result,stored,firstCharacters,applications,resources:resourceFingerprint(scratch.exportHwpx())};
 }finally{scratch.free();}
}
export function assertCellParagraphResult(wasm:any,base:Snapshot,op:AgentCellParagraphOp):void {
 const d=nativeDocument(wasm),proof=pending.get(d);if(!proof||proof.revision!==base.revision||!same(proof.operation,op))throw new Error('셀 문단 결과의 검증 근거가 없습니다.');
 const after=capturePreservationEvidence(d);if(after.issues.length||!same(topologySemantics(after.values),proof.expected)||!same(rootBodyTexts(d),proof.body)||!same(tableTextTree(readStructure(d).tables),proof.text)||resourceFingerprint(d.exportHwpx())!==proof.resources)throw new Error('병합 셀 문단 결과 또는 다른 문서 내용·자원이 변경되었습니다.');
 const source=readPrivateSources(d,[proof.table],base.name).sources[op.target];if(source?.editable!==true)throw new Error('교체 후 병합 셀 문단을 검증하지 못했습니다.');
 if(!same(source.formulaResults,proof.formulaResults))throw Error('문단 편집으로 계산식 결과가 달라졌습니다.');
 if(!same(source.pages,proof.pages))throw new Error('문단 편집으로 셀의 쪽 경계가 바뀌어 적용하지 않았습니다.');
 for(const cell of source.cells)for(const para of cell.paragraphs){
  const old=proof.cells.find((c:any)=>c.index===cell.index)?.paragraphs[para.index];
  const target=cell.index===proof.cellIndex&&para.index===op.paragraph;
  if(!old||!same(para.characters,target?proof.firstCharacters:old.characters)||!same(para.paragraph,old.paragraph)||!same(para.style,old.style)||!same(para.runs,target?proof.runs:old.runs))throw new Error('선택 또는 다른 셀 문단의 원래 서식이 달라졌습니다.');
 }
 portableLayout(d,()=>{const format=/\.hwp$/iu.test(base.name)?'hwp':'hwpx';const artifact=format==='hwp'?d.exportHwpWithReport():d.exportHwpxWithReport();let reopened:any;
 try{const loss=JSON.parse(artifact.contentLoss()),bytes=artifact.takeBytes();verifyPreservedExport(d,bytes,format,loss,b=>new d.constructor(b));reopened=new d.constructor(bytes);
  if(!sameTableLayout(tableLayoutEvidence(d,proof.table),tableLayoutEvidence(reopened,proof.table)))throw new Error('셀 문단 교체 후 실제 저장 재열기 배치가 다릅니다.');
  if(proof.formulaResults.length){
   const stored=cellFieldBoundaries(reopened,proof.table,readStructure(reopened).tables,parsed(reopened.getControls()),parsed(reopened.getCursorModel()).lists);
   if(!same(stored.formulaResults,proof.formulaResults))throw Error('저장 후 계산식 결과가 달라졌습니다.');
  }
 }finally{reopened?.free();artifact.free();}});
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
 const resources=resourceFingerprint(d.exportHwpx());
 const formatted=op.spanFormats?planCharacterFormats(d,base,op,runs,storedRuns,resources):undefined;
 paraEvidence.runs=formatted?.stored??storedRuns;
 const text=tableTextTree(structure.tables).map(table=>table.id===t.id?{...table,cells:table.cells.map(cell=>cell.index===c.index?{...cell,text:c.paragraphs.map((p:any)=>p.index===op.paragraph?op.text:p.text).join('\n')}:cell)}:table);
 const proof={revision:base.revision,operation:structuredClone(op),table:t,expected,runs:formatted?.runs??runs,firstCharacters:formatted?.firstCharacters??firstCharacters,
  pages:source.pages,formulaResults:source.formulaResults,body:rootBodyTexts(d),text,resources:formatted?.resources??resources,cells:source.cells,cellIndex:c.index};
 // Edit right to left so offsets always refer to the queried source.
 for(const edit of [...edits].reverse()){
  const shape=mixed?p.runs[edit.run].charShapeId:p.characters.charShapeId;
  if(edit.remove)checked(d.deleteTextInCell(...args,edit.start,edit.remove));
  if(edit.insert){
   checked(d.insertTextInCell(...args,edit.start,edit.insert));
   checked(d.setCharShapeIdInCell(...args,edit.start,edit.start+Array.from(edit.insert).length,shape));
  }
 }
 for(const range of formatted?.applications??[])checked(d.applyCharFormatInCell(...args,range.start,range.end,range.properties));
 pending.set(d,proof);assertCellParagraphResult(d,base,op);
 return {sectionIndex:t.section,parentParaIndex:t.paragraph,paragraphIndex:op.paragraph,charOffset:0,controlIndex:t.control,cellIndex:c.index,cellParaIndex:op.paragraph,cellPath:[{controlIndex:t.control,cellIndex:c.index,cellParaIndex:op.paragraph}]};
}
