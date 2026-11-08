import {readNestedCellFields} from './nested-cell-fields.ts';
import {axisPictureReader,cellParagraphPictureReader,sameAxisPicture} from './axis-cell-picture.ts';
import {readBodyTableMarkers} from './body-table-markers.ts';
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
type PictureOwner = {table:string;cell:number;paragraphs:Array<{index:number;anchors?:number[]}>;picture:NonNullable<Table['cells'][number]['axisPicture']>};

function pictureOwners(doc:any,tables:Table[],controls:any[],lists:any[],verifiedFieldLists:ReadonlySet<number>=new Set()):PictureOwner[] {
 const owners:PictureOwner[]=[];
 const mixedReader=cellParagraphPictureReader(doc,verifiedFieldLists);
 for(const listId of new Set(controls.filter(c=>c.list!==0&&c.ctrlId==='gso').map(c=>c.list))){
  const matches=lists.filter(l=>l.listId===listId&&l.isCell&&l.hostListId===0);
  if(matches.length!==1)throw Error('그림의 소유 셀 경로가 불명확합니다.');
  const [list]=matches;
  const table=tables.find(t=>t.section===list.sectionIndex&&t.paragraph===list.hostPara&&t.control===list.controlIndex);
  const cell=table?.cells.find(c=>c.index===list.cellIndex);
  if(!table||!cell||table.editable!==true||table.rows*table.columns>200)throw Error('그림의 소유 표를 확인하지 못했습니다.');
  // A merged owner can also have plain paragraphs after its picture paragraph.
  // Require the same native asset and rendering proof for every child.
  const owned=controls.filter(c=>c.list===listId),children=owned.filter(c=>c.ctrlId==='gso');
  const picture=verifiedFieldLists.has(listId)?mixedReader(table.section,table.paragraph,table.control,cell,list.paraCount,owned):cell.axisPicture;
  if(!picture)throw Error('셀 그림의 원본과 화면 배치를 확인하지 못했습니다.');
  const paragraphs=[...new Set<number>(children.map(c=>c.para))].map(index=>{
   const args=[table.section,table.paragraph,table.control,cell.index,index];
   const positions=doc.getCellPictureTextAnchors?.(...args);
   if(!positions)return {index};
   const anchors=Array.from<number>(positions),length=doc.getCellParagraphLength(...args);
   const slots=children.filter(c=>c.para===index);
   if(!anchors.length||anchors.length!==slots.length||anchors.some((n,i)=>!int(n)||n>=length||i>0&&n<anchors[i-1]||
      !int(slots[i].controlIndex)||i>0&&slots[i].controlIndex<=slots[i-1].controlIndex))
    throw Error('셀 문단의 원래 그림 위치를 확인하지 못했습니다.');
   return {index,anchors};
  });
  owners.push({table:table.id,cell:cell.index,paragraphs,picture});
 }
 return owners;
}

function samePictures(before:PictureOwner[],after:PictureOwner[]){
 return before.length===after.length&&before.every((owner,i)=>
  owner.table===after[i].table&&owner.cell===after[i].cell&&same(owner.paragraphs,after[i].paragraphs)&&sameAxisPicture(owner.picture,after[i].picture));
}
/** Match every anonymous native control to its field and owning cursor list.
 * A stored table formula must reproduce its cached result without updating any field. */
