import { TableAutoFillDialog } from '../browser/table-auto-fill-dialog.ts';
import { readAutoFillPlan, executeAutoFillSnapshot, preflightAutoFill } from './table-auto-fill-native.ts';
import type { DateFillUnit, FormulaFillOutput } from '../../modules/document/public/table-auto-fill.ts';
export function installTableAutoFill(registry: any, input: () => any, eventBus: any): void {
  const safe = (context: any) => {
    const ih = input(), c = ih?.cursor;
    return c && context.hasDocument && context.isEditable && !context.isFormMode && context.inCellSelectionMode
      && !ih.isComposing && !ih.wasm.requiresPasswordForSave && !c.isInHeaderFooter() && !c.isInFootnote() && !c.isInTextBox();
  };
  // The command registry asks repeatedly while the selection is unchanged.
  // Building a stored-field preview may serialize the open file and evaluate a graph.
  let previous:{key:string;plan:ReturnType<typeof readAutoFillPlan>}|undefined;
  const read = (unit: DateFillUnit = 'days', output: FormulaFillOutput = 'formula') => {
    const ih=input(), api=(window as any).jueonyEditor, block=ih.cursor.captureCellSelection();
    const key=JSON.stringify([ih.wasm.documentGeneration,api?.revision(),block,unit,output]);
    if(previous?.key===key)return previous.plan;
    const plan=readAutoFillPlan(ih.wasm,block,unit,output);
    previous=plan.storedFill && api?{key,plan}:undefined;
    return plan;
  };
  registry.register({ id: 'table:auto-fill-integers', label: '자동 채우기 (정수·날짜·번호·수식)', opensDialog: true,
    canExecute: (context: any) => { if (!safe(context)) return false; try { read(); return true; } catch { return false; } },
    execute: () => {
      const api = (window as any).jueonyEditor, revision = api.revision(), plan = read();
      const assertCurrent = () => { if (api.busy() || api.revision() !== revision || !safe((window as any).rhwpStudio.automation.getContext()) || JSON.stringify(input().cursor.captureCellSelection()) !== JSON.stringify(plan.block)) throw new Error('문서나 셀 선택이 바뀌었습니다. 자동 채우기를 다시 여세요.'); };
      new TableAutoFillDialog(plan.kind, (unit, output) => { assertCurrent(); return read(unit, output); }, (unit, output) => {
        assertCurrent();
        const selectedPlan = read(unit, output);
        if (selectedPlan.storedFill?!selectedPlan.storedFill.changed:selectedPlan.cells.slice(selectedPlan.seedCount).every((c, i) => c.text === selectedPlan.values[i + selectedPlan.seedCount])) return;
        preflightAutoFill(input().wasm, selectedPlan); assertCurrent();
        const ih = input(); executeAutoFillSnapshot(ih, selectedPlan);
        ih.cursor.restoreCellSelection(plan.block); ih.updateCellSelection(); ih.caret.hide(); eventBus.emit('command-state-changed');
      },Boolean(plan.storedFill)).show();
    },
  });
  const anchor = document.querySelector('.md-item[data-cmd="table:text-to-table"]');
  if (anchor) { const item = document.createElement('div'); item.className = 'md-item'; item.dataset.cmd = 'table:auto-fill-integers'; const label = document.createElement('span'); label.className = 'md-label'; label.textContent = '자동 채우기 (정수·날짜·번호·수식)'; item.append(label); anchor.after(item); }
}
