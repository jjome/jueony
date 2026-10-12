import { ModalDialog } from '../../../ui/dialog';
export class PlainTextDialog extends ModalDialog {
  private text!: HTMLTextAreaElement;
  private error!: HTMLParagraphElement;
  constructor(private apply: (text: string) => void) { super('골라 붙이기 — 텍스트만', 560); }
  protected createBody(): HTMLElement {
    const body = document.createElement('div'); body.dataset.jueonyPlainText = 'true';
    const info = document.createElement('p'); info.textContent = '아래에 Ctrl+V로 붙여넣으세요. 외부 서식과 개체를 제외하고 현재 본문 위치의 글자·문단 서식으로 넣습니다. 본문 한 문단의 선택을 여러 줄 텍스트로 바꿀 수 있습니다. 20,000자·200줄 이하, 표·특수 영역은 아직 지원하지 않습니다.';
    this.text = document.createElement('textarea'); this.text.rows = 8; this.text.style.width = '100%'; this.text.setAttribute('aria-label', '붙여넣을 텍스트');
    const read = document.createElement('button'); read.type = 'button'; read.textContent = '클립보드 텍스트 읽기';
    read.onclick = async () => { try { const text = await navigator.clipboard.readText(); if (this.text.isConnected) { this.text.value = text; this.error.textContent = ''; } } catch { if (this.error.isConnected) this.error.textContent = '클립보드 읽기 권한이 없습니다. 입력란에 Ctrl+V로 붙여넣으세요.'; } };
    this.error = document.createElement('p'); this.error.setAttribute('role', 'alert'); body.append(info, this.text, read, this.error); return body;
  }
  protected onConfirm(): boolean { try { this.apply(this.text.value); return true; } catch (error) { this.error.textContent = String(error instanceof Error ? error.message : error); return false; } }
}
