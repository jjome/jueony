import { ModalDialog } from '../../../ui/dialog';
import type { TableAutoFillPreview } from '../../modules/document/public/table-auto-fill.ts';
export class TableAutoFillDialog extends ModalDialog {
  private status!: HTMLParagraphElement;
  constructor(private plan: TableAutoFillPreview, private apply: () => void) { super('표 자동 채우기 — 정수·날짜·번호', 510); }
  protected createBody(): HTMLElement {
    const body = document.createElement('div'); body.dataset.jueonyTableAutoFill = 'true';
    const help = document.createElement('p'); help.textContent = `첫 두 셀 ${this.plan.values[0]}, ${this.plan.values[1]}의 ${this.plan.description} ${this.plan.step}을 사용합니다. 셀 순서는 왼쪽→오른쪽 또는 위→아래입니다. 첫 두 셀은 유지하고 나머지 선택한 셀의 문자열을 아래 값으로 바꿉니다.`;
    const table = document.createElement('table'); table.setAttribute('aria-label', '자동 채우기 변경 미리보기');
    const changes = this.plan.cells.slice(2).flatMap((cell, i) => this.plan.values[i + 2] === cell.text ? [] : [{ cell, value: this.plan.values[i + 2] }]);
    for (const { cell, value } of changes.slice(0, 12)) { const row = document.createElement('tr'); for (const text of [`${cell.row + 1}행 ${cell.column + 1}열`, cell.text || '(빈 셀)', '→', value]) { const td = document.createElement('td'); td.textContent = text; td.style.padding = '4px 8px'; row.append(td); } table.append(row); }
    const count = document.createElement('p'); count.textContent = `${this.plan.cells.length}개 선택 · ${changes.length}개 변경${changes.length > 12 ? ' · 미리보기는 처음 12개만 표시' : ''}`;
    const limit = document.createElement('p'); limit.textContent = '본문의 병합 없는 단순 표에서 한 행/열을 지원합니다. 12자리 이하 정수, YYYY-MM-DD·YYYY.MM.DD·YYYY/MM/DD 날짜, 제001호처럼 숫자 하나를 포함한 같은 문자 패턴을 사용하세요. 날짜는 일수 간격이며 월 간격·요일·수식은 추론하지 않습니다. 혼합 글자 서식·보호/중첩/여러 문단 셀은 지원하지 않습니다. 기존 서식과 선택하지 않은 셀은 유지하고 전체 변경을 한 번에 되돌립니다.';
    this.status = document.createElement('p'); this.status.setAttribute('role', 'alert'); body.append(help, table, count, limit, this.status); return body;
  }
  protected onConfirm(): boolean { try { this.apply(); return true; } catch (error) { this.status.textContent = error instanceof Error ? error.message : String(error); return false; } }
}
