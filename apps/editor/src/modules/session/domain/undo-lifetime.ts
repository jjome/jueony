export type UndoDocumentStamp = {
  processEpoch: string;
  documentInstance: string;
  revision: string;
  bytesSha256: string;
};

export type AtomicUndoRecipe = {
  version: 1;
  id: string;
  kind: 'engine-snapshot';
  before: UndoDocumentStamp;
  after: UndoDocumentStamp;
};

export type UndoBoundary = 'same-document' | 'save-succeeded' | 'save-failed'
  | 'document-reloaded' | 'recovery-restored' | 'manual-history-restored' | 'process-restarted';
export type UndoContinuity = { status: 'retain' | 'reset'; reason: string };

const SHA256 = /^[0-9a-f]{64}$/u;
const safeText = (value: unknown, max: number): value is string => typeof value === 'string' && value.length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/u.test(value);
const exactKeys = (value: object, keys: readonly string[]) => Object.keys(value).sort().join('\0') === [...keys].sort().join('\0');

export function validateUndoDocumentStamp(value: unknown): UndoDocumentStamp {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !exactKeys(value, ['processEpoch', 'documentInstance', 'revision', 'bytesSha256'])) throw new Error('undo 문서 식별 정보가 올바르지 않습니다.');
  const stamp = value as Record<string, unknown>;
  if (!safeText(stamp.processEpoch, 200) || !safeText(stamp.documentInstance, 300) || !safeText(stamp.revision, 300) || typeof stamp.bytesSha256 !== 'string' || !SHA256.test(stamp.bytesSha256)) throw new Error('undo 문서 버전 또는 원본 지문을 확인할 수 없습니다.');
  return { processEpoch: stamp.processEpoch, documentInstance: stamp.documentInstance, revision: stamp.revision, bytesSha256: stamp.bytesSha256 };
}

const sameStamp = (left: UndoDocumentStamp, right: UndoDocumentStamp) => left.processEpoch === right.processEpoch
  && left.documentInstance === right.documentInstance && left.revision === right.revision && left.bytesSha256 === right.bytesSha256;
const sameLiveDocument = (left: UndoDocumentStamp, right: UndoDocumentStamp) => left.processEpoch === right.processEpoch && left.documentInstance === right.documentInstance;

export function validateAtomicUndoRecipe(value: unknown): AtomicUndoRecipe {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !exactKeys(value, ['version', 'id', 'kind', 'before', 'after'])) throw new Error('atomic undo recipe 형식이 올바르지 않습니다.');
  const recipe = value as Record<string, unknown>, before = validateUndoDocumentStamp(recipe.before), after = validateUndoDocumentStamp(recipe.after);
  if (recipe.version !== 1 || recipe.kind !== 'engine-snapshot' || !safeText(recipe.id, 200)) throw new Error('지원하지 않는 atomic undo recipe입니다.');
  if (!sameLiveDocument(before, after) || sameStamp(before, after)) throw new Error('atomic undo recipe의 문서 수명 또는 전후 버전이 올바르지 않습니다.');
  return { version: 1, id: recipe.id, kind: 'engine-snapshot', before, after };
}

/**
 * Recovery bytes and named document history restore content, not the live
 * engine's process-owned undo tokens. Those boundaries always clear history,
 * even when reopened bytes happen to have the same digest.
 */
export function evaluateUndoContinuity(recipeValue: unknown, currentValue: unknown, options: {
  boundary: UndoBoundary;
  historyTopId?: string;
  atomicComplete: boolean;
}): UndoContinuity {
  const recipe = validateAtomicUndoRecipe(recipeValue), current = validateUndoDocumentStamp(currentValue);
  if (['document-reloaded', 'recovery-restored', 'manual-history-restored', 'process-restarted'].includes(options.boundary)) return { status: 'reset', reason: '새 문서/프로세스에는 live undo token을 이관하지 않습니다.' };
  if (!options.atomicComplete) return { status: 'reset', reason: '부분 적용 또는 원복 미확인 recipe는 재실행하지 않습니다.' };
  if (options.historyTopId !== recipe.id) return { status: 'reset', reason: '다른 편집이 뒤에 있어 이 recipe만 실행할 수 없습니다.' };
  if (!sameStamp(recipe.after, current)) return { status: 'reset', reason: '현재 bytes/revision이 recipe의 적용 결과와 다릅니다.' };
  return { status: 'retain', reason: options.boundary === 'save-failed' ? '저장 실패 뒤에도 문서가 바뀌지 않아 live undo를 유지합니다.' : '같은 live 문서의 최상위 atomic recipe입니다.' };
}

/** Save-time layout/time mutations may change revision. Rebase is explicit and only after verified disk completion. */
export function rebaseAtomicRecipeAfterSave(recipeValue: unknown, transition: {
  from: unknown;
  to: unknown;
  historyTopId?: string;
  writeVerified: boolean;
}): AtomicUndoRecipe {
  const recipe = validateAtomicUndoRecipe(recipeValue), from = validateUndoDocumentStamp(transition.from), to = validateUndoDocumentStamp(transition.to);
  if (!transition.writeVerified || transition.historyTopId !== recipe.id || !sameStamp(from, recipe.after) || !sameLiveDocument(from, to)) throw new Error('저장 완료와 live undo 소유를 확인하지 못해 recipe를 갱신하지 않았습니다.');
  if (sameStamp(from, to)) return recipe;
  return validateAtomicUndoRecipe({ ...recipe, after: to });
}

export function initializeRestartedUndoState(stampValue: unknown) {
  const stamp = validateUndoDocumentStamp(stampValue);
  return { stamp, canUndo: false as const, canRedo: false as const, recipeCount: 0 as const, reason: 'live undo history is process-scoped' as const };
}

export const undoLifetimeContract = Object.freeze({
  liveRecipe: { scope: 'process-document', survivesSave: 'only while exact or verified-rebased', survivesReload: false, survivesRestart: false },
  recoveryCheckpoint: { persists: 'document-bytes', restoresUndo: false },
  namedDocumentHistory: { persists: 'document-ir-snapshot', restoresUndo: false },
});
