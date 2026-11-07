export type FillAxis='rows'|'columns';
type Point={row:number;col:number};
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
