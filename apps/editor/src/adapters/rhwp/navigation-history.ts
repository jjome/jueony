import { createNavigationHistory } from '../../modules/preferences/public/index.ts';
import type { SessionCursor } from '../../modules/preferences/public/index.ts';
import { captureSessionCursor, restoreSessionCursor } from './session-cursor.ts';

/** One live-document history, discarded on swap; never written to a file or storage. */
export function installNavigationHistory(registry: any, input: () => any, eventBus: any) {
  const history = createNavigationHistory<SessionCursor>(value => JSON.stringify(value));
  let timer: ReturnType<typeof setTimeout> | undefined, traveling = false;
  let generation: number | undefined;
  function atStoredPoint() {
    const saved = history.current(), position = input()?.getCursorPosition();
    if (!saved || !position) return false;
    const point = saved.focus, caret = point.caret;
    if (caret.section !== position.sectionIndex || caret.offset !== position.charOffset) return false;
    return point.kind === 'body'
      ? position.parentParaIndex === undefined && caret.paragraph === position.paragraphIndex
      : point.parentParagraph === position.parentParaIndex && point.control === position.controlIndex
        && point.cell === position.cellIndex && caret.paragraph === (position.cellParaIndex ?? position.paragraphIndex);
  }
  function contextSupported() {
    const ih = input(), c = ih?.cursor;
    return !!c && !ih.wasm.requiresPasswordForSave && !c.isInCellSelectionMode()
      && !c.isInHeaderFooter() && !c.isInFootnote() && !c.isInTextBox()
      && !c.isInTableObjectSelection() && !c.isInPictureObjectSelection()
      && (ih.getCursorPosition().cellPath?.length ?? 0) <= 1;
  }
  function capture() {
    if (!contextSupported()) return undefined;
    const saved = captureSessionCursor(input()?.getSessionCaretAccess());
    // Navigation restores an insertion point, not an old text/cell selection.
    return saved?.kind === 'text' ? { kind: 'text' as const, focus: saved.focus, blockPhase: null } : undefined;
  }
  function flush(): boolean {
    clearTimeout(timer); timer = undefined;
    const liveGeneration = input()?.wasm.documentGeneration;
    if (liveGeneration !== generation) { history.clear(); generation = liveGeneration; }
    // Loading swaps WASM before initializeDocument resets the old cursor. Do not
    // record that transient address as the first position in the new document.
    if ((window as any).jueonyEditor?.busy() || document.getElementById('studio-root')?.inert) { schedule(); return false; }
    const saved = capture(); if (saved) { history.record(saved); return true; }
    else if (input()?.wasm.requiresPasswordForSave) history.clear();
    return false;
  }
  function schedule() {
    if (traveling) return;
    clearTimeout(timer);
    // Coalesce typing and pagination rather than hashing an entire cell table per frame.
    timer = setTimeout(flush, 120);
  }
  eventBus.on('cursor-rect-updated', schedule);
  eventBus.on('document-changed', () => {
    if (input()?.wasm.requiresPasswordForSave) history.clear();
    schedule();
  });
  eventBus.on('document-swapped', () => {
    clearTimeout(timer); history.clear(); generation = undefined; schedule();
  });
  for (const [id, label, direction] of [
    ['ext:jueony-previous-cursor', '이전 커서 위치', -1],
    ['ext:jueony-next-cursor', '다음 커서 위치', 1],
  ] as const) {
    registry.register({ id, label,
      canExecute: (c: any) => c.hasDocument && !c.isFormMode && generation === input()?.wasm.documentGeneration && contextSupported()
        && (direction === -1 ? history.state().previous || (history.state().size > 0 && !atStoredPoint()) : history.state().next && atStoredPoint()),
      execute: () => {
        traveling = true;
        try {
          if (!flush()) throw new Error('현재 위치에서는 안전한 커서 이력을 만들 수 없습니다.');
          for (let saved = history.peek(direction); saved; saved = history.peek(direction)) {
            if (restoreSessionCursor(input()?.getSessionCaretAccess(), saved)) {
              history.accept(direction); input()?.focus(); eventBus.emit('command-state-changed'); return;
            }
            // Changed paragraph text or table structure cannot redirect an old bookmark.
            history.discard(direction);
          }
          eventBus.emit('command-state-changed');
          throw new Error('현재 문서에서 이동할 수 있는 커서 이력이 없습니다.');
        } finally { traveling = false; }
      },
    });
  }
  schedule();
}
