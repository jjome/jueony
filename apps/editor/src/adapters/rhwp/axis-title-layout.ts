import type {Cell,Table,Snapshot,EditOp,DocumentProperties} from '../../modules/document/public/index.ts';
import {nativeDocument} from './structure.ts';
import {axisPictureHeaderEvidence,axisPictureSourceEvidence,sameAxisPicture} from './axis-cell-picture.ts';
import type {SubdivisionCopyMetrics} from './subdivision-canvas-metrics.ts';

const json=(value:any)=>typeof value==='string'?JSON.parse(value):value;
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const pending=new WeakMap<object,{revision:string|undefined;operation:unknown;verify:()=>void}>();
type Projection={cell:Cell;sourceIndex:number|null};
type TitlePlan={doc:any;table:Table;projected:Projection[];properties:(DocumentProperties|undefined)[];
 source:unknown[];readContent:(doc:any,index:number)=>unknown;titles:Map<number,string>|undefined;
 pictures:Map<number,NonNullable<Cell['axisPicture']>>|undefined;row:boolean;insert:boolean;at:number;values:string[];
 copyMetrics?:SubdivisionCopyMetrics;revision?:string};

function frameHeight(doc:any,table:Table,cell:Cell){
 const heights:number[]=[];
 for(let page=0;page<doc.pageCount();page++)for(const frame of json(doc.getPageControlLayout(page)).controls){
  if(frame.type!=='table'||frame.secIdx!==table.section||frame.paraIdx!==table.paragraph||
     frame.controlIdx!==table.control||frame.cellPath?.length)continue;
  const box=frame.cells.find((c:any)=>c.row===cell.row&&c.col===cell.column&&c.rowSpan===cell.rowSpan&&c.colSpan===cell.columnSpan);
  if(!box||!Number.isFinite(box.h)||box.h<=0)throw Error('병합 제목의 원래 쪽별 높이를 확인하지 못했습니다.');
  heights.push(box.h);
 }
 if(!heights.length||heights.some(h=>Math.abs(h-heights[0])>.2))throw Error('반복 제목의 쪽별 높이가 다릅니다.');
 return heights[0];
}

/** Predict only a planned title-width change on an independent native copy.
 * Raw content and dimensions are checked separately from its resulting lines. */
