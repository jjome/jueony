/** Resize the chat without touching the document's paper size or zoom. */
export function installPaneResize(options: {
  root: HTMLElement;
  sidebar: HTMLElement;
  handle: HTMLElement;
  chat: HTMLElement;
  initialWidth?: number;
  commit: (width: number | undefined) => void;
}) {
  const { root, sidebar, handle, chat } = options;
  let preferred = Number.isFinite(options.initialWidth) && options.initialWidth! > 0 ? options.initialWidth : undefined;
  let drag: { id: number; x: number; width: number; previous: number | undefined } | undefined;
  const defaultWidth = () => matchMedia('(max-width:1200px)').matches ? 290 : 340;
  const bounds = () => {
    const available = Math.max(0, root.clientWidth - sidebar.getBoundingClientRect().width - handle.offsetWidth);
    // On small windows both panes still fit; enlarging restores the preferred width.
    return { available, min: Math.min(260, available * .42), max: available - Math.min(360, available * .58) };
  };
  const update = () => {
    const { available, min, max } = bounds();
    const width = Math.max(min, Math.min(max, preferred ?? defaultWidth()));
    root.style.setProperty('--agent-width', width + 'px');
    handle.setAttribute('aria-valuemin', String(Math.round(min)));
    handle.setAttribute('aria-valuemax', String(Math.round(max)));
    handle.setAttribute('aria-valuenow', String(Math.round(width)));
    handle.setAttribute('aria-valuetext', `AI 대화 ${Math.round(width)}px, 문서 ${Math.round(available - width)}px`);
    return width;
  };
  const finish = (cancel: boolean) => {
    if (!drag) return;
    const active = drag; drag = undefined;
    if (cancel) preferred = active.previous;
    root.classList.remove('is-resizing');
    if (handle.hasPointerCapture(active.id)) handle.releasePointerCapture(active.id);
    update();
    if (!cancel) options.commit(preferred);
  };
  const reset = () => { finish(true); preferred = undefined; update(); options.commit(undefined); };
  handle.addEventListener('pointerdown', e => {
    if (e.button !== 0 || !e.isPrimary || drag) return;
    e.preventDefault(); handle.focus();
    drag = { id: e.pointerId, x: e.clientX, width: chat.getBoundingClientRect().width, previous: preferred };
    handle.setPointerCapture(e.pointerId);
    root.classList.add('is-resizing');
  });
  handle.addEventListener('pointermove', e => {
    if (!drag || drag.id !== e.pointerId) return;
    const { min, max } = bounds();
    preferred = Math.max(min, Math.min(max, drag.width + e.clientX - drag.x)); update();
  });
  handle.addEventListener('pointerup', e => { if (drag?.id === e.pointerId) finish(false); });
  handle.addEventListener('pointercancel', () => finish(true));
  handle.addEventListener('lostpointercapture', () => finish(true));
  window.addEventListener('blur', () => finish(true));
  handle.addEventListener('dblclick', reset);
  handle.addEventListener('keydown', e => {
    if (e.isComposing || e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.key === 'Escape' && drag) { e.preventDefault(); finish(true); return; }
    if (drag) return;
    if (e.key === 'Enter') { e.preventDefault(); reset(); return; }
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault(); const { min, max } = bounds();
    preferred = e.key === 'Home' ? min : e.key === 'End' ? max : Math.max(min, Math.min(max, update() + (e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 40 : 10)));
    update(); options.commit(preferred);
  });
  // Sidebar folding changes the available width even when the window stays the same size.
  const observer = new ResizeObserver(update); observer.observe(root); observer.observe(sidebar);
  update();
}
