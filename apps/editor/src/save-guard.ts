export function assertSaveRevision(expected: unknown, actual: string) {
  if (typeof expected !== 'string' || expected !== actual) {
    throw new Error('저장 준비 중 문서가 바뀌었습니다. 다시 저장해 주세요.');
  }
}

type Writable = { write(data: Blob): Promise<void>; close(): Promise<void>; abort?(): Promise<void> };
type Handle = { createWritable(): Promise<Writable>; getFile?(): Promise<Blob> };
const fileSnapshots = new WeakMap<object, string>();
async function fingerprint(bytes: ArrayBuffer) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(value => value.toString(16).padStart(2, '0')).join('');
}
export async function rememberFileSnapshot(handle: object, bytes: Uint8Array) {
  fileSnapshots.set(handle, await fingerprint(new Uint8Array(bytes).buffer));
}
async function assertFileUnchanged(handle: Handle) {
  const expected = fileSnapshots.get(handle);
  if (!expected || !handle.getFile) return;
  if (await fingerprint(await (await handle.getFile()).arrayBuffer()) !== expected) {
    throw new Error('다른 프로그램에서 원본 파일을 변경했습니다. 다른 이름으로 저장하거나 원본을 다시 열어 주세요.');
  }
}
let saving = false;

export async function writeSnapshot(handle: Handle, blob: Blob) {
  const getRevision = () => (window as any).joouniEditor.revision() as string;
  const expected = (blob as any).joouniRevision;
  assertSaveRevision(expected, getRevision());
  if (saving) throw new Error('이미 저장 중입니다.');
  saving = true;
  const root = document.getElementById('studio-root')!;
  const wasInert = root.inert;
  root.inert = true;
  const overlay = Object.assign(document.createElement('div'), { id: 'joouni-busy', textContent: '문서를 저장하고 있습니다…' });
  overlay.setAttribute('role', 'status');
  document.body.append(overlay);
  let writable: Writable | undefined;
  let closed = false;
  try {
    const savedHash = handle.getFile ? await fingerprint(await blob.arrayBuffer()) : undefined;
    await assertFileUnchanged(handle);
    writable = await handle.createWritable();
    assertSaveRevision(expected, getRevision());
    await writable.write(blob);
    assertSaveRevision(expected, getRevision());
    await assertFileUnchanged(handle);
    await writable.close();
    closed = true;
    if (savedHash) fileSnapshots.set(handle, savedHash);
    assertSaveRevision(expected, getRevision());
  } catch (error) {
    if (!closed) await writable?.abort?.().catch(() => undefined);
    throw error;
  } finally {
    overlay.remove(); root.inert = wasInert; saving = false;
  }
}
