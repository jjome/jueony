import type { Snapshot } from '../../document/public/index.ts';
import type { Source } from '../../references/public/index.ts';
import type { Message } from '../../workspace/public/index.ts';

export type ProviderId = 'openai-responses' | 'anthropic' | 'gemini' | 'openai-compatible' | 'hyperclova';
const documentToolProviders: readonly ProviderId[]=['openai-responses','anthropic','gemini','openai-compatible'];
/** Stored UI metadata. Credentials never belong to a model configuration. */
export type ModelConfig = {
  id: string;
  adapterId: ProviderId;
  label: string;
  endpoint: string;
  modelId: string;
  maxOutputTokens?: number;
};
export function supportsDocumentTools(config:Pick<ModelConfig,'adapterId'|'modelId'|'maxOutputTokens'>):boolean{
  if(config.adapterId!=='hyperclova')return documentToolProviders.includes(config.adapterId);
  return ['HCX-005','HCX-007'].includes(config.modelId)&&(config.maxOutputTokens??4096)>=1024;
}
export type ModelInput = { request: string; document: Snapshot; references: Source[]; history: Message[] };
export type DocumentToolName = 'read_paragraph' | 'list_paragraphs' | 'find_reference' | 'inspect_layout';
export type DocumentToolCall = { id: string; name: DocumentToolName; arguments: string };
export type DocumentToolResult = { call: DocumentToolCall; result: string };
export type DocumentToolInput = {
  request: string;
  paragraphs: { id: string; editable: boolean }[];
  referenceCount: number;
  readOnly?: true;
  repair?: 'unverified-citation';
  documentScope?: { mode: 'windowed-read-only'|'windowed-edit'; sectionParagraphs: number[] };
  continuation?: string;
  finalize?: true|'read-only';
  tools: DocumentToolName[];
  turns: DocumentToolResult[][];
};
/** Untrusted model output is validated by the Agent/Document boundary before execution. */
export interface ModelGatewayPort {
  generate(input: ModelInput, model: ModelConfig, signal: AbortSignal): Promise<unknown>;
  generateDocumentToolTurn?(input: DocumentToolInput, model: ModelConfig, signal: AbortSignal): Promise<unknown>;
}
export type ConnectionMetadata = { config: ModelConfig; remember: boolean; hasKey: boolean; auth?: 'gemini-oauth' };
export type ConnectionList = { connections: ConnectionMetadata[]; secureStorage: boolean; warning: string; geminiOAuth?: boolean };
export type GeminiOAuthResult = {status:'pending'}|{status:'connected';configId:string};
export type ConnectionProbe = { connected: true; documentSent: false };
/** Connection management and model generation remain independently consumable interfaces. */
export interface ConnectionFacade {
  connections(): Promise<ConnectionList>;
  configure(config: ModelConfig, key: string | undefined, remember?: boolean): Promise<{ configured: true }>;
  testConnection(config: ModelConfig, key: string | undefined, signal?: AbortSignal): Promise<ConnectionProbe>;
  removeConnection(configId: string): Promise<{ removed: true }>;
  clearCredentials(): Promise<{ cleared: true }>;
  discoverLocal?(endpoint: string, configId?: string, key?: string, signal?: AbortSignal): Promise<{kind:'openai-compatible'|'ollama';models:string[]}>;
  testDocumentTools?(config: ModelConfig, key: string | undefined, signal?: AbortSignal): Promise<{supported:boolean}>;
  startGeminiOAuth?(config:ModelConfig,remember:boolean):Promise<{id:string;url:string}>;
  finishGeminiOAuth?(id:string):Promise<GeminiOAuthResult>;
  cancelGeminiOAuth?(id:string):Promise<void>;
}
