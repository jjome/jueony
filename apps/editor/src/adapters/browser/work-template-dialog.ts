import { ModalDialog } from '../../../ui/dialog';
import { readWorkTemplate, workTemplates, type WorkTemplateId } from '../../modules/document/public/work-templates.ts';
export class WorkTemplateDialog extends ModalDialog {
  private select!: HTMLSelectElement;
  private preview!: HTMLTextAreaElement;
  private status!: HTMLParagraphElement;
  constructor(private apply: (id: WorkTemplateId) => void) { super('기본 업무 양식', 590); }
  protected createBody(): HTMLElement {
    const body = document.createElement('div'); body.dataset.jueonyWorkTemplate = 'true'; const help = document.createElement('p'); help.textContent = '새 빈 문서에 작성용 기본 양식을 넣습니다. Jueony에서 직접 만든 예시이며 기관의 공식 결재·공문 서식은 아닙니다. 대괄호의 내용을 실제 업무에 맞게 수정하세요. 기존 내용이 있는 문서는 덮어쓰지 않습니다.';
    this.select = document.createElement('select'); this.select.setAttribute('aria-label', '업무 양식 선택'); for (const value of workTemplates) { const option = document.createElement('option'); option.value = value.id; option.textContent = value.name; this.select.append(option); }
    this.preview = document.createElement('textarea'); this.preview.readOnly = true; this.preview.rows = 9; this.preview.style.width = '100%'; this.preview.setAttribute('aria-label', '업무 양식 미리보기'); this.status = document.createElement('p'); this.status.setAttribute('role', 'status'); this.select.onchange = () => this.update(); body.append(help, this.select, this.preview, this.status); this.update(); return body;
  }
  private update() { const value = readWorkTemplate(this.select.value); this.preview.value = value.paragraphs.map(item => item.text).join('\n') + (value.table ? '\n' + value.table.map(row => row.join(' | ')).join('\n') : ''); this.status.textContent = value.description + (value.table ? ` · ${value.table.length}행 ${value.table[0].length}열 표` : ''); }
  protected onConfirm(): boolean { try { this.apply(this.select.value as WorkTemplateId); return true; } catch (error) { this.status.textContent = String(error instanceof Error ? error.message : error); return false; } }
}
