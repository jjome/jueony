type Invoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
type HandleInfo = { token: string; name: string };
type Host = { wasm: any; eventBus: any; documentState: any; ready: Promise<unknown>; save: () => Promise<string>; discard: () => Promise<void> };

export function installDesktopHost({ wasm, eventBus, documentState, ready, save, discard }: Host) {
  let sequence = 0;
  eventBus.on('document-mutated', () => sequence++);
  const revision = () => `${wasm.documentGeneration}:${sequence}`;
  // 부모 탭 호스트도 같은 엔진의 상태와 저장 명령을 사용한다.
  (window as any).jueonyEditor = {
    bridgeVersion: 1,
    ready, revision, save, discard,
    fileHandle: () => wasm.currentFileHandle,
    busy: () => Boolean(document.getElementById('jueony-busy') || document.getElementById('jueony-download-confirm')) || document.documentElement.classList.contains('rhwp-busy'),
    state: () => ({ name: wasm.fileName, pageCount: wasm.pageCount, dirty: documentState.isDirty(), revision: revision() }),
  };
  // 이름 변경 전에 열린 부모 탭도 새 문서의 dirty/save 상태를 읽을 수 있어야 한다.
  // 기존 창을 닫기 전까지 유지하는 이전 호스트 프로토콜의 호환 별칭이다.
  (window as any).joouniEditor = (window as any).jueonyEditor;
  const child = new URLSearchParams(location.search).get('child') === '1' && window.parent !== window;
  if (child) {
    const notify = () => {
      window.parent.postMessage({ type: 'jueony:status' }, location.origin);
      window.parent.postMessage({ type: 'joouni:status' }, location.origin);
    };
    eventBus.on('document-dirty-changed', notify);
    eventBus.on('document-mutated', notify);
    new MutationObserver(notify).observe(document.querySelector('title')!, { childList: true });
    void ready.then(notify);
  }
  const tauri = (window as any).__TAURI__ ?? (child ? (window.parent as any).__TAURI__ : undefined);
  const invoke: Invoke | undefined = tauri?.core?.invoke;
  if (!invoke) {
    // 자동 검증/내장 브라우저에서는 명시적으로 다운로드 모드를 고를 수 있다.
    // 일반 Chrome/Edge 창은 지원되는 File System Access API를 그대로 사용한다.
    if (new URLSearchParams(location.search).get('storage') === 'download') {
      Object.defineProperty(window, 'showOpenFilePicker', { value: undefined, configurable: true });
      Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true });
    }
    return;
  }
  const handles = new Map<string, any>();
  const makeHandle = (info: HandleInfo) => {
    if (handles.has(info.token)) return handles.get(info.token);
    const handle = {
      kind: 'file', name: info.name,
      queryPermission: async () => 'granted', requestPermission: async () => 'granted',
      isSameEntry: async (other: any) => other === handle,
      getFile: async () => {
        const bytes = await invoke<number[]>('read_document', { token: info.token });
        return new File([new Uint8Array(bytes)], info.name);
      },
      createWritable: async () => {
        let pending: Blob | null = null;
        return {
          write: async (blob: Blob) => { pending = blob; },
          close: async () => {
            if (!pending) throw new Error('저장할 내용이 없습니다.');
            const bytes = Array.from(new Uint8Array(await pending.arrayBuffer()));
            await invoke('write_document', { token: info.token, bytes });
          },
          abort: async () => { pending = null; },
        };
      },
    };
    handles.set(info.token, handle);
    return handle;
  };
  (window as any).showOpenFilePicker = async () => {
    const info = await invoke<HandleInfo | null>('pick_document');
    if (!info) throw new DOMException('취소됨', 'AbortError');
    return [makeHandle(info)];
  };
  (window as any).showSaveFilePicker = async (options: any) => {
    const info = await invoke<HandleInfo | null>('pick_save_document', { suggestedName: options?.suggestedName ?? '문서.hwpx' });
    if (!info) throw new DOMException('취소됨', 'AbortError');
    return makeHandle(info);
  };
  if (child) return; // 앱 종료 확인은 전체 문서를 아는 부모 창에서 수행한다.
  let closeApproved = false;
  const appWindow = tauri.window.getCurrentWindow();
  void appWindow.onCloseRequested(async (event: any) => {
    if (document.getElementById('jueony-busy') || (!closeApproved && documentState.isDirty())) {
      event.preventDefault();
      if (document.getElementById('jueony-busy')) return;
      if (confirm('저장하지 않은 변경 내용이 있습니다. 변경 내용을 버리고 종료할까요?')) {
        closeApproved = true;
        await appWindow.close();
      }
    }
  });
}