function cellFieldBoundaries(d:any,t:Table,tables:Table[],controls:any[],lists:any[]){
 const nested=controls.filter(c=>c.list!==0&&c.ctrlId!=='gso'),allFields=parsed(d.getFieldList());
 if(!Array.isArray(allFields))throw Error();
 if(new Set(allFields.map(f=>f.fieldId)).size!==allFields.length)throw Error();
 const bodyFields=allFields.filter(f=>f.listId===0);
 const fields=allFields.filter(f=>f.listId!==0&&f.cellField!==true);
 // A virtual field has no inline control. Verify the actual path, first
 // paragraph and ID lookup before planning a change to its displayed value.
 const named=allFields.filter(f=>f.cellField===true),names=new Map<string,number>();
 if(named.length||tables.some(table=>table.cells.some(c=>Boolean(c.properties.fieldName)))){
  const owners=readNestedCellFields(d,lists,named,[]);
  for(const f of named){
   if(!owners.has(f.listId)||controls.some(c=>c.list===f.listId))throw Error();
   const loc=f.location,step=loc.path[0];
   if(loc.path.length!==1)throw Error();
   names.set('s'+loc.sectionIndex+'p'+loc.paraIndex+'t'+step.controlIndex+'/'+step.cellIndex,f.fieldId);
  }
 }
 const offsets=[0];
 for(let s=0;s<d.getSectionCount();s++)offsets.push(offsets[s]+d.getParagraphCount(s));
 const fieldEvidence=readBodyTableMarkers(d,controls.filter(c=>c.list===0),offsets,bodyFields,parsed(d.getBookmarks()));
 for(const field of named)fieldEvidence.push({name:field.name,id:field.fieldId,location:field.location});
 const boundaries=new Map<string,number>();
 const formulaTables=new Set<string>(),checkedHosts=new Set<string>();
 if(!Array.isArray(fields)||fields.length!==nested.length)throw Error();
 const remaining=new Map<string,number>();
 for(const c of nested){
  if(c.ctrlId!==''||c.ctrlCh!==0)throw Error();
  const key=c.list+'/'+c.para;
  remaining.set(key,(remaining.get(key)??0)+1);
 }
 const inspected=new Set<number>(bodyFields.map(f=>f.fieldId));
 const verifiedFieldLists=new Set<number>();
 const ranges=new Map<string,Array<[number,number]>>();
 for(const field of fields){
  const loc=field.location,step=loc?.path?.[0];
  if(!['clickhere','formula'].includes(field.fieldType)||field.cellField!==false||
     loc?.path?.length!==1||step.type!=='cell'||!int(step.cellIndex)||!int(step.paraIndex)||
     !int(field.startCharIdx)||!int(field.endCharIdx)||field.endCharIdx<field.startCharIdx||field.paraInList!==step.paraIndex)throw Error();
  const host=tables.find(table=>table.section===loc.sectionIndex&&table.paragraph===loc.paraIndex&&table.control===step.controlIndex);
  if(!host)throw Error();
  const list=lists.find(l=>l.hostListId===0&&l.isCell&&l.sectionIndex===host.section&&l.hostPara===host.paragraph&&
   l.controlIndex===host.control&&l.cellIndex===step.cellIndex&&l.listId===field.listId);
  const slot=field.listId+'/'+step.paraIndex,count=remaining.get(slot)??0;
  if(!list||!count||!int(field.fieldId)||inspected.has(field.fieldId))throw Error();
  inspected.add(field.fieldId); remaining.set(slot,count-1);
  if(!checkedHosts.has(host.id)){
   if(host.rows*host.columns>200||host.cellZoneCount!==0)throw Error();
   assertNativeTableWritable(d,host);checkedHosts.add(host.id);
  }
  if(field.fieldType==='formula'){
   const cell=host.cells.find(c=>c.index===step.cellIndex),formula=cell?.axisFormula;
   if(!cell||!formula||formula.fieldId!==field.fieldId)throw Error();
   const preview=parsed(d.previewTableFormulaField(host.section,host.paragraph,host.control,cell.index,
    formula.fieldId,field.command,formula.expression,formula.resultFormat));
   if(preview.ok!==true||preview.fieldId!==formula.fieldId||!Number.isFinite(preview.result)||
      preview.command!==field.command||preview.value!==cell.text||preview.dependentChanges?.length!==0)throw Error();
   formulaTables.add(host.id);fieldEvidence.push({id:formula.fieldId,result:preview.result});
   continue;
  }
  const args=[host.section,host.paragraph,host.control,step.cellIndex,step.paraIndex] as const;
  const info=parsed(d.getFieldInfoAtInCell(...args,field.startCharIdx,false));
  const lookup=parsed(d.getFieldValue(field.fieldId));
  const key=host.id+'/'+step.cellIndex+'/'+step.paraIndex;
  if(!info.inField||info.fieldId!==field.fieldId||info.fieldType!==field.fieldType||info.startCharIdx!==field.startCharIdx||
     info.endCharIdx!==field.endCharIdx||field.endCharIdx>d.getCellParagraphLength(...args)||
     info.editableInForm!==field.editableInForm||info.guideName!==field.guide||typeof info.isGuide!=='boolean'||
     d.getTextInCell(...args,field.startCharIdx,field.endCharIdx-field.startCharIdx)!==field.value||
     lookup.ok!==true||lookup.value!==field.value)throw Error();
  const mixed=controls.some(c=>c.list===field.listId&&c.ctrlId==='gso');
  if(mixed)verifiedFieldLists.add(field.listId);
  fieldEvidence.push({id:field.fieldId,location:loc,info,value:field.value,...(mixed?{stored:field}: {})});
  const group=ranges.get(key)??[];
  group.push([field.startCharIdx,field.endCharIdx]);ranges.set(key,group);
 }
 for(const [key,group] of ranges){
  group.sort((a,b)=>a[0]-b[0]);
  // A shared endpoint has two potential field owners for the same caret.
  if(group.some(([start],i)=>i>0&&start<=group[i-1][1]))throw Error();
  boundaries.set(key,group[group.length-1][1]+1);
 }
 const pictures=pictureOwners(d,tables,controls,lists,verifiedFieldLists);
 return {boundaries,fieldRanges:ranges,fieldEvidence,names,pictures,hasLocalFormula:formulaTables.has(t.id)};
}
/** Keep one original character on each side of every field/picture marker.
 * Only the gaps below the existing suffix boundary need explicit publication. */
