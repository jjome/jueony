import { ParagraphSortDialog } from '../browser/paragraph-sort-dialog.ts';
import { readParagraphSortPlan, executeParagraphSort, preflightParagraphSort } from './paragraph-sort-native.ts';
export function installParagraphSort(registry: any, input: () => any, eventBus: any): void {
  const safe = (c: any) => { const ih = input(); return !!ih && c.hasDocument && c.isEditable && !c.isFormMode && !c.inTable && !c.inTableObjectSelection && !c.inPictureObjectSelection && !c.inCellSelectionMode && ih.cursor.hasSelection() && !ih.isComposing && !ih.wasm.requiresPasswordForSave && !ih.cursor.isInHeaderFooter() && !ih.cursor.isInFootnote() && !ih.cursor.isInTextBox(); };
  registry.register({ id: 'edit:sort-paragraphs', label: '본문 문단 정렬', opensDialog: true, canExecute: safe,
    execute: () => {
      const api = (window as any).jueonyEditor, revision = api.revision(), selection = structuredClone(input().cursor.getSelection());
      const check = () => { if (api.busy() || api.revision() !== revision || !safe((window as any).rhwpStudio.automation.getContext()) || JSON.stringify(input().cursor.getSelection()) !== JSON.stringify(selection)) throw new Error('문서나 선택이 바뀌었습니다. 정렬 창을 다시 여세요.'); };
      new ParagraphSortDialog(options => { check(); const p = readParagraphSortPlan(input().wasm, selection, options); return p.order.map(i => p.texts[i]); }, options => {
        check(); const p = readParagraphSortPlan(input().wasm, selection, options); if (p.order.every((v, i) => v === i)) return;
        preflightParagraphSort(input().wasm, p); check();
        input().executeOperation({ kind: 'snapshot', operationType: 'jueonyParagraphSort', operation: (wasm: any) => { executeParagraphSort(wasm, p); return { sectionIndex: p.section, paragraphIndex: p.first, charOffset: 0 }; } }); eventBus.emit('command-state-changed');
      }).show();
    },
  });
  const anchor = document.querySelector('.md-item[data-cmd="edit:transform-text"]');
  if (anchor) { const item = document.createElement('div'); item.className = 'md-item'; item.dataset.cmd = 'edit:sort-paragraphs'; const label = document.createElement('span'); label.className = 'md-label'; label.textContent = '본문 문단 정렬'; item.append(label); anchor.after(item); }
}
