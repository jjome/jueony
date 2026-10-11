import type { Chat, InterruptedRun, Message, Workspace, WorkspaceState } from '../public/contracts.ts';

export function workspaceOf(state: WorkspaceState, id: string): Workspace {
  const workspace = state.workspaces.find(item => item.id === id);
  if (!workspace) throw new Error('업무를 찾을 수 없습니다.');
  return workspace;
}
export function chatOf(state: WorkspaceState, workspaceId: string, id: string): Chat {
  workspaceOf(state, workspaceId);
  const chat = state.chats.find(item => item.id === id && item.workspaceId === workspaceId);
  if (!chat) throw new Error('이 업무의 채팅이 아닙니다.');
  return chat;
}
export function addChat(state: WorkspaceState, workspaceId: string, title: string, nextId: () => string): Chat {
  const workspace = workspaceOf(state, workspaceId);
  const chat: Chat = { id: nextId(), workspaceId, title: title.trim() || '새 채팅', messages: [] };
  state.chats.push(chat);
  workspace.activeChatId = chat.id;
  return chat;
}
export function addWorkspace(state: WorkspaceState, name: string, nextId: () => string): Workspace {
  const workspace: Workspace = { id: nextId(), name: name.trim() || '새 업무', activeChatId: '' };
  state.workspaces.push(workspace);
  state.activeWorkspaceId = workspace.id;
  addChat(state, workspace.id, '첫 채팅', nextId);
  return workspace;
}
export function appendMessage(state: WorkspaceState, workspaceId: string, chatId: string, message: Message): void {
  chatOf(state, workspaceId, chatId).messages.push(message);
}
/** Recovery changes only incomplete run status and its owning chat, once. */
export function interruptRuns(state: WorkspaceState & { runs: InterruptedRun[] }, nextId: () => string): void {
  for (const run of state.runs) {
    if (!['preparing_context', 'generating', 'validating', 'applying'].includes(run.status)) continue;
    run.status = 'interrupted';
    run.error = '이전 실행이 중단되었습니다. 문서 반영 여부는 복구본을 확인해 주세요. 자동 재적용하지 않습니다.';
    const chat = state.chats.find(item => item.id === run.chatId && item.workspaceId === run.workspaceId);
    if (chat && !chat.messages.some(message => message.runId === run.id && message.role === 'assistant')) {
      chat.messages.push({ id: nextId(), role: 'assistant', text: run.error, runId: run.id });
    }
  }
}
