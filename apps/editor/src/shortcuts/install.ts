import { HangulKeyResolver, hangulBindings } from './keymap.ts';
import { defaultShortcuts } from '../../command/shortcut-map';

export function installHangulKeys({ automation, registry, input, eventBus }: { automation: any; registry: any; input: () => any; eventBus: any }) {
  const resolver = new HangulKeyResolver();
  // Keep the engine fallback consistent as well (IME and submode handlers use it).
  defaultShortcuts.splice(0, defaultShortcuts.length, ...hangulBindings.filter(b => b.scope === 'document' && !b.keys.includes(',') && !b.command.startsWith('pending:')).map(b => {
    const parts = b.keys.split('+'), key = parts.at(-1)!;
    return [{ key: key.toLowerCase(), ...(/^[A-Z]$/.test(key) ? { code: 'Key' + key } : {}), ctrl: parts.includes('Ctrl'), alt: parts.includes('Alt'), shift: parts.includes('Shift') }, b.command] as typeof defaultShortcuts[number];
  }));
  const notice = document.createElement('div'); notice.id = 'jueony-key-hint'; notice.setAttribute('role', 'status');
  Object.assign(notice.style, { position: 'fixed', bottom: '35px', left: '16px', zIndex: '5000', background: '#193452', color: 'white', padding: '8px 14px', borderRadius: '6px', pointerEvents: 'none', display: 'none' });
  document.body.append(notice); let timer: ReturnType<typeof setTimeout>;
  const hint = (text: string) => { clearTimeout(timer); notice.textContent = text; notice.style.display = text ? '' : 'none'; timer = setTimeout(() => { notice.style.display = 'none'; }, 3000); };
  const register = (id: string, label: string, execute: (services: any, params?: any) => void, bodyOnly = false) => registry.register({
    id, label, canExecute: (c: any) => c.hasDocument && c.isEditable && !c.isFormMode && (!bodyOnly || (!c.inTable && !c.inCellSelectionMode && !c.inPictureObjectSelection && !c.inTableObjectSelection && !input()?.cursor?.isInHeaderFooter?.() && !input()?.cursor?.isInFootnote?.() && !input()?.cursor?.isInTextBox?.())), execute,
  });
  register('ext:jueony-normal', '보통 모양', () => eventBus.emit('format-char', { bold: false, italic: false, underline: false, strikethrough: false, outline: false, shadow: false, emboss: false, engrave: false, superscript: false, subscript: false }));
  register('ext:jueony-color', '글자색', (_s, p) => { if (!/^#[\da-f]{6}$/i.test(p?.textColor ?? '')) throw new Error('글자색 형식 오류'); eventBus.emit('format-char', { textColor: p.textColor }); });
  for (const [id, label, mode] of [['ext:jueony-delete-line', '한 줄 지우기', 'line'], ['ext:jueony-delete-line-end', '줄 뒤 지우기', 'end'], ['ext:jueony-delete-word', '한 단어 지우기', 'word']]) {
    register(id, label, () => {
      const ih = input(), cursor = ih.cursor; ih.flushDeferredPaginationIfNeeded('hangul-shortcut');
      cursor.clearSelection(); if (mode === 'line') cursor.moveToLineStart(); cursor.setAnchor();
      if (mode === 'word') cursor.moveToWordBoundary(1); else cursor.moveToLineEnd();
      if (cursor.hasSelection()) ih.deleteSelection();
      ih.updateCaret(); ih.focus();
    }, true);
  }
  registry.register({ id: 'ext:jueony-close', label: '문서 닫기', canExecute: () => window.parent !== window, execute: () => window.parent.postMessage({ type: 'jueony:close-document' }, location.origin) });
  const labels = new Map<string, string[]>();
  for (const b of hangulBindings) { if (!labels.has(b.command)) labels.set(b.command, []); labels.get(b.command)!.push(b.keys); }
  for (const [id, keys] of labels) { const old = registry.get(id); if (old) registry.register({ ...old, shortcutLabel: keys.join(' / ') }); }
  for (const item of document.querySelectorAll<HTMLElement>('.md-item[data-cmd]')) {
    const label = registry.get(item.dataset.cmd)?.shortcutLabel;
    if (!label) continue;
    let el = item.querySelector<HTMLElement>('.md-shortcut');
    if (!el) { el = document.createElement('span'); el.className = 'md-shortcut'; item.append(el); }
    el.textContent = label;
  }
  const reset = () => { resolver.reset(); hint(''); };
  window.addEventListener('blur', reset);
  document.addEventListener('pointerdown', reset, true);
  document.addEventListener('compositionstart', reset, true);
  document.addEventListener('focusin', () => resolver.reset(), true);
  eventBus.on('document-swapped', reset);
  window.addEventListener('keydown', (event: KeyboardEvent) => {
    const ih = input(), target = event.target as HTMLElement | null;
    if (document.querySelector('.modal-overlay, dialog[open]') || (target?.closest('input, textarea, select, [contenteditable=true], [role=textbox]') && target !== ih?.textarea)) { resolver.reset(); return; }
    const c = automation.getContext();
    if (event.isComposing || ih?.isComposing || event.keyCode === 229) {
      if (event.ctrlKey || event.altKey) {
        const candidate = resolver.resolve({ key: event.key, code: event.code, ctrlKey: event.ctrlKey, altKey: event.altKey, shiftKey: event.shiftKey, metaKey: event.metaKey, repeat: event.repeat, isComposing: false }, { table: c.inTable || c.inCellSelectionMode, cells: c.inCellSelectionMode, object: c.inPictureObjectSelection || c.inTableObjectSelection });
        if (candidate.handled) { event.preventDefault(); event.stopImmediatePropagation(); hint('한글 조합을 마친 뒤 단축키를 다시 사용하세요.'); }
      }
      resolver.reset(); return;
    }
    const result = resolver.resolve(event, { table: c.inTable || c.inCellSelectionMode, cells: c.inCellSelectionMode, object: c.inPictureObjectSelection || c.inTableObjectSelection });
    if (!result.handled) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if ((window as any).jueonyEditor?.busy() || document.getElementById('studio-root')?.inert) { hint('문서 작업이 끝난 뒤 단축키를 사용하세요.'); resolver.reset(); return; }
    if (result.hint) hint(result.hint);
    if (!result.binding) return;
    const b = result.binding;
    if (!registry.has(b.command)) { hint(b.label + ': 아직 지원하지 않는 기능입니다.'); return; }
    const outcome = automation.execute(b.command, b.params, { allowDialog: true });
    hint(outcome.ok ? '' : b.label + ': 현재 문맥에서 실행할 수 없습니다.');
  }, true);
  const api = (window as any).jueonyEditor;
  api.shortcuts = () => hangulBindings.map(b => ({ ...b, registered: registry.has(b.command), enabled: automation.isEnabled(b.command) }));
  const button = document.createElement('button'); button.textContent = '단축키'; button.type = 'button'; button.title = '한글 2024 단축키와 지원 상태';
  button.onclick = () => {
    const dialog = document.createElement('dialog'); dialog.style.cssText = 'max-width:780px;width:85%;max-height:80vh;border:1px solid #ccd5df;border-radius:8px;padding:20px';
    const title = document.createElement('h2'); title.textContent = '한글 2024 단축키';
    const text = document.createElement('p'); text.textContent = '문서에 포커스가 있을 때 사용합니다. Ctrl+N 등 일부 조합은 브라우저가 먼저 처리할 수 있습니다. 한글 IME와 네이티브 호스트 검수는 별도입니다.';
    const search = document.createElement('input'); search.placeholder = '기능 또는 단축키 검색'; search.setAttribute('aria-label', '단축키 검색');
    const list = document.createElement('div'); const render = () => { list.replaceChildren(); for (const b of api.shortcuts().filter((v: any) => (v.keys + v.label).toLowerCase().includes(search.value.toLowerCase()))) { const row = document.createElement('p'); row.textContent = `${b.keys} — ${b.label} · ${b.scope === 'document' ? '문서' : b.scope === 'cells' ? '셀 블록' : b.scope === 'table' ? '표 안' : '개체 선택'} · ${b.registered ? '연결됨' : '미지원'}`; list.append(row); } };
    const close = document.createElement('button'); close.textContent = '닫기'; close.onclick = () => dialog.close();
    search.oninput = render; dialog.append(title, text, search, close, list); document.body.append(dialog); dialog.addEventListener('close', () => dialog.remove()); render(); dialog.showModal(); search.focus();
  };
  document.getElementById('jueony-title')?.append(button);
}
