import { TableAutoFillDialog } from '../browser/table-auto-fill-dialog.ts';
import { readAutoFillPlan, executeAutoFill, preflightAutoFill } from './table-auto-fill-native.ts';
export function installTableAutoFill(registry: any, input: () => any, eventBus: any): void {
  const safe = (context: any) => {
    const ih = input(), c = ih?.cursor;
    return c && context.hasDocument && context.isEditable && !context.isFormMode && context.inCellSelectionMode
      && !ih.isComposing && !ih.wasm.requiresPasswordForSave && !c.isInHeaderFooter() && !c.isInFootnote() && !c.isInTextBox();
  };
  const read = () => readAutoFillPlan(input().wasm, input().cursor.captureCellSelection());
  registry.register({ id: 'table:auto-fill-integers', label: '자동 채우기 (정수 수열)', opensDialog: true,
    canExecute: (context: any) => { if (!safe(context)) return false; try { read(); return true; } catch { return false; } },
    execute: () => {
      const api = (window as any).jueonyEditor, revision = api.revision(), plan = read();
      const assertCurrent = () => { if (api.busy() || api.revision() !== revision || !safe((window as any).rhwpStudio.automation.getContext()) || JSON.stringify(input().cursor.captureCellSelection()) !== JSON.stringify(plan.block)) throw new Error('문서나 셀 선택이 바뀌었습니다. 자동 채우기를 다시 여세요.'); };
      new TableAutoFillDialog(plan, () => {
        assertCurrent();
        if (plan.cells.slice(2).every((c, i) => c.text === plan.values[i + 2])) return;
        preflightAutoFill(input().wasm, plan); assertCurrent();
        const ih = input(); ih.executeOperation({ kind: 'snapshot', operationType: 'jueonyTableAutoFill', operation: (wasm: any) => { executeAutoFill(wasm, plan); return ih.getCursorPosition(); } });
        ih.cursor.restoreCellSelection(plan.block); ih.updateCellSelection(); ih.caret.hide(); eventBus.emit('command-state-changed');
      }).show();
    },
  });
  const anchor = document.querySelector('.md-item[data-cmd="table:text-to-table"]');
  if (anchor) { const item = document.createElement('div'); item.className = 'md-item'; item.dataset.cmd = 'table:auto-fill-integers'; const label = document.createElement('span'); label.className = 'md-label'; label.textContent = '자동 채우기 (정수 수열)'; item.append(label); anchor.after(item); }
}
