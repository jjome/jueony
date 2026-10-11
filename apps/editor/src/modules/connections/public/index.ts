import type { Snapshot } from '../../document/public/index.ts';
import type { Source } from '../../references/public/index.ts';
import type { Message } from '../../workspace/public/index.ts';

export type ProviderId = 'openai-responses' | 'anthropic' | 'gemini' | 'openai-compatible' | 'hyperclova';
/** Stored UI metadata. Credentials never belong to a model configuration. */
export type ModelConfig = {
  id: string;
  adapterId: ProviderId;
  label: string;
  endpoint: string;
  modelId: string;
  maxOutputTokens?: number;
};
export type ModelInput = { request: string; document: Snapshot; references: Source[]; history: Message[] };
/** Untrusted model output is validated by the Agent/Document boundary before execution. */
export interface ModelGatewayPort {
  generate(input: ModelInput, model: ModelConfig, signal: AbortSignal): Promise<unknown>;
}
export type ConnectionMetadata = { config: ModelConfig; remember: boolean; hasKey: boolean };
export type ConnectionList = { connections: ConnectionMetadata[]; secureStorage: boolean; warning: string };
export type ConnectionProbe = { connected: true; documentSent: false };
/** Connection management and model generation remain independently consumable interfaces. */
export interface ConnectionFacade {
  connections(): Promise<ConnectionList>;
  configure(config: ModelConfig, key: string | undefined, remember?: boolean): Promise<{ configured: true }>;
  testConnection(config: ModelConfig, key: string | undefined, signal?: AbortSignal): Promise<ConnectionProbe>;
  removeConnection(configId: string): Promise<{ removed: true }>;
  clearCredentials(): Promise<{ cleared: true }>;
}
