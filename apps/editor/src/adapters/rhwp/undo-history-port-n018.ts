import {
  coordinateUndoLifecycleN018,
  validateAtomicUndoRecipe,
  type AtomicUndoRecipe,
  type UndoHistoryCommandN018,
  type UndoHistoryPortN018,
  type UndoLifecycleBoundaryN018,
  type UndoLifecycleResultN018,
} from '../../modules/session/public/index.ts';

export type InputHandlerUndoLifecycleStateN018 = Readonly<{
  version: 1;
  historyTopId: string | null;
  recipeCount: number;
  canUndo: boolean;
  canRedo: boolean;
  atomicComplete: boolean;
  activeRecipe: AtomicUndoRecipe | null;
}>;

export type InputHandlerUndoLifecycleBridgeN018 = Readonly<{
  readUndoLifecycleState(): unknown;
  /** The engine must compare `expected` and apply `command` in one turn. */
  applyUndoLifecycleCommand(request: Readonly<{
    version: 1;
    expected: InputHandlerUndoLifecycleStateN018;
    command: UndoHistoryCommandN018;
  }>): unknown | Promise<unknown>;
}>;

export type InputHandlerUndoCapabilityN018 =
  | Readonly<{supported: true; mode: 'atomic-lifecycle-bridge'}>
  | Readonly<{
      supported: false;
      mode: 'capability-gated';
      reason: 'missing-state-reader' | 'missing-atomic-command';
    }>;

export type UndoLifecycleEngineEventN018 = Readonly<{
  kind: 'save-succeeded' | 'save-failed' | 'document-reloaded' | 'recovery-restored'
    | 'named-history-restored' | 'document-swapped' | 'process-restarted'
    | 'manual-edit' | 'history-top-mismatch' | 'same-document';
  recipe: unknown;
  current: unknown;
  writeVerified?: boolean;
}>;

type BridgeResponse = Readonly<{
  status: 'applied' | 'rejected';
  state: InputHandlerUndoLifecycleStateN018;
}>;

const STATE_KEYS = ['activeRecipe', 'atomicComplete', 'canRedo', 'canUndo', 'historyTopId', 'recipeCount', 'version'] as const;

export function inspectInputHandlerUndoCapabilityN018(input: unknown): InputHandlerUndoCapabilityN018 {
  const value = object(input);
  if (!value || typeof value.readUndoLifecycleState !== 'function') {
    return Object.freeze({supported: false, mode: 'capability-gated', reason: 'missing-state-reader'});
  }
  if (typeof value.applyUndoLifecycleCommand !== 'function') {
    return Object.freeze({supported: false, mode: 'capability-gated', reason: 'missing-atomic-command'});
  }
  return Object.freeze({supported: true, mode: 'atomic-lifecycle-bridge'});
}

/**
 * Adapts only an explicit atomic bridge. Current InputHandler builds that expose
 * only canUndo/canRedo/performUndo/performRedo are deliberately unsupported:
 * those methods cannot identify the top recipe, release snapshot resources on
 * reset, or prove a save-time rebase.
 */
export function createInputHandlerUndoHistoryPortN018(
  input: unknown,
  expectedState?: InputHandlerUndoLifecycleStateN018,
): UndoHistoryPortN018 {
  const capability = inspectInputHandlerUndoCapabilityN018(input);
  if (!capability.supported || !expectedState) return Object.freeze({apply: () => 'rejected' as const});
  const bridge = input as InputHandlerUndoLifecycleBridgeN018;
  const expected = cloneState(expectedState);
  return Object.freeze({
    async apply(command: UndoHistoryCommandN018): Promise<'applied' | 'rejected'> {
      let raw: unknown;
      try {
        raw = await bridge.applyUndoLifecycleCommand(Object.freeze({
          version: 1,
          expected: cloneState(expected),
          command: structuredClone(command),
        }));
      } catch {
        throw new Error('undo lifecycle bridge failed');
      }
      const response = normalizeResponse(raw);
      if (!response || response.status !== 'applied') return 'rejected';
      return verifiesCommand(command, expected, response.state) ? 'applied' : 'rejected';
    },
  });
}

/** Captures one engine state, maps one lifecycle event, and delegates exactly
 * one atomic decision to the existing coordinator. */
