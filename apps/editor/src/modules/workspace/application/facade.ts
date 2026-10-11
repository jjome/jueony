import type { WorkspaceFacade } from '../public/contracts.ts';
import type { WorkspaceIdPort, WorkspaceStatePort } from '../ports/state.ts';
import { addChat, addWorkspace, appendMessage, chatOf, workspaceOf } from '../domain/workspace.ts';

export function createWorkspaceFacade(options: { state: WorkspaceStatePort; ids: WorkspaceIdPort }): WorkspaceFacade {
  const current = () => options.state.current();
  const nextId = () => options.ids.next();
  return {
    workspace: id => workspaceOf(current(), id),
    chat: (workspaceId, chatId) => chatOf(current(), workspaceId, chatId),
    addWorkspace: name => addWorkspace(current(), name, nextId),
    addChat: (workspaceId, title) => addChat(current(), workspaceId, title, nextId),
    appendMessage: (workspaceId, chatId, message) => appendMessage(current(), workspaceId, chatId, message),
  };
}
