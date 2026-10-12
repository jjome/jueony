/** Keyboard ownership for generated Studio dialogs; no document mutation here. */
export function handleModalKeyboard(event: KeyboardEvent, overlay: HTMLElement, cancel: () => void, confirm: () => void): void {
  const modals = [...document.querySelectorAll<HTMLElement>('.modal-overlay, dialog[open]')];
  if (modals.at(-1) !== overlay) return;
  // A parent dialog must never process a child's Escape, Tab, or Enter.
  event.stopImmediatePropagation();
  if (event.isComposing || event.keyCode === 229) return;
  if (event.key === 'Escape') { event.preventDefault(); cancel(); return; }
  if (event.key === 'Tab') {
    const elements = [...overlay.querySelectorAll<HTMLElement>('button, input, textarea, select, a[href], [tabindex]')]
      .filter(element => !element.matches(':disabled, [tabindex="-1"]') && !element.closest('[inert]') && element.getClientRects().length > 0);
    event.preventDefault();
    const index = elements.indexOf(document.activeElement as HTMLElement);
    const next = index < 0 ? (event.shiftKey ? elements.length - 1 : 0) : (index + (event.shiftKey ? -1 : 1) + elements.length) % elements.length;
    (elements[next] ?? overlay).focus();
    return;
  }
  const target = event.target instanceof HTMLElement ? event.target : null;
  const option = target?.closest<HTMLElement>('[role="option"]'), listbox = option?.closest<HTMLElement>('[role="listbox"]');
  if (option && listbox && ['ArrowDown','ArrowUp','Home','End'].includes(event.key)) {
    const options = [...listbox.querySelectorAll<HTMLElement>('[role="option"]')].filter(el => el.getAttribute('aria-disabled') !== 'true' && el.getClientRects().length > 0);
    const index = options.indexOf(option);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : Math.max(0, Math.min(options.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)));
    event.preventDefault(); options[next]?.click();
    // A selection change may rebuild option nodes. Recover focus from the live list.
    [...listbox.querySelectorAll<HTMLElement>('[role="option"]')].filter(el => el.getAttribute('aria-disabled') !== 'true' && el.getClientRects().length > 0)[next]?.focus();
    return;
  }
  if (event.key === 'Enter' && target instanceof HTMLButtonElement) {
    // Consume before focus changes: the key must not become a document Enter
    // after closing the dialog or also activate its default confirm button.
    event.preventDefault(); if (!target.disabled && !event.repeat) target.click(); return;
  }
  if (target?.closest('input, textarea, select, button, a, [contenteditable="true"], [role="textbox"]')) return;
  event.preventDefault();
  if (event.key === 'Enter') confirm();
}
