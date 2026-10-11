export type Writable = { write(data: Blob): Promise<void>; close(): Promise<void>; abort?(): Promise<void> };
export type Handle = { createWritable(): Promise<Writable>; getFile?(): Promise<Blob> };
const fileSnapshots = new WeakMap<object, string>();
export async function fingerprint(bytes: ArrayBuffer) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(value => value.toString(16).padStart(2, '0')).join('');
}
export async function rememberFileSnapshot(handle: object, bytes: Uint8Array) {
  fileSnapshots.set(handle, await fingerprint(new Uint8Array(bytes).buffer));
}
// A recovery draft contains the latest editor bytes, which can differ from the
// last disk write. Persist this disk fingerprint alongside a cloneable handle.
export function rememberedFileFingerprint(handle: object): string | undefined {
  return fileSnapshots.get(handle);
}

export async function reconnectFileSnapshot(handle: Handle, expected: string): Promise<boolean> {
  if (!/^[0-9a-f]{64}$/i.test(expected) || !handle.getFile) return false;
  const actual = await fingerprint(await (await handle.getFile()).arrayBuffer());
  if (actual !== expected.toLowerCase()) return false;
  fileSnapshots.set(handle, actual);
  return true;
}

export function setRememberedFileFingerprint(handle:object,value:string){fileSnapshots.set(handle,value);}
