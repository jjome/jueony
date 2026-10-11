export type ExitProtectionState = {
  persistenceFailed: boolean; pendingWrites: number; closing: boolean; running: boolean;
  documents: { dirty: boolean; persistenceFailed: boolean; preferenceFailed: boolean; pendingWrites: number }[];
};
export function shouldProtectExit(state: ExitProtectionState): boolean {
  return state.persistenceFailed || state.pendingWrites > 0 || state.closing || state.running
    || state.documents.some(document => document.dirty || document.persistenceFailed || document.preferenceFailed || document.pendingWrites > 0);
}
