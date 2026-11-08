import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

function replaceOnce(source, before, after, label) {
  if (source.split(before).length !== 2) throw new Error(`쪽 윤곽 통합 기준 불일치: ${label}`);
  return source.replace(before, after);
}

/** Run against the generated Studio copy. The pinned upstream tree stays clean. */
export async function applyPageOutlinePatches({ root }) {
  const edit = async (file, transform) => {
    const path = join(root, 'src', file);
    const source = (await readFile(path, 'utf8')).replace(/\r\n/g, '\n');
    await writeFile(path, transform(source));
  };

  await edit('view/page-gap.ts', source => replaceOnce(source,
    `  gapAt100Percent = DEFAULT_PAGE_GAP_AT_100_PERCENT,\n): number {\n  const safeZoom`,
    `  gapAt100Percent = DEFAULT_PAGE_GAP_AT_100_PERCENT,\n  pageOutline = true,\n): number {\n  if (!pageOutline) return 0;\n  const safeZoom`,
    'page gap display flag'));

  await edit('view/virtual-scroll.ts', source => {
    source = replaceOnce(source,
      `  private readonly pageGapAt100Percent: number;\n  private pageGap: number;`,
      `  private readonly pageGapAt100Percent: number;\n  private pageGap: number;\n  private pageOutlineVisible = true;`,
      'virtual scroll outline state');
    source = replaceOnce(source,
      `    this.pageGap = resolvePageGap(1, pageGapAt100Percent);`,
      `    this.pageGap = resolvePageGap(1, pageGapAt100Percent, this.pageOutlineVisible);`,
      'initial page gap');
    source = replaceOnce(source,
      `    this.pageGap = resolvePageGap(zoom, this.pageGapAt100Percent);`,
      `    this.pageGap = resolvePageGap(zoom, this.pageGapAt100Percent, this.pageOutlineVisible);`,
      'layout page gap');
    return replaceOnce(source,
      `  /** 문서 교체 시 이전 문서의 자동 열 commit이 새 문서 경계 판단에 섞이지 않게 한다. */\n  resetAutoColumnCommit(): void {`,
      `  /** 보기 전용 윤곽 상태. 다음 recalcLayout에서 geometry와 CSS가 함께 commit된다. */\n  setPageOutlineVisible(value: boolean): boolean {\n    const next = value !== false;\n    if (next === this.pageOutlineVisible) return false;\n    this.pageOutlineVisible = next;\n    return true;\n  }\n\n  isPageOutlineVisible(): boolean {\n    return this.pageOutlineVisible;\n  }\n\n  /** 문서 교체 시 이전 문서의 자동 열 commit이 새 문서 경계 판단에 섞이지 않게 한다. */\n  resetAutoColumnCommit(): void {`,
      'virtual scroll outline setter');
  });

  await edit('view/page-view-settings-change.ts', source => {
    source = replaceOnce(source,
      `  pageMovement?: unknown;\n  zoom?: Partial<PageViewZoomCommit> | null;`,
      `  pageMovement?: unknown;\n  pageOutline?: unknown;\n  zoom?: Partial<PageViewZoomCommit> | null;`,
      'page view payload');
    source = replaceOnce(source,
      `  pageMovement: PageMovementSettings;\n  zoom: PageViewZoomCommit | null;`,
      `  pageMovement: PageMovementSettings;\n  pageOutline: boolean | null;\n  zoom: PageViewZoomCommit | null;`,
      'resolved page view payload');
    return replaceOnce(source,
      `    pageMovement: pageView.movement,\n    zoom,`,
      `    pageMovement: pageView.movement,\n    pageOutline: typeof value.pageOutline === 'boolean' ? value.pageOutline : null,\n    zoom,`,
      'resolve page outline');
  });

  await edit('view/canvas-view.ts', source => {
    source = replaceOnce(source,
      `  private pageArrangement: PageArrangement;\n  private pageMovement: PageMovementSettings;`,
      `  private pageArrangement: PageArrangement;\n  private pageMovement: PageMovementSettings;\n  private pageOutlineVisible: boolean;`,
      'canvas outline state');
    source = replaceOnce(source,
      `    this.pageArrangement = pageView.arrangement;\n    this.pageMovement = pageView.movement;\n    this.viewportManager.setPageMovement(this.pageMovement);\n\n    this.scrollContent = container.querySelector('#scroll-content')!;`,
      `    this.pageArrangement = pageView.arrangement;\n    this.pageMovement = pageView.movement;\n    this.pageOutlineVisible = viewSettings.pageOutline !== false;\n    this.virtualScroll.setPageOutlineVisible(this.pageOutlineVisible);\n    this.viewportManager.setPageMovement(this.pageMovement);\n\n    this.scrollContent = container.querySelector('#scroll-content')!;\n    this.scrollContent.classList.toggle('page-outline-hidden', !this.pageOutlineVisible);`,
      'canvas initial outline');
    source = replaceOnce(source,
      `    const viewChanged = !pageArrangementsEqual(this.pageArrangement, next.arrangement)\n      || !movementUnchanged;\n    if (!viewChanged && !next.zoom) return false;\n    const zoomInterrupted`,
      `    const viewChanged = !pageArrangementsEqual(this.pageArrangement, next.arrangement)\n      || !movementUnchanged;\n    const outlineChanged = next.pageOutline !== null && next.pageOutline !== this.pageOutlineVisible;\n    if (!viewChanged && !outlineChanged && !next.zoom) return false;\n    if (outlineChanged) {\n      this.pageOutlineVisible = next.pageOutline!;\n      this.virtualScroll.setPageOutlineVisible(this.pageOutlineVisible);\n      this.scrollContent.classList.toggle('page-outline-hidden', !this.pageOutlineVisible);\n    }\n    const zoomInterrupted`,
      'canvas outline transaction');
    return replaceOnce(source,
      `    const layoutChanged = viewChanged || zoomChanged || zoomInterrupted;`,
      `    const layoutChanged = viewChanged || outlineChanged || zoomChanged || zoomInterrupted;`,
      'outline relayout');
  });

  await edit('core/user-settings.ts', source => {
    source = `import { normalizePageOutlineView } from '../jueony/adapters/browser/page-outline-view-state.ts';\n` + source;
    source = replaceOnce(source,
      `  /** 배율과 독립적으로 유지하는 페이지 화면 배치 */\n  pageArrangement: PageArrangement;`,
      `  /** 쪽 사이 화면 여백과 종이 윤곽 표시 여부. 문서 파일에는 저장하지 않는다. */\n  pageOutline: boolean;\n  /** 배율과 독립적으로 유지하는 페이지 화면 배치 */\n  pageArrangement: PageArrangement;`,
      'settings outline field');
    source = replaceOnce(source,
      `      toolbarFormat: true,\n      pageArrangement: { kind: 'single' },`,
      `      toolbarFormat: true,\n      pageOutline: true,\n      pageArrangement: { kind: 'single' },`,
      'settings outline default');
    source = replaceOnce(source,
      `          toolbarFormat: normalizeBoolean(\n            view.toolbarFormat,\n            defaults.view.toolbarFormat,\n          ),\n          pageArrangement: pageView.arrangement,`,
      `          toolbarFormat: normalizeBoolean(\n            view.toolbarFormat,\n            defaults.view.toolbarFormat,\n          ),\n          pageOutline: normalizePageOutlineView(view.pageOutline, defaults.view.pageOutline),\n          pageArrangement: pageView.arrangement,`,
      'settings outline migration');
    return replaceOnce(source,
      `  /** 페이지 화면 배치 설정 */\n  setPageArrangement(value: PageArrangement): void {`,
      `  /** 쪽 사이 여백과 종이 윤곽 표시 설정. 문서 revision과 저장 데이터에는 관여하지 않는다. */\n  setPageOutline(value: boolean): void {\n    const next = normalizePageOutlineView(value);\n    if (this.data.view.pageOutline === next) return;\n    this.data.view.pageOutline = next;\n    this.save();\n  }\n\n  /** 페이지 화면 배치 설정 */\n  setPageArrangement(value: PageArrangement): void {`,
      'settings outline setter');
  });

  await edit('command/commands/view.ts', source => {
    source = `import { togglePageOutlineView } from '../../jueony/adapters/browser/page-outline-view-state.ts';\n` + source;
    source = replaceOnce(source,
      `    pageGap: PAGE_GAP,`,
      `    pageGap: userSettings.getViewSettings().pageOutline ? PAGE_GAP : 0,`,
      'fit metrics outline gap');
    source = replaceOnce(source,
      `export function syncTextMarkMenu(showControlCodes: boolean, showParagraphMarks: boolean): void {`,
      `export function syncPageOutlineMenu(visible: boolean): void {\n  document.querySelectorAll('[data-cmd="view:page-outline"]').forEach(el => {\n    el.classList.toggle('active', visible);\n    el.setAttribute('aria-checked', String(visible));\n  });\n  const status = document.getElementById('sb-page-outline');\n  status?.classList.toggle('active', visible);\n  status?.setAttribute('aria-pressed', String(visible));\n}\n\nexport function syncTextMarkMenu(showControlCodes: boolean, showParagraphMarks: boolean): void {`,
      'outline menu sync');
    return replaceOnce(source,
      `  // ─── 보기 메뉴: 표시/숨기기 ─────────────────────────\n  {\n    id: 'view:form-mode',`,
      `  // ─── 보기 메뉴: 표시/숨기기 ─────────────────────────\n  {\n    id: 'view:page-outline',\n    label: '쪽 윤곽',\n    canExecute: (ctx) => ctx.hasDocument,\n    execute(services) {\n      const next = togglePageOutlineView({\n        read: () => userSettings.getViewSettings().pageOutline,\n        write: value => userSettings.setPageOutline(value),\n        publish: change => services.eventBus.emit('page-view-settings-changed', change),\n      });\n      syncPageOutlineMenu(next);\n      services.eventBus.emit('command-state-changed');\n    },\n  },\n  {\n    id: 'view:form-mode',`,
      'outline command');
  });

  await edit('main.ts', source => {
    source = replaceOnce(source,
      `import { syncClipMenu, syncTextMarkMenu, syncToolboxMenu, viewCommands } from '@/command/commands/view';`,
      `import { syncClipMenu, syncPageOutlineMenu, syncTextMarkMenu, syncToolboxMenu, viewCommands } from '@/command/commands/view';`,
      'main outline sync import');
    source = replaceOnce(source,
      `  document.getElementById('sb-zoom-fit-width')!.addEventListener('click', () => {`,
      `  document.getElementById('sb-page-outline')!.addEventListener('click', () => {\n    dispatcher.dispatch('view:page-outline');\n  });\n  document.getElementById('sb-zoom-fit-width')!.addEventListener('click', () => {`,
      'status outline button');
    return replaceOnce(source,
      `  syncTextMarkMenu(view.showControlCodes, view.showParagraphMarks);`,
      `  syncPageOutlineMenu(view.pageOutline);\n  syncTextMarkMenu(view.showControlCodes, view.showParagraphMarks);`,
      'initial outline sync');
  });

  const htmlPath = join(root, 'editor.html');
  let html = (await readFile(htmlPath, 'utf8')).replace(/\r\n/g, '\n');
  html = replaceOnce(html,
    `          <div class="md-item" data-cmd="view:ctrl-mark">`,
    `          <div class="md-item active" role="menuitemcheckbox" aria-checked="true" data-cmd="view:page-outline"><span class="md-icon"></span><span class="md-label">쪽 윤곽</span></div>\n          <div class="md-item" data-cmd="view:ctrl-mark">`,
    'outline menu item');
  html = replaceOnce(html,
    `        <button id="sb-zoom-fit-width"`,
    `        <button id="sb-page-outline" class="stb-icon-btn active" type="button" title="쪽 윤곽" aria-label="쪽 윤곽" aria-pressed="true">▣</button>\n        <button id="sb-zoom-fit-width"`,
    'outline status button');
  await writeFile(htmlPath, html);

  const cssPath = join(root, 'src/styles/editor.css');
  let css = (await readFile(cssPath, 'utf8')).replace(/\r\n/g, '\n');
  css = replaceOnce(css,
    `#scroll-content canvas.document-page-canvas,\n#scroll-content .page-placeholder {\n  box-shadow:\n    0 0 0 1px var(--ui-border-strong),\n    0 1px 4px var(--overlay-bg);\n}`,
    `#scroll-content canvas.document-page-canvas,\n#scroll-content .page-placeholder {\n  box-shadow:\n    0 0 0 1px var(--ui-border-strong),\n    0 1px 4px var(--overlay-bg);\n}\n\n#scroll-content.page-outline-hidden canvas.document-page-canvas,\n#scroll-content.page-outline-hidden .page-placeholder {\n  box-shadow: none;\n}`,
    'outline CSS');
  await writeFile(cssPath, css);
}
