import type {ControlOp,NestedTable,Snapshot} from '../../modules/document/public/types.ts';
import {projectTableAxis,validateControlOperations} from '../../modules/document/public/engine-integration.ts';
import {capturePreservationEvidence} from './preservation.ts';
import {resourceFingerprint} from './cell-paragraph.ts';
import {parsed,readStructure} from './structure.ts';

type AxisOp=Extract<ControlOp,{index:number}>;
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const checked=(v:unknown)=>{if(parsed(v)?.ok!==true)throw Error('문서 엔진이 중첩 표 행·열 변경을 거절했습니다.');};
const path=(table:NestedTable,index:number,paragraph=0)=>[...table.ancestors,{controlIndex:table.control,cellIndex:index,cellParaIndex:paragraph}];

/** Native cursor list slots can be renumbered for an unaffected sibling. Bind
 * cell contents and table controls to their full parent addresses instead. */
function evidence(doc:any,table:NestedTable){
 const captured=capturePreservationEvidence(doc);
 if(captured.issues.length)throw Error('중첩 표의 원래 문서 속성을 모두 읽지 못했습니다.');
 const {cells,controls,text,...document}=captured.values as any;
 const addresses=new Map<number,string>(),others:any[]=[],target:any[]=[];
 for(const cell of cells){
  const l=cell.list,parent=l.hostListId===0?'s'+l.sectionIndex:addresses.get(l.hostListId);
  if(parent===undefined)throw Error('중첩 셀 부모의 주소를 확인하지 못했습니다.');
  const tableId=parent+'p'+l.hostPara+'t'+l.controlIndex,id=tableId+'c'+l.cellIndex;
  addresses.set(l.listId,id);
  if(tableId!==table.id){others.push({id,properties:cell.properties,paragraphs:cell.paragraphs});continue;}
  const leaf=JSON.stringify(path(table,l.cellIndex));
  const first=parsed(doc.getCellCharPropertiesAtByPath(table.section,table.paragraph,leaf,0));
  target[l.cellIndex]={properties:cell.properties,paragraphs:cell.paragraphs,first};
 }
 let extent:any;
 const anchoredControls=parsed(doc.getControls()).map((control:any)=>{
  const parent=control.list===0?0:addresses.get(control.list);
  if(parent===undefined)throw Error('중첩 표 컨트롤 주소를 확인하지 못했습니다.');
  if(parent+'p'+control.para+'t'+control.controlIndex===table.id){
   const {Height,Width,...props}=control.props;extent={width:Width,height:Height};
   return {...control,list:parent,props};
  }
  return {...control,list:parent};
 });
 if(!extent||target.length!==table.cells.length)throw Error('중첩 표 크기와 셀을 모두 확인하지 못했습니다.');
 return {document,others,anchoredControls,target,extent,resources:resourceFingerprint(doc.exportHwpx())};
}

export function executeNestedTableAxis(doc:any,base:Snapshot,op:AxisOp){
 validateControlOperations([op],base);
 const original=readStructure(doc),table=original.nestedTables?.find(t=>t.id===op.target);
 if(!table?.axisEditable||!same(base.structure,original))throw Error('중첩 표의 경로·내용 또는 보호 상태가 달라졌습니다.');
 const row=op.kind.endsWith('_row'),insert=op.kind.startsWith('insert_'),size=row?table.rows:table.columns;
 const values='values' in op?op.values:[];
 const before=evidence(doc,table),track=row?'height':'width',otherTrack=row?'width':'height';
 const logical={...table,cells:table.cells.map((c,i)=>({...c,properties:before.target[i].properties}))};
 const projected=projectTableAxis(logical,row,insert,op.index,values);
 const templateAt=Math.min(op.index,size-1);
 const donor=(r:number,c:number)=>table.cells.find(cell=>cell.row===(row?templateAt:r)&&cell.column===(row?c:templateAt))!;
 const sizes=new Set(table.cells.filter(c=>(row?c.row:c.column)===templateAt).map(c=>before.target[c.index].properties[track]));
 if(sizes.size!==1)throw Error('중첩 표의 원래 행 높이 또는 열 너비를 확정할 수 없습니다.');
 const delta=[...sizes][0];
 if(!Number.isSafeInteger(delta)||delta<=0)throw Error('중첩 표의 원래 행·열 크기를 읽지 못했습니다.');
 const checkpoint=doc.saveSnapshot();
 try{
  checked(doc.editNestedTableAxis(table.section,table.paragraph,JSON.stringify(path(table,0)),row,insert,op.index));
  for(const {cell,sourceIndex} of projected){
   if(sourceIndex===null&&cell.text)checked(doc.insertTextInCellByPath(table.section,table.paragraph,JSON.stringify(path(table,cell.index)),0,cell.text));
  }
  const result=readStructure(doc),updated=result.nestedTables?.find(t=>t.id===table.id);
  if(!updated?.axisEditable||updated.rows!==table.rows+(row?(insert?1:-1):0)||
     updated.columns!==table.columns+(row?0:(insert?1:-1))||updated.cells.length!==projected.length)
   throw Error('중첩 표 행·열 변경 결과가 계획과 다릅니다.');
  const withoutTarget=(s:typeof original)=>({...s,nestedTables:s.nestedTables?.filter(t=>t.id!==table.id)});
  const after=evidence(doc,updated);
  if(!same(withoutTarget(original),withoutTarget(result))||!same(before.document,after.document)||!same(before.others,after.others)||
     !same(before.anchoredControls,after.anchoredControls)||before.resources!==after.resources||
     after.extent[track]!==before.extent[track]+(insert?delta:-delta)||after.extent[otherTrack]!==before.extent[otherTrack])
   throw Error('중첩 표 편집으로 부모·이웃 표의 내용, 배치 속성 또는 자원이 달라졌습니다.');
  for(const {cell,sourceIndex} of projected){
   const actual=updated.cells[cell.index],content=after.target[cell.index];
   if(actual.row!==cell.row||actual.column!==cell.column||actual.rowSpan!==1||actual.columnSpan!==1||actual.text!==cell.text)
    throw Error('중첩 표 셀 좌표 또는 텍스트가 계획과 다릅니다.');
   if(sourceIndex!==null){
    if(!same(content,before.target[sourceIndex]))throw Error('남아야 할 중첩 셀의 문단·서식 또는 크기가 달라졌습니다.');
   }else{
    const source=before.target[donor(cell.row,cell.column).index],p=content.paragraphs[0];
    if(!actual.editable||content.paragraphs.length!==1||!same(content.properties,source.properties)||!same(content.first,source.first)||
       !same(p.paragraph,source.paragraphs[0].paragraph))throw Error('삽입한 중첩 셀에 원래 행·열의 서식을 적용하지 못했습니다.');
   }
  }
  const selected=updated.cells.find(c=>(row?c.row:c.column)===Math.min(op.index,size-(insert?0:2)))??updated.cells[0];
  const cellPath=path(table,selected.index);
  return {sectionIndex:table.section,paragraphIndex:0,parentParaIndex:table.paragraph,...cellPath[0],cellPath,charOffset:0};
 }catch(error){checked(doc.restoreSnapshot(checkpoint));throw error;}
 finally{doc.discardSnapshot(checkpoint);}
}
