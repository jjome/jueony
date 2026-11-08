import type {Table} from '../public/types.ts';

/** Header-row edits require the complete stored band, not a flag inferred from
 * one rendered copy. Other axis operations retain their existing policy. */
export function tableTitleRowPlan(table:Table,row:boolean,insert:boolean,at:number):number|undefined {
  if(!row || !table.cells.some(c=>c.axisPicture) || table.pagination?.repeatHeader!==true)return;
  const count=table.headerRows;
  if(count===0 && table.cells.every(c=>c.properties.isHeader===false))return;
  if(!Number.isSafeInteger(count) || !count || count<0 || count>=table.rows)
    throw Error('반복 제목과 본문의 연속 행 범위를 확인하지 못했습니다.');
  if(!insert && at>=count && table.rows-count===1)
    throw Error('반복 제목 표의 마지막 본문 행은 삭제할 수 없습니다.');
  if(at>=count)return;
  if(table.cells.some(c=>c.properties.isHeader!==(c.row<count) || c.row<count&&c.row+c.rowSpan>count))
    throw Error('반복 제목의 저장 표시 또는 병합 경계가 불분명합니다.');
  if(table.cells.some(c=>c.row<at&&c.row+c.rowSpan>at))
    throw Error('제목의 병합 행 범위를 가로지르는 행 편집은 지원하지 않습니다.');
  if(!insert){
    if(count===1)throw Error('마지막 반복 제목 행은 삭제할 수 없습니다.');
    if(table.cells.some(c=>c.row===at&&(c.rowSpan!==1||c.columnSpan!==1||c.axisPicture||
        c.axisFieldSignature||c.axisFormula||c.properties.fieldName||!c.editable)))
      throw Error('그림·필드·병합 주셀을 소유한 제목 행은 삭제할 수 없습니다.');
  }
  return count+(insert?1:-1);
}