function pictureFieldTextRanges(anchors:number[],fields:Array<[number,number]>,boundary:number){
 const blocked=[...anchors.map(a=>[a-1,a+1]),...fields.map(([start,end])=>[start-1,end+1])]
  .sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
 const ranges:Array<{start:number;end:number}>=[];
 let start=0;
 for(const [left,right] of blocked){
  const end=Math.min(left,boundary);
  if(start<end)ranges.push({start,end});
  start=Math.max(start,right);
 }
 if(start<boundary)ranges.push({start,end:boundary});
 return ranges;
}
function readPrivateSources(d:any,tables:Table[],name:string){
 const structure=readStructure(d),sources:Record<string,any>={};
 for(const t of tables){
  let source:any={editable:false};
  try{
   if(!/\.hwpx?$/iu.test(name)||d.getSourceFormat()!==(/\.hwp$/iu.test(name)?'hwp':'hwpx')||t.rows*t.columns>200||!t.cells.some(c=>c.rowSpan*c.columnSpan>1)||t.editable!==true)throw Error();
   assertNativeTableWritable(d,t);
   const controls=parsed(d.getControls()),lists=parsed(d.getCursorModel()).lists;
   if(lists.some((l:any)=>!l.isCell||l.hostListId!==0))throw Error();
   const {boundaries,fieldRanges,fieldEvidence,names,pictures,hasLocalFormula}=cellFieldBoundaries(d,t,structure.tables,controls,lists);
   const p=parsed(d.getTableProperties(t.section,t.paragraph,t.control)),col=parsed(d.getColumnDef(t.section));
   if(p.cellZoneCount!==0||p.hasCaption||p.cellSpacing!==0||p.treatAsChar||p.allowOverlap||p.repeatHeader||p.textWrap!=='TopAndBottom'||p.vertRelTo!=='Para'||p.vertAlign!=='Top'||p.horzRelTo!=='Para'&&p.horzRelTo!=='Column'||p.horzAlign!=='Left'||col.columnCount!==1)throw Error();
   const pages=paragraphPageOwners(d,t);
   let paragraphBudget=0,characterBudget=0;
   const cells=t.cells.map(c=>{
    const count=d.getCellParagraphCount(t.section,t.paragraph,t.control,c.index);if(count<1||count>50||typeof c.properties.verticalAlign!=='number'||![0,1].includes(c.properties.verticalAlign)||c.properties.textDirection!==0)throw Error();
    const pictureParagraphs=pictures.find(owner=>owner.table===t.id&&owner.cell===c.index)?.paragraphs??[];
    const paragraphs=Array.from({length:count},(_,index)=>{
     const args=[t.section,t.paragraph,t.control,c.index,index],length=d.getCellParagraphLength(...args),text=d.getTextInCell(...args,0,length),path=JSON.stringify([{controlIndex:t.control,cellIndex:c.index,cellParaIndex:index}]),runs=parsed(d.getCharShapeRunsInCellByPath(t.section,t.paragraph,path,0,length)),characters=parsed(d.getCellCharPropertiesAt(...args,0)),paragraph=parsed(d.getCellParaPropertiesAt(...args)),style=parsed(d.getCellStyleAt(...args));
     paragraphBudget++;characterBudget+=Array.from(text).length;
     if(paragraphBudget>200||characterBudget>40000||!plain(text)||Array.from(text).length!==length||!Array.isArray(runs)||runs.some((r:any,i:number)=>!int(r.charShapeId)||!int(r.endOffset)||r.startOffset!==(i===0?0:runs[i-1].endOffset)||r.endOffset<=r.startOffset)||(runs.at(-1)?.endOffset??0)!==length||!int(characters.charShapeId)||paragraph.headType!=='None')throw Error();
     const pictureParagraph=pictureParagraphs.find(p=>p.index===index);
     const lastAnchor=pictureParagraph?.anchors?.at(-1);
     // Keep the character immediately after the final picture. It separates the
     // editable suffix from the stored slot even after a deletion or insertion.
     const fieldBoundary=boundaries.get(t.id+'/'+c.index+'/'+index);
     const editableFrom=lastAnchor===undefined?fieldBoundary:Math.max(lastAnchor+1,fieldBoundary??0);
     const anchors=pictureParagraph?.anchors;
     const formatOnlyRanges=anchors?.flatMap((anchor,i)=>{
      const start=Math.max(fieldBoundary??0,i?anchors[i-1]+1:0),end=anchor-1;
      return start<end?[{start,end}]:[];
     });
     const textRanges=anchors&&editableFrom!==undefined?pictureFieldTextRanges(anchors,
      fieldRanges.get(t.id+'/'+c.index+'/'+index)??[],editableFrom):undefined;
     let pictureTextRanges;
     if(textRanges?.length && c.rowSpan*c.columnSpan>1 && anchors){
      try{pictureSpliceLayout(d,t,c.index,index,text,anchors);pictureTextRanges=textRanges;}catch{/* Keep the existing suffix and format-only permissions. */}
     }
     return {index,text,length,characters,paragraph,style,runs,...(pictureParagraph&&lastAnchor===undefined?{pictureParagraph:true}:{}),
      ...(editableFrom===undefined?{}:{editableFrom}),...(formatOnlyRanges?.length?{formatOnlyRanges}:{}),...(pictureTextRanges?{pictureTextRanges}:{})};
    });
    let readOnly=(pictureParagraphs.length>0&&c.rowSpan*c.columnSpan===1)||paragraphs.every(p=>p.pictureParagraph===true);
    if(hasLocalFormula){
     // The native graph resolves covered coordinates to their merged owner.
     // Refuse both referenced owners and any owner whose dependencies cannot be resolved.
     try{readOnly ||= d.tableFormulaInputHasDependents(t.section,t.paragraph,t.control,c.index)!==false;}
     catch{readOnly=true;}
    }
    const nameId=names.get(t.id+'/'+c.index);
    return {index:c.index,row:c.row,column:c.column,rowSpan:c.rowSpan,columnSpan:c.columnSpan,paragraphs,...(nameId===undefined?{}:{nameId}),...(readOnly?{readOnly}: {})};
   });
   if(!cells.some(c=>!c.readOnly&&c.rowSpan*c.columnSpan>1))throw Error();
   const evidence=capturePreservationEvidence(d);if(evidence.issues.length)throw Error('문서 보존 근거를 수집하지 못했습니다.');
   source={editable:true,cells,pages,fieldEvidence,pictures,fingerprint:sha({evidence,fieldEvidence,pictures,resources:resourceFingerprint(d.exportHwpx()),body:rootBodyTexts(d),tables:tableTextTree(structure.tables),cells,properties:p,columns:col,pages,geometry:tableLayoutEvidence(d,t)})};
  }catch(error){
   if(error instanceof Error&&error.message)source.reason=error.message;
  }
  sources[t.id]=source;
 }
 return {structure,sources};
}

