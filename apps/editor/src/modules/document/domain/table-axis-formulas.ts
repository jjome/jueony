import type {Cell,Table} from '../public/types.ts';
import {columnLetters,formulaGrid,tokenizeTableFormula,type FormulaCoordinate} from './table-formula-plan.ts';

type Projection={cell:Cell;sourceIndex:number|null}[];
type Point=FormulaCoordinate;

function rectangle(first:Point,last:Point):Point[] {
 const cells:Point[]=[];
 for(let row=Math.min(first.row,last.row);row<=Math.max(first.row,last.row);row++)
  for(let column=Math.min(first.column,last.column);column<=Math.max(first.column,last.column);column++)
   cells.push({row,column});
 return cells;
}

function direction(name:string,cell:Cell,rows:number,columns:number):Point[] {
 const {row,column}=cell;
 switch(name){
 case 'LEFT': return column ? rectangle({row,column:0},{row,column:column-1}) : [];
 case 'RIGHT': return column+1<columns ? rectangle({row,column:column+1},{row,column:columns-1}) : [];
 case 'ABOVE': return row ? rectangle({row:0,column},{row:row-1,column}) : [];
 case 'BELOW': return row+1<rows ? rectangle({row:row+1,column},{row:rows-1,column}) : [];
 default: throw Error('계산식 참조 방향을 확인하세요.');
 }
}

/** Follow the original physical owners, including aliases in merged cells.
 * Ranges and directions can move only while they still enumerate the same owners.
 * Keep the original numerical values and result formats for the native postcheck. */
export function projectAxisFormulas(table:Table,projected:Projection,rows:number,columns:number,
 rowAxis:boolean,insert:boolean,at:number) {
 const hosts=table.cells.filter(c=>c.axisFormula);
 if(!hosts.length)return;
 const before=formulaGrid(table).owners,after=formulaGrid({rows,columns,cells:projected.map(p=>p.cell)}).owners;
 const projectedOwner=new Map(projected.map(p=>[p.sourceIndex,p.cell]));
 function mapped(point:Point):Point {
  const owner=before[point.row][point.column],next=projectedOwner.get(owner);
  if(!next)throw Error('계산식이 참조하는 셀을 삭제할 수 없습니다.');
  const pos=rowAxis?point.row:point.column;
  // If a covered slot disappears, its surviving owner still supplies the value.
  const start=rowAxis?next.row:next.column;
  let shifted=pos;
  if(insert && pos>=at)shifted++;
  if(!insert && pos>at)shifted--;
  if(!insert && pos===at)shifted=start;
  const result=rowAxis?{row:shifted,column:point.column}:{row:point.row,column:shifted};
  if(projected[after[result.row]?.[result.column]]?.sourceIndex!==owner)
   throw Error('이동한 계산식 참조의 주 셀을 확인할 수 없습니다.');
  return result;
 }
 function sameMembers(oldPoints:Point[],newPoints:Point[],skipOwner?:number) {
  const old=new Set(oldPoints.map(p=>before[p.row][p.column]));
  const next=new Set(newPoints.map(p=>projected[after[p.row][p.column]].sourceIndex));
  if(skipOwner!==undefined){old.delete(skipOwner);next.delete(skipOwner);}
  if(old.size!==next.size||[...old].some(i=>!next.has(i)))
   throw Error('행·열 변경으로 계산식 범위의 참조 셀이 달라집니다.');
 }
 for(const host of hosts){
  const moved=projectedOwner.get(host.index);
  if(!moved)throw Error('계산식 필드가 있는 셀을 삭제할 수 없습니다.');
  const formula=host.axisFormula!,source=formula.expression,tokens=tokenizeTableFormula(source,table);
  let text='',end=0;
  for(const [i,token] of tokens.entries()){
   const ref=token.reference;
   if(ref){
    const next=mapped(ref);
    if(next.row!==ref.row||next.column!==ref.column){
     text+=source.slice(end,ref.start)+(ref.fixedColumn?'$':'')+columnLetters(next.column)+(ref.fixedRow?'$':'')+(next.row+1);
     end=ref.end;
    }
    if(tokens[i+1]?.raw===':'){
     const last=tokens[i+2]?.reference;
     if(!last)throw Error('계산식 범위 끝의 셀 주소가 필요합니다.');
     sameMembers(rectangle(ref,last),rectangle(next,mapped(last)));
    }
   }else if(token.kind==='name' && ['LEFT','RIGHT','ABOVE','BELOW'].includes(token.raw.toUpperCase())){
    const name=token.raw.toUpperCase();
    sameMembers(direction(name,host,table.rows,table.columns),direction(name,moved,rows,columns),host.index);
   }
  }
  moved.axisFormula={...formula,expression:text+source.slice(end)};
 }
}
