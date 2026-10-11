import { hitPosition, nextHitIndex, searchExcerpt } from './search-model.ts';
import type { TextHit } from './search-model.ts';

/** One docked pane per editor. Search reads the open WASM document, including unsaved
 * text. Query/results are memory-only and cleared when the document is swapped. */
export function installNavigationPane(registry: any, input: () => any, eventBus: any) {
  let pane: HTMLElement | null = null, query: HTMLInputElement, caseSensitive: HTMLInputElement;
  let list: HTMLElement, status: HTMLElement, previous: HTMLButtonElement, next: HTMLButtonElement;
  let hits: TextHit[] = [], active = -1, generation = 0, composing = false, searched = '';
  let timer: ReturnType<typeof setTimeout> | undefined;
  const button = (label: string, click: () => void) => {
    const el = document.createElement('button'); el.type = 'button'; el.textContent = label; el.onclick = click; return el;
  };
  const clear = (message = '') => {
    generation++; hits = []; active = -1; searched = ''; clearTimeout(timer);
    list?.replaceChildren(); if (status) status.textContent = message;
    if (previous) previous.disabled = next.disabled = true;
  };
  const close = () => { clear(); pane?.remove(); pane = null; delete document.documentElement.dataset.navigationPane; window.dispatchEvent(new Event('resize')); input()?.focus(); };
  const navigate = (index: number, expectedGeneration = generation) => {
    if (expectedGeneration !== generation || !pane || (window as any).jueonyEditor?.busy()) return;
    if (query.value !== searched) { search(); return; }
    const hit = hits[index], pos = hit && hitPosition(hit), ih = input();
    if (!pos || !ih) return;
    try {
      ih.flushDeferredPaginationIfNeeded('navigation-search');
      ih.cursor.exitCellSelectionMode(); ih.cursor.clearSelection();
      ih.cursor.moveTo(pos); ih.cursor.setAnchor(); ih.cursor.moveTo({ ...pos, charOffset: pos.charOffset + hit.length });
      ih.updateCaret(); active = index; render();
    } catch { clear('문서 위치가 변경되었습니다. 다시 검색해 주세요.'); }
  };
  const render = () => {
    list.replaceChildren(); previous.disabled = next.disabled = hits.length === 0;
    const start = Math.max(0, active - 99), end = Math.min(hits.length, start + 200), captured = generation;
    // Bound DOM size while every hit remains reachable through previous/next.
    for (let i = start; i < end; i++) {
      const hit = hits[i], row = button('', () => navigate(i, captured)); row.className = 'j-search-hit'; row.dataset.hitIndex = String(i);
      row.setAttribute('aria-current', String(i === active));
      const where = document.createElement('small'); where.textContent = `${i + 1}. 구역 ${hit.sec + 1} · ${hit.cellContext ? '표 셀' : '본문'} · 문단 ${hit.para + 1}`;
      const excerpt = document.createElement('span');
      try { excerpt.textContent = searchExcerpt(input().wasm, hit); } catch { excerpt.textContent = searched; }
      row.append(where, excerpt); list.append(row);
    }
    if (hits.length > 200) { const more = document.createElement('small'); more.textContent = `${start + 1}–${end}개 표시 · 이전/다음으로 모든 결과를 탐색합니다.`; list.append(more); }
    status.textContent = `${hits.length}개 결과${active >= 0 ? ` · ${active + 1}번째` : ''}`;
    list.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' });
  };
  const search = () => {
    if (!pane || composing) return;
    const text = query.value; clear();
    if (!text) { status.textContent = '찾을 내용을 입력하세요.'; return; }
    if ((window as any).jueonyEditor?.busy()) { status.textContent = '문서 작업이 끝난 뒤 다시 검색하세요.'; return; }
    try {
      const ih = input(); if (!ih) return;
      ih.flushDeferredPaginationIfNeeded('navigation-search');
      hits = (ih.wasm.searchAllText(text, caseSensitive.checked, true) as TextHit[]).filter(hit => hitPosition(hit) !== null);
      searched = text; render();
    } catch { clear('검색하지 못했습니다. 문서를 확인한 뒤 다시 시도하세요.'); }
  };
  const refresh = () => {
    if (!pane) return;
    clear('문서 변경으로 검색 결과를 갱신합니다.');
    timer = setTimeout(search, 180);
  };
  eventBus.on('document-mutated', refresh); eventBus.on('history-jumped', refresh);
  eventBus.on('document-swapped', () => { if (pane) { query.value = ''; clear('다른 문서가 열렸습니다. 찾을 내용을 입력하세요.'); } });
  const show = () => {
    if (pane) { query.focus(); query.select(); return; }
    const workspace = document.getElementById('jueony-workspace'); if (!workspace) throw new Error('편집 화면이 준비되지 않았습니다.');
    pane = document.createElement('aside'); pane.id = 'jueony-navigation-pane'; pane.setAttribute('aria-label', '탐색 작업 창');
    const header = document.createElement('div'); header.className = 'j-panel-header';
    const title = document.createElement('strong'); title.textContent = '탐색';
    const exit = button('×', close); exit.setAttribute('aria-label', '탐색 작업 창 닫기'); header.append(title, exit);
    const form = document.createElement('form'); form.className = 'j-search-form';
    query = document.createElement('input'); query.type = 'search'; query.maxLength = 256; query.placeholder = '찾을 내용'; query.setAttribute('aria-label', '탐색할 내용');
    query.oninput = refresh; query.addEventListener('compositionstart', () => { composing = true; clear(); }); query.addEventListener('compositionend', () => { composing = false; refresh(); });
    const find = button('찾기', () => { search(); navigate(0); }); find.type = 'submit'; find.onclick = null;
    form.onsubmit = event => { event.preventDefault(); if (!composing) { search(); navigate(0); } };
    form.append(query, find);
    const options = document.createElement('label'); options.className = 'j-search-option'; caseSensitive = document.createElement('input'); caseSensitive.type = 'checkbox'; caseSensitive.onchange = search; options.append(caseSensitive, '대소문자 구별');
    const controls = document.createElement('div'); controls.className = 'j-search-controls';
    previous = button('이전', () => navigate(nextHitIndex(active, hits.length, -1))); next = button('다음', () => navigate(nextHitIndex(active, hits.length, 1)));
    const reset = button('지우기', () => { query.value = ''; clear(); query.focus(); }); controls.append(previous, next, reset);
    status = document.createElement('p'); status.className = 'j-search-status'; status.setAttribute('role', 'status');
    list = document.createElement('div'); list.className = 'j-search-results'; list.setAttribute('aria-label', '검색 결과');
    const limit = document.createElement('p'); limit.className = 'j-search-limit'; limit.textContent = '현재 문서의 본문·표 텍스트를 검색합니다. 개체·수식·머리말·꼬리말·주석 검색과 고급 조건은 아직 지원하지 않습니다.';
    pane.append(header, form, options, controls, status, list, limit);
    pane.addEventListener('keydown', event => {
      event.stopPropagation();
      if (event.isComposing || composing || event.keyCode === 229) return;
      if (event.ctrlKey && event.code === 'KeyF') { event.preventDefault(); query.focus(); query.select(); }
      else if (event.key === 'Escape') { event.preventDefault(); close(); }
      else if (event.key === 'F3') { event.preventDefault(); navigate(nextHitIndex(active, hits.length, event.shiftKey ? -1 : 1)); }
    });
    document.documentElement.dataset.navigationPane = 'open'; workspace.append(pane); clear('찾을 내용을 입력하세요.'); window.dispatchEvent(new Event('resize')); query.focus();
  };
  registry.register({ id: 'ext:jueony-navigation-pane', label: '탐색 작업 창', shortcutLabel: 'Ctrl+F', canExecute: (ctx: any) => ctx.hasDocument, execute: show });
}
