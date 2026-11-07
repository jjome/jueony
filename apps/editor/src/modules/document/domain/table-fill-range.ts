export type FillAxis='rows'|'columns';
type Point={row:number;col:number};
type FillOwner={index:number;row:number;column:number;rowSpan:number;columnSpan:number};

/** Return physical cells once, in selection order. Never write through a partial merge. */
export type FillBounds={anchor:Point;focus:Point};
export function fillLineOwners<T extends FillOwner>(cells:readonly T[], anchor:Point, focus:Point,bounds:FillBounds={anchor,focus}): T[] {
  const horizontal=anchor.row===focus.row;
  const low=Math.min(horizontal?anchor.col:anchor.row,horizontal?focus.col:focus.row);
  const high=Math.max(horizontal?anchor.col:anchor.row,horizontal?focus.col:focus.row);
  const lane=horizontal?anchor.row:anchor.col;
  const crossStart=horizontal?bounds.anchor.row:bounds.anchor.col,crossEnd=horizontal?bounds.focus.row:bounds.focus.col;
  const owners:T[]=[];
  for(const cell of cells){
    const start=horizontal?cell.column:cell.row, span=horizontal?cell.columnSpan:cell.rowSpan;
    const cross=horizontal?cell.row:cell.column, crossSpan=horizontal?cell.rowSpan:cell.columnSpan;
    if(![start,cross,span,crossSpan].every(Number.isSafeInteger)||span<1||crossSpan<1)
      throw Error('표의 셀 좌표나 병합 크기가 유효하지 않습니다.');
    if(lane<cross||lane>=cross+crossSpan||start>high||start+span-1<low)continue;
    if(cross<Math.min(crossStart,crossEnd)||cross+crossSpan-1>Math.max(crossStart,crossEnd)||start<low||start+span-1>high)
      throw Error('병합 셀이 선택 범위의 경계를 가로지릅니다.');
    owners.push(cell);
  }
  const startOf=(cell:T)=>horizontal?cell.column:cell.row;
  owners.sort((a,b)=>startOf(a)-startOf(b));
  let next=low;
  for(const cell of owners){
    if(startOf(cell)!==next)throw Error('선택 범위에 비어 있거나 겹치는 셀 주소가 있습니다.');
    next+=horizontal?cell.columnSpan:cell.rowSpan;
  }
  if(next!==high+1||owners.length<2)throw Error('채우려면 실제 셀이 두 개 이상 연속되어야 합니다.');
  return (horizontal?focus.col<anchor.col:focus.row<anchor.row)?owners.reverse():owners;
}
export function rectangleFillLines(anchor:Point,focus:Point,axis:FillAxis|undefined,rows:number,columns:number){
  if(![rows,columns,anchor.row,anchor.col,focus.row,focus.col].every(n=>Number.isSafeInteger(n)&&n>=0) ||
    Math.max(anchor.row,focus.row)>=rows || Math.max(anchor.col,focus.col)>=columns)throw Error('자동 채우기 범위가 표 밖에 있습니다.');
  if(axis!==undefined && axis!=='rows' && axis!=='columns')throw Error('채울 방향은 가로 또는 세로여야 합니다.');
  const height=1+Math.abs(focus.row-anchor.row),width=1+Math.abs(focus.col-anchor.col);
  if(height===1 && width===1)throw Error('채울 셀을 두 개 이상 선택하세요.');
  if(height===1||width===1){
    if(axis && axis!==(height===1?'rows':'columns'))throw Error('선택한 범위와 채울 방향이 다릅니다.');
    return [{anchor,focus}];
  }
  if(!axis)throw Error('직사각형 범위에는 가로 또는 세로 채우기 방향이 필요합니다.');
  if(height*width>200)throw Error('직사각형 범위는 한 번에 200셀까지 채울 수 있습니다.');
  return Array.from({length:axis==='rows'?height:width},(_,i)=>{
    if(axis==='rows'){
      const row=anchor.row+i*Math.sign(focus.row-anchor.row);
      return {anchor:{row,col:anchor.col},focus:{row,col:focus.col}};
    }
    const col=anchor.col+i*Math.sign(focus.col-anchor.col);
    return {anchor:{row:anchor.row,col},focus:{row:focus.row,col}};
  });
}
