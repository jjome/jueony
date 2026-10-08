import type { AutomationHost } from '../automation/host';
import type { WasmBridge } from '../core/wasm-bridge';
import type { EventBus } from '../core/event-bus';
import type { DocumentDirtyState } from '../core/document-dirty-state';

type Group = { label: string; commands: string[] };
const tabs: Record<string, Group[]> = {
  edit: [
    { label: '클립보드', commands: ['edit:paste', 'edit:cut', 'edit:copy', 'edit:format-copy'] },
    { label: '편집', commands: ['edit:undo', 'edit:redo', 'edit:delete', 'edit:select-all'] },
    { label: '찾기', commands: ['edit:find', 'edit:find-replace', 'edit:goto'] },
  ],
  view: [
    { label: '표시', commands: ['view:para-mark', 'view:ctrl-mark', 'view:toggle-grid'] },
    { label: '확대/축소', commands: ['view:zoom-dialog', 'view:zoom-fit-page', 'view:zoom-fit-width', 'view:zoom-100'] },
  ],
  insert: [
    { label: '개체', commands: ['insert:image', 'insert:table', 'insert:shape', 'insert:textbox', 'insert:equation'] },
    { label: '글자와 연결', commands: ['insert:symbols', 'insert:hyperlink', 'insert:bookmark'] },
    { label: '주석', commands: ['insert:footnote', 'insert:endnote', 'page:header-create', 'page:footer-create'] },
  ],
  format: [
    { label: '글자와 문단', commands: ['format:char-shape', 'format:para-shape', 'format:style-dialog'] },
    { label: '글자 꾸밈', commands: ['format:bold', 'format:italic', 'format:underline'] },
    { label: '문단', commands: ['format:para-num-shape', 'format:bullet-shape'] },
  ],
  page: [
    { label: '편집 용지', commands: ['file:page-setup', 'page:col-settings', 'page:break', 'page:section-settings'] },
    { label: '쪽 모양', commands: ['page:header-create', 'page:footer-create', 'page:new-page-num', 'page:hide-current'] },
  ],
  review: [{ label: '문서 검토', commands: ['edit:compare-documents', 'edit:document-history'] }],
  table: [
    { label: '표와 셀', commands: ['insert:table', 'table:cell-props'] },
    { label: '셀 편집', commands: ['table:cell-merge', 'table:cell-split', 'table:insert-row-col', 'table:delete-row-col', 'table:cell-height-equal', 'table:cell-width-equal'] },
  ],
  tool: [{ label: '설정', commands: ['tool:options', 'file:about'] }],
  security: [],
};

