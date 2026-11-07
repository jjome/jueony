import type {TableCellPathStep} from '../../modules/document/public/types.ts';

/** The root ABI uses physical cell indices. Nested calls require the complete owner path. */
export function tableFormulaCall(doc:any, method:'previewTableFormulaField'|'updateTableFormulaField'|'insertTableFormulaField',
  section:number, paragraph:number, path:readonly TableCellPathStep[], ...args:(string|number)[]) {
  const step=path.at(-1);
  if (!step || step.cellParaIndex!==0) throw Error('계산식 셀의 첫 문단을 지정하세요.');
  if (path.length===1) return doc[method](section,paragraph,step.controlIndex,step.cellIndex,...args);
  const nested=doc[method+'ByPath'];
  if (typeof nested!=='function') throw Error('현재 문서 엔진은 중첩 계산식 편집을 지원하지 않습니다.');
  return nested.call(doc,section,paragraph,JSON.stringify(path),...args);
}
