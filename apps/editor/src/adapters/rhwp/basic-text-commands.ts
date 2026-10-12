import { TextTransformDialog } from '../browser/text-transform-dialog.ts';
import { PlainTextDialog } from '../browser/plain-text-dialog.ts';
import { executeTextTransform, preflightTextTransform, readTextTransformPlan } from './text-transform-native.ts';
import { executePlainText, preflightPlainText, readPlainTextPlan } from './plain-text-native.ts';
import type { TextTransform } from '../../modules/document/public/text-transform.ts';

export function installBasicTextCommands(registry: any, input: () => any, eventBus: any): void {
  const safe = (context: any) => {
    const ih = input(), c = ih?.cursor;
    return c && context.hasDocument && context.isEditable && !context.isFormMode && !context.inField
      && !context.inCellSelectionMode && !context.inTableObjectSelection && !context.inPictureObjectSelection
      && !ih.isComposing && !ih.wasm.requiresPasswordForSave && !c.isInHeaderFooter() && !c.isInFootnote() && !c.isInTextBox();
  };
  const automation = () => (window as any).rhwpStudio.automation, api = () => (window as any).jueonyEditor;
  const selection = () => { const ih = input(), position = ih.getCursorPosition(); return ih.getSelection() ?? { start: position, end: position }; };
  function guard(context: (value: any) => boolean) {
    const revision = api().revision(), before = JSON.stringify(selection());
    return () => { if (api().busy() || api().revision() !== revision || !context(automation().getContext()) || JSON.stringify(selection()) !== before) throw new Error('문서나 선택이 바뀌었습니다. 창을 다시 여세요.'); };
  }
  const transformCan = (context: any) => safe(context) && input().cursor.hasSelection();
  registry.register({ id: 'edit:transform-text', label: '글자 바꾸기 (대소문자·전각/반각)', opensDialog: true, canExecute: transformCan,
    execute: () => {
      const current = guard(transformCan), range = structuredClone(selection());
      const read = (mode: TextTransform) => { current(); return readTextTransformPlan(input().wasm, range, mode); };
      new TextTransformDialog(mode => read(mode).segments.map(segment => segment.after).join('\n'), mode => {
        const plan = read(mode); if (plan.segments.every(segment => segment.before === segment.after)) return;
        preflightTextTransform(input().wasm, plan); current();
        const ih = input();
        ih.executeOperation({ kind: 'snapshot', operationType: 'jueonyTextTransform', operation: (wasm: any) => { executeTextTransform(wasm, plan); const last = plan.segments.at(-1)!; return { ...range.end, charOffset: last.span.start + Array.from(last.after).length }; } });
        eventBus.emit('command-state-changed');
      }).show();
    },
  });
  const plainCan = (context: any) => safe(context) && !context.inTable;
  const insert = (text: string, current: () => void) => {
    current(); const plan = readPlainTextPlan(input().wasm, selection(), text); preflightPlainText(input().wasm, plan); current();
    input().executeOperation({ kind: 'snapshot', operationType: 'jueonyPlainText', operation: (wasm: any) => executePlainText(wasm, plan) }); eventBus.emit('command-state-changed');
  };
  registry.register({ id: 'edit:paste-special', label: '골라 붙이기 (텍스트만)', opensDialog: true, canExecute: plainCan, execute: () => { const current = guard(plainCan); new PlainTextDialog(text => insert(text, current)).show(); } });
  const characters = [
    ['insert:nonbreaking-space', '묶음 빈 칸 (Unicode)', '\u00a0'],
    ['insert:fixed-space', '고정폭 빈 칸 (Unicode)', '\u2007'],
    ['insert:soft-hyphen', '무른 하이픈 (Unicode)', '\u00ad'],
  ];
  for (const [id, label, text] of characters) registry.register({ id, label, canExecute: plainCan, execute: () => insert(text, guard(plainCan)) });
  const append = (anchorId: string, items: { id: string; label: string }[]) => {
    let anchor = document.querySelector('.md-item[data-cmd="' + anchorId + '"]');
    for (const { id, label } of items) { if (!anchor) break; const item = document.createElement('div'); item.className = 'md-item'; item.dataset.cmd = id; const span = document.createElement('span'); span.className = 'md-label'; span.textContent = label; item.append(span); anchor.after(item); anchor = item; }
  };
  append('edit:paste', [{ id: 'edit:paste-special', label: '골라 붙이기 (텍스트만)' }, { id: 'edit:transform-text', label: '글자 바꾸기 (대소문자·전각/반각)' }]);
  append('insert:symbols', characters.map(([id, label]) => ({ id, label })));
}
