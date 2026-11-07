import { preflightDocumentEdit } from './edit-preflight.ts';

type CellLocation = { sec: number; ppi: number; ci: number; cellIndex: number };
type StoredField = { fieldId: number; command: string; formula: string; format: string; comma: boolean };
const formats = new Map([['default', '%g'], ['integer', '%.0f'], ['decimal1', '%.1f'], ['decimal2', '%.2f']]);
const native = (wasm: any) => wasm.borrowDocumentHandle?.() ?? wasm;

export function readStoredTableFormula(wasm: any, at: CellLocation): StoredField | null {
  const fields = JSON.parse(native(wasm).getFieldList()).filter((f: any) => {
    const p = f.location?.path?.[0];
    return f.fieldType === 'formula' && f.location.sectionIndex === at.sec && f.location.paraIndex === at.ppi
      && p?.type === 'cell' && p.controlIndex === at.ci && p.cellIndex === at.cellIndex;
  });
  if (!fields.length) return null;
  const f = fields[0], command = f.command as string;
  // Keep an unsupported or nested field on the stored-field path so it cannot
  // be overwritten by the ordinal plain-text calculator.
  const parts = command.match(/^(=.*)\?\?(%g|%\.0f|%\.1f|%\.2f)(,?);;[\s\S]*$/u);
  const format = [...formats.entries()].find(([, v]) => v === parts?.[2])?.[0];
  return { fieldId: f.fieldId, command, formula: parts?.[1] ?? '', format: format ?? '', comma: Boolean(parts?.[3]) };
}

export function updateStoredTableFormula(wasm: any, ih: any, at: CellLocation, source: StoredField,
  revision: string, expression: string, format: string, comma: boolean): void {
  const api = (window as any).jueonyEditor, raw = native(wasm);
  if (!ih || !api || api.busy() || api.revision() !== revision) throw new Error('문서가 변경되었습니다. 계산식 창을 다시 여세요.');
  if (typeof raw.previewTableFormulaField !== 'function' || typeof raw.updateTableFormulaField !== 'function') {
    throw new Error('현재 문서 엔진에서 기존 계산식 필드 편집을 지원하지 않습니다.');
  }
  const resultFormat = formats.get(format);
  if (!source.format || !resultFormat) throw new Error('이 계산식의 저장 형식을 확인할 수 없습니다.');
  const args = [at.sec, at.ppi, at.ci, at.cellIndex, source.fieldId, source.command, expression, resultFormat + (comma ? ',' : '')];
  const preview = JSON.parse(raw.previewTableFormulaField(...args));
  if (preview.ok !== true) throw new Error('계산식의 저장 상태를 확인할 수 없습니다.');
  if (preview.command === source.command && !preview.dependentChanges?.length) return;
  const apply = (doc: any) => {
    const actual = JSON.parse(native(doc).updateTableFormulaField(...args));
    if (actual.ok !== true || actual.command !== preview.command || actual.value !== preview.value
      || JSON.stringify(actual.dependentChanges ?? []) !== JSON.stringify(preview.dependentChanges ?? [])) {
      throw new Error('미리 본 계산식 결과와 다릅니다.');
    }
  };
  preflightDocumentEdit(wasm, apply);
  if (api.busy() || api.revision() !== revision) throw new Error('문서가 변경되었습니다. 계산식 창을 다시 여세요.');
  let applied = false;
  ih.executeOperation({ kind: 'snapshot', operationType: 'tableFormula', operation: (current: any) => {
    apply(current); applied = true; return ih.getCursorPosition();
  } });
  if (!applied) throw new Error('현재 편집 상태에서는 계산 결과를 적용할 수 없습니다.');
}
