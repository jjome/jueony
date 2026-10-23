/** Cursor-only Hancom navigation. Selection stays in the live editor, never in a file copy. */
export const bodyNavigationEdges = ['document-start', 'document-end', 'paragraph-start', 'paragraph-end', 'screen-start', 'screen-end'] as const;
export type BodyNavigationEdge = typeof bodyNavigationEdges[number];

export function isBodyNavigationContext(context: any, input: any): boolean {
  const cursor = input?.cursor;
  return Boolean(cursor && context.hasDocument && !context.isFormMode
    && !context.inTable && !context.inCellSelectionMode && !context.inPictureObjectSelection && !context.inTableObjectSelection
    && !cursor.isInHeaderFooter?.() && !cursor.isInFootnote?.() && !cursor.isInTextBox?.()
    && input.getCursorPosition?.()?.parentParaIndex === undefined);
}

export function navigateBody(input: any, edge: unknown, extend: unknown = false): boolean {
  if (!bodyNavigationEdges.includes(edge as BodyNavigationEdge) || typeof extend !== 'boolean') return false;
  input.flushDeferredPaginationIfNeeded('hangul-navigation');
  const cursor = input.cursor;
  let screenHit: any;
  const screen = edge === 'screen-start' || edge === 'screen-end';
  if (screen) {
    const rect = input.container.getBoundingClientRect(), fromTop = edge === 'screen-start';
    if (![rect.left, rect.top, rect.bottom, rect.width, rect.height].every(Number.isFinite) || rect.height <= 0 || rect.width <= 0) return false;
    for (let offset = 8; offset < rect.height; offset += 8) {
      const hit = input.hitTestFromClientPoint(rect.left + rect.width / 2, fromTop ? rect.top + offset : rect.bottom - offset);
      if (hit && hit.parentParaIndex === undefined) { screenHit = hit; break; }
    }
    // No live body line is visible: retain the existing selection and cursor.
    if (!screenHit) return false;
  }
  // F3 block mode extends through movement even without holding Shift. A
  // previous anchor is kept while Shift is held, including reversed selections.
  if (extend || cursor.isInBlockSelectionMode?.()) cursor.setAnchor();
  else cursor.clearSelection();
  if (edge === 'document-start') cursor.moveToDocumentStart();
  else if (edge === 'document-end') cursor.moveToDocumentEnd();
  else if (edge === 'paragraph-start' || edge === 'paragraph-end') {
    const position = cursor.getPosition();
    cursor.moveTo({ ...position, charOffset: edge === 'paragraph-start' ? 0 : input.wasm.getParagraphLength(position.sectionIndex, position.paragraphIndex) });
  } else {
    cursor.moveToHit(screenHit);
    if (edge === 'screen-start') cursor.moveToLineStart(); else cursor.moveToLineEnd();
  }
  // A screen-edge operation must not turn into a document-edge scroll. The
  // body document start/end and paragraph operations retain normal caret reveal.
  input.updateCaret(screen);
  input.focus();
  return true;
}

/** Ctrl+T has the same selection semantics as the engine's Ctrl+Delete. */
export function deleteBodyByShortcut(input: any, mode: 'line' | 'end' | 'word' | 'previous-word'): void {
  input.flushDeferredPaginationIfNeeded('hangul-shortcut');
  const cursor = input.cursor;
  if (mode !== 'word' && mode !== 'previous-word' || !cursor.hasSelection()) {
    cursor.clearSelection();
    if (mode === 'line') cursor.moveToLineStart();
    cursor.setAnchor();
    if (mode === 'word' || mode === 'previous-word') cursor.moveToWordBoundary(mode === 'word' ? 1 : -1); else cursor.moveToLineEnd();
    if (mode === 'line') {
      const position = cursor.getPosition();
      if (position.charOffset === input.wasm.getParagraphLength(position.sectionIndex, position.paragraphIndex)) cursor.moveHorizontal(1);
    }
  }
  if (cursor.hasSelection()) input.deleteSelection();
  input.updateCaret(); input.focus();
}
