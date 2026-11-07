import { ModalDialog } from '../../../ui/dialog';
import type { TableAutoFillPreview, DateFillUnit, FormulaFillOutput, TableSeries,FillAxis } from '../../modules/document/public/table-auto-fill.ts';
export class TableAutoFillDialog extends ModalDialog {
  private status!: HTMLParagraphElement;
  private unit!: HTMLSelectElement;
  private output!: HTMLSelectElement;
  constructor(private kind: TableSeries['kind'] | 'formula', private preview: (unit: DateFillUnit, output: FormulaFillOutput,axis?:FillAxis) => TableAutoFillPreview, private apply: (unit: DateFillUnit, output: FormulaFillOutput,axis?:FillAxis) => void,private storedField=false,private axis?:FillAxis) { super('표 자동 채우기', 510); }
  protected createBody(): HTMLElement {
    const body = document.createElement('div'); body.dataset.jueonyTableAutoFill = 'true';
    this.unit = document.createElement('select'); this.unit.setAttribute('aria-label', '날짜 채우기 간격'); this.unit.disabled = this.kind !== 'date';
    for (const [value, label] of [['days', '일 간격'], ['months', '월 간격'], ['years', '년 간격']]) { const option = document.createElement('option'); option.value = value; option.textContent = label; this.unit.append(option); }
    this.output = document.createElement('select'); this.output.setAttribute('aria-label', '수식 채우기 방식');
    for (const [value, label] of [['formula', this.storedField?'계산식 필드 복사':'수식 문자열 채우기'], ['value', '현재 계산값 채우기']]) {
      const option = document.createElement('option'); option.value = value; option.textContent = label; this.output.append(option);
    }
    const help = document.createElement('p'), table = document.createElement('table'), count = document.createElement('p'); table.setAttribute('aria-label', '자동 채우기 변경 미리보기');
    const limit = document.createElement('p'); limit.textContent = this.storedField?'계산식 필드는 A1 참조를 대상 셀 위치에 맞춰 옮기고 결과 표시 형식을 유지합니다. 현재 계산값은 일반 셀에 숫자 글자로 저장합니다.':this.kind === 'formula'
      ? '선택을 시작한 셀의 =수식을 복사합니다. A1은 대상까지의 거리만큼 이동하고 $는 행 또는 열을 고정합니다. 문자열은 수식 그대로 저장하고 계산값은 현재 결과를 숫자 글자로 저장합니다. 참조를 바꾼 뒤 다시 채우면 계산값이 갱신됩니다. 200셀 이하 표에서 사칙연산과 SUM·AVERAGE·MIN·MAX·COUNT를 지원합니다.'
      : '첫 두 셀에 정수, 제001호 같은 번호, 또는 같은 표기의 날짜를 넣으세요. 2024. 1. 31. (수)처럼 요일을 적으면 날짜에 맞춰 갱신합니다. 월·년 간격은 첫 날짜의 일을 기준으로 계산합니다. 가로·세로로 완전히 포함된 병합 셀은 한 셀로 세며, 중첩 표에서는 선택한 표 안의 셀만 채웁니다.';
    this.status = document.createElement('p'); this.status.setAttribute('role', 'alert');
    const refresh = () => {
      table.replaceChildren(); this.status.textContent = ''; help.textContent = ''; count.textContent = '';
      try {
        const plan = this.preview(this.unit.value as DateFillUnit, this.output.value as FormulaFillOutput,this.axis);
        help.textContent = this.axis?(this.axis==='rows'?'각 행':'각 열')+'의 시작 셀을 기준으로 '+plan.description+'을 채웁니다.':this.kind === 'formula' ? `원본 ${plan.values[0]}의 ${plan.description}을 채웁니다.` : `첫 두 셀 ${plan.values[0]}, ${plan.values[1]}의 ${plan.description} ${plan.step}을 사용합니다. 나머지 셀의 문자열을 미리보기 값으로 바꿉니다.`;
        const changes = plan.cells.slice(plan.seedCount).flatMap((cell, i) => (plan.changedCells?!plan.changedCells.includes(i+plan.seedCount):plan.values[i + plan.seedCount] === cell.text) ? [] : [{ cell, value: plan.values[i + plan.seedCount] }]);
        for (const { cell, value } of changes.slice(0, 12)) { const row = document.createElement('tr'); for (const text of [`${cell.row + 1}행 ${cell.column + 1}열`, cell.text || '(빈 셀)', '→', value]) { const td = document.createElement('td'); td.textContent = text; td.style.padding = '4px 8px'; row.append(td); } table.append(row); }
        count.textContent = `${plan.cells.length}개 선택 · ${changes.length}개 변경${changes.length > 12 ? ' · 미리보기는 처음 12개만 표시' : ''}${plan.relatedCells?.length?' · 범위 밖 연관 계산식 '+plan.relatedCells.length+'개 재계산':''}`;
      } catch (error) { this.status.textContent = error instanceof Error ? error.message : String(error); }
    };
    this.unit.onchange = this.output.onchange = refresh;
    if(this.axis){
      const direction=document.createElement('select');direction.setAttribute('aria-label','직사각형 채우기 방향');
      for(const [value,label] of [['rows','가로 · 각 행의 시작 셀'],['columns','세로 · 각 열의 시작 셀']])direction.add(new Option(label,value));
      direction.value=this.axis;direction.onchange=()=>{this.axis=direction.value as FillAxis;this.unit.value='days';this.output.value='formula';refresh();};
      body.append(direction);this.unit.disabled=false;
      limit.textContent='각 행 또는 열에서 날짜와 번호는 첫 두 셀, 계산식은 첫 셀을 원본으로 사용합니다.';
    }
    if (this.axis||this.kind === 'date') body.append(this.unit);
    if (this.axis||this.kind === 'formula') body.append(this.output);
    body.append(help, table, count, limit, this.status); refresh(); return body;
  }
  protected onConfirm(): boolean { try { this.apply(this.unit.value as DateFillUnit, this.output.value as FormulaFillOutput,this.axis); return true; } catch (error) { this.status.textContent = error instanceof Error ? error.message : String(error); return false; } }
}
