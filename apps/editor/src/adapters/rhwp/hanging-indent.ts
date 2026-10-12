import { planHangingIndent } from '../../modules/document/public/index.ts';
import { createParagraphSpacingReader } from './paragraph-spacing.ts';

/** First visual line of body/flat cell only; never expands a text or cell block. */
export function installHangingIndent(registry: any, input: () => any) {
  function read() {
    const ih = input(), cursor = ih?.cursor, p = ih?.getCursorPosition();
    if (!cursor || !p || cursor.hasSelection() || cursor.isInCellSelectionMode()
      || cursor.isInHeaderFooter() || cursor.isInFootnote() || cursor.isInTextBox()
      || cursor.isInTableObjectSelection() || cursor.isInPictureObjectSelection()
      || (p.cellPath?.length ?? 0) > 1 || ih.isComposing) throw new Error('본문 또는 일반 셀 첫 줄의 커서에서 실행하세요.');
    const cell = p.parentParaIndex !== undefined;
    const target = cell
      ? { kind: 'cell' as const, sec: p.sectionIndex, parentPara: p.parentParaIndex, controlIdx: p.controlIndex, cellIdx: p.cellIndex, cellParaIdx: p.cellParaIndex ?? p.paragraphIndex }
      : { kind: 'body' as const, sec: p.sectionIndex, para: p.paragraphIndex };
    const line = cell ? ih.wasm.getLineInfoInCell(p.sectionIndex, p.parentParaIndex, p.controlIndex, p.cellIndex, target.kind === 'cell' ? target.cellParaIdx : 0, p.charOffset)
      : ih.wasm.getLineInfo(p.sectionIndex, p.paragraphIndex, p.charOffset);
    if (line.charStart !== 0) throw new Error('현재는 문단 첫 줄에서만 빠른 내어쓰기를 지원합니다.');
    const doc = ih.wasm.borrowDocumentHandle();
    if (!doc) throw new Error('문서가 없습니다.');
    const rectAt = (offset: number) => cell
      ? JSON.parse(doc.getCursorRectInCell(p.sectionIndex, p.parentParaIndex, p.controlIndex, p.cellIndex, target.kind === 'cell' ? target.cellParaIdx : 0, offset))
      : JSON.parse(doc.getCursorRect(p.sectionIndex, p.paragraphIndex, offset));
    const begin = rectAt(0), end = rectAt(p.charOffset);
    if (begin.pageIndex !== end.pageIndex || Math.abs(begin.y - end.y) > 0.1) throw new Error('같은 첫 줄의 커서 위치가 아닙니다.');
    const props = planHangingIndent(createParagraphSpacingReader(ih.wasm)(target), end.x - begin.x);
    return { p, target, props };
  }
  registry.register({ id: 'ext:jueony-hanging-indent', label: '빠른 내어쓰기',
    canExecute: (c: any) => {
      if (!c.hasDocument || !c.isEditable || c.isFormMode) return false;
      try { read(); return true; } catch { return false; }
    },
    execute: () => {
      const ih = input(); ih.flushDeferredPaginationIfNeeded('hanging-indent');
      const { p, target, props } = read(); if (!props) return;
      ih.executeOperation({ kind: 'snapshot', operationType: 'hangingIndent', operation: (wasm: any) => {
        if (target.kind === 'body') wasm.applyParaFormat(target.sec, target.para, JSON.stringify(props));
        else wasm.applyParaFormatInCell(target.sec, target.parentPara, target.controlIdx, target.cellIdx, target.cellParaIdx, JSON.stringify(props));
        return p;
      } });
      ih.updateCaret(); ih.focus();
    },
  });
}
