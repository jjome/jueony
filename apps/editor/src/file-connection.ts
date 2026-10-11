import { rememberedFileFingerprint, reconnectFileSnapshot } from './save-guard.ts';

type Permission = 'granted' | 'prompt' | 'denied';
export type RestorableFileHandle = {
  kind: 'file'; name: string;
  getFile(): Promise<Blob>;
  createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void>; abort?(): Promise<void> }>;
  queryPermission?(options: { mode: 'readwrite' }): Promise<Permission>;
  requestPermission?(options: { mode: 'readwrite' }): Promise<Permission>;
};
export type StoredFileConnection = { handle: RestorableFileHandle; fingerprint: string };
export type FileConnectionResult =
  | { status: 'connected'; handle: RestorableFileHandle }
  | { status: 'permission-required' | 'changed' | 'unavailable'; message: string };

function validHandle(value: unknown): value is RestorableFileHandle {
  const handle = value as RestorableFileHandle | undefined;
  return Boolean(handle && handle.kind === 'file' && typeof handle.name === 'string'
    && typeof handle.getFile === 'function' && typeof handle.createWritable === 'function');
}

// Native desktop emulation handles contain functions and cannot be stored in
// IndexedDB. Browser handles survive structured cloning, including across frames.
export function captureFileConnection(handle: unknown): StoredFileConnection | undefined {
  if (!validHandle(handle)) return undefined;
  const fingerprint = rememberedFileFingerprint(handle);
  if (!fingerprint) return undefined;
  try {
    const clone = structuredClone(handle);
    return validHandle(clone) ? { handle: clone, fingerprint } : undefined;
  } catch { return undefined; }
}

// Automatic restoration never prompts. A user gesture may explicitly request
// access, but even then the stored disk version must still match before binding.
export async function restoreFileConnection(
  connection: StoredFileConnection,
  options: { requestPermission?: boolean } = {},
): Promise<FileConnectionResult> {
  if (!connection || !validHandle(connection.handle) || !/^[0-9a-f]{64}$/i.test(connection.fingerprint)) {
    return { status: 'unavailable', message: '원본 파일 연결 정보를 확인할 수 없습니다. 복구 문서를 다른 이름으로 저장해 주세요.' };
  }
  const { handle, fingerprint } = connection;
  try {
    let permission: Permission = handle.queryPermission ? await handle.queryPermission({ mode: 'readwrite' }) : 'prompt';
    if (permission !== 'granted' && options.requestPermission && handle.requestPermission) {
      permission = await handle.requestPermission({ mode: 'readwrite' });
    }
    if (permission !== 'granted') {
      return { status: 'permission-required', message: '원본 파일에 다시 연결하려면 접근 권한을 확인해 주세요. 복구 문서는 그대로 유지됩니다.' };
    }
    if (!await reconnectFileSnapshot(handle, fingerprint)) {
      return { status: 'changed', message: '원본 파일이 마지막 저장 이후 바뀌었습니다. 복구 문서는 다른 이름으로 저장하거나 원본을 따로 열어 비교해 주세요.' };
    }
    return { status: 'connected', handle };
  } catch (error) {
    const name = error instanceof Error ? error.name : '';
    if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'AbortError') {
      return { status: 'permission-required', message: '원본 파일 접근이 허용되지 않았습니다. 복구 문서는 그대로 유지됩니다.' };
    }
    return { status: 'unavailable', message: '원본 파일을 읽을 수 없습니다. 이동·삭제 여부를 확인하거나 복구 문서를 다른 이름으로 저장해 주세요.' };
  }
}