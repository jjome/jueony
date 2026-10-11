import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

function replaceOnce(source, before, after, label) {
  if (source.split(before).length !== 2) throw new Error(`기본 탭 패치 기준 불일치: ${label}`);
  return source.replace(before, after);
}

const defaultTabDialog = `import { ModalDialog } from './dialog';
import type { CommandServices } from '@/command/types';

/** Section tabStop is stored at twice its effective HWPUNIT distance. */
export class DefaultTabSpacingDialog extends ModalDialog {
  private spacing!: HTMLInputElement;
  private scope!: HTMLSelectElement;
  private error!: HTMLParagraphElement;
  private before: number[];
  private revision: string | undefined;
  constructor(private services: CommandServices, private sectionIdx: number, private applied: (raw: number) => void) {
    super('기본 탭 간격', 380);
    this.revision = (window as any).jueonyEditor?.revision?.();
    this.before = Array.from({ length: services.wasm.getSectionCount() }, (_, idx) => services.wasm.getSectionDef(idx).defaultTabSpacing);
  }
  protected createBody(): HTMLElement {
    const body = document.createElement('div');
    body.dataset.jueonyDefaultTabs = 'true';
    const spacingLabel = document.createElement('label');
    spacingLabel.className = 'dialog-row';
    spacingLabel.append('기본 탭 간격: ');
    this.spacing = document.createElement('input');
    this.spacing.type = 'number'; this.spacing.min = '0.1'; this.spacing.max = '9999'; this.spacing.step = '0.1';
    this.spacing.value = ((this.before[this.sectionIdx] || 8000) / 200).toFixed(1);
    this.spacing.setAttribute('aria-label', '기본 탭 간격(pt)');
    spacingLabel.append(this.spacing, ' pt');
    const scopeLabel = document.createElement('label');
    scopeLabel.className = 'dialog-row'; scopeLabel.append('적용 범위: ');
    this.scope = document.createElement('select');
    this.scope.setAttribute('aria-label', '기본 탭 적용 범위');
    for (const [value, title] of [['current', '현재 구역'], ['all', '문서 전체']]) {
      const option = document.createElement('option'); option.value = value; option.textContent = title; this.scope.append(option);
    }
    scopeLabel.append(this.scope);
    const note = document.createElement('p');
    note.textContent = '구역의 기본 탭 간격을 변경합니다. 문단에 지정한 탭 위치는 유지됩니다.';
    this.error = document.createElement('p'); this.error.setAttribute('role', 'alert');
    body.append(spacingLabel, scopeLabel, note, this.error);
    return body;
  }
  protected onConfirm(): boolean {
    const pt = Number(this.spacing.value);
    if (!Number.isFinite(pt) || pt < 0.1 || pt > 9999) {
      this.error.textContent = '0.1~9999 pt의 간격을 입력하세요.'; return false;
    }
    const ih = this.services.getInputHandler();
    if (!ih) { this.error.textContent = '문서 편집기가 준비되지 않았습니다.'; return false; }
    if (this.revision !== (window as any).jueonyEditor?.revision?.()) {
      this.error.textContent = '문서가 변경되었습니다. 대화상자를 다시 열어 주세요.'; return false;
    }
    if (this.services.wasm.getSectionCount() !== this.before.length
      || this.before.some((value, idx) => this.services.wasm.getSectionDef(idx).defaultTabSpacing !== value)) {
      this.error.textContent = '구역 설정이 변경되었습니다. 대화상자를 다시 열어 주세요.'; return false;
    }
    const raw = Math.round(pt * 200);
    const targets = this.scope.value === 'all' ? this.before.map((_, idx) => idx) : [this.sectionIdx];
    if (targets.every(idx => (this.before[idx] || 8000) === raw)) { this.applied(raw); return true; }
    try {
      ih.executeOperation({ kind: 'snapshot', operationType: 'setDefaultTabSpacing', operation: () => {
        if (this.scope.value === 'all') this.services.wasm.setSectionDefAll({ defaultTabSpacing: raw });
        else this.services.wasm.setSectionDef(this.sectionIdx, { defaultTabSpacing: raw });
        return ih.getCursorPosition();
      }});
      this.applied(raw); return true;
    } catch (err) {
      this.error.textContent = err instanceof Error ? err.message : '기본 탭 간격 적용에 실패했습니다.';
      return false;
    }
  }
}
`;