export function readCellParagraphSources(wasm:any,tables:Table[],name:string):Record<string,AgentCellParagraphSource>|undefined {
 const d=nativeDocument(wasm);if(typeof d.setCharShapeIdInCell!=='function'||typeof d.exportHwpx!=='function')return;
 const privateSources=readPrivateSources(d,tables,name).sources;
 return Object.fromEntries(tables.map(t=>{const source=privateSources[t.id];return [t.id,source?.editable===true?{editable:true,fingerprint:source.fingerprint,cells:source.cells.filter((c:any)=>!c.readOnly).map((c:any)=>({index:c.index,row:c.row,column:c.column,rowSpan:c.rowSpan,columnSpan:c.columnSpan,paragraphs:c.paragraphs.filter((p:any)=>!p.pictureParagraph).map((p:any)=>({index:p.index,text:p.text,...(p.editableFrom===undefined?{}:{editableFrom:p.editableFrom}),...(p.formatOnlyRanges?{formatOnlyRanges:p.formatOnlyRanges}:{}),...(p.pictureTextRanges?{pictureTextRanges:p.pictureTextRanges}:{}),...(p.runs.length>1?{formatSpans:p.runs.map((r:any)=>({start:r.startOffset,end:r.endOffset}))}:{})}))}))}:{editable:false,reason:'병합 셀 문단 교체에는 셀마다 원래 행·열과 쪽을 확인할 수 있는 비보호 본문 표가 필요합니다. 경계를 확인할 수 없는 필드·개체·책갈피·중첩 표 또는 여러 쪽의 글줄을 원문과 대조할 수 없는 셀은 편집할 수 없습니다.'}];}));
}
/** Export bytes use portable metrics. Compare their layout with the same
 * temporary metric selection and restore the screen environment synchronously.
 * Actual Canvas screen/reopen parity is an independent browser check. */
function portableLayout<T>(d:any,read:()=>T):T {
 const restore=typeof d.canvasMetricsActive==='function'&&d.canvasMetricsActive()===true;
 if(restore)d.selectCanvasMetrics(false);
 try{return read();}finally{if(restore)d.selectCanvasMetrics(true);}
}
/** A style boundary can split a published run. Compare every character's
 * original public offset and absolute box, plus all table and picture frames. */
function pictureTextLayout(doc:any,t:Table,cell:number,paragraph:number,text:string){
 const pages=[],glyphs=[];
 for(let page=0;page<doc.pageCount();page++){
  const controls=parsed(doc.getPageControlLayout(page)).controls.filter((v:any)=>v.type==='image'||v.type==='table');
  pages.push(controls);
  for(const r of parsed(doc.getPageTextLayout(page)).runs){
   if(r.secIdx!==t.section || r.parentParaIdx!==t.paragraph || r.controlIdx!==t.control ||
       r.cellIdx!==cell || r.cellParaIdx!==paragraph)continue;
   const characters=Array.from<string>(r.text);
   if(!int(r.charStart) || ![r.x,r.y,r.h].every(Number.isFinite) || r.h<=0 ||
       !Array.isArray(r.charX) || r.charX.length!==characters.length+1 || !r.charX.every(Number.isFinite))
    throw Error('그림 문단의 원래 글자 배치를 읽지 못했습니다.');
   for(const [i,char] of characters.entries())
    glyphs.push({page,char,offset:r.charStart+i,left:r.x+r.charX[i],right:r.x+r.charX[i+1],y:r.y,h:r.h});
  }
 }
 if(glyphs.map(g=>g.char).join('')!==text)throw Error('그림 문단의 표시 글자와 원문이 다릅니다.');
 return {pages,glyphs};
}
type PictureEdit={start:number;remove:number;insert:string};
/** A prefix/gap splice moves later fields in the visible-text coordinate model.
 * Native HWP positions count scalar characters plus control slots; raw UTF-16
 * slots are separately certified by getCellPictureTextAnchors and roundtrip. */
function remapPictureFields(fields:any[],evidence:any[],t:Table,cell:number,paragraph:number,edit:PictureEdit){
 const delta=Array.from(edit.insert).length-edit.remove,end=edit.start+edit.remove;
 const mapped=new Map<number,any>();
 for(const field of fields){
  const location=field.location,step=location?.path?.[0];
  if(location?.sectionIndex!==t.section||location.paraIndex!==t.paragraph||location.path?.length!==1||
     step?.type!=='cell'||step.controlIndex!==t.control||step.cellIndex!==cell||step.paraIndex!==paragraph)continue;
  const proof=evidence.find(e=>e.id===field.fieldId&&e.stored);
  if(field.cellField!==false||field.fieldType!=='clickhere'||!proof||!same(proof.stored,field)||
     !(end<field.startCharIdx||edit.start>field.endCharIdx))throw Error('누름틀의 원래 경계에 닿거나 이동할 범위가 불명확합니다.');
  if(end<field.startCharIdx){
   for(const key of ['startCharIdx','endCharIdx','startPos','endPos']){
    if(!int(field[key])||!int(field[key]+delta))throw Error('이동한 누름틀 위치를 증명하지 못했습니다.');
    field[key]+=delta;
   }
  }
  mapped.set(field.fieldId,field);
 }
 return evidence.map(e=>{
  const field=mapped.get(e.id);if(!field)return e;
  return {...e,stored:structuredClone(field),info:{...e.info,startCharIdx:field.startCharIdx,endCharIdx:field.endCharIdx}};
 });
}
type PictureLineItem={value:string;x:number;y:number;w:number;h:number};
/** Check the independently navigable lines of the cell against the complete
 * visible text and the native picture slots interleaved with that text. */
