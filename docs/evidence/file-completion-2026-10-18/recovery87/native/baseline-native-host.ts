export type NativeInvoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
export type NativeHandleInfo = { token: string; name: string };
type HandleInfo = NativeHandleInfo;
const nativeTokens = new WeakMap<object, string>();
export const nativeFileToken = (handle: object | null | undefined): string | undefined => handle ? nativeTokens.get(handle) : undefined;
type NativeWindow = {
  onCloseRequested(listener: (event: { preventDefault(): void }) => void | Promise<void>): Promise<() => void>;
  destroy(): Promise<void>;
};
export type NativeHost = { core: { invoke: NativeInvoke }; window: { getCurrentWindow(): NativeWindow } };
type NativeSurface = Window & { __TAURI__?: NativeHost };

export function readNativeHost(surface: Window): NativeHost | undefined {
  const own = (surface as NativeSurface).__TAURI__;
  if (own?.core?.invoke) return own;
  try {
    if (surface.parent !== surface && surface.parent.location.origin === surface.location.origin) {
      const parent = (surface.parent as NativeSurface).__TAURI__;
      if (parent?.core?.invoke) return parent;
    }
  } catch { /* Cross-origin parents never gain file privileges. */ }
  return undefined;
}

/** Process-local opaque handles only. No paths or persisted native authority. */
export function createNativeFilePickers(invoke: NativeInvoke) {
  const handles = new Map<string, FileSystemFileHandle>();
  let selecting = false;
  const select = async <T>(operation: () => Promise<T>): Promise<T> => {
    if (selecting) throw new DOMException('다른 문서 열기 또는 저장 위치 선택 창이 열려 있습니다. 열린 창을 먼저 마쳐 주세요.', 'InvalidStateError');
    selecting = true;
    try { return await operation(); }
    finally { selecting = false; }
  };
  const makeHandle = (info: HandleInfo, bound = false): FileSystemFileHandle => {
    const existing = handles.get(info.token);
    if (existing) return existing;
    const handle = {
      kind: 'file' as const, name: info.name,
      queryPermission: async () => 'granted' as const,
      requestPermission: async () => 'granted' as const,
      isSameEntry: async (other: unknown) => {
        if(other===handle)return true;
        const otherToken=typeof other==='object'&&other!==null?nativeTokens.get(other):undefined;
        return otherToken?invoke<boolean>('same_document',{token:info.token,otherToken}):false;
      },
      getFile: async () => new File([new Uint8Array(await invoke<number[]>(bound?'read_bound_document':'read_document', { token: info.token }))], info.name),
      createWritable: async () => {
        let pending: Blob | null = null, finished = false;
        return {
          write: async (blob: Blob) => {
            if (finished) throw new Error('이미 끝난 저장 요청입니다.');
            pending = blob;
          },
          close: async () => {
            if (finished || !pending) throw new Error('저장할 내용이 없습니다.');
            const bytes = Array.from(new Uint8Array(await pending.arrayBuffer()));
            await invoke('write_document', { token: info.token, bytes });
            pending = null; finished = true;
          },
          abort: async () => { pending = null; finished = true; },
        };
      },
    } as unknown as FileSystemFileHandle;
    handles.set(info.token, handle);
    nativeTokens.set(handle, info.token);
    return handle;
  };
  return {
    fromRecent: (info: HandleInfo) => makeHandle(info,true),
    showOpenFilePicker: () => select(async () => {
      const info = await invoke<HandleInfo | null>('pick_document');
      if (!info) throw new DOMException('취소됨', 'AbortError');
      return [makeHandle(info)];
    }),
    showSaveFilePicker: (options?: { suggestedName?: string }) => select(async () => {
      const info = await invoke<HandleInfo | null>('pick_save_document', { suggestedName: options?.suggestedName ?? '문서.hwpx' });
      if (!info) throw new DOMException('취소됨', 'AbortError');
      return makeHandle(info);
    }),
  };
}

const pickerSlot = Symbol.for('jueony.native-file-pickers.v1');
type PickerOwner = Window & { [pickerSlot]?: { host: NativeHost; pickers: ReturnType<typeof createNativeFilePickers> } };
export function installNativeFilePickers(surface: Window): NativeHost | undefined {
  let owner = surface;
  try {
    // One native window owns shell and editor pickers, including separate JS realms.
    while (owner.parent !== owner && owner.parent.location.origin === surface.location.origin && readNativeHost(owner.parent)) owner = owner.parent;
  } catch { /* A different-origin ancestor cannot share native authority. */ }
  const host = readNativeHost(owner);
  if (!host) return undefined;
  const record = (owner as PickerOwner)[pickerSlot];
  const pickers = record?.host === host ? record.pickers : createNativeFilePickers(host.core.invoke.bind(host.core));
  if (record?.host !== host) Object.defineProperty(owner, pickerSlot, { value: { host, pickers }, configurable: true });
  for (const name of ['showOpenFilePicker','showSaveFilePicker'] as const) {
    const picker = pickers[name];
    Object.defineProperty(surface, name, { value: picker, configurable: true });
  }
  return host;
}

