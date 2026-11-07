import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export function patchFormulaFormat(source) {
  source = source.replace(/\r\n/g, '\n');
  const begin = '      let displayValue = validated.result;';
  const end = '      // 검증 통과 → 실제 적용 (write_result=true) + 쉼표 기록.';
  if (source.split(begin).length !== 2 || source.split(end).length !== 2) throw new Error('Formula format integration drift');
  const start = source.indexOf(begin), finish = source.indexOf(end, start);
  if (finish < start) throw new Error('Formula format integration order drift');
  source = "import { formatTableFormulaResult } from '../jueony/editor-actions/table-formula-format.ts';\n"
    + source.slice(0, start)
    + '      const formatted = formatTableFormulaResult(validated.result, this.formatSelect.value, this.commaCheck.checked);\n\n'
    + source.slice(finish);
  const replace = (before, after) => {
    if (source.split(before).length !== 2) throw new Error('Formula transaction integration drift');
    source = source.replace(before, after);
  };
  source = "import { readStoredTableFormula, storedFormulaResultFormat, supportsStoredFormulaFunction, updateStoredTableFormula } from '../jueony/adapters/rhwp/stored-table-formula.ts';\n"
    + "import { insertStoredTableFormula } from '../jueony/adapters/rhwp/insert-stored-table-formula.ts';\n" + source;
  replace('  private formulaInput!: HTMLInputElement;', `  private storedField: ReturnType<typeof readStoredTableFormula>;
  private openRevision: string;
  private insertField?: HTMLInputElement;
  private formulaInput!: HTMLInputElement;`);
  replace('    this.ctx = ctx;', `    this.ctx = ctx;
    this.storedField = readStoredTableFormula(wasm, ctx);
    this.openRevision = (window as any).jueonyEditor?.revision();`);
  replace("    this.formulaInput.value = '=';", "    this.formulaInput.value = this.storedField?.formula ?? '=';");
  replace('      FUNCTIONS.forEach(f => this.funcSelect.appendChild', `      const functions = this.storedField ? FUNCTIONS.filter(f => supportsStoredFormulaFunction(f.name)) : FUNCTIONS;
      functions.forEach(f => this.funcSelect.appendChild`);
  replace('      return this.formatSelect;', "      if (this.storedField) this.formatSelect.value = this.storedField.format;\n      return this.formatSelect;");
  replace('    this.commaCheck.checked = true;', '    this.commaCheck.checked = this.storedField?.comma ?? true;');
  replace('    body.appendChild(commaRow);', `    body.appendChild(commaRow);
    if (!this.storedField && typeof this.wasm.borrowDocumentHandle?.()?.insertTableFormulaField === 'function') {
      const label = document.createElement('label');
      label.className = 'formula-row';
      this.insertField = document.createElement('input');
      this.insertField.type = 'checkbox';
      this.insertField.dataset.formulaStorage = 'field';
      this.insertField.addEventListener('change', () => {
        for (const option of Array.from(this.funcSelect.options)) {
          option.disabled = !!this.insertField?.checked && !!option.value && !supportsStoredFormulaFunction(option.value);
        }
      });
      label.append(this.insertField, '계산식 필드로 삽입');
      body.appendChild(label);
    }`);
  replace('      // 먼저 검증 (write_result=false)', `      const livePosition = this.services?.getInputHandler()?.getCursorPosition();
      if (livePosition?.cellPath && livePosition.cellPath.length > 1) throw new Error('중첩 표 안의 계산식 편집은 아직 지원하지 않습니다.');
      if (!livePosition || livePosition.sectionIndex !== this.ctx.sec || livePosition.parentParaIndex !== this.ctx.ppi
        || livePosition.controlIndex !== this.ctx.ci || livePosition.cellIndex !== this.ctx.cellIndex
        || this.openRevision !== (window as any).jueonyEditor?.revision()) {
        throw new Error('문서가 변경되었습니다. 계산식 창을 다시 여세요.');
      }
      if (this.storedField) {
        updateStoredTableFormula(this.wasm, this.services?.getInputHandler(), this.ctx, this.storedField,
          this.openRevision, formula, this.formatSelect.value, this.commaCheck.checked);
        return true;
      }
      if (readStoredTableFormula(this.wasm, this.ctx)) throw new Error('셀에 계산식 필드가 추가되었습니다. 창을 다시 여세요.');
      if (this.insertField?.checked) {
        insertStoredTableFormula(this.wasm, this.services?.getInputHandler(), this.ctx, this.openRevision, formula,
          storedFormulaResultFormat(this.formatSelect.value, this.commaCheck.checked));
        return true;
      }
      // 먼저 검증 (write_result=false)`);
  replace(`      let colCount = 1;
      try {
        const props = this.wasm.getTableProperties(this.ctx.sec, this.ctx.ppi, this.ctx.ci);
        colCount = props.colCount || props.cols || 1;
      } catch {
        colCount = Math.max(1, this.ctx.cellIndex + 1);
      }
      const row = Math.floor(this.ctx.cellIndex / colCount);
      const col = this.ctx.cellIndex % colCount;`, `      const cell = this.wasm.getCellInfo(this.ctx.sec, this.ctx.ppi, this.ctx.ci, this.ctx.cellIndex);
      const row = cell.row, col = cell.col;
      if (![row, col].every(value => Number.isInteger(value) && value >= 0)) throw new Error('계산 결과를 쓸 셀 위치를 확인할 수 없습니다.');`);
  replace('        if (formatted !== null) {\n          try {', '        if (formatted !== null) {');
  replace('          } catch { /* 쉼표 포맷 기록 실패 시 기본값 유지 */ }', '');
  replace(`        this.wasm.evaluateTableFormula(
          this.ctx.sec, this.ctx.ppi, this.ctx.ci,
          row, col, formula, true,
        );`, `        const committed = JSON.parse(this.wasm.evaluateTableFormula(
          this.ctx.sec, this.ctx.ppi, this.ctx.ci,
          row, col, formula, true,
        ));
        if (!committed.ok) throw new Error(committed.error || '계산 결과를 적용하지 못했습니다.');`);
  replace(`      if (ih) {
        ih.executeOperation({`, `      if (ih) {
        let applied = false;
        ih.executeOperation({`);
  replace('          operation: () => { commit(); return ih.getCursorPosition(); },', '          operation: () => { commit(); applied = true; return ih.getCursorPosition(); },');
  replace(`        });
      } else {
        commit();
        this.eventBus.emit('document-changed');
      }`, `        });
        if (!applied) throw new Error('현재 편집 상태에서는 계산 결과를 적용할 수 없습니다.');
      } else {
        throw new Error('편집 기록을 확인할 수 없어 계산 결과를 적용하지 않았습니다.');
      }`);
  return source;
}

export async function applyFormulaFormatPatches({ root }) {
  const file = join(root, 'src/ui/formula-dialog.ts');
  await writeFile(file, patchFormulaFormat(await readFile(file, 'utf8')));
}
