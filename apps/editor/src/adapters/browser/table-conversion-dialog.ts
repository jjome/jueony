import { ModalDialog } from '../../../ui/dialog';
import { tableTextSeparators } from '../../modules/document/public/table-conversion.ts';
import type { TableTextSeparator } from '../../modules/document/public/table-conversion.ts';

export class TableConversionDialog extends ModalDialog {
  private select!: HTMLSelectElement;
  private status!: HTMLParagraphElement;
  constructor(private mode: 'text-to-table' | 'table-to-text', private preview: (separator: TableTextSeparator) => { rows: number; columns: number }, private apply: (separator: TableTextSeparator) => void) {
    super(mode === 'text-to-table' ? '문자열을 표로' : '표를 문자열로', 510);
  }
  protected createBody(): HTMLElement {
    const body = document.createElement('div'); body.dataset.jueonyTableConversion = this.mode;
    const label = document.createElement('label'); label.textContent = '셀 구분자 ';
    this.select = document.createElement('select'); this.select.setAttribute('aria-label', '표 변환 구분자');
    for (const separator of tableTextSeparators) {
      const option = document.createElement('option'); option.value = separator;
      option.textContent = { tab: '탭', comma: '쉼표 (,)', semicolon: '세미콜론 (;)' }[separator]; this.select.append(option);
    }
    const help = document.createElement('p');
    help.textContent = this.mode === 'text-to-table'
      ? '선택한 본문 전체 문단을 행으로, 구분자를 셀 경계로 바꿉니다. 따옴표를 CSV 문법으로 해석하거나 공백을 지우지 않습니다. 각 문단의 글자·문단·스타일 서식은 해당 행의 셀에 유지합니다.'
      : '표의 각 행을 본문 문단으로 바꿉니다. 셀 문자열과 글자 서식을 유지하며, 같은 행의 문단·스타일 서식은 같아야 합니다. 표 테두리·배경·크기·셀 배치는 제거됩니다.';
    const limit = document.createElement('p'); limit.textContent = '본문의 100열·1,000셀 이하 단순 표만 지원합니다. 문자열→표는 단일 단이며 같은 쪽에서 시작하는 전체 문단 선택만 지원합니다. 병합·보호·중첩 표·셀의 여러 문단·캡션·개체·문단/셀 안 혼합 글자 서식·자동 번호·글머리표·문단 앞 쪽 나눔은 지원하지 않습니다. 전체 변환을 한 번에 되돌릴 수 있습니다.';
    this.status = document.createElement('p'); this.status.setAttribute('role', 'status');
    const refresh = () => {
      try { const result = this.preview(this.select.value as TableTextSeparator); this.status.textContent = `${result.rows}행 × ${result.columns}열 · 확인하면 저장·재열기 사전 검사 후 변환합니다.`; }
      catch (error) { this.status.textContent = error instanceof Error ? error.message : String(error); }
    };
    this.select.onchange = refresh; label.append(this.select); body.append(label, help, limit, this.status); refresh(); return body;
  }
  protected onConfirm(): boolean {
    try { this.apply(this.select.value as TableTextSeparator); return true; }
    catch (error) { this.status.textContent = error instanceof Error ? error.message : String(error); return false; }
  }
}
