/** OS clipboard acknowledgement must precede a destructive edit. The editor's
 * synchronous snapshot router owns the commit and its undo/rollback semantics. */
export type CutStamp = { document: object; generation: number; revision: string; selection: string };
export type GuardedCutPorts = {
  owner: object;
  readStamp(): CutStamp;
  writeClipboard(): Promise<void>;
  commit(): void;
  onInvalidated(listener: () => void): () => void;
};
const pendingCuts = new WeakSet<object>();
export async function runGuardedObjectCut(ports: GuardedCutPorts): Promise<'cut' | 'stale' | 'pending'> {
  if (pendingCuts.has(ports.owner)) return 'pending';
  pendingCuts.add(ports.owner);
  let unsubscribe: (() => void) | undefined;
  try {
    const initial = ports.readStamp();
    if (!initial.document || !Number.isSafeInteger(initial.generation) || typeof initial.revision !== 'string' || !initial.revision) throw new Error('문서 버전을 확인하지 못해 잘라내기를 취소했습니다.');
    let invalidated = false;
    unsubscribe = ports.onInvalidated(() => { invalidated = true; });
    await ports.writeClipboard();
    const current = ports.readStamp();
    if (invalidated || current.document !== initial.document || current.generation !== initial.generation || current.revision !== initial.revision || current.selection !== initial.selection) return 'stale';
    // The commit is synchronous. Stop listening before its own mutation events.
    unsubscribe(); unsubscribe = undefined;
    ports.commit();
    return 'cut';
  } finally { unsubscribe?.(); pendingCuts.delete(ports.owner); }
}

/** Unsupported compound stories must never be addressed as a body control. */
export function validateObjectCutTarget(kind: 'table' | 'picture', ref: any, selectedCount: number): void {
  if (!ref || ![ref.sec, ref.ppi, ref.ci].every(n => Number.isSafeInteger(n) && n >= 0)) throw new Error('잘라낼 개체의 위치를 확인하지 못했습니다.');
  if (selectedCount !== 1) throw new Error('개체 잘라내기는 한 번에 한 개체를 선택하세요.');
  if (ref.headerFooter || ref.noteRef) throw new Error('머리말·주석 안의 개체 잘라내기는 지원하지 않습니다.');
  const path = ref.cellPath;
  if (path !== undefined && (!Array.isArray(path) || path.length > 8 || path.some(p => !p || ![p.controlIndex, p.cellIndex, p.cellParaIndex].every(n => Number.isSafeInteger(n) && n >= 0)))) throw new Error('잘라낼 개체의 셀 경로가 올바르지 않습니다.');
  if (kind === 'table' && path?.length > 1) throw new Error('중첩 표 전체 잘라내기는 지원하지 않습니다.');
  if (kind === 'picture' && !['image', 'shape', 'equation', 'group', 'line', 'ole'].includes(ref.type)) throw new Error('지원하지 않는 개체 종류입니다.');
  if (kind === 'picture' && path?.length && ref.type !== 'image') throw new Error('셀 안의 그림 외 개체 잘라내기는 지원하지 않습니다.');
  if (kind === 'picture' && ref.cellIdx !== undefined && !path?.length) throw new Error('셀 안 개체의 전체 경로가 없어 잘라내기를 취소했습니다.');
}