function pictureRows(doc:any,t:Table,cell:number,paragraph:number,page:number,items:PictureLineItem[]){
 const near=(a:number,b:number)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=.2;
 const invalid=()=>Error('그림 문단의 줄 경계와 글자·그림 배치를 일치시킬 수 없습니다.');
 const args=[t.section,t.paragraph,t.control,cell,paragraph];
 const count=parsed(doc.getLineInfoInCell(...args,0)).lineCount;
 if(!int(count)||count<1||count>200)throw invalid();
 const ranges=[];
 let item=0,visible=0,lastBottom=-Infinity;
 for(let i=0;i<count;i++){
  const caret=(end:boolean)=>parsed(doc.getCursorRectOnLine(t.section,paragraph,i,end,t.paragraph,t.control,cell,paragraph));
  const left=caret(false),right=caret(true),from=item;
  if(left.pageIndex!==page||right.pageIndex!==page||!near(left.y,right.y)||!near(left.height,right.height)||
     !(left.height>0 && right.x>left.x && left.y>=lastBottom-.2))throw invalid();
  const info=parsed(doc.getLineInfoInCell(...args,visible));
  if(info.lineIndex!==i||info.lineCount!==count||info.charStart!==visible)throw invalid();
  for(;item<items.length;item++){
   const v=items[item];
   if(!near(v.y,left.y))break;
   if(!near(v.x,item===from?left.x:items[item-1].x+items[item-1].w)||
       v.y+v.h>left.y+left.height+.2)throw invalid();
   if(Array.from(v.value).length===1)visible++;
  }
  if(item===from||!near(items[item-1].x+items[item-1].w,right.x)||
     info.charEnd!==(i===count-1?items.length:visible))throw invalid();
  ranges.push({start:from,end:item,x:left.x,y:left.y,height:left.height});
  lastBottom=left.y+left.height;
 }
 if(item!==items.length)throw invalid();
 return ranges;
}
/** Reconstruct the published paragraph in stored slot order. Text on both sides of
 * every image must paint in the owning cell, without crossing its neighbor. */
