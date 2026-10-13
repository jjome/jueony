import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const replace = (source, before, after, label) => { if (source.split(before).length !== 2) throw new Error('빠른 메뉴 패치 기준 불일치: ' + label); return source.replace(before, after); };
export async function applyKeyboardContextPatches({ root }) {
  const inputPath = join(root, 'src/engine/input-handler.ts'); let input = (await readFile(inputPath, 'utf8')).replace(/\r\n/g, '\n');
  input = replace(input, '  setContextMenu(cm: ContextMenu): void { this.contextMenu = cm; }', `  setContextMenu(cm: ContextMenu): void { this.contextMenu = cm; }
  /** Keyboard menus use the current selection; never mouse-hit-test and move it. */
  showKeyboardContextMenu(): boolean {
    if (!this.active || !this.contextMenu || this.isComposing) return false;
    const c = this.cursor;
    const items = c.isInPictureObjectSelection() ? this.getPictureObjectContextMenuItems()
      : c.isInTableObjectSelection() ? this.getTableObjectContextMenuItems()
      : c.isInCell() || c.isInCellSelectionMode() ? this.getTableContextMenuItems() : this.getDefaultContextMenuItems();
    try { const field = this.wasm.getFieldInfoAt(c.getPosition()); if (field.inField) items.push({type:'separator'},{type:'command',commandId:'field:edit',label:'누름틀 고치기...'},{type:'command',commandId:'field:remove',label:'누름틀 지우기'}); } catch { /* no supported field */ }
    const visible = this.container.getBoundingClientRect(), rect = c.getRect(), content = this.container.querySelector<HTMLElement>('#scroll-content');
    let x = visible.left + 20, y = visible.top + 20;
    if (rect && content) { const origin = content.getBoundingClientRect(), zoom = this.viewportManager.getZoom(); x = origin.left + this.virtualScroll.getPageLeftResolved(rect.pageIndex, content.clientWidth) + rect.x * zoom; y = origin.top + this.virtualScroll.getPageOffset(rect.pageIndex) + (rect.y + rect.height) * zoom; }
    this.contextMenu.show(Math.max(visible.left, Math.min(visible.right - 20, x)), Math.max(visible.top, Math.min(visible.bottom - 20, y)), items, true); return true;
  }`, 'current cursor entry'); await writeFile(inputPath, input);
  const path = join(root, 'src/ui/context-menu.ts'); let source = (await readFile(path, 'utf8')).replace(/\r\n/g, '\n');
  source = "import { contextMenuKeyHandler } from '../jueony/adapters/browser/context-menu-keyboard.ts';\n" + source;
  source = replace(source, '  private el: HTMLDivElement | null = null;', '  private el: HTMLDivElement | null = null;\n  private returnFocus: HTMLElement | null = null;', 'focus field');
  source = replace(source, 'show(x: number, y: number, items: ContextMenuItem[]): void {', 'show(x: number, y: number, items: ContextMenuItem[], keyboard = false): void {', 'keyboard option');
  source = replace(source, "    menu.className = 'context-menu';", "    menu.className = 'context-menu';\n    menu.setAttribute('role','menu'); menu.tabIndex = -1;\n    this.returnFocus = keyboard && document.activeElement instanceof HTMLElement ? document.activeElement : null;", 'menu semantics');
  source = replace(source, '      row.dataset.cmd = cmdId;', "      row.dataset.cmd = cmdId;\n      row.setAttribute('role','menuitem'); row.tabIndex = -1;", 'item semantics');
  source = replace(source, "        row.classList.add('disabled');", "        row.classList.add('disabled'); row.setAttribute('aria-disabled','true');", 'disabled semantics');
  const start = source.indexOf('    this.escHandler = (e: KeyboardEvent) => {'), end = source.indexOf("    document.addEventListener('keydown', this.escHandler, true);", start);
  if (start < 0 || end < 0) throw new Error('빠른 메뉴 키 처리 경계 없음');
  source = source.slice(0, start) + '    this.escHandler = contextMenuKeyHandler(menu, () => this.hide());\n    if (keyboard) menu.querySelector<HTMLElement>(\'[role=menuitem]:not(.disabled)\')?.focus();\n' + source.slice(end);
  source = replace(source, '    requestAnimationFrame(() => {\n      this.outsideHandler', '    requestAnimationFrame(() => {\n      if (this.el !== menu) return;\n      this.outsideHandler', 'closed menu callback');
  source = replace(source, '    this.el?.remove();\n    this.el = null;', "    const restore = this.returnFocus; const focused = this.el?.contains(document.activeElement);\n    this.el?.remove(); this.el = null; this.returnFocus = null;\n    if (focused && restore?.isConnected && !document.querySelector('.modal-overlay,dialog[open]')) restore.focus();", 'focus restore');
  await writeFile(path, source);
}
