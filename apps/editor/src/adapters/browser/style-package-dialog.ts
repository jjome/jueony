import { ModalDialog } from '../../../ui/dialog';
import { parseStylePackage } from '../../modules/document/public/style-package.ts';
import { exportStylePackage, importStyleNames } from '../rhwp/style-package-native.ts';
import {inspectStyleStoredTimeGuard} from '../rhwp/style-stored-time-warning-n013.ts';
export class StylePackageDialog extends ModalDialog {
  private checks: HTMLInputElement[] = [];
  private text!: HTMLTextAreaElement;
  private status!: HTMLParagraphElement;
  private warning!: HTMLLabelElement;
  private warningCheck!: HTMLInputElement;
  private warningText!: HTMLSpanElement;
  private warningEvidence?: string;
  constructor(private wasm: any, private current: () => void, private apply: (text: string) => void) { super('스타일 내보내기·가져오기', 610); }
  protected createBody(): HTMLElement {
    const body = document.createElement('div'); body.dataset.jueonyStylePackage = 'true';
    const help = document.createElement('p'); help.textContent = '기본 글자·문단 스타일을 Jueony JSON 파일로 옮깁니다. 다음 스타일 연결은 자동 포함합니다. 글꼴 파일은 포함하지 않습니다. 번호·개요·테두리·배경·사용자 탭 스타일과 한글 STY 파일은 아직 지원하지 않습니다. 같은 이름은 새 이름으로 추가하고 기존 정의·본문은 유지합니다.';
    const list = document.createElement('div'); list.style.cssText = 'max-height:150px;overflow:auto;border:1px solid #ccd5df;padding:8px';
    for (const style of this.wasm.getStyleList()) { const label = document.createElement('label'); label.style.display = 'block'; const check = document.createElement('input'); check.type = 'checkbox'; check.value = String(style.id); check.checked = style.id === 0; check.setAttribute('aria-label', '내보낼 스타일 ' + style.name); this.checks.push(check); label.append(check, ' ' + style.name); list.append(label); }
    const exportButton = document.createElement('button'); exportButton.type = 'button'; exportButton.textContent = '선택 스타일 내보내기'; exportButton.onclick = () => { try { this.current(); const value = exportStylePackage(this.wasm, this.checks.filter(check => check.checked).map(check => Number(check.value))), url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })), link = document.createElement('a'); link.href = url; link.download = 'jueony-styles.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); this.status.textContent = `다음 스타일 연결을 포함해 ${value.styles.length}개를 내보냈습니다.`; } catch (error) { this.status.textContent = String(error instanceof Error ? error.message : error); } };
    const file = document.createElement('input'); file.type = 'file'; file.accept = '.json,application/json'; file.setAttribute('aria-label', '가져올 스타일 파일'); file.onchange = async () => { const selected = file.files?.[0]; if (!selected) return; try { if (selected.size > 256_000) throw new Error('스타일 파일은 256KB 이하여야 합니다.'); const text = await selected.text(); parseStylePackage(text); if (this.text.isConnected && file.files?.[0] === selected) { this.text.value = text; this.update(); } } catch (error) { if (this.status.isConnected) this.status.textContent = String(error instanceof Error ? error.message : error); } };
    this.text = document.createElement('textarea'); this.text.rows = 5; this.text.style.width = '100%'; this.text.setAttribute('aria-label', '가져올 스타일 JSON'); this.text.placeholder = '스타일 JSON 파일을 선택하거나 붙여넣으세요.'; this.text.oninput = () => this.update();
    this.warning=document.createElement('label');this.warning.hidden=true;this.warningCheck=document.createElement('input');this.warningCheck.type='checkbox';this.warningText=document.createElement('span');this.warning.append(this.warningCheck,this.warningText);
    this.status = document.createElement('p'); this.status.setAttribute('role', 'status'); body.append(help, list, exportButton, file, this.text, this.warning, this.status); return body;
  }
  private update() { try { this.current(); const value = parseStylePackage(this.text.value), names = importStyleNames(this.wasm, value),guard=inspectStyleStoredTimeGuard(this.wasm.borrowDocumentHandle?.()??this.wasm),notice=guard.warnings[0];this.warningEvidence=guard.evidenceSha256;this.warning.hidden=!notice;this.warningText.textContent=notice?' '+notice.message+' 확인했습니다.':'';if(!notice)this.warningCheck.checked=false;this.status.textContent = `가져오기 준비: ${names.length}개 — ${names.slice(0, 8).map(value => value.name).join(', ')}${names.length > 8 ? '…' : ''}. ${notice?notice.message+' 확인란을 선택해야 적용합니다.':'확인 전에는 문서를 바꾸지 않습니다.'}`; } catch (error) { this.warningEvidence=undefined;this.warning.hidden=true;this.warningCheck.checked=false;this.warningText.textContent='';this.status.textContent = String(error instanceof Error ? error.message : error); } }
  protected onConfirm(): boolean { if (!this.text.value.trim()) return true; try { this.current();const guard=inspectStyleStoredTimeGuard(this.wasm.borrowDocumentHandle?.()??this.wasm);if(!this.warningEvidence||guard.evidenceSha256!==this.warningEvidence)throw new Error('문서의 저장 날짜 상태가 바뀌었습니다. 스타일 내용을 다시 확인하세요.');if(guard.warnings.length&&!this.warningCheck.checked)throw new Error(guard.warnings[0].message+' 확인란을 선택하세요.');this.apply(this.text.value); return true; } catch (error) { this.status.textContent = String(error instanceof Error ? error.message : error); return false; } }
}
