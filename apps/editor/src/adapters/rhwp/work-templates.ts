import { WorkTemplateDialog } from '../browser/work-template-dialog.ts';
import { canApplyWorkTemplate, applyWorkTemplate, preflightWorkTemplate } from './work-templates-native.ts';
export function installWorkTemplates(registry: any, input: () => any, eventBus: any): void {
  const can = (context: any) => {
    const ih = input(), c = ih?.cursor;
    return c && context.hasDocument && context.isEditable && !context.isFormMode && !ih.isComposing && !ih.wasm.requiresPasswordForSave && !c.isInCell() && !c.isInCellSelectionMode() && !c.isInPictureObjectSelection() && !c.isInTableObjectSelection() && !c.isInHeaderFooter() && !c.isInFootnote() && !c.isInTextBox() && canApplyWorkTemplate(ih.wasm);
  };
  registry.register({ id: 'file:work-template', label: '기본 업무 양식 (빈 문서)', opensDialog: true, canExecute: can, execute: () => {
    const api = (window as any).jueonyEditor, revision = api.revision(), current = () => { if (api.busy() || api.revision() !== revision || !can((window as any).rhwpStudio.automation.getContext())) throw new Error('문서 상태가 바뀌었습니다. 새 빈 문서에서 양식 창을 다시 여세요.'); };
    new WorkTemplateDialog(id => { current(); preflightWorkTemplate(input().wasm, id); current(); const ih = input(); ih.executeOperation({ kind: 'snapshot', operationType: 'jueonyWorkTemplate', operation: (wasm: any) => { applyWorkTemplate(wasm, id); return { sectionIndex: 0, paragraphIndex: 0, charOffset: 0 }; } }); eventBus.emit('command-state-changed'); }).show();
  } });
  const anchor = document.querySelector('.md-item[data-cmd="file:new-doc"]'); if (anchor) { const item = document.createElement('div'); item.className = 'md-item'; item.dataset.cmd = 'file:work-template'; const label = document.createElement('span'); label.className = 'md-label'; label.textContent = '기본 업무 양식 (빈 문서)'; item.append(label); anchor.after(item); }
}