export async function observeInputHandlerUndoLifecycleN018(
  input: unknown,
  event: UndoLifecycleEngineEventN018,
): Promise<UndoLifecycleResultN018> {
  const capability = inspectInputHandlerUndoCapabilityN018(input);
  let state: InputHandlerUndoLifecycleStateN018 | undefined;
  if (capability.supported) {
    try { state = normalizeState((input as InputHandlerUndoLifecycleBridgeN018).readUndoLifecycleState()); }
    catch { state = undefined; }
  }
  const recipeMatches = Boolean(state && sameRecipe(state.activeRecipe, event.recipe));
  const forceMismatch = event.kind === 'history-top-mismatch';
  const observation = {
    boundary: boundary(event.kind),
    recipe: event.recipe,
    current: event.current,
    historyTopId: !forceMismatch && state?.historyTopId !== null ? state?.historyTopId : undefined,
    atomicComplete: Boolean(state?.atomicComplete && recipeMatches && !forceMismatch),
    writeVerified: event.kind === 'save-succeeded' && event.writeVerified === true,
  } as const;
  return coordinateUndoLifecycleN018(observation, createInputHandlerUndoHistoryPortN018(input, state));
}

function boundary(kind: UndoLifecycleEngineEventN018['kind']): UndoLifecycleBoundaryN018 {
  if (kind === 'history-top-mismatch') return 'same-document';
  return kind;
}

function normalizeState(value: unknown): InputHandlerUndoLifecycleStateN018 | undefined {
  const state = object(value);
  if (!state || !exactKeys(state, STATE_KEYS) || state.version !== 1
      || !(state.historyTopId === null || safeText(state.historyTopId, 200))
      || !Number.isSafeInteger(state.recipeCount) || Number(state.recipeCount) < 0 || Number(state.recipeCount) > 1024
      || typeof state.canUndo !== 'boolean' || typeof state.canRedo !== 'boolean' || typeof state.atomicComplete !== 'boolean') return undefined;
  let activeRecipe: AtomicUndoRecipe | null = null;
  if (state.activeRecipe !== null) {
    try { activeRecipe = validateAtomicUndoRecipe(state.activeRecipe); }
    catch { return undefined; }
  }
  const recipeCount = Number(state.recipeCount);
  if (recipeCount === 0 && (state.historyTopId !== null || activeRecipe !== null || state.canUndo || state.canRedo)) return undefined;
  if (recipeCount > 0 && (state.historyTopId === null || activeRecipe === null || activeRecipe.id !== state.historyTopId)) return undefined;
  return Object.freeze({
    version: 1,
    historyTopId: state.historyTopId as string | null,
    recipeCount,
    canUndo: state.canUndo,
    canRedo: state.canRedo,
    atomicComplete: state.atomicComplete,
    activeRecipe,
  });
}

function normalizeResponse(value: unknown): BridgeResponse | undefined {
  const response = object(value);
  if (!response || !exactKeys(response, ['state', 'status']) || !['applied', 'rejected'].includes(String(response.status))) return undefined;
  const state = normalizeState(response.state);
  if (!state) return undefined;
  return {status: response.status as BridgeResponse['status'], state};
}

function verifiesCommand(
  command: UndoHistoryCommandN018,
  before: InputHandlerUndoLifecycleStateN018,
  after: InputHandlerUndoLifecycleStateN018,
): boolean {
  if (command.kind === 'retain') return sameState(before, after);
  if (command.kind === 'reset') {
    return after.recipeCount === 0 && after.historyTopId === null && after.activeRecipe === null
      && !after.canUndo && !after.canRedo && !after.atomicComplete;
  }
  return after.recipeCount === before.recipeCount
    && after.historyTopId === command.recipe.id
    && after.atomicComplete
    && sameRecipe(after.activeRecipe, command.recipe);
}

function cloneState(state: InputHandlerUndoLifecycleStateN018): InputHandlerUndoLifecycleStateN018 {
  return structuredClone(state);
}

function sameState(left: InputHandlerUndoLifecycleStateN018, right: InputHandlerUndoLifecycleStateN018): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function sameRecipe(left: unknown, right: unknown): boolean {
  try { return JSON.stringify(validateAtomicUndoRecipe(left)) === JSON.stringify(validateAtomicUndoRecipe(right)); }
  catch { return false; }
}

function object(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function exactKeys(value: object, keys: readonly string[]): boolean {
  return Object.keys(value).sort().join('\0') === [...keys].sort().join('\0');
}

function safeText(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/u.test(value);
}