/** Apply only to a generated pinned Studio copy, after the common patches. */
export async function applyTabFeaturePatches({ root }) {
  const edit = async (file, transform) => {
    const path = join(root, 'src', file);
    const source = (await readFile(path, 'utf8')).replace(/\r\n/g, '\n');
    await writeFile(path, transform(source));
  };
  await writeFile(join(root, 'src/ui/default-tab-spacing-dialog.ts'), defaultTabDialog);
  await edit('ui/para-shape-tab-builders.ts', source => {
    source = replaceOnce(source, '  defaultTabLabel: HTMLSpanElement;', '  defaultTabLabel: HTMLSpanElement;\n  defaultTabChangeButton: HTMLButtonElement;', 'change button contract');
    source = replaceOnce(source, '  changeBtn.disabled = true;', '  changeBtn.disabled = false;\n  changeBtn.dataset.jueonyDefaultTabChange = "true";', 'enable change button');
    source = replaceOnce(source, '    defaultTabLabel,\n    renderTabList,', '    defaultTabLabel,\n    defaultTabChangeButton: changeBtn,\n    renderTabList,', 'return change button');
    // Custom tab positions share the ParaShape raw 2x distance convention.
    source = replaceOnce(source, 'const position = Math.round(positionPt * 100);', 'const position = Math.round(positionPt * 200);', 'custom tab input units');
    if (source.split('t.position / 100').length !== 3) throw new Error('사용자 탭 표시 위치 기준 불일치');
    return source.replaceAll('t.position / 100', 't.position / 200');
  });
  await edit('ui/para-shape-dialog.ts', source => {
    source = replaceOnce(source, '  onClose: (() => void) | null = null;', '  onClose: (() => void) | null = null;\n  onDefaultTabSpacingChange: ((applied: (raw: number) => void) => void) | null = null;', 'default tab callback');
    source = replaceOnce(source, '    this.tabResult = buildTabSettingsTab(this.tabState);', `    this.tabResult = buildTabSettingsTab(this.tabState);
    this.tabResult.defaultTabChangeButton.addEventListener('click', () => {
      this.onDefaultTabSpacingChange?.((raw) => {
        this.tabResult.defaultTabLabel.textContent = \`\${((raw || 8000) / 200).toFixed(1)} pt\`;
      });
    });`, 'open default tab dialog');
    return replaceOnce(source, 'const defSpacing = p.defaultTabSpacing ?? 8000;', 'const defSpacing = p.defaultTabSpacing || 8000;', 'zero default display');
  });
  await edit('command/commands/format.ts', source => {
    source = "import { DefaultTabSpacingDialog } from '@/ui/default-tab-spacing-dialog';\n" + source;
    return replaceOnce(source, '      const dialog = new ParaShapeDialog(services.wasm, services.eventBus);', `      const dialog = new ParaShapeDialog(services.wasm, services.eventBus);
      dialog.onDefaultTabSpacingChange = (applied) => {
        const defaultTabs = new DefaultTabSpacingDialog(services, curPos.sectionIndex, applied);
        defaultTabs.afterClose = () => document.querySelector<HTMLElement>('[data-jueony-default-tab-change]')?.focus();
        defaultTabs.show();
      };`, 'format dialog wiring');
  });
  await edit('ui/section-settings-dialog.ts', source => {
    source = replaceOnce(source, "import { applyCommandThroughRouter } from './dialog-apply';", "import { applyCommandThroughRouter, applyThroughRouter } from './dialog-apply';", 'section snapshot import');
    source = replaceOnce(source, 'defaultTabSpacing: Math.max(0, ptToHwpunit(parseFloat(this.defaultTabSpacingInput.value) || 0)),', 'defaultTabSpacing: Math.max(0, Math.round((parseFloat(this.defaultTabSpacingInput.value) || 0) * 200)),', 'section tab raw2x input');
    source = replaceOnce(source, 'this.defaultTabSpacingInput.value = hwpunitToPt(sd.defaultTabSpacing).toFixed(1);', 'this.defaultTabSpacingInput.value = ((sd.defaultTabSpacing || 8000) / 200).toFixed(1);', 'section tab raw2x display');
    source = replaceOnce(source, '    // [구역 설정 이관 → #5769 Stage 4 역연산화]', `    const targets = scope === 'all'
      ? Array.from({ length: this.wasm.getSectionCount() }, (_, idx) => idx) : [this.sectionIdx];
    // A tab-distance change rewrites LineSegs too. Capture the whole document so undo
    // restores the original stored line partitions and geometry, not only SectionDef.
    if (targets.some(idx => this.wasm.getSectionDef(idx).defaultTabSpacing !== newDef.defaultTabSpacing)) {
      return applyThroughRouter({
        services: this.services, label: 'SectionSettingsDialog', operationType: 'setSectionTabSpacing',
        operation: (ih) => { apply(); return ih.getCursorPosition(); },
        fallback: () => { if (apply().ok) this.eventBus.emit('document-changed'); },
      });
    }
    // [구역 설정 이관 → #5769 Stage 4 역연산화]`, 'tab mutation snapshot');
    return source;
  });
  await edit('core/wasm-bridge.ts', source => {
    source = replaceOnce(source, 'setSectionDef(sectionIdx: number, sectionDef: SectionDef):', 'setSectionDef(sectionIdx: number, sectionDef: Partial<SectionDef>):', 'partial section properties');
    return replaceOnce(source, 'setSectionDefAll(sectionDef: SectionDef):', 'setSectionDefAll(sectionDef: Partial<SectionDef>):', 'partial all-section properties');
  });
}
