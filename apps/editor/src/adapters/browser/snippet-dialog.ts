import { ModalDialog } from '../../../ui/dialog';
import { readSnippetLibrary, updateSnippetLibrary, type SnippetLibrary } from '../../modules/preferences/public/index.ts';
const storage = () => ({ getItem: (key: string) => localStorage.getItem(key), setItem: (key: string, value: string) => localStorage.setItem(key, value) });
export class SnippetDialog extends ModalDialog {
  private library: SnippetLibrary;
  private previousName?: string;
  private select!: HTMLSelectElement;
  private name!: HTMLInputElement;
  private text!: HTMLTextAreaElement;
  private status!: HTMLParagraphElement;
  constructor(private initial: string, private insert: (text: string) => void) { super('공통 상용구', 580); this.library = readSnippetLibrary(storage()); }
  protected createBody(): HTMLElement {
    const body = document.createElement('div'); body.dataset.jueonySnippets = 'true'; const help = document.createElement('p'); help.textContent = '자주 사용하는 문구를 이 컴퓨터의 모든 업무에서 공유합니다. 목록에 저장한 문구는 자동으로 문서나 AI 요청에 들어가지 않습니다. 확인을 누르면 아래 내용을 현재 본문에 넣습니다. 서식·필드·변수 실행은 포함하지 않습니다.';
    this.select = document.createElement('select'); this.select.setAttribute('aria-label', '저장한 상용구'); this.select.onchange = () => { const item = this.library.snippets.find(item => item.name === this.select.value); this.previousName = item?.name; this.name.value = item?.name ?? ''; this.text.value = item?.text ?? this.initial; this.status.textContent = ''; };
    this.name = document.createElement('input'); this.name.maxLength = 100; this.name.placeholder = '상용구 이름'; this.name.setAttribute('aria-label', '상용구 이름'); this.name.style.width = '100%';
    this.text = document.createElement('textarea'); this.text.rows = 8; this.text.style.width = '100%'; this.text.value = this.initial; this.text.setAttribute('aria-label', '상용구 내용');
    const save = document.createElement('button'); save.type = 'button'; save.textContent = '목록에 저장'; save.onclick = () => { try { this.library = updateSnippetLibrary(storage(), this.library, { kind: 'save', previousName: this.previousName, snippet: { name: this.name.value, text: this.text.value } }); this.previousName = this.name.value.trim().normalize('NFC'); this.populate(); this.status.textContent = '상용구를 저장했습니다. 문서는 아직 바꾸지 않았습니다.'; } catch (error) { this.status.textContent = String(error instanceof Error ? error.message : error); } };
    const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '선택 상용구 삭제'; remove.onclick = () => { try { if (!this.previousName) throw new Error('목록에서 삭제할 상용구를 선택하세요.'); this.library = updateSnippetLibrary(storage(), this.library, { kind: 'delete', name: this.previousName }); this.previousName = undefined; this.populate(); this.status.textContent = '목록에서 삭제했습니다. 입력란과 문서 내용은 유지합니다.'; } catch (error) { this.status.textContent = String(error instanceof Error ? error.message : error); } };
    this.status = document.createElement('p'); this.status.setAttribute('role', 'status'); body.append(help, this.select, this.name, this.text, save, remove, this.status); this.populate(); return body;
  }
  private populate() { this.select.replaceChildren(); const fresh = document.createElement('option'); fresh.value = ''; fresh.textContent = '+ 새 상용구'; this.select.append(fresh); for (const item of this.library.snippets) { const option = document.createElement('option'); option.value = item.name; option.textContent = item.name; this.select.append(option); } this.select.value = this.previousName ?? ''; }
  protected onConfirm(): boolean { try { this.insert(this.text.value); return true; } catch (error) { this.status.textContent = String(error instanceof Error ? error.message : error); return false; } }
}
