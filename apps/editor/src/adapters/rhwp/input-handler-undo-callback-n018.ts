import type {UndoLifecycleResultN018} from '../../modules/session/public/index.ts';
import {
  inspectInputHandlerUndoCapabilityN018,
  observeInputHandlerUndoLifecycleN018,
  type InputHandlerUndoCapabilityN018,
  type UndoLifecycleEngineEventN018,
} from './undo-history-port-n018.ts';

export type UpstreamUndoEventNameN018 = 'document-mutated' | 'history-jumped' | 'document-swapped';

export type UpstreamUndoEventBusN018 = Readonly<{
  on(event: UpstreamUndoEventNameN018, listener: (...args: unknown[]) => void): () => void;
}>;

export type InputHandlerUndoCallbackOptionsN018 = Readonly<{
  events: UpstreamUndoEventBusN018;
  inputHandler(): unknown;
  recipe(): unknown;
  current(): unknown;
  onResult?(result: UndoLifecycleResultN018): void;
}>;

export type InputHandlerUndoCallbackBindingN018 = Readonly<{
  status: 'bound' | 'not-bound';
  reason?: 'subscription-failed';
  inspectCapability(): InputHandlerUndoCapabilityN018;
  drain(): Promise<UndoLifecycleResultN018 | null>;
  dispose(): void;
}>;

type CapturedEvent = Readonly<{
  input: unknown;
  event: UndoLifecycleEngineEventN018;
}>;

const unexpectedFailure = (): UndoLifecycleResultN018 => Object.freeze({
  status: 'state-uncertain',
  operation: 'none',
  attempted: 'reset',
  reason: 'history-port-exception',
  recipeExposed: false,
  documentContentExposed: false,
  message: 'undo 수명 callback 처리 결과를 확인하지 못했습니다.',
});

function capture(read: () => unknown): unknown {
  try { return structuredClone(read()); }
  catch { return undefined; }
}

function eventKind(name: UpstreamUndoEventNameN018): UndoLifecycleEngineEventN018['kind'] {
  if (name === 'document-mutated') return 'manual-edit';
  if (name === 'history-jumped') return 'history-top-mismatch';
  return 'document-swapped';
}

function captureEvent(options: InputHandlerUndoCallbackOptionsN018, name: UpstreamUndoEventNameN018): CapturedEvent {
  return Object.freeze({
    input: (() => { try { return options.inputHandler(); } catch { return undefined; } })(),
    event: Object.freeze({
      kind: eventKind(name),
      recipe: capture(options.recipe),
      current: capture(options.current),
      writeVerified: false,
    }),
  });
}

/**
 * Connects the three upstream EventBus callbacks that actually mark an undo
 * continuity boundary. Current InputHandler exposes canUndo/canRedo but no
 * atomic top-recipe bridge, so those builds always reach reset and then
 * state-uncertain rather than claiming retain/rebase.
 */
export function bindInputHandlerUndoCallbacksN018(
  options: InputHandlerUndoCallbackOptionsN018,
): InputHandlerUndoCallbackBindingN018 {
  let disposed = false;
  let last: UndoLifecycleResultN018 | null = null;
  let tail = Promise.resolve();
  const subscriptions: Array<() => void> = [];

  const schedule = (name: UpstreamUndoEventNameN018) => {
    if (disposed) return;
    const captured = captureEvent(options, name);
    tail = tail.then(async () => {
      let result: UndoLifecycleResultN018;
      try { result = await observeInputHandlerUndoLifecycleN018(captured.input, captured.event); }
      catch { result = unexpectedFailure(); }
      last = result;
      try { options.onResult?.(result); } catch { /* observation remains authoritative */ }
    });
  };

  let status: 'bound' | 'not-bound' = 'bound';
  try {
    for (const name of ['document-mutated', 'history-jumped', 'document-swapped'] as const) {
      const off = options.events.on(name, () => schedule(name));
      if (typeof off !== 'function') throw new Error('invalid unsubscribe contract');
      subscriptions.push(off);
    }
  } catch {
    status = 'not-bound';
    for (const off of subscriptions.splice(0)) { try { off(); } catch { /* fail closed */ } }
  }

  return Object.freeze({
    status,
    ...(status === 'not-bound' ? {reason: 'subscription-failed' as const} : {}),
    inspectCapability() {
      let input: unknown;
      try { input = options.inputHandler(); } catch { input = undefined; }
      return inspectInputHandlerUndoCapabilityN018(input);
    },
    async drain() {
      try { await tail; } catch { return null; }
      return last ? structuredClone(last) : null;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const off of subscriptions.splice(0)) { try { off(); } catch { /* detached as far as provable */ } }
    },
  });
}
