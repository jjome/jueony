import { TablePresetsDialog } from '../browser/table-presets-dialog.ts';
import { readTablePresetPlan, executeTablePreset, preflightTablePreset } from './table-presets-native.ts';
export function installTablePresets(registry: any, input: () => any, eventBus: any): void {
  const safe = (c: any) => { const ih = input(); return !!ih && c.hasDocument && c.isEditable && !c.isFormMode && c.inTableObjectSelection && !ih.isComposing && !ih.wasm.requiresPasswordForSave && !ih.cursor.isInHeaderFooter() && !ih.cursor.isInFootnote() && !ih.cursor.isInTextBox(); };
  registry.register({ id: 'table:basic-presets', label: '기본 표 모양', opensDialog: true,
    canExecute: (c: any) => { if (!safe(c)) return false; try { readTablePresetPlan(input().wasm, input().getSelectedTableRef(), 'grid', true); return true; } catch { return false; } },
    execute: () => {
      const api = (window as any).jueonyEditor, revision = api.revision(), target = structuredClone(input().getSelectedTableRef());
      const check = () => { if (api.busy() || api.revision() !== revision || !safe((window as any).rhwpStudio.automation.getContext()) || JSON.stringify(input().getSelectedTableRef()) !== JSON.stringify(target)) throw new Error('문서나 표 선택이 바뀌었습니다. 표 모양 창을 다시 여세요.'); };
      new TablePresetsDialog((id, title) => { check(); return readTablePresetPlan(input().wasm, target, id, title).cells.length; }, (id, title) => {
        check(); const plan = readTablePresetPlan(input().wasm, target, id, title); preflightTablePreset(input().wasm, plan); check();
        const ih = input(); ih.executeOperation({ kind: 'snapshot', operationType: 'jueonyTablePreset', operation: (wasm: any) => { executeTablePreset(wasm, plan); return { sectionIndex: target.sec, paragraphIndex: target.ppi, charOffset: 0 }; } });
        ih.cursor.enterTableObjectSelectionDirect(target.sec, target.ppi, target.ci); ih.updateCaret(); ih.focus(); eventBus.emit('table-object-selection-changed', true); eventBus.emit('command-state-changed');
      }).show();
    },
  });
  const anchor = document.querySelector('.md-item[data-cmd="table:create"]');
  if (anchor) { const item = document.createElement('div'); item.className = 'md-item'; item.dataset.cmd = 'table:basic-presets'; const label = document.createElement('span'); label.className = 'md-label'; label.textContent = '기본 표 모양'; item.append(label); anchor.after(item); }
}
