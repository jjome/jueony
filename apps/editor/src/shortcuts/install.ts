import { installEqualCells, equalCellHelp } from '../editor-actions/equal-cells.ts';
import { installNavigationPane } from '../editor-actions/navigation-pane.ts';
import { selectWholeCellBand } from './cell-band.ts';
import { HangulKeyResolver, hangulBindings } from './keymap.ts';
import { resolveDefaultStyle } from './style-slots.ts';
import { defaultShortcuts } from '../../command/shortcut-map';
import { getObjectProps, setObjectProps } from '../../engine/object-props';
import { installCaptionCommands } from '../adapters/rhwp/manual-commands.ts';
import { installNavigationHistory } from '../adapters/rhwp/navigation-history.ts';
import { installCalendarStamp } from '../adapters/rhwp/calendar-stamp.ts';
import { installHangingIndent } from '../adapters/rhwp/hanging-indent.ts';
import { installTransposeTable } from '../adapters/rhwp/transpose-table.ts';
import { installDocumentInsertion } from '../adapters/rhwp/document-insertion.ts';
import { installBasicTextCommands } from '../adapters/rhwp/basic-text-commands.ts';

export function installHangulKeys({ automation, registry, input, eventBus }: { automation: any; registry: any; input: () => any; eventBus: any }) {
  const resolver = new HangulKeyResolver();
  installEqualCells(registry, input);
  installNavigationPane(registry, input, eventBus);
  installCaptionCommands({ registry, input, getObjectProps, setObjectProps });
  installNavigationHistory(registry, input, eventBus);
  installCalendarStamp(registry, input, eventBus);
  installHangingIndent(registry, input);
  installTransposeTable(registry, input, eventBus);
  installDocumentInsertion(registry, input, eventBus);
  installBasicTextCommands(registry, input, eventBus);
  // The pinned Studio marked the entire caption submenu as a stub; child state is now registry-owned.
  document.querySelector('[data-cmd="insert:caption-top"]')?.closest('.md-sub')?.classList.remove('disabled');
  const unsupported = new Set<string>();
  // Keep the engine fallback consistent as well (IME and submode handlers use it).
  defaultShortcuts.splice(0, defaultShortcuts.length, ...hangulBindings.filter(b => b.scope === 'document' && b.keys !== 'Shift+Tab' && !b.keys.includes(',') && !b.command.startsWith('pending:') && !b.nativeClipboard).map(b => {
    const parts = b.keys.split('+'), key = parts.at(-1)!;
    return [{ key: key === 'Space' ? ' ' : key.toLowerCase(), ...(/^[A-Z]$/.test(key) ? { code: 'Key' + key } : {}), ctrl: parts.includes('Ctrl'), alt: parts.includes('Alt'), shift: parts.includes('Shift') }, b.command] as typeof defaultShortcuts[number];
  }));
  const notice = document.createElement('div'); notice.id = 'jueony-key-hint'; notice.setAttribute('role', 'status');
  Object.assign(notice.style, { position: 'fixed', bottom: '35px', left: '16px', zIndex: '5000', background: '#193452', color: 'white', padding: '8px 14px', borderRadius: '6px', pointerEvents: 'none', display: 'none' });
  document.body.append(notice); let timer: ReturnType<typeof setTimeout>;
  const hint = (text: string) => { clearTimeout(timer); notice.textContent = text; notice.style.display = text ? '' : 'none'; timer = setTimeout(() => { notice.style.display = 'none'; }, 3000); };
  const register = (id: string, label: string, execute: (services: any, params?: any) => void, bodyOnly = false) => registry.register({
    id, label, canExecute: (c: any) => c.hasDocument && c.isEditable && !c.isFormMode && (!bodyOnly || (!c.inTable && !c.inCellSelectionMode && !c.inPictureObjectSelection && !c.inTableObjectSelection && !input()?.cursor?.isInHeaderFooter?.() && !input()?.cursor?.isInFootnote?.() && !input()?.cursor?.isInTextBox?.())), execute,
  });
  register('ext:jueony-normal', '보통 모양', () => eventBus.emit('format-char', { bold: false, italic: false, underline: false, strikethrough: false, outlineType: 0, shadowType: 0, emboss: false, engrave: false, superscript: false, subscript: false }));
  registry.register({id:'ext:jueony-paragraph-spacing',label:'문단 여백·첫 줄 조절',
    canExecute:(c:any)=>c.hasDocument&&c.isEditable&&!c.isFormMode&&!c.inPictureObjectSelection&&!c.inTableObjectSelection
      &&!input()?.cursor?.isInHeaderFooter?.()&&!input()?.cursor?.isInFootnote?.()&&!input()?.cursor?.isInTextBox?.()
      &&(input()?.getCursorPosition()?.cellPath?.length??0)<=1,
    execute:(_s:any,p:any)=>{if(!input()?.adjustParagraphSpacing(p?.operation))throw new Error('현재 문맥에서 문단 여백을 조절할 수 없습니다.');},
  });
  register('ext:jueony-default-style', '기본 스타일 단축키', (_s, p) => {
    const ih = input(), styleId = resolveDefaultStyle(ih.wasm.getStyleList(), p?.slot);
    if (styleId === undefined) throw new Error('해당 기본 스타일을 찾을 수 없습니다. F6에서 문서의 스타일을 확인하세요.');
    ih.applyStyle(styleId);
  }, true);
  register('ext:jueony-color', '글자색', (_s, p) => { if (!/^#[\da-f]{6}$/i.test(p?.textColor ?? '')) throw new Error('글자색 형식 오류'); eventBus.emit('format-char', { textColor: p.textColor }); });
  for (const [id, label, mode] of [['ext:jueony-delete-line', '한 줄 지우기', 'line'], ['ext:jueony-delete-line-end', '줄 뒤 지우기', 'end'], ['ext:jueony-delete-word', '한 단어 지우기', 'word']]) {
    register(id, label, () => {
      const ih = input(), cursor = ih.cursor; ih.flushDeferredPaginationIfNeeded('hangul-shortcut');
      cursor.clearSelection(); if (mode === 'line') cursor.moveToLineStart(); cursor.setAnchor();
      if (mode === 'word') cursor.moveToWordBoundary(1); else cursor.moveToLineEnd();
      if (mode === 'line') {
        const pos = cursor.getPosition();
        if (pos.charOffset === ih.wasm.getParagraphLength(pos.sectionIndex, pos.paragraphIndex)) cursor.moveHorizontal(1);
      }
      if (cursor.hasSelection()) ih.deleteSelection();
      ih.updateCaret(); ih.focus();
    }, true);
  }
  register('ext:jueony-navigate', '한글 커서 이동', (_s, p) => {
    const ih = input(), cursor = ih.cursor; ih.flushDeferredPaginationIfNeeded('hangul-navigation');
    cursor.clearSelection();
    if (p.edge === 'document-start') cursor.moveToDocumentStart();
    else if (p.edge === 'document-end') cursor.moveToDocumentEnd();
    else if (p.edge === 'paragraph-start' || p.edge === 'paragraph-end') {
      const pos = cursor.getPosition(); cursor.moveTo({ ...pos, charOffset: p.edge === 'paragraph-start' ? 0 : ih.wasm.getParagraphLength(pos.sectionIndex, pos.paragraphIndex) });
    } else {
      const container = ih.container as HTMLElement, rect = container.getBoundingClientRect();
      const x = rect.left + rect.width / 2, fromTop = p.edge === 'screen-start';
      for (let offset = 8; offset < rect.height; offset += 8) {
        const hit = ih.hitTestFromClientPoint(x, fromTop ? rect.top + offset : rect.bottom - offset);
        if (hit && hit.parentParaIndex === undefined) { cursor.moveToHit(hit); if (fromTop) cursor.moveToLineStart(); else cursor.moveToLineEnd(); break; }
      }
    }
    ih.updateCaret(); ih.focus();
  }, true);
  for (const [axis, label] of [['columns', '칸 전체 블록'], ['rows', '줄 전체 블록']] as const) {
    registry.register({
      id: 'ext:jueony-select-cell-' + axis, label,
      canExecute: (c: any) => c.hasDocument && c.inCellSelectionMode && !c.isFormMode,
      execute: () => { if (!selectWholeCellBand(input(), axis)) throw new Error('현재 표의 셀 블록을 다시 선택해 주세요.'); },
    });
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
    const ih = input(), target = event.target instanceof HTMLElement ? event.target : null;
    if (document.querySelector('.modal-overlay, dialog[open]') || target?.closest('#jueony-navigation-pane') || (target?.closest('input, textarea, select, [contenteditable=true], [role=textbox]') && target !== ih?.textarea)) { resolver.reset(); return; }
    const c = automation.getContext();
    // In tables Shift+Tab belongs to cell navigation; hanging indent uses Ctrl+Shift+Tab.
    if ((c.inTable || c.inCellSelectionMode) && event.key === 'Tab' && event.shiftKey && !event.ctrlKey && !event.altKey) { resolver.reset(); return; }
    if (event.isComposing || ih?.isComposing || event.keyCode === 229) {
      if (event.ctrlKey || event.altKey) {
        const candidate = resolver.resolve({ key: event.key, code: event.code, ctrlKey: event.ctrlKey, altKey: event.altKey, shiftKey: event.shiftKey, metaKey: event.metaKey, repeat: event.repeat, isComposing: false }, { table: c.inTable || c.inCellSelectionMode, cells: c.inCellSelectionMode, object: c.inPictureObjectSelection || c.inTableObjectSelection });
        if (candidate.handled && !candidate.binding?.nativeClipboard) { event.preventDefault(); event.stopImmediatePropagation(); hint('한글 조합을 마친 뒤 단축키를 다시 사용하세요.'); }
      }
      resolver.reset(); return;
    }
    const result = resolver.resolve(event, { table: c.inTable || c.inCellSelectionMode, cells: c.inCellSelectionMode, object: c.inPictureObjectSelection || c.inTableObjectSelection });
    if (!result.handled) return;
    // Trusted native clipboard events carry HWP/HTML/text data and OS consent.
    if (result.binding?.nativeClipboard) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if ((window as any).jueonyEditor?.busy() || document.getElementById('studio-root')?.inert) { hint('문서 작업이 끝난 뒤 단축키를 사용하세요.'); resolver.reset(); return; }
    if (result.hint) hint(result.hint);
    if (!result.binding) return;
    const b = result.binding;
    if (!registry.has(b.command) || unsupported.has(b.command)) { hint(b.label + ': 아직 지원하지 않는 기능입니다.'); return; }
    const outcome = automation.execute(b.command, b.params, { allowDialog: true });
    hint(outcome.ok ? '' : b.command === 'table:cell-height-equal' || b.command === 'table:cell-width-equal' ? equalCellHelp : b.label + ': 현재 문맥에서 실행할 수 없습니다.');
  }, true);
  const api = (window as any).jueonyEditor;
  api.shortcuts = () => hangulBindings.map(b => ({ ...b, registered: registry.has(b.command), supported: registry.has(b.command) && !unsupported.has(b.command), enabled: automation.isEnabled(b.command) }));
  const button = document.createElement('button'); button.textContent = '단축키'; button.type = 'button'; button.title = '한글 2024 단축키와 지원 상태';
  button.onclick = () => {
    const dialog = document.createElement('dialog'); dialog.style.cssText = 'max-width:780px;width:85%;max-height:80vh;border:1px solid #ccd5df;border-radius:8px;padding:20px';
    const title = document.createElement('h2'); title.textContent = '한글 2024 단축키';
    const text = document.createElement('p'); text.textContent = '문서에 포커스가 있을 때 사용합니다. Ctrl+N 등 일부 조합은 브라우저가 먼저 처리할 수 있습니다. 한글 IME와 네이티브 호스트 검수는 별도입니다.';
    const search = document.createElement('input'); search.placeholder = '기능 또는 단축키 검색'; search.setAttribute('aria-label', '단축키 검색');
    const list = document.createElement('div'); const render = () => { list.replaceChildren(); for (const b of api.shortcuts().filter((v: any) => (v.keys + v.label).toLowerCase().includes(search.value.toLowerCase()))) { const row = document.createElement('p'); row.textContent = `${b.keys} — ${b.label} · ${b.scope === 'document' ? '문서' : b.scope === 'cells' ? '셀 블록' : b.scope === 'table' ? '표 안' : '개체 선택'} · ${b.supported ? '연결됨' : '미지원'}`; list.append(row); } };
    const close = document.createElement('button'); close.textContent = '닫기'; close.onclick = () => dialog.close();
    search.oninput = render; dialog.append(title, text, search, close, list); document.body.append(dialog); dialog.addEventListener('close', () => dialog.remove()); render(); dialog.showModal(); search.focus();
  };
  registry.register({ id: 'ext:jueony-shortcut-help', label: '단축키 도움말', opensDialog: true, execute: () => button.click() });
  document.getElementById('jueony-title')?.append(button);
}
