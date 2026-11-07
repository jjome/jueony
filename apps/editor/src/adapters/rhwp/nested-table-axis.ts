import type {ControlOp,NestedTable,Snapshot} from '../../modules/document/public/types.ts';
import {projectTableAxis,validateControlOperations,witnessedTrackEdges} from '../../modules/document/public/engine-integration.ts';
import {capturePreservationEvidence,verifyPreservedExport} from './preservation.ts';
import {resourceFingerprint} from './cell-paragraph.ts';
import {rootBodyTexts} from './table-topology-evidence.ts';
import {readNestedAxisCaptions,sameNestedCaptionPlacement} from './nested-axis-captions.ts';
import {readNestedCellFields} from './nested-cell-fields.ts';
import {parsed,readStructure} from './structure.ts';

type AxisOp=Extract<ControlOp,{index:number}>;
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const checked=(v:unknown)=>{if(parsed(v)?.ok!==true)throw Error('문서 엔진이 중첩 표 행·열 변경을 거절했습니다.');};
const path=(table:NestedTable,index:number,paragraph=0)=>[...table.ancestors,{controlIndex:table.control,cellIndex:index,cellParaIndex:paragraph}];

/** Native cursor list slots can be renumbered for an unaffected sibling. Bind
 * cell contents and table controls to their full parent addresses instead. */
function evidence(doc:any,table:NestedTable,structure:ReturnType<typeof readStructure>){
 const captured=capturePreservationEvidence(doc);
 if(captured.issues.length)throw Error('중첩 표의 원래 문서 속성을 모두 읽지 못했습니다.');
 const {cells,controls,text,fields,...document}=captured.values as any;
 const nativeControls=parsed(doc.getControls()),cellFields=readNestedCellFields(doc,cells.map((c:any)=>c.list),fields,nativeControls);
 const addresses=new Map<number,string>(),others:any[]=[],target:any[]=[];
 for(const cell of cells){
  const l=cell.list,parent=l.hostListId===0?'s'+l.sectionIndex:addresses.get(l.hostListId);
  if(parent===undefined)throw Error('중첩 셀 부모의 주소를 확인하지 못했습니다.');
  const tableId=parent+'p'+l.hostPara+'t'+l.controlIndex,id=tableId+'c'+l.cellIndex;
  addresses.set(l.listId,id);
  const field=cellFields.get(l.listId),content={properties:cell.properties,paragraphs:cell.paragraphs,...(field?{field:field.data}:{})};
  if(tableId!==table.id){others.push({id,...content});continue;}
  const leaf=JSON.stringify(path(table,l.cellIndex));
  const first=parsed(doc.getCellCharPropertiesAtByPath(table.section,table.paragraph,leaf,0));
  target[l.cellIndex]={...content,first};
 }
 let extent:any;
 // Cell field markers are bound to their projected owner in target/others.
 const anchoredControls=nativeControls.filter((c:any)=>c.list===0||c.ctrlId==='tbl').map((control:any)=>{
  const parent=control.list===0?0:addresses.get(control.list);
  if(parent===undefined)throw Error('중첩 표 컨트롤 주소를 확인하지 못했습니다.');
  if(parent+'p'+control.para+'t'+control.controlIndex===table.id){
   const {Height,Width,...props}=control.props;extent={width:Width,height:Height};
   return {...control,list:parent,props};
  }
  return {...control,list:parent};
 });
 if(!extent||target.length!==table.cells.length)throw Error('중첩 표 크기와 셀을 모두 확인하지 못했습니다.');
 return {captions:readNestedAxisCaptions(doc,structure,table),document:{...document,fields:fields.filter((f:any)=>f.listId===0),body:rootBodyTexts(doc)},fieldCount:fields.filter((f:any)=>f.listId!==0).length,others,anchoredControls,target,extent,resources:resourceFingerprint(doc.exportHwpx())};
}

