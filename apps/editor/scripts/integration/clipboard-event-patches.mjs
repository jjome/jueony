import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
function once(source, before, after, label) { if (source.split(before).length !== 2) throw new Error('Clipboard event integration drift: ' + label); return source.replace(before, after); }
export async function applyClipboardEventPatches({ root }) {
  const file = join(root, 'src/engine/input-handler-keyboard.ts');
  let source = (await readFile(file, 'utf8')).replace(/\r\n/g, '\n');
  if (source.includes('copyRichSelectionForCut')) throw new Error('Clipboard event integration drift: already applied');
  source = "import { validateClipboardSelection, writeCutClipboardEvent } from '../jueony/editor-actions/clipboard-event.ts';\n" + source;
  source = once(source, 'export function onCut(this: any, e: ClipboardEvent): void {', `/** Destructive text cut requires successful rich serialization and both event payloads. */
function copyRichSelectionForCut(this: any, e: ClipboardEvent): boolean {
  e.preventDefault();
  try {
    if (!e.clipboardData) throw new Error('클립보드 기록 권한이 없어 원본을 유지했습니다.');
    if (this.isComposing || this.cursor.isInFootnote() || this.cursor.isInTextBox()) throw new Error('조합 중이거나 주석·글상자 편집 상태에서는 서식 보존 잘라내기를 지원하지 않습니다.');
    const selection = this.cursor.getSelectionOrdered();
    if (!selection) return false;
    const { start, end } = selection;
    validateClipboardSelection(start, end);
    if (start.parentParaIndex !== undefined) {
      const path = start.cellPath?.length ? start.cellPath : [{ controlIndex: start.controlIndex!, cellIndex: start.cellIndex!, cellParaIndex: start.cellParaIndex! }];
      const doc = this.wasm.borrowDocumentHandle();
      for (let depth = 1; depth <= path.length; depth++) {
        const prefix = path.slice(0, depth), cell = prefix[prefix.length - 1];
        if (JSON.parse(doc.getCellPropertiesByPath(start.sectionIndex, start.parentParaIndex, JSON.stringify(prefix), cell.cellIndex)).cellProtect) throw new Error('보호된 셀의 내용은 잘라낼 수 없습니다.');
      }
    }
    let copied: string, html: string;
    if (isNestedCellPosition(start)) {
      copied = this.wasm.copySelectionInCellByPath(start.sectionIndex, start.parentParaIndex!, JSON.stringify(start.cellPath), cellParaIndexOf(start), start.charOffset, cellParaIndexOf(end), end.charOffset);
      html = this.wasm.exportSelectionInCellHtmlByPath(start.sectionIndex, start.parentParaIndex!, JSON.stringify(start.cellPath), cellParaIndexOf(start), start.charOffset, cellParaIndexOf(end), end.charOffset);
    } else if (start.parentParaIndex !== undefined) {
      copied = this.wasm.copySelectionInCell(start.sectionIndex, start.parentParaIndex, start.controlIndex!, start.cellIndex!, start.cellParaIndex!, start.charOffset, end.cellParaIndex!, end.charOffset);
      html = this.wasm.exportSelectionInCellHtml(start.sectionIndex, start.parentParaIndex, start.controlIndex!, start.cellIndex!, start.cellParaIndex!, start.charOffset, end.cellParaIndex!, end.charOffset);
    } else {
      copied = this.wasm.copySelection(start.sectionIndex, start.paragraphIndex, start.charOffset, end.paragraphIndex, end.charOffset);
      html = this.wasm.exportSelectionHtml(start.sectionIndex, start.paragraphIndex, start.charOffset, end.paragraphIndex, end.charOffset);
    }
    if (JSON.parse(copied)?.ok !== true) throw new Error('문서 엔진이 선택한 내용의 복사를 거절했습니다.');
    // Plain-text fallback is useful for Copy, but cannot authorize deleting rich source.
    if (!html?.trim()) throw new Error('선택한 내용의 서식을 내보내지 못해 원본을 유지했습니다.');
    const text = this.wasm.getClipboardText(), marked = prepareRhwpInternalClipboardHtml(this, html, text);
    writeCutClipboardEvent(e.clipboardData, text, marked);
    return true;
  } catch (error) { alert('잘라내기 취소: ' + (error instanceof Error ? error.message : String(error))); return false; }
}

export function onCut(this: any, e: ClipboardEvent): void {`, 'strict selection copy helper');
  source = once(source, `  if (this.cursor.isInHeaderFooter() && this.getNonEmptyHeaderFooterSelection()) {
    if (copyHeaderFooterSelection.call(this, e)) this.deleteSelection();
    return;
  }`, `  if (this.cursor.isInHeaderFooter()) {
    e.preventDefault();
    if (this.getNonEmptyHeaderFooterSelection()) alert('머리말·꼬리말의 서식 보존 잘라내기는 지원하지 않아 원본을 유지했습니다. 복사 또는 별도 삭제를 사용하세요.');
    return;
  }`, 'header footer source preservation');
  source = once(source, `  if (!this.cursor.hasSelection()) return;
  // 먼저 복사
  this.onCopy(e);
  // 선택 영역 삭제
  this.deleteSelection();`, `  if (!this.cursor.hasSelection()) return;
  if (copyRichSelectionForCut.call(this, e)) this.deleteSelection();`, 'delete only on acknowledged event payload');
  await writeFile(file, source);
}
