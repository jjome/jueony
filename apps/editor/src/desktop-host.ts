import {installNativeFilePickers,installNativeExitProtection} from './adapters/desktop/native-host.ts';

type Host = { wasm: any; eventBus: any; documentState: any; ready: Promise<unknown>; save: () => Promise<string>; discard: () => Promise<void> };

export function installDesktopHost({ wasm, eventBus, documentState, ready, save, discard }: Host) {
  let sequence = 0, hostMutationLocks = 0;
  const assertHostMutationAllowed = () => { if (hostMutationLocks) throw new Error('문서 탭 명령이 끝난 뒤 편집해 주세요.'); };
  const acquireHostMutationLock = () => { hostMutationLocks++; let released = false; return () => { if (!released) { released = true; hostMutationLocks--; } }; };
  eventBus.on('document-mutated', () => sequence++);
  const revision = () => `${wasm.documentGeneration}:${sequence}`;
  // 부모 탭 호스트도 같은 엔진의 상태와 저장 명령을 사용한다.
  (window as any).jueonyEditor = {
    bridgeVersion: 1,
    ready, revision,
    acquireHostMutationLock, hostMutationLocked: () => hostMutationLocks > 0,
    save: async () => { assertHostMutationAllowed(); return save(); },
    discard: async () => { assertHostMutationAllowed(); return discard(); },
    fileHandle: () => wasm.currentFileHandle,
    // A dialog may validate its own synchronous commit without opening the document to other callers.
    busy: (ownedDialog?: HTMLDialogElement) => Boolean(document.getElementById('jueony-busy') || document.getElementById('jueony-download-confirm') || [...document.querySelectorAll('.jueony-page-dialog[open]')].some(dialog => dialog !== ownedDialog)) || document.documentElement.classList.contains('rhwp-busy'),
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
  const tauri = installNativeFilePickers(window);
  if (!tauri) {
    // 자동 검증/내장 브라우저에서는 명시적으로 다운로드 모드를 고를 수 있다.
    // 일반 Chrome/Edge 창은 지원되는 File System Access API를 그대로 사용한다.
    if (new URLSearchParams(location.search).get('storage') === 'download') {
      Object.defineProperty(window, 'showOpenFilePicker', { value: undefined, configurable: true });
      Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true });
    }
    return;
  }
  if (child) return; // 앱 종료 확인은 전체 문서를 아는 부모 창에서 수행한다.
  const protection=installNativeExitProtection(tauri,{
    snapshot:()=>({stamp:revision(),blocked:Boolean(document.getElementById('jueony-busy')||document.querySelector('dialog[open],.modal-overlay')),needsConfirmation:documentState.isDirty()}),
    confirm:async()=>confirm('저장하지 않은 변경이 있습니다. 원본 파일에 저장한 뒤 종료할까요? 취소하면 문서를 계속 편집합니다.'),
    checkpoint:async()=>{if(documentState.isDirty()&&(await save()!=='saved'||documentState.isDirty()))throw new Error('파일을 저장하지 못해 종료하지 않았습니다.');},
    freeze:()=>()=>{},
    error:value=>alert(value instanceof Error?value.message:String(value)),
  });
  void protection.ready.catch(value=>alert('종료 보호를 설치하지 못했습니다. '+String(value)));
}
