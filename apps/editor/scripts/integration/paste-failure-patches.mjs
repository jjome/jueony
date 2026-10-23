import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
function replaceMethod(source, start, end, body) { const a = source.indexOf(start), b = source.indexOf(end, a + start.length); if (a < 0 || b < 0 || source.indexOf(start, a + start.length) !== -1) throw new Error('Paste failure integration drift: ' + start); return source.slice(0, a) + body + '\n\n' + source.slice(b); }
export async function applyPasteFailurePatches({ root }) {
  const keyboard = join(root, 'src/engine/input-handler-keyboard.ts'); let source = (await readFile(keyboard, 'utf8')).replace(/\r\n/g, '\n');
  if (source.includes('jueonyAtomicHtmlPaste')) throw new Error('Paste failure integration drift: already applied');
  source = replaceMethod(source, 'function pasteExternalHtml(this: any, html: string, text: string, hasSelection: boolean): void {', '/** 클립보드의 이미지 파일', `function pasteExternalHtml(this: any, html: string, _text: string, hasSelection: boolean): void {
  // jueonyAtomicHtmlPaste: a failed rich paste must never commit only its deletion.
  const positionBefore = this.cursor.getPosition(), selectionBefore = this.cursor.getSelection();
  const ordered = this.cursor.getSelectionOrdered(), revisionBefore = (window as any).jueonyEditor?.revision();
  try {
    if (this.cursor.isInHeaderFooter() || this.cursor.isInFootnote() || this.cursor.isInTextBox()) throw new Error('현재 편집 영역의 서식 있는 붙이기는 지원하지 않습니다.');
    const htmlForCore = sanitizeOfficeHtmlForCore(html);
    if (!htmlForCore.trim()) throw new Error('붙일 서식 내용이 비어 있습니다.');
    this.executeOperation({ kind: 'snapshot', operationType: 'pasteHtml',
      selectionBefore: ordered ? { ...ordered, blockPhase: this.cursor.blockSelectionPhase() } : null,
      operation: (wasm: WasmBridge) => {
        if (hasSelection) this.deleteSelection({ deferRecord: true });
        const p = this.cursor.getPosition(); let result: string;
        if (isNestedCellPosition(p)) result = wasm.pasteHtmlInCellByPath(p.sectionIndex, p.parentParaIndex!, JSON.stringify(p.cellPath), p.charOffset, htmlForCore);
        else if (p.parentParaIndex !== undefined) result = wasm.pasteHtmlInCell(p.sectionIndex, p.parentParaIndex, p.controlIndex!, p.cellIndex!, p.cellParaIndex!, p.charOffset, htmlForCore);
        else result = wasm.pasteHtml(p.sectionIndex, p.paragraphIndex, p.charOffset, htmlForCore);
        const parsed = JSON.parse(result);
        if (parsed.ok !== true) throw new Error('문서 엔진이 서식 있는 붙이기를 거절했습니다.');
        return positionAfterPasteResult(p, parsed);
      },
    });
  } catch (error) {
    // SnapshotCommand restores the document. Its failure does not restore JS cursor selection.
    if ((window as any).jueonyEditor?.revision() === revisionBefore) {
      this.cursor.clearSelection();
      if (selectionBefore) { this.cursor.moveTo(selectionBefore.anchor); this.cursor.setAnchor(); this.cursor.moveTo(selectionBefore.focus); }
      else this.cursor.moveTo(positionBefore);
      this.updateCaret();
      alert('붙이기 취소: ' + (error instanceof Error ? error.message : String(error)) + ' 원본을 유지했습니다. 텍스트로 변환하려면 편집 > 골라 붙이기(텍스트만)를 사용하세요.');
    } else alert('붙이기 후 화면 갱신에 실패했습니다. 변경 내용을 확인하고 필요하면 되돌리기를 실행하세요.');
  }
}`);
  await writeFile(keyboard, source);
  const handler = join(root, 'src/engine/input-handler.ts'); source = (await readFile(handler, 'utf8')).replace(/\r\n/g, '\n');
  source = replaceMethod(source, '  performPaste(): boolean {', '  /** 잘라내기', `  performPaste(): boolean {
    if (this.editMode === 'form') return false;
    this.focusTextarea();
    try { if (document.execCommand('paste')) return true; } catch { /* Browser denied programmatic paste. */ }
    alert('브라우저에서 메뉴 붙이기를 허용하지 않았습니다. 편집기에서 Ctrl+V를 누르세요. 본문에 텍스트만 넣으려면 편집 > 골라 붙이기(텍스트만)를 사용하세요.');
    return false;
  }`);
  await writeFile(handler, source);
}