export function prepareAxisTitleLayout(plan:TitlePlan){
 const {doc,table,projected,properties,source,readContent,titles,pictures,row,insert,at,values,copyMetrics,revision}=plan;
 pending.delete(doc);
 const changed=projected.flatMap((p,index)=>p.sourceIndex!==null&&titles?.has(p.sourceIndex)&&
  p.cell.columnSpan!==table.cells[p.sourceIndex].columnSpan?[{...p,index,sourceIndex:p.sourceIndex}]:[]);
 if(row||!changed.length)return;
 if(!pictures||changed.some(p=>table.cells[p.sourceIndex].axisPicture)||
    [...titles!.keys()].some(index=>!projected.some(p=>p.sourceIndex===index)))
  throw Error('열 변경으로 기존 제목 또는 그림 소유 셀이 없어집니다.');
 if(doc.canvasMetricsActive?.()===true&&!copyMetrics)throw Error('병합 제목 사본에 사용할 실제 화면 글꼴 측정이 없습니다.');
 const baselineScreen=axisPictureHeaderEvidence(doc,table,'screen');
 const expectedTable={...table,columns:table.columns+(insert?1:-1),cells:projected.map((p,index)=>
  ({...p.cell,properties:properties[index]??p.cell.properties}))};
 const expected=new Map<number,{portable:string;screen:string;height:number}>();
 let copy:any;
 try{
  copy=new doc.constructor(doc.exportHwpx());copyMetrics?.(copy);
  if(!same([...axisPictureHeaderEvidence(copy,table)], [...titles!])||
     !same([...axisPictureHeaderEvidence(copy,table,'screen')],[...baselineScreen]))
   throw Error('병합 제목 사본의 원래 글줄이 실제 문서와 다릅니다.');
  const beforePictures=axisPictureSourceEvidence(copy,table);
  for(const [index,picture] of pictures)if(!sameAxisPicture(picture,beforePictures.get(index)))
   throw Error('병합 제목 사본의 원래 그림 소유 또는 자원이 다릅니다.');
  const heights=new Map(changed.map(p=>[p.index,frameHeight(copy,table,table.cells[p.sourceIndex])]));
  const method=insert?'insertTableColumn':'deleteTableColumn';
  const result=insert?copy[method](table.section,table.paragraph,table.control,Math.min(at,table.columns-1),at===table.columns):
   copy[method](table.section,table.paragraph,table.control,at);
  if(json(result)?.ok!==true)throw Error('병합 제목의 예정된 열 격자를 조판하지 못했습니다.');
  const portable=axisPictureHeaderEvidence(copy,expectedTable),screen=axisPictureHeaderEvidence(copy,expectedTable,'screen');
  for(const p of changed){
   const info=json(copy.getCellInfo(table.section,table.paragraph,table.control,p.index));
   const props=json(copy.getCellProperties(table.section,table.paragraph,table.control,p.index));
   const height=frameHeight(copy,expectedTable,p.cell);
   if(!same(info,{row:p.cell.row,col:p.cell.column,rowSpan:p.cell.rowSpan,colSpan:p.cell.columnSpan})||
      !same(props,properties[p.index])||!same(readContent(copy,p.index),source[p.sourceIndex])||
      Math.abs(height-heights.get(p.index)!)>.2||!portable.has(p.index)||!screen.has(p.index))
    throw Error('병합 제목의 예정된 너비·범위·원문 또는 높이를 검증하지 못했습니다.');
   expected.set(p.index,{portable:portable.get(p.index)!,screen:screen.get(p.index)!,height});
  }
  const afterPictures=axisPictureSourceEvidence(copy,expectedTable);
  for(const p of projected)if(p.sourceIndex!==null&&pictures.has(p.sourceIndex)&&
   !sameAxisPicture(pictures.get(p.sourceIndex),afterPictures.get(p.cell.index)))
    throw Error('병합 제목의 예정된 열 편집으로 그림 배치가 달라집니다.');
 }finally{copy?.free();}
 const verify=()=>{
  copyMetrics?.assertCurrent();
  const portable=axisPictureHeaderEvidence(doc,expectedTable),screen=axisPictureHeaderEvidence(doc,expectedTable,'screen');
  for(const [index,title] of expected){
   if(portable.get(index)!==title.portable||screen.get(index)!==title.screen||
      Math.abs(frameHeight(doc,expectedTable,expectedTable.cells[index])-title.height)>.2)
    throw Error('병합 제목의 실제 글줄 또는 높이가 독립 사본의 계획과 다릅니다.');
  }
 };
 const operation={kind:insert?'insert_table_column':'delete_table_column',target:table.id,index:at,...(insert?{values}: {})};
 pending.set(doc,{revision,operation,verify});
 return {expected,verify};
}

/** Recheck after the view publishes Canvas metrics inside the same undo unit. */
export function assertAxisTitleResult(wasm:any,base:Snapshot,op:EditOp){
 if(op.kind!=='insert_table_column'&&op.kind!=='delete_table_column')return;
 const table=base.structure?.tables.find(t=>t.id===op.target),insert=op.kind==='insert_table_column';
 if(!table?.pagination?.repeatHeader||!table.cells.some(c=>c.axisPicture)||!table.cells.some(c=>
  c.properties.isHeader===true&&c.columnSpan>1&&(insert?c.column<op.index:c.column<=op.index)&&op.index<c.column+c.columnSpan))return;
 const doc=nativeDocument(wasm),proof=pending.get(doc);
 if(!proof||proof.revision!==base.revision||!same(proof.operation,op))throw Error('병합 제목의 재조판 검증 근거가 없습니다.');
 proof.verify();
}
