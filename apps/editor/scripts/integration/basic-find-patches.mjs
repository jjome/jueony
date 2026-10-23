import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
function once(source, before, after, label) {
  if (source.split(before).length !== 2) throw new Error('Basic find integration drift: ' + label);
  return source.replace(before, after);
}
function method(source, start, end, body) {
  const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  if (a < 0 || b < 0 || source.indexOf(start, a + start.length) >= 0) throw new Error('Basic find method boundary: ' + start);
  return source.slice(0, a) + body + '\n\n' + source.slice(b);
}
/** Generated Studio only. Uses the existing Rust search/model and snapshot router. */
export async function applyBasicFindPatches({ root }) {
  const path = join(root, 'src/ui/find-dialog.ts');
  let source = (await readFile(path, 'utf8')).replace(/\r\n/g, '\n');
  source = once(source, "import type { SearchResult, ReplaceResult, ReplaceAllResult } from '@/core/types';", "import type { SearchResult } from '@/core/types';", 'search result type');
  source = "import { findFromInput, navigateFindHit, readFindHits, replaceFindHit, replaceAllFindHits } from '../jueony/editor-actions/basic-find.ts';\n" + source;
  source = method(source, 'export function navigateToSearchHit(', '/**\n * 찾기/찾아바꾸기 모달리스', `export function navigateToSearchHit(ih: ReturnType<CommandServices['getInputHandler']>, hit: SearchResult): void {
  navigateFindHit(ih, { ...hit, totalMatchCount: hit.totalMatchCount ?? 0 });
}`);
  source = once(source, '  private documentMutationOff: (() => void) | null = null;', '  private documentMutationOff: (() => void) | null = null;\n  private documentSwapOff: (() => void) | null = null;\n  private replaceComposing = false;', 'document scope');
  source = once(source, "    this.historyJumpOff = this.services.eventBus.on('history-jumped', () => {", "    this.documentSwapOff = this.services.eventBus.on('document-swapped', () => this.hide());\n    this.historyJumpOff = this.services.eventBus.on('history-jumped', () => {", 'document swap');
  source = once(source, '    this.documentMutationOff = null;\n    this.wrap?.remove();', '    this.documentMutationOff = null;\n    this.documentSwapOff?.(); this.documentSwapOff = null;\n    this.replaceComposing = false;\n    this.wrap?.remove();', 'unsubscribe');
  source = once(source, "    this.replaceInput.type = 'text';", "    this.replaceInput.type = 'text';\n    this.replaceInput.addEventListener('compositionstart', () => { this.replaceComposing = true; });\n    this.replaceInput.addEventListener('compositionend', () => { this.replaceComposing = false; });", 'replacement composition');
  source = once(source, '      if (this.isFindEnter(e)) {', '      if (isInDialog && this.isFindEnter(e)) {', 'editor Enter remains editing');
  source = method(source, '  private doSearch(forward: boolean): void {', '  /** 편집 후 count만', `  private doSearch(forward: boolean): void {
    if (this.queryComposing) { this.pendingSearchDirection = forward; return; }
    const query = this.queryInput.value;
    if (!query) { this.currentHit = null; this.searchedQuery = null; this.clearMatchCount(); this.statusLabel.textContent = ''; return; }
    FindDialog.lastQuery = query; FindDialog.lastCaseSensitive = this.caseSensitiveCheck.checked; this.searchedQuery = query;
    const ih = this.services.getInputHandler(); if (!ih) return;
    try {
      const hadHit = Boolean(this.currentHit?.found), result = findFromInput(ih, query, this.caseSensitiveCheck.checked, forward);
      this.currentHit = result.found ? result : null;
      this.showMatchCount(result.totalMatchCount);
      if (result.found) this.navigateToHit(result);
      this.statusLabel.dataset.state = result.wrapped && hadHit ? 'wrapped' : '';
      this.statusLabel.textContent = !result.found ? t('dialog.find.statusLabel.text.x88cec1') : result.wrapped && hadHit ? (forward ? t('dialog.find.statusLabel.text') : t('dialog.find.statusLabel.text.x2dd4d3')) : '';
    } catch (error) { this.currentHit = null; this.statusLabel.textContent = String(error); }
  }`);
  source = method(source, '  private refreshMatchCount(): void {', '  private showMatchCount', `  private refreshMatchCount(): void {
    if (!this.queryInput.value) { this.clearMatchCount(); return; }
    try { this.showMatchCount(readFindHits(this.services.wasm, this.queryInput.value, this.caseSensitiveCheck.checked).length); }
    catch { this.clearMatchCount(); }
  }`);
  source = method(source, '  private doReplace(): void {', '  private makeDraggable', `  private canReplace(): boolean {
    const context = this.services.getContext(), ih = this.services.getInputHandler();
    if (!ih || !context.isEditable || context.isFormMode || (ih as any).isComposing || (ih as any).cursor.isInHeaderFooter() || (ih as any).cursor.isInFootnote() || (ih as any).cursor.isInTextBox() || this.queryComposing || this.replaceComposing || (window as any).jueonyEditor?.busy()) {
      this.statusLabel.textContent = '현재 편집 상태에서는 바꾸기를 실행할 수 없습니다.'; return false;
    }
    return true;
  }

  private doReplace(): void {
    if (!this.canReplace()) return;
    if (!this.currentHit?.found || this.searchedQuery !== this.queryInput.value) { this.doSearch(true); return; }
    const hit = this.currentHit, ih = this.services.getInputHandler()!, query = this.queryInput.value;
    try {
      let changed = false;
      ih.executeOperation({ kind: 'snapshot', operationType: 'replaceText', operation: wasm => { const next = replaceFindHit(wasm, hit as any, query, this.caseSensitiveCheck.checked, this.replaceInput.value); changed = next !== null; return next; } });
      if (changed) (ih as any).cursor.clearSelection();
      this.currentHit = null; this.doSearch(true);
    } catch (error) { this.currentHit = null; this.statusLabel.textContent = String(error); }
  }

  private doReplaceAll(): void {
    if (!this.canReplace() || !this.queryInput.value) return;
    const ih = this.services.getInputHandler()!, query = this.queryInput.value;
    try {
      let count = 0;
      ih.executeOperation({ kind: 'snapshot', operationType: 'replaceAll', operation: wasm => {
        count = replaceAllFindHits(wasm, query, this.caseSensitiveCheck.checked, this.replaceInput.value);
        return count ? { sectionIndex: 0, paragraphIndex: 0, charOffset: 0 } : null;
      } });
      this.currentHit = null; this.refreshMatchCount();
      this.statusLabel.textContent = t('dialog.find.statusLabel.text.xf6f3e3', { p1: count });
    } catch (error) { this.currentHit = null; this.statusLabel.textContent = String(error); }
  }`);
  source = once(source, '    body.appendChild(statusRow);', "    body.appendChild(statusRow);\n    const scope = document.createElement('small'); scope.textContent = '본문·표·중첩 표의 일반 텍스트를 검색합니다. 글상자·수식·머리말·주석은 제외합니다. 필드·개체 포함 문단과 보호 셀은 바꾸지 않습니다. 모두 바꾸기는 1,000개까지입니다.'; body.appendChild(scope);", 'accurate scope');
  await writeFile(path, source);
  const editPath = join(root, 'src/command/commands/edit.ts');
  let commands = (await readFile(editPath, 'utf8')).replace(/\r\n/g, '\n');
  commands = "import { findFromInput } from '@/jueony/editor-actions/basic-find.ts';\n" + commands;
  const start = commands.indexOf('        const pos = ih.getCursorPosition();', commands.indexOf("    id: 'edit:find-again',"));
  const end = commands.indexOf('        // 이동 규칙도 대화상자와 공유한다', start);
  if (start < 0 || end < 0) throw new Error('Basic find-again boundary');
  commands = commands.slice(0, start) + '        const result = findFromInput(ih, FindDialog.lastQuery, FindDialog.lastCaseSensitive, true);\n' + commands.slice(end);
  await writeFile(editPath, commands);
}
