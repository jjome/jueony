import { ModalDialog } from '../../../ui/dialog';
import { tablePresets, tablePresetCell, type TablePresetId } from '../../modules/document/public/table-presets.ts';

export class TablePresetsDialog extends ModalDialog {
  private choice!: HTMLSelectElement;
  private titleRow!: HTMLInputElement;
  private status!: HTMLParagraphElement;
  constructor(private preview: (id: TablePresetId, titleRow: boolean) => number, private apply: (id: TablePresetId, titleRow: boolean) => void) { super('기본 표 모양', 520); }
  protected createBody(): HTMLElement {
    const body = document.createElement('div'); body.dataset.jueonyTablePresets = 'true';
    const help = document.createElement('p'); help.textContent = '표 개체 선택은 전체 표, 셀 블록 선택은 해당 직사각형에 적용합니다. 셀 블록의 바깥 경계선은 주변 셀을 바꾸지 않도록 기존 선을 유지하고 내부 선·단색 배경을 바꿉니다. 제목행과 줄무늬는 선택 영역의 첫 행부터 계산하며 병합 셀은 시작 행의 색을 사용합니다. 글자·문단 서식·내용·크기와 선택 밖 셀은 유지합니다. 자체 기본 모양이며 한글 원본 갤러리가 아닙니다. 병합 셀을 일부만 포함하거나 보호 셀·제외 셀·중첩 대상이 있으면 적용하지 않습니다.';
    this.choice = document.createElement('select'); this.choice.setAttribute('aria-label', '표 모양');
    for (const preset of tablePresets) { const option = document.createElement('option'); option.value = preset.id; option.textContent = preset.name; this.choice.append(option); }
    this.titleRow = document.createElement('input'); this.titleRow.type = 'checkbox'; this.titleRow.checked = true;
    const title = document.createElement('label'); title.append(this.titleRow, ' 첫 행을 제목행 색으로 구분');
    const table = document.createElement('table'); table.setAttribute('aria-label', '표 모양 미리보기'); table.style.cssText = 'width:100%;border-collapse:collapse;margin-top:12px';
    this.status = document.createElement('p'); this.status.setAttribute('role', 'status');
    const refresh = () => {
      table.replaceChildren(); const id = this.choice.value as TablePresetId;
      for (let r = 0; r < 4; r++) { const tr = document.createElement('tr'), patch = tablePresetCell(id, r, this.titleRow.checked); for (let c = 0; c < 3; c++) { const td = document.createElement('td'); td.textContent = r === 0 ? ['항목', '내용', '비고'][c] : `예시 ${r}-${c + 1}`; td.style.cssText = `padding:6px;background:${patch.fillColor};border:${id === 'clear' ? 'none' : '1px solid ' + patch.borderLeft.color}`; tr.append(td); } table.append(tr); }
      try { this.status.textContent = `${this.preview(id, this.titleRow.checked)}개 셀에 적용 · 한 번에 되돌리기`; } catch (error) { this.status.textContent = error instanceof Error ? error.message : String(error); }
    };
    this.choice.onchange = refresh; this.titleRow.onchange = refresh;
    body.append(help, this.choice, title, table, this.status); refresh(); return body;
  }
  protected onConfirm(): boolean { try { this.apply(this.choice.value as TablePresetId, this.titleRow.checked); return true; } catch (error) { this.status.textContent = error instanceof Error ? error.message : String(error); this.status.setAttribute('role', 'alert'); return false; } }
}
