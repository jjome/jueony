export {};

type EditorApi = {
  state(): { name: string; dirty: boolean; pageCount: number; revision: string };
  save(): Promise<string>;
  discard(): Promise<void>;
  busy(): boolean;
};
type Tab = { id: number; frame: HTMLIFrameElement; wrapper: HTMLElement; button: HTMLButtonElement; close: HTMLButtonElement };
const documents = document.getElementById('documents')!;
const list = document.getElementById('document-tab-list')!;
const dialog = document.getElementById('close-document') as HTMLDialogElement;
const status = document.getElementById('shell-status')!;
const tabs: Tab[] = [];
let active: Tab | undefined;
let counter = 0;
let closing = false;
const api = (tab: Tab) => (tab.frame.contentWindow as any)?.joouniEditor as EditorApi | undefined;

function refresh(tab: Tab) {
  const state = api(tab)?.state();
  const name = !state?.name || state.name === '새 문서.hwp' ? `빈 문서 ${tab.id}` : state.name;
  tab.button.textContent = name;
  tab.button.classList.toggle('is-dirty', state?.dirty ?? false);
  tab.close.setAttribute('aria-label', `${name} 탭 닫기`);
  tab.button.title = name + (state?.dirty ? ' · 저장하지 않은 변경 내용' : '');
  if (tab === active) {
    document.title = `${name} - 주니 문서 편집기`;
    status.textContent = new URLSearchParams(location.search).get('storage') === 'download'
      ? '다운로드 저장 검증 모드' : '로컬 문서 편집기';
  }
}

function select(tab: Tab) {
  active = tab;
  for (const candidate of tabs) {
    const selected = candidate === tab;
    candidate.frame.hidden = !selected;
    candidate.wrapper.classList.toggle('is-active', selected);
    candidate.button.setAttribute('aria-selected', String(selected));
  }
  refresh(tab);
  tab.frame.contentWindow?.dispatchEvent(new Event('resize'));
}

function newDocument() {
  // 열린 엔진을 제거했다가 재구성하지 않아 undo와 커서가 탭별로 유지된다.
  const id = ++counter;
  const frame = document.createElement('iframe');
  frame.className = 'editor-frame'; frame.title = `문서 ${id} 편집기`; frame.id = `editor-${id}`;
  const url = new URL('./editor.html', location.href);
  url.searchParams.set('child', '1');
  if (id > 1) url.searchParams.set('skipRecovery', '1');
  if (new URLSearchParams(location.search).get('storage') === 'download') url.searchParams.set('storage', 'download');
  frame.src = url.href;
  const wrapper = document.createElement('div'); wrapper.className = 'document-tab-wrap';
  const button = document.createElement('button'); button.className = 'document-tab'; button.type = 'button';
  button.setAttribute('role', 'tab'); button.setAttribute('aria-controls', frame.id);
  const close = document.createElement('button'); close.className = 'close-tab'; close.type = 'button'; close.textContent = '×';
  const tab: Tab = { id, frame, wrapper, button, close };
  tabs.push(tab); wrapper.append(button, close); list.append(wrapper); documents.append(frame);
  button.addEventListener('click', () => select(tab));
  close.addEventListener('click', () => { void closeTab(tab); });
  frame.addEventListener('load', () => refresh(tab));
  select(tab);
}

async function closeTab(tab: Tab, replaceEmpty = true): Promise<boolean> {
  if (closing || api(tab)?.busy()) return false;
  closing = true;
  try {
    const editor = api(tab);
    if (editor?.state().dirty) {
      select(tab);
      document.getElementById('close-document-name')!.textContent = editor.state().name;
      dialog.returnValue = 'cancel';
      const choice = new Promise<string>(resolve => dialog.addEventListener('close', () => resolve(dialog.returnValue), { once: true }));
      dialog.showModal();
      const action = await choice;
      if (action === 'save') {
        if (await editor.save() !== 'saved' || editor.state().dirty) return false;
      } else if (action === 'discard') {
        await editor.discard();
      } else return false;
    }
    const index = tabs.indexOf(tab);
    tabs.splice(index, 1); tab.frame.remove(); tab.wrapper.remove();
    if (tabs.length && active === tab) select(tabs[Math.min(index, tabs.length - 1)]);
    if (!tabs.length && replaceEmpty) newDocument();
    return true;
  } finally { closing = false; }
}

window.addEventListener('message', event => {
  if (event.origin !== location.origin) return;
  const tab = tabs.find(candidate => candidate.frame.contentWindow === event.source);
  if (!tab || !event.data || typeof event.data !== 'object') return;
  if (event.data.type === 'joouni:status') refresh(tab);
  if (event.data.type === 'joouni:new-document') newDocument();
});
window.addEventListener('beforeunload', event => {
  if (!tabs.some(tab => api(tab)?.state().dirty)) return;
  event.preventDefault(); event.returnValue = '';
});
document.getElementById('new-document')!.addEventListener('click', newDocument);
document.addEventListener('keydown', event => {
  if (event.altKey && event.code === 'KeyN') { event.preventDefault(); newDocument(); }
});
const tauriWindow = (window as any).__TAURI__?.window?.getCurrentWindow();
let approvedClose = false;
if (tauriWindow) {
  void tauriWindow.onCloseRequested(async (event: any) => {
    if (approvedClose) return;
    event.preventDefault();
    for (const tab of [...tabs]) if (!await closeTab(tab, false)) return;
    approvedClose = true;
    await tauriWindow.close();
  });
}
newDocument();
