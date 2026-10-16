// Legacy v1 aggregate persistence DTO. New feature code consumes module public contracts.
import type {DocumentViewState} from '../../modules/preferences/public/index.ts';
import type {RetrievalSummary,Source} from '../../modules/references/public/index.ts';
import type {AgentEvent,RunStatus} from '../../modules/agent/public/index.ts';
import type {CommandMacro,CommandTemplate} from '../../modules/automation/public/index.ts';
import type {Receipt} from '../../modules/document/public/index.ts';
import type {ModelConfig} from '../../modules/connections/public/index.ts';
import type {Workspace,Chat} from '../../modules/workspace/public/index.ts';
import type {StoredFileConnection} from '../files/file-connection.ts';
import type {RecoveryRecord} from '../../modules/document-files/public/index.ts';
import {addWorkspace as add,addChat as newChat,interruptRuns as interrupt} from '../../modules/workspace/public/index.ts';
export type {BodyNode,Snapshot,BodyOp,EditOp,Receipt} from '../../modules/document/public/index.ts';
export {plainSnapshot} from '../../modules/document/public/index.ts';
export type {Generation,RunStatus} from '../../modules/agent/public/index.ts';
export type {Source} from '../../modules/references/public/index.ts';
export type {ModelConfig} from '../../modules/connections/public/index.ts';
export type {Message,Chat,Workspace} from '../../modules/workspace/public/index.ts';
export {workspaceOf,chatOf,appendMessage} from '../../modules/workspace/public/index.ts';
export type Run = { id: string; workspaceId: string; chatId: string; documentId: string; status: RunStatus; model?: Omit<ModelConfig,'id'>; sources: Omit<Source,'text'>[]; receipt?: Receipt; macroTemplate?:CommandTemplate; retrieval?:RetrievalSummary; events?:AgentEvent[]; usedSourceIds?: string[]; error?: string; createdAt: number };
export type Folder = { id: string; workspaceId: string; name: string; handle: FileSystemDirectoryHandle };
export type SavedDocument = RecoveryRecord & { viewUpdatedAt?:number; view?:DocumentViewState; fileConnection?: StoredFileConnection };
export type AppState = { version: 1; activeWorkspaceId: string; workspaces: Workspace[]; chats: Chat[]; folders: Folder[]; runs: Run[]; models: ModelConfig[]; split: number; agentWidth?: number; sidebarHidden?: boolean; focusMode?:boolean; retrieveSources?:boolean; reviewBeforeApply?:boolean; macros?:CommandMacro[] };

export const uid=()=>crypto.randomUUID();
export function initialState():AppState{return {version:1,activeWorkspaceId:'',workspaces:[],chats:[],folders:[],runs:[],models:[],split:42};}
export const addWorkspace=(state:AppState,name:string)=>add(state,name,uid);
export const addChat=(state:AppState,workspaceId:string,title:string)=>newChat(state,workspaceId,title,uid);
export const interruptRuns=(state:AppState)=>interrupt(state,uid);
