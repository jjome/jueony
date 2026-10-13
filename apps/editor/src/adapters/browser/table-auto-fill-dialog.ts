import { ModalDialog } from '../../../ui/dialog';
import type { TableAutoFillPreview, DateFillUnit } from '../../modules/document/public/table-auto-fill.ts';
export class TableAutoFillDialog extends ModalDialog {
  private status!: HTMLParagraphElement;
  private unit!: HTMLSelectElement;
  constructor(private dates: boolean, private preview: (unit: DateFillUnit) => TableAutoFillPreview, private apply: (unit: DateFillUnit) => void) { super('표 자동 채우기 — 정수·날짜·번호', 510); }
  protected createBody(): HTMLElement {
    const body = document.createElement('div'); body.dataset.jueonyTableAutoFill = 'true';
    this.unit = document.createElement('select'); this.unit.setAttribute('aria-label', '날짜 채우기 간격'); this.unit.disabled = !this.dates;
    for (const [value, label] of [['days', '일 간격'], ['months', '월 간격'], ['years', '년 간격']]) { const option = document.createElement('option'); option.value = value; option.textContent = label; this.unit.append(option); }
    const help = document.createElement('p'), table = document.createElement('table'), count = document.createElement('p'); table.setAttribute('aria-label', '자동 채우기 변경 미리보기');
    const limit = document.createElement('p'); limit.textContent = '본문의 병합 없는 단순 표에서 한 행/열을 지원합니다. 12자리 이하 정수, YYYY-MM-DD·YYYY.MM.DD·YYYY/MM/DD 날짜, 제001호처럼 숫자 하나를 포함한 같은 문자 패턴을 사용하세요. 월·년은 첫 날짜의 일을 기준으로 계산하고 없는 날만 그달 마지막 날로 조정합니다. 예: 1/31→2/28→3/31. 월·년 간격은 직접 선택하며 수식은 추론하지 않습니다. 혼합 글자 서식·보호/중첩/여러 문단 셀은 지원하지 않습니다. 첫 두 셀과 기존 서식·선택하지 않은 셀은 유지합니다.';
    this.status = document.createElement('p'); this.status.setAttribute('role', 'alert');
    const refresh = () => {
      table.replaceChildren(); this.status.textContent = ''; help.textContent = ''; count.textContent = '';
      try {
        const plan = this.preview(this.unit.value as DateFillUnit);
        help.textContent = `첫 두 셀 ${plan.values[0]}, ${plan.values[1]}의 ${plan.description} ${plan.step}을 사용합니다. 나머지 셀의 문자열을 미리보기 값으로 바꿉니다.`;
        const changes = plan.cells.slice(2).flatMap((cell, i) => plan.values[i + 2] === cell.text ? [] : [{ cell, value: plan.values[i + 2] }]);
        for (const { cell, value } of changes.slice(0, 12)) { const row = document.createElement('tr'); for (const text of [`${cell.row + 1}행 ${cell.column + 1}열`, cell.text || '(빈 셀)', '→', value]) { const td = document.createElement('td'); td.textContent = text; td.style.padding = '4px 8px'; row.append(td); } table.append(row); }
        count.textContent = `${plan.cells.length}개 선택 · ${changes.length}개 변경${changes.length > 12 ? ' · 미리보기는 처음 12개만 표시' : ''}`;
      } catch (error) { this.status.textContent = error instanceof Error ? error.message : String(error); }
    };
    this.unit.onchange = refresh; body.append(this.unit, help, table, count, limit, this.status); refresh(); return body;
  }
  protected onConfirm(): boolean { try { this.apply(this.unit.value as DateFillUnit); return true; } catch (error) { this.status.textContent = error instanceof Error ? error.message : String(error); return false; } }
}
