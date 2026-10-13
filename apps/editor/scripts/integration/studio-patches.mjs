import {readFile,writeFile,cp} from 'node:fs/promises';
import {join} from 'node:path';
// Pinned upstream integration only. Product policies live in modules/adapters.
export async function applyStudioPatches({root,upstream,app}){
function replaceOnce(text, before, after, label) {
  if (text.split(before).length !== 2) throw new Error(`소스 패치 기준 불일치: ${label}`);
  return text.replace(before, after);
}
let html = await readFile(join(upstream, 'rhwp-studio/index.html'), 'utf8');
html = replaceOnce(html, '<script src="/theme-init.js"></script>', '<script src="/jueony-boot.js"></script>\n  <script src="/theme-init.js"></script>', 'boot');
html = replaceOnce(html, '<title>rhwp-studio</title>', '<title>Jueony 문서 편집기 · 개발판</title>', 'title');
html = html.replaceAll('rhwp-studio 문서 편집기', 'Jueony 문서 편집기');
html = html.replace('data-i18n="ui.studioHeader.srLabel"', '');
html = replaceOnce(html, '<div id="studio-root">', '<div id="studio-root">\n    <div id="jueony-title"><strong>Jueony 문서 편집기</strong><span>한글 2024 호환성 개발판</span></div>', 'titlebar');
html = replaceOnce(html, '</head>', '  <link rel="stylesheet" href="/src/jueony/editor.css" />\n</head>', 'css');
html = replaceOnce(html, '          <div class="md-item disabled" data-cmd="page:page-border"', '          <div class="md-item" data-cmd="page:delete-body-page"><span class="md-icon"></span><span class="md-label">쪽 본문 지우기 (완전 문단)</span></div>\n          <div class="md-item disabled" data-cmd="page:page-border"', 'page body deletion menu');
html = replaceOnce(html, '          <div class="md-item disabled" data-cmd="page:page-border"', '          <div class="md-item" data-cmd="page:line-number-settings"><span class="md-icon"></span><span class="md-label">줄 번호 (기본 본문·HWPX)</span></div>\n          <div class="md-item disabled" data-cmd="page:page-border"', 'line number menu');
html = replaceOnce(html, '          <div class="md-item disabled" data-cmd="page:page-border"', '          <div class="md-item" data-cmd="page:master-page"><span class="md-icon"></span><span class="md-label">바탕쪽 (기본 텍스트)</span></div>\n          <div class="md-item disabled" data-cmd="page:page-border"', 'master page menu');
await writeFile(join(root, 'editor.html'), html);
await cp(join(app, 'src/shell.html'), join(root, 'index.html'));
let settings = (await readFile(join(root, 'src/core/user-settings.ts'), 'utf8')).replace(/\r\n/g, '\n');
settings = "import { bindPreferencesPersistence } from '../jueony/preferences/binding.ts';\n" + settings;
settings = replaceOnce(settings, '  constructor() {\n    this.data = this.load();\n  }', `  private persistence: ReturnType<typeof bindPreferencesPersistence<AppSettings>>;
  constructor() {
    this.data = this.load();
    this.persistence = bindPreferencesPersistence({
      storage: { getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value) },
      key: STORAGE_KEY, supportedVersion: 1, initial: this.data, load: () => this.load(),
      replace: value => { this.data = value; }, events: window,
      onChange: update => window.dispatchEvent(new CustomEvent('jueony:preferences-changed', { detail: update })),
      onError: error => window.dispatchEvent(new CustomEvent('jueony:preferences-error', { detail: { message: error.message } })),
    });
  }
  refreshFromStorage(): void { this.persistence.refresh(); }`, 'shared preferences');
settings = replaceOnce(settings, '    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));', '    this.persistence.save(this.data);', 'merge settings save');
await writeFile(join(root, 'src/core/user-settings.ts'), settings);
let main = await readFile(join(root, 'src/main.ts'), 'utf8');
main = replaceOnce(main, 'documentState.installBeforeUnload(window);', 'if (window.parent === window) documentState.installBeforeUnload(window);', 'host owns embedded exit prompt');
main = replaceOnce(main, 'confirmSaveBeforeReplacingDocument, fileCommands', 'confirmSaveBeforeReplacingDocument, saveCurrentDocument, fileCommands', 'host save import');
main = replaceOnce(main, "return params.has('url');", "return params.has('url') || params.get('skipRecovery') === '1';", 'tab recovery');
main = "import { installHangulKeys } from './jueony/shortcuts/install';\nimport { installAgentBridge } from './jueony/mvp/editor-bridge';\nimport { installDesktopHost } from './jueony/desktop-host';\nimport { installHangulChrome } from './jueony/chrome-2024';\n" + main;
main = "import {installDocumentInformation} from './jueony/adapters/rhwp/document-info.ts';\nimport {installPageControls} from './jueony/adapters/rhwp/page-controls.ts';\nimport {readDocumentDefaults, applyNewDocumentDefaults} from './jueony/preferences/document-defaults.ts';\nimport {createDocumentViewAdapter} from './jueony/preferences/document-view.ts';\nlet jueonyDocumentView: ReturnType<typeof createDocumentViewAdapter> | undefined;\n" + main;
main = "import {captureBodyCaret, restoreBodyCaret} from './jueony/adapters/rhwp/body-caret.ts';\nlet jueonyComposing = false;\ndocument.addEventListener('compositionstart',()=>{jueonyComposing=true;},true);\ndocument.addEventListener('compositionend',()=>{jueonyComposing=false;},true);\n" + main;
main = "import {captureSessionCursor, restoreSessionCursor} from './jueony/adapters/rhwp/session-cursor.ts';\nlet jueonyCursorInteraction = 0;\ndocument.addEventListener('keydown',()=>jueonyCursorInteraction++,true);\ndocument.addEventListener('pointerdown',()=>jueonyCursorInteraction++,true);\ndocument.addEventListener('pointermove',e=>{if(e.buttons)jueonyCursorInteraction++;},true);\ndocument.addEventListener('wheel',()=>jueonyCursorInteraction++,{capture:true,passive:true});\n" + main;
main = replaceOnce(main, 'const docInfo = wasm.createNewDocument();', `const defaults = new URLSearchParams(location.search).get('skipDefaults') === '1' ? undefined : readDocumentDefaults(localStorage);
      const docInfo = wasm.createNewDocument();
      if(defaults && applyNewDocumentDefaults(wasm.borrowDocumentHandle()!, defaults)) docInfo.fontsUsed.push(defaults.font.family);`, 'new document defaults');
main = replaceOnce(main, "console.error('[main] 새 문서 생성 실패:', error);", "(window as any).__jueonyInitializationError = String(error); console.error('[main] 새 문서 생성 실패:', error);", 'new document error detail');
main = replaceOnce(main, 'userSettings.setZoomFitMode(normalizeZoomFitMode(mode));', 'if (!jueonyDocumentView?.isRestoring()) userSettings.setZoomFitMode(normalizeZoomFitMode(mode));', 'document view restore does not change default fit');
main = replaceOnce(main, "const initPromise = initialize();", `const initPromise = initialize();
installDesktopHost({ wasm, eventBus, documentState, ready: initPromise,
  save: () => saveCurrentDocument(commandServices),
  discard: async () => { await autosaveManager.discardCurrentDraft('tab-discard'); documentState.markClean('tab-discard'); },
});
installAgentBridge({ wasm, eventBus, documentState, ready: initPromise, automation, refreshMenus: async () => { recentSubmenuExpanded = true; await renderRecentSubmenu(); }, input: () => inputHandler, render: () => canvasView!.refreshDocumentAgentMutation(), load: (bytes, name, handle) => loadBytes(bytes, name, handle) });
void initPromise.then(() => { installHangulKeys({ automation, registry, input: () => inputHandler, eventBus }); installPageControls(registry, () => inputHandler); installDocumentInformation({registry, input: () => inputHandler}); installHangulChrome({ wasm, eventBus, documentState, automation }); });`, 'desktop host');
main = replaceOnce(main, 'import { initThemeSync, setThemeMode, getThemeMode, getEffectiveTheme }', 'import { applyTheme, syncThemeMenu, initThemeSync, setThemeMode, getThemeMode, getEffectiveTheme }', 'remote preference theme');
main += `
// Reuse the Studio settings owner; only reapply fields received from another tab.
let jueonyPendingView = false;
function jueonyApplyPreferences(paths: string[]) {
  syncToolboxMenu(); applyTheme(); syncThemeMenu();
  if(paths.some(path => path === 'font' || path.startsWith('font.'))) toolbar?.initFontDropdown(currentDocumentFonts);
  if (wasm.pageCount > 0) {
    applySavedTextMarkSettings();
    if (paths.some(path => path === 'view' || /view\\.(pageArrangement|pageMovement)/.test(path))) jueonyPendingView = true;
    const view = userSettings.getViewSettings();
    const container = document.getElementById('scroll-container');
    if (jueonyPendingView && container && container.clientWidth > 0) {
      jueonyPendingView = false;
      eventBus.emit('page-view-settings-changed', { arrangement: view.pageArrangement, pageMovement: view.pageMovement });
      // Existing tabs own their zoom; the stored fit rule initializes new documents only.
    }
    eventBus.emit('document-view-changed');
  }
  eventBus.emit('autosave-settings-changed'); eventBus.emit('command-state-changed');
}
window.addEventListener('jueony:preferences-changed', ((event: CustomEvent) => {
  const { changedPaths } = event.detail;
  if (changedPaths.length) void initPromise.then(() => jueonyApplyPreferences(changedPaths));
  if (window.parent !== window) window.parent.postMessage({type:'jueony:preferences-state',error:false},location.origin);
}) as EventListener);
window.addEventListener('jueony:preferences-error', ((event: CustomEvent) => {
  void initPromise.then(() => jueonyApplyPreferences(['view']));
  if (window.parent !== window) window.parent.postMessage({type:'jueony:preferences-state',error:true,message:event.detail.message},location.origin);
  else { const target=document.getElementById('sb-message'); if(target) target.textContent=event.detail.message; }
}) as EventListener);
window.addEventListener('resize', () => { if(jueonyPendingView) void initPromise.then(() => jueonyApplyPreferences([])); });
jueonyDocumentView = createDocumentViewAdapter({
  viewport: () => canvasView?.getViewportManager(), identity: () => String(wasm.documentGeneration),
  visible: () => (document.getElementById('scroll-container')?.clientWidth ?? 0) > 0,
  applyFit: mode => applySavedZoomFitMode(mode),
  settle: () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  captureCaret: () => jueonyComposing ? undefined : captureBodyCaret(inputHandler?.getSessionCaretAccess()),
  restoreCaret: caret => !jueonyComposing && restoreBodyCaret(inputHandler?.getSessionCaretAccess(), caret),
  captureCursor: () => jueonyComposing ? undefined : captureSessionCursor(inputHandler?.getSessionCaretAccess()),
  restoreCursor: cursor => !jueonyComposing && restoreSessionCursor(inputHandler?.getSessionCaretAccess(), cursor),
  cursorInteraction: () => jueonyCursorInteraction,
});
Object.assign((window as any).jueonyEditor, {captureDocumentView: () => jueonyDocumentView!.capture(),suspendDocumentView: () => jueonyDocumentView!.suspend(),restoreDocumentView: (value: unknown) => jueonyDocumentView!.restore(value)});
window.addEventListener('resize', () => { void jueonyDocumentView!.retry(); });
const jueonyRememberView = () => { if (!jueonyDocumentView!.isRestoring()) { jueonyDocumentView!.capture(); if (window.parent !== window) window.parent.postMessage({type:'jueony:status'},location.origin); } };
document.getElementById('scroll-container')?.addEventListener('scroll', jueonyRememberView, {passive:true});
eventBus.on('zoom-level-display', jueonyRememberView);
eventBus.on('cursor-rect-updated', jueonyRememberView);
eventBus.on('table-object-selection-changed', jueonyRememberView);
eventBus.on('picture-object-selection-changed', jueonyRememberView);
eventBus.on('headerFooterModeChanged', jueonyRememberView);
eventBus.on('footnoteModeChanged', jueonyRememberView);
eventBus.on('document-mutated', () => { jueonyCursorInteraction++; });
eventBus.on('command-state-changed', () => { if (window.parent !== window) window.parent.postMessage({type:'jueony:command-state'},location.origin); });
window.addEventListener('keydown', event => { if(event.key === 'F6' && event.altKey && !event.ctrlKey && !event.shiftKey && !event.isComposing && !document.querySelector('dialog[open],.modal-overlay') && window.parent !== window){event.preventDefault();event.stopImmediatePropagation();window.parent.postMessage({type:'jueony:focus-chat'},location.origin);} },true);
void initPromise.then(() => userSettings.refreshFromStorage());
`;
await writeFile(join(root, 'src/main.ts'), main);
let modal = (await readFile(join(root, 'src/ui/dialog.ts'), 'utf8')).replace(/\r\n/g, '\n');
modal = "import { handleModalKeyboard } from '../jueony/adapters/browser/modal-keyboard.ts';\n" + modal;
const captureStart = modal.indexOf('    this.captureHandler = (e: KeyboardEvent) => {');
const captureEnd = modal.indexOf("    document.addEventListener('keydown', this.captureHandler, true);", captureStart);
if(captureStart < 0 || captureEnd < 0) throw new Error('소스 패치 기준 불일치: modal keyboard');
modal = modal.slice(0,captureStart) + `    this.captureHandler = e => handleModalKeyboard(e, this.overlay, () => this.hide(), () => {
      (this.dialog.querySelector('.dialog-btn-primary') as HTMLButtonElement | null)?.click();
    });
` + modal.slice(captureEnd);
modal = replaceOnce(modal, "    this.dialog.className = 'dialog-wrap';", `    this.dialog.className = 'dialog-wrap';
    this.dialog.setAttribute('role', 'dialog');
    this.dialog.setAttribute('aria-modal', 'true');
    this.dialog.setAttribute('aria-label', this.title);
    this.overlay.tabIndex = -1;`, 'modal accessibility');
modal = replaceOnce(modal, "    closeBtn.className = 'dialog-close';", "    closeBtn.className = 'dialog-close';\n    closeBtn.setAttribute('aria-label', '닫기');", 'modal close label');
// Closing a nested dialog restores focus within its parent, not into the document.
modal = replaceOnce(modal, '    this.afterClose?.();', `    const parent = document.querySelectorAll<HTMLElement>('.modal-overlay, dialog[open]');
    parent.item(parent.length - 1)?.querySelector<HTMLElement>('input, button, select, textarea')?.focus();
    this.afterClose?.();`, 'nested modal focus');
await writeFile(join(root, 'src/ui/dialog.ts'), modal);
for (const name of ['para-shape-dialog.ts','char-shape-dialog.ts']) {
  let shape = (await readFile(join(root, 'src/ui', name), 'utf8')).replace(/\r\n/g, '\n');
  shape = "import { handleModalKeyboard } from '../jueony/adapters/browser/modal-keyboard.ts';\n" + shape;
  shape = replaceOnce(shape, `    this.overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); this.hide(); }
    });`, `    this.overlay.addEventListener('keydown', e => handleModalKeyboard(e, this.overlay, () => this.hide(), () => {
      this.dialog.querySelector<HTMLButtonElement>('.dialog-btn-primary')?.click();
    }));`, name + ' keyboard');
  shape = replaceOnce(shape, '    document.body.appendChild(this.overlay);', `    document.body.appendChild(this.overlay);
    this.dialog.setAttribute('role', 'dialog'); this.dialog.setAttribute('aria-modal', 'true');
    this.dialog.setAttribute('aria-label', this.dialog.querySelector('.dialog-title')?.textContent?.replace('×','').trim() ?? '서식');
    this.dialog.querySelector<HTMLButtonElement>('.dialog-btn-primary')?.focus();`, name + ' focus');
  await writeFile(join(root, 'src/ui', name), shape);
}
let caretInput = (await readFile(join(root, 'src/engine/input-handler.ts'), 'utf8')).replace(/\r\n/g, '\n');
let scalarCursor=(await readFile(join(root,'src/engine/cursor.ts'),'utf8')).replace(/\r\n/g,'\n');
scalarCursor=replaceOnce(scalarCursor,"this._fnCharOffset = (info.texts[this._fnInnerParaIdx] ?? '').length;","this._fnCharOffset = [...(info.texts[this._fnInnerParaIdx] ?? '')].length;",'note End scalar offset');
scalarCursor=replaceOnce(scalarCursor,'const charCount = currentText.length;','const charCount = [...currentText].length;','note Right scalar offset');
scalarCursor=replaceOnce(scalarCursor,'this._fnCharOffset = prevText.length;','this._fnCharOffset = [...prevText].length;','note previous scalar offset');
await writeFile(join(root,'src/engine/cursor.ts'),scalarCursor);
caretInput = "import { paragraphSpacingChange } from '../jueony/shortcuts/paragraph-spacing.ts';\nimport {createParagraphSpacingReader} from '../jueony/adapters/rhwp/paragraph-spacing.ts';\n" + caretInput;
caretInput = replaceOnce(caretInput, '  getCursorPosition(): DocumentPosition { return this.cursor.getPosition(); }', `  getCursorPosition(): DocumentPosition { return this.cursor.getPosition(); }

  /** Relative values per paragraph, preflighted then recorded as one atomic undo step. */
  adjustParagraphSpacing(operation: unknown): boolean {
    const block = this.getSelectedCellBlock();
    const targets = block?.cellPath?.length === 1
      ? this.getParaFormatTargetsForCellBlock({ ...block, cellPath: undefined })
      : this.getParaFormatTargetsAtCursor();
    if (!targets.length || targets.length > 5000) return false;
    const read = createParagraphSpacingReader(this.wasm);
    const changes = targets.map(target => ({ target, props: paragraphSpacingChange(read(target), operation) })).filter(change => Object.keys(change.props).length);
    if (!changes.length) return true;
    const position = this.cursor.getPosition(), cellSelection = this.cursor.captureCellSelection(), textSelection = this.cursor.getSelection();
    this.executeOperation({ kind: 'snapshot', operationType: 'paragraphSpacing',
      selectionBefore: cellSelection ? { mode: 'cellBlock', state: cellSelection }
        : textSelection && textSelection.anchor.parentParaIndex === undefined
          ? { start: textSelection.anchor, end: textSelection.focus, blockPhase: this.cursor.blockSelectionPhase() } : null,
      operation: wasm => {
        wasm.runInBatch(() => {
          for (const { target, props } of changes) {
            const json = JSON.stringify(props);
            if (target.kind === 'body') wasm.applyParaFormat(target.sec, target.para, json);
            else wasm.applyParaFormatInCell(target.sec, target.parentPara, target.controlIdx, target.cellIdx, target.cellParaIdx, json);
          }
        });
        return position;
      },
    });
    return true;
  }

  /** Session view restoration only; no document mutation or keyboard focus transfer. */
  getSessionCaretAccess() {
    return { cursor: this.cursor, wasm: this.wasm,
      getCursorPosition: () => this.cursor.getPosition(),
      restoreSessionHeaderFooter: (saved: import('../jueony/modules/preferences/public/index.ts').HeaderFooterBookmark) => {
        this.cursor.exitHeaderFooterMode();this.cursor.exitFootnoteMode();this.cursor.clearSelection();this.cursor.exitCellSelectionMode();this.cursor.exitTableObjectSelection();this.cursor.exitPictureObjectSelection();
        this.cursor.moveTo({sectionIndex:saved.focus.caret.section,paragraphIndex:saved.focus.caret.paragraph,charOffset:saved.focus.caret.offset});
        this.cursor.enterHeaderFooterMode(saved.isHeader,saved.caret.section,saved.applyTo);
        if(saved.anchor){
          const point=(value:typeof saved.caret)=>({sectionIdx:value.section,isHeader:saved.isHeader,applyTo:saved.applyTo,paraIdx:value.paragraph,charOffset:value.offset});
          if(!this.cursor.selectHeaderFooterRange(point(saved.anchor),point(saved.caret),this.cursor.hfPreviewPage))return false;
        }else this.cursor.setHfCursorPosition(saved.caret.paragraph,saved.caret.offset);
        this.updateCaret();this.eventBus.emit('headerFooterModeChanged',{mode:saved.isHeader?'header':'footer',sectionIdx:saved.caret.section,applyTo:saved.applyTo,previewPage:this.cursor.hfPreviewPage});this.eventBus.emit('command-state-changed');return true;
      },
      restoreSessionFootnote: (saved: import('../jueony/modules/preferences/public/index.ts').FootnoteBookmark) => {
        this.cursor.exitHeaderFooterMode();this.cursor.exitFootnoteMode();this.cursor.clearSelection();this.cursor.exitCellSelectionMode();this.cursor.exitTableObjectSelection();this.cursor.exitPictureObjectSelection();
        this.cursor.moveTo({sectionIndex:saved.focus.caret.section,paragraphIndex:saved.focus.caret.paragraph,charOffset:saved.focus.caret.offset});
        this.cursor.enterFootnoteMode(saved.caret.section,saved.parentParagraph,saved.control,saved.index,saved.page);
        if(saved.anchor){this.cursor.setFnCursorPosition(saved.anchor.paragraph,saved.anchor.offset);this.cursor.setFnAnchor();}
        this.cursor.setFnCursorPosition(saved.caret.paragraph,saved.caret.offset);
        this.updateCaret();this.eventBus.emit('footnoteModeChanged',true);this.eventBus.emit('command-state-changed');return true;
      },
      restoreSessionPictureObject: (ref: {sec:number;ppi:number;ci:number;type:'image'}) => {
        this.cursor.clearSelection();this.cursor.exitCellSelectionMode();this.cursor.exitTableObjectSelection();
        this.cursor.moveTo({sectionIndex:ref.sec,paragraphIndex:ref.ppi,charOffset:0});
        this.cursor.enterPictureObjectSelectionDirect(ref.sec,ref.ppi,ref.ci,'image');
        this.updateCaret();this.eventBus.emit('picture-object-selection-changed',true);this.eventBus.emit('command-state-changed');return true;
      },
      restoreSessionTableObject: (ref: {sec:number;ppi:number;ci:number}) => {
        this.cursor.clearSelection(); this.cursor.exitCellSelectionMode();
        this.cursor.moveTo({sectionIndex:ref.sec,paragraphIndex:ref.ppi,charOffset:0});
        this.cursor.enterTableObjectSelectionDirect(ref.sec,ref.ppi,ref.ci);
        this.updateCaret(); this.eventBus.emit('table-object-selection-changed',true);
        return true;
      },
      restoreSessionCaret: (position: DocumentPosition) => {
        this.cursor.moveTo(position);
        this.cursor.resetPreferredX();
        this.updateCaret();
      },
      restoreSessionSelection: (focus: DocumentPosition, anchor: DocumentPosition | undefined, phase: number | null, block: import('./cursor').CellBlockSelectionState | undefined): boolean => {
        if (block && !this.cursor.restoreCellSelection(block)) return false;
        if (!block) this.cursor.exitCellSelectionMode();
        this.cursor.clearSelection();
        if (anchor && anchor.parentParaIndex === undefined) {
          if (!this.cursor.selectRange(anchor, focus, phase)) return false;
        } else {
          this.cursor.exitBlockSelectionMode();
          if (anchor) { this.cursor.moveTo(anchor); this.cursor.setAnchor(); }
          this.cursor.moveTo(focus);
        }
        this.cursor.resetPreferredX();
        this.updateCaret();
        this.eventBus.emit('command-state-changed');
        return true;
      },
    };
  }`, 'session caret input boundary');
await writeFile(join(root, 'src/engine/input-handler.ts'), caretInput);
let formatCommands = (await readFile(join(root, 'src/command/commands/format.ts'), 'utf8')).replace(/\r\n/g, '\n');
formatCommands = replaceOnce(formatCommands, '      if (!savedSel) return;', '      // A caret-only character dialog applies pending typing properties.', 'caret character dialog');
formatCommands = replaceOnce(formatCommands, '        ih.applyCharPropsToRange(savedSel.start, savedSel.end, mods);', '        if (savedSel) ih.applyCharPropsToRange(savedSel.start, savedSel.end, mods);\n        else services.eventBus.emit(\'format-char\', mods);', 'caret character format');
await writeFile(join(root, 'src/command/commands/format.ts'), formatCommands);
let tableCommands = await readFile(join(root, 'src/command/commands/table.ts'), 'utf8');
tableCommands = replaceOnce(tableCommands, 'dialog.show(params?.anchorEl as HTMLElement | undefined);', 'if (params?.inputDialog) dialog.showInputDialog(); else dialog.show(params?.anchorEl as HTMLElement | undefined);', 'keyboard table dialog');
await writeFile(join(root, 'src/command/commands/table.ts'), tableCommands);
let tableCreate = await readFile(join(root, 'src/ui/table-create-dialog.ts'), 'utf8');
tableCreate = replaceOnce(tableCreate, 'private showInputDialog(): void', 'showInputDialog(): void', 'table input dialog entry');
await writeFile(join(root, 'src/ui/table-create-dialog.ts'), tableCreate);
let documentTitle = await readFile(join(root, 'src/ui/document-title.ts'), 'utf8');
documentTitle = documentTitle.replaceAll('rhwp-studio', 'Jueony 문서 편집기');
await writeFile(join(root, 'src/ui/document-title.ts'), documentTitle);

// 저장할 Blob에 문서 버전을 연결해 저장 중 발생한 새 편집을 clean 처리하지 않는다.
let fileCommands = (await readFile(join(root, 'src/command/commands/file.ts'), 'utf8')).replace(/\r\n/g, '\n');
fileCommands = "import { confirmDownload } from '../../jueony/download-save';\n" + fileCommands;
fileCommands = "import { verifyPreservedExport } from '../../jueony/adapters/rhwp/preservation.ts';\n" + fileCommands;
fileCommands = replaceOnce(fileCommands,'  return {\n    blob: new Blob([artifact.bytes as unknown as BlobPart], {',`  const {HwpDocument} = services.wasm.getWasmModuleExports() as typeof import('@wasm/rhwp.js');
  if(format !== 'hml') verifyPreservedExport(services.wasm, artifact.bytes, format, artifact.contentLoss,
    bytes => password === undefined ? new HwpDocument(bytes) : HwpDocument.openWithPassword(bytes,password));
  return {
    blob: new Blob([artifact.bytes as unknown as BlobPart], {`, 'explicit save preservation');
fileCommands = replaceOnce(fileCommands,
  'blob: new Blob([artifact.bytes as unknown as BlobPart], {\n      type: SAVE_FORMAT_DETAILS[format].mimeType,\n    }),',
  `blob: Object.assign(new Blob([artifact.bytes as unknown as BlobPart], {
      type: SAVE_FORMAT_DETAILS[format].mimeType,
    }), { jueonyRevision: (window as any).jueonyEditor?.revision() }),`, 'save revision');
fileCommands = replaceOnce(fileCommands,
  "console.warn('[file:save] File System Access API 실패, 폴백:', error);\n    return { method: 'fallback', handle: null, fileName: suggestedName };",
  "console.error('[file:save]', error);\n    alert('저장하지 못했습니다. 문서는 수정 상태로 유지됩니다.\\n' + String(error));\n    return 'cancelled';", 'save failure');
fileCommands = replaceOnce(fileCommands,
  'const downloadName = await promptFallbackName(saveName, format);',
  'const downloadName = saveName;', 'single save-as dialog');
fileCommands = replaceOnce(fileCommands,
  'if (!downloadName) return;\n    persistDownloadWithContentLoss(',
  'if (!downloadName) return;\n    if (!await confirmDownload(payload.blob, downloadName)) return;\n    persistDownloadWithContentLoss(', 'confirm save-as download');
fileCommands = replaceOnce(fileCommands,
  "if (!downloadName) return 'cancelled';\n    persistDownloadWithContentLoss(",
  "if (!downloadName) return 'cancelled';\n    if (!await confirmDownload(payload.blob, downloadName)) return 'cancelled';\n    persistDownloadWithContentLoss(", 'confirm save download');
fileCommands = fileCommands.replaceAll('() => downloadBlob(payload.blob, downloadName)', '() => {}');
fileCommands = replaceOnce(fileCommands,
  "services.eventBus.emit('create-new-document');",
  `if (new URLSearchParams(location.search).get('child') === '1' && window.parent !== window) {
        window.parent.postMessage({ type: 'jueony:new-document' }, location.origin);
        // 이름 변경 전에 열린 부모 창의 탭 생성도 지원한다.
        window.parent.postMessage({ type: 'joouni:new-document' }, location.origin);
      } else services.eventBus.emit('create-new-document');`, 'new document tab');
await writeFile(join(root, 'src/command/commands/file.ts'), fileCommands);
let fileSystem = (await readFile(join(root, 'src/command/file-system-access.ts'), 'utf8')).replace(/\r\n/g, '\n');
fileSystem = "import { writeSnapshot, rememberFileSnapshot } from '../jueony/save-guard';\n" + fileSystem;
fileSystem = replaceOnce(fileSystem,
  'const file = await handle.getFile();\n  return {\n    name: file.name,\n    bytes: new Uint8Array(await file.arrayBuffer()),',
  'const file = await handle.getFile();\n  const bytes = new Uint8Array(await file.arrayBuffer());\n  await rememberFileSnapshot(handle, bytes);\n  return {\n    name: file.name,\n    bytes,', 'source file fingerprint');
fileSystem = replaceOnce(fileSystem,
  'const writable = await handle.createWritable();\n  await writable.write(blob);\n  await writable.close();',
  'await writeSnapshot(handle, blob);', 'save transaction guard');
await writeFile(join(root, 'src/command/file-system-access.ts'), fileSystem);

}
