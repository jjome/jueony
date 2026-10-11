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
main = replaceOnce(main, 'confirmSaveBeforeReplacingDocument, fileCommands', 'confirmSaveBeforeReplacingDocument, saveCurrentDocument, fileCommands', 'host save import');
main = replaceOnce(main, "return params.has('url');", "return params.has('url') || params.get('skipRecovery') === '1';", 'tab recovery');
main = "import { installHangulKeys } from './jueony/shortcuts/install';\nimport { installAgentBridge } from './jueony/mvp/editor-bridge';\nimport { installDesktopHost } from './jueony/desktop-host';\nimport { installHangulChrome } from './jueony/chrome-2024';\n" + main;
main = "import {installDocumentInformation} from './jueony/adapters/rhwp/document-info.ts';\nimport {installPageControls} from './jueony/adapters/rhwp/page-controls.ts';\nimport {readDocumentDefaults, applyNewDocumentDefaults} from './jueony/preferences/document-defaults.ts';\nimport {createDocumentViewAdapter} from './jueony/preferences/document-view.ts';\nlet jueonyDocumentView: ReturnType<typeof createDocumentViewAdapter> | undefined;\n" + main;
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
});
Object.assign((window as any).jueonyEditor, {captureDocumentView: () => jueonyDocumentView!.capture(),suspendDocumentView: () => jueonyDocumentView!.suspend(),restoreDocumentView: (value: unknown) => jueonyDocumentView!.restore(value)});
window.addEventListener('resize', () => { void jueonyDocumentView!.retry(); });
const jueonyRememberView = () => { if (!jueonyDocumentView!.isRestoring()) { jueonyDocumentView!.capture(); if (window.parent !== window) window.parent.postMessage({type:'jueony:status'},location.origin); } };
document.getElementById('scroll-container')?.addEventListener('scroll', jueonyRememberView, {passive:true});
eventBus.on('zoom-level-display', jueonyRememberView);
eventBus.on('command-state-changed', () => { if (window.parent !== window) window.parent.postMessage({type:'jueony:command-state'},location.origin); });
window.addEventListener('keydown', event => { if(event.key === 'F6' && event.altKey && !event.ctrlKey && !event.shiftKey && !event.isComposing && !document.querySelector('dialog[open],.modal-overlay') && window.parent !== window){event.preventDefault();event.stopImmediatePropagation();window.parent.postMessage({type:'jueony:focus-chat'},location.origin);} },true);
void initPromise.then(() => userSettings.refreshFromStorage());
`;
await writeFile(join(root, 'src/main.ts'), main);
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