export function installHangulChrome({ wasm, eventBus, documentState, automation }: {
  wasm: WasmBridge; eventBus: EventBus; documentState: DocumentDirtyState; automation: AutomationHost;
}) {
  if (document.getElementById('joouni-ribbon')) return;
  const commands = new Map(automation.listCommands().map(command => [command.id, command]));
  const menu = document.getElementById('menu-bar')!;
  const ribbon = document.createElement('div');
  ribbon.id = 'joouni-ribbon'; ribbon.setAttribute('role', 'region'); ribbon.setAttribute('aria-label', '기본 도구 상자');
  document.getElementById('icon-toolbar')!.before(ribbon);
  document.getElementById('icon-toolbar')!.classList.add('joouni-original-toolbar');
  let currentTab = 'edit';
  const tabButtons = new Map<string, HTMLButtonElement>();
  const run = (id: string) => {
    const result = automation.execute(id, undefined, { allowDialog: true });
    if (!result.ok && result.reason !== 'disabled') console.warn('[joouni command]', id, result);
    refresh();
  };
  const commandButton = (id: string, compact = false) => {
    const command = commands.get(id);
    // 등록되지 않은 명령을 작동하는 버튼처럼 표시하지 않는다.
    if (!command) return null;
    const button = document.createElement('button');
    button.type = 'button'; button.className = compact ? 'j-quick-button' : 'j-command-button';
    button.dataset.jCommand = id;
    button.title = command.label + (command.shortcutLabel ? ` (${command.shortcutLabel})` : '');
    button.setAttribute('aria-label', button.title);
    const icon = document.createElement('span');
    const existing = document.querySelector(`[data-cmd="${id}"] .tb-sprite, [data-cmd="${id}"] .md-icon`);
    const iconClass = existing ? [...existing.classList].find(value => value.startsWith('icon-')) : null;
    icon.className = `tb-sprite ${iconClass ?? command.icon ?? ''}`;
    if (!iconClass && !command.icon) { icon.className = 'j-letter-icon'; icon.textContent = command.label.slice(0, 1); }
    button.append(icon);
    if (!compact) {
      const label = document.createElement('span'); label.textContent = command.label.replace(/\([A-Z]\)/g, '').replace(/\.\.\.$/, '');
      button.append(label);
    }
    button.addEventListener('mousedown', event => event.preventDefault());
    button.addEventListener('click', () => run(id));
    return button;
  };
  function renderRibbon() {
    ribbon.replaceChildren();
    ribbon.setAttribute('aria-label', `${tabButtons.get(currentTab)?.textContent ?? ''} 도구 상자`);
    for (const [id, button] of tabButtons) button.setAttribute('aria-selected', String(id === currentTab));
    for (const group of tabs[currentTab] ?? []) {
      const section = document.createElement('section'); section.className = 'j-ribbon-group';
      const row = document.createElement('div'); row.className = 'j-ribbon-commands';
      for (const id of group.commands) { const button = commandButton(id); if (button) row.append(button); }
      if (!row.children.length) continue;
      const caption = document.createElement('span'); caption.className = 'j-group-label'; caption.textContent = group.label;
      section.append(row, caption); ribbon.append(section);
    }
    if (!ribbon.children.length) {
      const pending = document.createElement('p'); pending.className = 'j-pending';
      pending.textContent = '이 탭의 한글 2024 기능은 아직 연결되지 않았습니다.'; ribbon.append(pending);
    }
    refresh();
    window.dispatchEvent(new Event('resize'));
  }
  function addTab(id: string, label: string, item: Element) {
    const button = document.createElement('button'); button.type = 'button';
    button.className = 'j-tab'; button.textContent = label; button.setAttribute('role', 'tab');
    button.addEventListener('mousedown', event => event.preventDefault());
    button.addEventListener('click', () => { currentTab = id; renderRibbon(); });
    button.addEventListener('dblclick', () => document.getElementById('toolbox-basic-toggle')?.click());
    item.prepend(button); tabButtons.set(id, button);
  }
  for (const item of menu.querySelectorAll<HTMLElement>('.menu-item')) {
    const id = item.dataset.menu!;
    if (id === 'file') continue;
    const title = item.querySelector<HTMLElement>('.menu-title')!;
    const label = title.textContent!.trim();
    addTab(id, label, item);
    title.textContent = '⌄'; title.removeAttribute('data-i18n'); title.title = `${label} 메뉴 펼치기`;
    title.classList.add('j-menu-arrow');
  }
  const toolItem = menu.querySelector('[data-menu="tool"]');
  for (const [id, label] of [['security', '보안'], ['review', '검토']]) {
    const item = document.createElement('div'); item.className = 'j-extra-tab';
    menu.insertBefore(item, toolItem); addTab(id, label, item);
  }
  // 기본 저장·열기 버튼은 서식 줄 왼쪽에서 항상 접근할 수 있다.
  const quick = document.createElement('div'); quick.className = 'j-quick-access';
  for (const id of ['file:new-doc', 'file:open', 'file:save', 'file:save-as', 'edit:undo', 'edit:redo']) {
    const button = commandButton(id, true); if (button) quick.append(button);
  }
  document.getElementById('style-bar')!.prepend(quick);

  const documentBar = document.createElement('div'); documentBar.id = 'joouni-document-tabs';
  const current = document.createElement('span'); current.className = 'j-document-tab';
  current.setAttribute('aria-label', '현재 문서');
  documentBar.append(current);
  const fresh = commandButton('file:new-doc', true); if (fresh) documentBar.append(fresh);
  const label = document.createElement('span'); label.className = 'j-validation-label'; label.textContent = '검증판 · 한글 2024 정합 검증 진행 중';
  documentBar.append(label); document.getElementById('status-bar')!.before(documentBar);
  function refresh() {
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-j-command]')) {
      button.disabled = !automation.isEnabled(button.dataset.jCommand!);
    }
    current.textContent = wasm.fileName || '빈 문서';
    current.classList.toggle('is-dirty', documentState.isDirty());
    current.title = documentState.isDirty() ? '저장하지 않은 변경 내용' : '현재 문서';
    const context = automation.getContext();
    const tableItem = menu.querySelector<HTMLElement>('[data-menu="table"]');
    if (tableItem) tableItem.hidden = !context.inTable && !context.inTableObjectSelection;
  }
  eventBus.on('command-state-changed', refresh);
  eventBus.on('document-mutated', refresh);
  new MutationObserver(refresh).observe(document.querySelector('title')!, { childList: true });
  renderRibbon();
}
