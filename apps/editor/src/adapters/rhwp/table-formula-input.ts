import {nativeDocument,parsed} from './structure.ts';

type CellPosition = {
  sectionIndex: number; parentParaIndex?: number; controlIndex?: number; cellIndex?: number;
  cellParaIndex?: number; cellPath?: {controlIndex:number;cellIndex:number;cellParaIndex:number}[];
};
type Address = [number,number,number,number];

function address(pos: CellPosition): Address | undefined {
  if (pos.parentParaIndex === undefined || (pos.cellPath?.length ?? 0) > 1) return;
  const step = pos.cellPath?.[0], control = step?.controlIndex ?? pos.controlIndex, cell = step?.cellIndex ?? pos.cellIndex;
  if (control === undefined || cell === undefined || cell === 65534) return;
  return [pos.sectionIndex,pos.parentParaIndex,control,cell];
}

export function formulaInputTarget(wasm: unknown, pos: CellPosition): Address | undefined {
  const loc = address(pos), doc = nativeDocument(wasm);
  if (!loc) return;
  if (typeof doc.tableFormulaInputHasDependents === 'function' && typeof doc.refreshTableFormulaInput === 'function') {
    if (doc.tableFormulaInputHasDependents(...loc)) return loc;
    return;
  }
  const [section, paragraph, control] = loc;
  if (typeof doc.getFieldList === 'function' && parsed(doc.getFieldList()).some((f:any)=>
      f.fieldType==='formula' && f.location?.sectionIndex===section && f.location?.paraIndex===paragraph
      && f.location.path?.[0]?.type==='cell' && f.location.path[0].controlIndex===control))
    throw Error('계산식 참조 셀을 변경하려면 참조 갱신을 지원하는 문서 엔진이 필요합니다.');
}

export function sameInputCell(start: CellPosition, end: CellPosition): boolean {
  const a = address(start), b = address(end);
  return !!a && !!b && a.every((n,k)=>n===b[k]) && (start.cellParaIndex ?? 0)===(end.cellParaIndex ?? 0);
}

export function refreshFormulaInput(wasm: unknown, loc: Address): void {
  const response = parsed(nativeDocument(wasm).refreshTableFormulaInput(...loc));
  if (response?.ok!==true || !Number.isInteger(response.changed) || response.changed<0)
    throw new Error('참조 수식의 저장 결과를 확인할 수 없습니다.');
}
