export function contextMenuIndex(count: number, current: number, key: string): number {
  if (count < 1) return -1;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  if (key === 'ArrowDown') return current < 0 ? 0 : (current + 1) % count;
  if (key === 'ArrowUp') return current < 0 ? count - 1 : (current - 1 + count) % count;
  return current;
}
export function contextMenuKeyHandler(menu: HTMLElement, close: () => void): (event: KeyboardEvent) => void {
  return event => {
    if (event.isComposing || event.ctrlKey || event.altKey || event.metaKey) return;
    if (!['Escape', 'Tab', 'ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(event.key)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (event.key === 'Escape' || event.key === 'Tab') { close(); return; }
    const items = [...menu.querySelectorAll<HTMLElement>('[role=menuitem]:not(.disabled)')], current = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'Enter' || event.key === ' ') { if (current >= 0) items[current].click(); return; }
    const index = contextMenuIndex(items.length, current, event.key); if (index >= 0) items[index].focus();
  };
}
