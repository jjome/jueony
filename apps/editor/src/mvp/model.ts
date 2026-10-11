import type {DocumentViewState} from '../preferences/document-view.ts';
import type {RetrievalSummary} from '../retrieval/selected-sources.ts';
import type {AgentEvent} from '../agent/run-bounded.ts';
import type {CommandMacro,CommandTemplate} from '../macros/commands.ts';
export type BodyNode = { id: string; section: number; paragraph: number; text: string; editable: boolean; reason?: string };
import type { Structure } from '../document-control/structure.ts';
import type { StoredFileConnection } from '../file-connection.ts';
import type { ControlOp } from '../document-control/operations.ts';
export type Snapshot = { revision: string; name: string; plainText?: string; nodes: BodyNode[]; limitations: string[]; structure?: Structure };
export type BodyOp =
 | { kind: 'create_document'; paragraphs: string[] }
 | { kind: 'insert_body_paragraphs'; after: string; paragraphs: string[] }
 | { kind: 'replace_body_text'; target: string; start: number; count: number; text: string }
 | { kind: 'delete_body_text'; target: string; start: number; count: number };
export type EditOp = BodyOp | ControlOp;
export type Generation = { message: string; operations: EditOp[]; sourceIds: string[] };
export type Receipt = { runId: string; beforeRevision: string; afterRevision: string; before: string; after: string; operationCount: number; beforeStructure?: Structure; afterStructure?: Structure };
export type Source = { id: string; name: string; text: string; characters: number; sha256: string; limitation?: string };
export type ModelConfig = { id: string; adapterId: 'openai-responses' | 'anthropic' | 'gemini' | 'openai-compatible' | 'hyperclova'; label: string; endpoint: string; modelId: string; maxOutputTokens?: number };
export type RunStatus = 'preparing_context' | 'generating' | 'validating' | 'applying' | 'completed' | 'cancelled' | 'conflict' | 'failed_no_change' | 'failed_rolled_back' | 'failed_partial' | 'interrupted';
export type Run = { id: string; workspaceId: string; chatId: string; documentId: string; status: RunStatus; model?: Omit<ModelConfig,'id'>; sources: Omit<Source,'text'>[]; receipt?: Receipt; macroTemplate?:CommandTemplate; retrieval?:RetrievalSummary; events?:AgentEvent[]; usedSourceIds?: string[]; error?: string; createdAt: number };
export type Message = { id: string; role: 'user' | 'assistant'; text: string; runId?: string };
export type Chat = { id: string; workspaceId: string; title: string; messages: Message[]; modelId?: string };
export type Folder = { id: string; workspaceId: string; name: string; handle: FileSystemDirectoryHandle };
export type Workspace = { id: string; name: string; activeChatId: string; activeDocumentId?: string; documentOrder?: string[] };
export type SavedDocument = { id: string; workspaceId: string; name: string; bytes: Uint8Array; dirty: boolean; updatedAt: number; view?:DocumentViewState; fileConnection?: StoredFileConnection };
export type AppState = { version: 1; activeWorkspaceId: string; workspaces: Workspace[]; chats: Chat[]; folders: Folder[]; runs: Run[]; models: ModelConfig[]; split: number; agentWidth?: number; sidebarHidden?: boolean; focusMode?:boolean; retrieveSources?:boolean; reviewBeforeApply?:boolean; macros?:CommandMacro[] };
export const uid = () => crypto.randomUUID();
export function initialState(): AppState { return { version:1,activeWorkspaceId:'',workspaces:[],chats:[],folders:[],runs:[],models:[],split:42 }; }
export function workspaceOf(state: AppState, id: string) { const w=state.workspaces.find(w=>w.id===id); if(!w) throw new Error('업무를 찾을 수 없습니다.'); return w; }
export function chatOf(state: AppState, workspaceId: string, id: string) { workspaceOf(state,workspaceId); const c=state.chats.find(c=>c.id===id&&c.workspaceId===workspaceId); if(!c) throw new Error('이 업무의 채팅이 아닙니다.'); return c; }
export function addWorkspace(state: AppState, name: string) { const w={id:uid(),name:name.trim()||'새 업무',activeChatId:''};state.workspaces.push(w);state.activeWorkspaceId=w.id;addChat(state,w.id,'첫 채팅');return w; }
export function addChat(state: AppState, workspaceId: string, title: string) { const w=workspaceOf(state,workspaceId);const c:Chat={id:uid(),workspaceId,title:title.trim()||'새 채팅',messages:[]};state.chats.push(c);w.activeChatId=c.id;return c; }
export function appendMessage(state:AppState, workspaceId:string, chatId:string, message:Message) {chatOf(state,workspaceId,chatId).messages.push(message);}
export function interruptRuns(state:AppState) {for(const r of state.runs) if(['preparing_context','generating','validating','applying'].includes(r.status)){r.status='interrupted';r.error='이전 실행이 중단되었습니다. 문서 반영 여부는 복구본을 확인해 주세요. 자동 재적용하지 않습니다.';const chat=state.chats.find(c=>c.id===r.chatId&&c.workspaceId===r.workspaceId);if(chat&&!chat.messages.some(m=>m.runId===r.id&&m.role==='assistant'))chat.messages.push({id:uid(),role:'assistant',text:r.error,runId:r.id});}}
export function plainSnapshot(s:Snapshot) {return s.nodes.map(n=>n.text).join('\n');}
