import { SnippetDialog } from '../browser/snippet-dialog.ts';
import { executePlainText, preflightPlainText, readPlainTextPlan } from './plain-text-native.ts';
export function installSnippets(registry: any, input: () => any, eventBus: any): void {
  const can = (context: any) => { const ih = input(), c = ih?.cursor; return c && context.hasDocument && context.isEditable && !context.isFormMode && !ih.isComposing && !ih.wasm.requiresPasswordForSave && !c.isInCell() && !c.isInCellSelectionMode() && !c.isInPictureObjectSelection() && !c.isInTableObjectSelection() && !c.isInHeaderFooter() && !c.isInFootnote() && !c.isInTextBox(); };
  registry.register({ id: 'insert:snippets', label: '공통 상용구', opensDialog: true, canExecute: can, execute: () => {
    const api = (window as any).jueonyEditor, revision = api.revision(), ih = input(), position = ih.getCursorPosition(), range = ih.getSelection() ?? { start: position, end: position };
    const current = () => { const now = input().getSelection() ?? { start: input().getCursorPosition(), end: input().getCursorPosition() }; if (api.busy() || api.revision() !== revision || !can((window as any).rhwpStudio.automation.getContext()) || JSON.stringify(now) !== JSON.stringify(range)) throw new Error('문서나 선택이 바뀌었습니다. 상용구 창을 다시 여세요.'); };
    const source = readPlainTextPlan(ih.wasm, range, 'x'), initial = Array.from(source.source).slice(source.start, source.end).join('');
    new SnippetDialog(initial, text => { current(); const plan = readPlainTextPlan(input().wasm, range, text); preflightPlainText(input().wasm, plan); current(); input().executeOperation({ kind: 'snapshot', operationType: 'jueonySnippet', operation: (wasm: any) => executePlainText(wasm, plan) }); eventBus.emit('command-state-changed'); }).show();
  } });
  const anchor = document.querySelector('.md-item[data-cmd="insert:symbols"]'); if (anchor) { const item = document.createElement('div'); item.className = 'md-item'; item.dataset.cmd = 'insert:snippets'; const label = document.createElement('span'); label.className = 'md-label'; label.textContent = '공통 상용구'; item.append(label); anchor.after(item); }
}
