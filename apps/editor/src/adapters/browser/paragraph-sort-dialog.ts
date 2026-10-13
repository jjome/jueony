import { ModalDialog } from '../../../ui/dialog';
import type { SortOptions } from '../../modules/document/public/paragraph-sort.ts';
export class ParagraphSortDialog extends ModalDialog {
  private mode!: HTMLSelectElement;
  private column!: HTMLInputElement;
  private descending!: HTMLInputElement;
  private keepFirst!: HTMLInputElement;
  private status!: HTMLParagraphElement;
  constructor(private preview: (options: SortOptions) => string[], private apply: (options: SortOptions) => void) { super('본문 문단 정렬', 570); }
  private options(): SortOptions { return { mode: this.mode.value as SortOptions['mode'], column: Number(this.column.value), descending: this.descending.checked, keepFirst: this.keepFirst.checked }; }
  protected createBody(): HTMLElement {
    const body = document.createElement('div'); body.dataset.jueonyParagraphSort = 'true';
    const help = document.createElement('p'); help.textContent = '같은 쪽·단일 단의 본문 전체 문단을 정렬합니다. 각 문단의 혼합 글자 서식·문단 모양·스타일을 함께 옮깁니다. 자동 번호·개체·필드·표·구역/쪽 경계는 지원하지 않습니다. 한국어 자연 정렬은 한글 2024 정렬 규칙과 별도 비교가 필요합니다.';
    this.mode = document.createElement('select'); this.mode.setAttribute('aria-label', '정렬 종류'); for (const [value, label] of [['text', '문자 (한국어·자연 숫자순)'], ['number', '숫자']]) { const o = document.createElement('option'); o.value = value; o.textContent = label; this.mode.append(o); }
    this.column = document.createElement('input'); this.column.type = 'number'; this.column.min = '0'; this.column.max = '100'; this.column.value = '0'; this.column.setAttribute('aria-label', '정렬 기준 탭 열');
    const columnLabel = document.createElement('label'); columnLabel.append('탭 열 (0: 문단 전체, 1~100: 해당 열) ', this.column);
    const checkbox = (label: string) => { const input = document.createElement('input'); input.type = 'checkbox'; const e = document.createElement('label'); e.append(input, label); body.append(e); return input; };
    body.append(help, this.mode, columnLabel); this.descending = checkbox(' 내림차순'); this.keepFirst = checkbox(' 첫 문단 유지 (제목행)');
    const example = document.createElement('pre'); example.style.cssText = 'white-space:pre-wrap;max-height:180px;overflow:auto'; example.setAttribute('aria-label', '정렬 결과 미리보기');
    this.status = document.createElement('p'); this.status.setAttribute('role', 'status');
    const refresh = () => { try { const rows = this.preview(this.options()); example.textContent = rows.slice(0, 12).join('\n'); this.status.textContent = `${rows.length}개 문단 · 미리보기는 처음 12개 · 한 번에 되돌리기`; } catch (error) { example.textContent = ''; this.status.textContent = error instanceof Error ? error.message : String(error); } };
    for (const field of [this.mode, this.column, this.descending, this.keepFirst]) field.onchange = refresh;
    body.append(example, this.status); refresh(); return body;
  }
  protected onConfirm(): boolean { try { this.apply(this.options()); return true; } catch (error) { this.status.setAttribute('role', 'alert'); this.status.textContent = error instanceof Error ? error.message : String(error); return false; } }
}
