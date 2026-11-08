import {
  evaluateUndoContinuity,
  rebaseAtomicRecipeAfterSave,
  validateAtomicUndoRecipe,
  validateUndoDocumentStamp,
  type AtomicUndoRecipe,
  type UndoBoundary,
  type UndoDocumentStamp,
} from '../domain/undo-lifetime.ts';

export type UndoLifecycleBoundaryN018 = UndoBoundary
  | 'named-history-restored'
  | 'document-swapped'
  | 'manual-edit';

export type UndoLifecycleObservationN018 = Readonly<{
  boundary: UndoLifecycleBoundaryN018;
  recipe: unknown;
  current: unknown;
  historyTopId?: string;
  atomicComplete: boolean;
  writeVerified: boolean;
}>;

export type UndoHistoryCommandN018 =
  | Readonly<{ kind: 'retain' }>
  | Readonly<{ kind: 'reset' }>
  | Readonly<{ kind: 'rebase'; recipe: AtomicUndoRecipe }>;

/** One command must be applied atomically. Rejected/throwing calls are not retried. */
export type UndoHistoryPortN018 = Readonly<{
  apply(command: UndoHistoryCommandN018): 'applied' | 'rejected' | Promise<'applied' | 'rejected'>;
}>;

export type UndoLifecycleResultN018 = Readonly<{
  status: 'retained' | 'rebased' | 'reset' | 'fail-closed' | 'state-uncertain';
  operation: 'retain' | 'rebase' | 'reset' | 'none';
  attempted: UndoHistoryCommandN018['kind'];
  reason: 'same-live-top' | 'verified-save-rebase' | 'boundary-or-continuity-reset'
    | 'invalid-observation' | 'history-port-rejected' | 'history-port-exception';
  recipeExposed: false;
  documentContentExposed: false;
  message: string;
}>;

type PlannedCommandN018 = Readonly<{
  command: UndoHistoryCommandN018;
  successStatus: 'retained' | 'rebased' | 'reset' | 'fail-closed';
  successReason: UndoLifecycleResultN018['reason'];
}>;

const messages: Readonly<Record<UndoLifecycleResultN018['reason'], string>> = Object.freeze({
  'same-live-top': '같은 문서의 최상위 atomic undo 이력을 유지했습니다.',
  'verified-save-rebase': '검증된 저장 뒤 같은 문서의 undo 기준을 갱신했습니다.',
  'boundary-or-continuity-reset': '문서 수명 또는 undo 연속성이 바뀌어 이력을 초기화했습니다.',
  'invalid-observation': 'undo 수명 관찰값을 확인할 수 없어 이력을 안전하게 초기화했습니다.',
  'history-port-rejected': 'undo 이력 변경 결과를 확인하지 못했습니다.',
  'history-port-exception': 'undo 이력 적용 중 상태를 확인하지 못했습니다.',
});

function sameLiveDocument(left: UndoDocumentStamp, right: UndoDocumentStamp): boolean {
  return left.processEpoch === right.processEpoch && left.documentInstance === right.documentInstance;
}

function mappedBoundary(boundary: UndoLifecycleBoundaryN018): UndoBoundary {
  if (boundary === 'named-history-restored') return 'manual-history-restored';
  if (boundary === 'document-swapped') return 'document-reloaded';
  if (boundary === 'manual-edit') return 'same-document';
  return boundary;
}

function resetPlan(reason: PlannedCommandN018['successReason'] = 'boundary-or-continuity-reset'): PlannedCommandN018 {
  return Object.freeze({
    command: Object.freeze({ kind: 'reset' }),
    successStatus: reason === 'invalid-observation' ? 'fail-closed' : 'reset',
    successReason: reason,
  });
}

function planUndoLifecycleN018(observation: UndoLifecycleObservationN018): PlannedCommandN018 {
  let recipe: AtomicUndoRecipe;
  let current: UndoDocumentStamp;
  try {
    recipe = validateAtomicUndoRecipe(observation.recipe);
    current = validateUndoDocumentStamp(observation.current);
  } catch {
    return resetPlan('invalid-observation');
  }

  if (observation.boundary === 'save-succeeded') {
    const canRebase = observation.writeVerified
      && observation.atomicComplete
      && observation.historyTopId === recipe.id
      && sameLiveDocument(recipe.after, current);
    if (!canRebase) {
      evaluateUndoContinuity(recipe, current, {
        boundary: 'save-succeeded',
        historyTopId: observation.historyTopId,
        atomicComplete: false,
      });
      return resetPlan();
    }
    try {
      const rebased = rebaseAtomicRecipeAfterSave(recipe, {
        from: recipe.after,
        to: current,
        historyTopId: observation.historyTopId,
        writeVerified: true,
      });
      const continuity = evaluateUndoContinuity(rebased, current, {
        boundary: 'save-succeeded',
        historyTopId: observation.historyTopId,
        atomicComplete: true,
      });
      if (continuity.status !== 'retain') return resetPlan();
      return Object.freeze({
        command: Object.freeze({ kind: 'rebase', recipe: rebased }),
        successStatus: 'rebased',
        successReason: 'verified-save-rebase',
      });
    } catch {
      return resetPlan();
    }
  }

  const continuity = evaluateUndoContinuity(recipe, current, {
    boundary: mappedBoundary(observation.boundary),
    historyTopId: observation.boundary === 'manual-edit' ? undefined : observation.historyTopId,
    atomicComplete: observation.boundary === 'manual-edit' ? false : observation.atomicComplete,
  });
  if (continuity.status === 'reset') return resetPlan();
  return Object.freeze({
    command: Object.freeze({ kind: 'retain' }),
    successStatus: 'retained',
    successReason: 'same-live-top',
  });
}

function result(
  status: UndoLifecycleResultN018['status'],
  operation: UndoLifecycleResultN018['operation'],
  attempted: UndoLifecycleResultN018['attempted'],
  reason: UndoLifecycleResultN018['reason'],
): UndoLifecycleResultN018 {
  return Object.freeze({
    status,
    operation,
    attempted,
    reason,
    recipeExposed: false,
    documentContentExposed: false,
    message: messages[reason],
  });
}

/**
 * Evaluates once, then makes exactly one history-port call. Port failure is
 * state-uncertain: the coordinator never retries or reports retain/rebase.
 */
export async function coordinateUndoLifecycleN018(
  observation: UndoLifecycleObservationN018,
  history: UndoHistoryPortN018,
): Promise<UndoLifecycleResultN018> {
  let plan: PlannedCommandN018;
  try { plan = planUndoLifecycleN018(observation); }
  catch { plan = resetPlan('invalid-observation'); }

  let applied: 'applied' | 'rejected';
  try { applied = await history.apply(plan.command); }
  catch { return result('state-uncertain', 'none', plan.command.kind, 'history-port-exception'); }
  if (applied !== 'applied') return result('state-uncertain', 'none', plan.command.kind, 'history-port-rejected');
  return result(plan.successStatus, plan.command.kind, plan.command.kind, plan.successReason);
}
