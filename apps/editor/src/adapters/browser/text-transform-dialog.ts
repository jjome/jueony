import { ModalDialog } from '../../../ui/dialog';
import { textTransformLabels, type TextTransform } from '../../modules/document/public/text-transform.ts';
export class TextTransformDialog extends ModalDialog {
  private select!: HTMLSelectElement;
  private preview!: HTMLTextAreaElement;
  private error!: HTMLParagraphElement;
  constructor(private read: (mode: TextTransform) => string, private apply: (mode: TextTransform) => void) { super('글자 바꾸기', 540); }
  protected createBody(): HTMLElement {
    const body = document.createElement('div'); body.dataset.jueonyTextTransform = 'true';
    const label = document.createElement('label'); label.textContent = '변환 방식 '; this.select = document.createElement('select'); this.select.setAttribute('aria-label', '글자 변환 방식');
    for (const [value, text] of Object.entries(textTransformLabels)) { const option = document.createElement('option'); option.value = value; option.textContent = text; this.select.append(option); } label.append(this.select);
    this.preview = document.createElement('textarea'); this.preview.readOnly = true; this.preview.rows = 7; this.preview.style.width = '100%'; this.preview.setAttribute('aria-label', '글자 변환 미리보기');
    const info = document.createElement('p'); info.textContent = '선택한 본문 또는 같은 단순 표 셀의 글자를 바꿉니다. 선택 밖 글자·혼합 글자 서식·문단 서식은 유지하고 한 번에 되돌립니다. 전각/반각은 영문·숫자·ASCII 기호와 공백을 변환하며 한글·가나·한자 변환은 포함하지 않습니다.';
    this.error = document.createElement('p'); this.error.setAttribute('role', 'alert');
    this.select.onchange = () => this.update(); body.append(label, this.preview, info, this.error); this.update(); return body;
  }
  private update() { try { this.preview.value = this.read(this.select.value as TextTransform).slice(0, 4000); this.error.textContent = ''; } catch (error) { this.preview.value = ''; this.error.textContent = String(error instanceof Error ? error.message : error); } }
  protected onConfirm(): boolean { try { this.apply(this.select.value as TextTransform); return true; } catch (error) { this.error.textContent = String(error instanceof Error ? error.message : error); return false; } }
}
