import { ModalDialog } from '../../../ui/dialog';
import { showToast } from '../../../ui/toast';
import { createCalendarFormatPreference } from './calendar-format-preference.ts';
import { calendarStampFormats, formatCalendarStamp } from '../../modules/document/public/index.ts';
import type { CalendarStamp, CalendarStampFormat } from '../../modules/document/public/index.ts';

export class CalendarStampDialog extends ModalDialog {
  private select!: HTMLSelectElement;
  private preview!: HTMLOutputElement;
  private error!: HTMLParagraphElement;
  private stamp: CalendarStamp;
  private format: CalendarStampFormat = 'date-dots';
  private preferenceWarning = '';
  private preference = createCalendarFormatPreference({
    getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value),
  });
  constructor(private clock: () => CalendarStamp, private insert: (text:string) => void) {
    super('날짜/시간 문자열', 460); this.stamp = clock();
    try { this.format = this.preference.read(); }
    catch (error) { this.preferenceWarning = error instanceof Error ? error.message : '날짜 형식을 읽지 못했습니다.'; }
  }
  protected createBody(): HTMLElement {
    const body = document.createElement('div'); body.className = 'dialog-body';
    const label = document.createElement('label'); label.textContent = '형식 ';
    this.select = document.createElement('select'); this.select.setAttribute('aria-label','날짜/시간 형식');
    for (const format of calendarStampFormats) {
      const option = document.createElement('option'); option.value = format; option.textContent = formatCalendarStamp(this.stamp,format); this.select.append(option);
    }
    this.select.value = this.format;
    this.preview = document.createElement('output'); this.preview.setAttribute('aria-label','넣을 날짜/시간'); this.preview.style.cssText = 'display:block;padding:12px 0;font-weight:600';
    const refresh = document.createElement('button'); refresh.type = 'button'; refresh.textContent = '시각 새로고침';
    refresh.onclick = () => { this.stamp = this.clock(); this.update(); };
    this.select.onchange = () => this.update();
    const info = document.createElement('p'); info.textContent = '이 컴퓨터의 현지 시각을 일반 문자열로 넣습니다. 자동 갱신 날짜/시간 필드는 아직 지원하지 않습니다.';
    this.error = document.createElement('p'); this.error.setAttribute('role','alert');
    this.error.textContent = this.preferenceWarning;
    label.append(this.select); body.append(label,this.preview,refresh,info,this.error); this.update(); return body;
  }
  private update() {
    this.preview.value = formatCalendarStamp(this.stamp,this.select.value as CalendarStampFormat);
    [...this.select.options].forEach(option => { option.textContent = formatCalendarStamp(this.stamp,option.value); });
  }
  protected onConfirm(): boolean {
    try { this.insert(formatCalendarStamp(this.stamp,this.select.value)); }
    catch(error) { this.error.textContent = error instanceof Error ? error.message : '날짜/시간을 넣지 못했습니다.'; return false; }
    try { this.preference.save(this.select.value); }
    catch (error) {
      // Text insertion already succeeded; never leave a confirm button that can
      // accidentally insert the same date twice because a preference write failed.
      showToast({ message: `날짜/시간은 넣었습니다. 형식 저장 실패: ${error instanceof Error ? error.message : '저장소를 사용할 수 없습니다.'}` });
    }
    return true;
  }
}
