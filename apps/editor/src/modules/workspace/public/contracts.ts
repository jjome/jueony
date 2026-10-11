/** Workspace-owned data. Browser file handles and other modules' records stay outside this contract. */
export type Message = { id: string; role: 'user' | 'assistant'; text: string; runId?: string };
export type Chat = { id: string; workspaceId: string; title: string; messages: Message[]; modelId?: string };
export type Workspace = { id: string; name: string; activeChatId: string; activeDocumentId?: string; documentOrder?: string[] };
export type WorkspaceState = { activeWorkspaceId: string; workspaces: Workspace[]; chats: Chat[] };
export type InterruptedRun = { id: string; workspaceId: string; chatId: string; status: string; error?: string };
export interface WorkspaceFacade {
  workspace(id: string): Workspace;
  chat(workspaceId: string, chatId: string): Chat;
  addWorkspace(name: string): Workspace;
  addChat(workspaceId: string, title: string): Chat;
  appendMessage(workspaceId: string, chatId: string, message: Message): void;
}
