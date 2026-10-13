import { StylePackageDialog } from '../browser/style-package-dialog.ts';
import { parseStylePackage } from '../../modules/document/public/style-package.ts';
import { importStylePackage, preflightStylePackage } from './style-package-native.ts';
export function installStylePackage(registry: any, input: () => any, eventBus: any): void {
  const can = (context: any) => context.hasDocument && context.isEditable && !context.isFormMode && !input()?.isComposing && !input()?.wasm.requiresPasswordForSave;
  registry.register({ id: 'format:style-package', label: '스타일 내보내기·가져오기', opensDialog: true, canExecute: can, execute: () => {
    const api = (window as any).jueonyEditor, revision = api.revision(), current = () => { if (api.busy() || api.revision() !== revision || !can((window as any).rhwpStudio.automation.getContext())) throw new Error('문서 상태가 바뀌었습니다. 스타일 교환 창을 다시 여세요.'); };
    new StylePackageDialog(input().wasm, current, text => {
      current(); const value = parseStylePackage(text); preflightStylePackage(input().wasm, value); current(); const ih = input(), position = ih.getCursorPosition();
      ih.executeOperation({ kind: 'snapshot', operationType: 'jueonyStylePackage', operation: (wasm: any) => { importStylePackage(wasm, value); return position; } }); eventBus.emit('command-state-changed');
    }).show();
  } });
  const anchor = document.querySelector('.md-item[data-cmd="format:style-dialog"]');
  if (anchor) { const item = document.createElement('div'); item.className = 'md-item'; item.dataset.cmd = 'format:style-package'; const label = document.createElement('span'); label.className = 'md-label'; label.textContent = '스타일 내보내기·가져오기'; item.append(label); anchor.after(item); }
}
