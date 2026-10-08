export function assertSaveRevision(expected: unknown, actual: string) {
  if (typeof expected !== 'string' || expected !== actual) {
    throw new Error('저장 준비 중 문서가 바뀌었습니다. 다시 저장해 주세요.');
  }
}

type Writable = { write(data: Blob): Promise<void>; close(): Promise<void>; abort?(): Promise<void> };
type Handle = { createWritable(): Promise<Writable> };
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
    writable = await handle.createWritable();
    assertSaveRevision(expected, getRevision());
    await writable.write(blob);
    assertSaveRevision(expected, getRevision());
    await writable.close();
    closed = true;
    assertSaveRevision(expected, getRevision());
  } catch (error) {
    if (!closed) await writable?.abort?.().catch(() => undefined);
    throw error;
  } finally {
    overlay.remove(); root.inert = wasInert; saving = false;
  }
}
