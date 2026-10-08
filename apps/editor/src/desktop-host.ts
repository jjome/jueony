type Invoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
type HandleInfo = { token: string; name: string };
type Host = { wasm: any; eventBus: any; documentState: any; ready: Promise<unknown> };

export function installDesktopHost({ wasm, eventBus, documentState, ready }: Host) {
  let sequence = 0;
  eventBus.on('document-mutated', () => sequence++);
  const revision = () => `${wasm.documentGeneration}:${sequence}`;
  // 검증용 읽기 표면만 노출한다. 문서를 직접 바꾸는 별도 엔진 사본은 만들지 않는다.
  (window as any).joouniEditor = {
    ready, revision,
    state: () => ({ name: wasm.fileName, pageCount: wasm.pageCount, dirty: documentState.isDirty(), revision: revision() }),
  };
  const invoke: Invoke | undefined = (window as any).__TAURI__?.core?.invoke;
  if (!invoke) {
    // 브라우저 검증판은 파일 입력과 명시적 다운로드를 쓴다.
    // Tauri판의 경로 권한/원자적 저장 검증을 브라우저 테스트로 대체하지 않는다.
    Object.defineProperty(window, 'showOpenFilePicker', { value: undefined, configurable: true });
    Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true });
    return;
  }
  let saving = false;
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
            const expected = (pending as any).joouniRevision;
            if (!expected || expected !== revision()) throw new Error('저장 준비 중 문서가 바뀌었습니다. 다시 저장해 주세요.');
            if (saving) throw new Error('이미 저장 중입니다.');
            saving = true;
            const root = document.getElementById('studio-root')!;
            const wasInert = root.inert;
            root.inert = true;
            const overlay = Object.assign(document.createElement('div'), { id: 'joouni-busy', textContent: '문서를 저장하고 있습니다…' });
            overlay.setAttribute('role', 'status');
            document.body.append(overlay);
            try {
              const bytes = Array.from(new Uint8Array(await pending.arrayBuffer()));
              if (expected !== revision()) throw new Error('문서가 변경되어 저장을 취소했습니다.');
              await invoke('write_document', { token: info.token, bytes });
              if (expected !== revision()) throw new Error('이전 상태는 저장됐지만 새 변경 내용은 아직 저장되지 않았습니다. 다시 저장해 주세요.');
            } finally {
              overlay.remove(); root.inert = wasInert; saving = false;
            }
          },
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
  let closeApproved = false;
  const appWindow = (window as any).__TAURI__.window.getCurrentWindow();
  void appWindow.onCloseRequested(async (event: any) => {
    if (saving || (!closeApproved && documentState.isDirty())) {
      event.preventDefault();
      if (saving) return;
      if (confirm('저장하지 않은 변경 내용이 있습니다. 변경 내용을 버리고 종료할까요?')) {
        closeApproved = true;
        await appWindow.close();
      }
    }
  });
}
