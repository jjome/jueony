/** Session projections deliberately contain no editor instance, DOM node, or file handle. */
export type SessionTab = { id: string; workspaceId: string; closed: boolean };
export type SessionWorkspace = { id: string; activeDocumentId?: string; documentOrder?: string[] };
export type RecoveryDescriptor = { id: string; workspaceId: string };
export interface SessionFacade {
  /** Called once a shell tab has been registered, before loading its editor. */
  opened(tab: SessionTab): void;
  /** Read-only eligibility check before the shell suspends the prior viewport. */
  canSelect(tabId: string): boolean;
  /** False leaves state unchanged for closed, absent, or other-workspace tabs. */
  select(tabId: string): boolean;
  /** Called only after persistence removal succeeds. Undefined means create a blank tab. */
  closed(tab: SessionTab): string | undefined;
  /** Omitted previous ID reads current state; explicit undefined means no persisted selection. */
  preferred(workspaceId: string, ...previousId: [string?]): string | undefined;
  restore<T extends RecoveryDescriptor>(workspaceId: string, records: T[]): T[];
}
