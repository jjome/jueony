import type { DocumentViewState, ViewRestoreResult } from '../public/contracts.ts';
import type { DocumentViewAdapterOptions } from '../ports/viewport.ts';
import { validateDocumentView, validateBodyCaret } from '../domain/document-view.ts';
import {validateSessionCursor} from '../domain/session-cursor.ts';

export function createDocumentViewFacade(options: DocumentViewAdapterOptions) {
  type Pending = { identity: string; view: DocumentViewState; interaction?: number };
  let pending: Pending | undefined, last: Pending | undefined, applying = false;
  const copy = (view: DocumentViewState): DocumentViewState => ({ ...view, ...(view.caret ? { caret: { ...view.caret } } : {}), ...(view.cursor ? {cursor:validateSessionCursor(view.cursor)!} : {}) });
  function discardStale() {
    const identity = options.identity();
    if (pending?.identity !== identity) pending = undefined;
    if (last?.identity !== identity) last = undefined;
  }
  function capture(): DocumentViewState | undefined {
    discardStale();
    if (pending && options.visible() && pending.interaction !== options.cursorInteraction?.()) { pending = undefined; last = undefined; }
    if (pending) return copy(pending.view);
    if (!options.visible()) return last ? copy(last.view) : undefined;
    const viewport = options.viewport();
    if (!viewport) return undefined;
    const view = validateDocumentView({ version: 1, zoom: viewport.getZoom(), fitMode: viewport.getZoomFitMode(), scrollX: viewport.getScrollX(), scrollY: viewport.getScrollY(), caret: options.captureCaret?.(), cursor:options.captureCursor?.() });
    if (view) last = { identity: options.identity(), view };
    return view ? copy(view) : undefined;
  }
  /** Capture before display:none can collapse scroll; retry after showing. */
  function suspend(): DocumentViewState | undefined {
    const view = capture();
    // Keep an in-flight restore's item identity so a rapid hide/show does not
    // cancel the only scheduled settle/retry and leave a snapshot unapplied.
    if (view && !pending) pending = { identity: options.identity(), view: copy(view), interaction: options.cursorInteraction?.() };
    return view ? copy(view) : undefined;
  }
  async function retry(): Promise<ViewRestoreResult> {
    discardStale();
    const item = pending, viewport = options.viewport();
    if (!item) return 'ignored';
    if (applying || !viewport || !options.visible()) return 'deferred';
    if (item.interaction !== options.cursorInteraction?.()) { pending = undefined; last = undefined; capture(); return 'ignored'; }
    applying = true;
    try {
      const interaction = item.interaction;
      if (item.view.fitMode === 'none') viewport.setZoom(item.view.zoom, { x: 0, y: 0 }, 'none');
      else options.applyFit(item.view.fitMode);
      await options.settle();
      if (pending !== item || options.identity() !== item.identity) return 'ignored';
      if (!options.visible()) return 'deferred';
      if (interaction !== options.cursorInteraction?.()) {
        // Input arriving during layout owns the new cursor/scroll state.
        pending = undefined; last = undefined; capture(); return 'ignored';
      }
      // Optional old bookmarks cannot bypass the editor adapter's live-text checks.
      if (item.view.cursor) options.restoreCursor?.(validateSessionCursor(item.view.cursor)!);
      else if (item.view.caret) options.restoreCaret?.({ ...item.view.caret });
      // The browser viewport clamps an offset to its actual current scroll range.
      viewport.setScrollLeft(item.view.scrollX); viewport.setScrollTop(item.view.scrollY);
      pending = undefined;
      const current = validateDocumentView({ version: 1, zoom: viewport.getZoom(), fitMode: viewport.getZoomFitMode(), scrollX: viewport.getScrollX(), scrollY: viewport.getScrollY(), caret: validateBodyCaret(options.captureCaret?.()), cursor:options.captureCursor?.() });
      last = { identity: item.identity, view: current ?? copy(item.view) };
      return 'applied';
    } finally { applying = false; }
  }
  async function restore(value: unknown): Promise<ViewRestoreResult> {
    const view = validateDocumentView(value);
    if (!view) return value === undefined ? 'ignored' : 'invalid';
    pending = { identity: options.identity(), view, interaction: options.cursorInteraction?.() };
    last = undefined;
    return retry();
  }
  return {
    capture, suspend, restore, retry,
    isRestoring: () => applying,
    hasPending: () => { discardStale(); return Boolean(pending); },
    clear: () => { pending = undefined; last = undefined; },
  };
}
