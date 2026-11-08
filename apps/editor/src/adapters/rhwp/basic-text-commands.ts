import { TextTransformDialog } from '../browser/text-transform-dialog.ts';
import { PlainTextDialog } from '../browser/plain-text-dialog.ts';
import { executeTextTransform, preflightTextTransform, readTextTransformPlan } from './text-transform-native.ts';
import { executePlainText, preflightPlainText, readPlainTextPlan } from './plain-text-native.ts';
import { readMultiParagraphPlainTextPlan, replaceMultiParagraphPlainText } from './multi-paragraph-plain-text.ts';
import type { MultiParagraphPlainTextPlan, MultiParagraphPlainTextReceipt, MultiParagraphTextRange } from './multi-paragraph-plain-text.ts';
import type { TextTransform } from '../../modules/document/public/text-transform.ts';

const same = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right);
const revision = (value: unknown): string => {
  if ((typeof value !== 'string' && typeof value !== 'number') || String(value).length === 0) throw new Error('문서 revision을 확인하지 못했습니다.');
  return String(value);
};
const rootPoint = (value: any): boolean => Boolean(value && value.parentParaIndex === undefined && !value.isTextBox
  && [value.sectionIndex, value.paragraphIndex, value.charOffset].every((part: unknown) => Number.isSafeInteger(part) && Number(part) >= 0));
export const isMultiParagraphBodySelection = (value: any): value is MultiParagraphTextRange => Boolean(value && rootPoint(value.start) && rootPoint(value.end)
  && (value.start.sectionIndex !== value.end.sectionIndex || value.start.paragraphIndex !== value.end.paragraphIndex));

export class MultiParagraphPlainTextCommand {
  readonly type = 'jueonyMultiParagraphPlainText';
  readonly timestamp = Date.now();
  private receipt?: MultiParagraphPlainTextReceipt;
  private caret?: { sectionIndex: number; paragraphIndex: number; charOffset: number };
  private executed = false;
  private readonly seed: MultiParagraphPlainTextPlan;
  private readonly currentRevision: () => string | number;
  private readonly currentSelection: () => MultiParagraphTextRange;
  private readonly currentIdentity: () => string;
  private readonly identity: string;

  constructor(
    seed: MultiParagraphPlainTextPlan,
    currentRevision: () => string | number,
    currentSelection: () => MultiParagraphTextRange,
    currentIdentity: () => string,
    identity: string,
  ) { this.seed = seed; this.currentRevision = currentRevision; this.currentSelection = currentSelection; this.currentIdentity = currentIdentity; this.identity = identity; }

  execute(wasm: any) {
    if (!this.identity || this.currentIdentity() !== this.identity || !same(this.currentSelection(), this.seed.range))
      throw new Error('문서 identity 또는 선택이 바뀌었습니다. 골라 붙이기를 다시 여세요.');
    const liveRevision = revision(this.currentRevision());
    const plan = this.executed ? readMultiParagraphPlainTextPlan(wasm, this.seed.range, this.seed.text, liveRevision) : this.seed;
    if (!this.executed && liveRevision !== this.seed.revision) throw new Error('문서 revision이 바뀌었습니다. 골라 붙이기를 다시 여세요.');
    const receipt = replaceMultiParagraphPlainText(wasm, plan, () => revision(this.currentRevision()), this.currentSelection);
    this.receipt = receipt; this.caret = receipt.caret; this.executed = true;
    return { ...receipt.caret };
  }

  undo() {
    if (!this.receipt?.undo()) throw new Error('다중 문단 골라 붙이기를 안전하게 되돌리지 못했습니다.');
    this.receipt = undefined;
    return { ...this.seed.range.end };
  }

  discard(): void { this.receipt?.discard(); this.receipt = undefined; }
  snapshotResourceCount(): number { return this.receipt ? 1 : 0; }
  isNoOp(): boolean { return false; }
  retainOnFailure(): boolean { return false; }
  mergeWith(): null { return null; }
  selectionBefore() { return { start: { ...this.seed.range.start }, end: { ...this.seed.range.end }, blockPhase: null }; }
  selectionAfter() {
    const caret = this.caret ?? this.seed.range.start;
    return { start: { ...caret }, end: { ...caret }, blockPhase: null };
  }
}

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
    const editor = api(), openedRevision = editor.revision(), identity = editor.documentIdentity?.(), before = JSON.stringify(selection());
    return () => { if (editor.busy() || editor.revision() !== openedRevision || editor.documentIdentity?.() !== identity || !context(automation().getContext()) || JSON.stringify(selection()) !== before) throw new Error('문서나 선택이 바뀌었습니다. 창을 다시 여세요.'); };
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
    current(); const ih = input(), range = structuredClone(selection());
    if (isMultiParagraphBodySelection(range)) {
      const editor = api();
      if (typeof editor?.revision !== 'function' || typeof editor?.documentIdentity !== 'function') throw new Error('문서 identity와 revision을 확인할 수 없어 여러 문단을 바꾸지 않았습니다.');
      const identity = editor.documentIdentity(), openedRevision = revision(editor.revision());
      if (typeof identity !== 'string' || !identity) throw new Error('문서 identity를 확인할 수 없어 여러 문단을 바꾸지 않았습니다.');
      const plan = readMultiParagraphPlainTextPlan(ih.wasm, range, text, openedRevision);
      current();
      if (input() !== ih || editor.documentIdentity() !== identity) throw new Error('문서가 바뀌었습니다. 골라 붙이기를 다시 여세요.');
      ih.executeOperation({ kind: 'command', command: new MultiParagraphPlainTextCommand(plan, () => editor.revision(), () => structuredClone(selection()), () => editor.documentIdentity(), identity) });
    } else {
      const plan = readPlainTextPlan(ih.wasm, range, text); preflightPlainText(ih.wasm, plan); current();
      ih.executeOperation({ kind: 'snapshot', operationType: 'jueonyPlainText', operation: (wasm: any) => executePlainText(wasm, plan) });
    }
    eventBus.emit('command-state-changed');
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