export function executeNestedTableAxis(doc:any,base:Snapshot,op:AxisOp){
 validateControlOperations([op],base);
 const original=readStructure(doc),table=original.nestedTables?.find(t=>t.id===op.target);
 if(!table?.axisEditable||!same(base.structure,original))throw Error('중첩 표의 경로·내용 또는 보호 상태가 달라졌습니다.');
 const row=op.kind.endsWith('_row'),insert=op.kind.startsWith('insert_'),size=row?table.rows:table.columns;
 const values='values' in op?op.values:[];
 const before=evidence(doc,table,original),track=row?'height':'width',otherTrack=row?'width':'height';
 const logical={...table,cells:table.cells.map((c,i)=>({...c,properties:before.target[i].properties}))};
 const projected=projectTableAxis(logical,row,insert,op.index,values);
 const templateAt=Math.min(op.index,size-1);
 const coord=row?'row':'column',span=row?'rowSpan':'columnSpan';
 const across=row?'column':'row',acrossSpan=row?'columnSpan':'rowSpan';
 const merged=table.cells.some(c=>c.rowSpan>1||c.columnSpan>1);
 const edges=merged?witnessedTrackEdges(logical,row):undefined;
 const crossEdges=merged&&projected.some(p=>p.sourceIndex===null)?witnessedTrackEdges(logical,!row):undefined;
 const sizes=new Set(logical.cells.filter(c=>c[coord]===templateAt&&c[span]===1).map(c=>c.properties[track]));
 if(!edges&&sizes.size!==1)throw Error('중첩 표의 원래 행 높이 또는 열 너비를 확정할 수 없습니다.');
 const delta=edges?edges[templateAt+1]-edges[templateAt]:[...sizes][0];
 if(!Number.isSafeInteger(delta)||delta<=0)throw Error('중첩 표의 원래 행·열 크기를 읽지 못했습니다.');
 // The native model copies the first matching template on the next track,
 // previous track, then the first single-width owner in this row or column.
 const template=(i:number)=>{
  const candidates=table.cells.filter(c=>c[across]===i&&c[acrossSpan]===1);
  return candidates.find(c=>c[coord]===op.index)??candidates.find(c=>c[coord]===op.index-1)??candidates[0]??table.cells[0];
 };
 const checkpoint=doc.saveSnapshot();
 try{
  checked(doc.editNestedTableAxis(table.section,table.paragraph,JSON.stringify(path(table,0)),row,insert,op.index));
  for(const {cell,sourceIndex} of projected){
   if(sourceIndex===null&&cell.text)checked(doc.insertTextInCellByPath(table.section,table.paragraph,JSON.stringify(path(table,cell.index)),0,cell.text));
  }
  const result=readStructure(doc),updated=result.nestedTables?.find(t=>t.id===table.id);
  if(!updated||updated.rows!==table.rows+(row?(insert?1:-1):0)||
     updated.columns!==table.columns+(row?0:(insert?1:-1))||updated.cells.length!==projected.length)
   throw Error('중첩 표 행·열 변경 결과가 계획과 다릅니다.');
  const withoutTarget=(s:typeof original)=>({...s,nestedTables:s.nestedTables?.filter(t=>t.id!==table.id)});
  const after=evidence(doc,updated,result);
  if(!sameNestedCaptionPlacement(before.captions,after.captions))throw Error('중첩 표의 캡션 또는 형제 표의 배치가 달라졌습니다.');
  if(!same(withoutTarget(original),withoutTarget(result))||!same(before.document,after.document)||before.fieldCount!==after.fieldCount||!same(before.others,after.others)||
     !same(before.anchoredControls,after.anchoredControls)||before.resources!==after.resources||
     after.extent[track]!==before.extent[track]+(insert?delta:-delta)||after.extent[otherTrack]!==before.extent[otherTrack])
   throw Error('중첩 표 편집으로 부모·이웃 표의 내용, 배치 속성 또는 자원이 달라졌습니다.');
  for(const {cell,sourceIndex} of projected){
   const actual=updated.cells[cell.index],content=after.target[cell.index];
   if(actual.row!==cell.row||actual.column!==cell.column||actual.rowSpan!==cell.rowSpan||actual.columnSpan!==cell.columnSpan||actual.text!==cell.text)
    throw Error('중첩 표 셀 좌표 또는 텍스트가 계획과 다릅니다.');
   if(sourceIndex!==null){
    const old=before.target[sourceIndex],change=cell[span]-table.cells[sourceIndex][span];
    const expected=change?{...old,properties:{...old.properties,[track]:old.properties[track]+change*delta}}:old;
    if(!same(content,expected))throw Error('남아야 할 중첩 셀의 문단·서식 또는 크기가 달라졌습니다.');
   }else{
    const i=cell[across],source=before.target[template(i).index],p=content.paragraphs[0];
    const properties={...source.properties,fieldName:'',...(crossEdges?{[track]:delta,[otherTrack]:crossEdges[i+1]-crossEdges[i]}:{})};
    if(!actual.editable||content.field||content.paragraphs.length!==1||!same(content.properties,properties)||!same(content.first,source.first)||
       !same(p.paragraph,source.paragraphs[0].paragraph))throw Error('삽입한 중첩 셀에 원래 행·열의 서식을 적용하지 못했습니다.');
   }
  }
  if(merged||before.fieldCount||before.captions.stored.length){
   const format=doc.getSourceFormat();
   if(!['hwp','hwpx'].includes(format)||!base.name.toLowerCase().endsWith('.'+format))throw Error('중첩 병합 표의 원래 저장 형식을 확인할 수 없습니다.');
   const artifact=format==='hwp'?doc.exportHwpWithReport():doc.exportHwpxWithReport();
   let reopened;
   try{
    const bytes=artifact.takeBytes();
    verifyPreservedExport(doc,bytes,format,artifact.contentLoss(),b=>new doc.constructor(b));
    reopened=new doc.constructor(bytes);
    const stored=readStructure(reopened),child=stored.nestedTables?.find(t=>t.id===table.id);
    if(!child||!same(stored,result)||!same(evidence(reopened,child,stored),after))throw Error('중첩 병합 표 또는 이웃 내용이 저장 후 달라졌습니다.');
   }finally{reopened?.free();artifact.free();}
  }
  const focus=Math.min(op.index,(row?updated.rows:updated.columns)-1);
  const selected=updated.cells.find(c=>c[coord]===focus)??updated.cells.find(c=>c[coord]<focus&&focus<c[coord]+c[span]);
  if(!selected)throw Error('변경한 중첩 행·열의 커서 위치를 확인하지 못했습니다.');
  const cellPath=path(table,selected.index);
  return {sectionIndex:table.section,paragraphIndex:0,parentParaIndex:table.paragraph,...cellPath[0],cellPath,charOffset:0};
 }catch(error){checked(doc.restoreSnapshot(checkpoint));throw error;}
 finally{doc.discardSnapshot(checkpoint);}
}
