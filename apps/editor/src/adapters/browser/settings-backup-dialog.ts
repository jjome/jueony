import { ModalDialog } from '../../../ui/dialog';
import { userSettings } from '../../../core/user-settings';
import { createSettingsBackup, parseSettingsBackup, readDocumentDefaults, captureSettingsVersion, importSettingsBackup, SETTINGS_BACKUP_KEYS } from '../../modules/preferences/public/index.ts';
const storage = () => ({ getItem: (key: string) => localStorage.getItem(key), setItem: (key: string, value: string) => localStorage.setItem(key, value), removeItem: (key: string) => localStorage.removeItem(key) });
export class SettingsBackupDialog extends ModalDialog {
  private text!: HTMLTextAreaElement;
  private status!: HTMLParagraphElement;
  private before: (string | null)[];
  constructor() { super('편집 환경 내보내기·가져오기', 580); this.before = captureSettingsVersion(storage()); }
  protected createBody(): HTMLElement {
    const body = document.createElement('div'); body.dataset.jueonySettingsBackup = 'true';
    const info = document.createElement('p'); info.textContent = '대표 글꼴·보기·테마·대화상자 옵션·복구 설정·새 문서 기본값을 JSON 파일로 옮깁니다. 문서·업무·채팅·API 키·문서별 커서 위치는 포함하지 않습니다. 가져오기 후 확인을 누르면 현재 편집 환경을 바꿉니다. 열려 있는 문서 내용은 바꾸지 않습니다.';
    const exportButton = document.createElement('button'); exportButton.type = 'button'; exportButton.textContent = '현재 환경 파일로 내보내기'; exportButton.onclick = () => { try { const text = JSON.stringify(createSettingsBackup(userSettings.getAll(), readDocumentDefaults(storage())), null, 2), url = URL.createObjectURL(new Blob([text], { type: 'application/json' })), link = document.createElement('a'); link.href = url; link.download = 'jueony-editor-preferences.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); this.status.textContent = '현재 환경 파일을 내보냈습니다.'; } catch (error) { this.status.textContent = String(error instanceof Error ? error.message : error); } };
    const file = document.createElement('input'); file.type = 'file'; file.accept = '.json,application/json'; file.setAttribute('aria-label', '가져올 환경 파일'); file.onchange = async () => { const selected = file.files?.[0]; if (!selected) return; try { if (selected.size > 256_000) throw new Error('환경 파일은 256KB 이하여야 합니다.'); const text = await selected.text(); parseSettingsBackup(text); if (this.text.isConnected && file.files?.[0] === selected) { this.text.value = text; this.update(); } } catch (error) { if (this.status.isConnected) this.status.textContent = String(error instanceof Error ? error.message : error); } };
    this.text = document.createElement('textarea'); this.text.rows = 7; this.text.style.width = '100%'; this.text.setAttribute('aria-label', '가져올 환경 JSON'); this.text.placeholder = '가져올 환경 파일을 선택하거나 JSON을 붙여넣으세요.'; this.text.oninput = () => this.update();
    this.status = document.createElement('p'); this.status.setAttribute('role', 'status'); body.append(info, exportButton, file, this.text, this.status); return body;
  }
  private update() { try { const backup = parseSettingsBackup(this.text.value); this.status.textContent = `가져오기 준비: 대표 글꼴 ${backup.settings.font.fontSets.length}개 · 테마 ${backup.settings.theme.mode} · 새 문서 기본값 ${backup.documentDefaults.enabled ? '사용' : '꺼짐'}. 확인 전에는 적용하지 않습니다.`; } catch (error) { this.status.textContent = String(error instanceof Error ? error.message : error); } }
  protected onConfirm(): boolean { if (!this.text.value.trim()) return true; try { importSettingsBackup(storage(), this.text.value, this.before); for (const key of SETTINGS_BACKUP_KEYS) window.dispatchEvent(new StorageEvent('storage', { key })); return true; } catch (error) { this.status.textContent = String(error instanceof Error ? error.message : error); return false; } }
}
export function installSettingsBackup(registry: any): void {
  registry.register({ id: 'tool:settings-backup', label: '편집 환경 내보내기·가져오기', opensDialog: true, canExecute: () => true, execute: () => new SettingsBackupDialog().show() });
  const anchor = document.querySelector('.md-item[data-cmd="tool:options"]');
  if (anchor) { const item = document.createElement('div'); item.className = 'md-item'; item.dataset.cmd = 'tool:settings-backup'; const label = document.createElement('span'); label.className = 'md-label'; label.textContent = '편집 환경 내보내기·가져오기'; item.append(label); anchor.after(item); }
}
