import { TableConversionDialog } from '../browser/table-conversion-dialog.ts';
import { executeTableConversion, readTableTextPlan, readTextTablePlan, preflightTableConversion } from './table-conversion-native.ts';
import type { TableConversionPlan } from './table-conversion-native.ts';
import type { TableTextSeparator } from '../../modules/document/public/table-conversion.ts';

/** Manual conversion is one snapshot of the live document, never a disk rewrite. */
export function installTableConversion(registry: any, input: () => any, eventBus: any): void {
  const safe = (context: any) => {
    const ih = input(), c = ih?.cursor;
    return !!c && context.hasDocument && context.isEditable && !context.isFormMode && !ih.isComposing
      && !ih.wasm.requiresPasswordForSave && !c.isInHeaderFooter() && !c.isInFootnote() && !c.isInTextBox()
      && !context.inPictureObjectSelection && !context.inCellSelectionMode;
  };
  for (const mode of ['text-to-table', 'table-to-text'] as const) {
    const read = (separator: TableTextSeparator): TableConversionPlan => mode === 'text-to-table'
      ? readTextTablePlan(input().wasm, input().cursor.getSelection(), separator)
      : readTableTextPlan(input().wasm, input().getSelectedTableRef(), separator);
    const can = (context: any) => safe(context) && (mode === 'text-to-table'
      ? !context.inTable && !context.inTableObjectSelection && input().cursor.hasSelection()
      : context.inTableObjectSelection && !input().getSelectedTableRef()?.cellPath?.length);
    registry.register({ id: 'table:' + mode, label: mode === 'text-to-table' ? '문자열을 표로' : '표를 문자열로', opensDialog: true, canExecute: can,
      execute: () => {
        const api = (window as any).jueonyEditor, revision = api.revision();
        const fingerprint = () => JSON.stringify(mode === 'text-to-table' ? input().cursor.getSelection() : input().getSelectedTableRef());
        const selection = fingerprint();
        const assertCurrent = () => {
          if (api.revision() !== revision || api.busy() || !can((window as any).rhwpStudio.automation.getContext()) || fingerprint() !== selection) throw new Error('문서나 선택이 바뀌었습니다. 취소한 뒤 변환 창을 다시 여세요.');
        };
        new TableConversionDialog(mode, separator => { assertCurrent(); const plan = read(separator); return { rows: plan.rows.length, columns: plan.rows[0].length }; }, separator => {
          assertCurrent(); const plan = read(separator); preflightTableConversion(input().wasm, plan); assertCurrent();
          input().executeOperation({ kind: 'snapshot', operationType: 'jueonyTableConversion', operation: (wasm: any) => executeTableConversion(wasm, plan) });
          // Snapshot router owns dirty/revision/history and content refresh.
          eventBus.emit('command-state-changed');
        }).show();
      },
    });
    const anchor = document.querySelector('.md-item[data-cmd="table:create"]');
    if (anchor) {
      const item = document.createElement('div'); item.className = 'md-item'; item.dataset.cmd = 'table:' + mode;
      const label = document.createElement('span'); label.className = 'md-label'; label.textContent = mode === 'text-to-table' ? '문자열을 표로' : '표를 문자열로'; item.append(label); anchor.after(item);
    }
  }
}
