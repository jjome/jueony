import {formulaCellPath,type CellLocation} from './stored-table-formula.ts';
import {tableFormulaCall} from './table-formula-location.ts';
import { preflightDocumentEdit } from './edit-preflight.ts';

const raw = (doc: any) => doc.borrowDocumentHandle?.() ?? doc;

export function insertStoredTableFormula(wasm: any, ih: any, at: CellLocation, revision: string, formula: string, resultFormat: string): void {
  const api = (window as any).jueonyEditor;
  const check = () => {
    if (!ih || !api || api.busy() || api.revision() !== revision) throw new Error('문서가 변경되었습니다. 계산식 창을 다시 여세요.');
  };
  check();
  const path=formulaCellPath(at), target=[at.sec, at.ppi, JSON.stringify(path)] as const;
  const length = raw(wasm).getCellParagraphLengthByPath(...target);
  if (length > 4000) throw new Error('계산식 필드를 넣을 셀의 글자 수가 4,000자를 넘습니다.');
  const expected = raw(wasm).getTextInCellByPath(...target, 0, length);
  const apply = (doc: any) => {
    const native = raw(doc);
    if (typeof native.insertTableFormulaField !== 'function') throw new Error('현재 문서 엔진에서 새 계산식 필드 삽입을 지원하지 않습니다.');
    const result = JSON.parse(tableFormulaCall(native,'insertTableFormulaField',at.sec,at.ppi,path,expected,formula,resultFormat));
    if (!result.ok || !Number.isSafeInteger(result.fieldId) || result.formula !== formula ||
      result.command !== formula + '??' + resultFormat + ';;' + result.value || !Array.isArray(result.dependentChanges)) {
      throw new Error('삽입한 계산식 원문과 결과를 확인하지 못했습니다.');
    }
    return JSON.stringify(result);
  };
  let preview: string | undefined;
  preflightDocumentEdit(wasm, scratch => { preview = apply(scratch); });
  check();
  let applied = false;
  ih.executeOperation({ kind: 'snapshot', operationType: 'tableFormula', operation: (current: any) => {
    if (apply(current) !== preview) throw new Error('미리 본 계산식과 실제 삽입한 계산식이 다릅니다.');
    applied = true;
    return ih.getCursorPosition();
  } });
  if (!applied) throw new Error('현재 편집 상태에서는 계산식 필드를 삽입할 수 없습니다.');
}
