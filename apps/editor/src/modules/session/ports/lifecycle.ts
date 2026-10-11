import type { SessionTab, SessionWorkspace } from '../public/contracts.ts';

export interface SessionStatePort {
  activeWorkspaceId(): string;
  workspaces(): readonly SessionWorkspace[];
  tabs(): readonly SessionTab[];
}
/** The composition root owns persistence; Session owns only the navigation decisions. */
export interface SessionLifecyclePort {
  setOrder(workspaceId: string, ids: string[]): void;
  setActiveDocument(workspaceId: string, documentId: string | undefined): void;
}
