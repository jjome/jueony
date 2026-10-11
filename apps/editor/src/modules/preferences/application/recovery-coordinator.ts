import { normalizeRecoverySettings, recoveryDeadline, recoveryIsEnabled } from '../domain/recovery-policy.ts';
import type { RecoverySettings } from '../domain/recovery-policy.ts';

export interface RecoveryDocumentState { identity: string; revision: string; dirty: boolean }
export interface RecoveryClock {
  now(): number;
  schedule(callback: () => void, delayMs: number): number;
  cancel(timer: number): void;
}
export interface RecoveryCoordinatorOptions {
  settings: RecoverySettings;
  clock: RecoveryClock;
  /** false means temporarily busy. Throws stop retries until the next edit or explicit flush. */
  checkpoint(): Promise<boolean>;
  onError(error: unknown): void;
}

/** One per document. It schedules recovery bytes, never original-file saves or workspace writes. */
export function createRecoveryCoordinator(options: RecoveryCoordinatorOptions) {
  const clock = options.clock;
  let settings = normalizeRecoverySettings(options.settings);
  let observed: RecoveryDocumentState | undefined;
  let firstPendingAt: number | undefined, lastEditAt = 0, retryNotBefore = 0;
  let timer: number | undefined, saving: Promise<boolean> | undefined, disposed = false;

  function cancel(): void {
    if (timer !== undefined) clock.cancel(timer);
    timer = undefined;
  }
  function schedule(): void {
    cancel();
    if (disposed || saving || !observed?.dirty || firstPendingAt === undefined) return;
    const deadline = recoveryDeadline(settings, firstPendingAt, lastEditAt);
    if (deadline === undefined) return;
    timer = clock.schedule(() => { timer = undefined; void flush(); }, Math.max(0, deadline - clock.now(), retryNotBefore - clock.now()));
  }
  function observe(next: RecoveryDocumentState): void {
    if (disposed) return;
    const changedDocument = observed?.identity !== next.identity;
    const changedContent = changedDocument || observed?.revision !== next.revision || observed?.dirty !== next.dirty;
    observed = { ...next };
    if (changedDocument) { cancel(); firstPendingAt = undefined; retryNotBefore = 0; }
    if (!next.dirty) { cancel(); firstPendingAt = undefined; retryNotBefore = 0; return; }
    if (!changedContent) return; // Scroll, zoom, menu state and selection are not content changes.
    lastEditAt = clock.now();
    firstPendingAt ??= lastEditAt;
    schedule();
  }
  function updateSettings(next: RecoverySettings): void {
    settings = normalizeRecoverySettings(next);
    schedule(); // Disabling cancels pending work, retaining the previous persisted checkpoint.
  }
  function checkpointed(state: RecoveryDocumentState): void {
    if (observed?.identity !== state.identity || observed?.revision !== state.revision) return;
    firstPendingAt = undefined;
    retryNotBefore = 0;
    cancel();
  }
  async function flush(): Promise<boolean> {
    if (disposed || !recoveryIsEnabled(settings) || !observed?.dirty || firstPendingAt === undefined) return true;
    if (saving) return saving;
    cancel();
    const started = { ...observed };
    let failed = false;
    const work = (async () => {
      try {
        const saved = await options.checkpoint();
        if (saved) {
          if (observed?.identity === started.identity && observed.revision === started.revision) firstPendingAt = undefined;
          else if (observed?.dirty) firstPendingAt = lastEditAt;
          retryNotBefore = 0;
        } else retryNotBefore = clock.now() + 1500;
        return saved;
      } catch (error) {
        failed = true;
        options.onError(error);
        return false;
      }
    })();
    saving = work;
    try { return await work; }
    finally { saving = undefined; if (!failed) schedule(); }
  }
  return {
    observe, updateSettings, checkpointed, flush,
    enabled: () => recoveryIsEnabled(settings),
    dispose: () => { disposed = true; cancel(); },
  };
}
