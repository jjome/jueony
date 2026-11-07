import {nativeDocument,parsed} from './structure.ts';

type CellPosition = {
  sectionIndex: number; parentParaIndex?: number; controlIndex?: number; cellIndex?: number;
  cellParaIndex?: number; cellPath?: {controlIndex:number;cellIndex:number;cellParaIndex:number}[];
};
type Address = [number,number,number,number] | [number,number,string];

function address(pos: CellPosition): Address | undefined {
  if (pos.parentParaIndex === undefined) return;
  if (pos.cellPath && pos.cellPath.length>1) {
    if (pos.cellPath.some(step=>step.cellIndex===65534)) return;
    return [pos.sectionIndex,pos.parentParaIndex,JSON.stringify(pos.cellPath)];
  }
  const step = pos.cellPath?.[0], control = step?.controlIndex ?? pos.controlIndex, cell = step?.cellIndex ?? pos.cellIndex;
  if (control === undefined || cell === undefined || cell === 65534) return;
  return [pos.sectionIndex,pos.parentParaIndex,control,cell];
}

export function formulaInputTarget(wasm: unknown, pos: CellPosition): Address | undefined {
  const loc = address(pos), doc = nativeDocument(wasm);
  if (!loc) return;
  if (loc.length===3) {
    const [section,paragraph,encoded]=loc,path=pos.cellPath!;
    // A cellPath can also traverse a textbox. Probe the native table writer only
    // for a stored field in this exact table and ancestry.
    if (typeof doc.getFieldList!=='function' || !parsed(doc.getFieldList()).some((f:any)=>
      f.fieldType==='formula' && f.location?.sectionIndex===section && f.location?.paraIndex===paragraph &&
      f.location.path?.length===path.length && path.every((step,i)=>{
        const owner=f.location.path[i];
        return owner.type==='cell' && owner.controlIndex===step.controlIndex &&
          (i===path.length-1 || owner.cellIndex===step.cellIndex && owner.paraIndex===step.cellParaIndex);
      }))) return;
    if (typeof doc.tableFormulaInputHasDependentsByPath!=='function' || typeof doc.refreshTableFormulaInputByPath!=='function')
      throw Error('중첩 계산식의 참조 갱신을 지원하는 엔진이 필요합니다.');
    const query=path.at(-1)!.cellParaIndex===0 ? encoded :
      JSON.stringify([...path.slice(0,-1),{...path.at(-1)!,cellParaIndex:0}]);
    if (doc.tableFormulaInputHasDependentsByPath(section,paragraph,query)) return [section,paragraph,query];
    return;
  }
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
  const doc=nativeDocument(wasm);
  const response = parsed(loc.length===3 ? doc.refreshTableFormulaInputByPath(...loc) : doc.refreshTableFormulaInput(...loc));
  if (response?.ok!==true || !Number.isInteger(response.changed) || response.changed<0)
    throw new Error('참조 수식의 저장 결과를 확인할 수 없습니다.');
}
