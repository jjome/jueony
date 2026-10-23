import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
export async function applyFormatCopyTransactionPatches({root}) {
  const path=join(root,'src/engine/input-handler.ts');
  let source=(await readFile(path,'utf8')).replace(/\r\n/g,'\n');
  const once=(before,after,label)=>{if(source.split(before).length!==2)throw Error('Format copy integration drift: '+label);source=source.replace(before,after);};
  source="import {createFormatCopyCommand} from '../jueony/adapters/rhwp/format-copy-transaction.ts';\n"+source;
  once("    eventBus.on('document-swapped', () => {\n      this.clearTableResizeRuntimeCache();",
    "    eventBus.on('document-swapped', () => {\n      this.formatCopyState = null;\n      this.clearTableResizeRuntimeCache();",'document-local format references');
  once("desc.command.type !== 'applyCharFormat' && desc.command.type !== 'applyParaFormat'",
    "desc.command.type !== 'applyCharFormat' && desc.command.type !== 'applyParaFormat' && desc.command.type !== 'snapshot:formatCopy'",'retain selection');
  once('  private restoreSelectionAfterRedo(cmd: EditCommand | null): void {',
    "  private restoreSelectionAfterRedo(cmd: EditCommand | null): void {\n    if (cmd?.type === 'snapshot:formatCopy') { this.restoreSelectionAfterUndo(cmd); return; }",'validated redo selection');
  once('    const { charProps, paraProps } = this.formatCopyState;\n    if (Object.keys(charProps).length > 0) {',
`    const { charProps, paraProps } = this.formatCopyState;
    if (!this.cursor.isInHeaderFooter() && !this.cursor.isInFootnote()
      && sel.start.parentParaIndex === undefined && sel.end.parentParaIndex === undefined
      && !sel.start.isTextBox && !sel.end.isTextBox && !sel.start.cellPath?.length && !sel.end.cellPath?.length) {
      const rawSelection = this.cursor.getSelection();
      const selection = rawSelection ? { start: rawSelection.anchor, end: rawSelection.focus, blockPhase: this.cursor.blockSelectionPhase() } : null;
      const command = createFormatCopyCommand({SnapshotCommand, ApplyCharFormatCommand, ApplyParaFormatCommand}, {
        start: sel.start, end: sel.end, cursor: this.cursor.getPosition(), selection,
        targets: this.getParaFormatTargetsForRange(sel.start, sel.end), charProps, paraProps,
      });
      this.executeOperation({kind:'command',command});
      if (!command.wasApplied()) throw new Error('모양 복사를 적용하지 못했습니다. 원본 모양과 문서를 유지합니다.');
      this.formatCopyState = null;
      this.focusTextarea();
      return true;
    }
    if (Object.keys(charProps).length > 0) {`,'one history entry');
  await writeFile(path,source);
}
