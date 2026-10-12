import { ModalDialog } from '../../../ui/dialog';

/** The chooser reads a local file once; cancel and stale reads never mutate a document. */
export class DocumentInsertionDialog extends ModalDialog {
  private bytes?: Uint8Array;
  private status!: HTMLParagraphElement;
  private ticket = 0;
  private closed = false;
  constructor(private preflight: (bytes: Uint8Array, name: string) => number, private insert: (bytes: Uint8Array) => void) {
    super('문서 끼워 넣기', 520);
  }
  protected createBody(): HTMLElement {
    const body = document.createElement('div'); body.dataset.jueonyDocumentInsertion = 'true';
    const file = document.createElement('input'); file.type = 'file'; file.accept = '.hwp,.hwpx';
    file.setAttribute('aria-label', '끼워 넣을 한글 문서');
    const info = document.createElement('p');
    info.textContent = '현재 본문 커서에 단일 구역 문서의 본문·표·그림을 넣습니다. 현재 문서의 용지·여백·쪽 설정을 유지합니다. 머리말·꼬리말·각주·필드·도형 등 다른 개체와 여러 구역 문서는 아직 지원하지 않습니다.';
    const limit = document.createElement('p'); limit.textContent = '파일 32 MB, 문단 5,000개, 글자 100,000자, 표 셀 1,000개 이하. 암호 문서는 미지원입니다. 저장·재열기 사전 검사에서 보존할 수 없는 문서는 적용하지 않습니다.';
    this.status = document.createElement('p'); this.status.setAttribute('role', 'status');
    this.status.textContent = '로컬 파일을 선택하세요. 원본 파일은 변경하지 않습니다.';
    file.onchange = async () => {
      const current = ++this.ticket; this.bytes = undefined;
      const selected = file.files?.[0]; if (!selected) return;
      if (selected.size < 1 || selected.size > 32 * 1024 * 1024 || !/\.(hwp|hwpx)$/i.test(selected.name)) {
        this.status.textContent = '32 MB 이하의 HWP/HWPX 파일을 선택하세요.'; return;
      }
      this.status.textContent = '파일과 삽입 결과의 보존 가능성을 검사하고 있습니다…';
      try {
        const bytes = new Uint8Array(await selected.arrayBuffer());
        if (this.closed || current !== this.ticket) return;
        const paragraphs = this.preflight(bytes, selected.name);
        if (this.closed || current !== this.ticket) return;
        this.bytes = bytes; this.status.textContent = `${selected.name} · ${paragraphs}문단 · 사전 검사 통과. 확인을 누르면 삽입합니다.`;
      } catch (error) {
        if (!this.closed && current === this.ticket) this.status.textContent = error instanceof Error ? error.message : String(error);
      }
    };
    body.append(file, info, limit, this.status); return body;
  }
  protected onConfirm(): boolean {
    if (!this.bytes) { this.status.textContent = '파일 선택 후 사전 검사를 통과해야 삽입할 수 있습니다.'; return false; }
    try { this.insert(this.bytes); this.bytes = undefined; return true; }
    catch (error) { this.status.textContent = error instanceof Error ? error.message : String(error); return false; }
  }
  hide(): void { this.closed = true; this.ticket++; this.bytes = undefined; super.hide(); }
}