function pictureSpliceLayout(doc:any,t:Table,cell:number,paragraph:number,text:string,anchors:number[],transition=false){
 const {pages,glyphs}=pictureTextLayout(doc,t,cell,paragraph,text),page=glyphs[0]?.page;
 const invalid=()=>Error('그림과 주변 글자가 원래 셀과 슬롯 순서대로 배치되지 않았습니다.');
 const owns=(v:any)=>v.secIdx===t.section && v.parentParaIdx===t.paragraph && v.cellIdx===cell &&
   v.cellPath?.length===1 && v.cellPath[0].controlIndex===t.control && v.cellPath[0].cellParaIndex===paragraph;
 if(page===undefined || glyphs.some(g=>g.page!==page))throw invalid();
 const images=pages[page].filter((v:any)=>v.type==='image'&&owns(v)).sort((a:any,b:any)=>a.controlIdx-b.controlIdx);
 const outer=pages[page].find((v:any)=>v.type==='table'&&v.secIdx===t.section&&v.paraIdx===t.paragraph&&v.controlIdx===t.control);
 const owner=t.cells[cell],box=outer?.cells.find((c:any)=>c.row===owner.row && c.col===owner.column);
 const lists=parsed(doc.getCursorModel()).lists,owners=lists.filter((l:any)=>l.hostListId===0&&l.isCell&&
  l.sectionIndex===t.section&&l.hostPara===t.paragraph&&l.controlIndex===t.control&&l.cellIndex===cell);
 if(owners.length!==1)throw invalid();
 const slots=parsed(doc.getControls()).filter((c:any)=>c.list===owners[0].listId&&c.para===paragraph&&c.ctrlId==='gso');
 if(!box || images.length!==anchors.length || slots.length!==anchors.length ||
    images.some((v:any,i:number)=>v.controlIdx!==slots[i].controlIndex))throw invalid();
 const line:PictureLineItem[]=[];
 const caretWidths=new Set<number>();
 const carets=new Map<number,any>();
 const caret=(offset:number)=>{
  if(!carets.has(offset))carets.set(offset,parsed(doc.getCursorRectInCell(t.section,t.paragraph,t.control,cell,paragraph,offset)));
  return carets.get(offset);
 };
 const atGlyph=(r:any,x:number,g:typeof glyphs[number])=>r.pageIndex===page && r.cellOverflowed===false &&
   ['x','y','w','h'].every(k=>sameTableLayout(r.cellBounds?.[k],box[k])) &&
   sameTableLayout(r.x,x) && sameTableLayout(r.height,g.h) && r.y+g.h/2>=g.y && r.y+g.h/2<=g.y+g.h;
 let slot=0;
 for(const [i,g] of glyphs.entries()){
  while(slot<anchors.length && anchors[slot]===i){
   const p=images[slot];line.push({value:'pic'+slot,x:p.x,y:p.y,w:p.w,h:p.h});slot++;
  }
  // Canvas can redistribute advances when fitting a changed run to the line.
  // Keep independent start/end caret evidence for bounded paragraphs. A
  // missing or ambiguous endpoint still requires the original glyph width.
  if(transition && glyphs.length<=512 && atGlyph(caret(g.offset),g.left,g) &&
      atGlyph(caret(g.offset+1),g.right,g))caretWidths.add(line.length);
  line.push({value:g.char,x:g.left,y:g.y,w:g.right-g.left,h:g.h});
 }
 if(slot!==anchors.length || line.some(v=>!Number.isFinite(v.w)||v.w<=0||v.x<box.x-.2||v.y<box.y-.2||
      v.x+v.w>box.x+box.w+.2||v.y+v.h>box.y+box.h+.2))throw invalid();
 const wraps=Math.max(...line.map(v=>v.y))>=Math.min(...line.map(v=>v.y+v.h));
 let rows;
 if(wraps)rows=pictureRows(doc,t,cell,paragraph,page,line);
 else if(transition){
  try{rows=pictureRows(doc,t,cell,paragraph,page,line);}catch{/* Retain the existing single-line proof when its layout stays on one line. */}
 }
 if(!wraps && line.some((v,i)=>i>0&&v.x<line[i-1].x+line[i-1].w-.2))throw invalid();
 const controls=pages.map((items:any[])=>items.map(v=>v.type==='image'&&owns(v)?{...v,x:0,y:0}:v));
 const bystanders=Array.from({length:doc.pageCount()},(_,p)=>parsed(doc.getPageTextLayout(p)).runs.filter((r:any)=>!owns(r)));
 let centeredFlow;
 const properties=parsed(doc.getCellProperties(t.section,t.paragraph,t.control,cell));
 if(properties.verticalAlign===1&&paragraph===0&&doc.getCellParagraphCount(t.section,t.paragraph,t.control,cell)===1){
  const p=parsed(doc.getCellParaPropertiesAt(t.section,t.paragraph,t.control,cell,paragraph));
  const path=JSON.stringify([{controlIndex:t.control,cellIndex:cell,cellParaIndex:paragraph}]);
  const runs=parsed(doc.getCharShapeRunsInCellByPath(t.section,t.paragraph,path,0,Array.from(text).length));
  const styles=runs.map((r:any)=>parsed(doc.getCellCharPropertiesAt(t.section,t.paragraph,t.control,cell,paragraph,r.startOffset)));
  const size=styles[0]?.fontSize;
  if(int(size)&&size>0&&styles.every((s:any)=>s.fontSize===size&&!s.subscript&&!s.superscript)&&
     p.alignment==='left'&&p.marginLeft===0&&p.marginRight===0&&p.indent===0&&
     p.lineSpacingType==='Percent'&&Number.isFinite(p.lineSpacing)&&p.lineSpacing>=100&&
     p.fontLineHeight===false&&p.spacingBefore===0&&p.spacingAfter===0)
   centeredFlow={bounds:box,properties,paragraph:p,height:size/75,spacing:size/75*(p.lineSpacing/100-1),
    lineX:box.x+properties.paddingLeft/75};
 }
 return {page,line,rows,wraps,caretWidths,controls,bystanders,centeredFlow};
}
function assertPictureSplice(before:ReturnType<typeof pictureSpliceLayout>,after:ReturnType<typeof pictureSpliceLayout>,
 anchors:number[],edit:PictureEdit){
 const start=edit.start+anchors.filter(a=>a<edit.start).length,tail=start+Array.from(edit.insert).length;
 const oldSuffix=before.line.slice(start+edit.remove),newSuffix=after.line.slice(tail);
 const noLayout={...after,line:before.line,rows:before.rows,wraps:before.wraps};
 if(before.wraps || after.wraps){
  let dy=0;
  const center=before.centeredFlow;
  if(center&&after.centeredFlow&&before.rows?.length&&after.rows?.length&&before.rows.length!==after.rows.length){
   const regular=(rows:NonNullable<typeof before.rows>)=>rows.every((row,i)=>
    sameTableLayout(row.x,center.lineX)&&sameTableLayout(row.height,center.height)&&
    (!i||sameTableLayout(row.y-rows[i-1].y-rows[i-1].height,center.spacing)));
   if(!sameTableLayout(center,after.centeredFlow)||!regular(before.rows)||!regular(after.rows))
    throw Error('가운데 정렬 그림 문단의 원래 줄 높이·간격을 증명하지 못했습니다.');
   const block=(rows:NonNullable<typeof before.rows>)=>rows.at(-1)!.y+rows.at(-1)!.height-rows[0].y;
   dy=(block(before.rows)-block(after.rows))/2;
  }
  const retained=oldSuffix.length===newSuffix.length && oldSuffix.every((v,i)=>{
   const n=newSuffix[i];
   const oldIndex=start+edit.remove+i,newIndex=tail+i;
   // At a freshly wrapped row start, the generic cursor resolves the shared
   // boundary to the preceding row. Accept Canvas reshaping there only when
   // the old glyph has independent caret evidence and the new glyph begins an
   // independently navigable row. pictureRows already proves the new row's
   // start, end and every intervening advance; pictures never use this case.
   const wrappedBoundary=!v.value.startsWith('pic') && (
    before.caretWidths.has(oldIndex) && after.rows?.some(row=>row.start===newIndex)===true ||
    after.caretWidths.has(newIndex) && before.rows?.some(row=>row.start===oldIndex)===true);
   return v.value===n.value && sameTableLayout(v.h,n.h) && (sameTableLayout(v.w,n.w) ||
    before.caretWidths.has(oldIndex) && after.caretWidths.has(newIndex) || wrappedBoundary);
  });
  if(!before.rows || !after.rows)throw Error('여러 줄 그림 문단의 편집 전후 줄 경계를 확인하지 못했습니다.');
  if(!sameTableLayout(before,noLayout))throw Error('여러 줄 그림 문단의 대상 밖 화면 배치가 달라졌습니다.');
  if(!sameTableLayout(before.line.slice(0,start).map(v=>({...v,y:v.y+dy})),after.line.slice(0,start)))
   throw Error('여러 줄 그림 문단에서 편집 범위 앞의 글자·그림 배치가 달라졌습니다.');
  if(!retained)throw Error('여러 줄 그림 문단에서 편집 범위 뒤의 글자·그림 배치가 달라졌습니다.');
  if(!before.rows.slice(0,after.rows.length).every((r,i)=>{
   const q=after.rows![i];return sameTableLayout([r.x,r.y+dy,r.height],[q.x,q.y,q.height]);
  }))throw Error('여러 줄 그림 문단에서 줄 시작 위치가 달라졌습니다.');
  return;
 }
 const dx=newSuffix[0]?.x-oldSuffix[0]?.x;
 const end=(line:typeof before.line,i:number)=>i===0?line[0].x:line[i-1].x+line[i-1].w;
 const widthChange=end(after.line,tail)-end(before.line,start+edit.remove);
 if(!oldSuffix.length || !newSuffix.length || !sameTableLayout(before,noLayout) ||
    !sameTableLayout(before.line[start].x,after.line[start].x) || !sameTableLayout(dx,widthChange) ||
    !sameTableLayout(before.line.slice(0,start),after.line.slice(0,start)) ||
    !sameTableLayout(oldSuffix,newSuffix.map(v=>({...v,x:v.x-dx}))))
  throw Error('교체한 텍스트 폭 이외에 주변 그림·글자 또는 다른 문단의 배치가 바뀌었습니다.');
}
/** Re-read the native assets, properties, and paint operations at each actual
 * path. Neutral positions allow comparison of payloads across a proven splice. */
