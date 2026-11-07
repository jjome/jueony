import { TableAutoFillDialog } from '../browser/table-auto-fill-dialog.ts';
import { readAutoFillPlan, executeAutoFillSnapshot, preflightAutoFill,changesAutoFill } from './table-auto-fill-native.ts';
import type { DateFillUnit, FormulaFillOutput,FillAxis } from '../../modules/document/public/table-auto-fill.ts';
export function installTableAutoFill(registry: any, input: () => any, eventBus: any): void {
  const safe = (context: any) => {
    const ih = input(), c = ih?.cursor;
    return c && context.hasDocument && context.isEditable && !context.isFormMode && context.inCellSelectionMode
      && !ih.isComposing && !ih.wasm.requiresPasswordForSave && !c.isInHeaderFooter() && !c.isInFootnote() && !c.isInTextBox();
  };
  // The command registry asks repeatedly while the selection is unchanged.
  // Building a stored-field preview may serialize the open file and evaluate a graph.
  let previous:{key:string;plan:ReturnType<typeof readAutoFillPlan>}|undefined;
  const read = (unit: DateFillUnit = 'days', output: FormulaFillOutput = 'formula',axis?:FillAxis) => {
    const ih=input(), api=(window as any).jueonyEditor, selected=ih.cursor.captureCellSelection(),block=axis?{...selected,axis}:selected;
    const key=JSON.stringify([ih.wasm.documentGeneration,api?.revision(),block,unit,output]);
    if(previous?.key===key)return previous.plan;
    const plan=readAutoFillPlan(ih.wasm,block,unit,output);
    previous=(plan.storedFill||plan.lines) && api?{key,plan}:undefined;
    return plan;
  };
  const initial=()=>{
    const block=input().cursor.captureCellSelection();
    if(block?.anchor.row!==block?.focus.row&&block?.anchor.col!==block?.focus.col){
      try{return read('days','formula','rows');}catch{return read('days','formula','columns');}
    }
    return read();
  };
  registry.register({ id: 'table:auto-fill-integers', label: '자동 채우기 (정수·날짜·번호·수식)', opensDialog: true,
    canExecute: (context: any) => { if (!safe(context)) return false; try { initial(); return true; } catch { return false; } },
    execute: () => {
      const api = (window as any).jueonyEditor, revision = api.revision(), selection=JSON.stringify(input().cursor.captureCellSelection()),plan = initial();
      const assertCurrent = () => { if (api.busy() || api.revision() !== revision || !safe((window as any).rhwpStudio.automation.getContext()) || JSON.stringify(input().cursor.captureCellSelection()) !== selection) throw new Error('문서나 셀 선택이 바뀌었습니다. 자동 채우기를 다시 여세요.'); };
      new TableAutoFillDialog(plan.kind, (unit, output,axis) => { assertCurrent(); return read(unit, output,axis); }, (unit, output,axis) => {
        assertCurrent();
        const selectedPlan = read(unit, output,axis);
        if (!changesAutoFill(selectedPlan)) return;
        preflightAutoFill(input().wasm, selectedPlan); assertCurrent();
        const ih = input(); executeAutoFillSnapshot(ih, selectedPlan);
        ih.cursor.restoreCellSelection(JSON.parse(selection)); ih.updateCellSelection(); ih.caret.hide(); eventBus.emit('command-state-changed');
      },Boolean(plan.storedFill??plan.lines?.[0].storedFill),plan.block.axis).show();
    },
  });
  const anchor = document.querySelector('.md-item[data-cmd="table:text-to-table"]');
  if (anchor) { const item = document.createElement('div'); item.className = 'md-item'; item.dataset.cmd = 'table:auto-fill-integers'; const label = document.createElement('span'); label.className = 'md-label'; label.textContent = '자동 채우기 (정수·날짜·번호·수식)'; item.append(label); anchor.after(item); }
}
