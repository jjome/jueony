import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
function replaceMethod(source, start, end, body) {
  const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  if (a < 0 || b < 0 || source.indexOf(start, a + start.length) !== -1) throw new Error('Safe object cut integration drift: ' + start);
  return source.slice(0, a) + body + '\n\n' + source.slice(b);
}
export async function applySafeObjectCutPatches({ root }) {
  const handler = join(root, 'src/engine/input-handler.ts');
  let source = (await readFile(handler, 'utf8')).replace(/\r\n/g, '\n');
  if (source.includes('performObjectCutSafely')) throw new Error('Safe object cut integration drift: already applied');
  source = "import { runGuardedObjectCut, validateObjectCutTarget } from '../jueony/editor-actions/safe-object-cut.ts';\n" + source;
  source = replaceMethod(source, '  performCut(): void {', '  /** 선택 영역 삭제', `  performCut(): void {
    if (this.editMode === 'form') return;
    if (this.cursor.isInPictureObjectSelection() || this.cursor.isInTableObjectSelection()) {
      void this.performObjectCutSafely(); return;
    }
    this.focusTextarea(); document.execCommand('cut');
  }

  /** Await the rich OS clipboard, then compare document and selection before one undoable delete. */
  async performObjectCutSafely(): Promise<boolean> {
    try {
      const api = (window as any).jueonyEditor;
      const ensureEditable = () => {
        if (this.editMode === 'form' || this.isComposing || this.cursor.isInHeaderFooter() || this.cursor.isInFootnote() || this.cursor.isInTextBox() || api?.busy() || (window as any).rhwpStudio?.automation?.getContext?.().isEditable === false) throw new Error('현재 편집 상태에서는 개체를 잘라낼 수 없습니다.');
      };
      ensureEditable();
      const picture = this.cursor.isInPictureObjectSelection();
      const ref = JSON.parse(JSON.stringify(picture ? this.cursor.getSelectedPictureRef() : this.cursor.getSelectedTableRef()));
      validateObjectCutTarget(picture ? 'picture' : 'table', ref, picture ? this.cursor.getSelectedPictureRefs().length : this.cursor.isInTableObjectSelection() ? 1 : 0);
      if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) throw new Error('서식 클립보드를 사용할 수 없어 원본을 유지했습니다.');
      if (picture && ref.cellPath?.length) {
        const doc = this.wasm.borrowDocumentHandle();
        for (let depth = 1; depth <= ref.cellPath.length; depth++) {
          const path = ref.cellPath.slice(0, depth), cell = path[path.length - 1];
          const dimensions = JSON.parse((doc as any).getTableDimensionsByPath(ref.sec, ref.ppi, JSON.stringify(path)));
          if (!Number.isSafeInteger(dimensions.cellCount) || cell.cellIndex >= dimensions.cellCount) throw new Error('표 셀 경로를 확인하지 못했습니다.');
          if (JSON.parse((doc as any).getCellPropertiesByPath(ref.sec, ref.ppi, JSON.stringify(path), cell.cellIndex)).cellProtect) throw new Error('보호된 셀의 개체는 잘라낼 수 없습니다.');
        }
      }
      const target = picture ? { controlIndex: ref.ci, ownerCellPathJson: _keyboard.pictureCellPathJson(ref) } : tableObjectClipboardTarget(ref);
      let clipboardToken: string | undefined;
      const outcome = await runGuardedObjectCut({
        owner: this,
        readStamp: () => {
          ensureEditable();
          return { document: this.wasm.borrowDocumentHandle()!, generation: this.wasm.documentGeneration, revision: api?.revision(), selection: JSON.stringify({ picture: this.cursor.getSelectedPictureRefs(), table: this.cursor.getSelectedTableRef(), position: this.cursor.getPosition(), text: this.cursor.getSelection() }) };
        },
        onInvalidated: listener => {
          const off = ['document-mutated', 'document-swapped', 'history-jumped', 'picture-object-selection-changed', 'table-object-selection-changed'].map(name => (this.eventBus as any).on(name, listener));
          return () => off.forEach(fn => fn());
        },
        writeClipboard: async () => {
          const copied = JSON.parse(this.wasm.copyControl(ref.sec, ref.ppi, target.controlIndex, target.ownerCellPathJson));
          if (copied.ok !== true) throw new Error('문서 엔진이 개체 복사를 거절했습니다.');
          const text = this.wasm.getClipboardText() || (picture ? '[개체]' : '[표]');
          const html = this.wasm.exportControlHtml(ref.sec, ref.ppi, target.controlIndex, target.ownerCellPathJson);
          if (!html?.trim()) throw new Error('개체 서식을 복사하지 못해 원본을 유지했습니다.');
          const marked = _keyboard.prepareRhwpInternalClipboardHtml(this, html, text);
          clipboardToken = (this as any).rhwpClipboardToken;
          if (picture && ref.type === 'image') await _keyboard.writeImageToClipboard(this.wasm, ref.sec, ref.ppi, ref.ci, text, marked, target.ownerCellPathJson);
          else await _keyboard.writeTextHtmlToClipboard(text, marked);
        },
        commit: () => {
          if (!clipboardToken || clipboardToken !== (this as any).rhwpClipboardToken) throw new Error('복사한 자료가 바뀌어 잘라내기를 취소했습니다.');
          let executed = false;
          const after = this.cursor.positionOutsideObject(ref.sec, ref.ppi) ?? { sectionIndex: ref.sec, paragraphIndex: ref.ppi, charOffset: 0 };
          this.executeOperation({ kind: 'snapshot', operationType: picture ? 'cutObject' : 'cutTable', operation: (wasm: WasmBridge) => {
            const result = !picture ? wasm.deleteTableControl(ref.sec, ref.ppi, ref.ci)
              : ref.type === 'image' && ref.cellPath?.length ? wasm.deleteCellPictureControlByPath(ref.sec, ref.ppi, ref.cellPath, ref.ci)
              : ref.type === 'image' ? wasm.deletePictureControl(ref.sec, ref.ppi, ref.ci)
              : ref.type === 'equation' ? wasm.deleteEquationControl(ref.sec, ref.ppi, ref.ci)
              : wasm.deleteShapeControl(ref.sec, ref.ppi, ref.ci);
            if (result?.ok !== true) throw new Error('문서 엔진이 개체 삭제를 거절했습니다.');
            executed = true; return after;
          }});
          if (!executed) throw new Error('잘라내기를 적용하지 못해 원본을 유지했습니다.');
          if (picture) { this.cursor.exitPictureObjectSelection(); this.pictureObjectRenderer?.clear(); this.eventBus.emit('picture-object-selection-changed', false); }
          else { this.cursor.exitTableObjectSelection(); this.eventBus.emit('table-object-selection-changed', false); }
          this.updateCaret();
        },
      });
      if (outcome === 'stale') alert('복사는 완료했지만 문서나 선택이 바뀌어 원본을 잘라내지 않았습니다.');
      return outcome === 'cut';
    } catch (error) { alert('잘라내기 실패: ' + (error instanceof Error ? error.message : String(error))); return false; }
  }`);
  await writeFile(handler, source);
  const keyboard = join(root, 'src/engine/input-handler-keyboard.ts');
  source = (await readFile(keyboard, 'utf8')).replace(/\r\n/g, '\n');
  source = replaceMethod(source, '  // 개체 선택 모드 → 개체 잘라내기 (복사 후 삭제)', '  if (!this.cursor.hasSelection()) return;', `  // Use the same acknowledgement/version guard for native clipboard events.
  if (this.cursor.isInPictureObjectSelection() || this.cursor.isInTableObjectSelection()) {
    e.preventDefault(); void this.performObjectCutSafely(); return;
  }`);
  await writeFile(keyboard, source);
}
