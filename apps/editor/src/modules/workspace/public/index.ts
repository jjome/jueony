export type { Message, Chat, Workspace, WorkspaceState, InterruptedRun, WorkspaceFacade } from './contracts.ts';
export type { WorkspaceIdPort, WorkspaceStatePort } from '../ports/state.ts';
export { createWorkspaceFacade } from '../application/facade.ts';
// Transitional pure helpers for aggregate v1 compatibility callers.
export { workspaceOf, chatOf, addWorkspace, addChat, appendMessage, interruptRuns } from '../domain/workspace.ts';