/** A fresh Rust-approved process token becomes a handle in the picker owner's
 * realm; persisted paths and former process tokens never enter this contract. */
export function nativeRecentHandle(surface:Window,info:NativeHandleInfo):FileSystemFileHandle {
  let owner=surface;
  try{while(owner.parent!==owner&&owner.parent.location.origin===owner.location.origin&&readNativeHost(owner.parent))owner=owner.parent;}catch{}
  const record=(owner as PickerOwner)[pickerSlot];
  if(!record||typeof info?.token!=='string'||!info.token||typeof info.name!=='string'||!info.name)throw new Error('최근 문서의 파일 연결을 확인하지 못했습니다.');
  return record.pickers.fromRecent(info);
}

export type NativeExitSnapshot = { stamp: string; blocked: boolean; needsConfirmation: boolean };
export type NativeExitConfirmation = boolean | {beforeStamp:string;approvedSnapshot:NativeExitSnapshot;rollback?:()=>Promise<void>};
export type NativeExitHooks = {
  snapshot(): NativeExitSnapshot;
  confirm(): Promise<NativeExitConfirmation>;
  checkpoint(): Promise<void>;
  freeze(): () => void;
  close(): Promise<void>;
  error(error: unknown): void;
};

/** Native CloseRequested is asynchronous: the first event must be vetoed synchronously. */
export function createNativeExitCoordinator(hooks: NativeExitHooks) {
  let pending = false, approved: string | undefined;
  const isApproved = () => {
    if (approved === undefined) return false;
    const current = hooks.snapshot();
    return !current.blocked && current.stamp === approved;
  };
  const request = async (event: { preventDefault(): void }) => {
    // Never let Tauri's outer listener destroy outside the guarded IPC call.
    event.preventDefault();
    try {
      if (isApproved()) return;
    } catch { approved = undefined; }
    approved = undefined;
    if (pending) return;
    let resume: (() => void) | undefined, keepFrozen = false, rollback:(()=>Promise<void>)|undefined;
    pending = true;
    try {
      const before = hooks.snapshot();
      if (before.blocked) throw new Error('문서 작업과 대화상자를 마친 뒤 종료해 주세요.');
      resume = hooks.freeze();
      let expected=before;
      if(before.needsConfirmation){
        const consent=await hooks.confirm();if(!consent)return;
        if(typeof consent==='object'){
          rollback=consent.rollback;
          if(consent.beforeStamp!==before.stamp||consent.approvedSnapshot.blocked)throw Error('종료 선택의 문서 버전이 일치하지 않습니다.');
          expected=consent.approvedSnapshot;
        }
      }
      await hooks.checkpoint();
      const after = hooks.snapshot();
      if (after.blocked || expected.stamp !== after.stamp) throw new Error('종료 준비 중 문서가 바뀌었습니다. 최신 내용을 확인한 뒤 다시 종료해 주세요.');
      approved = after.stamp;
      await hooks.close();
      keepFrozen = true;
    } catch (error) {
      approved = undefined;
      if(rollback)try{await rollback();}catch(restoreError){hooks.error(new Error('종료하지 않았으며 복구본 원복도 확인하지 못했습니다. 열린 문서를 파일에 저장하세요. '+String(restoreError)));return;}
      hooks.error(error);
    } finally {
      pending = false;
      if (!keepFrozen) resume?.();
    }
  };
  return { request, isApproved };
}

export function installNativeExitProtection(host: NativeHost, hooks: Omit<NativeExitHooks, 'close'>, close?: () => Promise<void>) {
  const appWindow = host.window.getCurrentWindow();
  // Tauri's onCloseRequested wrapper otherwise calls destroy outside our catch.
  // Destroy only after the explicit checkpoint approval, and catch IPC denial here.
  const coordinator = createNativeExitCoordinator({ ...hooks, close: close ?? (() => appWindow.destroy()) });
  return { ...coordinator, ready: appWindow.onCloseRequested(coordinator.request) };
}