function picturePayload(doc:any,t:Table,cell:number){
 const lists=parsed(doc.getCursorModel()).lists,list=lists.find((l:any)=>l.isCell&&l.hostListId===0&&l.sectionIndex===t.section&&
   l.hostPara===t.paragraph&&l.controlIndex===t.control&&l.cellIndex===cell);
 if(!list)throw Error('그림의 원래 셀 주소가 없습니다.');
 const controls=parsed(doc.getControls()),children=controls.filter((c:any)=>c.list===list.listId);
 const mixed=children.some((c:any)=>c.ctrlId!=='gso');
 if(mixed){
  const proof=cellFieldBoundaries(doc,t,readStructure(doc).tables,controls,lists);
  if(!proof.pictures.some(p=>p.table===t.id&&p.cell===cell))throw Error('필드와 그림의 원래 소유 문단을 확인하지 못했습니다.');
 }
 const read=mixed?cellParagraphPictureReader(doc,new Set([list.listId])):axisPictureReader(doc);
 const checked=read(t.section,t.paragraph,t.control,t.cells[cell],list.paraCount,
   children.map((v:any)=>({...v,pos:v.controlIndex})));
 if(!checked)throw Error('그림 위치별 원본 자원과 표시 자원을 다시 확인하지 못했습니다.');
 return checked.signature;
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
 const source=readPrivateSources(d,[proof.table],base.name).sources[op.target];if(source?.editable!==true)throw new Error(source?.reason||'교체 후 병합 셀 문단을 검증하지 못했습니다.');
 const targetPicture=(owner:PictureOwner)=>owner.table===op.target && owner.cell===proof.cellIndex;
 const others=(v:PictureOwner[])=>proof.splice?v.filter(p=>!targetPicture(p)):v;
 if(!samePictures(others(proof.pictures),others(source.pictures)))throw Error('편집 후 셀 그림의 소유 위치, 자원 또는 배치가 달라졌습니다.');
 const checkSplice=(doc:any,original:ReturnType<typeof pictureSpliceLayout>)=>{
  const {anchors,mapped,edit,payload}=proof.splice;
  const current=Array.from(doc.getCellPictureTextAnchors(proof.table.section,proof.table.paragraph,proof.table.control,proof.cellIndex,op.paragraph)??[]);
  if(!same(current,mapped)||picturePayload(doc,proof.table,proof.cellIndex)!==payload)throw Error('그림의 원래 자원 또는 교체 후 슬롯이 계획과 다릅니다.');
  assertPictureSplice(original,pictureSpliceLayout(doc,proof.table,proof.cellIndex,op.paragraph,op.text,mapped,true),anchors,edit);
 };
 if(proof.splice){
  const previous=proof.pictures.find(targetPicture),current=source.pictures.find(targetPicture);
  if(!previous || !current || !same(current.paragraphs,previous.paragraphs.map((p:any)=>p.index===op.paragraph?
      {...p,anchors:proof.splice.mapped}:p)))throw Error('그림을 소유한 다른 문단의 저장 슬롯이 달라졌습니다.');
  checkSplice(d,proof.splice.screen);
 }
 const layout=(doc:any)=>pictureTextLayout(doc,proof.table,proof.cellIndex,op.paragraph,op.text);
 if(proof.pictureText && !sameTableLayout(proof.pictureText.screen,layout(d)))
  throw Error('서식 변경으로 그림 문단의 글자 또는 개체 위치가 달라졌습니다.');
 if(!same(source.fieldEvidence,proof.fieldEvidence))throw Error('문단 편집으로 책갈피, 누름틀 또는 계산식 결과가 달라졌습니다.');
 if(!same(source.pages,proof.pages))throw new Error('문단 편집으로 셀의 쪽 경계가 바뀌어 적용하지 않았습니다.');
 for(const cell of source.cells)for(const para of cell.paragraphs){
  const old=proof.cells.find((c:any)=>c.index===cell.index)?.paragraphs[para.index];
  const target=cell.index===proof.cellIndex&&para.index===op.paragraph;
  if(!old||!same(para.characters,target?proof.firstCharacters:old.characters)||!same(para.paragraph,old.paragraph)||!same(para.style,old.style)||!same(para.runs,target?proof.runs:old.runs))throw new Error('선택 또는 다른 셀 문단의 원래 서식이 달라졌습니다.');
 }
 portableLayout(d,()=>{const format=/\.hwp$/iu.test(base.name)?'hwp':'hwpx';const artifact=format==='hwp'?d.exportHwpWithReport():d.exportHwpxWithReport();let reopened:any;
 try{const loss=JSON.parse(artifact.contentLoss()),bytes=artifact.takeBytes();verifyPreservedExport(d,bytes,format,loss,b=>new d.constructor(b));reopened=new d.constructor(bytes);
  if(proof.splice){checkSplice(d,proof.splice.portable);checkSplice(reopened,proof.splice.portable);}
  if(proof.pictureText && (!sameTableLayout(proof.pictureText.portable,layout(d)) ||
      !sameTableLayout(proof.pictureText.portable,layout(reopened))))
   throw Error('저장한 그림 문단의 글자 또는 개체 위치가 원본과 다릅니다.');
  if(!sameTableLayout(tableLayoutEvidence(d,proof.table),tableLayoutEvidence(reopened,proof.table)))throw new Error('셀 문단 교체 후 실제 저장 재열기 배치가 다릅니다.');
  if(proof.pictures.length){
   const nativePictures=(doc:any)=>cellFieldBoundaries(doc,proof.table,readStructure(doc).tables,parsed(doc.getControls()),parsed(doc.getCursorModel()).lists).pictures;
   const current=nativePictures(d);
   if(current.length!==proof.pictures.length||!samePictures(current,nativePictures(reopened)))throw Error('저장 후 셀 그림의 소유 위치, 자원 또는 배치가 달라졌습니다.');
  }
  if(proof.fieldEvidence.length){
   const stored=cellFieldBoundaries(reopened,proof.table,readStructure(reopened).tables,parsed(reopened.getControls()),parsed(reopened.getCursorModel()).lists);
   if(!same(stored.fieldEvidence,proof.fieldEvidence))throw Error('저장 후 책갈피, 누름틀 또는 계산식 결과가 달라졌습니다.');
  }
 }finally{reopened?.free();artifact.free();}});
}
export function executeCellParagraph(wasm:any,base:Snapshot,op:AgentCellParagraphOp){
 const d=nativeDocument(wasm);pending.delete(d);const plan=cellParagraphPlan(op,base),t=plan.table,structure=readStructure(d),cap=readCellParagraphSources(d,structure.tables,base.name)?.[t.id];
 if(!same(structure,base.structure)||cap?.editable!==true||!same(cap,base.cellParagraphSources?.[t.id]))throw new Error('병합 셀 또는 다른 내용·서식·문서 자원이 바뀌었습니다. 최신 문서로 다시 요청하세요.');
 assertNativeTableWritable(d,t);const source=readPrivateSources(d,[t],base.name).sources[t.id],c=source.cells.find((c:any)=>c.index===plan.cell.index),p=c.paragraphs[op.paragraph];
 const before=capturePreservationEvidence(d);if(before.issues.length)throw new Error('셀 문단 교체 전 전체 보존 정보를 읽지 못했습니다.');const expected=topologySemantics(before.values),target=expected.cells.find((c:any)=>c.list.hostListId===0&&c.list.sectionIndex===t.section&&c.list.hostPara===t.paragraph&&c.list.controlIndex===t.control&&c.list.cellIndex===plan.cell.index);
 if(!target)throw new Error('원래 셀 문단의 보존 정보가 없습니다.');
 if(c.nameId!==undefined&&op.paragraph===0){
  const field=expected.fields.find((f:any)=>f.cellField===true&&f.fieldId===c.nameId);
  if(!field||field.value!==op.originalText)throw Error('원래 이름 셀의 값을 확인하지 못했습니다.');
  field.value=op.text;
  field.endCharIdx=Array.from(op.text).length;
 }
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
 const beforePictures=op.spanFormats?.some(f=>f.start<(p.editableFrom??0));
 const readLayout=()=>pictureTextLayout(d,t,c.index,op.paragraph,op.originalText);
 const pictureText=beforePictures?{screen:readLayout(),portable:portableLayout(d,readLayout)}:undefined;
 let splice,fieldEvidence=source.fieldEvidence,caretOffset=p.editableFrom??0;
 if(plan.pictureEdit){
  const edit=plan.pictureEdit,anchors=Array.from<number>(d.getCellPictureTextAnchors(...args));
  const delta=Array.from(edit.insert).length-edit.remove,mapped=anchors.map(a=>a>edit.start?a+delta:a);
  if(anchors.some(a=>a>=edit.start&&a<=edit.start+edit.remove))throw Error('그림의 저장 슬롯에 닿는 텍스트 교체입니다.');
  const layout=()=>pictureSpliceLayout(d,t,c.index,op.paragraph,op.originalText,anchors,true);
  splice={edit,anchors,mapped,screen:layout(),portable:portableLayout(d,layout),payload:picturePayload(d,t,c.index)};
  fieldEvidence=remapPictureFields(expected.fields,fieldEvidence,t,c.index,op.paragraph,edit);
  if(caretOffset>edit.start)caretOffset+=delta;
 }
 const proof={revision:base.revision,operation:structuredClone(op),table:t,expected,pictureText,splice,runs:formatted?.runs??runs,firstCharacters:formatted?.firstCharacters??firstCharacters,
  pages:source.pages,pictures:source.pictures,fieldEvidence,body:rootBodyTexts(d),text,resources:formatted?.resources??resources,cells:source.cells,cellIndex:c.index};
 // Edit right to left so offsets always refer to the queried source.
 const token=pictureText||splice?d.saveSnapshot():undefined;
 try{for(const edit of [...edits].reverse()){
  const shape=mixed?p.runs[edit.run].charShapeId:p.characters.charShapeId;
  if(edit.remove)checked(d.deleteTextInCell(...args,edit.start,edit.remove));
  if(edit.insert){
   checked(d.insertTextInCell(...args,edit.start,edit.insert));
   checked(d.setCharShapeIdInCell(...args,edit.start,edit.start+Array.from(edit.insert).length,shape));
  }
 }
  for(const range of formatted?.applications??[])checked(d.applyCharFormatInCell(...args,range.start,range.end,range.properties));
  pending.set(d,proof);assertCellParagraphResult(d,base,op);
 }catch(error){if(token!==undefined){pending.delete(d);d.restoreSnapshot(token);}throw error;}
 finally{if(token!==undefined)d.discardSnapshot(token);}
 // Keep the caret in the editable suffix. Focusing a leading field activates it
 // and hides its guide, so the live layout would differ from the saved document.
 return {sectionIndex:t.section,parentParaIndex:t.paragraph,paragraphIndex:op.paragraph,charOffset:caretOffset,controlIndex:t.control,cellIndex:c.index,cellParaIndex:op.paragraph,cellPath:[{controlIndex:t.control,cellIndex:c.index,cellParaIndex:op.paragraph}]};
}
